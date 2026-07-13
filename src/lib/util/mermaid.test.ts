import { describe, expect, it } from 'vitest';
import { getSampleDiagrams, parse } from './mermaid';

describe('getSampleDiagrams', () => {
  const samples = getSampleDiagrams();

  it('should return at least one example per diagram', () => {
    expect(Object.keys(samples).length).toBeGreaterThan(0);
    for (const [name, examples] of Object.entries(samples)) {
      expect(examples.length, `${name} should have at least one example`).toBeGreaterThan(0);
      for (const example of examples) {
        expect(example.title, `${name} has an example without a title`).toBeTruthy();
        expect(example.code, `${name} example "${example.title}" has no code`).toBeTruthy();
      }
    }
  });

  it('should list the default example first', () => {
    for (const [name, examples] of Object.entries(samples)) {
      expect(examples[0].isDefault, `${name} should have its default example first`).toBe(true);
    }
  });

  it('parses Chinese Sankey labels without changing the stored source', async () => {
    await expect(
      parse(`sankey-beta

"访问首页","浏览商品",1000
"浏览商品","完成购买",650`)
    ).resolves.toBeTruthy();
  });

  it('parses overlapping Chinese Wardley component names without partial replacement', async () => {
    await expect(
      parse(`wardley-beta
title 支付能力地图
anchor 用户 [0.95, 0.50]
component 支付 [0.70, 0.50]
component 支付网关 [0.45, 0.70]
用户 -> 支付
支付 -> 支付网关`)
    ).resolves.toBeTruthy();
  });
});
