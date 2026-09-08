import { runPipeline } from '../../../../local-server/lib/pipeline.mjs';
import { BedrockGateway } from '../../../../local-server/lib/bedrock.mjs';
import { FontGateway } from '../../../../local-server/lib/font-gateway.mjs';
import { MODEL_ROUTES } from '../../../../local-server/lib/contracts.mjs';

// Server-only entry point. Never load credentials from client-provided payloads.
export function runConfiguredPipeline(payload, env = process.env) {
  const credentials = { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, sessionToken: env.AWS_SESSION_TOKEN };
  const configured = env.AWS_BEARER_TOKEN_BEDROCK || (credentials.accessKeyId && credentials.secretAccessKey);
  const bedrock = configured ? new BedrockGateway({
    region: env.AWS_REGION || 'us-east-1', credentials, bearerToken: env.AWS_BEARER_TOKEN_BEDROCK,
    routes: {
      ...MODEL_ROUTES,
      imagePrimary: env.QWEN_MODEL_ID || env.QWEN_VISION_MODEL_ID || MODEL_ROUTES.imagePrimary,
      imageFallback: env.NOVA_PRO_MODEL_ID || MODEL_ROUTES.imageFallback,
      videoPrimary: env.NOVA_PRO_MODEL_ID || MODEL_ROUTES.videoPrimary,
      videoFallback: env.NOVA_LITE_MODEL_ID || MODEL_ROUTES.videoFallback,
      relevance: env.TITAN_EMBED_MODEL_ID || MODEL_ROUTES.relevance,
      compiler: env.BEDROCK_MODEL_ID || env.COMPILER_MODEL || MODEL_ROUTES.compiler,
    },
  }) : null;
  const font = new FontGateway({ endpoint: env.FONT_PROVIDER_URL, apiKey: env.FONT_PROVIDER_API_KEY });
  return runPipeline(payload, { bedrock, font });
}
