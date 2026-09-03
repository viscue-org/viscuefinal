function degradedUnknown(warning = 'Font provider is not configured.') {
  return { status: 'degraded', exact_match: null, candidates: [], warning };
}

function normalizeCandidate(row = {}) {
  return {
    name: String(row.fontName || row.font_name || row.name || 'Unknown'),
    score: Math.max(0, Math.min(1, Number(row.confidence ?? row.score ?? 0))),
    commercial: row.commercial !== false,
    provider_id: row.id || row.fontId || null,
  };
}

export class FontGateway {
  constructor({ endpoint, apiKey, threshold = 0.9, request = fetch } = {}) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.threshold = Math.max(0, Math.min(1, Number(threshold)));
    this.request = request;
  }

  async identify({ imageBase64, recognizedText = '', topK = 5 } = {}) {
    if (!this.endpoint || !this.apiKey) return degradedUnknown();
    try {
      const response = await this.request(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify({ image_base64: imageBase64, recognized_text: recognizedText, top_k: Math.max(1, Math.min(10, Number(topK) || 5)) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return degradedUnknown('Font provider is unavailable.');
      const payload = await response.json();
      const rows = payload.matches || payload.results || payload.candidates || [];
      const candidates = rows.map(normalizeCandidate).filter(item => item.name !== 'Unknown').sort((a, b) => b.score - a.score).slice(0, topK);
      const first = candidates[0];
      return { status: 'ok', exact_match: first?.commercial && first.score >= this.threshold ? first : null, candidates };
    } catch {
      return degradedUnknown('Font provider is unavailable.');
    }
  }
}
