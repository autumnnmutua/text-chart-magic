import { describe, expect, it } from 'vitest';
import {
  calculateMobileSheetStops,
  calculateMobileViewportMetrics
} from './mobileWorkspace.svelte';

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

describe('手机底部面板高度', () => {
  it.each([160, 240, 390, 844])('在 %i px 高度下不会超出可视区', (height) => {
    const stops = calculateMobileSheetStops(height);
    expect(stops.collapsed).toBeLessThanOrEqual(stops.expanded);
    expect(stops.expanded).toBeLessThanOrEqual(Math.max(1, height - 8));
    expect(stops.collapsed).toBeGreaterThan(0);
  });

  it('在常见竖屏下保留可拖动的收起与展开区间', () => {
    const stops = calculateMobileSheetStops(844);
    expect(stops.expanded - stops.collapsed).toBeGreaterThan(150);
  });
});
