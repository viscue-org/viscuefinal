const clamp01 = value => Math.max(0, Math.min(1, value));

export function annotationSourcePoint(tool, point = {}) {
  if (tool !== 'whole') return { ...point };
  return {
    x: 0.5,
    y: 0.5,
    ...(point.timeMs === undefined ? {} : { timeMs: point.timeMs }),
    isWholeAsset: true,
  };
}
export function resolveAnnotationTarget(nodes, sourceId, flowPoint, { padding = 60, preciseTarget = false } = {}) {
  const node = nodes.find(candidate => {
    if (candidate.id === sourceId || candidate.type !== 'asset') return false;
    const width = candidate.measured?.width || 362;
    const height = candidate.measured?.height || 280;
    return flowPoint.x >= candidate.position.x - padding
      && flowPoint.x <= candidate.position.x + width + padding
      && flowPoint.y >= candidate.position.y - padding
      && flowPoint.y <= candidate.position.y + height + padding;
  });
  if (!node) return null;

  const width = node.measured?.width || 362;
  const height = node.measured?.height || 280;
  const relativeX = (flowPoint.x - node.position.x) / width;
  const relativeY = (flowPoint.y - node.position.y) / height;
  const isBorderTarget = relativeX < 0.1 || relativeX > 0.9 || relativeY < 0.1 || relativeY > 0.9;
  return {
    node,
    anchor: {
      x: clamp01(relativeX),
      y: clamp01(relativeY),
      isWholeAsset: preciseTarget ? false : isBorderTarget,
    },
  };
}
