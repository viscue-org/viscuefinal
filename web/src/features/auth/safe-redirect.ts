export function safeRedirectPath(target: string | null | undefined): string {
  if (!target || typeof target !== 'string') {
    return '/account';
  }

  const trimmed = target.trim();

  // Must start with a single slash and not double slash (which browsers interpret as protocol-relative)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/account';
  }

  // Reject dangerous schemes or control characters
  if (/[\r\n\t]/.test(trimmed) || trimmed.includes('\\') || trimmed.includes(':')) {
    return '/account';
  }

  return trimmed;
}
