import React from 'react';
import { X, Image, VideoCamera, File, Globe, BoundingBox, Selection, PencilSimple, Highlighter, Trash } from '@phosphor-icons/react';

export function Tool({ active, disabled, label, icon: Icon, onClick }) {
  return (
    <button 
      className={`tool ${active ? 'active' : ''}`} 
      disabled={disabled} 
      onClick={onClick} 
      aria-label={label} 
      title={label}
    >
      <Icon size={20} weight={active ? 'bold' : 'regular'} />
      <span>{label}</span>
    </button>
  );
}

export function AssetMenu({ pickFile, capturePage, addWebpage, close }) {
  return (
    <div className="popover asset-menu">
      <div className="popover-title">
        <span>Add Asset</span>
        <button onClick={close} aria-label="Close Asset menu"><X size={14} /></button>
      </div>
      <button onClick={() => pickFile('image')}><Image size={19} /> Image</button>
      <button onClick={() => pickFile('video')}><VideoCamera size={19} /> Video</button>
      <button onClick={() => pickFile('document')}><File size={19} /> Document</button>
      <button onClick={addWebpage}><Globe size={19} /> Webpage URL</button>
    </div>
  );
}

export function AnnotMenu({ value, onChange }) {
  return (
    <div className="annot-menu">
      <button className={value === 'annotate' ? 'active' : ''} onClick={() => onChange('annotate')}><Selection size={18} /> Annotate</button>
      <button className={value === 'area' ? 'active' : ''} onClick={() => onChange('area')}><BoundingBox size={18} /> Area</button>
      <button className={value === 'pen' ? 'active' : ''} onClick={() => onChange('pen')}><PencilSimple size={18} /> Pen</button>
      <button className={value === 'highlighter' ? 'active' : ''} onClick={() => onChange('highlighter')}><Highlighter size={18} /> Highlighter</button>
      <button className={value === 'eraser' ? 'active' : ''} onClick={() => onChange('eraser')}><Trash size={18} /> Eraser</button>
    </div>
  );
}
