import { describe, expect, it } from 'vitest';
import {
  createVisualElement,
  normalizeVisualElements,
  renderVisualElements,
  VISUAL_ELEMENT_MIN_HEIGHT,
  VISUAL_ELEMENT_MIN_WIDTH
} from './visualElements';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('visual overlay elements', () => {
  it('normalizes saved shapes and rejects malformed legacy entries', () => {
    const normalized = normalizeVisualElements({
      broken: { height: 20, id: 'broken', shape: 'rectangle', width: 20, x: 0, y: 0 },
      'element-valid': {
        height: 0.1,
        id: 'element-valid',
        kind: 'icon',
        label: '数据库',
        shape: 'cylinder',
        width: 0.1,
        x: 20,
        y: 30
      }
    });

    expect(normalized).toEqual({
      'element-valid': {
        height: VISUAL_ELEMENT_MIN_HEIGHT,
        id: 'element-valid',
        kind: 'icon',
        label: '数据库',
        shape: 'cylinder',
        width: VISUAL_ELEMENT_MIN_WIDTH,
        x: 20,
        y: 30
      }
    });
  });

  it('keeps explicit blank labels and legacy parent links while repairing parent cycles', () => {
    const normalized = normalizeVisualElements({
      'element-a': {
        height: 70,
        id: 'element-a',
        label: ' ',
        parentId: 'element-b',
        shape: 'rectangle',
        width: 120,
        x: 10,
        y: 20
      },
      'element-b': {
        height: 70,
        id: 'element-b',
        kind: 'icon',
        label: '',
        parentId: 'element-a',
        shape: 'person',
        width: 100,
        x: 160,
        y: 20
      },
      'element-external-child': {
        height: 70,
        id: 'element-external-child',
        label: '外部父级',
        parentId: 'MermaidNodeA',
        shape: 'rounded',
        width: 120,
        x: 300,
        y: 20
      }
    });

    expect(normalized?.['element-a']?.label).toBe('');
    expect(normalized?.['element-b']?.label).toBe('');
    expect(normalized?.['element-external-child']?.parentId).toBe('MermaidNodeA');
    expect(
      normalized?.['element-a']?.parentId === 'element-b' &&
        normalized?.['element-b']?.parentId === 'element-a'
    ).toBe(false);
  });

  it('renders a real editable SVG node with eight resize handles', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    const viewport = document.createElementNS(SVG_NS, 'g');
    viewport.classList.add('svg-pan-zoom_viewport');
    svg.append(viewport);
    const element = createVisualElement({
      kind: 'shape',
      label: '判断条件',
      position: { x: 80, y: 50 },
      shape: 'diamond'
    });

    renderVisualElements(svg, { [element.id]: element }, undefined, new Set([element.id]));

    const group = svg.querySelector(`[data-visual-id="${element.id}"]`);
    expect(group?.classList.contains('visual-element-selected')).toBe(true);
    expect(group?.querySelector('polygon')).not.toBeNull();
    expect(group?.querySelector('[data-visual-element-label]')?.textContent).toBe('判断条件');
    expect(group?.querySelectorAll('[data-visual-element-resize]')).toHaveLength(8);
  });
});
