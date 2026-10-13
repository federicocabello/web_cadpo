const nodemailer = require('nodemailer');
const pool = require('../config/db');

const LIVE_TIMING_HOST = process.env.LIVE_TIMING_HOST || 'rh.servegame.com';
const CHECK_INTERVAL_MS = Math.max(10000, Number(process.env.LIVE_MONITOR_INTERVAL_MS) || 15000);
const OUTAGE_THRESHOLD_MS = Math.max(60000, Number(process.env.LIVE_MONITOR_OUTAGE_MS) || 60000);
const REQUEST_TIMEOUT_MS = Math.max(20000, Number(process.env.LIVE_MONITOR_TIMEOUT_MS) || 25000);
const CONFIRMATION_ATTEMPTS = 3;
const CONFIRMATION_DELAY_MS = 5000;
const MIN_FAILURES_BEFORE_ALERT = 3;
const RECOVERY_SUCCESSES = 3;
const ALERT_COOLDOWN_MS = Math.max(
  30 * 60 * 1000,
  Number(process.env.LIVE_MONITOR_ALERT_COOLDOWN_MS) || 30 * 60 * 1000,
);
const MONITOR_LOCK_NAME = 'cadpo_live_timing_monitor_v2';
const ALERT_RECIPIENT = process.env.LIVE_MONITOR_EMAIL || 'fede.cabello@hotmail.com';

const outages = new Map();
const lastAlerts = new Map();
let interval;
let checkInProgress = false;
let leaderConnection;

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const getServerKey = server => `${Number(server.puerto)}:${Number(server.n_server)}`;

const getEnabled = async () => {
  const [[row]] = await pool.query('SELECT smtp FROM auth LIMIT 1');
  return Number(row?.smtp) === 1;
};

const setEnabled = async enabled => {
  const [result] = await pool.query('UPDATE auth SET smtp = ?', [enabled ? 1 : 0]);
  if (!result.affectedRows) throw new Error('No existe una fila de configuracion en la tabla auth');
  if (!enabled) outages.clear();
  return Boolean(enabled);
};

const smtpConfigured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_PORT
  && process.env.SMTP_USER
  && process.env.SMTP_PASSWORD
  && process.env.SMTP_FROM
);

const createTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendEmail = async ({ subject, text }) => {
  if (!smtpConfigured()) throw new Error('La configuracion SMTP esta incompleta');
  return createTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: ALERT_RECIPIENT,
    subject,
    text,
  });
};

const sendTestEmail = () => sendEmail({
  subject: '[CADPO] Prueba del monitor de tiempos en vivo',
  text: 'El envio SMTP del monitor de tiempos en vivo funciona correctamente.',
});

const getServersToMonitor = async () => {
  const [rows] = await pool.query(`
    SELECT DISTINCT c.id, c.temporada, c.anio, c.puerto, c.n_server, cat.categoria
    FROM campeonatos c
    JOIN categorias cat ON cat.id = c.idcategoria
    JOIN calendario cal ON cal.idcampeonato = c.id
    WHERE c.puerto IS NOT NULL
      AND c.n_server IS NOT NULL
      AND cal.fecha >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      AND cal.fecha < DATE_ADD(NOW(), INTERVAL 7 DAY)
  `);

  const uniqueServers = new Map();
  rows.forEach(server => {
    const key = getServerKey(server);
    if (!uniqueServers.has(key)) uniqueServers.set(key, server);
  });
  return [...uniqueServers.values()];
};

const ensureMonitorLeadership = async () => {
  if (leaderConnection) {
    try {
      await leaderConnection.query('SELECT 1');
      return true;
    } catch (_error) {
      try { leaderConnection.release(); } catch (_releaseError) { /* Conexion perdida. */ }
      leaderConnection = undefined;
    }
  }

  const connection = await pool.getConnection();
  try {
    const [[row]] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [MONITOR_LOCK_NAME]);
    if (Number(row?.acquired) !== 1) {
      connection.release();
      return false;
    }
    leaderConnection = connection;
    console.log('Monitor de live timing activo en este proceso.');
    return true;
  } catch (error) {
    connection.release();
    throw error;
  }
};

const probeServer = async server => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `http://${LIVE_TIMING_HOST}:${Number(server.puerto)}/api/live-timings/leaderboard.json?server=${Number(server.n_server)}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const probeLiveTimingPage = async server => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `http://${LIVE_TIMING_HOST}:${Number(server.puerto)}/live-timing?server=${Number(server.n_server)}`;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.body?.cancel();
  } finally {
    clearTimeout(timeout);
  }
};

const confirmOutage = async server => {
  let lastError;
  for (let attempt = 1; attempt <= CONFIRMATION_ATTEMPTS; attempt += 1) {
    try {
      await probeServer(server);
      return { down: false, attempt };
    } catch (error) {
      lastError = error;
      try {
        await probeLiveTimingPage(server);
        return { down: false, attempt, fallback: true };
      } catch (fallbackError) {
        lastError = fallbackError;
      }
      if (attempt < CONFIRMATION_ATTEMPTS) await wait(CONFIRMATION_DELAY_MS);
    }
  }
  return { down: true, error: lastError };
};

