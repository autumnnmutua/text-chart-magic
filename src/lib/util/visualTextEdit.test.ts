import { describe, expect, it } from 'vitest';
import { findVisualTextRange, getEditableVisualLabel } from './visualTextEdit';

describe('visual text edit mapping', () => {
  it('removes renderer-only pie values before matching source labels', () => {
    const code = `pie showData title 订单来源占比
  "移动应用" : 45`;
    const label = getEditableVisualLabel(code, '移动应用 [45]');

    expect(label).toBe('移动应用');
    expect(findVisualTextRange(code, { text: label })).toEqual({
      start: code.indexOf('移动应用'),
      end: code.indexOf('移动应用') + '移动应用'.length
    });
  });

  it('normalizes requirement field captions without changing ordinary labels', () => {
    expect(
      getEditableVisualLabel(
        `requirementDiagram
  requirement order {
    risk: medium
  }`,
        'Risk: Medium'
      )
    ).toBe('Medium');
    expect(getEditableVisualLabel('flowchart LR\n  A[订单]', '订单')).toBe('订单');
  });

  it('removes renderer-only Sankey totals while preserving numbers in labels', () => {
    const code = `sankey-beta
"阶段 1","浏览商品",1000`;

    expect(getEditableVisualLabel(code, '浏览商品 1000')).toBe('浏览商品');
    expect(getEditableVisualLabel(code, '阶段 1 1000')).toBe('阶段 1');
    expect(
      findVisualTextRange(code, {
        sourceId: 'text-21',
        text: getEditableVisualLabel(code, '浏览商品 1000')
      })
    ).toBeDefined();
  });
});
