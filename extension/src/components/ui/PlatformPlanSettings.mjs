import React from 'react';
import {
  PLATFORM_CAPABILITIES,
  effectiveReferenceLimit,
  normalizePlatformCapability,
} from '../../../../local-server/lib/platform-capabilities.mjs';

const h = React.createElement;

export function PlatformPlanSettings({ platformName = 'ChatGPT', capability = {}, viscuePlan = 'free', onChange = () => {} }) {
  const normalized = normalizePlatformCapability(capability, platformName);
  const definition = PLATFORM_CAPABILITIES[normalized.platform];
  const policy = effectiveReferenceLimit({ viscuePlan, capability: normalized });
  return h('div', { className: 'settings-platform-plan' },
    h('div', { className: 'settings-platform-plan__copy' },
      h('h3', null, 'AI platform plan'),
      h('p', null, definition.displayName)),
    h('label', null,
      h('span', { className: 'sr-only' }, `${definition.displayName} subscription`),
      h('select', {
        value: normalized.plan,
        onChange: event => onChange(normalizePlatformCapability({ platform: normalized.platform, plan: event.target.value }, normalized.platform)),
      }, ...definition.plans.map(option => h('option', { key: option.id, value: option.id }, option.label)))),
    h('strong', { className: 'settings-platform-plan__limit' }, `${policy.limit} visual references`));
}
