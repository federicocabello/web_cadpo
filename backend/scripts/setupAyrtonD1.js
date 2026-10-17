const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const databaseId = String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim();
const apiToken = String(process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_AI_API_TOKEN || '').trim();

if (!accountId || !databaseId || !apiToken) {
  console.error('Faltan CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID o el token de D1.');
  process.exit(1);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;

const query = async (sql, params = []) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const detail = payload?.errors?.[0]?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
};

const run = async () => {
  const schema = fs.readFileSync(path.resolve(__dirname, 'createAyrtonD1.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);

  for (const statement of statements) await query(statement);

  const verification = await query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?) ORDER BY name",
    ['ayrton_knowledge', 'ayrton_messages'],
  );
  const rows = verification?.result?.[0]?.results || [];
  if (rows.length !== 2) throw new Error('Las tablas de mensajes y memoria no aparecieron después de ejecutar el esquema.');

  console.log('D1 configurada correctamente: mensajes y memoria aprobada están disponibles.');
};

run().catch(error => {
  console.error(`No se pudo configurar D1: ${error.message}`);
  process.exitCode = 1;
});
