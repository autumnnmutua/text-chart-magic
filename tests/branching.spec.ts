import { expect, test } from './test';
import type { Page } from '@playwright/test';
import { setEditorCode } from './utils';

const getStoredCode = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const saved = window.localStorage.getItem('codeStore');
    return saved ? (JSON.parse(saved) as { code: string }).code : '';
  });

const expectStoredCodeContains = async (page: Page, text: string): Promise<void> => {
  await expect.poll(() => getStoredCode(page)).toContain(text);
};

const expectStoredCodeExcludes = async (page: Page, text: string): Promise<void> => {
  await expect.poll(() => getStoredCode(page)).not.toContain(text);
};

const expectDiagramCentered = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const view = document.querySelector('#view');
    const svg = document.querySelector('#container svg');
    if (!view || !svg) return false;
    const viewRect = view.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const viewCenterX = viewRect.left + viewRect.width / 2;
    const viewCenterY = viewRect.top + viewRect.height / 2;
    const svgCenterX = svgRect.left + svgRect.width / 2;
    const svgCenterY = svgRect.top + svgRect.height / 2;
    return (
      Math.abs(svgCenterX - viewCenterX) < viewRect.width * 0.2 &&
      Math.abs(svgCenterY - viewCenterY) < viewRect.height * 0.2
    );
  });
};

const chooseViewText = async (page: Page, text: string): Promise<void> => {
  await page.waitForFunction(
    () => !document.querySelector('#view')?.classList.contains('opacity-50')
  );
  const target = page.locator('#view').getByText(text, { exact: true }).first();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await target.dispatchEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 240,
      clientY: 240
    });
    await page.waitForTimeout(50);
  }
};

const editViewText = async (page: Page, from: string, to: string): Promise<void> => {
  await page.locator('#view').getByText(from, { exact: true }).first().dblclick({ force: true });
  await expect(page.getByLabel('图中文字编辑')).toBeVisible();
  await page.getByLabel('图中文字编辑').fill(to);
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('图中文字编辑')).toBeHidden();
  await expect(page.locator('#view')).toContainText(to);
};

const editViewTextContaining = async (
  page: Page,
  from: string,
  to: string,
  renderedText = to
): Promise<void> => {
  await page
    .locator('#view foreignObject p, #view text, #view tspan')
    .filter({ hasText: from })
    .last()
    .dblclick({ force: true });
  await expect(page.getByLabel('图中文字编辑')).toBeVisible();
  await page.getByLabel('图中文字编辑').fill(to);
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('图中文字编辑')).toBeHidden();
  await expect(page.locator('#view')).toContainText(renderedText);
};

