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
  const evidence = value.claims
    .map(claim => normalizeEvidence(claim, context))
    .filter(claim => {
      const observation = String(claim.value || '').trim();
      return observation.length > 2
        && !/^(?:\.{3}|unknown|none|null|n\/a)$/i.test(observation)
        && Number(claim.confidence) > 0;
    });
  if (evidence.length === 0) throw new TypeError('Evidence response contained no meaningful claims.');
  return evidence;
}

function providerName(modelId) {
  if (String(modelId).includes('qwen')) return 'qwen';
  if (String(modelId).includes('nova-lite')) return 'nova-lite';
  if (String(modelId).includes('nova')) return 'nova-pro';
  if (String(modelId).includes('titan')) return 'titan';
  return 'bedrock';
}

export class BedrockGateway {
  constructor({
    region = 'us-east-1',
    credentials = {},
    bearerToken,
    routes = MODEL_ROUTES,
    request = signedJsonRequest,
    visualTimeoutMs = 2200,
    compilerTimeoutMs = 4500,
    relevanceTimeoutMs = 1200,
  } = {}) {
    this.region = region;
    this.credentials = credentials;
    this.bearerToken = bearerToken;
    this.routes = { ...MODEL_ROUTES, ...routes };
    this.request = request;
    this.visualTimeoutMs = visualTimeoutMs;
    this.compilerTimeoutMs = compilerTimeoutMs;
    this.relevanceTimeoutMs = relevanceTimeoutMs;
  }

