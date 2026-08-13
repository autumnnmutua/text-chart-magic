import { expect, test, type Page } from '@playwright/test';
import { investorSamples } from '../src/lib/util/investorSamples';
import { setEditorCode, TEST_BASE_URL } from './utils';

const normalizeCode = (value: string): string =>
  value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

const readPersistedCode = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('codeStore');
    return raw
      ? ((JSON.parse(raw) as { code?: string }).code ?? '')
          .replace(/\r/g, '')
          .split('\n')
          .map((line) => line.trim())
          .join('\n')
          .trim()
      : '';
  });

const expectNoPageOverflow = async (page: Page): Promise<void> => {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
};

test.describe('代码编辑器显示与响应式布局', () => {
  test('桌面端首次加载、标签切换和窗口缩放后仍可显示并编辑', async ({ page }) => {
    await page.goto('/');

    const editor = page.getByTestId('desktop-code-editor');
    const visibleLines = editor.locator('.view-lines');
    await expect(editor).toBeVisible();
    await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(180);
    await expect(visibleLines).not.toBeEmpty();
    await expect(visibleLines).toContainText(/\S+/);

    await editor.click();
    await expect(editor.getByRole('textbox')).toBeFocused();

    const editedCode = 'flowchart LR\n  A[代码可编辑] --> B[预览已更新]\n';
    await setEditorCode(page, editedCode);
    await expect.poll(() => readPersistedCode(page)).toBe(normalizeCode(editedCode));
    await expect(page.locator('#view')).toContainText('代码可编辑');

    await page.getByRole('tab', { name: '配置' }).click();
    await expect.poll(() => visibleLines.textContent()).toContain('theme');
    await page.getByRole('tab', { name: '代码' }).click();
    await expect(visibleLines).toContainText('代码可编辑');

    for (const viewport of [
      { height: 600, width: 900 },
      { height: 900, width: 1440 }
    ]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(180);
      await expect(visibleLines).toContainText('代码可编辑');
      await expectNoPageOverflow(page);
    }
  });

  test('手机竖屏、横屏和平板尺寸均能显示、编辑并重新测量代码', async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({
      baseURL: TEST_BASE_URL,
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 }
    });
    const page = await context.newPage();

    try {
      await page.goto('/');
      const viewSwitch = page.getByRole('switch');
      if (await viewSwitch.isChecked()) await viewSwitch.tap();

      const editor = page.getByTestId('mobile-code-editor');
      const content = editor.locator('.cm-content');
      await expect(editor).toBeVisible();
      await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(180);
      await expect(content).toContainText(/\S+/);
      await content.focus();
      await expect(content).toBeFocused();

      const sankey = investorSamples.find(({ diagramType }) => diagramType === 'Sankey');
      expect(sankey).toBeDefined();
      if (!sankey) throw new Error('Sankey investor sample is missing.');
      await setEditorCode(page, sankey.state.code, { waitForRender: false });
      await expect.poll(() => readPersistedCode(page)).toBe(normalizeCode(sankey.state.code));

      await page.getByRole('tab', { name: '配置' }).tap();
      await expect.poll(() => content.textContent()).toContain('theme');
      await page.getByRole('tab', { name: '代码' }).tap();
      await expect(content).toContainText('sankey-beta');

      for (const viewport of [
        { height: 390, width: 844 },
        { height: 1024, width: 768 },
        { height: 932, width: 430 }
      ]) {
        await page.setViewportSize(viewport);
        await expect(editor).toBeVisible();
        await expect
          .poll(async () => (await editor.boundingBox())?.height ?? 0)
          .toBeGreaterThan(130);
        await expect(content).toContainText('sankey-beta');
        await expectNoPageOverflow(page);
      }

      if (!(await viewSwitch.isChecked())) await viewSwitch.tap();
      await expect(page.locator('#view svg')).toBeVisible();
      await expect(page.locator('#view')).toContainText('搜索引擎');
      await expect(page.locator('#view')).toContainText('AI 对话');
      await expect(page.locator('#view')).toContainText('付费转化');
      await expectNoPageOverflow(page);

      await page.setViewportSize({ height: 390, width: 844 });
      await expect
        .poll(() =>
          page.locator('#view svg').evaluate((svg) => {
            const viewport = svg.getBoundingClientRect();
            const items = [...svg.querySelectorAll('rect, text')]
              .map((element) => element.getBoundingClientRect())
              .filter(({ height, width }) => height > 0 && width > 0);
            if (items.length === 0) return 0;
            const left = Math.min(...items.map((item) => item.left));
            const right = Math.max(...items.map((item) => item.right));
            return (right - left) / viewport.width;
          })
        )
        .toBeGreaterThan(0.45);
      await expectNoPageOverflow(page);
    } finally {
      await context.close();
    }
  });
});
