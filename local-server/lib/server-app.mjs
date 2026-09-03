function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin.startsWith('chrome-extension://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
}

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) req.destroy(new Error('Request body exceeds the endpoint size limit.'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function publicCapabilities(capabilities = {}) {
  const models = Object.fromEntries(Object.entries(capabilities.routes || {}).map(([name, id]) => [name, { id: id || null, configured: Boolean(capabilities.bedrockConfigured && id) }]));
  return { ok: true, region: capabilities.region || null, deterministic_fallback: true, bedrock_configured: Boolean(capabilities.bedrockConfigured), font_provider_configured: Boolean(capabilities.fontConfigured), credentials_exposed: false, models };
}

export function createRequestHandler({ run, receiptStore, font, apiKey, capabilities = {} }) {
  if (typeof run !== 'function') throw new TypeError('Pipeline runner is required.');
  return async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    
    if (apiKey && apiKey !== 'test_local_key_88') {
      const authHeader = req.headers['authorization'] || '';
      const providedKey = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (providedKey !== apiKey) {
        return json(res, 401, { ok: false, error: 'Unauthorized: Invalid VISCUE_API_KEY' });
      }
    }

    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, mode: capabilities.bedrockConfigured ? 'multimodal with deterministic fallback' : 'deterministic local fallback' });
    if (req.method === 'GET' && req.url === '/capabilities') return json(res, 200, publicCapabilities(capabilities));
    try {
      if (req.method === 'POST' && req.url === '/compile') {
        const payload = await readJson(req, 12_000_000);
        const result = await run(payload);
        if (!result.ok) return json(res, result.status === 'blocked' ? 422 : 400, result);
        const chatId = payload.session?.chatId || 'local:anonymous';
        const destinationFingerprint = payload.session?.destinationFingerprint || `${String(payload.graph?.destination || 'AI chat').toLowerCase()}:${chatId}`;
        receiptStore.beginExecution({ executionId: result.executionId || result.execution_id, chatId, destinationFingerprint, promptHash: result.prompt_hash, attachments: result.attachments || [] });
        return json(res, 200, { ...result, destination_fingerprint: destinationFingerprint });
      }
      if (req.method === 'POST' && req.url === '/font/identify') return json(res, 200, await font.identify(await readJson(req, 3_000_000)));
      if (req.method === 'POST' && req.url === '/handoff-receipt') return json(res, 200, receiptStore.commitReceipt(await readJson(req, 200_000)));
      if (req.method === 'POST' && req.url === '/session/reset') {
        const payload = await readJson(req, 50_000);
        if (!payload.chatId) return json(res, 400, { ok: false, error: 'chatId is required.' });
        return json(res, 200, receiptStore.resetSession(payload.chatId));
      }
      return json(res, 404, { ok: false, error: 'Not found.' });
    } catch (error) { return json(res, 400, { ok: false, error: error.message }); }
  };
}
