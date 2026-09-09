import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BaseEdge, MarkerType, Position,
  ReactFlow, ReactFlowProvider, getBezierPath, useEdgesState, useNodesState, useReactFlow, applyNodeChanges, addEdge,
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
  HistoryDialog, ConfirmDialog, DocumentDialog, HostClosedDialog
} from './components/dialogs/Dialogs';
import { GestureLabDialog } from './components/dialogs/GestureLabDialog';

import {
  WorkspaceCommandDock,
  WorkspaceDestination,
  WorkspaceEmptyState,
  WorkspaceHistory,
  WorkspaceUtilities,
} from './components/workspace/WorkspaceChrome.mjs';
import { resolvePageCapture, resolveToolbarOption } from './components/workspace/workspaceChromeModel.mjs';
import { createHistoryExport, importHistoryArchive } from './components/workspace/workspaceHistoryModel.mjs';
import { cancelNodeMotion, finishNodeMotion, removeNodeMotion, startNodeMotion } from './components/nodes/motionModel.mjs';
import './components/workspace/WorkspaceChrome.css';
import { fileToDataUrl, normalizeUrl, isValidUrl, safeHost, renderCropDataUrl, captureVideoFrame, digest, downscaleDataUrl, formatTime, createWebpagePreview, cropImageDataUrl } from './utils/helpers';
import { buildVicsucRequest } from './utils/vicsuc';
import { validateCueEligibility } from './utils/cueEligibility.mjs';
import { resolveAnnotationTarget } from './utils/annotationTargets.mjs';
import { shouldCloseWorkspace } from '../api/workspaceCompletion.mjs';
import { acceptRawGesture } from '../../gesture/runtime/acceptance.mjs';
import { resolveAnnotationCandidate } from '../../gesture/runtime/annotation-policy.mjs';
import { attachStrokeResolution, collectStrokeOperations, createWorkspaceSnapshot, hydrateWorkspace, resetWorkspace } from '../../gesture/shared/operation-lifecycle.mjs';
import { createOnnxGestureModel } from '../../gesture/runtime/onnx-resolver.mjs';
import { effectiveReferenceLimit, normalizePlatformCapability } from '../../local-server/lib/platform-capabilities.mjs';
import {
  PLATFORM_PLAN_SETUP_KEY,
  PLATFORM_PLAN_STORAGE_KEY,
  platformPlanState,
  preflightVisualAddition,
} from './platformPlanModel.mjs';
import { PlatformPlanDialog } from './components/dialogs/PlatformPlanDialog.mjs';

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
const createFlowEdge = (source, target, sourceHandle, targetHandle) => ({ id: crypto.randomUUID(), source, target, sourceHandle, targetHandle, type: 'flow', markerEnd: defaultMarkerEnd });

