import { expect, test, type Page } from '@playwright/test';
import { localizedDiagramSamples } from '../src/lib/util/diagramSamples';
import { serializeState } from '../src/lib/util/serde';

const sampleURL = (code: string) =>
  `/edit#${serializeState({
    code,
    grid: true,
    mermaid: '{"theme":"default"}',
    panZoom: true,
    rough: false,
    updateDiagram: true
  })}`;

const openSample = async (page: Page, type: keyof typeof localizedDiagramSamples) => {
  await page.goto(sampleURL(localizedDiagramSamples[type][0].code));
  await expect(page.locator('#view svg').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('#view')?.getAttribute('aria-busy') !== 'true'
  );
};

const storedCode = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const saved = localStorage.getItem('codeStore');
    return saved ? (JSON.parse(saved) as { code: string }).code : '';
  });

const viewportTransform = async (page: Page): Promise<number[]> => {
  const transform = await page
    .locator('#view svg .svg-pan-zoom_viewport')
    .first()
    .evaluate((element) => element.getAttribute('transform') ?? '');
  return (transform.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
};

const expectSameViewport = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 3));
};

const editViewText = async (page: Page, from: string, to: string) => {
  await page.locator('#view').getByText(from, { exact: true }).first().dblclick({ force: true });
  const input = page.getByLabel('图中文字编辑');
  await expect(input).toBeVisible();
  await input.fill(to);
  await page.keyboard.press('Enter');
  await expect.poll(() => storedCode(page)).toContain(to);
  await expect(page.locator('#view')).toContainText(to);
};

