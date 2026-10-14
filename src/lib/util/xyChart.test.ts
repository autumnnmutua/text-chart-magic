import { describe, expect, it } from 'vitest';
import { parse } from './mermaid';
import {
  addXYCategory,
  addXYSeries,
  moveXYSeries,
  parseXYChart,
  parseXYSeriesValues,
  removeXYCategory,
  removeXYSeries,
  updateXYAxis,
  updateXYSeries
} from './xyChart';

const example = `xychart-beta
  title "月度订单趋势"
  x-axis ["一月", "二月", "三月"]
  y-axis "订单数量" 0 --> 1200
  bar "实际订单" [520, 610, 720]
  line "计划订单" [500, 640, 700]
`;

describe('xyChart', () => {
  it('parses axis metadata and named vertical series', () => {
    expect(parseXYChart(example)).toMatchObject({
      series: [
        { label: '实际订单', type: 'bar', values: [520, 610, 720] },
        { label: '计划订单', type: 'line', values: [500, 640, 700] }
      ],
      xLabels: ['一月', '二月', '三月'],
      yAxis: { label: '订单数量', max: 1200, min: 0 }
    });
  });

  it('adds, edits, reorders and removes a Y series without changing X categories', async () => {
    const added = addXYSeries(example, 'line');
    expect(added).toContain('line "新纵坐标 1" [0, 0, 0]');
    expect(parseXYChart(added ?? '')?.xLabels).toEqual(['一月', '二月', '三月']);

    const renamed = updateXYSeries(added ?? '', 2, {
      label: '退款订单',
      type: 'bar',
      values: [12, 18, 15]
    });
    expect(renamed).toContain('bar "退款订单" [12, 18, 15]');

    const moved = moveXYSeries(renamed ?? '', 2, -1);
    expect(moved?.indexOf('退款订单')).toBeLessThan(moved?.indexOf('计划订单') ?? 0);

    const removed = removeXYSeries(moved ?? '', 1);
    expect(removed).not.toContain('退款订单');
    expect(removed).toContain('x-axis ["一月", "二月", "三月"]');
    await expect(parse(removed ?? '')).resolves.toBeDefined();
  });

  it('updates the Y-axis title and range and rejects invalid value counts', async () => {
    const updated = updateXYAxis(example, { label: '成交订单', max: 1600, min: 100 });
    expect(updated).toContain('y-axis "成交订单" 100 --> 1600');
    expect(parseXYSeriesValues('10, 20, 30', 3)).toEqual([10, 20, 30]);
    expect(parseXYSeriesValues('10, 20', 3)).toBeUndefined();
    expect(updateXYAxis(example, { max: 0, min: 100 })).toBeUndefined();
    await expect(parse(updated ?? '')).resolves.toBeDefined();
  });

  it('keeps legacy unnamed series editable and upgrades them when renamed', () => {
    const legacy = `xychart-beta
  x-axis ["A", "B"]
  bar [1, 2]
  line [2, 3]`;
    expect(parseXYChart(legacy)?.series.map(({ label }) => label)).toEqual([
      '柱状系列 1',
      '折线系列 1'
    ]);
    expect(updateXYSeries(legacy, 0, { label: '收入' })).toContain('bar "收入" [1, 2]');
  });
});

describe('XY categories with titled axes', () => {
  it('reads x-axis labels when the axis has a title', () => {
    const model = parseXYChart(`xychart-beta
  x-axis "月份" ["一月", "二月"]
  bar "收入" [1, 2]`);
    expect(model?.xLabels).toEqual(['一月', '二月']);
    expect(model?.series[0].label).toBe('收入');
  });

  it('adds categories to an existing chart without an x-axis line', () => {
    const next = addXYCategory(
      `xychart-beta
  bar [1, 2]`,
      '新分支'
    );
    expect(next).toContain('x-axis ["1", "2", "新分支"]');
    expect(next).toContain('bar [1, 2, 0]');
  });

  it('refuses to remove the last remaining category', () => {
    expect(
      removeXYCategory(
        `xychart-beta
  x-axis ["一月"]
  bar [1]`,
        '一月'
      )
    ).toBeUndefined();
  });
});

describe('XY y-axis without a range', () => {
  it('keeps a single y-axis line when a range is added to a title-only axis', async () => {
    const code = `xychart-beta
  x-axis ["一月", "二月"]
  y-axis "订单数量"
  bar [10, 20]`;
    expect(parseXYChart(code)?.yAxis.label).toBe('订单数量');
    const next = updateXYAxis(code, { max: 50 }) ?? '';
    expect(next.match(/y-axis/g)).toHaveLength(1);
    expect(next).toContain('y-axis "订单数量" 0 --> 50');
    await expect(parse(next)).resolves.toBeDefined();
  });
});
