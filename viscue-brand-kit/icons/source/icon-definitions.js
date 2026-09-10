/**
 * Canonical Viscue icon definitions.
 * Source of truth for raw SVGs, React exports, metadata, and preview markup.
 */

export const ICON_DEFINITIONS = [
  // --- Brand Mark & Concepts ---
  {
    name: 'cue',
    category: 'action',
    keywords: ['cue', 'dash', 'action', 'focus', 'brand'],
    brandSpecific: true,
    elements: [
      { type: 'line', x1: 5, y1: 12, x2: 19, y2: 12 }
    ]
  },

  // --- System ---
  {
    name: 'moon',
    category: 'system',
    keywords: ['moon', 'dark', 'night', 'theme', 'mode'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M12 3a6.5 6.5 0 0 0 8.5 8.5 9 9 0 1 1-8.5-8.5Z' }
    ]
  },
  {
    name: 'database',
    category: 'system',
    keywords: ['database', 'storage', 'data', 'server', 'archive'],
    brandSpecific: false,
    elements: [
      { type: 'ellipse', cx: 12, cy: 5, rx: 9, ry: 3 },
      { type: 'path', d: 'M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5' },
      { type: 'path', d: 'M3 12c0 1.7 4 3 9 3s9-1.3 9-3' }
    ]
  },
  {
    name: 'close',
    category: 'system',
    keywords: ['close', 'dismiss', 'cancel', 'exit', 'remove'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M18 6 6 18' },
      { type: 'path', d: 'M6 6l12 12' }
    ]
  },
  {
    name: 'chevron-down',
    category: 'system',
    keywords: ['chevron', 'down', 'arrow', 'dropdown', 'expand'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M6 9l6 6 6-6' }
    ]
  },
  {
    name: 'search',
    category: 'system',
    keywords: ['search', 'find', 'lookup', 'query', 'explore'],
    brandSpecific: false,
    elements: [
      { type: 'circle', cx: 11, cy: 11, r: 7.5 },
      { type: 'path', d: 'm16.5 16.5 4.5 4.5' }
    ]
  },
  {
    name: 'settings',
    category: 'system',
    keywords: ['settings', 'gear', 'preferences', 'configure', 'options'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M20 7h-9' },
      { type: 'circle', cx: 7, cy: 7, r: 3 },
      { type: 'path', d: 'M13 17H4' },
      { type: 'circle', cx: 17, cy: 17, r: 3 }
    ]
  },
  {
    name: 'sliders',
    category: 'system',
    keywords: ['sliders', 'controls', 'adjust', 'filters', 'settings'],
    brandSpecific: false,
    elements: [
      { type: 'line', x1: 4, y1: 6, x2: 20, y2: 6 },
      { type: 'line', x1: 4, y1: 12, x2: 20, y2: 12 },
      { type: 'line', x1: 4, y1: 18, x2: 20, y2: 18 },
      { type: 'circle', cx: 9, cy: 6, r: 2.5 },
      { type: 'circle', cx: 15, cy: 12, r: 2.5 },
      { type: 'circle', cx: 8, cy: 18, r: 2.5 }
    ]
  },
  {
    name: 'lock',
    category: 'system',
    keywords: ['lock', 'security', 'protect', 'private', 'secure'],
    brandSpecific: false,
    elements: [
      { type: 'rect', x: 3, y: 11, width: 18, height: 11, rx: 2.5 },
      { type: 'path', d: 'M7 11V7a5 5 0 0 1 10 0v4' }
    ]
  },
  {
    name: 'eye-off',
    category: 'system',
    keywords: ['eye-off', 'hide', 'invisible', 'conceal', 'private'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'm2 2 20 20' },
      { type: 'path', d: 'M6.71 6.71C4.94 7.95 3.58 9.68 3 12c2.73 4.2 5.73 6 9 6 1.04 0 2.05-.18 3.02-.53' },
      { type: 'path', d: 'M10.73 5.08C11.15 5.03 11.57 5 12 5c3.27 0 6.27 1.8 9 7a11.8 11.8 0 0 1-1.39 2.19' },
      { type: 'path', d: 'M14.12 14.12A3 3 0 0 1 9.88 9.88' }
    ]
  },
  {
    name: 'globe',
    category: 'system',
    keywords: ['globe', 'world', 'internet', 'network', 'web'],
    brandSpecific: false,
    elements: [
      { type: 'circle', cx: 12, cy: 12, r: 9.5 },
      { type: 'line', x1: 2.5, y1: 12, x2: 21.5, y2: 12 },
      { type: 'path', d: 'M12 2.5a15 15 0 0 1 4 9.5 15 15 0 0 1-4 9.5 15 15 0 0 1-4-9.5 15 15 0 0 1 4-9.5z' }
    ]
  },

  // --- Actions ---
  {
    name: 'more-stack',
    category: 'action',
    keywords: ['more', 'stack', 'layers', 'menu', 'overflow'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M9 4.5h5.5A4.5 4.5 0 0 1 19 9v1.5A4.5 4.5 0 0 1 14.5 15H9Z' },
      { type: 'path', d: 'M6 7.5V16a3 3 0 0 0 3 3h8.5' },
      { type: 'path', d: 'M3.5 10.5V17a4 4 0 0 0 4 4H14' }
    ]
  },
  {
    name: 'plus',
    category: 'action',
    keywords: ['plus', 'add', 'create', 'new', 'insert'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M5 12h14' },
      { type: 'path', d: 'M12 5v14' }
    ]
  },
  {
    name: 'check',
    category: 'action',
    keywords: ['check', 'done', 'confirm', 'success', 'select'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M20 6 9 17l-5-5' }
    ]
  },
  {
    name: 'copy',
    category: 'action',
    keywords: ['copy', 'duplicate', 'clone', 'clipboard'],
    brandSpecific: false,
    elements: [
      { type: 'rect', x: 8, y: 8, width: 13, height: 13, rx: 2.5 },
      { type: 'path', d: 'M4 16c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h9c1.1 0 2 .9 2 2' }
    ]
  },
  {
    name: 'download',
    category: 'action',
    keywords: ['download', 'export', 'save', 'retrieve'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
      { type: 'polyline', points: '7 10 12 15 17 10' },
      { type: 'line', x1: 12, y1: 3, x2: 12, y2: 15 }
    ]
  },
  {
    name: 'upload',
    category: 'action',
    keywords: ['upload', 'import', 'publish', 'send'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
      { type: 'polyline', points: '17 8 12 3 7 8' },
      { type: 'line', x1: 12, y1: 3, x2: 12, y2: 15 }
    ]
  },
  {
    name: 'share',
    category: 'action',
    keywords: ['share', 'send', 'link', 'social', 'export'],
    brandSpecific: false,
    elements: [
      { type: 'circle', cx: 18, cy: 5, r: 3 },
      { type: 'circle', cx: 6, cy: 12, r: 3 },
      { type: 'circle', cx: 18, cy: 19, r: 3 },
      { type: 'line', x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 },
      { type: 'line', x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 }
    ]
  },
  {
    name: 'save',
    category: 'action',
    keywords: ['save', 'disk', 'store', 'commit', 'keep'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z' },
      { type: 'polyline', points: '17 21 17 13 7 13 7 21' },
      { type: 'polyline', points: '7 3 7 8 15 8' }
    ]
  },
  {
    name: 'link',
    category: 'action',
    keywords: ['link', 'hyperlink', 'connect', 'url', 'chain'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M9 17H7A5 5 0 0 1 7 7h2' },
      { type: 'path', d: 'M15 7h2a5 5 0 1 1 0 10h-2' },
      { type: 'line', x1: 8, y1: 12, x2: 16, y2: 12 }
    ]
  },
  {
    name: 'trash',
    category: 'action',
    keywords: ['trash', 'delete', 'remove', 'bin', 'discard'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M3 6h18' },
      { type: 'path', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
      { type: 'path', d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
      { type: 'line', x1: 10, y1: 11, x2: 10, y2: 17 },
      { type: 'line', x1: 14, y1: 11, x2: 14, y2: 17 }
    ]
  },
  {
    name: 'reset',
    category: 'action',
    keywords: ['reset', 'reload', 'refresh', 'revert', 'restart'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M3 12a9 9 0 1 0 3-6.7L3 8' },
      { type: 'path', d: 'M3 3v5h5' }
    ]
  },
  {
    name: 'wand',
    category: 'action',
    keywords: ['wand', 'magic', 'ai', 'generate', 'sparkle'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'm15 4 5 5L7 22H2v-5L15 4z' },
      { type: 'line', x1: 8, y1: 3, x2: 12, y2: 3 },
      { type: 'line', x1: 19, y1: 14, x2: 21, y2: 14 }
    ]
  },
  {
    name: 'history',
    category: 'action',
    keywords: ['history', 'timeline', 'recent', 'clock', 'time'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M3 12a9 9 0 1 0 3-6.7L3 8' },
      { type: 'path', d: 'M3 3v5h5' },
      { type: 'polyline', points: '12 7 12 12 15 14' }
    ]
  },
  {
    name: 'undo',
    category: 'action',
    keywords: ['undo', 'revert', 'back', 'history', 'arrow'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M3 7v6h6' },
      { type: 'path', d: 'M3 13a9 9 0 0 1 15.36-4.36A9 9 0 0 1 18 19' }
    ]
  },
  {
    name: 'redo',
    category: 'action',
    keywords: ['redo', 'forward', 'again', 'history', 'arrow'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M21 7v6h-6' },
      { type: 'path', d: 'M21 13a9 9 0 0 0-15.36-4.36A9 9 0 0 0 6 19' }
    ]
  },

  // --- Canvas ---
  {
    name: 'grid',
    category: 'canvas',
    keywords: ['grid', 'layout', 'canvas', 'guides', 'view'],
    brandSpecific: false,
    elements: [
      { type: 'rect', x: 3, y: 3, width: 7, height: 7, rx: 1.5 },
      { type: 'rect', x: 14, y: 3, width: 7, height: 7, rx: 1.5 },
      { type: 'rect', x: 3, y: 14, width: 7, height: 7, rx: 1.5 },
      { type: 'rect', x: 14, y: 14, width: 7, height: 7, rx: 1.5 }
    ]
  },
  {
    name: 'sticky-note',
    category: 'canvas',
    keywords: ['sticky-note', 'note', 'memo', 'canvas', 'card'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z' },
      { type: 'path', d: 'M16 3v5h5' }
    ]
  },
  {
    name: 'collapse',
    category: 'canvas',
    keywords: ['collapse', 'minimize', 'shrink', 'dock', 'fold'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'm4 14 6-6' },
      { type: 'polyline', points: '4 8 10 8 10 14' },
      { type: 'path', d: 'm20 10-6 6' },
      { type: 'polyline', points: '20 16 14 16 14 10' }
    ]
  },
  {
    name: 'annotate',
    category: 'canvas',
    keywords: ['annotate', 'comment', 'markup', 'canvas', 'cue'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M21 15a3 3 0 0 1-3 3H7l-4 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9z' },
      { type: 'line', x1: 8, y1: 10, x2: 16, y2: 10 }
    ]
  },
  {
    name: 'area',
    category: 'canvas',
    keywords: ['area', 'select', 'region', 'bounds', 'box'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M7 3H5a2 2 0 0 0-2 2v2' },
      { type: 'path', d: 'M17 3h2a2 2 0 0 1 2 2v2' },
      { type: 'path', d: 'M21 17v2a2 2 0 0 1-2 2h-2' },
      { type: 'path', d: 'M7 21H5a2 2 0 0 0-2-2v-2' },
      { type: 'line', x1: 9, y1: 12, x2: 15, y2: 12 }
    ]
  },
  {
    name: 'pencil',
    category: 'canvas',
    keywords: ['pencil', 'draw', 'edit', 'sketch', 'write'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' },
      { type: 'line', x1: 15, y1: 5, x2: 19, y2: 9 }
    ]
  },
  {
    name: 'eraser',
    category: 'canvas',
    keywords: ['eraser', 'clear', 'delete', 'wipe', 'canvas'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'm7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l4.6 4.6a2.4 2.4 0 0 1 0 3.4L11 21H7z' },
      { type: 'line', x1: 18, y1: 9, x2: 8.5, y2: 18.5 }
    ]
  },
  {
    name: 'cursor',
    category: 'canvas',
    keywords: ['cursor', 'pointer', 'select', 'mouse', 'arrow'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'm4 4 6.5 16 2.5-6.5 6.5-2.5L4 4z' },
      { type: 'line', x1: 15, y1: 15, x2: 19, y2: 19 }
    ]
  },
  {
    name: 'annotation-tool',
    category: 'canvas',
    keywords: ['annotation-tool', 'pen', 'draw', 'tool', 'cue'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'm14 4 6 6-10 10H4v-6L14 4z' },
      { type: 'line', x1: 17, y1: 7, x2: 11, y2: 13 },
      { type: 'line', x1: 4, y1: 14, x2: 8, y2: 14 }
    ]
  },
  {
    name: 'text-tool',
    category: 'canvas',
    keywords: ['text-tool', 'text', 'type', 'insert', 'tool'],
    brandSpecific: false,
    elements: [
      { type: 'line', x1: 8, y1: 4, x2: 16, y2: 4 },
      { type: 'line', x1: 12, y1: 4, x2: 12, y2: 20 },
      { type: 'line', x1: 8, y1: 20, x2: 16, y2: 20 }
    ]
  },

  // --- Format ---
  {
    name: 'bold',
    category: 'format',
    keywords: ['bold', 'text', 'font', 'weight', 'strong'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z' },
      { type: 'path', d: 'M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z' }
    ]
  },
  {
    name: 'italic',
    category: 'format',
    keywords: ['italic', 'text', 'oblique', 'slant', 'style'],
    brandSpecific: false,
    elements: [
      { type: 'line', x1: 19, y1: 4, x2: 10, y2: 4 },
      { type: 'line', x1: 14, y1: 20, x2: 5, y2: 20 },
      { type: 'line', x1: 15, y1: 4, x2: 9, y2: 20 }
    ]
  },
  {
    name: 'underline',
    category: 'format',
    keywords: ['underline', 'text', 'format', 'style'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M6 4v6a6 6 0 0 0 12 0V4' },
      { type: 'line', x1: 4, y1: 20, x2: 20, y2: 20 }
    ]
  },
  {
    name: 'align-left',
    category: 'format',
    keywords: ['align-left', 'align', 'text', 'paragraph', 'layout'],
    brandSpecific: false,
    elements: [
      { type: 'line', x1: 20, y1: 6, x2: 4, y2: 6 },
      { type: 'line', x1: 14, y1: 12, x2: 4, y2: 12 },
      { type: 'line', x1: 18, y1: 18, x2: 4, y2: 18 }
    ]
  },
  {
    name: 'align-center',
    category: 'format',
    keywords: ['align-center', 'align', 'text', 'center', 'layout'],
    brandSpecific: false,
    elements: [
      { type: 'line', x1: 20, y1: 6, x2: 4, y2: 6 },
      { type: 'line', x1: 17, y1: 12, x2: 7, y2: 12 },
      { type: 'line', x1: 19, y1: 18, x2: 5, y2: 18 }
    ]
  },
  {
    name: 'text',
    category: 'format',
    keywords: ['text', 'type', 'typography', 'font', 'label'],
    brandSpecific: false,
    elements: [
      { type: 'polyline', points: '4 7 4 4 20 4 20 7' },
      { type: 'line', x1: 12, y1: 4, x2: 12, y2: 20 }
    ]
  },

  // --- Media ---
  {
    name: 'image',
    category: 'media',
    keywords: ['image', 'picture', 'photo', 'graphic', 'media'],
    brandSpecific: false,
    elements: [
      { type: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2.5 },
      { type: 'circle', cx: 8.5, cy: 8.5, r: 1.5 },
      { type: 'path', d: 'm21 15-5-5a2 2 0 0 0-2.8 0L3 20' }
    ]
  },
  {
    name: 'file-text',
    category: 'media',
    keywords: ['file-text', 'document', 'page', 'note', 'article'],
    brandSpecific: false,
    elements: [
      { type: 'path', d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' },
      { type: 'polyline', points: '14 2 14 8 20 8' },
      { type: 'line', x1: 8, y1: 13, x2: 16, y2: 13 },
      { type: 'line', x1: 8, y1: 17, x2: 14, y2: 17 }
    ]
  },
  {
    name: 'video',
    category: 'media',
    keywords: ['video', 'camera', 'recording', 'movie', 'stream'],
    brandSpecific: false,
    elements: [
      { type: 'rect', x: 2, y: 6, width: 14, height: 12, rx: 2.5 },
      { type: 'path', d: 'm16 10 5-3v10l-5-3' }
    ]
  }
];
