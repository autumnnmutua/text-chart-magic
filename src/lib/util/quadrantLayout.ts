export interface QuadrantPointValue {
  label: string;
  x: number;
  y: number;
}

export interface QuadrantBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export const QUADRANT_COORDINATE_MIN = -4;
export const QUADRANT_COORDINATE_MAX = 5;
const EDGE_EXPANSION_THRESHOLD = 0.94;
const RANGE_PADDING_RATIO = 0.12;

const pointPattern = /^(\s*([^:\n]+?)\s*:\s*\[\s*)(-?\d*\.?\d+)(\s*,\s*)(-?\d*\.?\d+)(\s*\])/gm;

export const collectQuadrantPoints = (code: string): QuadrantPointValue[] =>
  [...code.matchAll(pointPattern)].map((match) => ({
    label: match[2].trim(),
    x: Number(match[3]),
    y: Number(match[5])
  }));

const axisBounds = (values: readonly number[]): { max: number; min: number } => {
  const finite = values.filter(Number.isFinite);
  const rawMin = Math.min(0, ...finite);
  const rawMax = Math.max(1, ...finite);
  const span = Math.max(rawMax - rawMin, 1);
  const expandMin = rawMin < 0 || finite.some((value) => value <= 1 - EDGE_EXPANSION_THRESHOLD);
  const expandMax = rawMax > 1 || finite.some((value) => value >= EDGE_EXPANSION_THRESHOLD);
  return {
    max: Math.min(expandMax ? rawMax + span * RANGE_PADDING_RATIO : 1, QUADRANT_COORDINATE_MAX),
    min: Math.max(expandMin ? rawMin - span * RANGE_PADDING_RATIO : 0, QUADRANT_COORDINATE_MIN)
  };
};

export const getQuadrantBounds = (code: string): QuadrantBounds => {
  const points = collectQuadrantPoints(code);
  const x = axisBounds(points.map((point) => point.x));
  const y = axisBounds(points.map((point) => point.y));
  return { maxX: x.max, maxY: y.max, minX: x.min, minY: y.min };
};

export const clampQuadrantPoint = ({ x, y }: { x: number; y: number }) => ({
  x: Math.min(Math.max(x, QUADRANT_COORDINATE_MIN), QUADRANT_COORDINATE_MAX),
  y: Math.min(Math.max(y, QUADRANT_COORDINATE_MIN), QUADRANT_COORDINATE_MAX)
});

export const moveQuadrantPointByPixels = ({
  bounds,
  deltaX,
  deltaY,
  height,
  point,
  width
}: {
  bounds: QuadrantBounds;
  deltaX: number;
  deltaY: number;
  height: number;
  point: { x: number; y: number };
  width: number;
}) =>
  clampQuadrantPoint({
    x: point.x + (deltaX / Math.max(width, 1)) * (bounds.maxX - bounds.minX),
    y: point.y - (deltaY / Math.max(height, 1)) * (bounds.maxY - bounds.minY)
  });

const normalize = (value: number, min: number, max: number): number =>
  Math.min(Math.max((value - min) / Math.max(max - min, Number.EPSILON), 0.04), 0.96);

export const prepareQuadrantCode = (code: string): string => {
  if (!/^\s*quadrantChart\b/im.test(code)) return code;
  const bounds = getQuadrantBounds(code);
  return code.replace(
    pointPattern,
    (
      _line,
      prefix: string,
      _label: string,
      x: string,
      separator: string,
      y: string,
      suffix: string
    ) =>
      `${prefix}${normalize(Number(x), bounds.minX, bounds.maxX).toFixed(4)}${separator}${normalize(
        Number(y),
        bounds.minY,
        bounds.maxY
      ).toFixed(4)}${suffix}`
  );
};
