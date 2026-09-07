export function shouldCloseWorkspace(handoff, receipt) {
  return Boolean(handoff?.ok && handoff?.prompt_verified === true && receipt?.ok && receipt?.cached === true);
}

export function isWorkspaceUrl(url, extensionRoot) {
  try {
    const candidate = new URL(url);
    const root = new URL(extensionRoot);
    return candidate.protocol === root.protocol
      && candidate.host === root.host
      && candidate.pathname === `${root.pathname}index.html`;
  } catch {
    return false;
  }
}
