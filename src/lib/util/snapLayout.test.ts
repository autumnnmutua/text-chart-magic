import { describe, expect, it } from 'vitest';
import { calculateSnap, type ClientBounds } from './snapLayout';

const bounds = (left: number, top: number, width = 100, height = 60): ClientBounds => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  top,
  width
});

describe('smart alignment snapping', () => {
  it('snaps left, center or right anchors within a client-pixel threshold', () => {
    const result = calculateSnap({
      deltaX: 196,
      deltaY: 2,
      moving: bounds(0, 0),
      others: [bounds(300, 0)],
      threshold: 8
    });

    expect(result.deltaX).toBe(200);
    expect(result.deltaY).toBe(0);
    expect(result.guides).toEqual([
      { axis: 'x', value: 300 },
      { axis: 'y', value: 0 }
    ]);
  });

  it('does not pull an element from outside the configured threshold', () => {
    const result = calculateSnap({
      deltaX: 180,
      deltaY: 20,
      moving: bounds(0, 0),
      others: [bounds(300, 0)],
      threshold: 8
    });

    expect(result).toEqual({ deltaX: 180, deltaY: 20, guides: [] });
  });

  it('supports optional grid snapping without requiring another element', () => {
    const result = calculateSnap({
      deltaX: 7,
      deltaY: 7,
      gridOrigin: { x: 0, y: 0 },
      gridSize: 30,
      moving: bounds(0, 0, 40, 40),
      others: [],
      snapToGrid: true,
      threshold: 8
    });

    expect(result.deltaX).toBe(10);
    expect(result.deltaY).toBe(10);
    expect(result.guides).toHaveLength(2);
  });

  it('snaps the module center to the grid instead of pulling an edge onto a center line', () => {
    const result = calculateSnap({
      deltaX: 0,
      deltaY: 0,
      gridOrigin: { x: 0, y: 0 },
      gridSize: 30,
      moving: bounds(28, 28, 40, 40),
      others: [],
      snapToGrid: true,
      threshold: 8
    });

    expect(result.deltaX).toBe(0);
    expect(result.deltaY).toBe(0);
    expect(result.guides).toEqual([]);
  });
});
