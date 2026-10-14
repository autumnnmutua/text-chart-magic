import type { State } from '$/types';
import Hammer from 'hammerjs';
import type { Point } from 'mermaid/dist/types.js';
import panzoom from 'svg-pan-zoom';
import { clampViewZoom, MAX_AUTO_FIT_SCALE, MAX_VIEW_ZOOM, MIN_VIEW_ZOOM } from './viewport';
type PanZoom = typeof panzoom;

export class PanZoomState {
  private diagramView?: SVGElement;
  private pan?: Point;
  private zoom?: number;
  private pzoom: PanZoom | undefined;
  private isDirty = false;
  private isApplyingViewport = false;
  private isInteractionSuspended = false;
  private resizeObserver: ResizeObserver;

  public onPanZoomChange?: (pan: Point, zoom: number, immediate?: boolean) => void;
  public shouldHandleCanvasGesture?: (target: EventTarget | null, pointerCount: number) => boolean;

  constructor() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
  }

  public updateElement(diagramView: SVGElement, { pan, zoom }: Pick<State, 'pan' | 'zoom'>) {
    this.resizeObserver.disconnect();
    this.destroyPanZoom();
    this.diagramView = diagramView;
    this.isDirty = false;
    let hammer: HammerManager | undefined;
    let preventTouchMove: ((event: TouchEvent) => void) | undefined;
    let touchMoveElement: SVGElement | undefined;
    this.pzoom = panzoom(diagramView, {
      center: true,
      controlIconsEnabled: false,
      customEventsHandler: {
        haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
        init: (options) => {
          const instance = options.instance;
          let initialScale = 1;
          let panGestureAllowed: boolean | undefined;
          let pinchInitialized = false;
          let pannedX = 0;
          let pannedY = 0;
          hammer = new Hammer(options.svgElement);

          const resetPanned = () => {
            pannedX = 0;
            pannedY = 0;
          };
          const handlePan = (event: HammerInput) => {
            if (panGestureAllowed === undefined) {
              panGestureAllowed =
                !this.isInteractionSuspended &&
                this.shouldHandleCanvasGesture?.(event.target, event.pointers?.length ?? 1) !==
                  false;
            }
            if (!panGestureAllowed || this.isInteractionSuspended) {
              return;
            }
            instance.panBy({ x: event.deltaX - pannedX, y: event.deltaY - pannedY });
            pannedX = event.deltaX;
            pannedY = event.deltaY;
          };

          hammer.get('pinch').set({ enable: true });
          hammer.on('panstart panmove', (event) => {
            if (event.type === 'panstart') {
              resetPanned();
              panGestureAllowed = undefined;
            }
            handlePan(event);
          });
          hammer.on('panend pancancel', () => {
            panGestureAllowed = undefined;
            resetPanned();
          });
          hammer.on('pinchstart pinchmove', (event) => {
            if (this.isInteractionSuspended) return;
            if (event.type === 'pinchstart' || !pinchInitialized) {
              initialScale = instance.getZoom();
              pinchInitialized = true;
              panGestureAllowed = undefined;
              resetPanned();
            }
            instance.zoomAtPoint(initialScale * event.scale, {
              x: event.center.x,
              y: event.center.y
            });
            handlePan(event);
          });
          hammer.on('pinchend pinchcancel', () => {
            pinchInitialized = false;
            panGestureAllowed = undefined;
            resetPanned();
          });
          preventTouchMove = (event: TouchEvent) => {
            event.preventDefault();
          };
          touchMoveElement = options.svgElement;
          touchMoveElement.addEventListener('touchmove', preventTouchMove, { passive: false });
        },
        destroy: () => {
          hammer?.destroy();
          if (preventTouchMove && touchMoveElement) {
            touchMoveElement.removeEventListener('touchmove', preventTouchMove);
            preventTouchMove = undefined;
            touchMoveElement = undefined;
          }
        }
      },
      fit: true,
      maxZoom: MAX_VIEW_ZOOM,
      minZoom: MIN_VIEW_ZOOM,
      onPan: (pan) => {
        if (this.isApplyingViewport) return;
        this.pan = pan;
        this.zoom = this.pzoom?.getZoom();
        this.isDirty = true;
        if (this.zoom) {
          this.onPanZoomChange?.(this.pan, this.zoom);
        }
      },
      onZoom: (zoom) => {
        if (this.isApplyingViewport) return;
        this.zoom = zoom;
        this.pan = this.pzoom?.getPan();
        this.isDirty = true;
        if (this.pan) {
          this.onPanZoomChange?.(this.pan, this.zoom);
        }
      },
      panEnabled: true,
      zoomEnabled: true
    });

    this.pzoom.disableDblClickZoom();

    this.resizeObserver.observe(diagramView);

    if (pan && zoom && Number.isFinite(zoom) && Number.isFinite(pan.x) && Number.isFinite(pan.y)) {
      this.restorePanZoom(pan, zoom);
    } else {
      this.resetViewport();
    }

    if (this.isInteractionSuspended) {
      this.pzoom.disablePan();
      this.pzoom.disableZoom();
    } else {
      this.pzoom.enablePan();
      this.pzoom.enableZoom();
    }
  }

  public restorePanZoom(pan: Point, zoom: number) {
    if (!this.pzoom) {
      console.error('PanZoomState.restorePanZoom: pzoom is not initialized');
      return;
    }
    this.isApplyingViewport = true;
    try {
      this.pzoom.zoom(clampViewZoom(zoom));
      this.pzoom.pan(pan);
      this.isDirty = true;
    } finally {
      this.isApplyingViewport = false;
    }
  }

  public resize() {
    if (!this.pzoom || !this.hasRenderableBounds()) return;
    if (!this.isDirty) {
      this.resetViewport();
    } else {
      this.pzoom.resize();
    }
  }

  public zoomIn() {
    this.pzoom?.zoomIn();
    this.commitCurrentView();
  }

  public zoomOut() {
    this.pzoom?.zoomOut();
    this.commitCurrentView();
  }

  public focusElement(element: Element) {
    if (!this.pzoom || !this.diagramView || !element.isConnected) return;
    const viewport = this.diagramView.parentElement?.getBoundingClientRect();
    const target = element.getBoundingClientRect();
    if (!viewport || target.width <= 0 || target.height <= 0) return;
    this.pzoom.panBy({
      x: viewport.left + viewport.width / 2 - (target.left + target.width / 2),
      y: viewport.top + viewport.height / 2 - (target.top + target.height / 2)
    });
    this.isDirty = true;
  }

  public suspendInteraction() {
    this.isInteractionSuspended = true;
    this.pzoom?.disablePan();
    this.pzoom?.disableZoom();
  }

  public resumeInteraction() {
    this.isInteractionSuspended = false;
    this.pzoom?.enablePan();
    this.pzoom?.enableZoom();
  }

  public reset() {
    this.resetViewport();
    this.commitCurrentView();
  }

  public fit() {
    this.resetViewport();
  }

  private resetViewport() {
    const pzoom = this.pzoom;
    if (!pzoom || !this.hasRenderableBounds()) {
      this.isDirty = false;
      return;
    }
    this.isApplyingViewport = true;
    try {
      pzoom.resize();
      pzoom.fit();
      pzoom.center();
      const fittedZoom = pzoom.getZoom();
      if (!Number.isFinite(fittedZoom) || fittedZoom <= 0) {
        this.isDirty = false;
        return;
      }
      // Fitting a tiny diagram (one or two nodes) used to blow it up ~10x.
      // Canvas widgets drawn in diagram units (relation labels, arrow heads,
      // selection outlines) then became huge while new shapes, which are sized
      // in screen pixels, looked tiny. Never auto-fit beyond MAX_AUTO_FIT_SCALE.
      const fittedScale = pzoom.getSizes().realZoom;
      const scaleLimit =
        Number.isFinite(fittedScale) && fittedScale > 0
          ? MAX_AUTO_FIT_SCALE / fittedScale
          : Number.POSITIVE_INFINITY;
      pzoom.zoom(Math.max(Math.min(fittedZoom * 0.92, fittedZoom * scaleLimit), MIN_VIEW_ZOOM));
      pzoom.center();
      this.isDirty = false;
    } finally {
      this.isApplyingViewport = false;
    }
  }

  /**
   * svg-pan-zoom's destroy() calls reset(), which fires onZoom/onPan with the
   * previous diagram's default viewport. Those values must not be reported as a
   * user pan/zoom, otherwise the next render restores a stale viewport and the
   * chart jumps, shrinks or gets cropped after every edit.
   */
  private destroyPanZoom() {
    const pzoom = this.pzoom;
    this.pzoom = undefined;
    if (!pzoom) return;
    const wasApplyingViewport = this.isApplyingViewport;
    this.isApplyingViewport = true;
    try {
      pzoom.destroy();
    } finally {
      this.isApplyingViewport = wasApplyingViewport;
    }
  }

  private commitCurrentView() {
    const pzoom = this.pzoom;
    if (!pzoom) return;
    const pan = pzoom.getPan();
    const zoom = pzoom.getZoom();
    if (!Number.isFinite(pan.x) || !Number.isFinite(pan.y) || !Number.isFinite(zoom)) return;
    this.pan = pan;
    this.zoom = zoom;
    this.onPanZoomChange?.(pan, zoom, true);
  }

  public destroy() {
    this.resizeObserver.disconnect();
    this.destroyPanZoom();
    this.diagramView = undefined;
    this.onPanZoomChange = undefined;
    this.shouldHandleCanvasGesture = undefined;
    this.pan = undefined;
    this.zoom = undefined;
    this.isDirty = false;
    this.isApplyingViewport = false;
    this.isInteractionSuspended = false;
  }

  private hasRenderableBounds(): boolean {
    const view = this.diagramView;
    if (!view?.isConnected) return false;
    const viewport = view.getBoundingClientRect();
    if (viewport.width <= 0 || viewport.height <= 0) return false;
    try {
      const content = (view as SVGGraphicsElement).getBBox();
      return content.width > 0 && content.height > 0;
    } catch {
      return false;
    }
  }
}
