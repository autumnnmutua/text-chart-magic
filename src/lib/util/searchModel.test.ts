import { describe, expect, it } from 'vitest';
import { searchEditableSourceText } from './searchModel';

const options = { caseSensitive: false, wholeWord: false };

describe('diagram source search model', () => {
  it('searches Chinese labels and relation text without returning overlapping line matches', () => {
    const code = `flowchart LR
  A[创建订单] -->|提交订单| B[审核订单]`;
    const results = searchEditableSourceText(code, '订单', options);

    expect(results.map(({ containerText }) => containerText)).toEqual([
      '创建订单',
      '提交订单',
      '审核订单'
    ]);
    expect(results).toHaveLength(3);
  });

  it('supports case-sensitive and Unicode whole-word matching', () => {
    const code = `flowchart LR
  A[API api APIClient]
  B[中文 中文词]`;

    expect(
      searchEditableSourceText(code, 'API', { caseSensitive: true, wholeWord: true })
    ).toHaveLength(1);
    expect(
      searchEditableSourceText(code, 'api', { caseSensitive: false, wholeWord: true })
    ).toHaveLength(2);
    expect(
      searchEditableSourceText(code, '中文', { caseSensitive: false, wholeWord: true })
    ).toHaveLength(1);
  });

  it('treats regular-expression characters as plain search text', () => {
    const code = `flowchart LR
  A[金额 (含税) + 5%]`;

    expect(searchEditableSourceText(code, '(含税) +', options)).toHaveLength(1);
  });

  it('tracks duplicate labels by rendered element instead of by match count', () => {
    const code = `flowchart LR
  A[订单订单] --> B[订单订单]`;
    const results = searchEditableSourceText(code, '订单', options);

    expect(results.map(({ occurrence }) => occurrence)).toEqual([0, 0, 1, 1]);
  });

  it('does not expose structural node ids or requirement id fields for replacement', () => {
    const code = `flowchart LR
  InternalA[公开名称] --> InternalB[目标]

requirementDiagram
  requirement req_checkout {
    id: REQ-001
    text: 用户结算
  }`;

    expect(searchEditableSourceText(code, 'InternalA', options)).toHaveLength(0);
    expect(searchEditableSourceText(code, 'REQ-001', options)).toHaveLength(0);
    expect(searchEditableSourceText(code, '用户结算', options)).toHaveLength(1);
  });

  it('does not expose coordinates, numeric series or style configuration', () => {
    const code = `quadrantChart
  快速结算: [0.2, 0.8]
flowchart LR
  A[公开名称]
  style A fill:#fff7ed
xychart-beta
  line [12, 18, 24]`;

    expect(searchEditableSourceText(code, '快速结算', options)).toHaveLength(1);
    expect(searchEditableSourceText(code, '0.2', options)).toHaveLength(0);
    expect(searchEditableSourceText(code, 'fff7ed', options)).toHaveLength(0);
    expect(searchEditableSourceText(code, '18', options)).toHaveLength(0);
  });

  it('returns no results for empty or overlong unmatched input', () => {
    expect(searchEditableSourceText('flowchart LR\n A[测试]', '', options)).toEqual([]);
    expect(searchEditableSourceText('flowchart LR\n A[测试]', 'x'.repeat(800), options)).toEqual(
      []
    );
  });
});
