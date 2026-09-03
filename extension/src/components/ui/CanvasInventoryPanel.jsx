import React, { memo, useMemo } from 'react';
import {
  FileText,
  Image,
  Link2,
  StickyNote,
  Type,
  Video,
  Globe,
  X,
  Trash2,
  Layers,
  Sparkles,
} from 'lucide-react';

const kindMeta = {
  image: { label: 'Image', Icon: Image },
  video: { label: 'Video', Icon: Video },
  webpage: { label: 'Web page', Icon: Globe },
  document: { label: 'Document', Icon: FileText },
};

const getNodeMeta = node => {
  if (node.type === 'text') {
    return node.data.variant === 'sticky'
      ? { label: 'Note', Icon: StickyNote }
      : { label: 'Text', Icon: Type };
  }
  return kindMeta[node.data.kind] || { label: 'Asset', Icon: Layers };
};

const getNodeTitle = node => {
  if (node.type === 'text') {
    return node.data.text?.trim() || (node.data.variant === 'sticky' ? 'Untitled note' : 'Untitled text');
  }
  return node.data.name || 'Untitled reference';
};

export const CanvasInventoryPanel = memo(function CanvasInventoryPanel({ nodes, edges, onClose, onFocusNode, onClearAll }) {
  const counts = useMemo(() => {
    const assets = nodes.filter(node => node.type === 'asset').length;
    const text = nodes.filter(node => node.type === 'text' && node.data.variant !== 'sticky').length;
    const notes = nodes.filter(node => node.type === 'text' && node.data.variant === 'sticky').length;
    const links = edges.length;
    return { assets, text, notes, links, total: nodes.length };
  }, [edges.length, nodes]);

  return (
    <aside className="canvas-inventory" aria-labelledby="canvas-inventory-title" data-testid="canvas-inventory">
      <header className="canvas-inventory-header">
        <div className="canvas-inventory-header-info">
          <div className="canvas-inventory-title-row">
            <h2 id="canvas-inventory-title">Canvas Items</h2>
            <span className="canvas-inventory-badge">{counts.total}</span>
          </div>
          {counts.total > 0 && (
            <div className="canvas-inventory-summary-tags">
              {counts.assets > 0 && <span>{counts.assets} {counts.assets === 1 ? 'asset' : 'assets'}</span>}
              {counts.notes > 0 && <span>{counts.notes} {counts.notes === 1 ? 'note' : 'notes'}</span>}
              {counts.text > 0 && <span>{counts.text} text</span>}
            </div>
          )}
        </div>
        <div className="canvas-inventory-header-actions">
          {counts.total > 0 && onClearAll && (
            <button 
              type="button" 
              onClick={onClearAll} 
              className="canvas-inventory-clear-btn"
              aria-label="Clear all canvas items"
              title="Clear all canvas items"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
          <button 
            type="button" 
            onClick={onClose} 
            className="canvas-inventory-close-btn"
            aria-label="Close canvas contents"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="canvas-inventory-list">
        {nodes.length === 0 ? (
          <div className="canvas-inventory-empty">
            <div className="canvas-inventory-empty-icon">
              <Layers size={22} />
            </div>
            <strong>Canvas is empty</strong>
            <p>Added references, images, web pages, and text notes will appear here.</p>
          </div>
        ) : (
          nodes.map((node, index) => {
            const { label, Icon } = getNodeMeta(node);
            return (
              <button 
                key={node.id} 
                type="button" 
                className="canvas-inventory-item" 
                onClick={() => onFocusNode(node.id)}
                title={`Focus on ${getNodeTitle(node)}`}
              >
                <span className="canvas-inventory-icon"><Icon size={15} /></span>
                <span className="canvas-inventory-copy">
                  <strong>{getNodeTitle(node)}</strong>
                  <small>{label}</small>
                </span>
              </button>
            );
          })
        )}
      </div>

      {counts.links > 0 && (
        <footer className="canvas-inventory-footer">
          <span><Link2 size={13} /> {counts.links} {counts.links === 1 ? 'connection' : 'connections'}</span>
        </footer>
      )}
    </aside>
  );
});
