import fs from 'node:fs';
import path from 'node:path';
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

const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
};
const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK || '';
const region = process.env.AWS_REGION || 'us-east-1';

async function testNovaModels() {
  console.log('==============================================');
  console.log('Testing Amazon Nova Models on AWS Bedrock');
  console.log('Region:', region);
  console.log('==============================================\n');

  // 1. Test Amazon Nova Pro (Image & Video perception)
  console.log('1. Testing Amazon Nova Pro (amazon.nova-pro-v1:0)...');
  const novaProGateway = new BedrockGateway({
    region,
    credentials,
    bearerToken,
    routes: {
      imagePrimary: 'amazon.nova-pro-v1:0',
      imageFallback: 'amazon.nova-pro-v1:0',
      videoPrimary: 'amazon.nova-pro-v1:0',
      videoFallback: 'amazon.nova-lite-v1:0',
    }
  });

  try {
    const resPro = await novaProGateway.analyzeImage({
      assetId: 'nova_pro_asset',
      dataUrl: tinyPngBase64,
      prompt: 'Identify visible layout and colors.'
    });
    console.log('✔ Nova Pro SUCCESS:');
    console.log(JSON.stringify(resPro, null, 2));
  } catch (err) {
    console.error('✖ Nova Pro FAILED:', err.message);
  }

  // 2. Test Amazon Nova Lite
  console.log('\n2. Testing Amazon Nova Lite (amazon.nova-lite-v1:0)...');
  const novaLiteGateway = new BedrockGateway({
    region,
    credentials,
    bearerToken,
    routes: {
      imagePrimary: 'amazon.nova-lite-v1:0',
      imageFallback: 'amazon.nova-lite-v1:0',
      videoPrimary: 'amazon.nova-lite-v1:0',
      videoFallback: 'amazon.nova-lite-v1:0',
    }
  });

  try {
    const resLite = await novaLiteGateway.analyzeImage({
      assetId: 'nova_lite_asset',
      dataUrl: tinyPngBase64,
      prompt: 'Identify visible layout and colors.'
    });
    console.log('✔ Nova Lite SUCCESS:');
    console.log(JSON.stringify(resLite, null, 2));
  } catch (err) {
    console.error('✖ Nova Lite FAILED:', err.message);
  }
}

testNovaModels();
