import { validateRawGesture } from './schema.mjs';

const EPSILON = 1e-12;
const SERIALIZED_DECIMALS = 8;

export const FULL_PRECISION_GEOMETRY = Symbol('fullPrecisionGeometry');

export const GEOMETRY_FEATURE_NAMES = Object.freeze([
  'start_x', 'start_y', 'end_x', 'end_y', 'delta_x', 'delta_y',
  'bbox_min_x', 'bbox_min_y', 'bbox_max_x', 'bbox_max_y',
  'bbox_width', 'bbox_height', 'duration_ms', 'point_count', 'stroke_count',
  'path_length', 'displacement', 'straightness', 'direction_x', 'direction_y',
  'angle_radians', 'mean_speed', 'speed_q25', 'speed_q50', 'speed_q75',
  'max_speed', 'mean_acceleration', 'acceleration_q25', 'acceleration_q50',
  'acceleration_q75', 'max_abs_acceleration', 'mean_abs_curvature',
  'curvature_q25', 'curvature_q50', 'curvature_q75', 'max_abs_curvature',
  'total_abs_turn', 'mean_abs_turn', 'max_abs_turn', 'closure_distance',
  'closure_ratio', 'closed', 'self_intersection_count', 'inter_stroke_distance',
  'inter_stroke_time_ms', 'pressure_mean', 'pressure_present_ratio',
  'cancelled_stroke_count',
]);

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
function stableSum(values) {
  let sum = 0;
  let correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = sum + adjusted;
    correction = (next - sum) - adjusted;
    sum = next;
  }
  return sum;
}
const mean = values => values.length === 0 ? 0 : stableSum(values) / values.length;
const finiteOrZero = value => Number.isFinite(value) ? value : 0;

function quantile(values, probability) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function roundFeature(value) {
  if (typeof value !== 'number') return value;
  const rounded = Number(finiteOrZero(value).toFixed(SERIALIZED_DECIMALS));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function signedTurn(a, b, c) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const firstLength = Math.hypot(ux, uy);
  const secondLength = Math.hypot(vx, vy);
  if (firstLength <= EPSILON || secondLength <= EPSILON) return null;
  return {
    angle: Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy),
    scale: (firstLength + secondLength) / 2,
  };
}

function enclosedArea(points) {
  if (points.length < 3) return 0;
  const crossProducts = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return point.x * next.y - next.x * point.y;
  });
  return Math.abs(stableSum(crossProducts)) / 2;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function strictlyCrosses(a, b, c, d) {
  if (distance(a, b) <= EPSILON || distance(c, d) <= EPSILON) return false;
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return ((first > EPSILON && second < -EPSILON) || (first < -EPSILON && second > EPSILON))
    && ((third > EPSILON && fourth < -EPSILON) || (third < -EPSILON && fourth > EPSILON));
}

function countSelfIntersections(strokes) {
  const segments = [];
  strokes.forEach((stroke, strokeIndex) => {
    for (let index = 1; index < stroke.points.length; index++) {
      segments.push({ a: stroke.points[index - 1], b: stroke.points[index], strokeIndex, segmentIndex: index - 1 });
    }
  });

  let count = 0;
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex++) {
      const first = segments[firstIndex];
      const second = segments[secondIndex];
      if (first.strokeIndex === second.strokeIndex && Math.abs(first.segmentIndex - second.segmentIndex) <= 1) continue;
      if (strictlyCrosses(first.a, first.b, second.a, second.b)) count++;
    }
  }
  return count;
}

export function getFullPrecisionGeometry(geometry) {
  return geometry?.[FULL_PRECISION_GEOMETRY] ?? geometry;
}

