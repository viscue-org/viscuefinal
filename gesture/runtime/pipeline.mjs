import { deriveGeometry } from '../shared/geometry.mjs';
import { hitTestGesture } from '../shared/hit-testing.mjs';
import { projectRuntimeContext } from '../shared/context.mjs';
import { buildModelInputs } from '../shared/features.mjs';
import { bindResolvedGesture } from '../shared/binding.mjs';
import { resolveGesture } from './resolver.mjs';

/**
 * Runs the local, no-network gesture path. `capture` is recorded because its
 * already schema-valid raw gesture is supplied by GestureCapture in the UI.
 */
export function processGestureCandidate({ rawGesture, nodes = [], edges = [], activeTool = 'unknown', canvasMode = 'unknown', graph = {}, model = null } = {}) {
  const order = ['capture'];
  const geometry = deriveGeometry(rawGesture);
  order.push('geometry');
  const hits = hitTestGesture(geometry, nodes, edges);
  const canvasContext = projectRuntimeContext({
    raw_gesture: rawGesture, geometry, nodes, edges, active_tool: activeTool, canvas_mode: canvasMode,
  }, hits);
  const inputs = buildModelInputs({ strokes: rawGesture.strokes, geometry, canvasContext, nodes });
  order.push('features');
  const resolution = resolveGesture(inputs, { model });
  order.push('resolve');
  let operation;
  if (resolution.accepted) {
    operation = bindResolvedGesture(resolution, hits.binding);
  } else {
    operation = Object.freeze({
      unresolved: true,
      resolution: Object.freeze({ ...resolution, alternatives: [...resolution.alternatives] }),
    });
  }
  order.push('bind');
  const operations = [...(Array.isArray(graph.operations) ? graph.operations : []), operation];
  const resolvedGraph = { ...graph, operations };
  order.push('graph');
  return Object.freeze({ rawGesture, geometry, hits, canvasContext, inputs, resolution, operation, graph: resolvedGraph, order: Object.freeze(order) });
}
