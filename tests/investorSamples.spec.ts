import { investorSamples } from '../src/lib/util/investorSamples';
import { expect, test } from './test';

const renderedLabelByTitle: Record<string, string> = {
  'C4 系统关系图': '业务 API',
  'SaaS 产品系统架构': '核心业务服务',
  创业产品路线图: '核心功能开发',
  市场机会矩阵: '自然语言生成图表',
  用户增长旅程: '创建第一张图表',
  'AI 产品工作流': 'AI 编排引擎'
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
        await expect(page.locator('#view svg')).toBeVisible();
        await expect(page.locator('#view')).toContainText(renderedLabelByTitle[sample.title], {
          timeout: 15_000
        });
        if (sample.title === 'SaaS 产品系统架构') {
          await expect(page.locator('#view')).toContainText('高速缓存');
          await expect(page.locator('#view')).toContainText('文件存储');
          await expect(page.locator('#view')).not.toContainText('平台服务层0');
        }
      });
    }
  });

  test('AI 产品工作流保留可编辑箭头，并能整体重置为模板状态', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'AI 产品工作流', exact: true }).click();
    const arrows = page.locator('#view g[data-visual-connection]');
    await expect(arrows).toHaveCount(8);

    await arrows.filter({ hasText: '持续优化' }).click();
    await page.getByTestId('connection-toolbar').getByRole('button', { name: '删除箭头' }).click();
    await expect(arrows).toHaveCount(7);
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expect(arrows).toHaveCount(8);
    await expect(arrows.filter({ hasText: '持续优化' })).toBeVisible();
  });
});
