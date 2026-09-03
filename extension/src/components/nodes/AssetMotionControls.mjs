import React from 'react';
import { CircleStop, Route, RotateCcw, Trash2, X } from 'lucide-react';

const h = React.createElement;

export function AssetMotionControls({
  motion,
  onStart = () => {},
  onFinish = () => {},
  onCancel = () => {},
  onRemove = () => {},
}) {
  if (motion?.active) {
    return h('div', { className: 'asset-motion asset-motion--recording' },
      h('span', { className: 'motion-indicator' }, h('span', { className: 'pulse' }), 'Recording motion'),
      h('button', { type: 'button', className: 'asset-motion__finish', 'aria-label': 'Finish motion', onClick: onFinish },
        h(CircleStop, { size: 15, 'aria-hidden': true }), h('span', null, 'Finish motion')),
      h('button', { type: 'button', className: 'asset-motion__cancel', 'aria-label': 'Cancel motion', onClick: onCancel },
        h(X, { size: 15, 'aria-hidden': true }), h('span', null, 'Cancel')),
    );
  }

  if (motion?.path?.length > 1) {
    return h('div', { className: 'asset-motion asset-motion--saved', 'aria-label': 'Motion saved' },
      h('span', { className: 'asset-motion__label' }, h(Route, { size: 15, 'aria-hidden': true }), 'Motion saved'),
      h('button', { type: 'button', 'aria-label': 'Record motion again', title: 'Record motion again', onClick: onStart },
        h(RotateCcw, { size: 16, 'aria-hidden': true })),
      h('button', { type: 'button', 'aria-label': 'Remove motion', title: 'Remove motion', onClick: onRemove },
        h(Trash2, { size: 16, 'aria-hidden': true })),
    );
  }

  return h('button', { type: 'button', className: 'asset-motion__trigger', 'aria-label': 'Motion', title: 'Record motion', onClick: onStart },
    h(Route, { size: 20, 'aria-hidden': true }));
}
