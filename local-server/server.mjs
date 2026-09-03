#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { MODEL_ROUTES } from './lib/contracts.mjs';
import { BedrockGateway } from './lib/bedrock.mjs';
import { FontGateway } from './lib/font-gateway.mjs';
import { runPipeline } from './lib/pipeline.mjs';
import { ReceiptStore } from './lib/receipts.mjs';
import { createRequestHandler } from './lib/server-app.mjs';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const name = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[name]) process.env[name] = value;
  }
}

loadEnv(path.resolve(process.cwd(), '.viscue-local.env'));
const port = Number(process.env.VISCUE_PORT || 8787);
const region = process.env.AWS_REGION || 'us-east-1';
const routes = {
  ...MODEL_ROUTES,
  imagePrimary: process.env.QWEN_MODEL_ID || MODEL_ROUTES.imagePrimary,
  imageFallback: process.env.NOVA_PRO_MODEL_ID || MODEL_ROUTES.imageFallback,
  videoPrimary: process.env.NOVA_PRO_MODEL_ID || MODEL_ROUTES.videoPrimary,
  videoFallback: process.env.NOVA_LITE_MODEL_ID || MODEL_ROUTES.videoFallback,
  relevance: process.env.TITAN_EMBED_MODEL_ID || MODEL_ROUTES.relevance,
  compiler: process.env.BEDROCK_MODEL_ID || '',
};
const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK || '';
const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID || '', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '', sessionToken: process.env.AWS_SESSION_TOKEN || '' };
const bedrockConfigured = Boolean(bearerToken || (credentials.accessKeyId && credentials.secretAccessKey));
const fontConfigured = Boolean(process.env.FONT_PROVIDER_URL && process.env.FONT_PROVIDER_API_KEY);
const apiKey = process.env.VISCUE_API_KEY || '';
const bedrock = bedrockConfigured ? new BedrockGateway({ region, routes, credentials, bearerToken }) : null;
const font = new FontGateway({ endpoint: process.env.FONT_PROVIDER_URL, apiKey: process.env.FONT_PROVIDER_API_KEY, threshold: Number(process.env.FONT_MATCH_THRESHOLD || 0.9) });
const receiptStore = new ReceiptStore();
const handler = createRequestHandler({
  receiptStore,
  font,
  apiKey,
  capabilities: { region, routes, bedrockConfigured, fontConfigured },
  run: payload => runPipeline(payload, { bedrock, font }),
});

http.createServer(handler).listen(port, '127.0.0.1', () => {
  console.log(`Viscue VICSUC compiler listening at http://127.0.0.1:${port} (${bedrockConfigured ? 'Bedrock configured' : 'deterministic fallback'})`);
});
