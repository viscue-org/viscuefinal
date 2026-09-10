import React from 'react';
import { ICON_DEFINITIONS } from '../source/icon-definitions.js';

const ICON_MAP = new Map(
  ICON_DEFINITIONS.map(def => [def.name, def])
);

export function ViscueIcon({
  name,
  size = 24,
  strokeWidth = 1.8,
  title,
  className,
  ...svgProps
}) {
  const definition = ICON_MAP.get(name);
  if (!definition) {
    console.warn(`[ViscueIcon] Unknown icon name: "${name}"`);
    return null;
  }

  const children = [];

  if (title) {
    children.push(React.createElement('title', { key: '__title__' }, title));
  }

  definition.elements.forEach((el, index) => {
    const { type, ...attrs } = el;
    children.push(React.createElement(type, { key: index, ...attrs }));
  });

  const accessibilityProps = title
    ? { role: 'img' }
    : { 'aria-hidden': 'true' };

  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      ...accessibilityProps,
      ...svgProps
    },
    children
  );
}

export default ViscueIcon;
