import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { setEditorCode, TEST_BASE_URL } from './utils';

interface StoredVisualState {
  visualConnections?: Record<
    string,
    { label: string; source: { elementId?: string }; target: { elementId?: string } }
  >;
  visualElements?: Record<
    string,
    {
      height: number;
      kind: 'icon' | 'shape';
      label: string;
      parentId?: string;
      shape: string;
      width: number;
    }
  >;
  visualPositions?: Record<string, { x: number; y: number }>;
}

const storedVisualState = (page: Page): Promise<StoredVisualState> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('codeStore');
    return raw ? (JSON.parse(raw) as StoredVisualState) : {};
  });

const dragWithTouch = async (
  session: CDPSession,
  start: { x: number; y: number },
  end: { x: number; y: number }
): Promise<void> => {
  await session.send('Input.dispatchTouchEvent', { touchPoints: [start], type: 'touchStart' });
  for (let step = 1; step <= 8; step += 1) {
    const ratio = step / 8;
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [
        {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio
        }
      ],
      type: 'touchMove'
    });
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await session.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
};

const pinchCanvasIn = async (page: Page, session: CDPSession): Promise<void> => {
  const view = await page.locator('#view').boundingBox();
  if (!view) throw new Error('手机画布不可见。');
  const center = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  await session.send('Input.dispatchTouchEvent', {
    touchPoints: [
      { x: center.x - 25, y: center.y },
      { x: center.x + 25, y: center.y }
    ],
    type: 'touchStart'
  });
  for (const distance of [36, 48, 60]) {
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
  await page.waitForTimeout(180);
};

test.describe('统一图形和图标元素', () => {
  test('桌面端异形分支可编辑、移动、缩放、继续分支并清理关系', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await setEditorCode(page, 'block-beta\n  A["起点"]');
    await page.locator('#view').getByText('起点', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '添加图形或图标' }).click();
    await page.getByRole('button', { name: '菱形', exact: true }).click();

    const editor = page.getByLabel('图中文字编辑');
    await expect(editor).toBeVisible();
    await editor.fill('判断节点');
    await editor.press('Enter');
    const element = page.locator('#view [data-visual-element]').filter({ hasText: '判断节点' });
    await expect(element).toBeVisible();
    await expect(element.locator('polygon')).toHaveCount(1);
    const initial = await storedVisualState(page);
    const firstId = Object.keys(initial.visualElements ?? {})[0];
    expect(initial.visualElements?.[firstId]).toMatchObject({
      kind: 'shape',
      label: '判断节点',
      parentId: 'A',
      shape: 'diamond'
    });
    expect(Object.values(initial.visualConnections ?? {})[0]?.target.elementId).toBe(firstId);

    const initialPath = await page
      .locator('#view [data-visual-connection] [data-connection-path]')
      .first()
      .getAttribute('d');
    const box = await element.boundingBox();
    if (!box) throw new Error('异形分支没有可拖动坐标。');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2 + 55, {
      steps: 8
    });
    await page.mouse.up();
    await expect
      .poll(async () => (await storedVisualState(page)).visualPositions?.[firstId])
      .toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    await expect
      .poll(() =>
        page
          .locator('#view [data-visual-connection] [data-connection-path]')
          .first()
          .getAttribute('d')
      )
      .not.toBe(initialPath);

    const widthBefore = (await storedVisualState(page)).visualElements?.[firstId]?.width ?? 0;
    const screenWidthBefore = (await element.boundingBox())?.width ?? 0;
    const resize = element.locator('[data-visual-element-resize="bottom-right"]');
    await expect(resize).toBeVisible();
    const resizeBox = await resize.boundingBox();
    if (!resizeBox) throw new Error('异形分支没有尺寸控制点。');
    const resizeCenter = {
      x: resizeBox.x + resizeBox.width / 2,
      y: resizeBox.y + resizeBox.height / 2
    };
    const resizeHit = await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return {
        className: target?.getAttribute('class') ?? '',
        resize: target?.getAttribute('data-visual-element-resize') ?? '',
        tag: target?.tagName ?? '',
        title: target?.getAttribute('title') ?? ''
      };
    }, resizeCenter);
    if (resizeHit.resize !== 'bottom-right') {
      throw new Error(`尺寸控制点被其他元素遮挡：${JSON.stringify(resizeHit)}`);
    }
    await page.mouse.move(resizeCenter.x, resizeCenter.y);
    await page.mouse.down();
    await page.mouse.move(resizeCenter.x + 48, resizeCenter.y + 24, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => (await storedVisualState(page)).visualElements?.[firstId]?.width ?? 0)
      .toBeGreaterThan(widthBefore);
    await expect
      .poll(async () => (await element.boundingBox())?.width ?? 0)
      .toBeGreaterThan(screenWidthBefore + 30);

    await element.click({ force: true });
    await page.getByRole('button', { name: '分支', exact: true }).click();
    await expect(page.getByLabel('图中文字编辑')).toBeVisible();
    await page.getByLabel('图中文字编辑').fill('后续模块');
    await page.getByLabel('图中文字编辑').press('Enter');
    await expect
      .poll(async () => Object.keys((await storedVisualState(page)).visualElements ?? {}).length)
      .toBe(2);
    const branched = await storedVisualState(page);
    const secondId = Object.keys(branched.visualElements ?? {}).find((id) => id !== firstId) ?? '';
    expect(branched.visualElements?.[secondId]?.parentId).toBe(firstId);

    const firstConnection = page.locator('#view [data-visual-connection]').first();
    await page.waitForTimeout(350);
    await firstConnection.locator('[data-connection-label]').click();
    await page.getByRole('button', { name: '清空关系标签' }).click();
    await expect
      .poll(
        async () => Object.values((await storedVisualState(page)).visualConnections ?? {})[0]?.label
      )
      .toBe('');

    const secondElement = page.locator(`#view [data-visual-element][data-visual-id="${secondId}"]`);
    await secondElement.click({ force: true });
    await page.locator('.delete-button').click();
    await expect
      .poll(async () => Object.keys((await storedVisualState(page)).visualElements ?? {}))
      .toEqual([firstId]);
    expect(Object.values((await storedVisualState(page)).visualConnections ?? {})).toHaveLength(1);
  });

  test('同一父元素连续添加的视觉分支会自动避开彼此', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await setEditorCode(page, 'block-beta\n  A["起点"]');
    await page.locator('#view').getByText('起点', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '添加图形或图标' }).click();
    await page.getByRole('button', { name: '矩形', exact: true }).click();
    await page.getByLabel('图中文字编辑').fill('父模块');
    await page.getByLabel('图中文字编辑').press('Enter');

    const parent = page.locator('#view [data-visual-element]').filter({ hasText: '父模块' });
    const parentId = (await parent.getAttribute('data-visual-id')) ?? '';
    for (const label of ['子模块一', '子模块二']) {
      await parent.click({ force: true });
      await page.getByRole('button', { name: '分支', exact: true }).click();
      await page.getByLabel('图中文字编辑').fill(label);
      await page.getByLabel('图中文字编辑').press('Enter');
    }

    const state = await storedVisualState(page);
    const childIds = Object.entries(state.visualElements ?? {})
      .filter(([, element]) => element.parentId === parentId)
      .map(([id]) => id);
    expect(childIds).toHaveLength(2);
    const boxes = await Promise.all(
      childIds.map((id) =>
        page.locator(`#view [data-visual-element][data-visual-id="${id}"]`).boundingBox()
      )
    );
    expect(boxes.every(Boolean)).toBe(true);
    const [first, second] = boxes;
    if (!first || !second) throw new Error('新增分支没有可见边界。');
    const overlaps =
      first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y;
    expect(overlaps).toBe(false);
  });

  test('手机竖屏可插入并触控移动图标，旋转横屏后状态不丢失', async ({ browser }) => {
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
      await expect(page.getByTestId('mobile-edit-toolbar')).toBeVisible();
      await page.getByTestId('mobile-edit-toolbar').getByRole('button', { name: '更多' }).tap();
      await page.getByRole('button', { name: '图形图标' }).tap();
      const picker = page.getByTestId('visual-element-picker');
      await expect(picker).toBeVisible();
      await page.waitForTimeout(80);
      await picker.getByRole('button', { name: '人物', exact: true }).tap();
      const editor = page.getByTestId('mobile-text-editor').getByLabel('图中文字编辑');
      await expect(editor).toBeVisible();
      await editor.fill('移动端用户');
      await page.getByTestId('mobile-text-editor').getByRole('button', { name: '完成' }).tap();

      const element = page.locator('#view [data-visual-element]').filter({ hasText: '移动端用户' });
      await expect(element).toBeVisible();
      const id = (await element.getAttribute('data-visual-id')) ?? '';
      const box = await element.boundingBox();
      if (!box) throw new Error('手机图标没有可拖动坐标。');
      const session = await context.newCDPSession(page);
      const viewportTransformBefore = await page
        .locator('#view svg .svg-pan-zoom_viewport')
        .getAttribute('transform');
      const panBefore = await page.evaluate(() => {
        const raw = localStorage.getItem('codeStore');
        return raw ? ((JSON.parse(raw) as { pan?: unknown }).pan ?? null) : null;
      });
      await dragWithTouch(
        session,
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        { x: box.x + box.width / 2 + 62, y: box.y + box.height / 2 + 34 }
      );
      const movedBox = await element.boundingBox();
      expect(movedBox).toBeTruthy();
      expect((movedBox?.x ?? 0) - box.x).toBeGreaterThan(45);
      expect((movedBox?.x ?? 0) - box.x).toBeLessThan(78);
      expect((movedBox?.y ?? 0) - box.y).toBeGreaterThan(18);
      expect((movedBox?.y ?? 0) - box.y).toBeLessThan(50);
      expect(await page.locator('#view svg .svg-pan-zoom_viewport').getAttribute('transform')).toBe(
        viewportTransformBefore
      );
      expect(
        await page.evaluate(() => {
          const raw = localStorage.getItem('codeStore');
          return raw ? ((JSON.parse(raw) as { pan?: unknown }).pan ?? null) : null;
        })
      ).toEqual(panBefore);
      await expect
        .poll(async () => (await storedVisualState(page)).visualPositions?.[id])
        .toMatchObject({ x: expect.any(Number), y: expect.any(Number) });

      await pinchCanvasIn(page, session);
      const zoomedBox = await element.boundingBox();
      if (!zoomedBox) throw new Error('缩放后手机图标不可见。');
      await dragWithTouch(
        session,
        {
          x: zoomedBox.x + zoomedBox.width / 2,
          y: zoomedBox.y + zoomedBox.height / 2
        },
        {
          x: zoomedBox.x + zoomedBox.width / 2 - 52,
          y: zoomedBox.y + zoomedBox.height / 2 - 26
        }
      );
      const zoomedMovedBox = await element.boundingBox();
      expect(zoomedMovedBox).toBeTruthy();
      expect((zoomedMovedBox?.x ?? 0) - zoomedBox.x).toBeLessThan(-36);
      expect((zoomedMovedBox?.x ?? 0) - zoomedBox.x).toBeGreaterThan(-68);
      expect((zoomedMovedBox?.y ?? 0) - zoomedBox.y).toBeLessThan(-12);
      expect((zoomedMovedBox?.y ?? 0) - zoomedBox.y).toBeGreaterThan(-42);

      await page.setViewportSize({ height: 390, width: 844 });
      await expect(element).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      ).toBe(true);
      expect((await storedVisualState(page)).visualElements?.[id]?.label).toBe('移动端用户');
    } finally {
      await context.close();
    }
  });
});
