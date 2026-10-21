const crypto = require('crypto');
const nodemailer = require('nodemailer');

const D1_TIMEOUT_MS = 8000;
const SMTP_TIMEOUT_MS = 12000;
const DEFAULT_DAILY_NEURON_LIMIT = 10_000;
const QUOTA_SYNC_MODEL = '__cloudflare_quota_sync__';
const MODEL_NEURON_RATES = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { input: 26_668, output: 204_805 },
  '@cf/meta/llama-3.1-70b-instruct-fp8-fast': { input: 26_668, output: 204_805 },
};
let usageTablePromise = null;
let dailyUsageCache = { expiresAt: 0, value: null };

const clean = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const hashIp = ip => {
  const value = clean(ip, 160);
  if (!value) return null;
  const secret = process.env.AYRTON_IP_SECRET || process.env.POLL_IP_SECRET || 'cadpo-ayrton';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
};

const getD1Config = () => ({
  accountId: clean(process.env.CLOUDFLARE_ACCOUNT_ID, 80),
  databaseId: clean(process.env.CLOUDFLARE_D1_DATABASE_ID, 80),
  apiToken: clean(process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_AI_API_TOKEN, 300),
});

const isD1Configured = () => {
  const config = getD1Config();
  return Boolean(config.accountId && config.databaseId && config.apiToken);
};

const queryD1 = async (sql, params = []) => {
  const { accountId, databaseId, apiToken } = getD1Config();
  if (!accountId || !databaseId || !apiToken) return { configured: false, rows: [] };

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(D1_TIMEOUT_MS),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const detail = payload?.errors?.[0]?.message || `HTTP ${response.status}`;
    throw new Error(`D1 rechazó la consulta: ${detail}`);
  }

  return {
    configured: true,
    rows: payload?.result?.[0]?.results || [],
    meta: payload?.result?.[0]?.meta || null,
  };
};

const saveInteraction = async ({ sessionId, question, answer, ip, userAgent, durationMs }) => {
  if (!isD1Configured()) return { saved: false, reason: 'not_configured' };
  await queryD1(`INSERT INTO ayrton_messages
    (session_id, question, answer, ip_hash, user_agent, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`, [
    clean(sessionId, 100) || null,
    clean(question, 2000),
    clean(answer, 8000),
    hashIp(ip),
    clean(userAgent, 500) || null,
    Number.isFinite(Number(durationMs)) ? Math.max(0, Math.round(Number(durationMs))) : null,
  ]);
  return { saved: true };
};

