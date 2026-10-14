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

describe('attached endpoints', () => {
  const crossesAny = (route: RoutePoint[], rect: RouteRect) =>
    route.slice(1).some((point, index) => segmentCrosses(route[index], point, rect));

  it('leaves a top anchor upward instead of cutting through its own node', () => {
    const source = { bottom: 16, left: 0, right: 40, top: -16 };
    const middle = { bottom: 16, left: 48, right: 88, top: -16 };
    const target = { bottom: 16, left: 96, right: 136, top: -16 };
    const route = routeOrthogonalEdge({ x: 20, y: -16 }, { x: 96, y: 0 }, [middle], {
      margin: 18,
      padding: 8,
      source: { direction: { x: 0, y: -1 }, rect: source },
      target: { direction: { x: -1, y: 0 }, rect: target }
    });
    expect(route[0]).toEqual({ x: 20, y: -16 });
    expect(route[1]).toEqual({ x: 20, y: -34 });
    expect(route.at(-1)).toEqual({ x: 96, y: 0 });
    expect(crossesAny(route, source)).toBe(false);
    expect(crossesAny(route, target)).toBe(false);
  });

  it('takes a short detour around the source when the target is straight below it', () => {
    const source = { bottom: 56, left: 300, right: 376, top: 8 };
    const target = { bottom: 224, left: 300, right: 376, top: 176 };
    const far = { bottom: 400, left: 0, right: 700, top: 300 };
    const route = routeOrthogonalEdge({ x: 338, y: 8 }, { x: 338, y: 176 }, [far], {
      margin: 18,
      padding: 8,
      source: { direction: { x: 0, y: -1 }, rect: source },
      target: { direction: { x: 0, y: -1 }, rect: target }
    });
    expect(crossesAny(route, source)).toBe(false);
    expect(Math.max(...route.map(({ x }) => x))).toBeLessThan(420);
  });
});
