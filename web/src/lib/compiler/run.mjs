import { runPipeline } from '../../../../local-server/lib/pipeline.mjs';
import { BedrockGateway } from '../../../../local-server/lib/bedrock.mjs';
import { FontGateway } from '../../../../local-server/lib/font-gateway.mjs';
import { resolveModelRoutes } from '../../../../local-server/lib/contracts.mjs';

// Server-only entry point. Never load credentials from client-provided payloads.
export function runConfiguredPipeline(payload, env = process.env) {
  const credentials = { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, sessionToken: env.AWS_SESSION_TOKEN };
  const configured = env.AWS_BEARER_TOKEN_BEDROCK || (credentials.accessKeyId && credentials.secretAccessKey);
  const bedrock = configured ? new BedrockGateway({
    region: env.AWS_REGION || 'us-east-1', credentials, bearerToken: env.AWS_BEARER_TOKEN_BEDROCK,
    routes: resolveModelRoutes(env),
  }) : null;
  const font = new FontGateway({ endpoint: env.FONT_PROVIDER_URL, apiKey: env.FONT_PROVIDER_API_KEY });
  return runPipeline(payload, { bedrock, font });
}
