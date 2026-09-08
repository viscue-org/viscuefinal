import { PLAN_POLICY } from './contracts.mjs';

export const PLATFORM_CAPABILITY_SCHEMA_VERSION = 1;
export const PLATFORM_CAPABILITY_REGISTRY_VERSION = '2026-09-07';

const platform = (displayName, providerCeiling, confidence, source, plans) => Object.freeze({
  displayName,
  providerCeiling,
  confidence,
  source,
  plans: Object.freeze(plans.map(([id, label, budget]) => Object.freeze({ id, label, budget }))),
});

export const PLATFORM_CAPABILITIES = Object.freeze({
  chatgpt: platform('ChatGPT', 20, 'estimated', 'https://learn.chatgpt.com/', [
    ['free', 'Free', 2], ['go', 'Go', 5], ['plus', 'Plus', 10], ['pro', 'Pro', 20], ['business', 'Business', 20], ['enterprise', 'Enterprise', 20],
  ]),
  gemini: platform('Gemini', 10, 'verified', 'https://support.google.com/gemini/answer/14903178', [
    ['free', 'Free', 2], ['pro', 'Google AI Pro', 10], ['ultra', 'Google AI Ultra', 10],
  ]),
  claude: platform('Claude', 20, 'verified', 'https://support.anthropic.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude-ai', [
    ['free', 'Free', 2], ['pro', 'Pro', 10], ['max', 'Max', 20], ['team', 'Team', 20], ['enterprise', 'Enterprise', 20],
  ]),
  copilot: platform('Copilot', 20, 'verified', 'https://support.microsoft.com/en-us/microsoft-copilot/file-upload-in-microsoft-copilot', [
    ['free', 'Free', 2], ['pro', 'Copilot Pro', 10], ['microsoft-365', 'Microsoft 365', 20],
  ]),
  perplexity: platform('Perplexity', 4, 'verified', 'https://www.perplexity.ai/help-center/en/articles/12009761-enterprise-file-limits', [
    ['free', 'Free', 2], ['pro', 'Pro', 4], ['max', 'Max', 4], ['enterprise-pro', 'Enterprise Pro', 4], ['enterprise-max', 'Enterprise Max', 4],
  ]),
  grok: platform('Grok', 10, 'estimated', 'https://docs.x.ai/grok/overview', [
    ['free', 'Free', 2], ['supergrok', 'SuperGrok', 4], ['supergrok-heavy', 'SuperGrok Heavy', 10],
  ]),
});

const normalizeId = value => String(value || '').trim().toLowerCase();

export function normalizePlatformCapability(value = {}, detectedPlatform = 'chatgpt') {
  const requestedPlatform = normalizeId(value?.platform || detectedPlatform);
  const platformId = PLATFORM_CAPABILITIES[requestedPlatform] ? requestedPlatform : 'chatgpt';
  const definition = PLATFORM_CAPABILITIES[platformId];
  const requestedPlan = normalizeId(value?.plan);
  const plan = definition.plans.some(item => item.id === requestedPlan) ? requestedPlan : 'free';
  return Object.freeze({
    schemaVersion: PLATFORM_CAPABILITY_SCHEMA_VERSION,
    registryVersion: PLATFORM_CAPABILITY_REGISTRY_VERSION,
    platform: platformId,
    plan,
    confidence: definition.confidence,
  });
}

export function destinationReferenceLimit(value = {}, detectedPlatform = 'chatgpt') {
  const capability = normalizePlatformCapability(value, detectedPlatform);
  const definition = PLATFORM_CAPABILITIES[capability.platform];
  const selectedPlan = definition.plans.find(item => item.id === capability.plan) || definition.plans[0];
  return Object.freeze({
    limit: Math.min(selectedPlan.budget, definition.providerCeiling),
    planBudget: selectedPlan.budget,
    providerCeiling: definition.providerCeiling,
    capability,
  });
}

export function effectiveReferenceLimit({ viscuePlan = 'free', capability = {} } = {}) {
  const normalizedViscuePlan = normalizeId(viscuePlan);
  const viscueLimit = (PLAN_POLICY[normalizedViscuePlan] || PLAN_POLICY.free).physicalReferences;
  const destination = destinationReferenceLimit(capability);
  const limit = Math.min(viscueLimit, destination.limit);
  return Object.freeze({
    limit,
    viscueLimit,
    destinationLimit: destination.limit,
    providerCeiling: destination.providerCeiling,
    constrainedBy: viscueLimit <= destination.limit ? 'viscue' : 'destination',
    capability: destination.capability,
  });
}

export function parsePlatformChatContext(urlStr = '') {
  let parsed;
  try { parsed = new URL(urlStr || 'https://chatgpt.com'); }
  catch { parsed = new URL('https://chatgpt.com'); }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  let platform = 'ChatGPT';
  let platformId = 'chatgpt';
  let chatId = '';

  if (host.includes('gemini.google')) {
    platform = 'Gemini';
    platformId = 'gemini';
    const m = pathname.match(/\/app(?:\/u\/\d+)?\/([a-zA-Z0-9_-]+)/);
    chatId = m ? m[1] : (pathname.startsWith('/app') ? 'new' : pathname);
  } else if (host.includes('claude.ai')) {
    platform = 'Claude';
    platformId = 'claude';
    const m = pathname.match(/\/(?:chat|project)\/([a-zA-Z0-9_-]+)/);
    chatId = m ? m[1] : (pathname === '/new' || pathname === '/' ? 'new' : pathname);
  } else if (host.includes('copilot.microsoft')) {
    platform = 'Copilot';
    platformId = 'copilot';
    const qChat = parsed.searchParams.get('conversationId');
    const m = pathname.match(/\/(?:chats|sl)\/([a-zA-Z0-9_-]+)/);
    chatId = qChat || (m ? m[1] : (pathname === '/' ? 'new' : pathname));
  } else if (host.includes('perplexity')) {
    platform = 'Perplexity';
    platformId = 'perplexity';
    const m = pathname.match(/\/(?:search|q)\/([a-zA-Z0-9_-]+)/);
    chatId = m ? m[1] : (pathname === '/' || pathname === '/search/new' ? 'new' : pathname);
  } else if (host.includes('grok.com') || host.includes('x.com')) {
    platform = 'Grok';
    platformId = 'grok';
    const qChat = parsed.searchParams.get('conversation');
    const m = pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
    chatId = qChat || (m ? m[1] : (pathname === '/' ? 'new' : pathname));
  } else {
    platform = 'ChatGPT';
    platformId = 'chatgpt';
    const m = pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
    chatId = m ? m[1] : (pathname === '/' ? 'new' : pathname);
  }

  chatId = String(chatId || '').replace(/^\/+|\/+$/g, '').trim() || 'new';

  return Object.freeze({
    platform,
    platformId,
    url: parsed.href,
    pathname: parsed.pathname,
    chatId,
    destinationFingerprint: `${platform}:${chatId === 'new' ? parsed.pathname : chatId}`,
    isNewChat: chatId === 'new',
  });
}

