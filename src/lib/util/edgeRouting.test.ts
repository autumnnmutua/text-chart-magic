import { describe, expect, it } from 'vitest';
import {
  pointAlongRoute,
  routeOrthogonalEdge,
  routeToPathData,
  type RoutePoint,
  type RouteRect
} from './edgeRouting';

const segmentCrosses = (start: RoutePoint, end: RoutePoint, rect: RouteRect): boolean => {
  if (start.x === end.x) {
    return (
      start.x > rect.left &&
      start.x < rect.right &&
      Math.max(start.y, end.y) > rect.top &&
      Math.min(start.y, end.y) < rect.bottom
    );
  }
  return (
    start.y > rect.top &&
    start.y < rect.bottom &&
    Math.max(start.x, end.x) > rect.left &&
    Math.min(start.x, end.x) < rect.right
  );
};

describe('orthogonal edge routing', () => {
  it('chooses a short route that avoids unrelated node rectangles', () => {
    const obstacle = { bottom: 30, left: 40, right: 60, top: -30 };
    const route = routeOrthogonalEdge({ x: 0, y: 0 }, { x: 100, y: 0 }, [obstacle], {
      padding: 0
    });

    expect(route[0]).toEqual({ x: 0, y: 0 });
    expect(route.at(-1)).toEqual({ x: 100, y: 0 });
    expect(
      route.slice(1).some((point, index) => segmentCrosses(route[index], point, obstacle))
    ).toBe(false);
    expect(routeToPathData(route)).toMatch(/^M0,0L/);
  });

  it('offsets parallel lanes and places edge text on the actual route', () => {
    const base = routeOrthogonalEdge({ x: 0, y: 0 }, { x: 100, y: 80 }, [], {
      laneOffset: 0
    });
    const offset = routeOrthogonalEdge({ x: 0, y: 0 }, { x: 100, y: 80 }, [], {
      laneOffset: 12
    });

    expect(offset).not.toEqual(base);
    const midpoint = pointAlongRoute(offset);
    expect(Number.isFinite(midpoint.x)).toBe(true);
    expect(Number.isFinite(midpoint.y)).toBe(true);
  });

  it('keeps a parallel lane visible when endpoints are horizontally aligned', () => {
    const base = routeOrthogonalEdge({ x: 0, y: 0 }, { x: 100, y: 0 }, []);
    const offset = routeOrthogonalEdge({ x: 0, y: 0 }, { x: 100, y: 0 }, [], {
      laneOffset: 12
    });

    expect(base).toHaveLength(2);
    expect(offset.length).toBeGreaterThan(2);
    expect(offset).not.toEqual(base);
  });

  it('renders a visible loop when both endpoints share one anchor', () => {
    const route = routeOrthogonalEdge({ x: 20, y: 30 }, { x: 20, y: 30 }, []);

    expect(route.length).toBeGreaterThan(2);
    expect(route[0]).toEqual(route.at(-1));
  });
});
