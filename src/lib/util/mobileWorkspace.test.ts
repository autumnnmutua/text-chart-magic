import { describe, expect, it } from 'vitest';
import { calculateMobileViewportMetrics } from './mobileWorkspace.svelte';

describe('手机可视视口', () => {
  it('区分地址栏轻微变化与虚拟键盘遮挡', () => {
    expect(calculateMobileViewportMetrics({ innerHeight: 844, viewportHeight: 844 })).toEqual({
      keyboardOpen: false,
      obscuredHeight: 0,
      visualHeight: 844
    });
    expect(calculateMobileViewportMetrics({ innerHeight: 844, viewportHeight: 740 })).toEqual({
      keyboardOpen: false,
      obscuredHeight: 104,
      visualHeight: 740
    });
    expect(calculateMobileViewportMetrics({ innerHeight: 844, viewportHeight: 520 })).toEqual({
      keyboardOpen: true,
      obscuredHeight: 324,
      visualHeight: 520
    });
  });

  it('计入刘海屏与键盘推动视口产生的顶部偏移', () => {
    expect(
      calculateMobileViewportMetrics({
        innerHeight: 932,
        offsetTop: 24,
        viewportHeight: 590
      })
    ).toEqual({ keyboardOpen: true, obscuredHeight: 318, visualHeight: 590 });
  });
});
