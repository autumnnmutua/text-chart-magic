import type { Page } from '@playwright/test';
import { investorSamples } from '../src/lib/util/investorSamples';
import { expect, test } from './test';
import { setEditorCode } from './utils';

const renderedLabelByTitle: Record<string, string> = {
  'C4 系统关系图': '业务 API',
  'SaaS 产品系统架构': '核心业务服务',
  创业产品路线图: '核心功能开发',
  市场机会矩阵: '自然语言生成图表',
  用户增长旅程: '创建第一张图表',
  'AI 产品转化桑基图': 'AI 对话'
};

const normalizeCode = (value: string): string => value.replace(/\r/g, '').trimEnd();

const expectSankeyInsideViewport = async (page: Page) => {
  await expect
    .poll(() =>
      page.locator('#container > svg').evaluate((svg) => {
        const viewport = svg.getBoundingClientRect();
        const content = [...svg.querySelectorAll('rect, text')]
          .map((element) => element.getBoundingClientRect())
          .filter(({ height, width }) => height > 0 && width > 0);
        return content.every(
          ({ bottom, left, right, top }) =>
            left >= viewport.left - 1 &&
            right <= viewport.right + 1 &&
            top >= viewport.top - 1 &&
            bottom <= viewport.bottom + 1
        );
      })
    )
    .toBe(true);
};

test.describe('精选示例', () => {
  test('六份完成体可以从真实状态加载并继续编辑', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await expect(page.getByText('精选示例', { exact: true })).toBeVisible();

    for (const sample of investorSamples) {
      await test.step(sample.title, async () => {
        await page.getByRole('button', { name: sample.title, exact: true }).click();
        await expect
          .poll(() =>
            page.evaluate(() => {
              const raw = localStorage.getItem('codeStore');
              return raw ? (JSON.parse(raw) as { code?: string }).code : '';
            })
          )
          .toBe(sample.state.code);
        await expect(page.locator('#view')).not.toHaveClass(/opacity-50/);
        await expect(page.locator('#container > svg')).toBeVisible();
        await expect(page.locator('#view')).toContainText(renderedLabelByTitle[sample.title], {
          timeout: 15_000
        });
        await expect(page.getByTestId('sample-description')).toContainText(
          sample.state.sampleDescription ?? ''
        );
        if (sample.title === 'SaaS 产品系统架构') {
          await expect(page.locator('#view')).toContainText('高速缓存');
          await expect(page.locator('#view')).toContainText('文件存储');
          await expect(page.locator('#view')).not.toContainText('平台服务层0');
        }
      });
    }
  });

  test('AI 产品转化桑基图保留三层权重，并能整体编辑和重置', async ({ page }) => {
    const sample = investorSamples.find(({ diagramType }) => diagramType === 'Sankey');
    expect(sample).toBeDefined();
    if (!sample) throw new Error('Sankey investor sample is missing.');
    await page.goto('/');
    await page.getByRole('button', { name: 'AI 产品转化桑基图', exact: true }).click();

    await expect(page.locator('#view')).toContainText('搜索引擎');
    await expect(page.locator('#view')).toContainText('AI 对话');
    await expect(page.locator('#view')).toContainText('付费转化');
    await expect(page.locator('#container > svg .link')).toHaveCount(24);
    await expectSankeyInsideViewport(page);

    const modified = sample.state.code.replace('内容推荐,数据分析,10\n', '内容推荐,数据分析,9\n');
    await setEditorCode(page, modified);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('codeStore');
          return raw
            ? ((JSON.parse(raw) as { code?: string }).code ?? '').replace(/\r/g, '').trimEnd()
            : '';
        })
      )
      .toBe(normalizeCode(modified));

    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('codeStore');
          return raw
            ? ((JSON.parse(raw) as { code?: string }).code ?? '').replace(/\r/g, '').trimEnd()
            : '';
        })
      )
      .toBe(normalizeCode(sample.state.code));
    await expect(page.locator('#container > svg .link')).toHaveCount(24);
    await expectSankeyInsideViewport(page);
  });

  test('示例说明可以独立编辑、删除并撤回，不会改变图表数据', async ({ page }) => {
    const sample = investorSamples[0];
    await page.goto('/');
    await page.getByRole('button', { name: sample.title, exact: true }).click();
    const codeBefore = await page.evaluate(() => {
      const raw = localStorage.getItem('codeStore');
      return raw ? (JSON.parse(raw) as { code?: string }).code : '';
    });

    await page.getByRole('button', { name: '编辑示例说明' }).click();
    await page.getByLabel('编辑示例说明').fill('这是可编辑的投资人示例说明。');
    await page.getByRole('button', { name: '保存说明' }).click();
    await expect(page.getByTestId('sample-description')).toContainText(
      '这是可编辑的投资人示例说明。'
    );

    await page.getByRole('button', { name: '删除示例说明' }).click();
    await expect(page.getByTestId('sample-description')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('codeStore');
          if (!raw) return undefined;
          const state = JSON.parse(raw) as { code?: string; sampleDescription?: string };
          return { code: state.code, description: state.sampleDescription };
        })
      )
      .toEqual({ code: codeBefore, description: undefined });

    await page.getByRole('button', { name: '撤回', exact: true }).click();
    await expect(page.getByTestId('sample-description')).toContainText(
      sample.state.sampleDescription ?? ''
    );
  });
});
