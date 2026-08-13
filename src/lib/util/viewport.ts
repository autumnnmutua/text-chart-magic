export const MIN_VIEW_ZOOM = 0.05;
export const MAX_VIEW_ZOOM = 12;

export const clampViewZoom = (zoom: number): number =>
  Math.min(Math.max(zoom, MIN_VIEW_ZOOM), MAX_VIEW_ZOOM);
