export type MobileToolMode = 'connection' | 'multi' | 'pan' | 'select';
export type MobileWorkspaceSheet = 'align' | 'more';

let enabled = $state(false);
let keyboardOpen = $state(false);
let mode = $state<MobileToolMode>('select');
let sheet = $state<MobileWorkspaceSheet | undefined>();
let visualHeight = $state(0);

export interface MobileViewportMetrics {
  keyboardOpen: boolean;
  obscuredHeight: number;
  visualHeight: number;
}

export const calculateMobileViewportMetrics = ({
  innerHeight,
  offsetTop = 0,
  viewportHeight
}: {
  innerHeight: number;
  offsetTop?: number;
  viewportHeight: number;
}): MobileViewportMetrics => {
  const nextVisualHeight = Math.max(1, Math.round(viewportHeight));
  const obscuredHeight = Math.max(
    0,
    Math.round(innerHeight) - nextVisualHeight - Math.round(offsetTop)
  );
  return {
    keyboardOpen: obscuredHeight >= 120,
    obscuredHeight,
    visualHeight: nextVisualHeight
  };
};

export const mobileWorkspace = {
  get isEnabled(): boolean {
    return enabled;
  },
  get isKeyboardOpen(): boolean {
    return keyboardOpen;
  },
  get mode(): MobileToolMode {
    return mode;
  },
  get sheet(): MobileWorkspaceSheet | undefined {
    return sheet;
  },
  get visualHeight(): number {
    return visualHeight;
  }
};

export const setMobileWorkspaceEnabled = (next: boolean): void => {
  enabled = next;
  if (!next) {
    mode = 'select';
    sheet = undefined;
    keyboardOpen = false;
  }
};

export const setMobileToolMode = (next: MobileToolMode): void => {
  mode = next;
  sheet = undefined;
};

export const openMobileWorkspaceSheet = (next: MobileWorkspaceSheet): void => {
  sheet = next;
};

export const closeMobileWorkspaceSheet = (): void => {
  sheet = undefined;
};

const updateViewportMetrics = (): void => {
  if (typeof window === 'undefined') return;
  const viewport = window.visualViewport;
  const metrics = calculateMobileViewportMetrics({
    innerHeight: window.innerHeight,
    offsetTop: viewport?.offsetTop,
    viewportHeight: viewport?.height ?? window.innerHeight
  });
  visualHeight = metrics.visualHeight;
  keyboardOpen = metrics.keyboardOpen;
  document.documentElement.style.setProperty('--mobile-visual-height', `${visualHeight}px`);
  document.documentElement.style.setProperty(
    '--mobile-keyboard-height',
    `${metrics.obscuredHeight}px`
  );
};

export const observeMobileViewport = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const viewport = window.visualViewport;
  updateViewportMetrics();
  viewport?.addEventListener('resize', updateViewportMetrics);
  viewport?.addEventListener('scroll', updateViewportMetrics);
  window.addEventListener('orientationchange', updateViewportMetrics);
  window.addEventListener('resize', updateViewportMetrics);
  return () => {
    viewport?.removeEventListener('resize', updateViewportMetrics);
    viewport?.removeEventListener('scroll', updateViewportMetrics);
    window.removeEventListener('orientationchange', updateViewportMetrics);
    window.removeEventListener('resize', updateViewportMetrics);
    document.documentElement.style.removeProperty('--mobile-visual-height');
    document.documentElement.style.removeProperty('--mobile-keyboard-height');
  };
};
