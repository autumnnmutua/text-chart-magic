export interface RoutePoint {
  x: number;
  y: number;
}

export interface RouteRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const expandRect = (rect: RouteRect, padding: number): RouteRect => ({
  bottom: rect.bottom + padding,
  left: rect.left - padding,
  right: rect.right + padding,
  top: rect.top - padding
});

const segmentHitsRect = (start: RoutePoint, end: RoutePoint, rect: RouteRect): boolean => {
  if (start.x === end.x) {
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return start.x > rect.left && start.x < rect.right && maxY > rect.top && minY < rect.bottom;
  }
  if (start.y === end.y) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return start.y > rect.top && start.y < rect.bottom && maxX > rect.left && minX < rect.right;
  }
  return false;
};

const compactPath = (points: RoutePoint[]): RoutePoint[] =>
  points.filter((point, index, all) => {
    if (index === 0 || index === all.length - 1) return true;
    const previous = all[index - 1];
    const next = all[index + 1];
    return !(
      (previous.x === point.x && point.x === next.x) ||
      (previous.y === point.y && point.y === next.y)
    );
  });

const pathLength = (points: RoutePoint[]): number =>
  points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
  }, 0);

const collisionCount = (points: RoutePoint[], obstacles: RouteRect[]): number =>
  points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + obstacles.filter((rect) => segmentHitsRect(previous, point, rect)).length;
  }, 0);

export const routeOrthogonalEdge = (
  start: RoutePoint,
  end: RoutePoint,
  obstacles: readonly RouteRect[],
  {
    laneOffset = 0,
    margin = 20,
    padding = 10
  }: { laneOffset?: number; margin?: number; padding?: number } = {}
): RoutePoint[] => {
  const expanded = obstacles.map((rect) => expandRect(rect, padding));
  const middleX = (start.x + end.x) / 2 + laneOffset;
  const middleY = (start.y + end.y) / 2 + laneOffset;
  const left =
    Math.min(start.x, end.x, ...expanded.map((rect) => rect.left)) - margin - Math.abs(laneOffset);
  const right =
    Math.max(start.x, end.x, ...expanded.map((rect) => rect.right)) + margin + Math.abs(laneOffset);
  const top =
    Math.min(start.y, end.y, ...expanded.map((rect) => rect.top)) - margin - Math.abs(laneOffset);
  const bottom =
    Math.max(start.y, end.y, ...expanded.map((rect) => rect.bottom)) +
    margin +
    Math.abs(laneOffset);
  const candidates = [
    [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end],
    [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end],
    [start, { x: start.x, y: top }, { x: end.x, y: top }, end],
    [start, { x: start.x, y: bottom }, { x: end.x, y: bottom }, end],
    [start, { x: left, y: start.y }, { x: left, y: end.y }, end],
    [start, { x: right, y: start.y }, { x: right, y: end.y }, end]
  ].map(compactPath);
  return candidates.sort((leftPath, rightPath) => {
    const score = (path: RoutePoint[]) =>
      collisionCount(path, expanded) * 1_000_000 + pathLength(path) + path.length * 16;
    return score(leftPath) - score(rightPath);
  })[0];
};

export const routeToPathData = (points: readonly RoutePoint[]): string =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join('');

export const pointAlongRoute = (points: readonly RoutePoint[], ratio = 0.5): RoutePoint => {
  if (points.length === 0) return { x: 0, y: 0 };
  const total = pathLength([...points]);
  let remaining = total * Math.min(Math.max(ratio, 0), 1);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (remaining <= length) {
      const progress = length === 0 ? 0 : remaining / length;
      return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress
      };
    }
    remaining -= length;
  }
  return points.at(-1) ?? { x: 0, y: 0 };
};