test.describe('图上分支编辑', () => {
  test('点击节点后可以新增分支并自动重新排版', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await expect(page.getByRole('button', { name: '撤回' })).toBeVisible();
    await expect(page.getByRole('button', { name: '撤回' })).toBeDisabled();

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await expect(page.getByRole('button', { name: '分支' })).toBeVisible();
    await expect(page.getByRole('button', { name: '分支' })).toHaveAttribute('data-source-id', 'A');

    await page.getByRole('button', { name: '分支' }).click();

    await expectStoredCodeContains(page, 'A -->|关系| A_branch_1[新分支]');
    await expect(page.locator('#view')).toContainText('新分支');
    await expect(page.getByRole('button', { name: '撤回' })).toBeEnabled();

    const codeAfterBranch = await page.evaluate(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code : '';
    });
    expect(codeAfterBranch.indexOf('A -->|关系| A_branch_1[新分支]')).toBeGreaterThan(
      codeAfterBranch.indexOf('A[输入中文想法]')
    );
    expect(codeAfterBranch.indexOf('A -->|关系| A_branch_1[新分支]')).toBeLessThan(
      codeAfterBranch.indexOf('B --> C')
    );

    await page.getByRole('button', { name: '撤回' }).click();
    await expectStoredCodeExcludes(page, 'A -->|关系| A_branch_1[新分支]');
    await expect(page.locator('#view')).not.toContainText('新分支');
  });

  test('双击同名分支时只编辑被点击的那个节点', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await page.waitForSelector('#view svg .node[id*="A_branch_1"]');

    await page.locator('#view svg .node[id*="A_branch_1"]').dblclick({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await page.waitForSelector('#view svg .node[id*="A_branch_1_branch_1"]');

    await page.locator('#view svg .node[id*="A_branch_1_branch_1"]').dblclick({ force: true });
    const childEditor = page.getByLabel('图中文字编辑');
    await expect(childEditor).toBeVisible();
    await childEditor.fill('子分支');
    await childEditor.press('Enter');

    await expectStoredCodeContains(page, 'A_branch_1[新分支]');
    await expectStoredCodeContains(page, 'A_branch_1_branch_1[子分支]');
    await expect(page.locator('#view')).toContainText('子分支');
  });

  test('撤回可以恢复手动输入操作', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await page.keyboard.type('输入中文需求');
    await expect(page.locator('#view')).toContainText('输入中文需求');

    await page.getByRole('button', { name: '撤回' }).click();
    await expect(page.locator('#view')).toContainText('输入中文想法');
    await expect(page.locator('#view')).not.toContainText('输入中文需求');
  });

  test('撤回可以恢复可见样式开关', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const gridButton = page.getByRole('button', { name: '背景网格' });
    await expect(gridButton).toHaveAttribute('aria-pressed', 'true');
    await gridButton.click();
    await expect(gridButton).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: '撤回' }).click();
    await expect(gridButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('新增分支不会重置当前画布缩放', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const initialZoom = await page.evaluate(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { zoom?: number }).zoom : undefined;
    });
    await page.getByRole('button', { name: '放大' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = window.localStorage.getItem('codeStore');
          return saved ? (JSON.parse(saved) as { zoom?: number }).zoom : undefined;
        })
      )
      .not.toBe(initialZoom);
    const zoomBefore = await page.evaluate(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { zoom?: number }).zoom : undefined;
    });

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await expectStoredCodeContains(page, 'A -->|关系| A_branch_1[新分支]');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = window.localStorage.getItem('codeStore');
          return saved ? (JSON.parse(saved) as { zoom?: number }).zoom : undefined;
        })
      )
      .toBe(zoomBefore);
  });

  test('撤回两次后可以恢复两次', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await expect(page.getByRole('button', { name: '恢复' })).toBeVisible();
    await expect(page.getByRole('button', { name: '恢复' })).toBeDisabled();

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await page.waitForSelector('#view svg .node[id*="A_branch_1"]');
    await page.locator('#view svg .node[id*="A_branch_1"]').click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await expectStoredCodeContains(page, 'A_branch_1 -->|关系| A_branch_1_branch_1[新分支]');

    await page.getByRole('button', { name: '撤回' }).click();
    await page.getByRole('button', { name: '撤回' }).click();
    await expectStoredCodeExcludes(page, 'A -->|关系| A_branch_1[新分支]');
    await expect(page.getByRole('button', { name: '恢复' })).toBeEnabled();

    await page.getByRole('button', { name: '恢复' }).click();
    await expectStoredCodeContains(page, 'A -->|关系| A_branch_1[新分支]');
    await expectStoredCodeExcludes(page, 'A_branch_1 -->|关系| A_branch_1_branch_1[新分支]');

    await page.getByRole('button', { name: '恢复' }).click();
    await expectStoredCodeContains(page, 'A_branch_1 -->|关系| A_branch_1_branch_1[新分支]');
  });

  test('重置按钮可以还原成最初的图', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await expectStoredCodeContains(page, 'A -->|关系| A_branch_1[新分支]');

    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expectStoredCodeContains(page, 'A[输入中文想法]');
    await expectStoredCodeExcludes(page, 'A -->|关系| A_branch_1[新分支]');
  });

  test('非流程图也可以添加分支', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await page.locator('#editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`mindmap
  root((主题))
    已有分支`);
    await expect.poll(() => getStoredCode(page)).toContain('已有分支');
    await expect(page.locator('#view')).toContainText('主题');
    await expect(page.locator('#view')).toHaveAttribute('aria-busy', 'false', {
      timeout: 15_000
    });

    await page.locator('#view').getByText('主题', { exact: true }).click();
    await expect(page.getByRole('button', { name: '分支' })).toBeVisible();
    await page.getByRole('button', { name: '分支' }).click();

    await expectStoredCodeContains(page, '新分支');
    await expect(page.locator('#view')).toContainText('新分支');
  });

  test('多种非流程图都可以添加可见分支', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const diagrams = [
      {
        code: `sequenceDiagram
    Alice->>Bob: 你好`,
        target: 'Alice'
      },
      {
        code: `classDiagram
    class Animal["动物"]`,
        target: '动物'
      },
      {
        code: `stateDiagram-v2
    [*] --> A
    A: 状态A`,
        target: '状态A'
      },
      {
        code: `pie title 宠物
    "狗" : 10`,
        target: '狗'
      },
      {
        code: `kanban
  待办
    [任务A]`,
        expectedBranch: '新卡片',
        target: '任务A'
      },
      {
        code: `block-beta
  A["任务A"]`,
        target: '任务A'
      },
      {
        code: `timeline
    title 时间线
    2026 : 任务A`,
        target: '任务A'
      }
    ];

    for (const { code, expectedBranch = '新分支', target } of diagrams) {
      await test.step(target, async () => {
        await setEditorCode(page, code);
        await expect(page.locator('#view')).toContainText(target);
        await chooseViewText(page, target);
        const branchButton = page.getByRole('button', { exact: true, name: '分支' });
        await expect(branchButton).toHaveAttribute('title', new RegExp(target));
        await branchButton.click();
        await expectStoredCodeContains(page, expectedBranch);
        await expect(page.locator('#view')).toContainText(expectedBranch);
      });
    }
  });

  test('看板分支明确区分列、卡片和检查项', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `kanban
  backlog[待规划]
    research[用户研究]
  doing[进行中]
    build[功能开发]`
    );

    await chooseViewText(page, '用户研究');
    await page.getByRole('button', { name: '卡片', exact: true }).click();
    await expect(page.locator('#view')).toContainText('新卡片');
    await expect.poll(() => getStoredCode(page)).toMatch(/backlog[\s\S]*card1\[新卡片\]/);
    await editViewText(page, '新卡片', '竞品访谈');

    await chooseViewText(page, '竞品访谈');
    await page.getByRole('button', { name: '检查项', exact: true }).click();
    await expect.poll(() => getStoredCode(page)).toContain('card1_check1[☐ 检查项]');

    await chooseViewText(page, '进行中');
    await page.getByRole('button', { name: '新列', exact: true }).click();
    await expect(page.locator('#view')).toContainText('新看板列');
    await expect.poll(() => getStoredCode(page)).toMatch(/^ {2}column1\[新看板列\]/m);
  });

  test('鱼骨图分支保持因果层级并递归删除子原因', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `ishikawa-beta
  订单延迟
  流程
    审批过多
  系统
    库存同步慢`
    );

    await chooseViewText(page, '流程');
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, '新分支', '异常处理慢');
    await chooseViewText(page, '异常处理慢');
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, '新分支', '缺少负责人');
    const causeIndents = await getStoredCode(page).then((code) =>
      Object.fromEntries(
        code
          .split('\n')
          .filter((line) => /流程|异常处理慢|缺少负责人/.test(line))
          .map((line) => [line.trim(), line.match(/^\s*/)?.[0].length ?? 0])
      )
    );
    expect(causeIndents['异常处理慢'] - causeIndents['流程']).toBe(2);
    expect(causeIndents['缺少负责人'] - causeIndents['异常处理慢']).toBe(2);

    await chooseViewText(page, '异常处理慢');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('异常处理慢');
    await expect.poll(() => getStoredCode(page)).not.toContain('缺少负责人');
    await page.getByRole('button', { name: '撤回', exact: true }).click();
    await expect(page.locator('#view')).toContainText('缺少负责人');
  });

  test('重置会回到当前图的初始状态而不是流程图', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const mindmapCode = `mindmap
  root((主题))
    已有分支`;
    await setEditorCode(page, mindmapCode);
    await page.locator('#view').getByText('主题', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await expectStoredCodeContains(page, '新分支');

    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expectStoredCodeContains(page, 'mindmap');
    await expectStoredCodeContains(page, '主题');
    await expectStoredCodeExcludes(page, 'flowchart TD');
    await expectStoredCodeExcludes(page, '新分支');
  });

  test('重置会同时恢复当前图的代码、调色和画布位置', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const original = `treemap-beta
"产品"
    "需求": 12`;
    await setEditorCode(page, original);
    await page.locator('#view').getByText('需求', { exact: true }).first().click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');

    await page.locator('#view').getByText('产品', { exact: true }).first().click({ force: true });
    await page.getByRole('button', { name: '调色' }).click();
    await page.getByLabel('HEX').fill('#16a34a');
    await page.getByLabel('HEX').press('Tab');
    await page.getByTitle('放大').click();

    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      if (!saved) return false;
      const state = JSON.parse(saved) as { visualStyles?: object; zoom?: number };
      return Boolean(state.visualStyles && state.zoom);
    });
    const editedZoom = await page.evaluate(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? ((JSON.parse(saved) as { zoom?: number }).zoom ?? 0) : 0;
    });

    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expectStoredCodeContains(page, '"需求": 12');
    await expectStoredCodeExcludes(page, '新分支');
    await page.waitForFunction((beforeZoom) => {
      const saved = window.localStorage.getItem('codeStore');
      if (!saved) return false;
      const state = JSON.parse(saved) as { visualStyles?: object; zoom?: number };
      return !state.visualStyles && Boolean(state.zoom && state.zoom < beforeZoom);
    }, editedZoom);
  });

  test('同类型语法错误会回到错误前的有效状态', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const validCode = `flowchart TD
    A[项目] --> B[结束]`;
    await setEditorCode(page, validCode);
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code.includes('B[结束]') : false;
    });

    await setEditorCode(
      page,
      `flowchart TD
    A[项目`,
      { waitForPersist: false, waitForRender: false }
    );
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code.includes('B[结束]') : false;
    });
    expect(await getStoredCode(page)).toContain('A[项目] --> B[结束]');
  });

  test('其他图上的文字也可以直接编辑', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `pie title 宠物
    "狗" : 10`
    );
    await page.locator('#view').getByText('狗', { exact: true }).click({ force: true });
    await page.keyboard.insertText('中文狗');

    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code.includes('"中文狗" : 10') : false;
    });
    await expect(page.locator('#view')).toContainText('中文狗');
  });

  test('多种图表重置视图后会回到画布中央', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const diagrams = [
      `flowchart TD
    A[开始] --> B[处理] --> C[结束]`,
      `mindmap
  root((主题))
    项目A
    项目B`,
      `sequenceDiagram
    Alice->>Bob: 你好`,
      `classDiagram
    class Animal["动物"]`,
      `pie title 宠物
    "狗" : 10
    "猫" : 20`,
      `timeline
    title 时间线
    2026 : 事件A`
    ];

    for (const code of diagrams) {
      await test.step(code.split('\n')[0], async () => {
        await setEditorCode(page, code);
        await page.getByRole('button', { name: '放大' }).click();
        await page.getByRole('button', { name: '重置视图' }).click();
        await expectDiagramCentered(page);
        await page.getByRole('button', { name: '重置', exact: true }).click();
        await expectDiagramCentered(page);
      });
    }
  });

  test('选中图形元素后可以打开调色盘并应用颜色', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await expect(page.getByRole('button', { name: '调色' })).toBeVisible();
    await page.getByRole('button', { name: '调色' }).click();

    await expect(page.getByText('HEX', { exact: true })).toBeVisible();
    await expect(page.getByText('RGB', { exact: true })).toBeVisible();
    await expect(page.getByText('HSL', { exact: true })).toBeVisible();
    await expect(page.getByText('透明度 Alpha', { exact: true })).toBeVisible();

    const hexInput = page.getByLabel('HEX');
    await hexInput.fill('#3b82f6');
    await hexInput.blur();

    await page.waitForFunction(() => {
      const coloredNodes = [...document.querySelectorAll<SVGElement>('#view svg .node')].filter(
        (node) =>
          node
            .querySelector<SVGElement>('rect, path, polygon, circle, ellipse')
            ?.style.fill.includes('59, 130, 246')
      );
      return coloredNodes.length === 1 && coloredNodes[0].textContent?.includes('输入中文想法');
    });

    const hueBox = await page.getByLabel('色相').boundingBox();
    expect(hueBox).toBeTruthy();
    await page.mouse.click((hueBox?.x ?? 0) + (hueBox?.width ?? 0) / 3, (hueBox?.y ?? 0) + 8);

    await page.waitForFunction(() => {
      const coloredNodes = [...document.querySelectorAll<SVGElement>('#view svg .node')].filter(
        (node) => {
          const fill = node.querySelector<SVGElement>('rect, path, polygon, circle, ellipse')?.style
            .fill;
          return fill && fill !== 'rgba(59, 130, 246, 1)' && fill.includes('246');
        }
      );
      return coloredNodes.length === 1 && coloredNodes[0].textContent?.includes('输入中文想法');
    });

    const stored = await page.evaluate(() => localStorage.getItem('codeStore') ?? '');
    expect(stored).toContain('visualStyles');

    await page.getByRole('button', { name: '重置', exact: true }).click();
    await page.waitForFunction(() => {
      const coloredNodes = [...document.querySelectorAll<SVGElement>('#view svg .node')].filter(
        (node) =>
          node
            .querySelector<SVGElement>('rect, path, polygon, circle, ellipse')
            ?.style.fill.includes('246')
      );
      const saved = JSON.parse(localStorage.getItem('codeStore') || '{}') as {
        visualStyles?: Record<string, unknown>;
      };
      return coloredNodes.length === 0 && !saved.visualStyles;
    });
  });

  test('调色面板打开时双击图中文字也可以直接修改文字', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await page.locator('#view').getByText('输入中文想法', { exact: true }).click({ force: true });
    await page.getByRole('button', { name: '调色' }).click();
    await expect(page.getByText('HEX', { exact: true })).toBeVisible();

    await page
      .locator('#view')
      .getByText('输入中文想法', { exact: true })
      .dblclick({ force: true });
    const textEditor = page.getByLabel('图中文字编辑');
    await expect(textEditor).toBeVisible();
    await expect(textEditor).toBeFocused();
    await textEditor.fill('调色中改字');
    await textEditor.press('Enter');
    await expect(textEditor).toBeHidden();

    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code.includes('调色中改字') : false;
    });
    await expect(page.locator('#view')).toContainText('调色中改字');
  });

  test('调色面板打开时多种图表文字仍可以双击编辑', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    const cases = [
      {
        code: `sequenceDiagram
    John->>Alice: 你好`,
        from: 'John',
        to: '张三'
      },
      {
        code: `treemap-beta
"产品"
    "需求": 12`,
        from: '需求',
        to: '用户需求'
      },
      {
        code: `treeView-beta
  "项目"
    "文件"`,
        from: '文件',
        to: '设计文件'
      }
    ];

    for (const item of cases) {
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#view svg');
      await setEditorCode(page, item.code);
      await expect(page.locator('#view')).toContainText(item.from);
      await page
        .locator('#view')
        .getByText(item.from, { exact: true })
        .first()
        .click({ force: true });
      await page.getByRole('button', { name: '调色' }).click();
      await expect(page.getByText('HEX', { exact: true })).toBeVisible();

      await editViewText(page, item.from, item.to);
      await page.waitForFunction(
        (text) => localStorage.getItem('codeStore')?.includes(text),
        item.to
      );
      await expect(page.locator('#view')).toContainText(item.to);
    }
  });

  test('图中文字直接编辑支持回车确认和 Esc 取消', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await page
      .locator('#view')
      .getByText('输入中文想法', { exact: true })
      .dblclick({ force: true });
    await expect(page.getByLabel('图中文字编辑')).toBeVisible();
    await page.keyboard.insertText('临时文字');
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('图中文字编辑')).toBeHidden();
    await expect(page.locator('#view')).toContainText('输入中文想法');
    await expect(page.locator('#view')).not.toContainText('临时文字');
    await expect(page.getByRole('button', { name: '撤回' })).toBeDisabled();

    await page
      .locator('#view')
      .getByText('输入中文想法', { exact: true })
      .dblclick({ force: true });
    await expect(page.getByLabel('图中文字编辑')).toBeVisible();
    await page.keyboard.insertText('确认文字');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('图中文字编辑')).toBeHidden();
    await expect(page.locator('#view')).toContainText('确认文字');
  });

  test('时序图参与者和消息文字可以直接在图上修改', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `sequenceDiagram
    participant Alice as 小明
    Alice->>Bob: 你好`
    );

    await page.locator('#view').getByText('你好', { exact: true }).dblclick({ force: true });
    await expect(page.getByLabel('图中文字编辑')).toBeVisible();
    await page.keyboard.insertText('你好，世界');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code.includes(': 你好，世界') : false;
    });
    await expect(page.locator('#view')).toContainText('你好，世界');

    await page
      .locator('#view')
      .getByText('小明', { exact: true })
      .first()
      .dblclick({ force: true });
    await expect(page.getByLabel('图中文字编辑')).toBeVisible();
    await page.keyboard.insertText('项目经理');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code.includes('as 项目经理') : false;
    });
    await expect(page.locator('#view')).toContainText('项目经理');
  });

  test('时序图中未显式声明的 John 也可以直接编辑', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `sequenceDiagram
    John->>Alice: 你好`
    );

    await editViewText(page, 'John', '张三');
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? (JSON.parse(saved) as { code: string }).code.includes('张三->>Alice') : false;
    });
    await expect(page.locator('#view')).toContainText('张三');
  });

  test('思维导图可以持续添加多级分支且新增分支可继续编辑', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `mindmap
  root((主题))
    已有分支`
    );

    for (let index = 1; index <= 8; index += 1) {
      const parent = index === 1 ? '主题' : `连续分支 ${index - 1}`;
      const child = `连续分支 ${index}`;
      await chooseViewText(page, parent);
      await page.getByRole('button', { name: '分支' }).click();
      await expect(page.locator('#view')).toContainText('新分支');
      await editViewText(page, '新分支', child);
    }

    await expect(page.locator('#view')).toContainText('连续分支 8');
    const visibleTextCount = await page
      .locator('#view')
      .getByText(/连续分支/)
      .count();
    expect(visibleTextCount).toBeGreaterThanOrEqual(8);
  });

  test('矩形树图新增分支后可以继续编辑并添加子分支', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `treemap-beta
"产品"
    "需求": 12`
    );

    await page.locator('#view').getByText('需求', { exact: true }).first().click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');
    await editViewText(page, '新分支', '二级需求');
    await expect(page.locator('#view')).toContainText('二级需求');

    await page
      .locator('#view')
      .getByText('二级需求', { exact: true })
      .first()
      .click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, '新分支', '三级需求');
    await expect(page.locator('#view')).toContainText('三级需求');
    await expectStoredCodeContains(page, '"二级需求"');
    await expectStoredCodeContains(page, '"三级需求"');

    await page.reload();
    await page.waitForSelector('#view svg');
    await expect(page.locator('#view')).toContainText('二级需求');
    await expect(page.locator('#view')).toContainText('三级需求');

    await page
      .locator('#view')
      .getByText('三级需求', { exact: true })
      .first()
      .click({ force: true });
    await page.getByRole('button', { name: '删除' }).click();
    await expect(page.locator('#view')).not.toContainText('三级需求');
    await expectStoredCodeExcludes(page, '三级需求');
  });

  test('数据包图可以连续添加、编辑和删除多个字段', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `packet
0-15: "字段A"`
    );

    await page.locator('#view').getByText('字段A', { exact: true }).first().click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, '新分支', '字段B');
    await page.locator('#view').getByText('字段B', { exact: true }).first().click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, '新分支', '字段C');

    await expectStoredCodeContains(page, '16-31: "字段B"');
    await expectStoredCodeContains(page, '32-47: "字段C"');
    await page.reload();
    await page.waitForSelector('#view svg');
    await expect(page.locator('#view')).toContainText('字段B');
    await expect(page.locator('#view')).toContainText('字段C');
    await page.locator('#view').getByText('字段B', { exact: true }).first().click({ force: true });
    await expect(page.getByRole('button', { name: '删除' })).toHaveAttribute('title', /字段B/);
    await page.getByRole('button', { name: '删除' }).click();
    await expect(page.locator('#view')).not.toContainText('字段B');
    await expectStoredCodeContains(page, '字段C');
  });

  test('甘特图新增分支后可以编辑并继续添加分支', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `gantt
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 准备
    需求分析 :a1, 2026-07-01, 2d`
    );

    await chooseViewText(page, '需求分析');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');
    await editViewText(page, '新分支', '设计评审');
    await expect(page.locator('#view')).toContainText('设计评审');
    await chooseViewText(page, '设计评审');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');
    await expectStoredCodeContains(page, '设计评审');
  });

  test('块状树图新增分支后可以编辑并继续添加子分支', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `block-beta
  columns 2
  A["产品"]
  B["需求"]`
    );

    await chooseViewText(page, '需求');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');
    await editViewText(page, '新分支', '原型');
    await expect(page.locator('#view')).toContainText('原型');
    await chooseViewText(page, '原型');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');
  });

  test('用户旅程图可以拖动心情并同步分数', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `journey
    title 购物体验
    section 浏览
      打开首页: 3: 用户`
    );

    const face = page.locator('#view svg .face').first();
    const box = await face.boundingBox();
    expect(box).toBeTruthy();
    const originalY = box?.y ?? 0;
    await page.mouse.move((box?.x ?? 0) + 8, (box?.y ?? 0) + 8);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + 8, (box?.y ?? 0) - 100, { steps: 8 });
    await page.mouse.up();

    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved
        ? /打开首页:\s*[45]:\s*用户/.test((JSON.parse(saved) as { code: string }).code)
        : false;
    });
    await expect
      .poll(async () => (await face.boundingBox())?.y ?? originalY)
      .toBeLessThan(originalY);

    await page.getByRole('button', { name: '撤回' }).click();
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved
        ? /打开首页:\s*3:\s*用户/.test((JSON.parse(saved) as { code: string }).code)
        : false;
    });
    await page.getByRole('button', { name: '恢复' }).click();
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved
        ? /打开首页:\s*[45]:\s*用户/.test((JSON.parse(saved) as { code: string }).code)
        : false;
    });
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await page.waitForFunction(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved
        ? /打开首页:\s*3:\s*用户/.test((JSON.parse(saved) as { code: string }).code)
        : false;
    });
  });

  test('用户旅程图选中大模块后可以添加新的大模块', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `journey
    title 回家流程
    section 出门
      打车: 3: 用户`
    );

    await chooseViewText(page, '出门');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');
    await expectStoredCodeContains(page, 'section 新分支');
    await editViewText(page, '新分支', 'go home');
    await expect(page.locator('#view')).toContainText('go home');
  });

  test('饼图新增分支时提示数值决定占比', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `pie title 宠物
    "狗" : 10
    "猫" : 20`
    );

    await chooseViewText(page, '狗');
    await page.getByRole('button', { name: '分支' }).click();
    const notice = page.getByTestId('diagram-operation-notice');
    await expect(notice).toBeVisible({ timeout: 12_000 });
    await expect(notice).toContainText('饼图占比由左侧数据数值决定');
    await expect(notice).toContainText('当前总数值为：31');
    await notice.getByRole('button', { name: '关闭操作提示' }).click();
    await expect(notice).toBeHidden();
  });

  test('象限图新增元素后可以编辑和删除', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `quadrantChart
    title 优先级
    quadrant-1 重要
    quadrant-2 普通
    quadrant-3 延后
    quadrant-4 放弃
    现有任务: [0.2, 0.7]`
    );

    await chooseViewText(page, '现有任务');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.getByTestId('diagram-operation-notice')).toContainText('已新增象限图元素');
    await expect(page.locator('#view')).toContainText('新分支');
    await editViewText(page, '新分支', '新增机会');
    const quadrantPoint = page.locator('#view svg text').filter({ hasText: '新增机会' }).first();
    const pointBox = await quadrantPoint.boundingBox();
    expect(pointBox).toBeTruthy();
    await page.mouse.move((pointBox?.x ?? 0) + 4, (pointBox?.y ?? 0) + 4);
    await page.mouse.down();
    await page.mouse.move((pointBox?.x ?? 0) - 80, (pointBox?.y ?? 0) + 70, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => getStoredCode(page)).not.toContain('新增机会: [0.75, 0.75]');
    await chooseViewText(page, '新增机会');
    await page.getByRole('button', { name: '删除' }).click();
    await expect(page.locator('#view')).not.toContainText('新增机会');
    await expectStoredCodeExcludes(page, '新增机会');
  });

  test('左上角标题只展示图表编辑器且不能点击', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('nav').getByText('图表编辑器', { exact: true });
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('nav').getByText('图表魔法编辑器', { exact: true })).toHaveCount(0);
  });

  test('C4 和需求图新增模块可以编辑并删除', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `C4Context
    Person(user, "用户")
    System(app, "应用")
    Rel(user, app, "使用")`
    );
    await chooseViewText(page, '应用');
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, '新分支', '支付模块');
    await expectStoredCodeContains(page, 'Rel(app, Branch1, "包含")');
    await chooseViewText(page, '支付模块');
    await page.getByRole('button', { name: '删除' }).click();
    await expectStoredCodeExcludes(page, 'Branch1');

    await setEditorCode(
      page,
      `requirementDiagram
    requirement root {
      id: R1
      text: "根需求"
      risk: low
      verifymethod: test
    }`
    );
    await expect(page.locator('#view')).toContainText('Text: 根需求');
    await chooseViewText(page, 'Text: 根需求');
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, 'Text: 新分支', '登录需求');
    await expect.poll(() => getStoredCode(page)).toContain('root - contains -> branch1');
    await chooseViewText(page, 'Text: 登录需求');
    await page.getByRole('button', { name: '删除' }).click();
    await expectStoredCodeExcludes(page, 'branch1');
  });

  test('雷达和 XY 图增减维度时会同步数据序列', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `radar-beta
  axis a["速度"], b["质量"]
  curve x["方案"]{60, 70}`
    );
    await chooseViewText(page, '速度');
    await page.getByRole('button', { name: '分支' }).click();
    await expectStoredCodeContains(page, '{60, 70, 50}');
    await chooseViewText(page, '新分支');
    await page.getByRole('button', { name: '删除' }).click();
    await expectStoredCodeContains(page, '{60, 70}');

    await setEditorCode(
      page,
      `xychart-beta
    x-axis ["一月", "二月"]
    bar [10, 20]
    line [15, 25]`
    );
    await expect(page.locator('#view')).toContainText('一月');
    await chooseViewText(page, '一月');
    await page.getByRole('button', { name: '分支' }).click();
    await expectStoredCodeContains(page, 'bar [10, 20, 0]');
    await expect(page.locator('#view')).toContainText('新分支');
    await page
      .locator('#view svg text')
      .filter({ hasText: '新分支' })
      .first()
      .click({ force: true });
    const xyDeleteButton = page.getByRole('button', { name: '删除' });
    await expect(xyDeleteButton).toHaveAttribute('title', '删除“新分支”');
    await xyDeleteButton.click();
    await expect.poll(() => getStoredCode(page)).toContain('bar [10, 20]');
    await expect.poll(() => getStoredCode(page)).not.toContain('bar [10, 20, 0]');
  });

  test('时间线阶段排序会携带其全部子事件', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await setEditorCode(
      page,
      `timeline
    2001 : 起步
         : 调研
    2007 : 发布
         : 增长`
    );
    await expect(page.locator('#view')).toContainText('2007');
    await chooseViewText(page, '2007');
    await page.locator('.timeline-order-button[title*="2007"]').first().click();
    await expect
      .poll(async () => {
        const code = await getStoredCode(page);
        return (
          code.indexOf('2007') < code.indexOf('2001') && code.indexOf('增长') < code.indexOf('2001')
        );
      })
      .toBe(true);
    await page.getByRole('button', { name: '撤回' }).click();
    await expect
      .poll(async () => {
        const code = await getStoredCode(page);
        return code.indexOf('2001') < code.indexOf('2007');
      })
      .toBe(true);
  });

  test('架构图新增服务会继承分组、连接、编辑并删除', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await setEditorCode(
      page,
      `architecture-beta
    group api(cloud)[平台]
    service server(server)[服务] in api`
    );
    await expect(page.locator('#view')).toContainText('服务');
    await chooseViewText(page, '服务');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('server:R -- L:service1');
    await editViewText(page, '新分支', '订单服务');
    await chooseViewText(page, '订单服务');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('service1:R -- L:service2');
    await chooseViewText(page, '订单服务');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('service1');
  });

  test('维恩图新增集合会生成交集并支持编辑删除', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await setEditorCode(
      page,
      `venn-beta
    set A["产品"]
    set B["技术"]
    union A,B["共同能力"]`
    );
    await expect(page.locator('#view')).toContainText('产品');
    await chooseViewText(page, '产品');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('union A,Set1["交集1"]');
    await editViewText(page, '新分支', '市场');
    await chooseViewText(page, '市场');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('Set1');
  });

  test('Git 图分支、提交、重命名和删除保持引用一致', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await setEditorCode(
      page,
      `gitGraph
    commit id: "初始"
    branch develop
    checkout develop
    commit id: "开发"`
    );
    await expect(page.locator('#view')).toContainText('develop');
    await chooseViewText(page, 'develop');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('branch1');
    await chooseViewText(page, 'branch1');
    await page.getByRole('button', { name: '改名' }).click();
    await expect(page.getByLabel('图中文字编辑')).toBeVisible();
    await page.getByLabel('图中文字编辑').fill('功能分支');
    await page.keyboard.press('Enter');
    await expect.poll(() => getStoredCode(page)).toContain('branch "功能分支"');
    await chooseViewText(page, '功能分支');
    await page.getByRole('button', { name: '提交' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('checkout "功能分支"');
    await chooseViewText(page, '功能分支');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('功能分支');
  });

  test('数据包支持前后插入、拆分和大中小尺寸', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await setEditorCode(
      page,
      `packet
0-15: "字段A"
16-31: "字段B"`
    );
    await chooseViewText(page, '字段B');
    await page.getByRole('button', { name: '前插' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('16-31: "新分支"');
    await chooseViewText(page, '新分支');
    await page.getByRole('button', { name: '大', exact: true }).click();
    await expect.poll(() => getStoredCode(page)).toContain('16-47: "新分支"');
    await chooseViewText(page, '字段A');
    await page.getByRole('button', { name: '拆分' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('0-7: "字段A"');
    await page.getByRole('button', { name: '撤回' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('0-15: "字段A"');
    await page.getByRole('button', { name: '恢复' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('0-7: "字段A"');
  });

  test('块图可以在两个模块之间添加、调色和删除箭头', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await setEditorCode(
      page,
      `block-beta
  columns 2
  A["甲"]
  B["乙"]`
    );
    await chooseViewText(page, '甲');
    await page.getByRole('button', { name: '箭头', exact: true }).click();
    await expect(page.getByText(/请点击箭头目标/)).toBeVisible();
    await chooseViewText(page, '乙');
    await expect.poll(() => getStoredCode(page)).toContain('A -- "箭头1" --> B');
    await chooseViewText(page, '箭头1');
    await expect(page.getByRole('button', { name: '调色' })).toBeVisible();
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('箭头1');
  });

  test('甘特图可以新增、编辑 section 分组并继续添加任务', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await setEditorCode(
      page,
      `gantt
    title 项目计划
    dateFormat YYYY-MM-DD
    section 设计
    调研 :a1, 2026-07-01, 2d`
    );
    await chooseViewText(page, '设计');
    await page.getByRole('button', { name: '分组' }).click();
    await expect(page.locator('#view')).toContainText('新分组');
    await editViewText(page, '新分组', '开发');
    await chooseViewText(page, '开发');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toMatch(/section 开发[\s\S]*新分支\s+:task/);
    await chooseViewText(page, '开发');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('section 开发');
  });

  test('实体关系分支隶属于所选实体并可编辑删除', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
      string name
    }
    ORDER {
      string number
    }`
    );
    await chooseViewText(page, 'ORDER');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('ORDER ||--o{ ENTITY1');
    await editViewText(page, '新分支', '明细');
    await chooseViewText(page, 'ENTITY1');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('ENTITY1');
  });

  test('块图示例自带的无标签箭头可删除并可撤回', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `block-beta
  A["甲"]
  B["乙"]
      A --> B`
    );
    await expect(page.locator('#view')).toContainText('甲');
    const edge = page.locator('#view path[data-style-id="L_A_B_0"]');
    await expect(edge).toHaveCount(1);
    await expect(edge).toHaveAttribute('data-edge', 'true');
    await expect(edge).toHaveCSS('pointer-events', 'stroke');
    expect(await edge.evaluate((path: SVGGraphicsElement) => path.getBBox().width)).toBeGreaterThan(
      0
    );
    await edge.dispatchEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 240,
      clientY: 240
    });
    const deleteButton = page.getByRole('button', { name: '删除' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click({ force: true });
    await expect.poll(() => getStoredCode(page)).not.toContain('A --> B');
    await page.getByRole('button', { name: '撤回' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('A --> B');
  });

  test('C4 边界标题、节点标题和说明文字均可直接编辑', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `C4Context
    Enterprise_Boundary(boundary, "system") {
      System(app, "应用", "说明文字")
    }`
    );
    await editViewText(page, 'system', '系统边界');
    await editViewText(page, '应用', '订单应用');
    await editViewText(page, '说明文字', '处理订单');
    await expect.poll(() => getStoredCode(page)).toContain('"系统边界"');
    await expect.poll(() => getStoredCode(page)).toContain('"处理订单"');
  });

  test('沃德利组件新增、改名、拖动和删除会同步数据', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `wardley-beta
title Product Map
size [1100, 800]
anchor User [0.95, 0.50]
component Product [0.80, 0.50]
User -> Product`
    );
    await chooseViewText(page, 'Product');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('Product -> Component1');
    await editViewText(page, 'Component1', '支付');
    const component = page.locator('#view').getByText('支付', { exact: true }).first();
    const box = await component.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 - 60, {
        steps: 5
      });
      await page.mouse.up();
    }
    await expect.poll(() => getStoredCode(page)).not.toContain('支付 [0.50, 0.50]');
    await chooseViewText(page, '支付');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('支付');
  });

  test('ZenUML 原文本可改并能新增、编辑和删除步骤', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `zenuml
    @Actor Client
    Service.create()`
    );
    await editViewText(page, 'Client', 'Customer');
    await chooseViewText(page, 'Customer');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('Customer.newStep1()');
    await editViewText(page, 'newStep1()', 'confirm()');
    await chooseViewText(page, 'confirm()');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('confirm()');
  });

  test('需求图、甘特图和块图使用可继续编辑的中文典型初始示例', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#view svg');
    await page.getByText('需求图', { exact: true }).click({ force: true });
    await expect(page.locator('#view')).toContainText('支持在线创建订单');
    await expect.poll(() => getStoredCode(page)).toContain('order_requirement - contains');

    await page.getByText('甘特图', { exact: true }).click({ force: true });
    await expect(page.locator('#view')).toContainText('产品发布计划');
    await expect.poll(() => getStoredCode(page)).toContain('section 测试与发布');
    await expect.poll(() => getStoredCode(page)).toContain('after develop');

    await page.getByText('块图', { exact: true }).click({ force: true });
    await expect(page.locator('#view')).toContainText('订单服务');
    await expect.poll(() => getStoredCode(page)).toContain('order --> payment');
    await expect(page.locator('#view svg')).toBeVisible();
    await expect.poll(async () => (await getStoredCode(page)).match(/-->/g)?.length ?? 0).toBe(9);
  });

  test('块图节点可自由移动、箭头实时跟随并支持保存撤回重做和重置', async ({ page }) => {
    await page.goto('/');
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
    const source = page.locator('#view').getByText('乙', { exact: true }).first();
    const sourceBox = await source.boundingBox();
    expect(sourceBox).toBeTruthy();
    const node = page.locator('#view svg g.node[data-style-id="B"]');
    const edges = page.locator('#view svg path.flowchart-link');
    const initialTransform = await node.getAttribute('transform');
    const initialPaths = await edges.evaluateAll((items) =>
      items.map((item) => item.getAttribute('d'))
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem('diagramInitialStore') ?? '{}') as {
            state?: { code?: string; visualPositions?: Record<string, { x: number; y: number }> };
          };
          return saved.state?.code;
        })
      )
      .toContain('block-beta');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem('diagramInitialStore') ?? '{}') as {
            state?: { visualPositions?: Record<string, { x: number; y: number }> };
          };
          return saved.state?.visualPositions?.B;
        })
      )
      .toBeUndefined();
    if (sourceBox) {
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2 + 180,
        sourceBox.y + sourceBox.height / 2 + 100,
        {
          steps: 8
        }
      );
      await page.mouse.up();
    }
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = localStorage.getItem('codeStore');
          const position = saved
            ? (JSON.parse(saved) as { visualPositions?: Record<string, { x: number; y: number }> })
                .visualPositions?.B
            : undefined;
          return Boolean(position && Math.abs(position.x) > 100 && Math.abs(position.y) > 50);
        })
      )
      .toBe(true);
    await expect(node).not.toHaveAttribute('transform', initialTransform ?? '');
    await expect
      .poll(async () => {
        const paths = await edges.evaluateAll((items) =>
          items.map((item) => item.getAttribute('d'))
        );
        return (
          paths.length === initialPaths.length &&
          paths.every((path, index) => path !== initialPaths[index])
        );
      })
      .toBe(true);
    await expect.poll(() => getStoredCode(page)).toContain('A --> B');
    await expect.poll(() => getStoredCode(page)).toContain('C --> B');

    await page.getByRole('button', { name: '撤回' }).click();
    await expect(node).toHaveAttribute('transform', initialTransform ?? '');
    await page.getByRole('button', { name: '恢复' }).click();
    await expect(node).not.toHaveAttribute('transform', initialTransform ?? '');
    const movedTransform = await node.getAttribute('transform');

    await page.reload();
    await expect(page.locator('#view svg g.node[data-style-id="B"]')).toHaveAttribute(
      'transform',
      movedTransform ?? ''
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem('diagramInitialStore') ?? '{}') as {
            state?: { visualPositions?: Record<string, { x: number; y: number }> };
          };
          return saved.state?.visualPositions?.B;
        })
      )
      .toBeUndefined();
    await page.getByTitle('重置成最初的图').click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            visualPositions?: Record<string, { x: number; y: number }>;
          };
          return saved.visualPositions?.B;
        })
      )
      .toBeUndefined();
    await expect(page.locator('#view svg g.node[data-style-id="B"]')).toHaveAttribute(
      'transform',
      initialTransform ?? ''
    );
  });

  test('C4 新分支保留容器归属，原始关系和父容器均可安全删除', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `C4Container
    System_Boundary(order, "订单系统") {
      Container(api, "订单 API", "Node", "处理订单")
    }
    System_Ext(pay, "支付平台")
    Rel(api, pay, "调用支付")`
    );
    await chooseViewText(page, '订单 API');
    await page.getByRole('button', { name: '分支' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('Container(Branch1');
    await expect
      .poll(async () => {
        const code = await getStoredCode(page);
        return (
          code.indexOf('Container(Branch1') > code.indexOf('System_Boundary(order') &&
          code.indexOf('Container(Branch1') < code.indexOf('System_Ext(pay')
        );
      })
      .toBe(true);

    await chooseViewText(page, '调用支付');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('Rel(api, pay');
    await expect.poll(() => getStoredCode(page)).toContain('Container(api');
    await expect.poll(() => getStoredCode(page)).toContain('System_Ext(pay');

    await chooseViewText(page, '订单系统');
    await page.getByRole('button', { name: '删除' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('order');
    await expect.poll(() => getStoredCode(page)).not.toContain('Container(api');
    await expect.poll(() => getStoredCode(page)).not.toContain('Branch1');
    await expect.poll(() => getStoredCode(page)).toContain('System_Ext(pay');
    await page.getByRole('button', { name: '撤回' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('Container(api');
  });

  test('C4 节点可自由移动且关系线和保存坐标同步更新', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `C4Context
    Person(user, "用户")
    System(app, "应用")
    Rel(user, app, "使用")`
    );
    const node = page.locator('#view svg g[data-c4-id="app"]');
    const relation = page
      .locator('#view svg g')
      .filter({ hasText: '使用' })
      .locator(':scope > line');
    const viewport = page.locator('#view svg .svg-pan-zoom_viewport');
    const box = await node.boundingBox();
    expect(box).toBeTruthy();
    const initialTransform = await node.getAttribute('transform');
    const initialX2 = await relation.getAttribute('x2');
    const initialViewportTransform = await viewport.getAttribute('transform');
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 70, { steps: 8 });
      await page.mouse.up();
    }
    await expect(node).not.toHaveAttribute('transform', initialTransform ?? '');
    await expect(relation).not.toHaveAttribute('x2', initialX2 ?? '');
    await expect(viewport).toHaveAttribute('transform', initialViewportTransform ?? '');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = localStorage.getItem('codeStore');
          return saved
            ? Boolean(
                (JSON.parse(saved) as { visualPositions?: Record<string, unknown> }).visualPositions
                  ?.app
              )
            : false;
        })
      )
      .toBe(true);

    const emptyCanvasPoint = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('#view svg');
      if (!svg) return undefined;
      const bounds = svg.getBoundingClientRect();
      for (let y = bounds.top + 8; y < bounds.bottom - 8; y += 24) {
        for (let x = bounds.left + 8; x < bounds.right - 8; x += 24) {
          if (document.elementFromPoint(x, y) === svg) return { x, y };
        }
      }
      return undefined;
    });
    expect(emptyCanvasPoint).toBeTruthy();
    if (emptyCanvasPoint) {
      await page.mouse.move(emptyCanvasPoint.x, emptyCanvasPoint.y);
      await page.mouse.down();
      await page.mouse.move(emptyCanvasPoint.x + 70, emptyCanvasPoint.y + 35, { steps: 6 });
      await page.mouse.up();
    }
    await expect(viewport).not.toHaveAttribute('transform', initialViewportTransform ?? '');

    await page.getByRole('button', { name: '撤回' }).click();
    await expect(node).toHaveAttribute('transform', initialTransform ?? '');
  });

  test('C4 触控首次拖动模块不会被画布平移抢占', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: 'http://localhost:3000',
      hasTouch: true,
      isMobile: true,
      viewport: { height: 820, width: 430 }
    });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await page.locator('#editorMode').click();
      await setEditorCode(
        page,
        `C4Context
    Person(user, "用户")
    System(app, "应用")
    Rel(user, app, "使用")`
      );
      await page.locator('#editorMode').click();
      await page.waitForTimeout(350);
      const node = page.locator('#view svg g[data-c4-id="app"]');
      const relation = page
        .locator('#view svg g')
        .filter({ hasText: '使用' })
        .locator(':scope > line');
      const viewport = page.locator('#view svg .svg-pan-zoom_viewport');
      const box = await node.boundingBox();
      expect(box).toBeTruthy();
      const initialNodeTransform = await node.getAttribute('transform');
      const initialRelationX2 = await relation.getAttribute('x2');
      const initialViewportTransform = await viewport.getAttribute('transform');
      if (box) {
        const session = await context.newCDPSession(page);
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await session.send('Input.dispatchTouchEvent', {
          touchPoints: [start],
          type: 'touchStart'
        });
        for (const ratio of [0.25, 0.5, 0.75, 1]) {
          await page.waitForTimeout(30);
          await session.send('Input.dispatchTouchEvent', {
            touchPoints: [{ x: start.x + 80 * ratio, y: start.y + 55 * ratio }],
            type: 'touchMove'
          });
        }
        await page.waitForTimeout(30);
        await session.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
      }
      await expect(node).not.toHaveAttribute('transform', initialNodeTransform ?? '');
      await expect(relation).not.toHaveAttribute('x2', initialRelationX2 ?? '');
      await expect(viewport).toHaveAttribute('transform', initialViewportTransform ?? '');
      await expect
        .poll(() =>
          page.evaluate(() => {
            const stored = localStorage.getItem('codeStore');
            return stored
              ? Boolean(
                  (JSON.parse(stored) as { visualPositions?: Record<string, unknown> })
                    .visualPositions?.app
                )
              : false;
          })
        )
        .toBe(true);
    } finally {
      await context.close();
    }
  });

  test('网站使用新的图表编辑器图标资源', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav svg.size-6')).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /favicon\.svg/);
    const favicon = await page.request.get('/favicon.svg');
    expect(await favicon.text()).toContain('aria-label="图表编辑器"');
  });

  test('树图夜晚模式会使用高对比暗色配色', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForSelector('#view svg');

    await setEditorCode(
      page,
      `treeView-beta
  "项目"
    "文件"`
    );
    await expect(page.locator('#view')).toContainText('文件');

    const config = await page.evaluate(() => {
      const saved = window.localStorage.getItem('codeStore');
      return saved ? JSON.parse((JSON.parse(saved) as { mermaid: string }).mermaid) : undefined;
    });
    expect(config.theme).toBe('dark');
    expect(config.themeVariables.primaryTextColor).toBe('#fff7ed');
    expect(config.themeVariables.lineColor).toBe('#fdba74');
  });

  test('流程图新增分支的箭头文字可以反复编辑并撤回', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `flowchart LR
  A[开始]`
    );
    await chooseViewText(page, '开始');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('关系');
    await editViewText(page, '关系', '校验通过');
    await expect.poll(() => getStoredCode(page)).toContain('-->|校验通过|');
    await editViewText(page, '校验通过', '继续处理');
    await expect.poll(() => getStoredCode(page)).toContain('-->|继续处理|');
    await page.getByRole('button', { name: '撤回' }).click();
    await expect(page.locator('#view')).toContainText('校验通过');
    await page.reload();
    await expect(page.locator('#view')).toContainText('校验通过');
  });

  test('类图新增类的标题字段方法和后续成员均可编辑', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `classDiagram
  class Root {
    +String name
    +save()
  }`
    );
    await chooseViewText(page, 'Root');
    await page.getByRole('button', { name: '分支' }).click();
    await editViewText(page, '新分支', '订单服务');
    await editViewText(page, '+String 新字段', '+String orderId');
    await editViewText(page, '+新方法()', '+createOrder()');
    await chooseViewText(page, '+String orderId');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('+String 新字段');
    await editViewText(page, '+String 新字段', '+String status');
    const code = await getStoredCode(page);
    expect(code).toContain('class Branch1["订单服务"]');
    expect(code).toContain('+String orderId');
    expect(code).toContain('+createOrder()');
    expect(code).toContain('+String status');
    await page.reload();
    await expect(page.locator('#view')).toContainText('订单服务');
    await expect(page.locator('#view')).toContainText('+String status');
  });

  test('需求图新增分支的 ID 文本风险和验证方式均可编辑', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `requirementDiagram
  functionalRequirement root {
    id: R1
    text: "主需求"
    risk: high
    verifymethod: inspection
  }`
    );
    await page
      .locator('#view')
      .getByText('主需求', { exact: false })
      .first()
      .click({ force: true });
    await page.getByRole('button', { name: '分支' }).click();
    await editViewTextContaining(page, '新分支', '支付需求');
    await editViewTextContaining(page, 'branch1', 'R_PAY');
    await editViewTextContaining(page, 'Verification: Test', 'Analysis');
    await editViewTextContaining(page, 'Low', 'Medium');
    await editViewTextContaining(
      page,
      '<<Functional Requirement>>',
      '接口需求',
      'Interface Requirement'
    );
    const code = (await getStoredCode(page)).toLowerCase();
    expect(code).toContain('interfacerequirement branch1');
    expect(code).toContain('text: "支付需求"');
    expect(code).toContain('id: r_pay');
    expect(code).toContain('risk: medium');
    expect(code).toContain('verifymethod: analysis');
    expect(code).toContain('root - contains -> branch1');
    await page.reload();
    await expect(page.locator('#view')).toContainText('支付需求');
  });

  test('架构图原始和新增模块可自由移动且箭头实时跟随并可恢复', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `architecture-beta
  group api(cloud)[平台]
  service server(server)[服务] in api
  service db(database)[数据库] in api
  server:R --> L:db`
    );
    await chooseViewText(page, '服务');
    await page.getByRole('button', { name: '分支' }).click();
    await expect(page.locator('#view')).toContainText('新分支');
    await page.getByRole('button', { name: '重置视图' }).click();
    const node = page.locator('#view g[data-architecture-id="db"]');
    const edge = page.locator('#view .architecture-edges path.edge[id*="L_server_db_"]');
    const box = await node.boundingBox();
    expect(box).toBeTruthy();
    if (!box) throw new Error('架构图数据库模块没有可用坐标');
    const initialPath = await edge.getAttribute('d');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, {
      steps: 8
    });
    await page.mouse.up();
    await expect.poll(() => edge.getAttribute('d')).not.toBe(initialPath);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            visualPositions?: Record<string, { x: number; y: number }>;
          };
          return saved.visualPositions?.db;
        })
      )
      .toBeTruthy();
    const movedTransform = await node.getAttribute('transform');
    await page.reload();
    await expect(page.locator('#view g[data-architecture-id="db"]')).toHaveAttribute(
      'transform',
      movedTransform ?? ''
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem('diagramInitialStore') ?? '{}') as {
            state?: { visualPositions?: Record<string, { x: number; y: number }> };
          };
          return saved.state?.visualPositions?.db;
        })
      )
      .toBeUndefined();
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            visualPositions?: Record<string, { x: number; y: number }>;
          };
          return saved.visualPositions?.db;
        })
      )
      .toBeUndefined();
    await expect
      .poll(() => page.locator('#view g[data-architecture-id="db"]').getAttribute('transform'))
      .not.toBe(movedTransform);
  });

  test('架构图虚线分组框支持新增、编辑尺寸和无损删除', async ({ page }) => {
    await page.goto('/');
    await setEditorCode(
      page,
      `architecture-beta
  group api(cloud)[业务服务]
  service order(server)[订单服务] in api
  service payment(server)[支付服务] in api
  order:R --> L:payment`
    );
    await page.getByRole('button', { name: '添加虚线分组框' }).click();
    await expect.poll(() => getStoredCode(page)).toContain('%% architecture-group');

    const group = page.locator('#view [data-architecture-group-id]').last();
    await group.locator('[data-architecture-group-title]').click({ force: true });
    const toolbar = page.getByTestId('architecture-group-toolbar');
    await expect(toolbar).toBeVisible();
    await toolbar.getByLabel('虚线框标题').fill('核心交易域');
    await toolbar.getByLabel('虚线框标题').press('Enter');
    await toolbar.getByLabel('宽').fill('420');
    await toolbar.getByLabel('宽').press('Tab');
    await toolbar.getByLabel('高').fill('240');
    await toolbar.getByLabel('高').press('Tab');
    await expect.poll(() => getStoredCode(page)).toContain('核心交易域');
    await expect.poll(() => getStoredCode(page)).toContain('"width":420');
    await expect.poll(() => getStoredCode(page)).toContain('"height":240');
    await expect(group.locator('[data-architecture-group-resize]')).toHaveCount(8);

    await toolbar.getByRole('button', { name: '删除虚线分组框' }).click();
    await expect.poll(() => getStoredCode(page)).not.toContain('核心交易域');
    await expect(page.locator('#view')).toContainText('订单服务');
    await expect(page.locator('#view')).toContainText('支付服务');
    await page.getByRole('button', { name: '撤回', exact: true }).click();
    await expect.poll(() => getStoredCode(page)).toContain('核心交易域');
  });
});
