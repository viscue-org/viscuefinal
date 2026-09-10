export const ELEMENT_ATTRIBUTES = {
  path: ['d', 'fill', 'stroke'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke'],
  polyline: ['points', 'fill', 'stroke'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke']
};

export function validateDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('invalid definition: must be an object');
  }
  if (!definition.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.name)) {
    throw new Error(`invalid icon name: ${definition.name}`);
  }
  if (!Array.isArray(definition.elements) || definition.elements.length === 0) {
    throw new Error(`empty icon elements for ${definition.name}`);
  }
  for (const element of definition.elements) {
    const allowed = ELEMENT_ATTRIBUTES[element.type];
    if (!allowed) {
      throw new Error(`unsupported element: ${element.type} in ${definition.name}`);
    }
    for (const key of Object.keys(element)) {
      if (key !== 'type' && !allowed.includes(key)) {
        throw new Error(`unsupported attribute: ${key} on <${element.type}> in ${definition.name}`);
      }
    }
  }
}

export function toPascalCase(name) {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function renderSvgElement(element) {
  const { type, ...attrs } = element;
  const attrEntries = Object.entries(attrs)
    .map(([key, val]) => `${key}="${val}"`)
    .join(' ');
  return `<${type} ${attrEntries} />`;
}

export function renderJsxElement(element) {
  const { type, ...attrs } = element;
  const attrEntries = Object.entries(attrs)
    .map(([key, val]) => {
      if (typeof val === 'number') {
        return `${key}={${val}}`;
      }
      return `${key}="${val}"`;
    })
    .join(' ');
  return `<${type} ${attrEntries} />`;
}

export function renderSvg(definition, options = {}) {
  validateDefinition(definition);
  const strokeWidth = options.strokeWidth ?? 1.8;
  const childElements = definition.elements.map(renderSvgElement).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
  ${childElements}
</svg>`;
}

export function renderJsxElements(definition) {
  validateDefinition(definition);
  return definition.elements.map(renderJsxElement).join('\n    ');
}
