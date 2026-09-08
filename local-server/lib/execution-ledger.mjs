/**
 * Execution Ledger normalizer and formatter for VIS CUE.
 * Enforces the redacted, transparent stage contract and evaluates overall trust status.
 */

export const ALLOWED_STATUSES = Object.freeze(['ok', 'degraded', 'skipped', 'blocked']);

const REDACT_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /(?:api[_-]?key|secret|password|credential|auth[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9._~+/-]+['"]?/gi,
  /data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi,
];

export function redactSensitiveText(text) {
  if (typeof text !== 'string') return text;
  let clean = text;
  for (const pattern of REDACT_PATTERNS) {
    clean = clean.replace(pattern, '[REDACTED]');
  }
  // Remove stack traces
  clean = clean.split(/\n\s*at\s+/)[0].trim();
  return clean;
}

export function inferRole(name = '', explicitRole = null) {
  if (explicitRole) return explicitRole;
  const lower = String(name).toLowerCase();
  if (lower.startsWith('perception')) return 'visual perception';
  if (lower.startsWith('relevance')) return 'relevance';
  if (lower.startsWith('font')) return 'font identification';
  if (lower.startsWith('compiler') || lower.startsWith('prompt')) return 'instruction compilation';
  if (lower.startsWith('verification') || lower.startsWith('safety')) return 'safety verification';
  if (lower.startsWith('plan')) return 'plan selection';
  return 'general';
}

export function normalizeStageEntry(stage = {}) {
  const name = String(stage.name || 'unnamed.stage');
  const role = inferRole(name, stage.role);
  let status = String(stage.status || 'ok').toLowerCase();
  if (!ALLOWED_STATUSES.includes(status)) status = 'degraded';

  const provider = stage.provider ? String(stage.provider).toLowerCase() : null;
  const model = stage.model ? String(stage.model) : null;
  const duration_ms = typeof stage.duration_ms === 'number' ? Math.max(0, Math.round(stage.duration_ms)) : null;
  const evidence_count = typeof stage.evidence_count === 'number' ? Math.max(0, Math.round(stage.evidence_count)) : null;
  const fallback = Boolean(stage.fallback === true);
  const fallback_from = stage.fallback_from ? String(stage.fallback_from) : null;
  const attempt = typeof stage.attempt === 'number' && stage.attempt > 0 ? Math.round(stage.attempt) : 1;

  let message = stage.message || stage.warning || stage.summary || null;
  if (typeof message === 'object' && message !== null) {
    message = message.reason || message.error || JSON.stringify(message);
  }
  if (message) {
    message = redactSensitiveText(String(message));
  } else if (status === 'ok') {
    if (evidence_count !== null) message = `${evidence_count} grounded observation${evidence_count === 1 ? '' : 's'}`;
    else message = 'Stage completed successfully';
  } else if (status === 'degraded') {
    message = fallback ? `Degraded: fell back from ${fallback_from || 'primary model'}` : 'Stage completed with degraded precision';
  } else if (status === 'skipped') {
    message = 'Stage skipped';
  } else if (status === 'blocked') {
    message = 'Action required: stage execution blocked';
  }

  return {
    name,
    role,
    status,
    provider,
    model,
    duration_ms,
    evidence_count,
    fallback,
    fallback_from,
    message,
    attempt,
  };
}

export function deriveTrustBanner(ledger = []) {
  if (!Array.isArray(ledger) || ledger.length === 0) {
    return {
      banner: 'Deterministic only',
      level: 'deterministic',
      message: 'Workspace executed without model stages.',
    };
  }

  const blocked = ledger.find(s => s.status === 'blocked');
  if (blocked) {
    return {
      banner: 'Action required',
      level: 'blocked',
      message: blocked.message || 'Action required to proceed with handoff.',
    };
  }

  const aiStages = ledger.filter(s => {
    const prov = (s.provider || '').toLowerCase();
    return prov && !['deterministic', 'cached', 'none'].includes(prov);
  });

  const hasFallback = ledger.some(s => s.fallback === true || (s.status === 'degraded' && s.fallback_from));
  if (hasFallback) {
    return {
      banner: 'Completed with fallback',
      level: 'fallback',
      message: 'Completed using one or more configured fallback routes.',
    };
  }

  if (aiStages.length > 0 && aiStages.every(s => s.status === 'ok')) {
    return {
      banner: 'All AI stages completed',
      level: 'ok',
      message: 'All configured AI perception and compilation models succeeded.',
    };
  }

  const anyDegraded = ledger.some(s => s.status === 'degraded');
  if (anyDegraded) {
    return {
      banner: 'Completed with fallback',
      level: 'fallback',
      message: 'One or more stages finished with degraded precision.',
    };
  }

  return {
    banner: 'Deterministic only',
    level: 'deterministic',
    message: 'Executed using deterministic rules and verified intent.',
  };
}

export function groupLedgerStages(ledger = []) {
  const groups = {
    visual: [],
    relevance: [],
    compilation: [],
    safety: [],
  };

  for (const entry of ledger) {
    const role = entry.role || '';
    const name = entry.name || '';
    if (role === 'visual perception' || name.startsWith('perception') || role === 'font identification' || name.startsWith('font')) {
      groups.visual.push(entry);
    } else if (role === 'relevance' || name.startsWith('relevance')) {
      groups.relevance.push(entry);
    } else if (role === 'instruction compilation' || name.startsWith('compiler') || name.startsWith('prompt')) {
      groups.compilation.push(entry);
    } else {
      groups.safety.push(entry);
    }
  }

  return groups;
}

export function normalizeExecutionLedger(rawStages = [], options = {}) {
  const stages = (Array.isArray(rawStages) ? rawStages : []).map(normalizeStageEntry);
  const trust = deriveTrustBanner(stages);
  const groups = groupLedgerStages(stages);
  const totalDurationMs = stages.reduce((sum, s) => sum + (s.duration_ms || 0), 0);

  return {
    stages,
    trust,
    groups,
    total_duration_ms: totalDurationMs,
    timestamp: options.timestamp || new Date().toISOString(),
  };
}
