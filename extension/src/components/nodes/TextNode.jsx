import React, { memo, useEffect, useRef, useContext, useState, useCallback } from 'react';
import { Handle, NodeToolbar, Position, useUpdateNodeInternals } from '@xyflow/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Italic,
  Minus,
  Plus,
  StickyNote,
  Trash2,
  Underline,
} from 'lucide-react';
import { WorkspaceContext } from '../../WorkspaceContext';

const SURFACE_COLORS = [
  { label: 'Paper surface', value: 'var(--surface)', text: 'var(--text)' },
  { label: 'Mist blue surface', value: 'var(--viscue-signal-soft, rgba(91, 117, 147, 0.15))', text: 'var(--text)' },
];

export const TextNode = memo(function TextNode({ id, data, selected }) {
  const isSticky = data.variant === 'sticky';
  const textareaRef = useRef(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const context = useContext(WorkspaceContext) || {};
  const { onStyleChange, onCopy, onDelete, onChange } = context;
  
  // Local draft for isolated text editing
  const [draft, setDraft] = useState(data.text);
  const draftTimer = useRef(null);
  
  useEffect(() => {
    // Sync external changes if not currently editing
    if (document.activeElement !== textareaRef.current) {
      setDraft(data.text);
    }
  }, [data.text]);
  const style = {
    fontSize: data.style?.fontSize || (isSticky ? 17 : 19),
    fontWeight: data.style?.fontWeight || (isSticky ? 500 : 600),
    fontStyle: data.style?.fontStyle || 'normal',
    textDecoration: data.style?.textDecoration || 'none',
    textAlign: data.style?.textAlign || 'left',
    color: isSticky ? (data.style?.color || 'var(--text)') : 'var(--text)',
  };
  const surface = isSticky ? (data.style?.backgroundColor || 'var(--sticky-surface)') : 'var(--surface)';

  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    const prevScrollTop = field.scrollTop;
    field.style.height = '0px';
    field.style.height = `${Math.max(isSticky ? 124 : 56, field.scrollHeight)}px`;
    if (prevScrollTop > 0) {
      field.scrollTop = prevScrollTop;
    }
    updateNodeInternals(id);
  }, [draft, id, isSticky, style.fontSize, updateNodeInternals]);

  const handleTextChange = useCallback((e) => {
    const nextVal = e.target.value;
    setDraft(nextVal);
    
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      onChange(id, nextVal);
    }, 400);
  }, [id, onChange]);

  const handleBlur = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    onChange(id, draft);
  }, [id, draft, onChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      textareaRef.current?.blur();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      context.onAddConnectedText?.(id, 'right', 'left');
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      context.onAddConnectedText?.(id, 'bottom', 'top');
    }
  }, [id, context]);

  const setStyle = patch => onStyleChange(id, patch);
  const isActive = (key, value) => style[key] === value;

  return (
    <div
      className={`text-node ${isSticky ? 'sticky-note' : 'plain-text'} ${selected ? 'selected' : ''}`}
      data-testid={isSticky ? 'sticky-note' : 'text-node'}
      style={{ backgroundColor: surface }}
    >
      <NodeToolbar className="node-toolbar text-format-toolbar" isVisible={selected} position={Position.Top} align="center" offset={8}>
        <div className="format-group" role="group" aria-label="Text emphasis">
          <button type="button" onClick={() => setStyle({ fontWeight: style.fontWeight >= 700 ? (isSticky ? 500 : 600) : 700 })} aria-label="Bold" title="Bold" aria-pressed={style.fontWeight >= 700}><Bold size={16} /></button>
          <button type="button" onClick={() => setStyle({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })} aria-label="Italic" title="Italic" aria-pressed={isActive('fontStyle', 'italic')}><Italic size={16} /></button>
          <button type="button" onClick={() => setStyle({ textDecoration: style.textDecoration === 'underline' ? 'none' : 'underline' })} aria-label="Underline" title="Underline" aria-pressed={isActive('textDecoration', 'underline')}><Underline size={16} /></button>
        </div>

        <span className="format-divider" aria-hidden="true" />

        <div className="format-group" role="group" aria-label="Text size">
          <button type="button" onClick={() => setStyle({ fontSize: Math.max(14, style.fontSize - 2) })} aria-label="Decrease text size" title="Decrease text size"><Minus size={16} /></button>
          <output className="font-size-output" aria-label={`Text size ${style.fontSize} pixels`}>{style.fontSize}</output>
          <button type="button" onClick={() => setStyle({ fontSize: Math.min(32, style.fontSize + 2) })} aria-label="Increase text size" title="Increase text size"><Plus size={16} /></button>
        </div>

        <span className="format-divider" aria-hidden="true" />

        <div className="format-group" role="group" aria-label="Text alignment">
          <button type="button" onClick={() => setStyle({ textAlign: 'left' })} aria-label="Align left" title="Align left" aria-pressed={isActive('textAlign', 'left')}><AlignLeft size={16} /></button>
          <button type="button" onClick={() => setStyle({ textAlign: 'center' })} aria-label="Align center" title="Align center" aria-pressed={isActive('textAlign', 'center')}><AlignCenter size={16} /></button>
          <button type="button" onClick={() => setStyle({ textAlign: 'right' })} aria-label="Align right" title="Align right" aria-pressed={isActive('textAlign', 'right')}><AlignRight size={16} /></button>
        </div>

        <span className="format-divider" aria-hidden="true" />

        {isSticky && (
          <>
            <div className="format-swatches surface-swatches" role="group" aria-label="Sticky note color">
              {SURFACE_COLORS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  className="color-swatch"
                  style={{ '--swatch': color.value === 'var(--surface)' ? '#FFFFFF' : color.value }}
                  onClick={() => setStyle({ backgroundColor: color.value, color: color.text })}
                  aria-label={color.label}
                  title={color.label}
                  aria-pressed={surface === color.value}
                />
              ))}
            </div>

            <span className="format-divider" aria-hidden="true" />
          </>
        )}

        <div className="format-group" role="group" aria-label="Text actions">
          <button type="button" onClick={() => onCopy(id)} aria-label="Duplicate text" title="Duplicate"><Copy size={16} /></button>
          <button type="button" className="danger" onClick={() => onDelete(id)} aria-label={isSticky ? 'Delete sticky note' : 'Delete text'} title="Delete"><Trash2 size={16} /></button>
        </div>
      </NodeToolbar>

      <Handle id="top" type="source" position={Position.Top} className="text-handle" />
      <Handle id="top" type="target" position={Position.Top} className="text-handle target-handle" style={{ opacity: 0 }} />
      <Handle id="left" type="source" position={Position.Left} className="text-handle" />
      <Handle id="left" type="target" position={Position.Left} className="text-handle target-handle" style={{ opacity: 0 }} />
      <Handle id="right" type="source" position={Position.Right} className="text-handle" />
      <Handle id="right" type="target" position={Position.Right} className="text-handle target-handle" style={{ opacity: 0 }} />
      <Handle id="bottom" type="source" position={Position.Bottom} className="text-handle" />
      <Handle id="bottom" type="target" position={Position.Bottom} className="text-handle target-handle" style={{ opacity: 0 }} />

      {selected && context.onAddConnectedText && (
        <>
          <button className="flow-add-btn top" onClick={() => context.onAddConnectedText(id, 'top', 'bottom')} aria-label="Add connected note above"><Plus size={14} /></button>
          <button className="flow-add-btn left" onClick={() => context.onAddConnectedText(id, 'left', 'right')} aria-label="Add connected note left"><Plus size={14} /></button>
          <button className="flow-add-btn right" onClick={() => context.onAddConnectedText(id, 'right', 'left')} aria-label="Add connected note right"><Plus size={14} /></button>
          <button className="flow-add-btn bottom" onClick={() => context.onAddConnectedText(id, 'bottom', 'top')} aria-label="Add connected note below"><Plus size={14} /></button>
        </>
      )}

      {isSticky && <div className="sticky-note-heading"><StickyNote size={17} /> <span>S-Note</span></div>}

      <textarea
        ref={textareaRef}
        className="nodrag nowheel"
        value={draft}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={isSticky ? 'Write a sticky note…' : 'Type your instruction…'}
        autoFocus={data.autoFocus}
        aria-label={isSticky ? 'Sticky note text' : 'Intent text'}
        style={style}
      />

      {selected && context.onAddConnectedText && (
        <div className="text-node-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
          <button type="button" onClick={() => context.onAddConnectedText?.(id, 'right', 'left')} className="text-node-action-btn">+ Next</button>
          <button type="button" onClick={() => context.onAddConnectedText?.(id, 'bottom', 'top')} className="text-node-action-btn">+ Branch</button>
        </div>
      )}
    </div>
  );
});
