import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page
} from '@playwright/test';
import { localizedDiagramSamples } from '../src/lib/util/diagramSamples';
import { serializeState } from '../src/lib/util/serde';
import { setEditorCode } from './utils';

const waitForDiagram = async (page: Page, minimumNodes = 1): Promise<void> => {
  await page.waitForFunction(
    (expected) =>
      !document.querySelector('#view')?.classList.contains('opacity-50') &&
      document.querySelectorAll('#view [data-visual-id]').length >= expected,
    minimumNodes,
    { timeout: 30_000 }
  );
};

const createMobilePage = async (
  browser: Browser,
  viewport: { height: number; width: number }
): Promise<{ context: BrowserContext; page: Page }> => {
  const context = await browser.newContext({
    baseURL: 'http://localhost:3000',
    hasTouch: true,
    isMobile: true,
    viewport
  });
  const page = await context.newPage();
  await page.goto('/');
  await waitForDiagram(page);
  return { context, page };
};

const setMobileDiagram = async (page: Page, code: string): Promise<void> => {
  const viewSwitch = page.getByRole('switch');
  if (await viewSwitch.isChecked()) await viewSwitch.click();
  await expect(page.locator('#editor:visible, .cm-content:visible').first()).toBeVisible();
  await setEditorCode(page, code);
  if (!(await viewSwitch.isChecked())) await viewSwitch.click();
  await waitForDiagram(page);
};

const dispatchTouchDrag = async (
  session: CDPSession,
  start: { x: number; y: number },
  end: { x: number; y: number },
  beforeEnd?: () => Promise<void>
): Promise<void> => {
  const point = (x: number, y: number) => ({ x: Math.round(x), y: Math.round(y) });
  await session.send('Input.dispatchTouchEvent', {
    touchPoints: [point(start.x, start.y)],
    type: 'touchStart'
  });
  for (let step = 1; step <= 8; step += 1) {
    const ratio = step / 8;
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [
        point(start.x + (end.x - start.x) * ratio, start.y + (end.y - start.y) * ratio)
      ],
      type: 'touchMove'
    });
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await beforeEnd?.();
  await session.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
};

const pinchCanvasIn = async (page: Page, session: CDPSession): Promise<void> => {
  const view = await page.locator('#view').boundingBox();
  if (!view) throw new Error('mobile canvas is not visible');
  const center = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  await session.send('Input.dispatchTouchEvent', {
    touchPoints: [
      { x: center.x - 28, y: center.y },
      { x: center.x + 28, y: center.y }
    ],
    type: 'touchStart'
  });
  for (const distance of [42, 56, 70, 84]) {
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [
        { x: center.x - distance, y: center.y },
        { x: center.x + distance, y: center.y }
      ],
      type: 'touchMove'
    });
    await new Promise((resolve) => setTimeout(resolve, 24));
  }
  await session.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
  await page.waitForTimeout(220);
};

const resetMobileView = async (page: Page): Promise<void> => {
  const toolbar = page.getByTestId('mobile-edit-toolbar');
  await toolbar.getByRole('button', { name: '更多', exact: true }).tap();
  await page.getByRole('button', { name: '重置视图', exact: true }).tap();
  await page.waitForTimeout(180);
};

const blockDiagram = (count: number): string => {
  const prefix = `M${count}`;
  const nodes = Array.from(
    { length: count },
    (_, index) => `${prefix}_${index}["模块 ${index + 1}"]`
  );
  const edges = Array.from(
    { length: Math.floor(Math.max(count - 1, 0) / 5) },
    (_, index) => `${prefix}_${index * 5} --> ${prefix}_${index * 5 + 1}`
  );
  return ['block-beta', 'columns 10', ...nodes, ...edges].join('\n');
};

const mobileSampleURL = (code: string): string =>
  `/edit#${serializeState({
    code,
    grid: true,
    mermaid: '{"theme":"default"}',
    panZoom: true,
    rough: false,
    updateDiagram: true
  })}`;

