import { expect, test } from './test';
import { setEditorCode } from './utils';

const blockDiagram = (count: number): string => {
  // Playwright's insertText follows CodeMirror's auto-indent rules. Keeping this
  // fixture left-aligned prevents each synthetic newline from accumulating
  // whitespace and turning a 3 KB benchmark into a 60+ KB input.
  const nodes = Array.from({ length: count }, (_, index) => `N${index}["M${index + 1}"]`);
  const edges = Array.from(
    { length: Math.floor(Math.max(count - 1, 0) / 4) },
    (_, index) => `N${index * 4} --> N${index * 4 + 1}`
  );
  return ['block-beta', 'columns 10', ...nodes, ...edges].join('\n');
};

test.describe('大型图表性能守护', () => {
  for (const count of [20, 100, 200]) {
    test(`${count} 个模块下仍可渲染并完成一次事务式拖拽`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto('/');
      await page.waitForSelector('#view svg');
      const source = blockDiagram(count);
      const renderStart = performance.now();
      await setEditorCode(page, source);
      await page.waitForFunction(
        (expected) =>
          !document.querySelector('#view')?.classList.contains('opacity-50') &&
          document.querySelectorAll('#view g.node').length >= expected,
        count,
        { timeout: 30_000 }
      );
      const renderMs = Math.round(performance.now() - renderStart);
      const firstNode = page.locator('#view g.node[data-style-id="N0"]');
      const bounds = await firstNode.boundingBox();
      expect(bounds).toBeTruthy();
      const dragStart = performance.now();
      if (bounds) {
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2 + 64, bounds.y + bounds.height / 2 + 36, {
          steps: 12
        });
        await page.mouse.up();
      }
      await expect
        .poll(() =>
          page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
              visualPositions?: Record<string, unknown>;
            };
            return Boolean(state.visualPositions?.N0);
          })
        )
        .toBe(true);
      const dragMs = Math.round(performance.now() - dragStart);
      console.info(
        `PERFORMANCE_STAGE ${JSON.stringify({ count, dragMs, renderMs, sourceLength: source.length })}`
      );
      expect(renderMs, `${count} 个模块渲染不应出现灾难性退化`).toBeLessThan(30_000);
      expect(dragMs, `${count} 个模块拖拽不应阻塞交互`).toBeLessThan(5_000);
    });
  }

  test('200 个模块与 199 条自主箭头下仅刷新相邻连线', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    const source = blockDiagram(200);
    const visualConnections = Object.fromEntries(
      Array.from({ length: 199 }, (_, index) => [
        `connection-perf-${index}`,
        {
          direction: 'forward',
          id: `connection-perf-${index}`,
          label: `R${index + 1}`,
          lineStyle: index % 3 === 0 ? 'dashed' : 'solid',
          source: { anchor: 'right', elementId: `N${index}`, x: 0, y: 0 },
          strokeWidth: 2,
          target: { anchor: 'left', elementId: `N${index + 1}`, x: 0, y: 0 }
        }
      ])
    );
    await page.evaluate(
      ({ code, connections }) => {
        localStorage.setItem('codeStore', JSON.stringify({ code, visualConnections: connections }));
      },
      { code: source, connections: visualConnections }
    );
    const renderStart = performance.now();
    await page.reload();
    await page.waitForFunction(
      () =>
        !document.querySelector('#view')?.classList.contains('opacity-50') &&
        document.querySelectorAll('#view g.node').length >= 200 &&
        document.querySelectorAll('#view g[data-visual-connection]').length === 199,
      undefined,
      { timeout: 30_000 }
    );
    const renderMs = Math.round(performance.now() - renderStart);
    const path = page.locator(
      '#view g[data-visual-id="connection-perf-0"] path[data-connection-path]'
    );
    const beforePath = await path.getAttribute('d');
    const firstNode = page.locator('#view g.node[data-style-id="N0"]');
    const bounds = await firstNode.boundingBox();
    expect(bounds).toBeTruthy();
    const dragStart = performance.now();
    if (bounds) {
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width / 2 + 48, bounds.y + bounds.height / 2 + 28, {
        steps: 10
      });
      await page.mouse.up();
    }
    await expect(path).not.toHaveAttribute('d', beforePath ?? '');
    const dragMs = Math.round(performance.now() - dragStart);

    await page.waitForTimeout(350);
    const connection = page.locator('#view g[data-visual-id="connection-perf-0"]');
    await connection.locator('[data-connection-hit]').dispatchEvent('click');
    await expect(page.getByTestId('connection-toolbar')).toBeVisible();
    const endpoint = connection.locator('[data-connection-endpoint="target"]');
    const endpointBox = await endpoint.boundingBox();
    const secondTargetBox = await page.locator('#view g.node[data-style-id="N2"]').boundingBox();
    expect(endpointBox).toBeTruthy();
    expect(secondTargetBox).toBeTruthy();
    const endpointDragStart = performance.now();
    if (endpointBox && secondTargetBox) {
      await page.mouse.move(
        endpointBox.x + endpointBox.width / 2,
        endpointBox.y + endpointBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(secondTargetBox.x + 1, secondTargetBox.y + secondTargetBox.height / 2, {
        steps: 16
      });
      await page.mouse.up();
    }
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            visualConnections?: Record<string, { target?: { elementId?: string } }>;
          };
          return state.visualConnections?.['connection-perf-0']?.target?.elementId;
        })
      )
      .toBe('N2');
    const endpointDragMs = Math.round(performance.now() - endpointDragStart);
    console.info(
      `PERFORMANCE_CONNECTION_STAGE ${JSON.stringify({ connections: 199, dragMs, endpointDragMs, nodes: 200, renderMs })}`
    );
    expect(renderMs, '200 个模块和 199 条箭头应在预算内完成渲染').toBeLessThan(30_000);
    expect(dragMs, '移动一个模块时不应全量重算 199 条箭头').toBeLessThan(5_000);
    expect(endpointDragMs, '调整箭头端点时不应每帧重复测量 200 个模块').toBeLessThan(5_000);
  });

  test('调色拖动只在松手时提交一次持久化历史', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '调色', exact: true }).click();
    const picker = page.getByRole('button', { name: '饱和度和明度' });
    await expect(picker).toBeVisible();
    await picker.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const trackedWindow = window as typeof window & { codeStoreWrites?: number };
      trackedWindow.codeStoreWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string): void {
        if (key === 'codeStore')
          trackedWindow.codeStoreWrites = (trackedWindow.codeStoreWrites ?? 0) + 1;
        original.call(this, key, value);
      };
    });
    const bounds = await picker.boundingBox();
    expect(bounds).toBeTruthy();
    if (bounds) {
      await picker.hover({ position: { x: 20, y: 20 } });
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width - 20, bounds.y + bounds.height - 20, {
        steps: 24
      });
      await page.mouse.up();
    }
    const writes = await page.evaluate(
      () => (window as typeof window & { codeStoreWrites?: number }).codeStoreWrites ?? 0
    );
    console.info(`COLOR_PICKER_STAGE ${JSON.stringify({ writes })}`);
    expect(writes).toBeGreaterThan(0);
    expect(writes).toBeLessThanOrEqual(2);
    await page.getByRole('button', { name: '撤回', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            visualStyles?: Record<string, unknown>;
          };
          return Object.keys(state.visualStyles ?? {}).length;
        })
      )
      .toBe(0);
  });
});
