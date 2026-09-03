import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BaseEdge, MarkerType, Position,
  ReactFlow, ReactFlowProvider, getBezierPath, useEdgesState, useNodesState, useReactFlow, applyNodeChanges,
} from '@xyflow/react';
import {
  ArrowRight, ArrowUUpLeft, ArrowUUpRight, Cursor, PencilSimple, Plus, Selection,
  Sparkle, TextT, X, GridFour, ClockCounterClockwise, Moon, Sun, SpinnerGap
} from '@phosphor-icons/react';
import { X as LucideX } from 'lucide-react';

// Import newly refactored components
import { WorkspaceContext } from './WorkspaceContext';
import { AssetNode } from './components/nodes/AssetNode';
import { TextNode } from './components/nodes/TextNode';
import { CrossAssetEdge } from './components/edges/CrossAssetEdge';
import { CanvasInventoryPanel } from './components/ui/CanvasInventoryPanel';
import { 
  WebDialog, CropDialog, VideoDialog, NewCanvasDialog, 
  HistoryDialog, ConfirmDialog, SendDialog, DocumentDialog, HostClosedDialog
} from './components/dialogs/Dialogs';

import {
  WorkspaceCommandDock,
  WorkspaceDestination,
  WorkspaceEmptyState,
  WorkspaceHistory,
  WorkspaceUtilities,
} from './components/workspace/WorkspaceChrome.mjs';
import { resolvePageCapture, resolveToolbarOption } from './components/workspace/workspaceChromeModel.mjs';
import { createHistoryExport } from './components/workspace/workspaceHistoryModel.mjs';
import { cancelNodeMotion, finishNodeMotion, removeNodeMotion, startNodeMotion } from './components/nodes/motionModel.mjs';
import './components/workspace/WorkspaceChrome.css';
import { fileToDataUrl, normalizeUrl, isValidUrl, safeHost, renderCropDataUrl, captureVideoFrame, digest, downscaleDataUrl, formatTime, createWebpagePreview, cropImageDataUrl } from './utils/helpers';
import { buildVicsucRequest } from './utils/vicsuc';
import { acceptRawGesture } from '../../gesture/runtime/acceptance.mjs';
import { resolveAnnotationCandidate } from '../../gesture/runtime/annotation-policy.mjs';
import { appendGestureOperation, createWorkspaceSnapshot, hydrateWorkspace, resetWorkspace } from '../../gesture/shared/operation-lifecycle.mjs';
import { createOnnxGestureModel } from '../../gesture/runtime/onnx-resolver.mjs';

const initialNodes = [];

const defaultMarkerStart = 'start-dot-marker';
const defaultMarkerEnd = { type: MarkerType.ArrowClosed, color: '#5B7593', width: 18, height: 18 };

const createTextNode = (id, position, variant = 'text') => ({
  id,
  type: 'text',
  position,
  selected: true,
  data: {
    text: '',
    autoFocus: true,
    variant,
    style: {
      fontSize: variant === 'sticky' ? 17 : 19,
      fontWeight: variant === 'sticky' ? 500 : 600,
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      ...(variant === 'sticky' ? {
        color: 'var(--text)',
        backgroundColor: 'var(--sticky-surface)',
      } : {}),
    },
  },
});
const createAnnotationEdge = (source, sourceHandle, target) => ({ id: crypto.randomUUID(), source, sourceHandle, target, targetHandle: 'target', type: 'annotation', markerStart: defaultMarkerStart, markerEnd: defaultMarkerEnd });
const createCrossAssetEdge = (source, sourceHandle, target, targetHandle) => ({ id: crypto.randomUUID(), source, sourceHandle, target, targetHandle, type: 'crossAsset', markerStart: defaultMarkerStart, markerEnd: defaultMarkerEnd, data: { instructionOpen: false, instruction: '' } });

function chromeMessage(message) {
  if (globalThis.chrome?.runtime?.sendMessage) return chrome.runtime.sendMessage(message);
  
  const headers = { 'content-type': 'application/json' };
  const apiKey = import.meta.env.VITE_VISCUE_API_KEY || localStorage.getItem('viscue-api-key') || 'test_local_key_88';
  if (apiKey) headers['authorization'] = `Bearer ${apiKey}`;

  if (message.type === 'health') return fetch('http://127.0.0.1:8787/health', { headers }).then(r => r.json()).catch(() => ({ ok: false }));
  if (message.type === 'compile') return fetch('http://127.0.0.1:8787/compile', { method: 'POST', headers, body: JSON.stringify(message.payload) }).then(r => r.json());
  if (message.type === 'handoff-receipt') return fetch('http://127.0.0.1:8787/handoff-receipt', { method: 'POST', headers, body: JSON.stringify(message.receipt) }).then(r => r.json());
  return Promise.resolve({ ok: true, preview: true });
}

function usePersistentWorkspace(nodes, edges, gestureOperations, setNodes, setEdges, setGestureOperations) {
  const hydrated = useRef(false);
  useEffect(() => {
    const load = globalThis.chrome?.storage?.local
      ? new Promise(resolve => chrome.storage.local.get('viscue-react-workspace', resolve))
      : Promise.resolve({ 'viscue-react-workspace': JSON.parse(localStorage.getItem('viscue-react-workspace') || 'null') });
    load.then(result => {
      const saved = result?.['viscue-react-workspace'];
      if (saved?.nodes || saved?.edges || saved?.gestureOperations) {
        const workspace = hydrateWorkspace(saved);
        setNodes(workspace.nodes);
        setEdges(workspace.edges);
        setGestureOperations(workspace.gestureOperations);
      }
      hydrated.current = true;
    });
  }, [setEdges, setGestureOperations, setNodes]);
  useEffect(() => {
    if (!hydrated.current) return;
    const value = createWorkspaceSnapshot(nodes.map(({ selected, ...node }) => ({ ...node, selected: false })), edges, gestureOperations);
    const timer = setTimeout(() => {
      if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-react-workspace': value });
      else localStorage.setItem('viscue-react-workspace', JSON.stringify(value));
    }, 250);
    return () => clearTimeout(timer);
  }, [nodes, edges, gestureOperations]);
}

function AnnotEdge(props) {
  const [path] = getBezierPath(props);
  return <BaseEdge path={path} markerStart={props.markerStart} markerEnd={props.markerEnd} style={{ stroke: '#5B7593', strokeWidth: 2.5 }} />;
}

const nodeTypes = { asset: AssetNode, text: TextNode };
const edgeTypes = { annotation: AnnotEdge, cue: AnnotEdge, crossAsset: CrossAssetEdge };


const CUE_STATUS_CYCLE = ['Processing', 'Understanding', 'Building'];

function CueProcessingLine({ phase, onMount }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [capsule, setCapsule] = useState(false); // line → capsule morph
  const [exiting, setExiting] = useState(false);

  // Fire onMount and begin the capsule morph after the content collapses
  useEffect(() => {
    onMount?.();
    // After nodes slide away, morph the line into a capsule
    const t1 = setTimeout(() => setCapsule(true), 480);
    return () => clearTimeout(t1);
  }, []);

  // Cycle through status words
  useEffect(() => {
    if (!capsule || phase === 'done' || phase === 'error') return;
    const iv = setInterval(() => setStatusIdx(i => (i + 1) % CUE_STATUS_CYCLE.length), 1400);
    return () => clearInterval(iv);
  }, [capsule, phase]);

  // Trigger exit animation
  useEffect(() => {
    if (phase === 'done' || phase === 'error') {
      setTimeout(() => setExiting(true), 300);
    }
  }, [phase]);

  const isDone = phase === 'done';
  const isError = phase === 'error';
  const isFinished = isDone || isError;

  return (
    <div className={`cue-processing-screen${exiting ? ' cue-processing-screen--exit' : ''}`} aria-live="polite" aria-label="Processing">
      <div className={`cue-capsule-wrap${capsule ? ' cue-capsule-wrap--expanded' : ''}${isError ? ' cue-capsule-wrap--error' : ''}`}>
        <span className={`cue-capsule-text${capsule && !isFinished ? ' cue-capsule-text--visible' : ''}${isFinished ? ' cue-capsule-text--done' : ''}`}>
          {isFinished ? (isDone ? 'Done' : 'Failed') : `${CUE_STATUS_CYCLE[statusIdx]}…`}
        </span>
      </div>
    </div>
  );
}


function AppCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mode, setMode] = useState('select');
  const [annotationTool, setAnnotationTool] = useState('annotate');
  const [textTool, setTextTool] = useState('text');
  const [openChromeMenu, setOpenChromeMenu] = useState(null);
  const [draftAnnot, setDraftAnnot] = useState(null);
  const [health, setHealth] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [theme, setTheme] = useState('light');
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [plan, setPlan] = useState('free');
  const [historyConfig, setHistoryConfig] = useState({ autoDeleteHours: 24 });
  const [persistentHistory, setPersistentHistory] = useState([]);
  const [gestureOperations, setGestureOperations] = useState([]);
  const [platformName, setPlatformName] = useState('ChatGPT');
  const [cueAnimation, setCueAnimation] = useState(null); // null | { phase, nodeRects, submitRef }
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const fileKind = useRef('image');
  const draftLineRef = useRef(null);
  const flow = useReactFlow();
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const sourceTabId = Number(params.get('sourceTab')) || null;

  usePersistentWorkspace(nodes, edges, gestureOperations, setNodes, setEdges, setGestureOperations);
  useEffect(() => { chromeMessage({ type: 'health' }).then(setHealth); }, []);
  useEffect(() => {
    chromeMessage({ type: 'active-context', tabId: sourceTabId }).then(res => {
      if (res?.context?.platform) setPlatformName(res.context.platform);
    }).catch(() => {});

    if (sourceTabId && globalThis.chrome?.tabs?.onRemoved) {
      const handleTabRemoved = (tabId) => {
        if (tabId === sourceTabId) {
          setDialog({ type: 'host-closed' });
        }
      };
      chrome.tabs.onRemoved.addListener(handleTabRemoved);
      return () => chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    }
  }, [sourceTabId]);
  useEffect(() => {
    if (!globalThis.__VISCUE_LOCAL_GESTURE_MODEL__) {
      globalThis.__VISCUE_LOCAL_GESTURE_MODEL__ = createOnnxGestureModel();
    }
  }, []);
  
  useEffect(() => {
    const load = globalThis.chrome?.storage?.local
      ? new Promise(resolve => chrome.storage.local.get(['viscue-history-log', 'viscue-history-config', 'viscue-theme', 'viscue-auto-submit', 'viscue-plan'], resolve))
      : Promise.resolve({
          'viscue-history-log': JSON.parse(localStorage.getItem('viscue-history-log') || '[]'),
          'viscue-history-config': JSON.parse(localStorage.getItem('viscue-history-config') || '{"autoDeleteHours":24}'),
          'viscue-theme': localStorage.getItem('viscue-theme') || 'light',
          'viscue-auto-submit': JSON.parse(localStorage.getItem('viscue-auto-submit') || 'false'),
          'viscue-plan': JSON.parse(localStorage.getItem('viscue-plan') || '"free"')
        });

    load.then(result => {
      const config = result['viscue-history-config'] || { autoDeleteHours: 24 };
      setHistoryConfig(config);
      setTheme(result['viscue-theme'] || 'light');
      setAutoSubmit(Boolean(result['viscue-auto-submit']));
      setPlan(['free', 'pro', 'plus'].includes(result['viscue-plan']) ? result['viscue-plan'] : 'free');
      
      const log = result['viscue-history-log'] || [];
      const cutoff = Date.now() - (config.autoDeleteHours * 60 * 60 * 1000);
      const filtered = log.filter(item => item.timestamp > cutoff);
      
      setPersistentHistory(filtered);
      
      if (filtered.length !== log.length) {
        if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': filtered });
        else localStorage.setItem('viscue-history-log', JSON.stringify(filtered));
      }
    });
  }, []);

  const saveToPersistentHistory = useCallback((currentNodes, currentEdges, currentGestureOperations = gestureOperations) => {
    setPersistentHistory(prev => {
      const workspace = createWorkspaceSnapshot(currentNodes, currentEdges, currentGestureOperations);
      const next = [{ id: crypto.randomUUID(), timestamp: Date.now(), ...workspace }, ...prev];
      if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': next });
      else localStorage.setItem('viscue-history-log', JSON.stringify(next));
      return next;
    });
  }, [gestureOperations]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-theme': nextTheme });
    else localStorage.setItem('viscue-theme', nextTheme);
  };

  const updateHistoryConfig = (hours) => {
    const numHours = Number(hours) || 24;
    const config = { autoDeleteHours: numHours };
    setHistoryConfig(config);
    if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-config': config });
    else localStorage.setItem('viscue-history-config', JSON.stringify(config));
    
    const cutoff = Date.now() - (numHours * 60 * 60 * 1000);
    setPersistentHistory(prev => {
      const filtered = prev.filter(item => {
        const t = typeof item.timestamp === 'number' ? item.timestamp : Date.parse(item.timestamp) || 0;
        return t > cutoff;
      });
      if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': filtered });
      else localStorage.setItem('viscue-history-log', JSON.stringify(filtered));
      return filtered;
    });
  };

  useEffect(() => {
    if (dialog?.type === 'history' && historyConfig?.autoDeleteHours) {
      const numHours = Number(historyConfig.autoDeleteHours) || 24;
      const cutoff = Date.now() - (numHours * 60 * 60 * 1000);
      setPersistentHistory(prev => {
        const filtered = prev.filter(item => {
          const t = typeof item.timestamp === 'number' ? item.timestamp : Date.parse(item.timestamp) || 0;
          return t > cutoff;
        });
        if (filtered.length !== prev.length) {
          if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': filtered });
          else localStorage.setItem('viscue-history-log', JSON.stringify(filtered));
        }
        return filtered;
      });
    }
  }, [dialog?.type, historyConfig]);

  const clearPersistentHistory = () => {
    setPersistentHistory([]);
    if (globalThis.chrome?.storage?.local) chrome.storage.local.remove('viscue-history-log');
    else localStorage.removeItem('viscue-history-log');
  };

  const snapshot = useCallback(() => {
    setHistory(items => [...items.slice(-39), createWorkspaceSnapshot(nodes, edges, gestureOperations)]);
    setFuture([]);
  }, [edges, gestureOperations, nodes]);
  
  const undo = () => { const prior = history.at(-1); if (!prior) return; setFuture(x => [createWorkspaceSnapshot(nodes, edges, gestureOperations), ...x]); setHistory(x => x.slice(0, -1)); const workspace = hydrateWorkspace(prior); setNodes(workspace.nodes); setEdges(workspace.edges); setGestureOperations(workspace.gestureOperations); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory(x => [...x, createWorkspaceSnapshot(nodes, edges, gestureOperations)]); setFuture(x => x.slice(1)); const workspace = hydrateWorkspace(next); setNodes(workspace.nodes); setEdges(workspace.edges); setGestureOperations(workspace.gestureOperations); };

  const deleteNode = useCallback(id => {
    const nodeToDelete = nodes.find(n => n.id === id);
    if (nodeToDelete?.data.locked) return;
    
    snapshot();
    setNodes(items => items
      .filter(node => node.id !== id)
      .map(node => node.data.provenance?.parentId === id
        ? { ...node, data: { ...node.data, provenance: { ...node.data.provenance, detached: true } } }
        : node));
    setEdges(items => items.filter(edge => edge.source !== id && edge.target !== id));
  }, [nodes, setEdges, setNodes, snapshot]);

  const onNodesChangeWithMotion = useCallback((changes) => {
    const positionChanges = new Map(
      changes
        .filter(change => change.type === 'position' && change.position)
        .map(change => [change.id, change]),
    );
    setNodes(nds => {
      const nextNodes = applyNodeChanges(changes, nds);
      return nextNodes.map(n => {
        const change = positionChanges.get(n.id);
        if (change && n.data.motion?.active) {
          const dx = change.position.x - n.data.motion.startPos.x;
          const dy = change.position.y - n.data.motion.startPos.y;
          const timeMs = n.data.motion.startTime ? Date.now() - n.data.motion.startTime : 0;
          const path = n.data.motion.path || [];
          const last = path.at(-1);
          const shouldSample = !last || timeMs - last.timeMs >= 24 || Math.hypot(dx - last.dx, dy - last.dy) >= 6;
          const newPath = path.length === 0
            ? [{ dx: 0, dy: 0, timeMs: 0 }, { dx, dy, timeMs }]
            : shouldSample ? [...path, { dx, dy, timeMs }] : path;
          return {
            ...n,
            data: {
              ...n.data,
              motion: { ...n.data.motion, startTime: n.data.motion.startTime || Date.now(), path: newPath, currentDx: dx, currentDy: dy }
            }
          };
        }
        return n;
      });
    });
  }, [setNodes]);

  const startMotion = useCallback(id => {
    snapshot();
    setNodes(items => items.map(n => n.id === id ? startNodeMotion(n) : n));
  }, [setNodes, snapshot]);

  const stopMotion = useCallback(id => {
    snapshot();
    setNodes(items => items.map(n => n.id === id ? finishNodeMotion(n) : n));
  }, [setNodes, snapshot]);

  const cancelMotion = useCallback(id => {
    snapshot();
    setNodes(items => items.map(n => n.id === id ? cancelNodeMotion(n) : n));
  }, [setNodes, snapshot]);

  const resetMotion = useCallback(id => {
    snapshot();
    setNodes(items => items.map(n => n.id === id ? removeNodeMotion(n) : n));
  }, [setNodes, snapshot]);

  const onExplain = useCallback(id => {
    snapshot();
    const parent = nodes.find(n => n.id === id);
    if (!parent) return;
    const textId = crypto.randomUUID();
    const anchorId = `annot-${crypto.randomUUID()}`;
    const anchor = { id: anchorId, x: 0.5, y: 0.5, isWholeAsset: true };
    const position = { x: parent.position.x + 380, y: parent.position.y };
    setNodes(items => [
      ...items.map(node => node.id === id ? { ...node, selected: false, data: { ...node.data, cueAnchors: [...(node.data.cueAnchors || []), anchor] } } : { ...node, selected: false }),
      { ...createTextNode(textId, position), selected: true }
    ]);
    setEdges(items => [...items, createAnnotationEdge(id, anchorId, textId)]);
  }, [nodes, setNodes, snapshot]);

  const onAreaAnnotate = useCallback((id, area, timeMs) => {
    snapshot();
    const parent = nodes.find(n => n.id === id);
    if (!parent) return;
    const textId = crypto.randomUUID();
    const anchorId = `annot-${crypto.randomUUID()}`;
    const anchor = { id: anchorId, x: area.x + area.width / 2, y: area.y + area.height / 2, isArea: true, area, timeMs };
    const position = { x: parent.position.x + 380, y: parent.position.y + area.y * (parent.measured?.height || 280) };
    setNodes(items => [
      ...items.map(node => node.id === id ? { ...node, selected: false, data: { ...node.data, cueAnchors: [...(node.data.cueAnchors || []), anchor] } } : { ...node, selected: false }),
      { ...createTextNode(textId, position), selected: true }
    ]);
    setEdges(items => [...items, createAnnotationEdge(id, anchorId, textId)]);
  }, [nodes, setNodes, snapshot]);

  const onToggleLock = useCallback(id => {
    snapshot();
    setNodes(items => items.map(n => n.id === id ? { ...n, data: { ...n.data, locked: !n.data.locked } } : n));
  }, [setNodes, snapshot]);

  const onCopy = useCallback(id => {
    snapshot();
    const parent = nodes.find(n => n.id === id);
    if (!parent) return;
    const newId = crypto.randomUUID();
    const newNode = {
      ...parent, id: newId,
      position: { x: parent.position.x + 40, y: parent.position.y + 40 }, selected: true,
      data: { ...parent.data, strokes: [], cueAnchors: [], targetAnchors: [], motion: null }
    };
    setNodes(items => [...items.map(n => ({ ...n, selected: false })), newNode]);
  }, [nodes, setNodes, snapshot]);

  const onClose = useCallback(id => {
    setNodes(items => items.map(n => n.id === id ? { ...n, selected: false } : n));
  }, [setNodes]);

  const setNodeMode = useCallback(next => { 
    setMode(next); 
    setOpenChromeMenu(next === 'annotate' ? 'annotate' : null); 
  }, []);
  // This validates Task 2's raw schema before a completed gesture enters local graph state.
  const onGestureCaptured = useCallback(rawGesture => acceptRawGesture(rawGesture), []);
  const onStroke = useCallback((id, stroke) => {
    const rawGesture = onGestureCaptured(stroke.gesture);
    if (!rawGesture) return;
    // Annotation points are normalized to their source asset. Keep that
    // coordinate system through deterministic local resolution; no model or
    // network endpoint is invoked from this callback.
    const sourceNode = nodes.find(node => node.id === id);
    const semantic = resolveAnnotationCandidate({
      rawGesture,
      nodes: sourceNode ? [{ ...sourceNode, position: { x: 0, y: 0 }, width: 1, height: 1, selected: true }] : [],
      edges: [],
      activeTool: annotationTool,
      canvasMode: mode,
      graph: { operations: [] },
      // A local model must be installed explicitly by the host. Ordinary
      // annotation never manufactures a resolver or emits fallback warnings.
      model: globalThis.__VISCUE_LOCAL_GESTURE_MODEL__,
    });
    if (semantic.operation) setGestureOperations(operations => appendGestureOperation(operations, semantic.operation));
    snapshot();
    setNodes(items => items.map(node => node.id === id ? {
      ...node,
      data: { ...node.data, strokes: [...(node.data.strokes || []), { ...stroke, gesture: rawGesture }] },
    } : node));
  }, [annotationTool, mode, nodes, onGestureCaptured, setNodes, snapshot]);
  const onErase = useCallback((id, point) => {
    snapshot();
    setNodes(items => items.map(node => {
      if (node.id !== id) return node;
      const strokes = node.data.strokes || [];
      if (!strokes.length) return node;
      if (!point) {
        return { ...node, data: { ...node.data, strokes: strokes.slice(0, -1) } };
      }
      
      const eraseRadius = 0.03; // ~3% of coordinate space
      let newStrokes = [];
      strokes.forEach(stroke => {
        let currentSegment = [];
        (stroke.points || []).forEach(p => {
          const dist = Math.hypot(p[0] - point[0], p[1] - point[1]);
          if (dist < eraseRadius) {
            if (currentSegment.length > 0) {
              newStrokes.push({ ...stroke, id: crypto.randomUUID(), points: currentSegment });
              currentSegment = [];
            }
          } else {
            currentSegment.push(p);
          }
        });
        if (currentSegment.length > 0) {
          if (currentSegment.length === (stroke.points || []).length) {
            newStrokes.push(stroke);
          } else {
            newStrokes.push({ ...stroke, id: crypto.randomUUID(), points: currentSegment });
          }
        }
      });
      return { ...node, data: { ...node.data, strokes: newStrokes } };
    }));
  }, [setNodes, snapshot]);
  const updateText = useCallback((id, text) => setNodes(items => items.map(node => node.id === id ? { ...node, data: { ...node.data, text, autoFocus: false } } : node)), [setNodes]);
  const updateTextStyle = useCallback((id, patch) => {
    snapshot();
    setNodes(items => items.map(node => node.id === id ? {
      ...node,
      data: { ...node.data, autoFocus: false, style: { ...(node.data.style || {}), ...patch } },
    } : node));
  }, [setNodes, snapshot]);

  const focusInventoryNode = useCallback((id) => {
    setNodes(items => items.map(node => ({ ...node, selected: node.id === id })));
    requestAnimationFrame(() => flow.fitView({ nodes: [{ id }], padding: 0.6, duration: 180, maxZoom: 1.2 }));
  }, [flow, setNodes]);
  const cropNode = useCallback(id => {
    const node = nodes.find(item => item.id === id);
    if (node?.data.kind === 'image') setDialog({ type: 'crop', id });
  }, [nodes]);
  const editVideo = useCallback(id => { const node = nodes.find(item => item.id === id); if (node?.data.kind === 'video') setDialog({ type: 'video', id }); }, [nodes]);
  const viewDocument = useCallback(id => { const node = nodes.find(item => item.id === id); if (node?.data.kind === 'document') setDialog({ type: 'document', id }); }, [nodes]);
  const onVideoMetadata = useCallback((id, video) => {
    const metadata = { durationMs: Math.round((video.duration || 0) * 1000), resolution: [video.videoWidth || 0, video.videoHeight || 0] };
    setNodes(items => items.map(node => {
      if (node.id !== id || (node.data.video?.durationMs === metadata.durationMs && node.data.video?.resolution?.[0] === metadata.resolution[0] && node.data.video?.resolution?.[1] === metadata.resolution[1])) return node;
      return { ...node, data: { ...node.data, video: metadata } };
    }));
  }, [setNodes]);
  const extractFrame = useCallback(async (id, video) => {
    const parent = nodes.find(item => item.id === id);
    if (!parent || !video?.videoWidth) {
      setResult({ error: 'Play or load the video first, then choose Extract frame.' });
      return;
    }
    setBusy(true);
    try {
      const frame = await captureVideoFrame(video);
      snapshot();
      const childId = crypto.randomUUID();
      const provenance = {
        kind: 'video_frame', parentId: id, parentName: parent.data.name, parentHash: parent.data.hash,
        timeMs: frame.timeMs, frameIndex: frame.frameIndex,
        parentResolution: frame.parentResolution, contentHash: frame.contentHash,
        transform: 'identity_at_frame', detached: false,
      };
      setNodes(items => [
        ...items.map(node => ({ ...node, selected: false })),
        {
          id: childId, type: 'asset', selected: true,
          position: { x: parent.position.x + 410, y: parent.position.y },
          data: {
            kind: 'image', derivedKind: 'video_frame', name: `${parent.data.name} · ${formatTime(frame.timeMs / 1000)}`,
            mime: 'image/png', dataUrl: frame.dataUrl, role: 'Reference', strokes: [], cueAnchors: [], targetAnchors: [], provenance,
          },
        },
      ]);
      setMode('select');
      setDialog(null);
      setResult({ success: `Frame extracted at ${formatTime(frame.timeMs / 1000)}. Ready to edit or annotate.` });
    } catch (error) {
      setResult({ error: error.message || 'The current video frame could not be extracted.' });
    } finally {
      setBusy(false);
    }
  }, [nodes, setNodes, snapshot, setDialog]);

  const extractSelection = useCallback(async (id, url) => {
    try {
      setBusy(true);
      const normalized = normalizeUrl(url);
      const host = safeHost(normalized);
      
      const tabs = await chrome.tabs.query({});
      let targetTab = tabs.find(t => t.url && (t.url.startsWith(normalized) || safeHost(t.url) === host));
      
      if (!targetTab) {
        targetTab = await chrome.tabs.create({ url: normalized, active: true });
        await new Promise((resolve) => {
          const listener = (tabId, info) => {
            if (tabId === targetTab.id && (info.status === 'complete' || info.title)) {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(resolve, 3500);
        });
      } else {
        await chrome.tabs.update(targetTab.id, { active: true });
      }
      
      if (targetTab.windowId) {
        await chrome.windows.update(targetTab.windowId, { focused: true }).catch(() => {});
      }
      
      let selectionRes = null;
      try {
        const [execRes] = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: () => {
            return new Promise((resolve) => {
              const existing = document.getElementById("viscue-selection-overlay");
              if (existing) existing.remove();
              
              const overlay = document.createElement("div");
              overlay.id = "viscue-selection-overlay";
              Object.assign(overlay.style, {
                position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
                zIndex: "2147483647", cursor: "crosshair", background: "rgba(0,0,0,0.38)",
                userSelect: "none"
              });
              
              const cropBox = document.createElement("div");
              Object.assign(cropBox.style, {
                position: "fixed", border: "2px solid #5B7593",
                background: "rgba(91, 117, 147, 0.14)", display: "none", pointerEvents: "none",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.42)"
              });
              
              const bar = document.createElement("div");
              Object.assign(bar.style, {
                position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
                display: "flex", alignItems: "center", gap: "12px", zIndex: "2147483647",
                background: "#1B1A18", color: "#FCFBF9", padding: "10px 18px",
                borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 10px 36px rgba(0,0,0,0.55)",
                fontFamily: "'Instrument Sans', system-ui, -apple-system, sans-serif", fontSize: "13px"
              });
              
              const label = document.createElement("span");
              label.textContent = "Drag to select any area to add to Viscue";
              label.style.fontWeight = "600";
              
              const cancelBtn = document.createElement("button");
              cancelBtn.textContent = "Cancel";
              Object.assign(cancelBtn.style, {
                padding: "7px 15px", background: "rgba(255,255,255,0.14)", color: "#FFFFFF",
                border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600"
              });
              
              const addBtn = document.createElement("button");
              addBtn.textContent = "Add Selection";
              addBtn.disabled = true;
              Object.assign(addBtn.style, {
                padding: "7px 18px", background: "#5B7593", color: "#FFFFFF",
                border: "none", borderRadius: "8px", cursor: "not-allowed", opacity: "0.5",
                fontSize: "12px", fontWeight: "600"
              });
              
              bar.append(label, cancelBtn, addBtn);
              overlay.append(cropBox, bar);
              document.documentElement.appendChild(overlay);
              
              let isDrawing = false;
              let startX = 0, startY = 0, endX = 0, endY = 0;
              
              const onMouseDown = (e) => {
                if (e.target === addBtn || e.target === cancelBtn) return;
                isDrawing = true;
                startX = e.clientX;
                startY = e.clientY;
                endX = startX;
                endY = startY;
                cropBox.style.display = "block";
                cropBox.style.left = startX + "px";
                cropBox.style.top = startY + "px";
                cropBox.style.width = "0px";
                cropBox.style.height = "0px";
              };
              
              const onMouseMove = (e) => {
                if (!isDrawing) return;
                endX = e.clientX;
                endY = e.clientY;
                const left = Math.min(startX, endX);
                const top = Math.min(startY, endY);
                const width = Math.abs(endX - startX);
                const height = Math.abs(endY - startY);
                cropBox.style.left = left + "px";
                cropBox.style.top = top + "px";
                cropBox.style.width = width + "px";
                cropBox.style.height = height + "px";
                
                if (width > 6 && height > 6) {
                  addBtn.disabled = false;
                  addBtn.style.opacity = "1";
                  addBtn.style.cursor = "pointer";
                }
              };
              
              const onMouseUp = () => { isDrawing = false; };
              
              overlay.addEventListener("mousedown", onMouseDown);
              window.addEventListener("mousemove", onMouseMove);
              window.addEventListener("mouseup", onMouseUp);
              
              cancelBtn.onclick = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                overlay.remove();
                resolve({ ok: false });
              };
              
              addBtn.onclick = () => {
                const left = Math.min(startX, endX);
                const top = Math.min(startY, endY);
                const width = Math.abs(endX - startX);
                const height = Math.abs(endY - startY);
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                overlay.remove();
                resolve({
                  ok: true,
                  rect: {
                    x: left,
                    y: top,
                    width,
                    height,
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight
                  }
                });
              };
            });
          }
        });
        selectionRes = execRes?.result;
      } catch (err) {
        selectionRes = await chrome.tabs.sendMessage(targetTab.id, { type: 'start-selection' }).catch(() => null);
      }
      
      if (!selectionRes?.ok || !selectionRes.rect) {
        throw new Error('Selection cancelled.');
      }
      
      const captureRes = await chromeMessage({ type: 'capture-page', tabId: targetTab.id });
      if (!captureRes?.ok || !captureRes.dataUrl) throw new Error('Failed to capture webpage image.');
      
      const currentTab = await chrome.tabs.getCurrent().catch(() => null);
      if (currentTab?.id) {
        await chrome.tabs.update(currentTab.id, { active: true });
        if (currentTab.windowId) await chrome.windows.update(currentTab.windowId, { focused: true }).catch(() => {});
      }
      
      const croppedDataUrl = await cropImageDataUrl(captureRes.dataUrl, selectionRes.rect);
      const hash = await digest(croppedDataUrl);
      
      snapshot();
      const childId = crypto.randomUUID();
      const parent = nodes.find(n => n.id === id);
      const parentPos = parent ? parent.position : { x: innerWidth / 2, y: innerHeight / 2 };
      
      setNodes(items => [
        ...items.map(node => ({ ...node, selected: false })),
        {
          id: childId,
          type: 'asset',
          selected: true,
          position: { x: parentPos.x + 420, y: parentPos.y },
          data: {
            kind: 'image',
            derivedKind: 'webpage_crop',
            name: `${parent?.data?.name || host} Selection`,
            mime: 'image/png',
            dataUrl: croppedDataUrl,
            hash,
            role: 'Reference',
            strokes: [],
            cueAnchors: [],
            targetAnchors: [],
            provenance: {
              kind: 'webpage_crop',
              parentId: id,
              parentUrl: url,
              rect: selectionRes.rect
            }
          }
        }
      ]);
      setMode('select');
      setResult({ success: `Webpage selection added to workspace!` });
    } catch (e) {
      if (e.message !== 'Selection cancelled.') {
        setResult({ error: e.message || 'Could not complete webpage selection.' });
      }
      const currentTab = await chrome.tabs.getCurrent().catch(() => null);
      if (currentTab?.id) await chrome.tabs.update(currentTab.id, { active: true }).catch(() => {});
    } finally {
      setBusy(false);
    }
  }, [nodes, setNodes, snapshot]);

  const onToggleEdgeInstruction = useCallback((id) => {
    snapshot();
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, instructionOpen: !e.data.instructionOpen } } : e));
  }, [setEdges, snapshot]);

  const onChangeEdgeInstruction = useCallback((id, instruction) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, instruction } } : e));
  }, [setEdges]);

  const onDeleteEdgeInstruction = useCallback((id) => {
    snapshot();
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, instructionOpen: false, instruction: '' } } : e));
  }, [setEdges, snapshot]);

  const enrichedEdges = useMemo(() => edges.map(edge => {
    if (edge.type === 'crossAsset') {
      return {
        ...edge,
        data: {
          ...edge.data,
          onToggleInstruction: onToggleEdgeInstruction,
          onChangeInstruction: onChangeEdgeInstruction,
          onDeleteInstruction: onDeleteEdgeInstruction
        }
      };
    }
    return edge;
  }), [edges, onToggleEdgeInstruction, onChangeEdgeInstruction, onDeleteEdgeInstruction]);

  const contextValue = useMemo(() => {
    const activeAnchors = new Set();
    edges.forEach(e => {
      if (e.sourceHandle) activeAnchors.add(e.sourceHandle);
      if (e.targetHandle) activeAnchors.add(e.targetHandle);
    });
    return {
      activeAnchors,
      mode, annotationTool, onDelete: deleteNode, onCrop: cropNode, onEditVideo: editVideo,
      onExtractFrame: extractFrame, onExtractSelection: extractSelection, onViewDocument: viewDocument, onVideoMetadata, onMode: setNodeMode, onStroke, onErase,
      onChange: updateText, onStyleChange: updateTextStyle, onAnnotLinkStart, onAnnotLinkMove, onAnnotLinkEnd, onAreaAnnotate,
      onStartMotion: startMotion, onCompleteMotion: stopMotion, onCancelMotion: cancelMotion, onResetMotion: resetMotion,
      onExplain, onToggleLock, onCopy, onClose
    };
  }, [edges, mode, annotationTool, deleteNode, cropNode, editVideo, extractFrame, extractSelection, viewDocument, onVideoMetadata, setNodeMode, onStroke, onErase, updateText, updateTextStyle, onAnnotLinkStart, onAnnotLinkMove, onAnnotLinkEnd, onAreaAnnotate, startMotion, stopMotion, cancelMotion, resetMotion, onExplain, onToggleLock, onCopy, onClose]);

  function onAnnotLinkStart(nodeId, point, screenPoint) {
    setDraftAnnot({ nodeId, point, start: screenPoint, current: screenPoint });
  }
  function onAnnotLinkMove(screenPoint) {
    if (!draftLineRef.current) return;
    draftLineRef.current.setAttribute('x2', String(screenPoint.x));
    draftLineRef.current.setAttribute('y2', String(screenPoint.y));
  }
  
  function onAnnotLinkEnd(nodeId, point, screenPoint, screenStart) {
    setDraftAnnot(null);
    const distance = Math.hypot(screenPoint.x - screenStart.x, screenPoint.y - screenStart.y);
    if (distance < 36) return setResult({ error: 'Drag the annotation line to where you want the instruction.' });
    snapshot();
    
    const targetPoint = flow.screenToFlowPosition(screenPoint);
    const textId = crypto.randomUUID();
    const sourceAnchor = { id: `annot-${crypto.randomUUID()}`, ...point };
    
    // Check if dropped near or inside another asset for Cross-Asset Annotation
    const padding = 60; // 60px near the image
    const targetNode = nodes.find(n => {
      if (n.id === nodeId || n.type !== 'asset') return false;
      const w = n.measured?.width || 362;
      const h = n.measured?.height || 280;
      return targetPoint.x >= n.position.x - padding && targetPoint.x <= n.position.x + w + padding &&
             targetPoint.y >= n.position.y - padding && targetPoint.y <= n.position.y + h + padding;
    });

    if (targetNode) {
      // Cross Asset Drop
      const w = targetNode.measured?.width || 362;
      const h = targetNode.measured?.height || 280;
      const relX = (targetPoint.x - targetNode.position.x) / w;
      const relY = (targetPoint.y - targetNode.position.y) / h;
      
      // If dropped outside the core image (in the padding) or within 10% of the border, treat it as a Whole Asset selection
      const isWholeAsset = relX < 0.1 || relX > 0.9 || relY < 0.1 || relY > 0.9;
      
      // Clamp coordinates for the anchor just in case
      const clampX = Math.max(0, Math.min(1, relX));
      const clampY = Math.max(0, Math.min(1, relY));
      
      const targetAnchor = { id: `target-${crypto.randomUUID()}`, x: clampX, y: clampY, isWholeAsset };
      
      setNodes(items => items.map(node => {
        if (node.id === nodeId) return { ...node, data: { ...node.data, cueAnchors: [...(node.data.cueAnchors || []), sourceAnchor] } };
        if (node.id === targetNode.id) return { ...node, data: { ...node.data, targetAnchors: [...(node.data.targetAnchors || []), targetAnchor] } };
        return node;
      }));
      
      setEdges(items => [...items, createCrossAssetEdge(nodeId, sourceAnchor.id, targetNode.id, targetAnchor.id)]);
    } else {
      // Standard Drop to Text Note
      const position = flow.screenToFlowPosition({ x: screenPoint.x + 12, y: screenPoint.y - 34 });
      setNodes(items => [...items.map(node => node.id === nodeId ? { ...node, data: { ...node.data, cueAnchors: [...(node.data.cueAnchors || []), sourceAnchor] } } : node), createTextNode(textId, position)]);
      setEdges(items => [...items, createAnnotationEdge(nodeId, sourceAnchor.id, textId)]);
    }
    setMode('select');
  }

  const addText = useCallback((point, variant = textTool) => {
    snapshot();
    setNodes(items => [...items.map(node => ({ ...node, selected: false })), createTextNode(crypto.randomUUID(), point, variant)]);
    setMode('select');
  }, [setNodes, snapshot, textTool]);

  const onPaneClick = useCallback(event => {
    setOpenChromeMenu(null);
    if (mode === 'assets') setMode('select');
    if (mode === 'text') addText(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [mode, addText, flow]);

  function pickFile(kind) {
    fileKind.current = kind;
    fileInput.current.accept = kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : '.pdf,.doc,.docx,.txt,.md,.csv,.ppt,.pptx,.xls,.xlsx';
    fileInput.current.click(); setOpenChromeMenu(null);
  }
  
  async function onFiles(event) {
    const files = [...event.target.files]; if (!files.length) return;
    snapshot();
    const center = flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
    const additions = await Promise.all(files.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      let kind = fileKind.current || 'document';
      if (!fileKind.current) {
        if (file.type.startsWith('image/')) kind = 'image';
        else if (file.type.startsWith('video/')) kind = 'video';
      }
      return {
        id: crypto.randomUUID(), type: 'asset', position: { x: center.x - 180 + index * 36, y: center.y - 130 + index * 36 },
        data: { kind, name: file.name, mime: file.type, dataUrl, hash: await digest(dataUrl), role: 'Reference', strokes: [], cueAnchors: [], targetAnchors: [] },
      };
    }));
    setNodes(items => [...items, ...additions]); event.target.value = ''; setMode('select');
  }

  async function onFolderImport(event) {
    const files = [...event.target.files]; 
    event.target.value = '';
    if (!files.length) return;
    
    // Look for a state file in the folder (either viscue-state.json or workspace.json or similar)
    const stateFile = files.find(f => f.name.endsWith('.json') && (f.name.includes('viscue') || f.name.includes('workspace') || f.name.includes('state')));
    
    if (stateFile) {
      try {
        const text = await stateFile.text();
        const snapshot = JSON.parse(text);
        if (snapshot.nodes) {
          setPersistentHistory(prev => {
            const next = [{ id: crypto.randomUUID(), timestamp: Date.now(), ...snapshot }, ...prev];
            if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': next });
            else localStorage.setItem('viscue-history-log', JSON.stringify(next));
            return next;
          });
          setResult({ success: 'Workspace imported to history.' });
        } else {
          setResult({ error: 'Invalid workspace format in JSON.' });
        }
      } catch (e) {
        setResult({ error: 'Failed to parse workspace state.' });
      }
    } else {
      setResult({ error: 'No workspace JSON found in this folder.' });
    }
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    snapshot();
    
    const position = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    
    const additions = await Promise.all(files.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      let kind = 'document';
      if (file.type.startsWith('image/')) kind = 'image';
      else if (file.type.startsWith('video/')) kind = 'video';
      
      return {
        id: crypto.randomUUID(), type: 'asset', 
        position: { x: position.x - 180 + index * 36, y: position.y - 130 + index * 36 },
        data: { kind, name: file.name, mime: file.type, dataUrl, hash: await digest(dataUrl), role: 'Reference', strokes: [], cueAnchors: [], targetAnchors: [] },
      };
    }));
    setNodes(items => [...items, ...additions]);
    setMode('select');
  }, [flow, snapshot, setNodes, setMode]);
  
  async function addWebpage(url) {
    if (!url) return;
    const normalized = normalizeUrl(url);
    const host = safeHost(normalized);
    snapshot();
    setBusy(true);
    setDialog(null);
    
    let capturedDataUrl = null;
    let pageTitle = host;
    
    try {
      const captureRes = await chromeMessage({ type: 'capture-url', url: normalized });
      if (captureRes?.ok && captureRes.dataUrl) {
        capturedDataUrl = captureRes.dataUrl;
        if (captureRes.title) pageTitle = captureRes.title;
      }
    } catch (e) {
      console.warn('Real-time tab capture fallback:', e);
    } finally {
      setBusy(false);
    }
    
    if (!capturedDataUrl) {
      capturedDataUrl = await createWebpagePreview(normalized);
    }
    
    const hash = await digest(capturedDataUrl);
    const point = flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
    
    setNodes(items => [
      ...items.map(n => ({ ...n, selected: false })),
      {
        id: crypto.randomUUID(),
        type: 'asset',
        selected: true,
        position: { x: point.x - 180, y: point.y - 130 },
        data: {
          kind: 'webpage',
          name: pageTitle || host,
          url: normalized,
          dataUrl: capturedDataUrl,
          hash,
          role: 'Context',
          strokes: [],
          cueAnchors: [],
          targetAnchors: [],
        },
      },
    ]);
    setMode('select');
  }
  
  async function capturePage() {
    setOpenChromeMenu(null); setBusy(true);
    const response = await chromeMessage({ type: 'capture-page', tabId: sourceTabId });
    setBusy(false);
    const capture = resolvePageCapture(response);
    if (!capture.ok) return setResult({ error: capture.error });
    snapshot();
    const point = flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
    const hash = await digest(capture.dataUrl);
    setNodes(items => [...items, { id: crypto.randomUUID(), type: 'asset', position: { x: point.x - 180, y: point.y - 130 }, data: { kind: 'image', name: capture.title || 'Webpage capture', dataUrl: capture.dataUrl, hash, url: capture.url, role: 'Reference', strokes: [], cueAnchors: [], targetAnchors: [] } }]);
  }
  
  const resetCanvas = useCallback(() => {
    const workspace = resetWorkspace();
    setNodes(workspace.nodes);
    setEdges(workspace.edges);
    setGestureOperations(workspace.gestureOperations);
    setHistory([]);
    setFuture([]);
  }, [setEdges, setGestureOperations, setNodes]);

  function clearAll() { if (!nodes.length && !gestureOperations.length) return; setDialog({ type: 'clear' }); }

  function buildGraph() {
    const textById = new Map(nodes.filter(n => n.type === 'text').map(n => [n.id, n.data.text]));
    const assetIds = new Set(nodes.filter(n => n.type === 'asset').map(n => n.id));
    
    // Process crossAsset edges
    const crossAssetConnections = edges
      .filter(e => e.type === 'crossAsset')
      .map(edge => {
        const sourceAsset = nodes.find(n => n.id === edge.source);
        const targetAsset = nodes.find(n => n.id === edge.target);
        const sourceAnchor = sourceAsset?.data.cueAnchors?.find(a => a.id === edge.sourceHandle);
        const targetAnchor = targetAsset?.data.targetAnchors?.find(a => a.id === edge.targetHandle);
        
        return {
          type: 'CROSS_ASSET_ANNOTATION',
          sourceAssetId: edge.source,
          targetAssetId: edge.target,
          instruction: edge.data?.instruction || '',
          sourceX: sourceAnchor?.x,
          sourceY: sourceAnchor?.y,
          sourceIsArea: sourceAnchor?.isArea,
          sourceArea: sourceAnchor?.area,
          targetX: targetAnchor?.x,
          targetY: targetAnchor?.y,
          targetIsWholeAsset: targetAnchor?.isWholeAsset,
          targetIsArea: targetAnchor?.isArea,
          targetArea: targetAnchor?.area
        };
      });

    return {
      destination: params.get('destination') || 'AI chat',
      items: nodes.map(node => node.type === 'text'
        ? { id: node.id, kind: 'note', noteType: node.data.variant === 'sticky' ? 'sticky' : 'text', name: node.data.variant === 'sticky' ? 'Sticky note' : 'Text', text: node.data.text, intentional: Boolean(node.data.text.trim()) }
        : {
          id: node.id, kind: node.data.derivedKind || node.data.kind, visualKind: node.data.kind,
          name: node.data.name, url: node.data.url, role: node.data.role,
          hash: node.data.provenance?.contentHash || node.data.hash || node.data.name, intentional: true,
          annotations: node.data.strokes || [], temporalRange: node.data.temporalRange,
          video: node.data.video, provenance: node.data.provenance,
          detached: Boolean(node.data.provenance?.detached),
          preserved: Boolean(node.data.locked),
        }),
      // Only include standard cues (Asset -> Text)
      cues: edges
        .filter(edge => edge.type !== 'crossAsset')
        .map(edge => {
          const anchor = nodes.find(n => n.id === edge.source)?.data.cueAnchors?.find(a => a.id === edge.sourceHandle);
          return { id: edge.id, assetId: edge.source, noteId: edge.target, instruction: textById.get(edge.target) || '', x: anchor?.x ?? 0.5, y: anchor?.y ?? 0.5, timeMs: anchor?.timeMs, isWholeAsset: anchor?.isWholeAsset, isArea: anchor?.isArea, area: anchor?.area };
        }),
      relations: [
        ...nodes.flatMap(node => {
          const provenance = node.data.provenance;
          if (node.type !== 'asset' || provenance?.kind !== 'video_frame' || provenance.detached || !assetIds.has(provenance.parentId)) return [];
          return [
            { type: 'FRAME_OF', sourceId: node.id, targetId: provenance.parentId },
            { type: 'AT_TIME', sourceId: node.id, targetId: provenance.parentId, timeMs: provenance.timeMs },
          ];
        }),
        ...crossAssetConnections
      ],
      motions: nodes.filter(node => node.data.motion?.path?.length > 1).map(node => ({
        assetId: node.id,
        path: node.data.motion.path
      })),
      operations: gestureOperations.map(operation => ({ ...operation })),
    };
  }
  
  function openSend() {
    const assets = nodes.filter(n => n.type === 'asset');
    if (!assets.length) return setResult({ error: 'Add at least one Asset before sending intent.' });
    
    const hasAnyInstruction = 
      nodes.some(n => n.type === 'text' && n.data?.text?.trim()) || 
      edges.some(e => e.data?.instruction?.trim()) ||
      nodes.some(n => n.type === 'asset' && ((n.data.strokes?.length > 0) || (n.data.motion?.path?.length > 1)));

    if (!hasAnyInstruction) return setResult({ error: 'Please add at least one instruction, drawing, or text note to the workspace before submitting.' });

    const hasEmptyTextNode = nodes.some(n => n.type === 'text' && !n.data?.text?.trim());
    if (hasEmptyTextNode) return setResult({ error: 'Please fill in all empty text notes before submitting.' });

    const hasEmptyEdgeInstruction = edges.some(e => e.type === 'crossAsset' && !e.data?.instruction?.trim());
    if (hasEmptyEdgeInstruction) return setResult({ error: 'Please provide instructions for all point-to-point connections before submitting.' });
    
    const uncontextualized = assets.find(asset => {
      const hasEdges = edges.some(e => e.source === asset.id || e.target === asset.id);
      const hasStrokes = asset.data.strokes?.length > 0;
      const hasMotion = asset.data.motion?.path?.length > 1;
      return !hasEdges && !hasStrokes && !hasMotion;
    });

    if (uncontextualized) {
      return setResult({ error: `Missing context for "${uncontextualized.data.name}" — add an annotation, explanation, or visual instruction before processing.` });
    }

    setResult(null);
    setCueAnimation({ phase: 'fly', submit: autoSubmit });
  }
  
  async function compileAndSend(submit, onPhase) {
    if (busy) return; setBusy(true);
    saveToPersistentHistory(nodes, edges);
    const graph = buildGraph();
    const sessionResponse = await chromeMessage({ type: 'active-context', tabId: sourceTabId });
    const sessionCtx = sessionResponse?.context || { sourceTabId, chatId: `tab-${sourceTabId}` };
    sessionCtx.destinationFingerprint = sessionCtx.fingerprint || `${sessionCtx.platform || graph.destination}:${sessionCtx.chatId}`;

    onPhase?.('compiling');
    const media = {};
    for (const item of graph.items || []) {
      const node = nodes.find(n => n.id === item.id);
      if (!node?.data?.dataUrl) continue;
      if (['image', 'video_frame', 'webpage'].includes(item.kind)) {
        try {
          media[item.id] = { kind: item.kind, dataUrl: await downscaleDataUrl(node.data.dataUrl, 768, 0.78), provenance: item.provenance || null };
        } catch { /* ignored */ }
      } else if (item.kind === 'video' && node.data.dataUrl.length <= 8_000_000) {
        media[item.id] = { kind: 'video', dataUrl: node.data.dataUrl, temporalRange: item.temporalRange || null };
      }
    }
    const response = await chromeMessage({ type: 'compile', payload: buildVicsucRequest(graph, media, { plan }, sessionCtx) });
    if (!response?.ok) { setBusy(false); onPhase?.('error'); setResult({ error: response?.error || 'Compilation failed.' }); setCueAnimation(null); return; }

    onPhase?.('attaching');
    const attachmentById = new Map((response.attachments || []).map(item => [item.id, item]));
    const attachments = await Promise.all(nodes.filter(node => node.type === 'asset' && node.data.dataUrl && attachmentById.has(node.id)).map(async node => ({ id: node.id, name: node.data.name, mime: node.data.mime, stateHash: attachmentById.get(node.id).stateHash, dataUrl: node.data.kind === 'image' && node.data.crop ? await renderCropDataUrl(node.data.dataUrl, node.data.crop) : node.data.dataUrl })));
    const handoff = await chromeMessage({ type: 'handoff', tabId: sourceTabId, prompt: response.final_prompt, attachments, submit, executionId: response.execution_id || response.executionId, destinationFingerprint: response.destination_fingerprint, promptHash: response.prompt_hash });
    setBusy(false);
    if (!handoff?.ok) { onPhase?.('error'); setResult({ error: handoff?.error || 'The destination did not accept the intent.' }); setCueAnimation(null); return; }
    const receipt = await chromeMessage({ type: 'handoff-receipt', receipt: handoff });
    const successMsg = submit ? 'References attached, intent inserted, and submitted.' : 'References attached and intent inserted.';
    setResult({ success: receipt?.ok ? successMsg : `${successMsg} (Failed to save state cache)`, provider: response.provider });
    onPhase?.('done');
    setTimeout(() => setCueAnimation(null), 1200);
  }

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return;
      setOpenChromeMenu(null);
      if (mode === 'assets') setMode('select');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const handleChromeCommand = useCallback(command => {
    setOpenChromeMenu(null);
    if (command === 'select') setNodeMode('select');
    else if (command === 'undo') undo();
    else if (command === 'redo') redo();
    else if (command === 'cue') openSend();
  }, [future, history, nodes, edges, gestureOperations, setNodeMode]);

  const handleChromeMenuChange = useCallback(nextMenu => {
    setOpenChromeMenu(nextMenu);
    if (nextMenu === 'assets') setMode('assets');
    else if (!nextMenu && mode === 'assets') setMode('select');
  }, [mode]);

  const handleChromeOption = useCallback((panel, option) => {
    const intent = resolveToolbarOption(panel, option);
    if (!intent) return;
    setOpenChromeMenu(null);
    if (intent.kind === 'file') pickFile(intent.value);
    else if (intent.kind === 'capture') capturePage();
    else if (intent.kind === 'dialog') setDialog({ type: intent.value });
    else if (intent.kind === 'annotation') {
      setAnnotationTool(intent.value);
      setNodeMode('annotate');
    } else if (intent.kind === 'text') {
      setTextTool(intent.value);
      setNodeMode('text');
    }
  }, [capturePage, pickFile, setNodeMode]);

  return (
    <main className={`app-shell workspace-chrome ${theme}${cueAnimation ? ' cue-sending' : ''}`} data-theme={theme} onDragOver={handleDragOver} onDrop={handleDrop}>
          <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <marker id="start-dot-marker" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <circle cx="4" cy="4" r="4" fill="#5B7593" />
          </marker>
          <marker id="draft-arrow-marker" markerWidth="18" markerHeight="18" refX="9" refY="9" orient="auto-start-reverse">
            <polyline points="0,0 9,4.5 0,9" fill="#5B7593" transform="translate(4.5, 4.5)" />
          </marker>
        </defs>
      </svg>

      <WorkspaceContext.Provider value={contextValue}>
      <ReactFlow 
        colorMode={theme}
        nodes={nodes.map(n => ({ ...n, draggable: !n.data.locked, deletable: !n.data.locked }))} 
        edges={enrichedEdges} 
        onNodesChange={onNodesChangeWithMotion} 
        onEdgesChange={onEdgesChange} 
        nodeTypes={nodeTypes} 
        edgeTypes={edgeTypes} 
        onPaneClick={onPaneClick} 
        onNodeDragStart={snapshot}
        panOnDrag={mode === 'select'}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        panOnScroll={true}
        zoomOnScroll={false}
        nodeExtent={[[-Infinity, 0], [Infinity, Infinity]]}
        selectionMode="partial"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }} 
        minZoom={0.25} 
        maxZoom={2} 
        deleteKeyCode={['Backspace', 'Delete']} 
        proOptions={{ hideAttribution: true }}
        style={{ paddingBottom: '160px', backgroundColor: 'var(--bg-color)' }}
      >
        {showGrid && <Background variant="dots" gap={24} size={1.2} color={theme === 'dark' ? '#2D4358' : '#C8D1DB'} bgColor="transparent" />}
      </ReactFlow>
      {draftAnnot && <svg className="draft-annot-line" aria-hidden="true"><line ref={draftLineRef} x1={draftAnnot.start.x} y1={draftAnnot.start.y} x2={draftAnnot.start.x} y2={draftAnnot.start.y} markerEnd="url(#draft-arrow-marker)" markerStart="url(#start-dot-marker)" /></svg>}
      </WorkspaceContext.Provider>
      <div className="workspace-overlay" style={{ pointerEvents: 'none' }}>
        <WorkspaceDestination label={platformName} />
      </div>

      {!nodes.length && mode === 'select' && <WorkspaceEmptyState onAdd={() => handleChromeMenuChange('assets')} />}

      {result && <div className={`toast ${result.error ? 'error' : 'success'}`}>{result.error || result.success}<button onClick={() => setResult(null)} aria-label="Dismiss message"><LucideX size={14} /></button></div>}

      {showInventory && (
        <CanvasInventoryPanel
          nodes={nodes}
          edges={edges}
          onClose={() => setShowInventory(false)}
          onFocusNode={focusInventoryNode}
          onClearAll={clearAll}
        />
      )}

      <WorkspaceCommandDock
        mode={mode}
        annotationTool={annotationTool}
        textTool={textTool}
        openMenu={openChromeMenu}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        busy={busy}
        onCommand={handleChromeCommand}
        onOption={handleChromeOption}
        onMenuChange={handleChromeMenuChange}
      />
      <WorkspaceUtilities
        theme={theme}
        onThemeToggle={toggleTheme}
        onHistoryOpen={() => setDialog({ type: 'history' })}
        onClose={() => {
          saveToPersistentHistory(nodes, edges);
          window.close();
        }}
      />
      <input ref={fileInput} className="hidden-input" type="file" multiple onChange={onFiles} />
      <input ref={folderInput} className="hidden-input" type="file" webkitdirectory="" directory="" onChange={onFolderImport} />

      {dialog?.type === 'webpage' && <WebDialog close={() => setDialog(null)} submit={addWebpage} />}
      {dialog?.type === 'crop' && (
        <CropDialog 
          node={nodes.find(n => n.id === dialog.id)} 
          close={() => setDialog(null)} 
          save={croppedDataUrl => {
            if (!croppedDataUrl) return setDialog(null);
            snapshot();
            setNodes(items => items.map(n => n.id === dialog.id ? {
              ...n,
              data: { ...n.data, originalDataUrl: n.data.originalDataUrl || n.data.dataUrl, dataUrl: croppedDataUrl, crop: undefined }
            } : n));
            setDialog(null);
          }} 
        />
      )}
      {dialog?.type === 'video' && <VideoDialog node={nodes.find(n => n.id === dialog.id)} close={() => setDialog(null)} extract={video => extractFrame(dialog.id, video)} save={temporalRange => { snapshot(); setNodes(items => items.map(n => n.id === dialog.id ? { ...n, data: { ...n.data, temporalRange } } : n)); setDialog(null); setResult({ success: 'Video segment trimmed successfully.' }); }} />}
      {dialog?.type === 'document' && (
        <DocumentDialog 
          node={nodes.find(n => n.id === dialog.id)} 
          close={() => setDialog(null)} 
          extractPage={(dataUrl, pageNum, provenanceMeta) => {
            snapshot();
            const parent = nodes.find(n => n.id === dialog.id);
            const point = flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
            const childId = crypto.randomUUID();
            const provenance = {
              kind: 'document_page',
              parentId: parent?.id || dialog.id,
              parentName: parent?.data?.name || 'Document',
              parentHash: parent?.data?.hash || '',
              renderedPageId: `page_${String(pageNum).padStart(2, '0')}`,
              canonicalRenderVersion: 'v1',
              ...(provenanceMeta || {}),
              detached: false,
            };
            setNodes(items => [
              ...items.map(n => ({ ...n, selected: false })),
              {
                id: childId,
                type: 'asset',
                selected: true,
                position: { x: parent ? parent.position.x + 410 : point.x - 180, y: parent ? parent.position.y : point.y - 130 },
                data: {
                  kind: 'image',
                  derivedKind: 'document_page',
                  name: `${parent?.data?.name || 'Document'} — Page ${pageNum}`,
                  mime: 'image/png',
                  dataUrl,
                  role: 'Reference',
                  strokes: [],
                  cueAnchors: [],
                  targetAnchors: [],
                  provenance,
                },
              },
            ]);
            setResult({ success: `Page ${pageNum} extracted to canvas.` });
          }}
          extractSection={(sectionTitle, sectionContent) => {
            snapshot();
            const parent = nodes.find(n => n.id === dialog.id);
            const point = flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
            const textId = crypto.randomUUID();
            const textNode = createTextNode(textId, { x: parent ? parent.position.x + 410 : point.x - 180, y: parent ? parent.position.y : point.y - 130 }, 'sticky');
            textNode.data.text = `## ${sectionTitle}\n\n${sectionContent}`;
            setNodes(items => [...items.map(n => ({ ...n, selected: false })), textNode]);
            setResult({ success: `Section "${sectionTitle}" extracted to canvas.` });
          }}
        />
      )}
      {dialog?.type === 'clear' && <NewCanvasDialog close={() => setDialog(null)} saveAndDiscard={() => { saveToPersistentHistory(nodes, edges); resetCanvas(); setDialog(null); }} clearWithoutSaving={() => { resetCanvas(); setDialog(null); }} />}
      {dialog?.type === 'history' && (
        <div className="history-backdrop">
          <WorkspaceHistory
            items={persistentHistory}
            historyConfig={historyConfig}
            onHistoryConfigChange={updateHistoryConfig}
            onClearAll={() => { clearPersistentHistory(); setDialog(null); }}
            onDelete={(id) => {
              setPersistentHistory(prev => {
                const next = prev.filter(item => item.id !== id);
                if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': next });
                else localStorage.setItem('viscue-history-log', JSON.stringify(next));
                return next;
              });
            }}
            onImport={() => {
              if (folderInput.current) folderInput.current.click();
            }}
            onExport={(snapshot) => {
              const payload = createHistoryExport(snapshot);
              const url = URL.createObjectURL(new Blob([payload.contents], { type: payload.mimeType }));
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = payload.filename;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
            onClose={() => setDialog(null)}
            onRestore={(snapshot) => {
              const workspace = hydrateWorkspace(snapshot);
              setNodes(workspace.nodes);
              setEdges(workspace.edges);
              setGestureOperations(workspace.gestureOperations);
              setDialog(null);
            }}
          />
        </div>
      )}
      {dialog?.type === 'send' && <SendDialog graph={buildGraph()} plan={plan} review={dialog.review} busy={busy} submit={dialog.submit} setSubmit={submit => setDialog({ ...dialog, submit })} close={() => !busy && setDialog(null)} action={() => compileAndSend(dialog.submit)} />}
      {dialog?.type === 'host-closed' && <HostClosedDialog saveAndClose={() => { saveToPersistentHistory(nodes, edges); window.close(); }} discardAndClose={() => window.close()} />}
      {!cueAnimation && busy && <div className="busy-chip"><SpinnerGap className="spin" size={18} /> Working…</div>}
      {cueAnimation && (
        <CueProcessingLine
          phase={cueAnimation.phase}
          onMount={() => {
            const onPhase = (p) => setCueAnimation(prev => prev ? { ...prev, phase: p } : null);
            setTimeout(() => compileAndSend(cueAnimation.submit, onPhase), 550);
          }}
        />
      )}
    </main>
  );
}

export default function App() { return <ReactFlowProvider><AppCanvas /></ReactFlowProvider>; }