const mobileDiagramNames = [
  'Flowchart',
  'Class',
  'Sequence',
  'Entity Relationship',
  'State',
  'Mindmap',
  'Architecture',
  'Block',
  'C4',
  'Gantt',
  'Git',
  'Ishikawa',
  'Kanban',
  'Packet',
  'Pie',
  'Quadrant',
  'Radar',
  'Requirement',
  'Sankey',
  'Timeline',
  'TreeView',
  'Treemap',
  'User Journey',
  'Venn',
  'Wardley Maps',
  'XY',
  'ZenUML'
] as const;

test.describe('手机专用编辑模式', () => {
  test('常见手机与横屏尺寸没有横向溢出，工具和抽屉保持在安全视口内', async ({ browser }) => {
    test.setTimeout(90_000);
    const sizes = [
      { height: 800, label: '小屏 Android', width: 360 },
      { height: 844, label: '主流手机', width: 390 },
      { height: 932, label: '大屏手机', width: 430 },
      { height: 390, label: '手机横屏', width: 844 }
    ];

    for (const size of sizes) {
      const { context, page } = await createMobilePage(browser, size);
      try {
        const toolbar = page.getByTestId('mobile-edit-toolbar');
        await expect(toolbar, size.label).toBeVisible();
        const canvas = await page.locator('#view').boundingBox();
        expect(canvas, `${size.label} 画布应可见`).toBeTruthy();
        expect(canvas?.height ?? 0, `${size.label} 画布应占主要区域`).toBeGreaterThan(
          size.height * 0.55
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
          `${size.label} 不应横向溢出`
        ).toBe(true);

        const mainButtons = toolbar.getByRole('navigation').getByRole('button');
        await expect(mainButtons).toHaveCount(7);
        for (const button of await mainButtons.all()) {
          const bounds = await button.boundingBox();
          expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
          expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(43);
        }

        await toolbar.getByRole('button', { name: '更多' }).tap();
        const sheet = page.getByRole('dialog', { name: '手机更多工具面板' });
        await expect(sheet).toBeVisible();
        const sheetBounds = await sheet.boundingBox();
        expect(sheetBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((sheetBounds?.x ?? 0) + (sheetBounds?.width ?? 0)).toBeLessThanOrEqual(
          size.width + 1
        );
        expect((sheetBounds?.y ?? 0) + (sheetBounds?.height ?? 0)).toBeLessThanOrEqual(
          size.height + 1
        );
        if (size.width === 390) {
          const handle = page.getByRole('button', { name: '调整面板高度' });
          await handle.tap();
          await expect
            .poll(async () => (await sheet.boundingBox())?.height ?? 0)
            .toBeGreaterThan((sheetBounds?.height ?? 0) + 80);
          const expandedHeight = (await sheet.boundingBox())?.height ?? 0;
          const handleBounds = await handle.boundingBox();
          expect(handleBounds).toBeTruthy();
          if (handleBounds) {
            const session = await context.newCDPSession(page);
            const start = {
              x: handleBounds.x + handleBounds.width / 2,
              y: handleBounds.y + handleBounds.height / 2
            };
            await dispatchTouchDrag(session, start, { x: start.x, y: start.y + 180 });
          }
          await expect
            .poll(async () => (await sheet.boundingBox())?.height ?? expandedHeight)
            .toBeLessThan(expandedHeight - 80);
        }
        await page.getByRole('button', { name: '关闭更多工具', exact: true }).tap();
      } finally {
        await context.close();
      }
    }
  });

  test('全部中文初始图在手机画布中均可渲染且不会撑破页面', async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await createMobilePage(browser, { height: 844, width: 390 });
    try {
      for (const name of mobileDiagramNames) {
        await test.step(name, async () => {
          const code = localizedDiagramSamples[name][0].code;
          await page.goto(mobileSampleURL(code), { waitUntil: 'domcontentloaded' });
          await expect(page.locator('#view')).toBeAttached({ timeout: 15_000 });
          await expect(page.locator('#view')).not.toHaveClass(/opacity-50/, { timeout: 15_000 });
          await expect(page.locator('#container > svg')).toBeVisible({ timeout: 15_000 });
          await expect(page.getByTestId('mobile-edit-toolbar')).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth + 1
            ),
            `${name} 不应造成手机页面横向溢出`
          ).toBe(true);
        });
      }
    } finally {
      await context.close();
    }
  });

  test('首次触摸即可移动模块，箭头在松手前实时跟随且整次拖动只提交最终位置', async ({
    browser
  }) => {
    test.setTimeout(60_000);
    const { context, page } = await createMobilePage(browser, { height: 844, width: 390 });
    try {
      await setMobileDiagram(
        page,
        ['block-beta', 'columns 3', 'A["入口"]', 'B["处理"]', 'C["结果"]'].join('\n')
      );
      const toolbar = page.getByTestId('mobile-edit-toolbar');
      const nodeA = page.locator('#view g.node[data-style-id="A"]');
      const nodeB = page.locator('#view g.node[data-style-id="B"]');
      const nodeC = page.locator('#view g.node[data-style-id="C"]');
      await toolbar.getByRole('button', { name: '箭头', exact: true }).tap();
      await nodeA.tap({ force: true });
      await nodeB.tap({ force: true });
      const connection = page.locator('#view [data-visual-connection]').first();
      const path = connection.locator('[data-connection-path]');
      await expect(path).toHaveCount(1);
      await connection.locator('[data-connection-hit]').tap({ force: true });
      const endpoint = connection.locator('[data-connection-endpoint="target"]');
      const endpointBounds = await endpoint.boundingBox();
      const nodeCBounds = await nodeC.boundingBox();
      expect(endpointBounds).toBeTruthy();
      expect(nodeCBounds).toBeTruthy();
      const session = await context.newCDPSession(page);
      if (endpointBounds && nodeCBounds) {
        await dispatchTouchDrag(
          session,
          {
            x: endpointBounds.x + endpointBounds.width / 2,
            y: endpointBounds.y + endpointBounds.height / 2
          },
          { x: nodeCBounds.x, y: nodeCBounds.y + nodeCBounds.height / 2 }
        );
      }
      await expect
        .poll(() =>
          page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
              visualConnections?: Record<string, unknown>;
            };
            return JSON.stringify(state.visualConnections ?? {});
          })
        )
        .toContain('"elementId":"C"');
      await nodeA.tap({ force: true });
      await expect(nodeA).toHaveClass(/visual-element-selected/);
      await expect(connection).not.toHaveClass(/visual-element-selected/);
      await expect(connection.locator('[data-connection-endpoint]')).toHaveCount(0);
      const beforePosition = await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
          visualPositions?: Record<string, unknown>;
        };
        return state.visualPositions?.A ?? null;
      });
      const beforePath = await path.getAttribute('d');
      const bounds = await nodeA.boundingBox();
      expect(bounds).toBeTruthy();
      if (bounds) {
        const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        await dispatchTouchDrag(session, start, { x: start.x + 70, y: start.y + 42 }, async () => {
          await expect.poll(() => path.getAttribute('d')).not.toBe(beforePath);
        });
      }
      await expect
        .poll(() =>
          page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
              visualPositions?: Record<string, unknown>;
            };
            return state.visualPositions?.A ?? null;
          })
        )
        .not.toEqual(beforePosition);
      await toolbar.getByRole('button', { name: '撤回', exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
              visualPositions?: Record<string, unknown>;
            };
            return state.visualPositions?.A ?? null;
          })
        )
        .toEqual(beforePosition);
    } finally {
      await context.close();
    }
  });

  test('手机多选以逐个点击完成批量对齐，并保留一条可撤回事务', async ({ browser }) => {
    const { context, page } = await createMobilePage(browser, { height: 844, width: 390 });
    try {
      await setMobileDiagram(
        page,
        ['block-beta', 'columns 3', 'A["甲"]', 'B["乙"]', 'C["丙"]'].join('\n')
      );
      const toolbar = page.getByTestId('mobile-edit-toolbar');
      await toolbar.getByRole('button', { name: '更多' }).tap();
      await page.getByRole('button', { name: '多选', exact: true }).tap();
      await page.locator('#view g.node[data-style-id="A"]').tap({ force: true });
      await page.locator('#view g.node[data-style-id="B"]').tap({ force: true });
      await expect(toolbar.getByRole('button', { name: '完成 2' })).toBeVisible();
      await toolbar.getByRole('button', { name: '对齐', exact: true }).tap();
      await page.getByRole('button', { name: '顶部', exact: true }).tap();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const positions = (
              JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
                visualPositions?: Record<string, unknown>;
              }
            ).visualPositions;
            return Object.keys(positions ?? {}).length;
          })
        )
        .toBeGreaterThan(0);
      await toolbar.getByRole('button', { name: '撤回', exact: true }).tap();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const positions = (
              JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
                visualPositions?: Record<string, unknown>;
              }
            ).visualPositions;
            return Object.keys(positions ?? {}).length;
          })
        )
        .toBe(0);
    } finally {
      await context.close();
    }
  });

  test('手机画布在 20、100、200 个模块下仍能完成触摸拖动', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const { context, page } = await createMobilePage(browser, { height: 844, width: 390 });
    const session = await context.newCDPSession(page);
    try {
      for (const count of [20, 100, 200]) {
        const code = blockDiagram(count);
        const renderStart = performance.now();
        await setMobileDiagram(page, code);
        await page.waitForFunction(
          (expected) =>
            !document.querySelector('#view')?.classList.contains('opacity-50') &&
            document.querySelectorAll('#view g.node[data-style-id]').length >= expected,
          count,
          { timeout: 30_000 }
        );
        const renderMs = Math.round(performance.now() - renderStart);
        await resetMobileView(page);
        const zoomPasses = count >= 200 ? 3 : count >= 100 ? 2 : 1;
        for (let pass = 0; pass < zoomPasses; pass += 1) {
          await pinchCanvasIn(page, session);
        }
        const touchTarget = await page
          .locator('#view g.node[data-style-id]')
          .evaluateAll((nodes) => {
            const view = document.querySelector('#view')?.getBoundingClientRect();
            if (!view) return undefined;
            const candidates = nodes
              .map((node) => {
                const bounds = node.getBoundingClientRect();
                const x = Math.round(bounds.left + bounds.width / 2);
                const y = Math.round(bounds.top + bounds.height / 2);
                return {
                  distance: Math.hypot(
                    x - (view.left + view.width / 2),
                    y - (view.top + view.height / 2)
                  ),
                  id: (node as HTMLElement).dataset.styleId,
                  visible:
                    x >= view.left + 8 &&
                    x <= view.right - 8 &&
                    y >= view.top + 48 &&
                    y <= view.bottom - 90,
                  x,
                  y
                };
              })
              .filter(({ id, visible }) => id && visible)
              .sort((a, b) => a.distance - b.distance);
            for (const candidate of candidates) {
              const hit = document
                .elementFromPoint(candidate.x, candidate.y)
                ?.closest<HTMLElement>('g.node[data-style-id]');
              const id = hit?.dataset.styleId;
              if (id) return { id, x: candidate.x, y: candidate.y };
            }
            return undefined;
          });
        expect(touchTarget).toBeTruthy();
        const dragStart = performance.now();
        if (touchTarget) {
          await dispatchTouchDrag(
            session,
            { x: touchTarget.x, y: touchTarget.y },
            { x: touchTarget.x + 42, y: touchTarget.y + 28 }
          );
        }
        await expect
          .poll(() =>
            page.evaluate((prefix) => {
              const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
                visualPositions?: Record<string, unknown>;
              };
              return Object.keys(state.visualPositions ?? {}).some((id) => id.startsWith(prefix));
            }, `M${count}_`)
          )
          .toBe(true);
        const dragMs = Math.round(performance.now() - dragStart);
        testInfo.annotations.push({
          description: JSON.stringify({ count, dragMs, renderMs }),
          type: 'mobile-performance'
        });
        expect(renderMs).toBeLessThan(30_000);
        expect(dragMs).toBeLessThan(5_000);
      }
    } finally {
      await context.close();
    }
  });
});