export function deriveGeometry(rawGesture) {
  const validation = validateRawGesture(rawGesture);
  if (!validation.ok) throw new TypeError(`Invalid raw gesture: ${validation.error}`);

  const strokes = rawGesture.strokes;
  const points = strokes.flatMap(stroke => stroke.points);
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  const segmentLengths = [];
  const speedSamples = [];
  const turns = [];
  const curvatures = [];

  for (const [strokeIndex, stroke] of strokes.entries()) {
    for (let index = 1; index < stroke.points.length; index++) {
      const previous = stroke.points[index - 1];
      const current = stroke.points[index];
      const length = distance(previous, current);
      const elapsed = current.time_ms - previous.time_ms;
      segmentLengths.push(length);
      if (elapsed > EPSILON) {
        speedSamples.push({
          value: length / elapsed,
          time: (previous.time_ms + current.time_ms) / 2,
          strokeIndex,
        });
      }
    }
    for (let index = 1; index < stroke.points.length - 1; index++) {
      const turn = signedTurn(stroke.points[index - 1], stroke.points[index], stroke.points[index + 1]);
      if (turn === null) continue;
      turns.push(Math.abs(turn.angle));
      curvatures.push(Math.abs(turn.angle) / turn.scale);
    }
  }

  const accelerations = [];
  for (let index = 1; index < speedSamples.length; index++) {
    if (speedSamples[index].strokeIndex !== speedSamples[index - 1].strokeIndex) continue;
    const elapsed = speedSamples[index].time - speedSamples[index - 1].time;
    if (elapsed > EPSILON) accelerations.push((speedSamples[index].value - speedSamples[index - 1].value) / elapsed);
  }

  const interStrokeDistances = [];
  const interStrokeTimes = [];
  for (let index = 1; index < strokes.length; index++) {
    const previousEnd = strokes[index - 1].points.at(-1);
    const currentStart = strokes[index].points[0];
    interStrokeDistances.push(distance(previousEnd, currentStart));
    interStrokeTimes.push(Math.max(0, currentStart.time_ms - previousEnd.time_ms));
  }

  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x));
  const maxY = Math.max(...points.map(point => point.y));
  const deltaX = lastPoint.x - firstPoint.x;
  const deltaY = lastPoint.y - firstPoint.y;
  const displacement = Math.hypot(deltaX, deltaY);
  const pathLength = stableSum(segmentLengths);
  const closureRatio = pathLength > EPSILON ? displacement / pathLength : 0;
  const speedValues = speedSamples.map(sample => sample.value);
  const absoluteAccelerations = accelerations.map(Math.abs);
  const pressureValues = points.filter(point => point.pressure !== null).map(point => point.pressure);
  const totalAbsTurn = stableSum(turns);
  const area = strokes.length === 1 ? enclosedArea(strokes[0].points) : 0;
  const distinctPointCount = points.reduce((count, point, index) => (
    index === 0 || distance(point, points[index - 1]) > EPSILON ? count + 1 : count
  ), 0);

  const fullPrecision = {
    start_x: firstPoint.x,
    start_y: firstPoint.y,
    end_x: lastPoint.x,
    end_y: lastPoint.y,
    delta_x: deltaX,
    delta_y: deltaY,
    bbox_min_x: minX,
    bbox_min_y: minY,
    bbox_max_x: maxX,
    bbox_max_y: maxY,
    bbox_width: maxX - minX,
    bbox_height: maxY - minY,
    duration_ms: Math.max(0, lastPoint.time_ms - firstPoint.time_ms),
    point_count: points.length,
    stroke_count: strokes.length,
    path_length: pathLength,
    displacement,
    straightness: pathLength > EPSILON ? Math.min(1, displacement / pathLength) : 0,
    direction_x: displacement > EPSILON ? deltaX / displacement : 0,
    direction_y: displacement > EPSILON ? deltaY / displacement : 0,
    angle_radians: displacement > EPSILON ? Math.atan2(deltaY, deltaX) : 0,
    mean_speed: mean(speedValues),
    speed_q25: quantile(speedValues, 0.25),
    speed_q50: quantile(speedValues, 0.5),
    speed_q75: quantile(speedValues, 0.75),
    max_speed: speedValues.length === 0 ? 0 : Math.max(...speedValues),
    mean_acceleration: mean(accelerations),
    acceleration_q25: quantile(accelerations, 0.25),
    acceleration_q50: quantile(accelerations, 0.5),
    acceleration_q75: quantile(accelerations, 0.75),
    max_abs_acceleration: absoluteAccelerations.length === 0 ? 0 : Math.max(...absoluteAccelerations),
    mean_abs_curvature: mean(curvatures),
    curvature_q25: quantile(curvatures, 0.25),
    curvature_q50: quantile(curvatures, 0.5),
    curvature_q75: quantile(curvatures, 0.75),
    max_abs_curvature: curvatures.length === 0 ? 0 : Math.max(...curvatures),
    total_abs_turn: totalAbsTurn,
    mean_abs_turn: mean(turns),
    max_abs_turn: turns.length === 0 ? 0 : Math.max(...turns),
    closure_distance: displacement,
    closure_ratio: closureRatio,
    closed: strokes.length === 1 && distinctPointCount >= 3 && pathLength >= 0.02
      && displacement <= 0.05 && closureRatio <= 0.1
      && area > EPSILON && totalAbsTurn > EPSILON,
    self_intersection_count: countSelfIntersections(strokes),
    inter_stroke_distance: mean(interStrokeDistances),
    inter_stroke_time_ms: mean(interStrokeTimes),
    pressure_mean: mean(pressureValues),
    pressure_present_ratio: pressureValues.length / points.length,
    cancelled_stroke_count: strokes.filter(stroke => stroke.cancelled).length,
  };
  Object.defineProperty(fullPrecision, 'strokes', {
    enumerable: false,
    value: strokes.map(stroke => stroke.points.map(point => ({ x: point.x, y: point.y, time_ms: point.time_ms }))),
  });

  const serialized = Object.fromEntries(GEOMETRY_FEATURE_NAMES.map(name => [name, roundFeature(fullPrecision[name])]));
  Object.defineProperty(serialized, FULL_PRECISION_GEOMETRY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze(fullPrecision),
  });
  return serialized;
}
