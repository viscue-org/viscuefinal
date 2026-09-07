const clone = value => typeof globalThis.structuredClone === 'function'
  ? globalThis.structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const list = value => Array.isArray(value) ? value : [];

/** Creates detached workspace state for persistence and undo/redo. */
export function createWorkspaceSnapshot(nodes = [], edges = [], gestureOperations = []) {
  return clone({ nodes: list(nodes), edges: list(edges), gestureOperations: list(gestureOperations) });
}

/**
 * Appends one graph operation while keeping both the list and its entries
 * detached from React state and resolver-owned objects.
 */
export function appendGestureOperation(gestureOperations = [], operation) {
  if (operation === null || typeof operation !== 'object' || Array.isArray(operation)) {
    return clone(list(gestureOperations));
  }
  return clone([...list(gestureOperations), operation]);
}

export function hydrateWorkspace(snapshot = {}) {
  return createWorkspaceSnapshot(snapshot.nodes, snapshot.edges, snapshot.gestureOperations);
}

export function resetWorkspace() {
  return { nodes: [], edges: [], gestureOperations: [] };
}

/** Keep asynchronous interpretation owned by its stroke, so erase/undo cannot leave ghost intent. */
export function attachStrokeResolution(nodes, nodeId, gestureId, operation) {
  return nodes.map(node => node.id !== nodeId ? node : {
    ...node,
    data: { ...node.data, strokes: list(node.data?.strokes).map(stroke =>
      stroke.gesture?.gesture_id === gestureId ? { ...stroke, operation: clone(operation) } : stroke) },
  });
}

export function collectStrokeOperations(nodes) {
  return nodes.flatMap(node => list(node.data?.strokes).flatMap(stroke => stroke.operation ? [clone(stroke.operation)] : []));
}
