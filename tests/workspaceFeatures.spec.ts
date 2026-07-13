import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { setEditorCode } from './utils';

const waitForDiagram = async (page: Page): Promise<void> => {
  await page.waitForSelector('#view svg');
  await page.waitForFunction(
    () => !document.querySelector('#view')?.classList.contains('opacity-50')
  );
};

const storedState = async (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('codeStore') ?? '{}') as Record<string, unknown>
  );

const pinchCanvas = async (context: BrowserContext, page: Page): Promise<void> => {
  const view = await page.locator('#view').boundingBox();
  if (!view) throw new Error('mobile view is not visible');
  const session = await context.newCDPSession(page);
  const center = await page.evaluate(() => {
    const svg = document.querySelector('#view svg');
    const bounds = svg?.getBoundingClientRect();
    if (!svg || !bounds) return undefined;
    for (let y = bounds.top + 16; y < bounds.bottom - 16; y += 24) {
      for (let x = bounds.left + 80; x < bounds.right - 80; x += 24) {
        const target = document.elementFromPoint(x, y);
        if (target && target.closest('#view svg') && !target.closest('[data-visual-id]')) {
          return { x, y };
        }
      }
    }
    return undefined;
  });
  if (!center) throw new Error('no blank mobile canvas point was found');
  await session.send('Input.dispatchTouchEvent', {
    touchPoints: [
      { x: center.x - 24, y: center.y },
      { x: center.x + 24, y: center.y }
    ],
    type: 'touchStart'
  });
  for (const distance of [36, 48, 60, 72]) {
    await page.waitForTimeout(30);
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [
        { x: center.x - distance, y: center.y },
        { x: center.x + distance, y: center.y }
      ],
      type: 'touchMove'
    });
  }
  await session.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
};

