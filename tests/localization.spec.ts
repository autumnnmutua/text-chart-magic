import { expect, test } from './test';
import { localizedDiagramSamples } from '../src/lib/util/diagramSamples';
import { serializeState } from '../src/lib/util/serde';
import { TEST_BASE_URL } from './utils';

const sampleURL = (code: string) =>
  `/edit#${serializeState({
    code,
    grid: true,
    mermaid: '{"theme":"default"}',
    panZoom: true,
    rough: false,
    updateDiagram: true
  })}`;

const editableSampleLabels: Record<keyof typeof localizedDiagramSamples, string> = {
  Architecture: '订单服务',
  Block: '订单服务',
  C4: '业务 API',
  Class: '+String orderNo',
  'Entity Relationship': '订单编号',
  Flowchart: '确认支付',
  Gantt: '核心开发',
  Git: 'develop',
  Ishikawa: '系统',
  Kanban: '梳理用户需求',
  Mindmap: '用户价值',
  Packet: '消息类型',
  Pie: '移动应用',
  Quadrant: '快速结算',
  Radar: '易用性',
  Requirement: '支持在线创建订单',
  Sankey: '浏览商品',
  Sequence: '顾客',
  State: '已支付',
  Timeline: '2025',
  TreeView: '交易服务',
  Treemap: '订单服务',
  'User Journey': '搜索目标商品',
  Venn: '产品价值',
  'Wardley Maps': '在线下单',
  XY: '一月',
  ZenUML: 'Customer'
};

