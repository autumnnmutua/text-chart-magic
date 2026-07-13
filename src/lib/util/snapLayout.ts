export interface ClientBounds {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  value: number;
}

export interface SnapResult {
  deltaX: number;
  deltaY: number;
  guides: SnapGuide[];
}

const anchorsX = (bounds: ClientBounds): number[] => [
  bounds.left,
  bounds.left + bounds.width / 2,
  bounds.right
];
const anchorsY = (bounds: ClientBounds): number[] => [
  bounds.top,
  bounds.top + bounds.height / 2,
  bounds.bottom
];

const closestAdjustment = (
  moving: number[],
  targets: number[],
  threshold: number
): { adjustment: number; target: number } | undefined => {
  let best: { adjustment: number; target: number } | undefined;
  for (const source of moving) {
    for (const target of targets) {
      const adjustment = target - source;
      if (Math.abs(adjustment) > threshold) continue;
      if (!best || Math.abs(adjustment) < Math.abs(best.adjustment)) best = { adjustment, target };
    }
  }
  return best;
};

export const calculateSnap = ({
  deltaX,
  deltaY,
  gridOrigin = { x: 0, y: 0 },
  gridSize = 30,
  moving,
  others,
  snapToGrid = false,
  threshold = 8
}: {
  deltaX: number;
  deltaY: number;
  gridOrigin?: { x: number; y: number };
  gridSize?: number;
  moving: ClientBounds;
  others: readonly ClientBounds[];
  snapToGrid?: boolean;
  threshold?: number;
}): SnapResult => {
  const shifted: ClientBounds = {
    ...moving,
    bottom: moving.bottom + deltaY,
    left: moving.left + deltaX,
    right: moving.right + deltaX,
    top: moving.top + deltaY
  };
  const xTargets = others.flatMap(anchorsX);
  const yTargets = others.flatMap(anchorsY);
  let x = closestAdjustment(anchorsX(shifted), xTargets, threshold);
  let y = closestAdjustment(anchorsY(shifted), yTargets, threshold);
  if (snapToGrid) {
    const centerX = shifted.left + shifted.width / 2;
    const centerY = shifted.top + shifted.height / 2;
    const gridX = gridOrigin.x + Math.round((centerX - gridOrigin.x) / gridSize) * gridSize;
    const gridY = gridOrigin.y + Math.round((centerY - gridOrigin.y) / gridSize) * gridSize;
    const gridXAdjustment = gridX - centerX;
    const gridYAdjustment = gridY - centerY;
    if (
      Math.abs(gridXAdjustment) <= threshold &&
      (!x || Math.abs(gridXAdjustment) < Math.abs(x.adjustment))
    ) {
      x = { adjustment: gridXAdjustment, target: gridX };
    }
    if (
      Math.abs(gridYAdjustment) <= threshold &&
      (!y || Math.abs(gridYAdjustment) < Math.abs(y.adjustment))
    ) {
      y = { adjustment: gridYAdjustment, target: gridY };
    }
  }
  return {
    deltaX: deltaX + (x?.adjustment ?? 0),
    deltaY: deltaY + (y?.adjustment ?? 0),
    guides: [
      ...(x ? [{ axis: 'x' as const, value: x.target }] : []),
      ...(y ? [{ axis: 'y' as const, value: y.target }] : [])
    ]
  };
};
