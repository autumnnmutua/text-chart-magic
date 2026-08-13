import { describe, expect, it } from 'vitest';
import { parse } from './mermaid';
import {
  addXYCategory,
  addXYSeries,
  moveXYCategory,
  moveXYSeries,
  parseXYChart,
  parseXYSeriesValues,
  removeXYCategory,
  removeXYSeries,
  updateXYAxis,
  updateXYCategory,
  updateXYSeries,
  updateXYValue,
  updateXYXAxis
} from './xyChart';

const example = `xychart-beta
  title "月度订单趋势"
  x-axis "月份（单位：月）" ["一月", "二月", "三月"]
  y-axis "订单数量（单位：单）" 0 --> 1200
  bar "实际订单" [520, 610, 720]
  line "计划订单" [500, 640, 700]
`;

describe('xyChart', () => {
  it('parses horizontal and vertical axis metadata, units and named series', () => {
    expect(parseXYChart(example)).toMatchObject({
      series: [
        { label: '实际订单', type: 'bar', values: [520, 610, 720] },
        { label: '计划订单', type: 'line', values: [500, 640, 700] }
      ],
      xAxis: { label: '月份', unit: '月' },
      xLabels: ['一月', '二月', '三月'],
      yAxis: { label: '订单数量', max: 1200, min: 0, unit: '单' }
    });
  });

  it('adds, edits, reorders and removes every Y series without changing X categories', async () => {
    const added = addXYSeries(example, 'line');
    expect(added).toContain('line "新数据系列 1" [0, 0, 0]');

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
    const removedToEmpty = removeXYSeries(removeXYSeries(removed ?? '', 1) ?? '', 0);
    expect(parseXYChart(removedToEmpty ?? '')?.series).toHaveLength(0);
    await expect(parse(removedToEmpty ?? '')).resolves.toBeDefined();
  });

  it('updates individual numbers and both axis names, units and range', async () => {
    const xAxis = updateXYXAxis(example, { label: '结算月份', unit: '月' });
    expect(xAxis).toContain('x-axis "结算月份（单位：月）"');
    const yAxis = updateXYAxis(xAxis ?? '', {
      label: '成交订单',
      max: 1600,
      min: 100,
      unit: '笔'
    });
    expect(yAxis).toContain('y-axis "成交订单（单位：笔）" 100 --> 1600');
    const value = updateXYValue(yAxis ?? '', 0, 1, 888.5);
    expect(value).toContain('bar "实际订单" [520, 888.5, 720]');
    expect(updateXYValue(example, 0, 9, 10)).toBeUndefined();
    expect(parseXYSeriesValues('10, 20, 30', 3)).toEqual([10, 20, 30]);
    expect(updateXYAxis(example, { max: 0, min: 100 })).toBeUndefined();
    await expect(parse(value ?? '')).resolves.toBeDefined();
  });

  it('adds, edits, reorders and removes X categories with all values kept aligned', async () => {
    const added = addXYCategory(example);
    expect(added).toContain('"新分类 1"');
    expect(added).toContain('bar "实际订单" [520, 610, 720, 0]');
    expect(added).toContain('line "计划订单" [500, 640, 700, 0]');

    const renamed = updateXYCategory(added ?? '', 3, '四月');
    expect(renamed).toContain('"四月"');
    const withValue = updateXYValue(renamed ?? '', 0, 3, 830);
    const moved = moveXYCategory(withValue ?? '', 3, -1);
    expect(parseXYChart(moved ?? '')).toMatchObject({
      xLabels: ['一月', '二月', '四月', '三月'],
      series: [{ values: [520, 610, 830, 720] }, { values: [500, 640, 0, 700] }]
    });
    const removed = removeXYCategory(moved ?? '', 1);
    expect(parseXYChart(removed ?? '')).toMatchObject({
      xLabels: ['一月', '四月', '三月'],
      series: [{ values: [520, 830, 720] }, { values: [500, 0, 700] }]
    });
    await expect(parse(removed ?? '')).resolves.toBeDefined();
  });

  it('keeps legacy unnamed series and axes editable', () => {
    const legacy = `xychart-beta
  x-axis ["A", "B"]
  bar [1, 2]
  line [2, 3]`;
    expect(parseXYChart(legacy)).toMatchObject({
      xAxis: { label: '横坐标', unit: '' },
      yAxis: { label: '纵坐标', unit: '' },
      series: [{ label: '柱状系列 1' }, { label: '折线系列 1' }]
    });
    expect(updateXYSeries(legacy, 0, { label: '收入' })).toContain('bar "收入" [1, 2]');
    expect(updateXYXAxis(legacy, { label: '季度', unit: '季' })).toContain(
      'x-axis "季度（单位：季）" ["A", "B"]'
    );
  });
});
