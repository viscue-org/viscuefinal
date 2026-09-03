import { validateRawGesture } from '../shared/schema.mjs';

export function acceptRawGesture(rawGesture) {
  const validation = validateRawGesture(rawGesture);
  if (!validation.ok || rawGesture.strokes.some(stroke => stroke.cancelled)) return null;
  return rawGesture;
}

export function releasePointerCapture(target, pointerId) {
  if (typeof target?.hasPointerCapture !== 'function' || !target.hasPointerCapture(pointerId)) return false;
  if (typeof target.releasePointerCapture !== 'function') return false;
  target.releasePointerCapture(pointerId);
  return true;
}