test.describe('统一工作区能力', () => {
  test('全局搜索替换、命令面板和图层面板共享真实数据', async ({ page }) => {
    await page.goto('/');
    await waitForDiagram(page);

    await page.getByRole('button', { name: '全局搜索' }).click();
    const searchPanel = page.getByTestId('global-search-panel');
    await expect(searchPanel).toBeVisible();
    await searchPanel.getByLabel('搜索图表文字').fill('输入中文想法');
    await expect(searchPanel).toContainText('1/1');
    await searchPanel.getByLabel('替换文字').fill('新的中文想法');
    page.once('dialog', (dialog) => dialog.accept());
    await searchPanel.getByRole('button', { name: '全部替换' }).click();
    await expect(page.locator('#view')).toContainText('新的中文想法');
    await expect
      .poll(async () => JSON.stringify(await storedState(page)))
      .toContain('新的中文想法');

    await page.locator('#view').click({ force: true, position: { x: 420, y: 560 } });
    await page.keyboard.press('Control+Z');
    await expect(page.locator('#view')).toContainText('输入中文想法');
    await page.getByRole('button', { name: '关闭搜索' }).click();
    await expect(page.locator('#view .visual-search-current')).toHaveCount(0);

    await page.getByRole('button', { name: '命令与快捷键' }).click();
    const palette = page.getByRole('dialog', { name: '命令面板' });
    await expect(palette).toBeVisible();
    await palette.getByLabel('搜索命令').fill('图层与大纲');
    await page.keyboard.press('Enter');

    const layers = page.getByTestId('layers-panel');
    await expect(layers).toBeVisible();
    await layers.getByLabel('筛选图层').fill('输入中文想法');
    const layerLabel = layers.getByText('输入中文想法', { exact: true }).first();
    await expect(layerLabel).toBeVisible();
    const row = layerLabel.locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await row.hover();
    await row.getByRole('button', { name: '锁定' }).click();
    await expect(row.getByRole('button', { name: '解锁' })).toBeVisible();

    const nodeCount = await page.locator('#view [data-visual-id]').count();
    await layers.getByLabel('筛选图层').press('Control+A');
    await layers.getByLabel('筛选图层').press('Backspace');
    await expect(page.locator('#view [data-visual-id]')).toHaveCount(nodeCount);
  });

  test('块图支持吸附、连线局部更新、多选对齐和一次撤回批量删除', async ({ page }) => {
    await page.goto('/');
    await waitForDiagram(page);
    await setEditorCode(
      page,
      `block-beta
  columns 3
  A["甲"]
  B["乙"]
  C["丙"]
  A --> B
  C --> B`
    );
    await waitForDiagram(page);

    const nodeA = page.locator('#view svg g.node[data-style-id="A"]');
    const nodeB = page.locator('#view svg g.node[data-style-id="B"]');
    const nodeC = page.locator('#view svg g.node[data-style-id="C"]');
    const edge = page.locator('#view svg path[data-style-id="L_C_B_1"]');
    const boxC = await nodeC.boundingBox();
    const boxA = await nodeA.boundingBox();
    expect(boxC).toBeTruthy();
    expect(boxA).toBeTruthy();
    const initialPath = await edge.getAttribute('d');
    if (boxA && boxC) {
      const alignTopDelta = boxA.y - boxC.y + 3;
      await page.mouse.move(boxC.x + boxC.width / 2, boxC.y + boxC.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        boxC.x + boxC.width / 2 + 100,
        boxC.y + boxC.height / 2 + alignTopDelta,
        { steps: 4 }
      );
      await expect(page.getByTestId('snap-guide').first()).toBeVisible();
      await page.mouse.up();
    }
    await expect(edge).not.toHaveAttribute('d', initialPath ?? '');
    await expect
      .poll(async () => JSON.stringify((await storedState(page)).visualPositions ?? {}))
      .toContain('C');

    await nodeA.click({ force: true });
    await page.keyboard.press('Shift+ArrowDown');
    await nodeB.click({ force: true, modifiers: ['Shift'] });
    await expect(page.getByTestId('selection-toolbar')).toContainText('已选 2 项');
    await page.getByRole('button', { name: '批量对齐' }).click();
    await page.getByRole('button', { name: '顶部对齐' }).click();

    await page.getByRole('button', { name: '移除所选元素' }).click();
    await expect(page.locator('#view')).not.toContainText('甲');
    await expect(page.locator('#view')).not.toContainText('乙');
    await page.getByRole('button', { name: '撤回', exact: true }).click();
    await expect(page.locator('#view')).toContainText('甲');
    await expect(page.locator('#view')).toContainText('乙');
  });

  test('自主箭头支持八点吸附、编辑、端点重连、模块跟随和持久化', async ({ page }) => {
    await page.goto('/');
    await waitForDiagram(page);
    await setEditorCode(
      page,
      `block-beta
  columns 3
  A["入口"]
  B["处理"]
  C["结果"]`
    );
    await waitForDiagram(page);

    const quickToolbar = page.getByTestId('workspace-quick-toolbar');
    await quickToolbar.getByRole('button', { name: '添加自主箭头' }).click();
    await expect(page.getByTestId('connection-creation-hint')).toContainText('起点');
    await page.locator('#view g.node[data-style-id="A"]').click({ force: true });
    await expect(page.getByTestId('connection-creation-hint')).toContainText('终点');
    await expect(page.locator('#view [data-visual-connection-anchors] circle')).toHaveCount(24);
    await page.locator('#view g.node[data-style-id="B"]').click({ force: true });

    const connection = page.locator('#view g[data-visual-connection]').first();
    await expect(connection).toBeVisible();
    await expect
      .poll(async () => JSON.stringify((await storedState(page)).visualConnections ?? {}))
      .toContain('connection-');

    await connection.locator('[data-connection-hit]').click({ force: true });
    const toolbar = page.getByTestId('connection-toolbar');
    await expect(toolbar).toBeVisible();
    await toolbar.getByLabel('箭头文字').fill('异步调用');
    await toolbar.getByLabel('箭头文字').press('Enter');
    await expect(connection).toContainText('异步调用');
    await toolbar.getByRole('button', { name: '双向箭头' }).click();
    await expect(connection.locator('[data-connection-path]')).toHaveAttribute(
      'marker-start',
      /visual-connection/
    );

    await quickToolbar.getByRole('button', { name: '图层与大纲' }).click();
    const layers = page.getByTestId('layers-panel');
    const connectionRow = layers
      .getByText('异步调用', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await connectionRow.hover();
    await connectionRow.getByRole('button', { name: '重命名' }).click();
    await layers.getByLabel('重命名元素').fill('同步调用');
    await layers.getByLabel('重命名元素').press('Enter');
    await expect(connection).toContainText('同步调用');
    await page.keyboard.press('Control+Z');
    await expect(connection).toContainText('异步调用');
    await expect(toolbar.getByLabel('箭头文字')).toHaveValue('异步调用');
    await layers.getByRole('button', { name: '关闭图层' }).click();

    const endpoint = connection.locator('[data-connection-endpoint="target"]');
    const nodeC = page.locator('#view g.node[data-style-id="C"]');
    const endpointBox = await endpoint.boundingBox();
    const nodeCBox = await nodeC.boundingBox();
    expect(endpointBox).toBeTruthy();
    expect(nodeCBox).toBeTruthy();
    if (endpointBox && nodeCBox) {
      await page.mouse.move(
        endpointBox.x + endpointBox.width / 2,
        endpointBox.y + endpointBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(nodeCBox.x, nodeCBox.y + nodeCBox.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await expect
      .poll(async () => JSON.stringify((await storedState(page)).visualConnections ?? {}))
      .toContain('"elementId":"C"');

    const pathBeforeMove = await connection.locator('[data-connection-path]').getAttribute('d');
    const nodeA = page.locator('#view g.node[data-style-id="A"]');
    const nodeABox = await nodeA.boundingBox();
    if (nodeABox) {
      await page.mouse.move(nodeABox.x + nodeABox.width / 2, nodeABox.y + nodeABox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        nodeABox.x + nodeABox.width / 2 + 90,
        nodeABox.y + nodeABox.height / 2 + 50,
        {
          steps: 6
        }
      );
      await page.mouse.up();
    }
    await expect(connection.locator('[data-connection-path]')).not.toHaveAttribute(
      'd',
      pathBeforeMove ?? ''
    );
    await page.reload();
    await waitForDiagram(page);
    await expect(page.locator('#view g[data-visual-connection]')).toContainText('异步调用');
  });

  test('自主箭头支持自由端、同节点锚点、取消、反向和完整历史', async ({ page }) => {
    await page.goto('/');
    await waitForDiagram(page);
    await setEditorCode(
      page,
      `block-beta
  columns 2
  A["入口"]
  B["处理"]`
    );
    await waitForDiagram(page);

    const quickToolbar = page.getByTestId('workspace-quick-toolbar');
    const addConnection = quickToolbar.getByRole('button', { name: '添加自主箭头' });
    const svg = page.locator('#view svg');
    const nodeA = page.locator('#view g.node[data-style-id="A"]');
    const svgBox = await svg.boundingBox();
    expect(svgBox).toBeTruthy();

    await addConnection.click();
    await nodeA.click({ force: true });
    await svg.dispatchEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: (svgBox?.x ?? 0) + 40,
      clientY: (svgBox?.y ?? 0) + 80,
      isPrimary: true,
      pointerId: 41,
      pointerType: 'mouse'
    });
    let connections = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
        visualConnections?: Record<
          string,
          { source: { elementId?: string }; target: { elementId?: string } }
        >;
      };
      return Object.values(state.visualConnections ?? {});
    });
    expect(connections).toHaveLength(1);
    expect(connections[0].source.elementId).toBe('A');
    expect(connections[0].target.elementId).toBeUndefined();

    const connection = page.locator('#view g[data-visual-connection]').first();
    await connection.locator('[data-connection-hit]').click({ force: true });
    const toolbar = page.getByTestId('connection-toolbar');
    await toolbar.getByRole('button', { name: '普通连线' }).click();
    await toolbar.getByRole('button', { name: '交换起点和终点' }).click();
    await expect
      .poll(async () => {
        const state = await storedState(page);
        return JSON.stringify(state.visualConnections ?? {});
      })
      .toContain('"direction":"none"');
    connections = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
        visualConnections?: Record<
          string,
          { source: { elementId?: string }; target: { elementId?: string } }
        >;
      };
      return Object.values(state.visualConnections ?? {});
    });
    expect(connections[0].source.elementId).toBeUndefined();
    expect(connections[0].target.elementId).toBe('A');

    await toolbar.getByRole('button', { name: '删除箭头' }).click();
    await expect(page.locator('#view g[data-visual-connection]')).toHaveCount(0);
    await page.getByRole('button', { name: '撤回', exact: true }).click();
    await expect(page.locator('#view g[data-visual-connection]')).toHaveCount(1);
    await page.getByRole('button', { name: '恢复', exact: true }).click();
    await expect(page.locator('#view g[data-visual-connection]')).toHaveCount(0);

    await addConnection.click();
    await nodeA.click({ force: true });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('connection-creation-hint')).toBeHidden();
    await expect(page.locator('#view g[data-visual-connection]')).toHaveCount(0);

    await addConnection.click();
    await nodeA.click({ force: true });
    await nodeA.click({ force: true });
    await expect(page.locator('#view g[data-visual-connection]')).toHaveCount(1);
    const sameNodeConnection = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
        visualConnections?: Record<
          string,
          {
            source: { anchor?: string; elementId?: string };
            target: { anchor?: string; elementId?: string };
          }
        >;
      };
      return Object.values(state.visualConnections ?? {})[0];
    });
    expect(sameNodeConnection.source.elementId).toBe('A');
    expect(sameNodeConnection.target.elementId).toBe('A');
    expect(sameNodeConnection.source.anchor).not.toBe(sameNodeConnection.target.anchor);

    await page.keyboard.press('Control+f');
    const searchPanel = page.getByTestId('global-search-panel');
    await expect(searchPanel).toBeVisible();
    await searchPanel.getByLabel('搜索图表文字').fill('关系');
    await expect(searchPanel).toContainText('箭头文字');
    await searchPanel.getByLabel('替换文字').fill('模块内循环');
    await searchPanel.getByRole('button', { name: '替换当前' }).click();
    await expect(page.locator('#view g[data-visual-connection]')).toContainText('模块内循环');
    await page.getByRole('button', { name: '撤回', exact: true }).click();
    await expect(page.locator('#view g[data-visual-connection]')).toContainText('关系');
  });

  test('框选模式可以一次选择画布中的多个自由模块', async ({ page }) => {
    await page.goto('/');
    await waitForDiagram(page);
    await setEditorCode(
      page,
      `block-beta
  columns 3
  A["甲"]
  B["乙"]
  C["丙"]`
    );
    await waitForDiagram(page);

    const quickToolbar = page.getByTestId('workspace-quick-toolbar');
    await quickToolbar.getByRole('button', { name: '框选模式' }).click();
    await expect(quickToolbar.getByRole('button', { name: '框选模式' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const drag = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<SVGGraphicsElement>('#view g.node')];
      const view = document.querySelector('#view')?.getBoundingClientRect();
      if (!view || nodes.length === 0) return undefined;
      const boxes = nodes.map((node) => node.getBoundingClientRect());
      const bounds = {
        bottom: Math.max(...boxes.map(({ bottom }) => bottom)),
        left: Math.min(...boxes.map(({ left }) => left)),
        right: Math.max(...boxes.map(({ right }) => right)),
        top: Math.min(...boxes.map(({ top }) => top))
      };
      const candidates = [
        {
          end: { x: bounds.right + 16, y: bounds.bottom + 16 },
          start: { x: bounds.left - 16, y: bounds.top - 16 }
        },
        {
          end: { x: bounds.left - 16, y: bounds.bottom + 16 },
          start: { x: bounds.right + 16, y: bounds.top - 16 }
        },
        {
          end: { x: bounds.right + 16, y: bounds.top - 16 },
          start: { x: bounds.left - 16, y: bounds.bottom + 16 }
        },
        {
          end: { x: bounds.left - 16, y: bounds.top - 16 },
          start: { x: bounds.right + 16, y: bounds.bottom + 16 }
        }
      ];
      const found = candidates.find(({ start: { x, y } }) => {
        if (x <= view.left || x >= view.right || y <= view.top || y >= view.bottom) return false;
        const target = document.elementFromPoint(x, y);
        return (
          target instanceof Element &&
          Boolean(target.closest('#container')) &&
          !target.closest('[data-visual-id]')
        );
      });
      return found;
    });
    expect(drag).toBeTruthy();
    if (drag) {
      await page.mouse.move(drag.start.x, drag.start.y);
      await page.mouse.down();
      await page.mouse.move(drag.end.x, drag.end.y, { steps: 8 });
      await page.mouse.up();
    }
    await expect(page.getByTestId('selection-toolbar')).toContainText('已选 3 项');
  });

  test('固定语义图的文本也进入统一图层模型', async ({ page }) => {
    await page.goto('/');
    await waitForDiagram(page);
    await setEditorCode(
      page,
      `sequenceDiagram
  participant A as 张三
  participant B as 李四
  A->>B: 提交申请
  B-->>A: 已审核`
    );
    await waitForDiagram(page);

    await page.getByRole('button', { name: '图层与大纲' }).click();
    const layers = page.getByTestId('layers-panel');
    await expect(layers.getByText('张三', { exact: true })).toHaveCount(1);
    await expect(layers.getByText('提交申请', { exact: true })).toHaveCount(1);
    await layers.getByText('提交申请', { exact: true }).click();
    await expect(page.locator('#view .visual-element-selected')).toContainText('提交申请');
  });

  test('图层大纲按源码语义显示流程子图和 C4 Boundary 层级', async ({ page }) => {
    await page.goto('/');
    await waitForDiagram(page);
    await setEditorCode(
      page,
      `flowchart TB
  subgraph G["Group"]
    A["Child"]
  end`
    );
    await page.getByTestId('workspace-quick-toolbar').locator('button').nth(1).click();
    let layers = page.getByTestId('layers-panel');
    const groupRow = layers
      .getByText('Group', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"group")][1]');
    const childRow = layers
      .getByText('Child', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await expect(groupRow).toBeVisible();
    await expect(childRow).toBeVisible();
    expect(await childRow.evaluate((element) => Number.parseFloat(element.style.paddingLeft))).toBe(
      18
    );

    await page.getByRole('button', { name: '关闭图层' }).click();
    await setEditorCode(
      page,
      `C4Container
  System_Boundary(order, "Order system") {
    Container(api, "API", "Node", "Service")
  }`
    );
    await page.getByTestId('workspace-quick-toolbar').locator('button').nth(1).click();
    layers = page.getByTestId('layers-panel');
    const apiRow = layers
      .locator('button[title*="API"]')
      .locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await expect(layers.getByText('Order system', { exact: true })).toBeVisible();
    await expect(apiRow).toBeVisible();
    expect(await apiRow.evaluate((element) => Number.parseFloat(element.style.paddingLeft))).toBe(
      18
    );
  });

  test('手机专用模式支持直接编辑文字、搜索、图层和横竖屏切换', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: 'http://localhost:3000',
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 }
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto('/');
      await waitForDiagram(page);
      const mobileToolbar = page.getByTestId('mobile-edit-toolbar');
      await expect(mobileToolbar).toBeVisible();

      await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
      await mobileToolbar.getByRole('button', { name: '文字' }).click();
      await page.getByLabel('图中文字编辑').fill('手机直接编辑');
      await page.keyboard.press('Enter');
      await expect(page.locator('#view')).toContainText('手机直接编辑');

      await mobileToolbar.getByRole('button', { name: '箭头', exact: true }).click();
      await page.locator('#view').getByText('手机直接编辑', { exact: true }).tap({ force: true });
      await page.locator('#view').getByText('生成图表', { exact: true }).tap({ force: true });
      await expect(page.locator('#view g[data-visual-connection]')).toHaveCount(1);
      await expect
        .poll(async () => JSON.stringify((await storedState(page)).visualConnections ?? {}))
        .toContain('connection-');

      const mobileConnection = page.locator('#view g[data-visual-connection]').first();
      await mobileConnection.locator('[data-connection-hit]').tap({ force: true });
      await mobileToolbar.getByRole('button', { name: '文字' }).click();
      const connectionLabel = page.getByLabel('箭头文字');
      await expect(connectionLabel).toBeFocused();
      await connectionLabel.fill('手机箭头说明');
      await connectionLabel.press('Enter');
      await expect(mobileConnection).toContainText('手机箭头说明');

      const multiSelect = mobileToolbar.getByRole('button', { name: '多选' });
      await multiSelect.click();
      await expect(multiSelect).toHaveAttribute('aria-pressed', 'true');
      await mobileToolbar.getByRole('button', { name: '搜索' }).click();
      await expect(page.getByTestId('global-search-panel')).toBeVisible();
      await page.getByRole('button', { name: '关闭搜索' }).click();
      await mobileToolbar.getByRole('button', { name: '图层' }).click();
      await expect(page.getByTestId('layers-panel')).toBeVisible();
      await page.getByRole('button', { name: '关闭图层' }).click();

      await page.getByRole('button', { name: '历史' }).click();
      await expect(page.getByRole('complementary', { name: '手机历史记录' })).toBeVisible();
      await page.getByRole('button', { name: '关闭历史记录' }).click();

      const viewport = page.locator('#view svg .svg-pan-zoom_viewport');
      const initialTransform = await viewport.getAttribute('transform');
      await pinchCanvas(context, page);
      await expect(viewport).not.toHaveAttribute('transform', initialTransform ?? '');

      await page.setViewportSize({ height: 390, width: 844 });
      await expect(mobileToolbar).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      ).toBe(true);
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