function chromeMessage(message) {
  if (globalThis.chrome?.runtime?.sendMessage) return chrome.runtime.sendMessage(message);
  
  const headers = { 'content-type': 'application/json' };
  const apiKey = import.meta.env.VITE_VISCUE_API_KEY || localStorage.getItem('viscue-api-key') || '';
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
const edgeTypes = { annotation: AnnotEdge, cue: AnnotEdge, crossAsset: CrossAssetEdge, flow: AnnotEdge };


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
  const [annotationTargetId, setAnnotationTargetId] = useState(null);
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
  const [platformCapability, setPlatformCapability] = useState(() => normalizePlatformCapability({}, new URLSearchParams(location.search).get('destination') || 'ChatGPT'));
  const [platformSetupLoaded, setPlatformSetupLoaded] = useState(false);
  const [needsPlatformSetup, setNeedsPlatformSetup] = useState(false);
  const [historyConfig, setHistoryConfig] = useState({ autoDeleteHours: 24 });
  const [persistentHistory, setPersistentHistory] = useState([]);
  const [gestureOperations, setGestureOperations] = useState([]);
  const [platformName, setPlatformName] = useState(() => new URLSearchParams(location.search).get('destination') || 'ChatGPT');
  const [cueAnimation, setCueAnimation] = useState(null); // null | { phase, nodeRects, submitRef }
  const preparedCompilationRef = useRef(null);
  const fileInput = useRef(null);
  const zipInput = useRef(null);
  const fileKind = useRef('image');
  const draftLineRef = useRef(null);
  const flow = useReactFlow();
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const sourceTabId = Number(params.get('sourceTab')) || null;
  const referencePolicy = useMemo(() => effectiveReferenceLimit({ viscuePlan: plan, capability: platformCapability }), [plan, platformCapability]);

  useEffect(() => {
    preparedCompilationRef.current = null;
  }, [nodes, edges, gestureOperations]);

  usePersistentWorkspace(nodes, edges, gestureOperations, setNodes, setEdges, setGestureOperations);
  useEffect(() => { chromeMessage({ type: 'health' }).then(setHealth); }, []);
  useEffect(() => {
    Promise.resolve(chromeMessage({ type: 'account-get' })).then(response => {
      if (response?.ok && response?.data?.plan) {
        // Signed-in user: enforce their actual Viscue subscription plan
        const serverPlan = response.data.plan;
        setPlan(['free', 'pro', 'plus'].includes(serverPlan) ? serverPlan : 'plus');
      } else {
        // Not signed in or no plan data: use 'plus' so the destination
        // platform plan (set in Settings) governs the limit, not a
        // hard 2-ref Viscue free cap that would ignore the user's setting.
        setPlan('plus');
      }
    }).catch(() => setPlan('plus'));
  }, []);

  const refreshPlatformPlan = useCallback((targetPlatform = platformName) => {
    const reader = globalThis.chrome?.storage?.local
      ? new Promise(resolve => chrome.storage.local.get([PLATFORM_PLAN_STORAGE_KEY, PLATFORM_PLAN_SETUP_KEY], resolve))
      : Promise.resolve({
          [PLATFORM_PLAN_STORAGE_KEY]: JSON.parse(localStorage.getItem(PLATFORM_PLAN_STORAGE_KEY) || 'null'),
          [PLATFORM_PLAN_SETUP_KEY]: JSON.parse(localStorage.getItem(PLATFORM_PLAN_SETUP_KEY) || 'false')
        });

    reader.then(result => {
      const platformState = platformPlanState(result, targetPlatform);
      setPlatformCapability(platformState.capability);
      setNeedsPlatformSetup(platformState.needsSetup);
      setPlatformSetupLoaded(true);
    });
  }, [platformName]);

  useEffect(() => {
    refreshPlatformPlan(platformName);
  }, [platformName, refreshPlatformPlan]);

  useEffect(() => {
    if (globalThis.chrome?.storage?.onChanged) {
      const listener = (changes, area) => {
        if (area === 'local' && (changes[PLATFORM_PLAN_STORAGE_KEY] || changes[PLATFORM_PLAN_SETUP_KEY])) {
          refreshPlatformPlan(platformName);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } else {
      const listener = (e) => {
        if (e.key === PLATFORM_PLAN_STORAGE_KEY || e.key === PLATFORM_PLAN_SETUP_KEY) {
          refreshPlatformPlan(platformName);
        }
      };
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    }
  }, [platformName, refreshPlatformPlan]);

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
      ? new Promise(resolve => chrome.storage.local.get(['viscue-history-log', 'viscue-history-config', 'viscue-theme', 'viscue-auto-submit', PLATFORM_PLAN_STORAGE_KEY, PLATFORM_PLAN_SETUP_KEY], resolve))
      : Promise.resolve({
          'viscue-history-log': JSON.parse(localStorage.getItem('viscue-history-log') || '[]'),
          'viscue-history-config': JSON.parse(localStorage.getItem('viscue-history-config') || '{"autoDeleteHours":24}'),
          'viscue-theme': localStorage.getItem('viscue-theme') || 'light',
          'viscue-auto-submit': JSON.parse(localStorage.getItem('viscue-auto-submit') || 'false'),
          [PLATFORM_PLAN_STORAGE_KEY]: JSON.parse(localStorage.getItem(PLATFORM_PLAN_STORAGE_KEY) || 'null'),
          [PLATFORM_PLAN_SETUP_KEY]: JSON.parse(localStorage.getItem(PLATFORM_PLAN_SETUP_KEY) || 'false')
        });

    load.then(result => {
      const config = result['viscue-history-config'] || { autoDeleteHours: 24 };
      setHistoryConfig(config);
      setTheme(result['viscue-theme'] || 'light');
      setAutoSubmit(Boolean(result['viscue-auto-submit']));
      refreshPlatformPlan(platformName);
      
      const log = result['viscue-history-log'] || [];
      const cutoff = Date.now() - (config.autoDeleteHours * 60 * 60 * 1000);
      const filtered = log.filter(item => {
        const t = typeof item.timestamp === 'number' ? item.timestamp : Date.parse(item.timestamp) || 0;
        return t > cutoff;
      });
      
      setPersistentHistory(filtered);
      
      if (filtered.length !== log.length) {
        if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': filtered });
        else localStorage.setItem('viscue-history-log', JSON.stringify(filtered));
      }
    });
  }, []);

  const savePlatformPlan = useCallback(async capability => {
    const normalized = normalizePlatformCapability(capability, platformName);
    if (globalThis.chrome?.storage?.local) {
      await chrome.storage.local.set({ [PLATFORM_PLAN_STORAGE_KEY]: normalized, [PLATFORM_PLAN_SETUP_KEY]: true });
    } else {
      localStorage.setItem(PLATFORM_PLAN_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem(PLATFORM_PLAN_SETUP_KEY, 'true');
    }
    setPlatformCapability(normalized);
    setNeedsPlatformSetup(false);
  }, [platformName]);

  const ensureVisualCapacity = useCallback((candidates, currentNodes = nodes) => {
    const decision = preflightVisualAddition({ nodes: currentNodes, candidates, limit: referencePolicy.limit });
    if (decision.ok) return true;
    setResult({ error: `Visual reference limit reached (${decision.current}/${decision.limit}). Change your AI platform plan in Settings or remove a reference.` });
    return false;
  }, [nodes, referencePolicy.limit]);

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
    const parent = nodes.find(n => n.id === id);
    if (!parent) return;
    const newId = crypto.randomUUID();
    const newNode = {
      ...parent, id: newId,
      position: { x: parent.position.x + 40, y: parent.position.y + 40 }, selected: true,
      data: { ...parent.data, strokes: [], cueAnchors: [], targetAnchors: [], motion: null }
    };
    if (parent.type === 'asset' && !ensureVisualCapacity([newNode])) return;
    snapshot();
    setNodes(items => [...items.map(n => ({ ...n, selected: false })), newNode]);
  }, [ensureVisualCapacity, nodes, setNodes, snapshot]);

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
    // Save drawing immediately; local WASM inference may finish asynchronously.
    snapshot();
    setNodes(items => items.map(node => node.id === id ? {
      ...node,
      data: { ...node.data, strokes: [...(node.data.strokes || []), { ...stroke, gesture: rawGesture }] },
    } : node));
    // Annotation points stay normalized to their source asset.
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
    Promise.resolve(semantic).then(({ operation }) => {
      if (operation) setNodes(items => attachStrokeResolution(items, id, rawGesture.gesture_id, operation));
    }).catch(() => { /* Raw drawing remains usable even if local interpretation fails. */ });
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
    if (!ensureVisualCapacity([{ id: 'prospective-video-frame', type: 'asset', data: { kind: 'image', provenance: { parentId: id, detached: false } } }])) return;
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
  }, [ensureVisualCapacity, nodes, setNodes, snapshot, setDialog]);

  const extractSelection = useCallback(async (id, url) => {
    if (!ensureVisualCapacity([{ id: 'prospective-webpage-selection', type: 'asset', data: { kind: 'image', provenance: { parentId: id, detached: false } } }])) return;
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
  }, [ensureVisualCapacity, nodes, setNodes, snapshot]);

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
      wholeImageSourceId: draftAnnot?.point?.isWholeAsset ? draftAnnot.nodeId : null,
      annotationTargetId,
      mode, annotationTool, onDelete: deleteNode, onCrop: cropNode, onEditVideo: editVideo,
      onExtractFrame: extractFrame, onExtractSelection: extractSelection, onViewDocument: viewDocument, onVideoMetadata, onMode: setNodeMode, onStroke, onErase,
      onChange: updateText, onStyleChange: updateTextStyle, onAnnotLinkStart, onAnnotLinkMove, onAnnotLinkEnd, onAreaAnnotate,
      onStartMotion: startMotion, onCompleteMotion: stopMotion, onCancelMotion: cancelMotion, onResetMotion: resetMotion,
      onExplain, onToggleLock, onCopy, onClose, onAddConnectedText
    };
  }, [edges, draftAnnot, annotationTargetId, mode, annotationTool, deleteNode, cropNode, editVideo, extractFrame, extractSelection, viewDocument, onVideoMetadata, setNodeMode, onStroke, onErase, updateText, updateTextStyle, onAnnotLinkStart, onAnnotLinkMove, onAnnotLinkEnd, onAreaAnnotate, startMotion, stopMotion, cancelMotion, resetMotion, onExplain, onToggleLock, onCopy, onClose, onAddConnectedText]);

  function onAnnotLinkStart(nodeId, point, screenPoint) {
    setDraftAnnot({ nodeId, point, start: screenPoint, current: screenPoint });
  }
  function onAnnotLinkMove(sourceId, screenPoint, sourcePoint) {
    if (!draftLineRef.current) return;
    draftLineRef.current.setAttribute('x2', String(screenPoint.x));
    draftLineRef.current.setAttribute('y2', String(screenPoint.y));
    if (sourcePoint?.isWholeAsset) {
      const target = resolveAnnotationTarget(nodes, sourceId, flow.screenToFlowPosition(screenPoint), { preciseTarget: true });
      setAnnotationTargetId(target?.node.id || null);
    }
  }
  
  function onAddConnectedText(sourceId, sourceHandle, direction = 'right') {
    snapshot();
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return;
    
    const textId = crypto.randomUUID();
    const targetHandle = direction === 'right' ? 'left' : direction === 'left' ? 'right' : direction === 'bottom' ? 'top' : 'bottom';
    
    const offset = { x: 0, y: 0 };
    if (direction === 'right') offset.x = 280;
    else if (direction === 'left') offset.x = -280;
    else if (direction === 'bottom') offset.y = 120;
    else if (direction === 'top') offset.y = -120;

    const position = {
      x: sourceNode.position.x + offset.x,
      y: sourceNode.position.y + offset.y
    };
    
    setNodes(items => [...items.map(node => ({ ...node, selected: false })), createTextNode(textId, position, sourceNode.data.variant)]);
    setEdges(items => [...items, createFlowEdge(sourceId, textId, sourceHandle, targetHandle)]);
  }

  function onConnect(params) {
    // Reject self-connections
    if (params.source === params.target) return;
    
    // Determine connection type
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    if (!sourceNode || !targetNode) return;
    
    let type = 'flow';
    if (sourceNode.type === 'asset' && targetNode.type === 'text') {
      type = 'annotation';
    } else if (sourceNode.type === 'asset' && targetNode.type === 'asset') {
      type = 'crossAsset';
    } else if (sourceNode.type === 'text' && targetNode.type === 'asset') {
      type = 'flow'; // Text applies to visual
    }
    
    setEdges(eds => addEdge({ ...params, type, markerEnd: defaultMarkerEnd }, eds));
  }

  function onAnnotLinkEnd(nodeId, point, screenPoint, screenStart) {
    setDraftAnnot(null);
    setAnnotationTargetId(null);
    const distance = Math.hypot(screenPoint.x - screenStart.x, screenPoint.y - screenStart.y);
    if (distance < 36) return setResult({ error: 'Drag the annotation line to where you want the instruction.' });
    snapshot();
    
    const targetPoint = flow.screenToFlowPosition(screenPoint);
    const textId = crypto.randomUUID();
    const sourceAnchor = { id: `annot-${crypto.randomUUID()}`, ...point };
    
    // Check if dropped near or inside another asset for Cross-Asset Annotation
    const padding = 60; // 60px near the image
    const resolvedTarget = resolveAnnotationTarget(nodes, nodeId, targetPoint, {
      padding,
      preciseTarget: point.isWholeAsset === true,
    });
    const targetNode = resolvedTarget?.node;

    if (targetNode) {
      // Cross Asset Drop
      const targetAnchor = { id: `target-${crypto.randomUUID()}`, ...resolvedTarget.anchor };
      
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
    const additionsMeta = files.map(file => {
      let kind = fileKind.current || 'document';
      if (!fileKind.current) {
        if (file.type.startsWith('image/')) kind = 'image';
        else if (file.type.startsWith('video/')) kind = 'video';
      }
      return { id: crypto.randomUUID(), kind };
    });
    if (!ensureVisualCapacity(additionsMeta.map(item => ({ id: item.id, type: 'asset', data: { kind: item.kind } })))) {
      event.target.value = '';
      return;
    }
    snapshot();
    const center = flow.screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 });
    const additions = await Promise.all(files.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      const { id, kind } = additionsMeta[index];
      return {
        id, type: 'asset', position: { x: center.x - 180 + index * 36, y: center.y - 130 + index * 36 },
        data: { kind, name: file.name, mime: file.type, dataUrl, hash: await digest(dataUrl), role: 'Reference', strokes: [], cueAnchors: [], targetAnchors: [] },
      };
    }));
    setNodes(items => [...items, ...additions]); event.target.value = ''; setMode('select');
  }

  async function onZipImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const snapshot = await importHistoryArchive(new Uint8Array(buffer));
      const newHistoryItem = {
        ...snapshot,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        importedAt: Date.now(),
      };
      setPersistentHistory(prev => {
        const next = [newHistoryItem, ...prev];
        if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': next });
        else localStorage.setItem('viscue-history-log', JSON.stringify(next));
        return next;
      });
      setResult({ success: 'Workspace archive imported to history.' });
    } catch (err) {
      setResult({ error: err.message || 'Failed to import workspace archive.' });
    } finally {
      setBusy(false);
    }
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    const additionsMeta = files.map(file => ({
      id: crypto.randomUUID(),
      kind: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
    }));
    if (!ensureVisualCapacity(additionsMeta.map(item => ({ id: item.id, type: 'asset', data: { kind: item.kind } })))) return;
    snapshot();
    
    const position = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    
    const additions = await Promise.all(files.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      const { id, kind } = additionsMeta[index];
      
      return {
        id, type: 'asset', 
        position: { x: position.x - 180 + index * 36, y: position.y - 130 + index * 36 },
        data: { kind, name: file.name, mime: file.type, dataUrl, hash: await digest(dataUrl), role: 'Reference', strokes: [], cueAnchors: [], targetAnchors: [] },
      };
    }));
    setNodes(items => [...items, ...additions]);
    setMode('select');
  }, [ensureVisualCapacity, flow, snapshot, setNodes, setMode]);
  
  async function addWebpage(url) {
    if (!url) return;
    if (!ensureVisualCapacity([{ id: 'prospective-webpage', type: 'asset', data: { kind: 'webpage' } }])) return;
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
    if (!ensureVisualCapacity([{ id: 'prospective-page-capture', type: 'asset', data: { kind: 'image' } }])) return;
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
        ? { id: node.id, kind: 'note', noteType: node.data.variant === 'sticky' ? 'sticky' : 'text', name: node.data.variant === 'sticky' ? 'Sticky note' : 'Text', text: node.data.text || '', intentional: Boolean(node.data.text?.trim()) }
        : {
          id: node.id, kind: node.data.derivedKind === 'video_frame' ? 'video_frame' : (node.data.kind || 'image'), visualKind: node.data.kind || 'image',
          name: node.data.name || 'Visual Reference', url: node.data.url, role: node.data.role,
          hash: node.data.provenance?.contentHash || node.data.hash || node.data.name, intentional: true,
          annotations: node.data.strokes || [], temporalRange: node.data.temporalRange,
          video: node.data.video, provenance: node.data.provenance || undefined,
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
        ...crossAssetConnections,
        ...edges.filter(e => e.type === 'flow').map(e => ({ type: 'FLOWS_TO', sourceId: e.source, targetId: e.target }))
      ],
      motions: nodes.filter(node => node.data.motion?.path?.length > 1).map(node => ({
        assetId: node.id,
        path: node.data.motion.path
      })),
      operations: [...gestureOperations.map(operation => ({ ...operation })), ...collectStrokeOperations(nodes)],
    };
  }
  
  function openSend() {
    const assets = nodes.filter(n => n.type === 'asset');
    const eligibility = validateCueEligibility(nodes, edges);
    if (!eligibility.ok) return setResult({ error: eligibility.error });
    
    const hasAnyInstruction = 
      nodes.some(n => n.type === 'text' && n.data?.text?.trim()) || 
      edges.some(e => e.data?.instruction?.trim()) ||
      nodes.some(n => n.type === 'asset' && ((n.data.strokes?.length > 0) || (n.data.motion?.path?.length > 1)));

    if (!hasAnyInstruction) return setResult({ error: 'Please add at least one instruction, drawing, or text note to the workspace before submitting.' });

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
    if (busy) return;
    setBusy(true);
    saveToPersistentHistory(nodes, edges);
    const graph = buildGraph();
    const sessionResponse = await chromeMessage({ type: 'active-context', tabId: sourceTabId });
    const sessionCtx = sessionResponse?.context || { sourceTabId, chatId: `tab-${sourceTabId}` };
    sessionCtx.destinationFingerprint = sessionCtx.fingerprint || `${sessionCtx.platform || graph.destination}:${sessionCtx.chatId}`;

    const isNewChat = Boolean(
      sessionCtx.isNewChat ||
      sessionCtx.chatId === 'new' ||
      sessionCtx.chatId === '/' ||
      sessionCtx.rawChatId === 'new' ||
      sessionCtx.rawChatId === '/' ||
      !sessionCtx.chatId ||
      String(sessionCtx.destinationFingerprint).endsWith(':new') ||
      String(sessionCtx.destinationFingerprint).endsWith(':/') ||
      String(sessionCtx.destinationFingerprint).endsWith(':/app') ||
      String(sessionCtx.destinationFingerprint).endsWith(':/new')
    );
    sessionCtx.isNewChat = isNewChat;

    if (!isNewChat && globalThis.chrome?.storage?.local) {
      const realChatId = sessionCtx.rawChatId || sessionCtx.chatId;
      const keys = [
        `viscue-chat-state-${sessionCtx.destinationFingerprint}`,
        sessionCtx.platform && realChatId ? `viscue-chat-state-${sessionCtx.platform}:${realChatId}` : null,
      ].filter(Boolean);
      const res = await chrome.storage.local.get(keys);
      sessionCtx.previousState = res[`viscue-chat-state-${sessionCtx.destinationFingerprint}`] ||
        (sessionCtx.platform && realChatId ? res[`viscue-chat-state-${sessionCtx.platform}:${realChatId}`] : null) ||
        undefined;
    } else {
      sessionCtx.previousState = undefined;
    }

    onPhase?.('compiling');
    const media = {};
    await Promise.all((graph.items || []).map(async item => {
      const node = nodes.find(n => n.id === item.id);
      if (!node?.data?.dataUrl) return;
      if (['image', 'video_frame', 'webpage'].includes(item.kind)) {
        try {
          media[item.id] = { kind: item.kind, dataUrl: await downscaleDataUrl(node.data.dataUrl, 768, 0.78), provenance: item.provenance || null };
        } catch { /* ignored */ }
      } else if (item.kind === 'video' && node.data.dataUrl.length <= 8_000_000) {
        media[item.id] = { kind: 'video', dataUrl: node.data.dataUrl, temporalRange: item.temporalRange || null };
      }
    }));

    const response = await chromeMessage({ type: 'compile', payload: buildVicsucRequest(graph, media, { plan }, sessionCtx, platformCapability) });
    if (!response?.ok) {
      setBusy(false);
      onPhase?.('error');
      setResult({ error: response?.error || 'Compilation failed.' });
      setCueAnimation(null);
      return;
    }

    onPhase?.('attaching');
    const attachmentById = new Map((response.attachments || []).map(item => [item.id, item]));
    const attachments = await Promise.all(
      nodes
        .filter(node => node.type === 'asset' && node.data.dataUrl && attachmentById.has(node.id))
        .map(async node => ({
          id: node.id,
          name: node.data.name,
          mime: node.data.mime,
          stateHash: attachmentById.get(node.id).stateHash,
          dataUrl: node.data.kind === 'image' && node.data.crop ? await renderCropDataUrl(node.data.dataUrl, node.data.crop) : node.data.dataUrl,
        }))
    );
    const promptHash = response.prompt_hash || response.promptHash || response.data?.promptHash;
    const handoff = await chromeMessage({
      type: 'handoff',
      tabId: sourceTabId,
      prompt: response.final_prompt,
      attachments,
      submit,
      executionId: response.execution_id || response.executionId,
      destinationFingerprint: response.destination_fingerprint,
      promptHash,
    });
    setBusy(false);
    if (!handoff?.ok) {
      onPhase?.('error');
      setResult({ error: handoff?.error || 'The destination did not accept the intent.' });
      setCueAnimation(null);
      return;
    }
    const receipt = await chromeMessage({ type: 'handoff-receipt', receipt: handoff });
    const prevAttachedCount = (sessionCtx.previousState?.sent_attachment_hashes || sessionCtx.previousState?.attachment_state_hashes || []).length;
    let successMsg;
    if (attachments.length) {
      successMsg = submit
        ? `Attached ${attachments.length} new reference${attachments.length === 1 ? '' : 's'}${prevAttachedCount ? ` (${prevAttachedCount} prior reference${prevAttachedCount === 1 ? '' : 's'} already in chat)` : ''}, inserted intent, and submitted.`
        : `Attached ${attachments.length} new reference${attachments.length === 1 ? '' : 's'}${prevAttachedCount ? ` (${prevAttachedCount} prior reference${prevAttachedCount === 1 ? '' : 's'} already in chat)` : ''} and inserted intent.`;
    } else if (prevAttachedCount) {
      successMsg = submit
        ? `Refinement sent (referencing ${prevAttachedCount} prior reference${prevAttachedCount === 1 ? '' : 's'} without duplicate uploads).`
        : `Refinement prepared (referencing ${prevAttachedCount} prior reference${prevAttachedCount === 1 ? '' : 's'} without duplicate uploads).`;
    } else {
      successMsg = submit ? 'Text intent inserted and submitted.' : 'Text intent inserted for review.';
    }
    setResult({ success: receipt?.ok ? successMsg : `${successMsg} (Failed to save state cache)`, provider: response.provider });
    onPhase?.('done');
    if (shouldCloseWorkspace(handoff, receipt)) {
      setTimeout(() => chromeMessage({ type: 'complete-workspace', sourceTabId }), 900);
    } else {
      setTimeout(() => setCueAnimation(null), 1200);
    }
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
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        panOnScroll={true}
        zoomOnScroll={false}
        onConnect={onConnect}
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
      <input ref={zipInput} className="hidden-input" type="file" accept=".zip,application/zip" onChange={onZipImport} />

      {platformSetupLoaded && needsPlatformSetup && (
        <PlatformPlanDialog
          platformName={platformName}
          initialCapability={platformCapability}
          viscuePlan={plan}
          onSave={savePlatformPlan}
        />
      )}
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
            const parent = nodes.find(n => n.id === dialog.id);
            if (!ensureVisualCapacity([{ id: 'prospective-document-page', type: 'asset', data: { kind: 'image', provenance: { parentId: parent?.id || dialog.id, detached: false } } }])) return;
            snapshot();
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
            onDelete={(id) => {
              setPersistentHistory(prev => {
                const next = prev.filter(item => item.id !== id);
                if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ 'viscue-history-log': next });
                else localStorage.setItem('viscue-history-log', JSON.stringify(next));
                return next;
              });
            }}
            onImport={() => {
              if (zipInput.current) zipInput.current.click();
            }}
            onExport={async (snapshot) => {
              setBusy(true);
              try {
                const payload = await createHistoryExport(snapshot);
                const url = URL.createObjectURL(new Blob([payload.contents], { type: payload.mimeType }));
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = payload.filename;
                anchor.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                setResult({ error: err.message || 'Failed to export workspace.' });
              } finally {
                setBusy(false);
              }
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
      {dialog?.type === 'host-closed' && <HostClosedDialog saveAndClose={() => { saveToPersistentHistory(nodes, edges); window.close(); }} discardAndClose={() => window.close()} />}
      {dialog?.type === 'gesture-lab' && <GestureLabDialog close={() => setDialog(null)} />}
      {!cueAnimation && busy && <div className="busy-chip"><SpinnerGap className="spin" size={18} /> Preparing intent…</div>}
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