test.describe('缺陷回归', () => {
  test('连续修改图上文字不会让画布跳动、缩放或裁切', async ({ page }) => {
    const chartInsideView = () =>
      page.evaluate(() => {
        const chart = document
          .querySelector('#view svg .svg-pan-zoom_viewport')
          ?.getBoundingClientRect();
        const view = document.querySelector('#view')?.getBoundingClientRect();
        if (!chart || !view) return false;
        return (
          chart.left >= view.left - 1 &&
          chart.right <= view.right + 1 &&
          chart.top >= view.top - 1 &&
          chart.bottom <= view.bottom + 1
        );
      });

    await openSample(page, 'XY');
    await editViewText(page, '二月', '二月份');
    await page.waitForTimeout(600);
    const fitted = await viewportTransform(page);
    expect(await chartInsideView()).toBe(true);

    // Before the fix the second edit restored a stale viewport captured while
    // svg-pan-zoom was being destroyed, so the chart jumped and got cropped.
    await editViewText(page, '三月', '三月份');
    await editViewText(page, '四月', '四月份');
    await page.waitForTimeout(600);
    expectSameViewport(await viewportTransform(page), fitted);
    expect(await chartInsideView()).toBe(true);

    await page.getByRole('button', { name: /放大/ }).first().click();
    await page.waitForTimeout(300);
    const zoomed = await viewportTransform(page);
    expect(zoomed[0]).toBeGreaterThan(fitted[0]);
    await editViewText(page, '五月', '五月份');
    await editViewText(page, '六月', '六月份');
    await page.waitForTimeout(400);
    expectSameViewport(await viewportTransform(page), zoomed);
  });

  test('打开 ZenUML 后工作台主题色不会被其全局样式覆盖', async ({ page }) => {
    await openSample(page, 'Flowchart');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await openSample(page, 'ZenUML');
    await expect(page.locator('#view')).toContainText('OrderService');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      background
    );
  });

  test('ZenUML 参与者可以改成中文名称', async ({ page }) => {
    await openSample(page, 'ZenUML');
    await editViewText(page, 'Customer', '顾客');
    const code = await storedCode(page);
    expect(code).toContain('@Actor 顾客');
    expect(code).toContain('@Starter(顾客)');
  });

  test('XY 图新增横坐标会同步补齐带名称的数据系列且不产生 NaN', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('NaN')) errors.push(message.text());
    });
    await openSample(page, 'XY');
    await page.locator('#view').getByText('六月', { exact: true }).first().click({ force: true });
    await page.getByRole('button', { exact: true, name: '分支' }).click();
    await expect.poll(() => storedCode(page)).toContain('"新分支"]');
    const code = await storedCode(page);
    expect(code).toContain('bar "实际订单" [520, 610, 720, 860, 980, 1100, 0]');
    expect(code).toContain('line "计划订单" [500, 640, 700, 900, 960, 1150, 0]');
    await expect(page.locator('#view')).toContainText('新分支');
    expect(errors).toEqual([]);
  });

  test('甘特图删除被依赖的任务后，后续任务改为继承其开始时间', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('NaN')) errors.push(message.text());
    });
    await openSample(page, 'Gantt');
    await page
      .locator('#view')
      .getByText('接口联调', { exact: true })
      .first()
      .click({ force: true });
    await page.getByRole('button', { exact: true, name: '删除' }).click();
    await expect.poll(() => storedCode(page)).not.toContain('接口联调');
    expect(await storedCode(page)).toContain('验收测试 :crit, test, after develop, 3d');
    await expect(page.locator('#view')).toContainText('验收测试');
    expect(errors).toEqual([]);
  });

  test('靠近底部的元素，删除按钮不会被底部选择工具栏遮挡', async ({ page }) => {
    await openSample(page, 'Ishikawa');
    await page.locator('#view').getByText('人员', { exact: true }).first().click({ force: true });
    const deleteButton = page.getByRole('button', { exact: true, name: '删除' });
    await expect(deleteButton).toBeVisible();
    const toolbar = await page.getByTestId('selection-toolbar').boundingBox();
    const button = await deleteButton.boundingBox();
    expect(toolbar && button && button.y + button.height <= toolbar.y).toBeTruthy();
    await deleteButton.click();
    await expect.poll(() => storedCode(page)).not.toContain('高峰期排班不足');
  });

  test('用鼠标点击两个模块创建的自主箭头会连接到目标模块', async ({ page }) => {
    await page.goto(sampleURL('block-beta\n  columns 3\n  A["入口"]\n  space\n  B["处理"]'));
    await expect(page.locator('#view g.node[data-style-id="B"]')).toBeVisible({ timeout: 30_000 });
    await page
      .getByTestId('workspace-quick-toolbar')
      .getByRole('button', { name: '添加自主箭头' })
      .click();
    const source = await page.locator('#view g.node[data-style-id="A"]').boundingBox();
    const target = await page.locator('#view g.node[data-style-id="B"]').boundingBox();
    if (!source || !target) throw new Error('模块没有可点击坐标。');
    await page.mouse.click(source.x + source.width / 2, source.y + source.height / 2);
    // The preview line follows the cursor and ends right under it.
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            visualConnections?: Record<
              string,
              { source: { elementId?: string }; target: { elementId?: string } }
            >;
          };
          return Object.values(state.visualConnections ?? {}).map(({ source, target }) => [
            source.elementId,
            target.elementId
          ]);
        })
      )
      .toEqual([['A', 'B']]);
  });

  test('按住 Shift 点击自由布局模块可以累加多选', async ({ page }) => {
    await page.goto(sampleURL('block-beta\n  columns 3\n  A["甲"]\n  B["乙"]\n  C["丙"]'));
    await expect(page.locator('#view g.node[data-style-id="C"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('#view g.node[data-style-id="A"]').click({ force: true });
    await expect(page.getByTestId('selection-toolbar')).toContainText('已选 1 项');
    await page
      .locator('#view g.node[data-style-id="B"]')
      .click({ force: true, modifiers: ['Shift'] });
    await expect(page.getByTestId('selection-toolbar')).toContainText('已选 2 项');
    await page
      .locator('#view g.node[data-style-id="C"]')
      .click({ force: true, modifiers: ['Shift'] });
    await expect(page.getByTestId('selection-toolbar')).toContainText('已选 3 项');
    await page
      .locator('#view g.node[data-style-id="B"]')
      .click({ force: true, modifiers: ['Shift'] });
    await expect(page.getByTestId('selection-toolbar')).toContainText('已选 2 项');
  });

  test('点击上下两个模块的文字创建箭头时，箭头从下边连到上边而不绕回起点', async ({ page }) => {
    await page.goto(sampleURL('flowchart TD\n  A[入口] --> B[处理]'));
    await expect(page.locator('#view').getByText('处理', { exact: true })).toBeVisible({
      timeout: 30_000
    });
    await page
      .getByTestId('workspace-quick-toolbar')
      .getByRole('button', { name: '添加自主箭头' })
      .click();
    await page.locator('#view').getByText('入口', { exact: true }).click({ force: true });
    await page.locator('#view').getByText('处理', { exact: true }).click({ force: true });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            visualConnections?: Record<
              string,
              { source: { anchor?: string }; target: { anchor?: string } }
            >;
          };
          return Object.values(state.visualConnections ?? {}).map(({ source, target }) => [
            source.anchor,
            target.anchor
          ]);
        })
      )
      .toEqual([['bottom', 'top']]);
  });
});
