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

const dedupe = (points: RoutePoint[]): RoutePoint[] =>
  points.filter(
    (point, index) =>
      index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y
  );

export interface RouteEndpointOptions {
  /** Unit vector pointing out of the element the endpoint is attached to. */
  direction?: RoutePoint;
  /** The element the endpoint sits on; its anchor lies on this rectangle's edge. */
  rect?: RouteRect;
}

export const routeOrthogonalEdge = (
  start: RoutePoint,
  end: RoutePoint,
  obstacles: readonly RouteRect[],
  {
    laneOffset = 0,
    margin = 20,
    padding = 10,
    source,
    target
  }: {
    laneOffset?: number;
    margin?: number;
    padding?: number;
    /**
     * Optional information about the attached elements. When given, the route
     * first leaves each anchor outward and never cuts back through its own
     * element. Without it an arrow from a node's top anchor could run straight
     * through that node, putting the arrow and its label on top of the node.
     */
    source?: RouteEndpointOptions;
    target?: RouteEndpointOptions;
  } = {}
): RoutePoint[] => {
  if (start.x === end.x && start.y === end.y) {
    const loop = margin + Math.abs(laneOffset);
    return [
      start,
      { x: start.x + loop, y: start.y },
      { x: start.x + loop, y: start.y + loop },
      { x: start.x, y: start.y + loop },
      end
    ];
  }
  const endpointRects = [source?.rect, target?.rect].filter(
    (rect): rect is RouteRect => rect !== undefined
  );
  const expanded = obstacles.map((rect) => expandRect(rect, padding));
  const bounds = [...expanded, ...endpointRects];
  const stub = (point: RoutePoint, endpoint?: RouteEndpointOptions): RoutePoint =>
    endpoint?.direction && endpoint.rect
      ? { x: point.x + endpoint.direction.x * margin, y: point.y + endpoint.direction.y * margin }
      : point;
  const from = stub(start, source);
  const to = stub(end, target);
  const middleX = (from.x + to.x) / 2 + laneOffset;
  const middleY = (from.y + to.y) / 2 + laneOffset;
  const lane = Math.abs(laneOffset);
  const left = Math.min(from.x, to.x, ...bounds.map((rect) => rect.left)) - margin - lane;
  const right = Math.max(from.x, to.x, ...bounds.map((rect) => rect.right)) + margin + lane;
  const top = Math.min(from.y, to.y, ...bounds.map((rect) => rect.top)) - margin - lane;
  const bottom = Math.max(from.y, to.y, ...bounds.map((rect) => rect.bottom)) + margin + lane;
  const detours: [number, number, number, number][] = [[left, right, top, bottom]];
  if (endpointRects.length > 0) {
    // Short detours around just the two attached elements, so avoiding the
    // source does not force a trip around the whole diagram.
    detours.push([
      Math.min(from.x, to.x, ...endpointRects.map((rect) => rect.left)) - margin - lane,
      Math.max(from.x, to.x, ...endpointRects.map((rect) => rect.right)) + margin + lane,
      Math.min(from.y, to.y, ...endpointRects.map((rect) => rect.top)) - margin - lane,
      Math.max(from.y, to.y, ...endpointRects.map((rect) => rect.bottom)) + margin + lane
    ]);
  }
  const middles: RoutePoint[][] = [
    [
      { x: middleX, y: from.y },
      { x: middleX, y: to.y }
    ],
    [
      { x: from.x, y: middleY },
      { x: to.x, y: middleY }
    ],
    ...detours.flatMap(([detourLeft, detourRight, detourTop, detourBottom]) => [
      [
        { x: from.x, y: detourTop },
        { x: to.x, y: detourTop }
      ],
      [
        { x: from.x, y: detourBottom },
        { x: to.x, y: detourBottom }
      ],
      [
        { x: detourLeft, y: from.y },
        { x: detourLeft, y: to.y }
      ],
      [
        { x: detourRight, y: from.y },
        { x: detourRight, y: to.y }
      ]
    ])
  ];
  const candidates = middles
    .map((middle) => compactPath(dedupe([start, from, ...middle, to, end])))
    .filter((path) => laneOffset === 0 || path.length > 2);
  return candidates.sort((leftPath, rightPath) => {
    const score = (path: RoutePoint[]) =>
      // Running through an attached element is worse than grazing the padding
      // around an unrelated one: it hides the element under the arrow.
      (collisionCount(path, expanded) + collisionCount(path, endpointRects) * 4) * 1_000_000 +
      pathLength(path) +
      path.length * 16;
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
