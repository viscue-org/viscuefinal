import { deriveGeometry } from '../shared/geometry.mjs';
import { hitTestGesture } from '../shared/hit-testing.mjs';
import { projectRuntimeContext } from '../shared/context.mjs';
import { buildModelInputs } from '../shared/features.mjs';
import { bindResolvedGesture } from '../shared/binding.mjs';
import { createAbstention, resolveGesture } from './resolver.mjs';

function preflightResolution(geometry) {
  if (geometry.cancelled_stroke_count > 0) return createAbstention('invalid_input', 'gesture-preflight/1');
  if (geometry.path_length < 0.003 && geometry.duration_ms <= 10) {
    return createAbstention('invalid_input', 'gesture-preflight/1');
  }
  return null;
}

function constrainResolution(resolution, activeTool) {
  if (activeTool === 'annotate' && resolution.accepted && resolution.family !== 'markup') {
    return createAbstention('ood', resolution.model_version || 'gesture-preflight/1');
  }
  return resolution;
}

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
  const resolution = preflightResolution(geometry) || resolveGesture(inputs, { model });
  const finish = rawResolution => {
    const constrainedResolution = constrainResolution(rawResolution, activeTool);
    order.push('resolve');
    let operation;
    if (constrainedResolution.accepted) {
      operation = bindResolvedGesture(constrainedResolution, hits.binding);
    } else {
      operation = Object.freeze({
        unresolved: true,
        resolution: Object.freeze({ ...constrainedResolution, alternatives: [...constrainedResolution.alternatives] }),
      });
    }
    order.push('bind');
    const operations = [...(Array.isArray(graph.operations) ? graph.operations : []), operation];
    const resolvedGraph = { ...graph, operations };
    order.push('graph');
    return Object.freeze({ rawGesture, geometry, hits, canvasContext, inputs, resolution: constrainedResolution, operation, graph: resolvedGraph, order: Object.freeze(order) });
  };
  return resolution && typeof resolution.then === 'function' ? resolution.then(finish) : finish(resolution);
}
