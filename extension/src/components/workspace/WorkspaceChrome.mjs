import React from 'react';
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  ArrowsClockwise,
  Cursor,
  ClockCounterClockwise,
  Eraser,
  FileText,
  Globe,
  Image,
  Hand,
  CaretDown,
  ChatCircle,
  MonitorArrowUp,
  Moon,
  Note,
  PencilSimple,
  Plus,
  Selection,
  Sun,
  TextT,
  VideoCamera,
  X,
  Export,
  Trash,
  Broom,
  DownloadSimple
} from '@phosphor-icons/react';
import { getSelectedTool } from './workspaceChromeModel.mjs';

const h = React.createElement;

const MENU_OPTIONS = Object.freeze({
  assets: [
    ['image', 'Image', Image],
    ['video', 'Video', VideoCamera],
    ['document', 'Document', FileText],
    ['page', 'Current page', MonitorArrowUp],
    ['web', 'Web page', Globe],
  ],
  annotate: [
    ['annotate', 'Point', Cursor],
    ['area', 'Area', Selection],
    ['draw', 'Draw', PencilSimple],
    ['erase', 'Erase', Eraser],
  ],
  text: [
    ['text', 'Text', TextT],
    ['s-note', 'Sticky note', Note],
  ],
});

function icon(Icon, size = 18, name) {
  return h(Icon, { size, weight: 'regular', 'aria-hidden': true, 'data-icon': name });
}

function DockButton({ label, pressed, disabled, expanded, controls, onClick, onMouseEnter, onMouseLeave, children }) {
  return h('button', {
    type: 'button',
    className: 'workspace-dock__button',
    'aria-label': label,
    'aria-pressed': pressed,
    'aria-expanded': expanded,
    'aria-controls': controls,
    disabled,
    onClick,
    onMouseEnter,
    onMouseLeave,
  }, children);
}