const getDailyNeuronLimit = () => {
  const configured = Number(process.env.AYRTON_DAILY_NEURON_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? Math.round(configured) : DEFAULT_DAILY_NEURON_LIMIT;
};

const calculateNeurons = (model, usage) => {
  const rates = MODEL_NEURON_RATES[String(model || '').trim()];
  if (!rates) return null;
  const inputTokens = Math.max(0, Number(usage?.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(usage?.outputTokens) || 0);
  return ((inputTokens * rates.input) + (outputTokens * rates.output)) / 1_000_000;
};

const ensureUsageTable = async () => {
  if (!isD1Configured()) return false;
  if (!usageTablePromise) {
    usageTablePromise = queryD1(`
      CREATE TABLE IF NOT EXISTS ayrton_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        neurons REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(async () => {
      const columns = await queryD1('PRAGMA table_info(ayrton_usage)');
      if (!columns.rows.some(column => column.name === 'neurons')) {
        await queryD1('ALTER TABLE ayrton_usage ADD COLUMN neurons REAL NOT NULL DEFAULT 0');
      }
      await queryD1(`
        UPDATE ayrton_usage
        SET neurons = ((input_tokens * 26668.0) + (output_tokens * 204805.0)) / 1000000.0
        WHERE neurons = 0
          AND (input_tokens > 0 OR output_tokens > 0)
          AND model IN (?, ?)
      `, [
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        '@cf/meta/llama-3.1-70b-instruct-fp8-fast',
      ]);
      return true;
    }).catch(error => {
      usageTablePromise = null;
      throw error;
    });
  }
  return usageTablePromise;
};

const saveUsage = async ({ sessionId, model, usage }) => {
  if (!isD1Configured()) return { saved: false, reason: 'not_configured' };
  await ensureUsageTable();
  const inputTokens = Math.max(0, Math.round(Number(usage?.inputTokens) || 0));
  const outputTokens = Math.max(0, Math.round(Number(usage?.outputTokens) || 0));
  const totalTokens = Math.max(0, Math.round(Number(usage?.totalTokens) || (inputTokens + outputTokens)));
  const neurons = calculateNeurons(model, { inputTokens, outputTokens });
  await queryD1(`
    INSERT INTO ayrton_usage (session_id, model, input_tokens, output_tokens, total_tokens, neurons, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    clean(sessionId, 100) || null,
    clean(model, 180) || 'Modelo no informado',
    inputTokens,
    outputTokens,
    totalTokens,
    neurons || 0,
  ]);
  dailyUsageCache = { expiresAt: 0, value: null };
  return { saved: true };
};

const getUsageSummary = async () => {
  if (!isD1Configured()) return { configured: false };
  await ensureUsageTable();
  const [summary, byDay, messageCount] = await Promise.all([
    queryD1(`
      SELECT
        COALESCE(SUM(CASE WHEN model <> '${QUOTA_SYNC_MODEL}' THEN 1 ELSE 0 END), 0) AS requests_total,
        COALESCE(SUM(input_tokens), 0) AS input_tokens_total,
        COALESCE(SUM(output_tokens), 0) AS output_tokens_total,
        COALESCE(SUM(total_tokens), 0) AS tokens_total,
        COALESCE(SUM(neurons), 0) AS neurons_total,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') AND model <> '${QUOTA_SYNC_MODEL}' THEN 1 ELSE 0 END), 0) AS requests_today,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN input_tokens ELSE 0 END), 0) AS input_tokens_today,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN output_tokens ELSE 0 END), 0) AS output_tokens_today,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN total_tokens ELSE 0 END), 0) AS tokens_today,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN neurons ELSE 0 END), 0) AS neurons_today,
        COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-30 days') AND model <> '${QUOTA_SYNC_MODEL}' THEN 1 ELSE 0 END), 0) AS requests_30d,
        COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN total_tokens ELSE 0 END), 0) AS tokens_30d,
        MIN(created_at) AS tracking_since,
        MAX(created_at) AS last_request_at
      FROM ayrton_usage
    `),
    queryD1(`
      SELECT date(created_at) AS day,
             COALESCE(SUM(CASE WHEN model <> '${QUOTA_SYNC_MODEL}' THEN 1 ELSE 0 END), 0) AS requests,
             COALESCE(SUM(total_tokens), 0) AS tokens,
             COALESCE(SUM(neurons), 0) AS neurons
      FROM ayrton_usage
      WHERE date(created_at) >= date('now', 'start of month')
        AND date(created_at) < date('now', 'start of month', '+1 month')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `),
    queryD1('SELECT COUNT(*) AS total FROM ayrton_messages'),
  ]);

  const totals = summary.rows[0] || {};
  const trackedRequests = Number(totals.requests_total || 0);
  const historicalMessages = Number(messageCount.rows[0]?.total || 0);
  const dailyLimit = getDailyNeuronLimit();
  const neuronsToday = Number(totals.neurons_today || 0);
  const nextReset = new Date();
  nextReset.setUTCHours(24, 0, 0, 0);
  const dailyRows = new Map(byDay.rows.map(row => [String(row.day), row]));
  const nowUtc = new Date();
  const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 0)).getUTCDate();
  const currentMonth = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(monthStart);
    date.setUTCDate(index + 1);
    const day = date.toISOString().slice(0, 10);
    const row = dailyRows.get(day) || {};
    const neurons = Number(row.neurons || 0);
    return {
      day,
      dayNumber: index + 1,
      isFuture: date.getTime() > Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate()),
      requests: Number(row.requests || 0),
      tokens: Number(row.tokens || 0),
      neurons,
      percentage: dailyLimit > 0 ? (neurons / dailyLimit) * 100 : 0,
    };
  });
  return {
    configured: true,
    model: String(process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
    requests: {
      today: Number(totals.requests_today || 0),
      last30Days: Number(totals.requests_30d || 0),
      trackedTotal: trackedRequests,
      previousUntracked: Math.max(0, historicalMessages - trackedRequests),
    },
    tokens: {
      today: Number(totals.tokens_today || 0),
      last30Days: Number(totals.tokens_30d || 0),
      inputTotal: Number(totals.input_tokens_total || 0),
      outputTotal: Number(totals.output_tokens_total || 0),
      trackedTotal: Number(totals.tokens_total || 0),
      inputToday: Number(totals.input_tokens_today || 0),
      outputToday: Number(totals.output_tokens_today || 0),
    },
    neurons: {
      today: neuronsToday,
      trackedTotal: Number(totals.neurons_total || 0),
      dailyLimit,
      remainingToday: Math.max(0, dailyLimit - neuronsToday),
      percentageToday: dailyLimit > 0 ? Math.min(100, (neuronsToday / dailyLimit) * 100) : 0,
      resetAt: nextReset.toISOString(),
      exactForCurrentModel: Boolean(MODEL_NEURON_RATES[String(process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast')]),
    },
    trackingSince: totals.tracking_since || null,
    lastRequestAt: totals.last_request_at || null,
    month: monthStart.toISOString().slice(0, 7),
    currentMonth,
  };
};

const getDailyUsageStatus = async () => {
  if (!isD1Configured()) return { configured: false, allowed: true };
  if (dailyUsageCache.value && dailyUsageCache.expiresAt > Date.now()) {
    return dailyUsageCache.value;
  }
  await ensureUsageTable();
  const result = await queryD1(`
    SELECT COALESCE(SUM(neurons), 0) AS neurons_today
    FROM ayrton_usage
    WHERE date(created_at) = date('now')
  `);
  const today = Number(result.rows[0]?.neurons_today || 0);
  const dailyLimit = getDailyNeuronLimit();
  const nextReset = new Date();
  nextReset.setUTCHours(24, 0, 0, 0);
  const status = {
    configured: true,
    allowed: today < dailyLimit,
    today,
    dailyLimit,
    remainingToday: Math.max(0, dailyLimit - today),
    percentageToday: dailyLimit > 0 ? Math.min(100, (today / dailyLimit) * 100) : 0,
    resetAt: nextReset.toISOString(),
  };
  dailyUsageCache = {
    expiresAt: Math.min(Date.now() + 30_000, nextReset.getTime()),
    value: status,
  };
  return status;
};

const markDailyUsageLimitReached = async () => {
  const dailyLimit = getDailyNeuronLimit();
  const nextReset = new Date();
  nextReset.setUTCHours(24, 0, 0, 0);
  const status = {
    configured: isD1Configured(),
    allowed: false,
    today: dailyLimit,
    dailyLimit,
    remainingToday: 0,
    percentageToday: 100,
    resetAt: nextReset.toISOString(),
  };

  dailyUsageCache = { expiresAt: nextReset.getTime(), value: status };
  if (!isD1Configured()) return status;

  try {
    await ensureUsageTable();
    await queryD1(`
      INSERT INTO ayrton_usage
        (session_id, model, input_tokens, output_tokens, total_tokens, neurons, created_at)
      SELECT NULL, ?, 0, 0, 0, MAX(0, ? - used_neurons), datetime('now')
      FROM (
        SELECT COALESCE(SUM(neurons), 0) AS used_neurons
        FROM ayrton_usage
        WHERE date(created_at) = date('now')
      )
      WHERE NOT EXISTS (
        SELECT 1 FROM ayrton_usage
        WHERE model = ? AND date(created_at) = date('now')
      )
    `, [QUOTA_SYNC_MODEL, dailyLimit, QUOTA_SYNC_MODEL]);
  } catch (error) {
    console.error('[Ayrton] No se pudo persistir el límite real de Cloudflare:', error.message);
  }

  return status;
};

const smtpConfigured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_PORT
  && process.env.SMTP_USER
  && process.env.SMTP_PASSWORD
  && process.env.SMTP_FROM
);

const notificationsEnabled = () => (
  String(process.env.AYRTON_EMAIL_NOTIFICATIONS || 'true').toLowerCase() !== 'false'
  && smtpConfigured()
);

const errorNotificationsEnabled = () => (
  String(process.env.AYRTON_ERROR_EMAIL_NOTIFICATIONS || 'true').toLowerCase() !== 'false'
  && smtpConfigured()
);

const createSmtpTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  connectionTimeout: SMTP_TIMEOUT_MS,
  greetingTimeout: SMTP_TIMEOUT_MS,
  socketTimeout: SMTP_TIMEOUT_MS,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const formatArgentinaDateTime = value => {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second} H`;
};

const toAsciiHtml = value => Array.from(String(value || '')).map(character => {
  if (character === '&') return '&amp;';
  if (character === '<') return '&lt;';
  if (character === '>') return '&gt;';
  if (character === '"') return '&quot;';
  if (character === "'") return '&#39;';
  if (character === '\n') return '<br>';
  const codePoint = character.codePointAt(0);
  return codePoint >= 32 && codePoint <= 126 ? character : `&#${codePoint};`;
}).join('');

