import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { BedrockGateway } from '../local-server/lib/bedrock.mjs';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[name]) process.env[name] = value;
  }
}
loadEnv(path.resolve(process.cwd(), '.viscue-local.env'));

const gateway = new BedrockGateway({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK || '',
  routes: {
    imagePrimary: process.env.QWEN_MODEL_ID || 'qwen.qwen3-vl-235b-a22b',
    imageFallback: process.env.NOVA_PRO_MODEL_ID || 'amazon.nova-pro-v1:0',
    videoPrimary: process.env.NOVA_PRO_MODEL_ID || 'amazon.nova-pro-v1:0',
    videoFallback: process.env.NOVA_LITE_MODEL_ID || 'amazon.nova-lite-v1:0',
    relevance: process.env.TITAN_EMBED_MODEL_ID || 'amazon.titan-embed-image-v1',
    compiler: process.env.BEDROCK_MODEL_ID || 'mistral.mistral-large-3-675b-instruct',
  },
  // Custom request wrapper to log actual response or error details for diagnosis
  request: async (params) => {
    console.log(`[Bedrock Request] Model: ${params.modelId}, API: ${params.api}, Region: ${params.region}`);
    const host = `bedrock-runtime.${params.region}.amazonaws.com`;
    const pathUrl = params.api === 'invoke' ? `/model/${encodeURIComponent(params.modelId)}/invoke` : `/model/${encodeURIComponent(params.modelId)}/converse`;
    const payload = JSON.stringify(params.body || {});
    
    // Test direct request using default signedJsonRequest logic
    const { signedJsonRequest } = await import('../local-server/lib/http-client.mjs');
    try {
      const res = await signedJsonRequest(params);
      console.log(`[Bedrock Success] Model ${params.modelId} responded status ${res.status}`);
      return res;
    } catch (err) {
      console.error(`[Bedrock Error] Model ${params.modelId} failed:`, err.message);
      throw err;
    }
  }
});

// Create 1x1 test white pixel png for visual model testing
const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

async function main() {
  console.log('--- Testing Bedrock AI Connectivity ---');
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
  console.log('Auth:', process.env.AWS_BEARER_TOKEN_BEDROCK ? 'Bearer Token' : 'Access Key ID');
  console.log('Credentials configured:', Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_ACCESS_KEY_ID));

  console.log('\n1. Testing Compiler (Mistral Large 3 / Bedrock):');
  try {
    const promptRes = await gateway.compilePrompt({
      prompt: 'Make the primary button color #3b82f6 with rounded corners and bold font.',
      references: [],
      preserve: [],
      evidence: []
    });
    console.log('Compiler response:', promptRes);
  } catch (e) {
    console.error('Compiler failed:', e);
  }

  console.log('\n2a. Testing Multimodal Image Perception - Qwen 3 VL (Primary):');
  try {
    const qwenGateway = new BedrockGateway({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK || '',
      routes: {
        imagePrimary: process.env.QWEN_MODEL_ID || 'qwen.qwen3-vl-235b-a22b',
        imageFallback: process.env.NOVA_PRO_MODEL_ID || 'amazon.nova-pro-v1:0',
      }
    });
    const qwenRes = await qwenGateway.analyzeImage({
      assetId: 'test_asset_qwen',
      dataUrl: tinyPngBase64,
      prompt: 'Identify the objects and layout.'
    });
    console.log('Qwen 3 VL Perception response:', qwenRes);
  } catch (e) {
    console.error('Qwen 3 VL failed:', e);
  }

  console.log('\n2b. Testing Multimodal Image Perception - Amazon Nova Pro:');
  try {
    const novaProGateway = new BedrockGateway({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK || '',
      routes: {
        imagePrimary: process.env.NOVA_PRO_MODEL_ID || 'amazon.nova-pro-v1:0',
        imageFallback: process.env.NOVA_LITE_MODEL_ID || 'amazon.nova-lite-v1:0',
      }
    });
    const novaProRes = await novaProGateway.analyzeImage({
      assetId: 'test_asset_nova_pro',
      dataUrl: tinyPngBase64,
      prompt: 'Identify the objects and layout.'
    });
    console.log('Amazon Nova Pro Perception response:', novaProRes);
  } catch (e) {
    console.error('Amazon Nova Pro failed:', e);
  }

  console.log('\n2c. Verifying meaningless Nova Lite image output is rejected:');
  try {
    const novaLiteGateway = new BedrockGateway({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK || '',
      routes: {
        imagePrimary: process.env.NOVA_LITE_MODEL_ID || 'amazon.nova-lite-v1:0',
        imageFallback: process.env.NOVA_LITE_MODEL_ID || 'amazon.nova-lite-v1:0',
      }
    });
    const novaLiteRes = await novaLiteGateway.analyzeImage({
      assetId: 'test_asset_nova_lite',
      dataUrl: tinyPngBase64,
      prompt: 'Identify the objects and layout.'
    });
    console.error('Unexpected Nova Lite image acceptance:', novaLiteRes);
    process.exitCode = 1;
  } catch (e) {
    console.log('Amazon Nova Lite placeholder rejection: OK');
  }

  console.log('\n3. Testing Relevance Embeddings (Titan Multimodal):');
  try {
    const embedRes = await gateway.embedReference({
      text: 'design system button typography and spacing'
    });
    console.log('Titan Embedding response status:', embedRes.status, 'embedding length:', embedRes.embedding?.length);
  } catch (e) {
    console.error('Titan Embedding failed:', e);
  }

  console.log('\n4. Testing /compile HTTP endpoint directly on running backend:');
  try {
    const localAuthorization = process.env.VISCUE_API_KEY
      ? { authorization: `Bearer ${process.env.VISCUE_API_KEY}` }
      : {};
    const compileRes = await fetch('http://127.0.0.1:8787/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...localAuthorization },
      body: JSON.stringify({
        graph: {
          destination: 'ChatGPT',
          items: [{ id: 'item_1', name: 'button_sample.png', kind: 'image' }],
          cues: [],
          relations: [],
          motions: []
        },
        media: {
          item_1: { kind: 'image', dataUrl: tinyPngBase64 }
        },
        profile: { plan: 'free' },
        session: { chatId: 'ChatGPT:test1', destinationFingerprint: 'ChatGPT:/c/test1' }
      })
    });
    const compileJson = await compileRes.json();
    console.log('Backend /compile HTTP status:', compileRes.status);
    console.log('Backend /compile response stages:', compileJson.stages);
    console.log('Final prompt snippet:', compileJson.final_prompt?.slice(0, 150) + '...');
  } catch (e) {
    console.error('Backend HTTP test failed:', e);
  }
}

main();
