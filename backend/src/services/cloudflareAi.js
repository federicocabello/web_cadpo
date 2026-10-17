const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const getConfig = () => {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_AI_API_TOKEN || '').trim();
  const gatewayId = String(process.env.CLOUDFLARE_AI_GATEWAY_ID || '').trim();
  const model = String(process.env.CLOUDFLARE_AI_MODEL || DEFAULT_MODEL).trim();

  if (!accountId || !apiToken) {
    const error = new Error('Ayrton todavía no tiene configuradas las credenciales de Cloudflare');
    error.statusCode = 503;
    throw error;
  }

  return { accountId, apiToken, gatewayId, model };
};

const extractAnswer = payload => {
  const response = payload?.result || payload;
  const content = response?.choices?.[0]?.message?.content
    ?? response?.response
    ?? response?.result?.response;

  if (typeof content === 'string' && content.trim()) return content.trim();
  const error = new Error('Cloudflare no devolvió una respuesta de texto');
  error.statusCode = 502;
  throw error;
};

const createChatCompletion = async messages => {
  const { accountId, apiToken, gatewayId, model } = getConfig();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
  if (gatewayId) headers['cf-aig-gateway-id'] = gatewayId;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(Number(process.env.CLOUDFLARE_AI_TIMEOUT_MS || 30000)),
    });
  } catch (cause) {
    const error = new Error(cause?.name === 'TimeoutError'
      ? 'Ayrton tardó demasiado en responder'
      : 'No se pudo conectar con Cloudflare AI');
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const detail = payload?.errors?.[0]?.message || payload?.error?.message || `HTTP ${response.status}`;
    const error = new Error(`Cloudflare AI rechazó la solicitud: ${detail}`);
    error.statusCode = response.status === 401 || response.status === 403 ? 503 : 502;
    throw error;
  }

  return extractAnswer(payload);
};

module.exports = { createChatCompletion };