export function WorkspaceCommandDock({
  mode = 'select',
  annotationTool = 'annotate',
  textTool = 'text',
  openMenu = null,
  canUndo = false,
  canRedo = false,
  busy = false,
  onCommand = () => {},
  onOption = () => {},
  onMenuChange = () => {},
}) {
  const selected = getSelectedTool(mode, annotationTool, textTool);
  const [hoveredOption, setHoveredOption] = React.useState(null);

  // Hide the minimize button when hovering over options that show a wide instruction tooltip
  const HIDE_MINIMIZE_ON_HOVER = ['video', 'document'];
  const hideMinimize = openMenu === 'assets' && HIDE_MINIMIZE_ON_HOVER.includes(hoveredOption);

  const menuButton = (panel, label, Icon) => h(DockButton, {
    key: panel,
    label,
    pressed: mode === panel || openMenu === panel,
    expanded: openMenu === panel,
    controls: `workspace-${panel}-menu`,
    onClick: () => onMenuChange(openMenu === panel ? null : panel),
  }, icon(Icon));

  return h(React.Fragment, null,
    h('nav', { className: 'workspace-dock', 'aria-label': 'Workspace tools' },
      openMenu && !hideMinimize && h('button', {
        type: 'button',
        className: 'workspace-dock__minimize',
        'aria-label': 'Minimize menu',
        title: 'Minimize menu',
        onClick: () => onMenuChange(null),
      }, icon(CaretDown, 20)),
      h('div', { className: 'workspace-dock__rail' },
        openMenu ? h(React.Fragment, null,
          openMenu === 'history' ? h(React.Fragment, null,
            h(DockButton, { label: 'Undo', disabled: !canUndo, onClick: () => onCommand('undo') }, icon(ArrowUUpLeft, 26, 'undo')),
            h(DockButton, { label: 'Redo', disabled: !canRedo, onClick: () => onCommand('redo') }, icon(ArrowUUpRight, 26, 'redo'))
          ) : (MENU_OPTIONS[openMenu] || []).map(([value, label, Icon]) => h(DockButton, {
            key: value,
            label,
            pressed: (panel => {
              if (panel === 'assets') return false;
              if (panel === 'annotate') return mode === 'annotate' && annotationTool === value;
              if (panel === 'text') return mode === 'text' && textTool === value;
              return false;
            })(openMenu),
            onClick: () => onOption(openMenu, value),
            onMouseEnter: () => setHoveredOption(value),
            onMouseLeave: () => setHoveredOption(null),
          }, icon(Icon, 26, value)))
        ) : h(React.Fragment, null,
          h(DockButton, {
            label: 'Select',
            pressed: selected === 'select',
            onClick: () => onCommand('select'),
          }, icon(Hand, 26, 'hand')),
          h(DockButton, {
            key: 'assets', label: 'Add assets', pressed: mode === 'assets', expanded: openMenu === 'assets', controls: 'workspace-assets-menu',
            onClick: () => onMenuChange(openMenu === 'assets' ? null : 'assets'),
          }, icon(Plus, 26, 'plus')),
          h(DockButton, {
            key: 'annotate', label: 'Annotate', pressed: mode === 'annotate', expanded: openMenu === 'annotate', controls: 'workspace-annotate-menu',
            onClick: () => onMenuChange(openMenu === 'annotate' ? null : 'annotate'),
          }, icon(ChatCircle, 26, 'annotation')),
          h(DockButton, {
            key: 'text', label: 'Add text', pressed: mode === 'text', expanded: openMenu === 'text', controls: 'workspace-text-menu',
            onClick: () => onMenuChange(openMenu === 'text' ? null : 'text'),
          }, icon(TextT, 26, 'text')),
          h('span', { className: 'workspace-dock__divider', 'aria-hidden': true }),
          h(DockButton, {
            label: 'Undo and redo',
            pressed: openMenu === 'history',
            expanded: openMenu === 'history',
            controls: 'workspace-history-menu',
            onClick: () => onMenuChange(openMenu === 'history' ? null : 'history'),
          }, icon(ArrowsClockwise, 26, 'undo')),
        )
      ),
      !openMenu && h('button', {
        type: 'button',
        className: 'workspace-dock__cue',
        'aria-label': 'Cue',
        disabled: busy,
        onClick: () => onCommand('cue'),
      }, h('span', null, 'Cue')),
    ),
    !openMenu && h('span', { className: 'workspace-dock__frame', 'aria-hidden': true }),
  );
}

export function WorkspaceDestination({ label = 'ChatGPT' }) {
  return h('div', { className: 'workspace-destination', 'aria-label': `Destination: ${label}` }, label);
}

export function WorkspaceEmptyState({ onAdd = () => {} }) {
  return h('section', { className: 'workspace-empty', 'aria-labelledby': 'workspace-empty-title' },
    h('h1', { id: 'workspace-empty-title', className: 'workspace-empty__title' },
      h('span', { className: 'word-show' }, 'Show'),
      h('span', { className: 'word-what' }, 
        h('span', { className: 'q-mark' }, '?'), 
        h('span', { className: 'text-what' }, 'What')
      ),
      h('span', { className: 'word-you' }, 'You'),
      h('span', { className: 'word-mean' }, 'Mean')
    ),
    h('button', { type: 'button', className: 'workspace-empty__action', onClick: onAdd },
      h('span', null, 'Click here')
    )
  );
}

export function WorkspaceUtilities({
  theme = 'light',
  onThemeToggle = () => {},
  onHistoryOpen = () => {},
  onClose = () => {},
}) {
  const dark = theme === 'dark';
  return h('div', { className: 'workspace-utilities' },
    h('div', { className: 'workspace-utilities__rail' },
      h('button', {
        type: 'button',
        'aria-label': dark ? 'Switch to light mode' : 'Switch to dark mode',
        title: dark ? 'Light mode' : 'Dark mode',
        onClick: onThemeToggle,
      }, icon(dark ? Sun : Moon, 19, 'theme')),
      h('button', {
        type: 'button',
        'aria-label': 'Open history',
        title: 'History',
        onClick: onHistoryOpen,
      }, icon(ClockCounterClockwise, 19, 'history')),
      h('button', {
        type: 'button',
        'aria-label': 'Clear workspace',
        title: 'Clear workspace',
        onClick: onClose,
      }, icon(X, 19, 'close')),
    ),
  );
}

