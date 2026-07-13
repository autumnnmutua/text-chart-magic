import { expect, test } from './test';
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

test.describe('中文化编辑器', () => {
  test('根路径直接显示编辑器', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('图表编辑器');
    await expect(page.locator('nav').getByText('图表编辑器', { exact: true })).toBeVisible();
    await expect(page.getByText('试试 Mermaid 高级编辑器')).toHaveCount(0);
    await expect(page.locator('#view').getByText('输入中文想法', { exact: true })).toBeVisible();
  });

  test('初始界面是中文、中文图表和橙色主题', async ({ page }) => {
    await page.goto('/edit');

    await expect(page).toHaveTitle('图表编辑器');
    await expect(page.locator('nav').getByText('图表编辑器', { exact: true })).toBeVisible();
    await expect(page.getByText('试试 Mermaid 高级编辑器')).toHaveCount(0);
    await expect(page.getByText('示例图表', { exact: true })).toBeVisible();
    await expect(page.getByText('导出', { exact: true })).toBeVisible();

    await expect(page.locator('#editor')).toContainText('输入中文想法');
    await expect(page.locator('#editor')).toContainText('生成图表');
    await expect(page.locator('#view')).toContainText('输入中文想法');
    await expect(page.locator('#view')).toContainText('生成图表');

    const accentColor = await page
      .locator('body')
      .evaluate((body) => getComputedStyle(body).getPropertyValue('--accent').trim());
    expect(accentColor).toBe('hsl(24 95% 53%)');
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
        const previousSvgId = await page.locator('#container > svg').getAttribute('id');
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
          .poll(() => page.locator('#container > svg').getAttribute('id'), {
            message: `${name} should finish rendering a new SVG`
          })
          .not.toBe(previousSvgId);
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
});
