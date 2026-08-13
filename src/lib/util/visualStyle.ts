import type { State, VisualStyle } from '$lib/types';

const rgbaFromHex = (hex: string, alpha = 1): string => {
  const clean = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(hex) ? hex.slice(1) : '000000';
  const value =
    clean.length === 3
      ? clean
          .split('')
          .map((item) => item + item)
          .join('')
      : clean;
  const number = Number.parseInt(value, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(Math.max(alpha, 0), 1)})`;
};

export const applyVisualStyleToElement = (element: Element, style: VisualStyle): void => {
  const fill = rgbaFromHex(style.fill ?? '#ffedd5', style.alpha ?? 1);
  const stroke = rgbaFromHex(style.stroke ?? '#f97316', style.alpha ?? 1);
  const text = rgbaFromHex(style.text ?? '#431407', style.alpha ?? 1);
  const isEdge = element.classList.contains('edgePath');
  const shapes = element.matches('path, rect, polygon, circle, ellipse, line')
    ? [element]
    : Array.from(element.querySelectorAll('path, rect, polygon, circle, ellipse, line'));
  const texts = element.matches('text, .nodeLabel, .edgeLabel, .label, foreignObject')
    ? [element]
    : Array.from(element.querySelectorAll('text, .nodeLabel, .edgeLabel, .label, foreignObject'));

  for (const shape of shapes) {
    const shapeElement = shape as SVGElement;
    if (
      shapeElement.matches(
        '[data-connection-hit], [data-connection-handle], [data-architecture-group-hit], [data-architecture-group-resize], [data-visual-element-hit], [data-visual-element-resize]'
      )
    )
      continue;
    shapeElement.style.stroke = stroke;
    if (shapeElement.matches('[data-architecture-group-border]')) {
      shapeElement.style.fill = 'none';
      continue;
    }
    if (!isEdge && shapeElement.tagName.toLowerCase() !== 'line') {
      shapeElement.style.fill = fill;
    }
  }

  for (const textElement of texts) {
    (textElement as HTMLElement | SVGElement).style.color = text;
    (textElement as HTMLElement | SVGElement).style.fill = text;
  }
};

export const applyVisualStyles = (graph: SVGSVGElement, styles: State['visualStyles']): void => {
  if (!styles) return;
  for (const target of graph.querySelectorAll('[data-style-id]')) {
    const id = target.getAttribute('data-style-id') ?? '';
    const style = styles[id];
    if (style) applyVisualStyleToElement(target, style);
  }
};
