const nodemailer = require('nodemailer');
const pool = require('../config/db');

const LIVE_TIMING_HOST = process.env.LIVE_TIMING_HOST || 'rh.servegame.com';
const CHECK_INTERVAL_MS = Math.max(10000, Number(process.env.LIVE_MONITOR_INTERVAL_MS) || 15000);
const OUTAGE_THRESHOLD_MS = Math.max(60000, Number(process.env.LIVE_MONITOR_OUTAGE_MS) || 60000);
const REQUEST_TIMEOUT_MS = Math.max(3000, Number(process.env.LIVE_MONITOR_TIMEOUT_MS) || 8000);
const ALERT_RECIPIENT = process.env.LIVE_MONITOR_EMAIL || 'fede.cabello@hotmail.com';

const outages = new Map();
let interval;
let checkInProgress = false;

const getEnabled = async () => {
  const [[row]] = await pool.query(
    'SELECT smtp FROM auth LIMIT 1'
  );
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
  return rows;
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

const registerFailure = async (server, error) => {
  const key = String(server.id);
  const now = Date.now();
  const current = outages.get(key) || { failureSince: now, alertSent: false };
  current.lastError = error.name === 'AbortError' ? 'Tiempo de espera agotado' : error.message;
  outages.set(key, current);

  if (current.alertSent || now - current.failureSince < OUTAGE_THRESHOLD_MS) return;
  await sendEmail({
    subject: 'SERVIDOR CAIDO',
    text: [
      'El monitor de CADPO detecto que el servidor de tiempos lleva mas de 1 minuto sin responder.',
      '',
      `Campeonato: ${server.categoria} - Temporada ${server.temporada} (${server.anio})`,
      `Servidor: ${LIVE_TIMING_HOST}:${server.puerto} (numero ${server.n_server})`,
      `Error: ${current.lastError}`,
      `Detectado: ${new Date(current.failureSince).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`,
    ].join('\n'),
  });
  current.alertSent = true;
  console.warn(`Alerta de live timing enviada para el campeonato ${server.id}`);
};

const runCheck = async () => {
  if (checkInProgress) return;
  checkInProgress = true;
  try {
    if (!await getEnabled()) {
      outages.clear();
      return;
    }
    if (!smtpConfigured()) {
      console.warn('Monitor de live timing activo, pero la configuracion SMTP esta incompleta.');
      return;
    }

    const servers = await getServersToMonitor();
    const activeIds = new Set(servers.map(server => String(server.id)));
    for (const key of outages.keys()) {
      if (!activeIds.has(key)) outages.delete(key);
    }

    await Promise.all(servers.map(async server => {
      try {
        await probeServer(server);
        outages.delete(String(server.id));
      } catch (error) {
        try {
          await registerFailure(server, error);
        } catch (emailError) {
          console.error(`No se pudo enviar la alerta del campeonato ${server.id}:`, emailError.message);
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
  monitoredOutages: outages.size,
});

const start = () => {
  if (interval) return;
  setTimeout(runCheck, 3000);
  interval = setInterval(runCheck, CHECK_INTERVAL_MS);
  interval.unref?.();
};

module.exports = { getStatus, runCheck, sendTestEmail, setEnabled, start };
