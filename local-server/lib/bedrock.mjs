import { MODEL_ROUTES } from './contracts.mjs';
import { normalizeEvidence } from './evidence.mjs';
import { verifyProtectedFacts } from './brief.mjs';
import { signedJsonRequest } from './http-client.mjs';

function dataPart(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new TypeError('Visual media must be a base64 data URL.');
  return { mime: match[1], format: match[1].split('/')[1]?.replace('jpg', 'jpeg') || 'jpeg', bytes: match[2] };
}

function responseText(response) {
  const parsed = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
  return parsed?.output?.message?.content?.map(part => part.text || '').join('').trim() || '';
}

function parseEvidence(response, context) {
  const text = responseText(response).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const value = JSON.parse(text);
  if (!Array.isArray(value.claims)) throw new TypeError('Evidence response requires a claims array.');
  return value.claims.map(claim => normalizeEvidence(claim, context));
}

function providerName(modelId) {
  if (String(modelId).includes('qwen')) return 'qwen';
  if (String(modelId).includes('nova-lite')) return 'nova-lite';
  if (String(modelId).includes('nova')) return 'nova-pro';
  if (String(modelId).includes('titan')) return 'titan';
  return 'bedrock';
}

export class BedrockGateway {
  constructor({ region = 'us-east-1', credentials = {}, bearerToken, routes = MODEL_ROUTES, request = signedJsonRequest } = {}) {
    this.region = region;
    this.credentials = credentials;
    this.bearerToken = bearerToken;
    this.routes = { ...MODEL_ROUTES, ...routes };
    this.request = request;
  }

  async #call(modelId, body, api = 'converse') {
    return this.request({ region: this.region, credentials: this.credentials, bearerToken: this.bearerToken, modelId, api, body });
  }

  async #visual(modelId, input, kind) {
    const media = dataPart(input.dataUrl);
    const mediaContent = kind === 'video'
      ? { video: { format: media.format, source: { bytes: media.bytes } } }
      : { image: { format: media.format, source: { bytes: media.bytes } } };
    const body = {
      messages: [{ role: 'user', content: [mediaContent, { text: `${input.prompt || 'Return only visible facts.'}\nReturn strict JSON: {"claims":[{"type":"object|layout|ocr|relation","value":"...","bbox":[0,0,1,1] or null,"confidence":0.0}]}. Semantic relations are hypotheses, not facts.` }] }],
      inferenceConfig: { maxTokens: 700, temperature: 0 },
    };
    const response = await this.#call(modelId, body);
    return parseEvidence(response, { provider: providerName(modelId), model: modelId, assetId: input.assetId });
  }

  async analyzeImage(input) {
    const attempts = [this.routes.imagePrimary, this.routes.imagePrimary, this.routes.imageFallback];
    let lastError;
    for (const [index, modelId] of attempts.entries()) {
      try {
        const evidence = await this.#visual(modelId, input, 'image');
        return { status: index === 0 ? 'ok' : 'degraded', provider: providerName(modelId), model: modelId, evidence };
      } catch (error) { lastError = error; }
    }
    throw new Error(`Image perception unavailable: ${lastError?.message || 'unknown failure'}`);
  }

  async analyzeVideo(input) {
    let lastError;
    for (const [index, modelId] of [this.routes.videoPrimary, this.routes.videoFallback].entries()) {
      try {
        const evidence = await this.#visual(modelId, input, 'video');
        return { status: index === 0 ? 'ok' : 'degraded', provider: providerName(modelId), model: modelId, evidence };
      } catch (error) { lastError = error; }
    }
    throw new Error(`Video perception unavailable: ${lastError?.message || 'unknown failure'}`);
  }

  async embedReference({ text, dataUrl } = {}) {
    try {
      const body = { inputText: String(text || '').slice(0, 2048) };
      if (dataUrl) body.inputImage = dataPart(dataUrl).bytes;
      const response = await this.#call(this.routes.relevance, body, 'invoke');
      const parsed = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      const embedding = parsed.embedding || parsed.embeddings?.[0]?.embedding;
      if (!Array.isArray(embedding)) throw new TypeError('Missing embedding.');
      return { status: 'ok', provider: 'titan', model: this.routes.relevance, embedding };
    } catch {
      throw new Error('Titan relevance unavailable.');
    }
  }

  async compilePrompt(canonical) {
    if (!this.routes.compiler) return { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: { reason: 'Compiler model is not configured.' } };
    try {
      const body = {
        system: [{ text: 'Rewrite the supplied deterministic visual instruction for clarity. Do not remove, rename, infer, score, or add references. Return only the instruction.' }],
        messages: [{ role: 'user', content: [{ text: canonical.prompt }] }],
        inferenceConfig: { maxTokens: 1400, temperature: 0 },
      };
      const candidate = responseText(await this.#call(this.routes.compiler, body));
      const verification = verifyProtectedFacts(candidate, canonical);
      if (!candidate || !verification.ok) return { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: verification };
      return { status: 'ok', provider: 'bedrock-mistral', text: candidate };
    } catch {
      return { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: { reason: 'Compiler unavailable.' } };
    }
  }

  async verifyPrompt(candidate, canonical) {
    return verifyProtectedFacts(candidate, canonical);
  }
}
