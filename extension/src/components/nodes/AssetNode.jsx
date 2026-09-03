import React, { memo, useRef, useState, useEffect, useMemo, useContext } from 'react';
import { Handle, Position, NodeToolbar, useUpdateNodeInternals } from '@xyflow/react';
import { X, Crop, Film, Scissors, Route, Pencil, MessageSquareText, LockOpen, Lock, Copy, Trash2, Globe, File, FileText, ExternalLink } from 'lucide-react';
import { formatTime } from '../../utils/helpers';
import { GestureCapture } from '../../../../gesture/runtime/capture.mjs';
import { releasePointerCapture } from '../../../../gesture/runtime/acceptance.mjs';
import { WorkspaceContext } from '../../WorkspaceContext';
import { AssetMotionControls } from './AssetMotionControls.mjs';

export const AssetNode = memo(function AssetNode({ id, data, selected }) {
  const drawing = useRef(null);
  const linking = useRef(null);
  const videoRef = useRef(null);
  const [draft, setDraft] = useState([]);
  const [videoTimeMs, setVideoTimeMs] = useState(0);
  const updateNodeInternals = useUpdateNodeInternals();
  const context = useContext(WorkspaceContext) || {};
  const { mode, annotationTool, onAnnotLinkStart, onAnnotLinkMove, onAnnotLinkEnd, onErase, onAreaAnnotate, onStroke, activeAnchors, onMode, onStartMotion, onResetMotion, onCompleteMotion, onCancelMotion, onExplain, onToggleLock, onCopy, onDelete, onClose, onCrop, onExtractFrame, onEditVideo, onExtractSelection, onViewDocument } = context;
  
  useEffect(() => { 
    updateNodeInternals(id); 
  }, [data.cueAnchors, data.targetAnchors, activeAnchors, id, updateNodeInternals]);
  
  const isAnnotating = mode === 'annotate';
  
  const beginStroke = event => {
    if (!isAnnotating) return;
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
    if (data.kind === 'video' && videoRef.current) {
      videoRef.current.pause();
      point.timeMs = Math.round(videoRef.current.currentTime * 1000);
    }
    if (annotationTool === 'annotate') {
      linking.current = { x: point[0], y: point[1], timeMs: point.timeMs, screenStart: { x: event.clientX, y: event.clientY } };
      onAnnotLinkStart(id, { x: linking.current.x, y: linking.current.y, timeMs: linking.current.timeMs }, linking.current.screenStart);
      const moveLink = moveEvent => onAnnotLinkMove({ x: moveEvent.clientX, y: moveEvent.clientY });
      const endLink = endEvent => {
        const start = linking.current;
        window.removeEventListener('pointermove', moveLink, true);
        window.removeEventListener('pointerup', endLink, true);
        window.removeEventListener('pointercancel', endLink, true);
        if (start) onAnnotLinkEnd(id, { x: start.x, y: start.y, timeMs: start.timeMs }, { x: endEvent.clientX, y: endEvent.clientY }, start.screenStart);
        linking.current = null;
      };
      window.addEventListener('pointermove', moveLink, true);
      window.addEventListener('pointerup', endLink, true);
      window.addEventListener('pointercancel', endLink, true);
      return;
    }
    if (annotationTool === 'erase') { onErase(id, point); return; }
    if (drawing.current) return;
    const capture = new GestureCapture();
    const raw = capture.down(event, rect);
    if (!raw) return;
    drawing.current = capture;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraft(raw.strokes[0].points.map(({ x, y }) => [x, y]));
  };

  const moveStroke = event => {
    if (!isAnnotating || !drawing.current) return;
    event.stopPropagation();
    if (!drawing.current.ownsPointer(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drawing.current.move(event, rect);
    setDraft(drawing.current.active?.stroke.points.map(({ x, y }) => [x, y]) || []);
  };

  const finishStroke = (event, cancelled = false) => {
    if (!isAnnotating || !drawing.current) return;
    event.stopPropagation();
    if (!drawing.current.ownsPointer(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const raw = cancelled ? drawing.current.cancel(event, rect) : drawing.current.up(event, rect);
    releasePointerCapture(event.currentTarget, event.pointerId);
    if (raw && !raw.strokes[0].cancelled && annotationTool !== 'erase' && raw.strokes[0].points.length > 1) {
      if (annotationTool === 'area') {
        const xs = raw.strokes[0].points.map(p => p.x);
        const ys = raw.strokes[0].points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        onAreaAnnotate?.(id, { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, data.kind === 'video' ? videoTimeMs : undefined);
      } else {
        onStroke?.(id, {
          id: crypto.randomUUID(),
          tool: annotationTool || 'draw',
          points: raw.strokes[0].points.map(point => [point.x, point.y]),
          gesture: raw,
          timeMs: data.kind === 'video' ? videoTimeMs : undefined,
        });
      }
    }
    drawing.current = null;
    setDraft([]);
  };

  const cancelStroke = event => finishStroke(event, true);
  const lostPointerCapture = event => finishStroke(event, true);

  const strokePath = points => {
    if (!points || !points.length) return '';
    return points.reduce((path, [x, y], index) => {
      const px = x * 1000;
      const py = y * 640;
      return `${path} ${index === 0 ? 'M' : 'L'} ${px} ${py}`;
    }, '');
  };

  const handlePointerDown = (anchor, event) => {
    event.stopPropagation();
    linking.current = anchor;
  };

  const handlePointerUp = (anchor, event) => {
    event.stopPropagation();
    if (linking.current && linking.current.id !== anchor.id) {
      data.onLink?.(linking.current.id, anchor.id);
    }
    linking.current = null;
  };

  const canRecordMotion = data.kind === 'image' || data.derivedKind === 'video_frame';

  const visibleStrokes = useMemo(() => {
    if (data.kind !== 'video') return data.strokes || [];
    return (data.strokes || []).filter(stroke => stroke.timeMs === undefined || Math.abs(stroke.timeMs - videoTimeMs) <= 1000);
  }, [data.strokes, data.kind, videoTimeMs]);

  const visibleCueAnchors = useMemo(() => {
    if (data.kind !== 'video') return data.cueAnchors || [];
    return (data.cueAnchors || []).filter(anchor => anchor.timeMs === undefined || Math.abs(anchor.timeMs - videoTimeMs) <= 1000);
  }, [data.cueAnchors, data.kind, videoTimeMs]);

  return (
    <div
      className={`asset-node ${selected ? 'selected' : ''} ${data.motion?.active ? 'recording-motion' : ''}`}
      data-testid="asset-node"
    >
      <NodeToolbar className="node-toolbar asset-toolbar" isVisible={selected} position={Position.Top} align="center" offset={8}>
        {data.motion?.active ? (
          <AssetMotionControls
            motion={data.motion}
            onFinish={() => onCompleteMotion(id)}
            onCancel={() => onCancelMotion(id)}
          />
        ) : (
          <>
          {data.kind === 'image' && <button aria-label="Crop" onClick={() => onCrop(id)}><Crop size={20} /></button>}
          {data.kind === 'video' && <button aria-label="Extract Frame" onClick={() => onExtractFrame(id, videoRef.current)}><Film size={20} /></button>}
          {data.kind === 'video' && <button aria-label="Edit Video" onClick={() => onEditVideo(id)}><Scissors size={20} /></button>}
          {data.url && <button aria-label="Extract Selection" onClick={() => onExtractSelection(id, data.url)}><Route size={20} /></button>}
          {data.kind === 'document_page' && <button aria-label="View Document" onClick={() => onViewDocument(id)}><FileText size={20} /></button>}
          {data.url && <a href={data.url} target="_blank" rel="noreferrer" aria-label="Open Source"><ExternalLink size={20} /></a>}
          {canRecordMotion && !isAnnotating && (
            <AssetMotionControls
              motion={data.motion}
              onStart={() => onStartMotion(id)}
              onRemove={() => onResetMotion(id)}
            />
          )}
          {!isAnnotating && <button aria-label="Annotate" onClick={() => onMode('annotate')}><Pencil size={20} /></button>}
          <button aria-label="Explain" onClick={() => onExplain(id)}><MessageSquareText size={20} /></button>
          
          <div className="viscue-separator" />
          <button aria-label={data.locked ? 'Unlock' : 'Lock'} onClick={() => onToggleLock(id)}>
            {data.locked ? <Lock size={20} /> : <LockOpen size={20} />}
          </button>
          <button aria-label="Duplicate" onClick={() => onCopy(id)}><Copy size={20} /></button>
          <button aria-label="Delete" onClick={() => onDelete(id)}><Trash2 size={20} /></button>
          <div className="viscue-separator" />
          <button aria-label="Close" onClick={() => onClose(id)}><X size={20} /></button>
          </>
        )}
      </NodeToolbar>
      <div className="asset-frame">
        {data.kind === 'image' && <img src={data.dataUrl} alt={data.name} draggable="false" />}
        {data.kind === 'video' && <video ref={videoRef} src={data.dataUrl} controls onLoadedMetadata={event => onVideoMetadata(id, event.currentTarget)} onTimeUpdate={event => setVideoTimeMs(Math.round(event.currentTarget.currentTime * 1000))} />}
        {data.kind === 'webpage' && (
          data.dataUrl ? (
            <div className="webpage-preview-wrapper">
              <img src={data.dataUrl} alt={data.name} draggable="false" />
              <a href={data.url} target="_blank" rel="noreferrer" className="webpage-url-badge" title="Open website in new tab" onClick={e => e.stopPropagation()}>
                <Globe size={13} />
                <span>{data.url}</span>
                <ExternalLink size={12} style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.8 }} />
              </a>
            </div>
          ) : (
            <div className="file-preview"><Globe size={38} /><strong>{data.name}</strong><span>{data.url}</span></div>
          )
        )}
        {data.kind === 'document' && <div className="file-preview"><File size={38} /><strong>{data.name}</strong><span>{data.mime || 'Document'}</span></div>}
        <svg className={`annotation-layer nodrag nopan ${mode === 'annotate' ? 'active' : ''}`} viewBox="0 0 1000 640" preserveAspectRatio="none" onPointerDown={beginStroke} onPointerMove={moveStroke} onPointerUp={finishStroke} onPointerCancel={cancelStroke} onLostPointerCapture={lostPointerCapture}>
          {visibleStrokes.map(stroke => <path key={stroke.id} d={strokePath(stroke.points)} className={stroke.tool} />)}
          {draft.length > 1 && annotationTool === 'area' && (
            <rect 
              x={Math.min(draft[0][0], draft[1][0]) * 1000} 
              y={Math.min(draft[0][1], draft[1][1]) * 640} 
              width={Math.abs(draft[1][0] - draft[0][0]) * 1000} 
              height={Math.abs(draft[1][1] - draft[0][1]) * 640} 
              className="area-draft" 
            />
          )}
          {draft.length > 1 && annotationTool !== 'area' && <path d={strokePath(draft)} className={annotationTool} />}
          
          {visibleCueAnchors.map(anchor => anchor.isArea && anchor.area && (
            <rect
              key={`rect-${anchor.id}`}
              x={anchor.area.x * 1000}
              y={anchor.area.y * 640}
              width={anchor.area.width * 1000}
              height={anchor.area.height * 640}
              className="area-anchor-rect"
            />
          ))}
        </svg>
        
        {/* Source Anchors (Outgoing connections) */}
        {visibleCueAnchors.map(anchor => (
          <Handle 
            key={anchor.id} 
            id={anchor.id} 
            type="source" 
            position={Position.Right} 
            className={`cue-handle ${anchor.isWholeAsset ? 'whole-asset-handle' : ''}`} 
            style={{ 
              left: anchor.isWholeAsset ? '50%' : `${anchor.x * 100}%`, 
              top: anchor.isWholeAsset ? '0%' : `${anchor.y * 100}%`,
              opacity: anchor.isWholeAsset ? 0 : 1
            }} 
          />
        ))}
        
        {/* Target Anchors (Incoming connections) */}
        {(data.targetAnchors || []).map(anchor => (
          <Handle 
            key={anchor.id} 
            id={anchor.id} 
            type="target" 
            position={Position.Left} 
            className={`cue-handle ${anchor.isWholeAsset ? 'whole-asset-handle' : 'point-handle'}`} 
            style={{ 
              left: anchor.isWholeAsset ? '50%' : `${anchor.x * 100}%`, 
              top: anchor.isWholeAsset ? '0%' : `${anchor.y * 100}%`,
              opacity: anchor.isWholeAsset ? 0 : 1
            }} 
          />
        ))}
      </div>
      <div className="asset-caption">
        <span>{data.name}</span>
        <small>{data.derivedKind === 'video_frame' ? `${data.provenance?.detached ? 'detached ' : ''}frame · ${formatTime((data.provenance?.timeMs || 0) / 1000)}` : data.kind === 'video' && data.temporalRange ? `${formatTime(data.temporalRange.startMs / 1000)}–${formatTime(data.temporalRange.endMs / 1000)}` : data.kind}</small>
      </div>
    </div>
  );
});
