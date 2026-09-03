import { SCHEMA_VERSIONS } from '../shared/contracts.mjs';

const MIN_SAMPLE_INTERVAL_MS = 8;
const MIN_SAMPLE_DISTANCE = 0.002;
const MAX_STROKES = 4;
const MAX_POINTS = 128;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);

const eventTimestamp = (event, now) => finite(event?.timeStamp) ? event.timeStamp : now();

const modifiersFrom = event => ({
  alt: Boolean(event?.altKey),
  ctrl: Boolean(event?.ctrlKey),
  meta: Boolean(event?.metaKey),
  shift: Boolean(event?.shiftKey),
});

const pointerTypeFrom = event => event?.pointerType === 'pen' || event?.pointerType === 'stylus'
  ? 'stylus'
  : event?.pointerType === 'touch'
    ? 'touch'
    : 'mouse';

const buttonFrom = event => Number.isInteger(event?.button) && event.button >= 0 && event.button <= 5
  ? event.button
  : 0;

const samePoint = (left, right) => left.x === right.x
  && left.y === right.y
  && left.time_ms === right.time_ms
  && left.pressure === right.pressure;

export function pointerPoint(event, rect, startedAt) {
  const width = finite(rect?.width) && rect.width > 0 ? rect.width : 1;
  const height = finite(rect?.height) && rect.height > 0 ? rect.height : 1;
  const left = finite(rect?.left) ? rect.left : 0;
  const top = finite(rect?.top) ? rect.top : 0;
  const timestamp = finite(event?.timeStamp) ? event.timeStamp : startedAt;

  return {
    x: clamp((Number(event?.clientX) - left) / width || 0, 0, 1),
    y: clamp((Number(event?.clientY) - top) / height || 0, 0, 1),
    time_ms: Math.max(0, timestamp - startedAt),
    pressure: finite(event?.pressure) ? clamp(event.pressure, 0, 1) : null,
  };
}

export class GestureCapture {
  constructor({ idFactory = () => crypto.randomUUID(), now = () => performance.now() } = {}) {
    this.idFactory = idFactory;
    this.now = now;
    this.active = null;
    this.gesture = null;
    this.startedAt = null;
  }

  down(event, rect) {
    if (this.active || this.gesture?.strokes.length >= MAX_STROKES) return null;

    if (!this.gesture) {
      const startedAt = eventTimestamp(event, this.now);
      this.startedAt = startedAt;
      this.gesture = {
        gesture_id: this.idFactory(),
        schema_version: SCHEMA_VERSIONS.rawGesture,
        strokes: [],
        modifiers: modifiersFrom(event),
      };
      const point = this.#point(event, rect, startedAt);
      return this.#beginStroke(event, point);
    }

    const point = this.#point(event, rect);
    return this.#beginStroke(event, point);
  }

  #beginStroke(event, point) {
    const stroke = {
      pointer_id: Number.isInteger(event?.pointerId) && event.pointerId >= 0 ? event.pointerId : 0,
      pointer_type: pointerTypeFrom(event),
      button: buttonFrom(event),
      cancelled: false,
      points: [point],
    };
    this.gesture.strokes.push(stroke);
    this.active = {
      pointerId: Number.isInteger(event?.pointerId) && event.pointerId >= 0 ? event.pointerId : 0,
      stroke,
    };
    return this.gesture;
  }

  move(event, rect) {
    if (!this.#matches(event)) return null;
    const stroke = this.active.stroke;
    const point = this.#point(event, rect);
    const previous = stroke.points.at(-1);
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (point.time_ms - previous.time_ms >= MIN_SAMPLE_INTERVAL_MS || distance >= MIN_SAMPLE_DISTANCE) {
      if (stroke.points.length < MAX_POINTS - 1) stroke.points.push(point);
      else stroke.points[stroke.points.length - 1] = point;
      return point;
    }
    return null;
  }

  up(event, rect) {
    if (!this.#matches(event)) return null;
    const stroke = this.active.stroke;
    const point = this.#point(event, rect);
    if (stroke.points.length === 1 || !samePoint(stroke.points.at(-1), point)) {
      if (stroke.points.length < MAX_POINTS) stroke.points.push(point);
      else stroke.points[stroke.points.length - 1] = point;
    }
    return this.#finishActive();
  }

  cancel(event, rect) {
    if (!this.#matches(event)) return null;
    const stroke = this.active.stroke;
    stroke.cancelled = true;
    return this.#finishActive();
  }

  ownsPointer(pointerId) {
    return this.#matches({ pointerId });
  }

  #matches(event) {
    return this.active !== null && event?.pointerId === this.active.pointerId;
  }

  #point(event, rect, timestamp = eventTimestamp(event, this.now)) {
    const point = pointerPoint({ ...event, timeStamp: timestamp }, rect, this.startedAt);
    const previous = this.#lastPoint();
    if (previous) point.time_ms = Math.max(previous.time_ms, point.time_ms);
    return point;
  }

  #lastPoint() {
    for (let index = this.gesture.strokes.length - 1; index >= 0; index--) {
      const point = this.gesture.strokes[index].points.at(-1);
      if (point) return point;
    }
    return null;
  }

  #finishActive() {
    const gesture = this.gesture;
    this.active = null;
    return gesture;
  }
}