  async #call(modelId, body, api = 'converse', timeoutMs) {
    return this.request({ region: this.region, credentials: this.credentials, bearerToken: this.bearerToken, modelId, api, body, timeoutMs });
  }

  async #visual(modelId, input, kind, timeoutMs) {
    const media = dataPart(input.dataUrl);
    const mediaContent = kind === 'video'
      ? { video: { format: media.format, source: { bytes: media.bytes } } }
      : { image: { format: media.format, source: { bytes: media.bytes } } };
    const body = {
      messages: [{ role: 'user', content: [mediaContent, { text: `${input.prompt || 'Return only visible facts.'}\nReturn strict JSON only, with no markdown. Choose exactly one type for each claim from: object, layout, ocr, relation. Use specific observed values, never schema alternatives or placeholders. Example shape: {"claims":[{"type":"object","value":"specific visible fact","bbox":[0.0,0.0,1.0,1.0],"confidence":0.9}]}. Use null when no bounding box applies. Semantic relations are hypotheses, not facts.` }] }],
      inferenceConfig: { maxTokens: 700, temperature: 0 },
    };
    const response = await this.#call(modelId, body, 'converse', timeoutMs);
    return parseEvidence(response, { provider: providerName(modelId), model: modelId, assetId: input.assetId });
  }

  async #analyzeVisual(input, kind, configuredModels) {
    const startTime = performance.now();
    const attempts = [...new Set(configuredModels.filter(Boolean))];
    let lastError;
    let lastModel = null;
    let attempted = 0;
    for (const [index, modelId] of attempts.entries()) {
      const remainingMs = Math.floor(this.visualTimeoutMs - (performance.now() - startTime));
      if (remainingMs <= 0) break;
      attempted += 1;
      lastModel = modelId;
      try {
        const evidence = await this.#visual(modelId, input, kind, remainingMs);
        const duration_ms = Math.round(performance.now() - startTime);
        const fallback = index > 0;
        const fallback_from = fallback ? attempts[0] : null;
        return {
          status: index === 0 ? 'ok' : 'degraded',
          provider: providerName(modelId),
          model: modelId,
          duration_ms,
          evidence,
          fallback,
          fallback_from,
          attempt: index + 1,
        };
      } catch (error) { lastError = error; }
    }
    const label = kind === 'video' ? 'Video' : 'Image';
    const failure = new Error(`${label} perception unavailable: ${lastError?.message || 'provider deadline exceeded'}`);
    Object.assign(failure, {
      duration_ms: Math.round(performance.now() - startTime),
      provider: lastModel ? providerName(lastModel) : null,
      model: lastModel,
      attempt: attempted,
      fallback: attempted > 1,
      fallback_from: attempted > 1 ? attempts[0] : null,
    });
    throw failure;
  }

  async analyzeImage(input) {
    return this.#analyzeVisual(input, 'image', [this.routes.imagePrimary, this.routes.imageFallback]);
  }

  async analyzeVideo(input) {
    return this.#analyzeVisual(input, 'video', [this.routes.videoPrimary, this.routes.videoFallback]);
  }

  async embedReference({ text, dataUrl } = {}) {
    const startTime = performance.now();
    try {
      const body = { inputText: String(text || '').slice(0, 2048) };
      if (dataUrl) body.inputImage = dataPart(dataUrl).bytes;
      const response = await this.#call(this.routes.relevance, body, 'invoke', this.relevanceTimeoutMs);
      const parsed = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      const embedding = parsed.embedding || parsed.embeddings?.[0]?.embedding;
      if (!Array.isArray(embedding)) throw new TypeError('Missing embedding.');
      const duration_ms = Math.round(performance.now() - startTime);
      return { status: 'ok', provider: 'titan', model: this.routes.relevance, embedding, duration_ms };
    } catch {
      throw new Error('Titan relevance unavailable.');
    }
  }

  async compilePrompt(canonical) {
    const startTime = performance.now();
    if (!this.routes.compiler) {
      return {
        status: 'degraded',
        provider: 'deterministic',
        text: canonical.prompt,
        duration_ms: 0,
        fallback: true,
        fallback_from: 'unconfigured',
        warning: { reason: 'Compiler model is not configured.' },
      };
    }
    const systemPrompt = [
      'You are a visual intent prompt compiler for AI image and design tools (ChatGPT, Claude, Gemini).',
      'Your job is to transform user workspace directives into clear, direct, and natural AI instructions.',
      '',
      'CRITICAL RULES:',
      '1. CORRECT all spelling mistakes, grammar errors, and typos in user instructions while keeping their exact intended meaning.',
      '2. Do NOT add bureaucratic section headers like "Reference Specification", "Modification Action", or "Target File" forms.',
      '3. Output clear, concise bullet points describing exact visual modifications.',
      '4. Preserve all user actions, references, coordinates/percentages (e.g., [50%, 45%]), and spatial targets exactly.',
      '5. When multiple images are referenced, name each in double quotes and state relationships clearly.',
      '6. Keep all referenced filenames in exact double quotes.',
      '7. Never invent labels, reference hashes, or non-existent entities.',
      '8. Return ONLY the compiled instructions – no preamble, no commentary, no filler.',
      '9. Make the output read as a natural, precise instruction a user would send to an AI tool.',
    ].join('\n');
    const body = {
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: canonical.prompt }] }],
      inferenceConfig: { maxTokens: 1400, temperature: 0 },
    };
    // Attempt compiler twice before falling back to deterministic
    for (let attempt = 1; attempt <= 2; attempt++) {
      const remainingMs = Math.max(1000, this.compilerTimeoutMs - Math.round(performance.now() - startTime));
      try {
        const candidate = responseText(await this.#call(this.routes.compiler, body, 'converse', remainingMs));
        const duration_ms = Math.round(performance.now() - startTime);
        const verification = verifyProtectedFacts(candidate, canonical);
        if (!candidate) {
          if (attempt < 2) continue; // retry
          break;
        }
        if (!verification.ok) {
          // Verified facts failed – still use candidate if it has substance, else fallback
          if (candidate.length > 40) {
            return {
              status: 'degraded',
              provider: 'bedrock-mistral',
              model: this.routes.compiler,
              duration_ms,
              text: candidate,
              fallback: false,
              warning: verification,
            };
          }
          if (attempt < 2) continue;
          break;
        }
        return {
          status: 'ok',
          provider: 'bedrock-mistral',
          model: this.routes.compiler,
          duration_ms,
          text: candidate,
          fallback: false,
        };
      } catch (err) {
        if (attempt < 2) continue; // retry on error
        const duration_ms = Math.round(performance.now() - startTime);
        return {
          status: 'degraded',
          provider: 'deterministic',
          text: canonical.prompt,
          duration_ms,
          fallback: true,
          fallback_from: this.routes.compiler,
          warning: { reason: `Compiler unavailable after ${attempt} attempt(s): ${err?.message || 'unknown error'}` },
        };
      }
    }
    const duration_ms = Math.round(performance.now() - startTime);
    return {
      status: 'degraded',
      provider: 'deterministic',
      text: canonical.prompt,
      duration_ms,
      fallback: true,
      fallback_from: this.routes.compiler,
      warning: { reason: 'Compiler returned empty or unverifiable output.' },
    };
  }

  async verifyPrompt(candidate, canonical) {
    return verifyProtectedFacts(candidate, canonical);
  }
}