function historyTitle(index, item) {
  if (item?.title) return item.title;
  if (item && item.timestamp) {
    const d = new Date(item.timestamp);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `Workspace from ${date} at ${time}`;
  }
  return `Example ${index + 1}`;
}

function historyMeta(item) {
  const referenceCount = Array.isArray(item?.nodes) ? item.nodes.filter(node => node.type !== 'text').length : 0;
  const label = `${referenceCount} reference${referenceCount === 1 ? '' : 's'}`;
  const date = new Date(item?.timestamp || Date.now());
  return `${label} · ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function WorkspaceHistory({ items = [], historyConfig = { autoDeleteHours: 24 }, onHistoryConfigChange = () => {}, onClose = () => {}, onRestore = () => {}, onExport = () => {}, onDelete = () => {}, onClearAll = () => {}, onImport = () => {} }) {
  return h('section', { className: 'workspace-history', role: 'dialog', 'aria-modal': true, 'aria-label': 'History' },
    items.length === 0
      ? h('div', { className: 'workspace-history__empty' },
          icon(ClockCounterClockwise, 28),
          h('p', null, 'Your saved workspace states will appear here.'),
        )
      : h('div', { className: 'workspace-history__list' }, items.map((item, index) => {
        const title = historyTitle(index, item);
        return h('article', { className: 'workspace-history__item', key: item.id || item.timestamp || index },
          h('div', { className: 'workspace-history__copy' },
            h('strong', null, title),
            h('span', { className: 'workspace-history__meta' }, historyMeta(item))
          ),
          h('div', { className: 'workspace-history__actions' },
            h('button', { type: 'button', className: 'workspace-history__restore', onClick: () => onRestore(item) }, 'Restore'),
            h('button', { type: 'button', 'aria-label': `Export ${title}`, title: 'Export workspace', onClick: () => onExport(item) }, icon(Export, 20)),
            h('button', { type: 'button', 'aria-label': `Delete ${title}`, title: 'Delete workspace', onClick: () => onDelete(item.id) }, icon(Trash, 20)),
          ),
        );
      })),
    h('div', { className: 'workspace-history__retention-bar' },
      h('label', { className: 'workspace-history__retention', htmlFor: 'history-retention' },
        h('span', null, 'Auto-delete history older than'),
        h('select', { id: 'history-retention', value: historyConfig.autoDeleteHours, onChange: event => onHistoryConfigChange(Number(event.target.value)) },
          h('option', { value: 24 }, '24 hours'),
          h('option', { value: 48 }, '48 hours'),
          h('option', { value: 168 }, '7 days')))
    ),
    h('div', { className: 'workspace-history__bottom-bar' },
      h('h2', { id: 'workspace-history-title' }, 'History'),
      h('div', { className: 'workspace-history__bottom-actions' },
        h('button', { type: 'button', className: 'workspace-history__action-btn', 'aria-label': 'Clear all history', title: 'Clear all', onClick: onClearAll }, icon(Broom, 32)),
        h('button', { type: 'button', className: 'workspace-history__action-btn', 'aria-label': 'Import workspace', title: 'Import', onClick: onImport }, icon(DownloadSimple, 32)),
      ),
      h('div', { className: 'workspace-history__close-cutout' },
        h('button', { type: 'button', className: 'workspace-history__close-btn', 'aria-label': 'Close history', title: 'Close history', onClick: onClose }, icon(X, 32))
      )
    )
  );
}
