export function validateCueEligibility(nodes = []) {
  const textNodes = nodes.filter(node => node.type === 'text');
  if (textNodes.some(node => !String(node.data?.text || '').trim())) {
    return { ok: false, error: 'Please fill in all empty text notes before submitting.' };
  }

  const hasMeaningfulText = textNodes.some(node => String(node.data?.text || '').trim());
  const hasVisualAsset = nodes.some(node => node.type === 'asset');
  if (!hasMeaningfulText && !hasVisualAsset) {
    return { ok: false, error: 'Add a text instruction or visual Asset before sending intent.' };
  }

  return { ok: true };
}
