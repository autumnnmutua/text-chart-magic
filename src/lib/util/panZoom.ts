import type { State } from '$/types';
import Hammer from 'hammerjs';
import type { Point } from 'mermaid/dist/types.js';
import panzoom from 'svg-pan-zoom';
type PanZoom = typeof panzoom;

export class PanZoomState {
  private diagramView?: SVGElement;
  private pan?: Point;
  private zoom?: number;
  private pzoom: PanZoom | undefined;
  private isDirty = false;
  private isInteractionSuspended = false;
  private resizeObserver: ResizeObserver;

  public onPanZoomChange?: (pan: Point, zoom: number, immediate?: boolean) => void;

  constructor() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
  }

  public updateElement(diagramView: SVGElement, { pan, zoom }: Pick<State, 'pan' | 'zoom'>) {
    this.resizeObserver.disconnect();
    this.pzoom?.destroy();
    this.pzoom = undefined;
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
          let pannedX = 0;
          let pannedY = 0;
          hammer = new Hammer(options.svgElement);

          const resetPanned = () => {
            pannedX = 0;
            pannedY = 0;
          };
          const handlePan = (event: HammerInput) => {
            if (this.isInteractionSuspended) return;
            instance.panBy({ x: event.deltaX - pannedX, y: event.deltaY - pannedY });
            pannedX = event.deltaX;
            pannedY = event.deltaY;
          };

          hammer.get('pinch').set({ enable: true });
          hammer.on('panstart panmove', (event) => {
            if (event.type === 'panstart') {
              resetPanned();
            }
            handlePan(event);
          });
          hammer.on('pinchstart pinchmove', (event) => {
            if (this.isInteractionSuspended) return;
            if (event.type === 'pinchstart') {
              initialScale = instance.getZoom();
              resetPanned();
            }
            instance.zoomAtPoint(initialScale * event.scale, {
              x: event.center.x,
              y: event.center.y
            });
            handlePan(event);
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
      maxZoom: 12,
      minZoom: 0.05,
      onPan: (pan) => {
        this.pan = pan;
        this.zoom = this.pzoom?.getZoom();
        this.isDirty = true;
        if (this.zoom) {
          this.onPanZoomChange?.(this.pan, this.zoom);
        }
      },
      onZoom: (zoom) => {
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
    this.pzoom.zoom(zoom);
    this.pzoom.pan(pan);
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

  private resetViewport() {
    const pzoom = this.pzoom;
    if (!pzoom || !this.hasRenderableBounds()) {
      this.isDirty = false;
      return;
    }
    pzoom.resize();
    pzoom.fit();
    pzoom.center();
    const fittedZoom = pzoom.getZoom();
    if (!Number.isFinite(fittedZoom) || fittedZoom <= 0) {
      this.isDirty = false;
      return;
    }
    pzoom.zoom(Math.max(fittedZoom * 0.92, 0.05));
    pzoom.center();
    this.isDirty = false;
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
    this.pzoom?.destroy();
    this.pzoom = undefined;
    this.diagramView = undefined;
    this.onPanZoomChange = undefined;
    this.pan = undefined;
    this.zoom = undefined;
    this.isDirty = false;
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
