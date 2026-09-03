import crypto from 'node:crypto';
import https from 'node:https';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();

function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), 'aws4_request');
}

function scrubError(statusCode) {
  return new Error(`Bedrock request failed with HTTP ${statusCode}.`);
}

export function signedJsonRequest({ region, credentials = {}, bearerToken, modelId, api = 'converse', body, timeoutMs = 20_000, maxBytes = 2_000_000 }) {
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const path = api === 'invoke' ? `/model/${encodeURIComponent(modelId)}/invoke` : `/model/${encodeURIComponent(modelId)}/converse`;
  const payload = JSON.stringify(body || {});
  const headers = { 'content-type': 'application/json', host };

  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
  } else {
    const accessKeyId = credentials.accessKeyId;
    const secretAccessKey = credentials.secretAccessKey;
    if (!accessKeyId || !secretAccessKey) return Promise.reject(new Error('Bedrock credentials are not configured.'));
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    headers['x-amz-date'] = amzDate;
    headers['x-amz-content-sha256'] = sha256(payload);
    if (credentials.sessionToken) headers['x-amz-security-token'] = credentials.sessionToken;
    const signedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaders.map(key => `${key}:${headers[key]}\n`).join('');
    const canonical = ['POST', path, '', canonicalHeaders, signedHeaders.join(';'), headers['x-amz-content-sha256']].join('\n');
    const scope = `${date}/${region}/bedrock/aws4_request`;
    const toSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonical)}`;
    const signature = crypto.createHmac('sha256', signingKey(secretAccessKey, date, region, 'bedrock')).update(toSign).digest('hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
  }

  return new Promise((resolve, reject) => {
    const request = https.request({ hostname: host, path, method: 'POST', headers, timeout: timeoutMs }, response => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        data += chunk;
        if (Buffer.byteLength(data) > maxBytes) request.destroy(new Error('Bedrock response exceeded the size limit.'));
      });
      response.on('end', () => {
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) return reject(scrubError(response.statusCode));
        resolve({ status: response.statusCode, body: data });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Bedrock request timed out.')));
    request.on('error', reject);
    request.end(payload);
  });
}
