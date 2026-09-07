import React, { useState } from 'react';
import {
  PLATFORM_CAPABILITIES,
  effectiveReferenceLimit,
  normalizePlatformCapability,
} from '../../../../local-server/lib/platform-capabilities.mjs';

const h = React.createElement;

export function PlatformPlanDialog({ platformName = 'ChatGPT', initialCapability = {}, viscuePlan = 'free', onSave = () => {} }) {
  const normalized = normalizePlatformCapability(initialCapability, platformName);
  const [plan, setPlan] = useState(normalized.plan);
  const capability = normalizePlatformCapability({ platform: normalized.platform, plan }, normalized.platform);
  const definition = PLATFORM_CAPABILITIES[capability.platform];
  const policy = effectiveReferenceLimit({ viscuePlan, capability });
  return h('div', { className: 'modal-backdrop platform-plan-backdrop' },
    h('section', { className: 'modal platform-plan-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'platform-plan-title' },
      h('header', null, h('div', null,
        h('small', null, 'One-time setup'),
        h('h2', { id: 'platform-plan-title' }, `Choose your ${definition.displayName} plan`))),
      h('p', { className: 'platform-plan-intro' }, 'This helps Viscue send only as many visual references as your current AI subscription can accept. You can change it later in Settings.'),
      h('div', { className: 'platform-plan-options', role: 'radiogroup', 'aria-label': `${definition.displayName} subscription plan` },
        ...definition.plans.map(option => h('button', {
          type: 'button',
          key: option.id,
          role: 'radio',
          'aria-checked': option.id === plan,
          className: `platform-plan-option${option.id === plan ? ' is-selected' : ''}`,
          onClick: () => setPlan(option.id),
        }, h('strong', null, option.label), h('span', null, `${Math.min(option.budget, definition.providerCeiling)} visual references`)))),
      h('div', { className: 'platform-plan-limit', 'aria-live': 'polite' },
        h('strong', null, `${policy.destinationLimit} visual references`),
        h('span', null, `Effective limit with your Viscue ${String(viscuePlan || 'free')} plan: ${policy.limit}`)),
      h('footer', null, h('button', { type: 'button', className: 'primary', onClick: () => onSave(capability) }, 'Continue to Workspace')),
    ));
}