test.describe('中文化编辑器', () => {
  test('根路径直接显示编辑器', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('图表工作台 - 代码与画布双模编辑');
    await expect(page.locator('nav').getByText('图表工作台', { exact: true })).toBeVisible();
    await expect(page.getByText('试试 Mermaid 高级编辑器')).toHaveCount(0);
    await expect(page.locator('#view').getByText('输入中文想法', { exact: true })).toBeVisible();
  });

  test('初始界面是中文、中文图表和橙色主题', async ({ page }) => {
    await page.goto('/edit');

    await expect(page).toHaveTitle('图表工作台 - 代码与画布双模编辑');
    await expect(page.locator('nav').getByText('图表工作台', { exact: true })).toBeVisible();
    await expect(page.getByText('试试 Mermaid 高级编辑器')).toHaveCount(0);
    await expect(page.getByText('图表库', { exact: true })).toBeVisible();
    await expect(page.getByText('导出', { exact: true })).toBeVisible();

    await expect(page.locator('#editor')).toContainText('输入中文想法');
    await expect(page.locator('#editor')).toContainText('生成图表');
    await expect(page.locator('#view')).toContainText('输入中文想法');
    await expect(page.locator('#view')).toContainText('生成图表');

    const accentColors = await page.locator('body').evaluate((body) => {
      const probe = document.createElement('span');
      body.append(probe);
      probe.style.color = 'var(--accent)';
      const actual = getComputedStyle(probe).color;
      probe.style.color = 'hsl(24 95% 53%)';
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { actual, expected };
    });
    expect(accentColors.actual).toBe(accentColors.expected);
  });

  test('全部图表入口均加载可渲染的中文初始示例', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    const diagrams = [
      ['Flowchart', 'flowchart'],
      ['Class', 'classDiagram'],
      ['Sequence', 'sequenceDiagram'],
      ['Entity Relationship', 'erDiagram'],
      ['State', 'stateDiagram-v2'],
      ['Mindmap', 'mindmap'],
      ['Architecture', 'architecture-beta'],
      ['Block', 'block-beta'],
      ['C4', 'C4Container'],
      ['Gantt', 'gantt'],
      ['Git', 'gitGraph'],
      ['Ishikawa', 'ishikawa-beta'],
      ['Kanban', 'kanban'],
      ['Packet', 'packet'],
      ['Pie', 'pie'],
      ['Quadrant', 'quadrantChart'],
      ['Radar', 'radar-beta'],
      ['Requirement', 'requirementDiagram'],
      ['Sankey', 'sankey-beta'],
      ['Timeline', 'timeline'],
      ['TreeView', 'treeView-beta'],
      ['Treemap', 'treemap-beta'],
      ['User Journey', 'journey'],
      ['Venn', 'venn-beta'],
      ['Wardley Maps', 'wardley-beta'],
      ['XY', 'xychart-beta'],
      ['ZenUML', 'zenuml']
    ] as const;

    for (const [name, keyword] of diagrams) {
      await test.step(name, async () => {
        const code = localizedDiagramSamples[name][0].code;
        const previousSvgContent = await page.locator('#container > svg').innerHTML();
        await page.goto(sampleURL(code), { waitUntil: 'domcontentloaded' });
        expect(code).toContain(keyword);
        await expect(page.locator('#view')).toBeAttached({ timeout: 10_000 });
        await expect
          .poll(() =>
            page.evaluate(() => {
              const saved = localStorage.getItem('codeStore');
              return saved ? (JSON.parse(saved) as { code?: string }).code : '';
            })
          )
          .toBe(code);
        await expect
          .poll(() => page.locator('#container > svg').innerHTML(), {
            message: `${name} should finish rendering new SVG content`,
            timeout: 15_000
          })
          .not.toBe(previousSvgContent);
        await expect(page.locator('#view')).toHaveAttribute('aria-busy', 'false');
        await expect(page.locator('#view')).not.toHaveClass(/opacity-50/);
        await expect(page.locator('#container > svg')).toBeVisible();
      });
    }
  });

  test('示例按钮可以加载对应图表', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '桑基图', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = localStorage.getItem('codeStore');
          return saved ? (JSON.parse(saved) as { code?: string }).code : '';
        })
      )
      .toContain('sankey-beta');
  });

  test('每种初始示例均可从画布进入文字编辑而不受模板状态限制', async ({ page }) => {
    test.setTimeout(150_000);
    for (const [name, [sample]] of Object.entries(localizedDiagramSamples)) {
      await test.step(name, async () => {
        await page.goto(sampleURL(sample.code), { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#view')).toHaveAttribute('aria-busy', 'false', {
          timeout: 15_000
        });
        const label = editableSampleLabels[name as keyof typeof editableSampleLabels];
        const target = page
          .locator('#view foreignObject p, #view text, #view tspan')
          .filter({ hasText: label })
          .last();
        await expect(target, `${name}: ${label}`).toBeAttached();
        await expect(target, `${name}: ${label} source range`).toHaveAttribute(
          'data-editable-source-start',
          /\d+/
        );
        await target.dispatchEvent('dblclick', { bubbles: true, cancelable: true });
        await expect(page.getByLabel('图中文字编辑'), `${name}: ${label}`).toBeVisible();
        await page.getByLabel('图中文字编辑').press('Escape');
      });
    }
  });

  test('手机横竖屏可直接修改带渲染数值的初始桑基图节点', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: TEST_BASE_URL,
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 }
    });
    const page = await context.newPage();
    try {
      await page.goto(sampleURL(localizedDiagramSamples.Sankey[0].code));
      await expect(page.locator('#view')).toHaveAttribute('aria-busy', 'false', {
        timeout: 15_000
      });
      const target = page.locator(
        '#view text[data-editable-source-label="浏览商品"][data-visual-id]'
      );
      await expect(target).toBeVisible();
      await target.tap({ force: true });

      const toolbar = page.getByTestId('mobile-edit-toolbar');
      await toolbar.getByRole('button', { name: '文字', exact: true }).tap();
      const editor = page.getByTestId('mobile-text-editor').getByLabel('图中文字编辑');
      await expect(editor).toHaveValue('浏览商品');
      await editor.fill('浏览方案');
      await page
        .getByTestId('mobile-text-editor')
        .getByRole('button', { name: '完成', exact: true })
        .tap();
      await expect(page.locator('#view')).toContainText('浏览方案');
      await expect
        .poll(() =>
          page.evaluate(() => {
            const saved = localStorage.getItem('codeStore');
            return saved ? (JSON.parse(saved) as { code?: string }).code : '';
          })
        )
        .toContain('"浏览方案"');

      await page.setViewportSize({ height: 390, width: 844 });
      await page.reload();
      await expect(page.locator('#view')).toContainText('浏览方案');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
});
