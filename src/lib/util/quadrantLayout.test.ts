import { describe, expect, it } from 'vitest';
import {
  collectQuadrantPoints,
  getQuadrantBounds,
  moveQuadrantPointByPixels,
  prepareQuadrantCode
} from './quadrantLayout';

describe('quadrantLayout', () => {
  it('keeps ordinary quadrant data in the standard range', () => {
    const code = 'quadrantChart\n  A: [0.30, 0.50]';
    expect(getQuadrantBounds(code)).toEqual({ maxX: 1, maxY: 1, minX: 0, minY: 0 });
    expect(prepareQuadrantCode(code)).toContain('A: [0.3000, 0.5000]');
  });

  it('expands and normalizes points near or beyond the current boundary', () => {
    const code = 'quadrantChart\n  边缘: [0.98, 1.30]\n  外部: [-0.40, 0.20]';
    const bounds = getQuadrantBounds(code);
    expect(bounds.maxX).toBeGreaterThan(1);
    expect(bounds.maxY).toBeGreaterThan(1.3);
    expect(bounds.minX).toBeLessThan(-0.4);
    const prepared = collectQuadrantPoints(prepareQuadrantCode(code));
    expect(prepared.every(({ x, y }) => x >= 0.04 && x <= 0.96 && y >= 0.04 && y <= 0.96)).toBe(
      true
    );
  });

  it('converts drag pixels through the current data range and clamps extreme values', () => {
    const moved = moveQuadrantPointByPixels({
      bounds: { maxX: 2, maxY: 2, minX: -1, minY: -1 },
      deltaX: 100,
      deltaY: -50,
      height: 100,
      point: { x: 1, y: 1 },
      width: 100
    });
    expect(moved).toEqual({ x: 4, y: 2.5 });
    expect(
      moveQuadrantPointByPixels({
        bounds: { maxX: 2, maxY: 2, minX: -1, minY: -1 },
        deltaX: 9999,
        deltaY: 9999,
        height: 100,
        point: { x: 0, y: 0 },
        width: 100
      })
    ).toEqual({ x: 5, y: -4 });
  });
});
