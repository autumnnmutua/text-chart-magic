import { describe, expect, it } from 'vitest';
import { applyVisualStyleToElement } from './visualStyle';

describe('visualStyle', () => {
  it('applies alpha once and leaves connection hit targets invisible', () => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.dataset.connectionHandle = 'true';
    handle.style.fill = 'transparent';
    handle.style.stroke = 'transparent';
    group.append(shape, handle);

    applyVisualStyleToElement(group, {
      alpha: 0.5,
      fill: '#ff0000',
      stroke: '#00ff00',
      text: '#0000ff'
    });

    expect(shape.style.fill).toBe('rgba(255, 0, 0, 0.5)');
    expect(shape.style.fillOpacity).toBe('');
    expect(shape.style.stroke).toBe('rgba(0, 255, 0, 0.5)');
    expect(shape.style.strokeOpacity).toBe('');
    expect(handle.style.fill).toBe('transparent');
    expect(handle.style.stroke).toBe('transparent');
  });
});
