/** Deterministic, bounded motor primitives used only by the synthetic simulator. */
const clamp = value => Math.max(0, Math.min(1, value));
const round = value => Number(value.toFixed(8));
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function minimumJerk(t) {
  const u = Math.max(0, Math.min(1, t));
  return u * u * u * (10 + u * (-15 + 6 * u));
}

export function generateBezierPath(p0, p1, p2, p3, steps = 8) {
  const count = Math.max(1, Math.floor(steps));
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count; const mt = 1 - t;
    return { x: mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x, y: mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y };
  });
}

export function applyJitter(points, jitterAmount, prng) {
  let xNoise = 0; let yNoise = 0;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return { ...point };
    xNoise = Math.max(-jitterAmount, Math.min(jitterAmount, xNoise * 0.72 + (prng() - 0.5) * jitterAmount));
    yNoise = Math.max(-jitterAmount, Math.min(jitterAmount, yNoise * 0.72 + (prng() - 0.5) * jitterAmount));
    return { x: clamp(point.x + xNoise), y: clamp(point.y + yNoise) };
  });
}

function normal(prng) {
  const u = Math.max(Number.EPSILON, prng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * prng());
}

function trajectory(anchors, prng, density) {
  const points = [];
  for (let index = 1; index < anchors.length; index++) {
    const start = anchors[index - 1]; const end = anchors[index];
    const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.max(distance(start, end), 0.001);
    const nx = -dy / length; const ny = dx / length;
    const bend = (prng() - 0.5) * Math.min(0.08, length * 0.28);
    const p1 = { x: start.x + dx * 0.28 + nx * bend, y: start.y + dy * 0.28 + ny * bend };
    const p2 = { x: start.x + dx * 0.72 + nx * bend, y: start.y + dy * 0.72 + ny * bend };
    const steps = Math.max(3, Math.min(28, Math.ceil(length * density)));
    for (let step = index === 1 ? 0 : 1; step <= steps; step++) {
      const t = minimumJerk(step / steps); const mt = 1 - t;
      points.push({ x: mt ** 3 * start.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * end.x, y: mt ** 3 * start.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * end.y });
    }
  }
  return points;
}

function boundPointCount(points, maximum = 126) {
  if (points.length <= maximum) return points;
  return Array.from({ length: maximum }, (_, index) => points[Math.round(index * (points.length - 1) / (maximum - 1))]);
}

function pressureFor(device, prng, progress) {
  if (device !== 'stylus') return null;
  return round(clamp(0.42 + 0.2 * Math.sin(progress * Math.PI) + (prng() - 0.5) * 0.08));
}

/** Builds a valid raw stroke from semantic anchors without authoring derived geometry. */
export function motorStroke({ anchors, pointerType, pointerId = 1, startTime = 0, prng, persona = {}, closed = false, cancelled = false, incomplete = false, miss = false }) {
  if (!Array.isArray(anchors) || anchors.length < 2) throw new TypeError('motorStroke requires at least two anchors');
  const device = ['mouse', 'touch', 'stylus'].includes(pointerType) ? pointerType : 'mouse';
  const jitter = Math.max(0, Math.min(0.09, Number(persona.jitter) || 0.015));
  const velocity = Math.max(0.25, Math.min(2.2, Number(persona.velocity) || 1));
  const sampled = applyJitter(boundPointCount(trajectory(anchors, prng, 34 + Math.round(18 / velocity))), jitter, prng);
  if (closed) { const first = sampled[0]; sampled[sampled.length - 1] = { x: clamp(first.x + (prng() - 0.5) * 0.008), y: clamp(first.y + (prng() - 0.5) * 0.008) }; }
  if (miss && sampled.length > 2) { const end = sampled.at(-1); sampled[sampled.length - 1] = { x: clamp(end.x + 0.045), y: clamp(end.y - 0.035) }; }
  const retained = incomplete ? sampled.slice(0, Math.max(2, Math.floor(sampled.length * 0.62))) : sampled;
  let time = Math.max(0, Math.round(startTime)); const points = []; const first = retained[0];
  points.push({ x: round(first.x), y: round(first.y), time_ms: time, pressure: pressureFor(device, prng, 0) });
  const dwell = Math.round(8 + Math.max(0, Number(persona.hesitation) || 0) * 130);
  if (!cancelled && dwell > 10) { time += dwell; points.push({ x: round(first.x), y: round(first.y), time_ms: time, pressure: pressureFor(device, prng, 0) }); }
  if (cancelled) return { stroke: { pointer_id: pointerId, pointer_type: device, button: 0, cancelled: true, points }, nextTime: time };
  for (let index = 1; index < retained.length; index++) {
    const logNormal = Math.exp(normal(prng) * (0.13 + jitter * 1.6));
    time += Math.max(4, Math.round((7 + (1 - index / retained.length) * 2) * logNormal / velocity));
    const point = retained[index]; points.push({ x: round(clamp(point.x)), y: round(clamp(point.y)), time_ms: time, pressure: pressureFor(device, prng, index / (retained.length - 1)) });
  }
  return { stroke: { pointer_id: pointerId, pointer_type: device, button: 0, cancelled: false, points }, nextTime: time };
}
