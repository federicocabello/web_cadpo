const crypto = require('crypto');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.DB_PASSWORD;
const sign = value => crypto.createHmac('sha256', secret()).update(value).digest('base64url');

const createSession = () => {
  if (!secret()) throw new Error('Falta configurar ADMIN_SESSION_SECRET');
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const nonce = crypto.randomBytes(16).toString('base64url');
  const payload = `${expiresAt}.${nonce}`;
  const token = `${payload}.${sign(payload)}`;
  return { token, expiresIn: SESSION_TTL_MS };
};

const isValidSession = token => {
  if (!token || !secret()) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || Number(parts[0]) <= Date.now()) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(parts[2]);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

module.exports = { createSession, isValidSession };