const notifyInteraction = async ({ sessionId, question, answer, durationMs }) => {
  if (!notificationsEnabled()) return { sent: false, reason: 'not_configured' };

  const transporter = createSmtpTransport();

  const body = [
    'Alguien utilizó el agente IA Ayrton.',
    '',
    `Consulta: ${clean(question, 2000)}`,
    '',
    `Respuesta: ${clean(answer, 8000)}`,
    '',
    `Sesión: ${clean(sessionId, 100) || 'Sin identificar'}`,
    `Tiempo de respuesta: ${Math.max(0, Math.round(Number(durationMs) || 0))} ms`,
    `Fecha: ${formatArgentinaDateTime(new Date())}`,
  ].join('\n');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#15171d;color:#f5f7fa;font-family:Arial,sans-serif">
  <div style="max-width:680px;margin:0 auto;padding:24px">
    <div style="border-top:3px solid #20f4d0;background:#20232a;padding:20px">
      <div style="font-size:11px;letter-spacing:3px;color:#8d939c">CADPO TEAM RADIO</div>
      <div style="margin-top:4px;font-size:28px;font-weight:800;font-style:italic"><span style="color:#20f4d0">AYRTON</span> RADIO</div>
    </div>
    <div style="padding:22px;background:#191c22;border-left:2px solid #20f4d0">
      <p style="margin:0 0 18px;color:#b7bdc7">${toAsciiHtml('Alguien utilizó el agente IA Ayrton.')}</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#20f4d0">CONSULTA</p>
      <p style="margin:0 0 20px;line-height:1.55">${toAsciiHtml(clean(question, 2000))}</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#20f4d0">RESPUESTA</p>
      <p style="margin:0 0 22px;line-height:1.55">${toAsciiHtml(clean(answer, 8000))}</p>
      <div style="border-top:1px solid #343a43;padding-top:14px;font-size:12px;line-height:1.7;color:#8d939c">
        ${toAsciiHtml(`Sesión: ${clean(sessionId, 100) || 'Sin identificar'}`)}<br>
        ${toAsciiHtml(`Tiempo de respuesta: ${Math.max(0, Math.round(Number(durationMs) || 0))} ms`)}<br>
        ${toAsciiHtml(`Fecha: ${formatArgentinaDateTime(new Date())}`)}
      </div>
    </div>
  </div>
</body></html>`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.AYRTON_NOTIFY_EMAIL || process.env.LIVE_MONITOR_EMAIL || 'fede.cabello@hotmail.com',
    subject: '[CADPO] Nueva consulta para Ayrton',
    text: body,
    html,
    textEncoding: 'base64',
  });

  return { sent: true };
};

const notifyInteractionError = async ({ sessionId, question, error, ip, durationMs }) => {
  if (!errorNotificationsEnabled()) return { sent: false, reason: 'not_configured' };

  const errorMessage = clean(error?.message || error, 4000) || 'Error desconocido';
  const safeQuestion = clean(question, 2000) || 'Sin consulta disponible';
  const safeSession = clean(sessionId, 100) || 'Sin identificar';
  const safeIp = clean(ip, 160) || 'No disponible';
  const elapsed = Math.max(0, Math.round(Number(durationMs) || 0));
  const date = formatArgentinaDateTime(new Date());
  const body = [
    'Ayrton no pudo responder una consulta.',
    '',
    `Consulta: ${safeQuestion}`,
    '',
    `Error: ${errorMessage}`,
    '',
    `Sesión: ${safeSession}`,
    `IP: ${safeIp}`,
    `Tiempo transcurrido: ${elapsed} ms`,
    `Fecha: ${date}`,
  ].join('\n');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#15171d;color:#f5f7fa;font-family:Arial,sans-serif">
  <div style="max-width:680px;margin:0 auto;padding:24px">
    <div style="border-top:3px solid #ff4d5e;background:#20232a;padding:20px">
      <div style="font-size:11px;letter-spacing:3px;color:#8d939c">CADPO TEAM RADIO</div>
      <div style="margin-top:4px;font-size:26px;font-weight:800;font-style:italic;color:#ff4d5e">ERROR DE AYRTON</div>
    </div>
    <div style="padding:22px;background:#191c22;border-left:2px solid #ff4d5e">
      <p style="margin:0 0 18px;color:#b7bdc7">${toAsciiHtml('Ayrton no pudo responder una consulta.')}</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#20f4d0">CONSULTA</p>
      <p style="margin:0 0 20px;line-height:1.55">${toAsciiHtml(safeQuestion)}</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#ff4d5e">ERROR</p>
      <p style="margin:0 0 22px;line-height:1.55">${toAsciiHtml(errorMessage)}</p>
      <div style="border-top:1px solid #343a43;padding-top:14px;font-size:12px;line-height:1.7;color:#8d939c">
        ${toAsciiHtml(`Sesión: ${safeSession}`)}<br>
        ${toAsciiHtml(`IP: ${safeIp}`)}<br>
        ${toAsciiHtml(`Tiempo transcurrido: ${elapsed} ms`)}<br>
        ${toAsciiHtml(`Fecha: ${date}`)}
      </div>
    </div>
  </div>
</body></html>`;

  await createSmtpTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.AYRTON_NOTIFY_EMAIL || process.env.LIVE_MONITOR_EMAIL || 'fede.cabello@hotmail.com',
    subject: '[CADPO] Ayrton no pudo responder una consulta',
    text: body,
    html,
    textEncoding: 'base64',
  });

  return { sent: true };
};

module.exports = {
  errorNotificationsEnabled,
  getDailyUsageStatus,
  getUsageSummary,
  isD1Configured,
  notificationsEnabled,
  notifyInteraction,
  notifyInteractionError,
  markDailyUsageLimitReached,
  queryD1,
  saveInteraction,
  saveUsage,
};