const registerFailure = async (server, error) => {
  const key = getServerKey(server);
  const now = Date.now();
  const current = outages.get(key) || {
    failureSince: now,
    alertSent: false,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
  };
  current.consecutiveFailures += 1;
  current.consecutiveSuccesses = 0;
  current.lastError = error.name === 'AbortError' ? 'Tiempo de espera agotado' : error.message;
  outages.set(key, current);

  if (current.alertSent
    || current.consecutiveFailures < MIN_FAILURES_BEFORE_ALERT
    || now - current.failureSince < OUTAGE_THRESHOLD_MS
    || now - Number(lastAlerts.get(key) || 0) < ALERT_COOLDOWN_MS) return;

  const confirmation = await confirmOutage(server);
  if (!confirmation.down) {
    outages.delete(key);
    console.warn(`Fallo transitorio descartado para ${key}; el servidor respondio en la verificacion ${confirmation.attempt}${confirmation.fallback ? ' mediante la pagina de live timing' : ''}.`);
    return;
  }

  current.lastError = confirmation.error?.name === 'AbortError'
    ? 'Tiempo de espera agotado'
    : confirmation.error?.message || current.lastError;
  await sendEmail({
    subject: 'SERVIDOR CAIDO',
    text: [
      `El monitor de CADPO detecto que el servidor de tiempos lleva mas de 1 minuto sin responder y confirmo la caida con ${CONFIRMATION_ATTEMPTS} verificaciones adicionales.`,
      '',
      `Campeonato: ${server.categoria} - Temporada ${server.temporada} (${server.anio})`,
      `Servidor: ${LIVE_TIMING_HOST}:${server.puerto} (numero ${server.n_server})`,
      `Error: ${current.lastError}`,
      `Detectado: ${new Date(current.failureSince).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`,
    ].join('\n'),
  });
  current.alertSent = true;
  lastAlerts.set(key, Date.now());
  outages.set(key, current);
  console.warn(`Alerta de live timing enviada para ${key}`);
};

const registerSuccess = server => {
  const key = getServerKey(server);
  const current = outages.get(key);
  if (!current) return;

  // Antes de una alerta, una sola respuesta correcta corta la supuesta caida.
  if (!current.alertSent) {
    outages.delete(key);
    return;
  }

  // Despues de alertar exigimos estabilidad para evitar ciclos de correo por
  // una conexion que alterna brevemente entre disponible y no disponible.
  current.consecutiveSuccesses = Number(current.consecutiveSuccesses || 0) + 1;
  current.consecutiveFailures = 0;
  if (current.consecutiveSuccesses >= RECOVERY_SUCCESSES) outages.delete(key);
  else outages.set(key, current);
};

const runCheck = async () => {
  if (checkInProgress) return;
  checkInProgress = true;
  try {
    // Passenger puede levantar mas de un proceso. El lock de MySQL garantiza
    // que solamente uno de ellos ejecute el monitor y envie correos.
    if (!await ensureMonitorLeadership()) return;
    if (!await getEnabled()) {
      outages.clear();
      return;
    }
    if (!smtpConfigured()) {
      console.warn('Monitor de live timing activo, pero la configuracion SMTP esta incompleta.');
      return;
    }

    const servers = await getServersToMonitor();
    const activeIds = new Set(servers.map(getServerKey));
    for (const key of outages.keys()) {
      if (!activeIds.has(key)) outages.delete(key);
    }

    await Promise.all(servers.map(async server => {
      try {
        await probeServer(server);
        registerSuccess(server);
      } catch (error) {
        try {
          await registerFailure(server, error);
        } catch (emailError) {
          console.error(`No se pudo enviar la alerta del servidor ${getServerKey(server)}:`, emailError.message);
        }
      }
    }));
  } catch (error) {
    console.error('Error en el monitor de live timing:', error.message);
  } finally {
    checkInProgress = false;
  }
};

const getStatus = async () => ({
  enabled: await getEnabled(),
  smtpConfigured: smtpConfigured(),
  recipient: ALERT_RECIPIENT,
  outageThresholdSeconds: Math.round(OUTAGE_THRESHOLD_MS / 1000),
  checkIntervalSeconds: Math.round(CHECK_INTERVAL_MS / 1000),
  requestTimeoutSeconds: Math.round(REQUEST_TIMEOUT_MS / 1000),
  confirmationAttempts: CONFIRMATION_ATTEMPTS,
  minimumFailures: MIN_FAILURES_BEFORE_ALERT,
  recoverySuccesses: RECOVERY_SUCCESSES,
  alertCooldownMinutes: Math.round(ALERT_COOLDOWN_MS / 60000),
  monitoredOutages: outages.size,
});

const start = () => {
  if (interval) return;
  setTimeout(runCheck, 3000);
  interval = setInterval(runCheck, CHECK_INTERVAL_MS);
  interval.unref?.();
};

module.exports = { getStatus, runCheck, sendTestEmail, setEnabled, start };
