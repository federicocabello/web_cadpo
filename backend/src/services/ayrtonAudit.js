const crypto = require('crypto');
const nodemailer = require('nodemailer');

const D1_TIMEOUT_MS = 8000;
const SMTP_TIMEOUT_MS = 12000;

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

  const transporter = nodemailer.createTransport({
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

module.exports = {
  isD1Configured,
  notificationsEnabled,
  notifyInteraction,
  queryD1,
  saveInteraction,
};
