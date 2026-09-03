function cloneMotion(motion) {
  if (!motion) return null;
  const { previousMotion, ...saved } = motion;
  return {
    ...saved,
    startPos: saved.startPos ? { ...saved.startPos } : saved.startPos,
    path: Array.isArray(saved.path) ? saved.path.map(point => ({ ...point })) : [],
  };
}

export function startNodeMotion(node) {
  const previousMotion = node.data.motion?.active
    ? cloneMotion(node.data.motion.previousMotion)
    : cloneMotion(node.data.motion);

  return {
    ...node,
    data: {
      ...node.data,
      motion: {
        active: true,
        startPos: { ...node.position },
        path: [],
        currentDx: 0,
        currentDy: 0,
        previousMotion,
      },
    },
  };
}

export function finishNodeMotion(node) {
  if (!node.data.motion) return node;
  const { previousMotion, ...motion } = node.data.motion;
  return { ...node, data: { ...node.data, motion: { ...motion, active: false } } };
}

export function cancelNodeMotion(node) {
  const motion = node.data.motion;
  if (!motion) return node;
  return {
    ...node,
    position: motion.startPos ? { ...motion.startPos } : node.position,
    data: { ...node.data, motion: cloneMotion(motion.previousMotion) },
  };
}

export function removeNodeMotion(node) {
  return { ...node, data: { ...node.data, motion: null } };
}
