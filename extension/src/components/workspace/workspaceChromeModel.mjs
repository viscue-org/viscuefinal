export const WORKSPACE_MENUS = Object.freeze(['assets', 'annotate', 'text', 'history']);
export const WORKSPACE_TOOLS = Object.freeze(['select', 'assets', 'annotate', 'text']);

export function getNextOpenMenu(openMenu, requestedMenu) {
  return openMenu === requestedMenu ? null : requestedMenu;
}

export function getSelectedTool(mode, annotationTool, textTool) {
  if (mode === 'annotate') return annotationTool;
  if (mode === 'text') return textTool === 'sticky' ? 'sticky' : 'text';
  return mode || 'select';
}

export function resolveDockCommand(command) {
  if (WORKSPACE_MENUS.includes(command)) return { kind: 'menu', value: command };
  if (['undo', 'redo', 'cue'].includes(command)) return { kind: 'action', value: command };
  return { kind: 'mode', value: command };
}

export function resolveToolbarOption(panel, option) {
  if (panel === 'assets' && ['image', 'video', 'document'].includes(option)) return { kind: 'file', value: option };
  if (panel === 'assets' && option === 'screen') return { kind: 'capture', value: 'screen' };
  if (panel === 'assets' && option === 'web') return { kind: 'dialog', value: 'webpage' };
  if (panel === 'annotate') return { kind: 'annotation', value: option };
  if (panel === 'text') return { kind: 'text', value: option === 's-note' ? 'sticky' : 'text' };
  return null;
}

export function resolvePageCapture(response) {
  if (!response?.ok) {
    return { ok: false, error: response?.error || 'Could not capture the webpage.' };
  }
  if (typeof response.dataUrl !== 'string' || !response.dataUrl.startsWith('data:image/')) {
    return { ok: false, error: 'Current page capture needs an active browser tab.' };
  }
  return {
    ok: true,
    dataUrl: response.dataUrl,
    title: response.title,
    url: response.url,
  };
}
