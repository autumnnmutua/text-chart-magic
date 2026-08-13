import { TID } from '$/constants';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { verifyFileSizeGreaterThan, type EditorOptions } from './utils';

export class EditorPage {
  readonly editor: Locator;
  readonly view: Locator;

  constructor(readonly page: Page) {
    this.editor = page.locator('css=.monaco-editor');
    this.view = page.locator('#view');
  }

  async start(url = '/edit') {
    await this.page.goto(url);
    await expect(this.page)
      .toHaveURL(/.*\/edit#pako/)
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .catch(() => {});
  }

  async typeInEditor(text: string, { bottom = true, newline = false }: EditorOptions = {}) {
    await this.editor.click();
    if (bottom) {
      await this.page.keyboard.press('PageDown');
    }
    if (newline) {
      await this.page.keyboard.press('Enter');
    }
    await this.page.keyboard.type(text, { delay: 10 });
  }

  async clearEditor() {
    await this.editor.click();
    await this.page.keyboard.press('Control+KeyA');
    await this.page.keyboard.press('Backspace');
  }

  async toggleActions() {
    await this.page.getByText('\u5bfc\u51fa', { exact: true }).click();
  }

  async toggleSampleDiagrams() {
    await this.page.getByText('图表库', { exact: true }).click();
  }

  async checkAndDownloadPNG(expectedSize: number) {
    const downloadPNGPromise = verifyFileSizeGreaterThan(this.page, 'png', expectedSize);
    await this.page.getByTestId('download-PNG').click();
    return await downloadPNGPromise;
  }

  async downloadSVG(expectedSize: number) {
    const downloadSVGPromise = verifyFileSizeGreaterThan(this.page, 'svg', expectedSize);
    await this.page.getByTestId('download-SVG').click();
    return await downloadSVGPromise;
  }

  async loadSampleDiagram(diagramName: string) {
    const diagramLabels: Record<string, string> = {
      Architecture: '架构图',
      Block: '块图',
      C4: 'C4',
      Class: '类图',
      'Entity Relationship': '实体关系',
      Flowchart: '流程图',
      Gantt: '甘特图',
      Git: 'Git 图',
      Ishikawa: '鱼骨图',
      Kanban: '看板',
      Mindmap: '思维导图',
      Packet: '数据包',
      Pie: '饼图',
      Quadrant: '象限图',
      Radar: '雷达图',
      Requirement: '需求图',
      Sankey: '桑基图',
      Sequence: '时序图',
      State: '状态图',
      Timeline: '时间线',
      TreeView: '树图',
      Treemap: '矩形树图',
      'User Journey': '用户旅程',
      Venn: '维恩图',
      'Wardley Maps': '沃德利地图',
      XY: 'XY 图',
      ZenUML: 'ZenUML'
    };
    await this.page.getByText(diagramLabels[diagramName] ?? diagramName, { exact: true }).click();
  }

  async checkTextInView(text: string) {
    await expect(this.view).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
    await expect(this.view).toContainText(text, { timeout: 30_000 });
  }

  async checkTextNotInView(text: string) {
    await expect(this.view).not.toContainText(text);
  }

  async checkError(text: string) {
    await expect(this.page.getByTestId(TID.errorContainer)).toContainText(text, {
      timeout: 10_000
    });
  }

  async checkInEditor(text: string) {
    await expect(this.editor).toContainText(text);
  }

  async toggleComment(text: string) {
    await this.editor.getByText(text).click();
    await this.page.keyboard.press('Control+/');
  }

  async setEditorMode(mode: 'Code' | 'Config') {
    await this.page
      .getByRole('tab')
      .getByText(mode === 'Code' ? '\u4ee3\u7801' : '\u914d\u7f6e')
      .click();
  }

  async toggleTheme() {
    await this.page.getByTestId(TID.themeToggleButton).click();
  }

  async checkTheme(theme: 'light' | 'dark') {
    await expect(this.page.getByTestId(TID.themeToggleButton)).toHaveAttribute(
      'title',
      `\u5207\u6362\u5230${theme === 'light' ? '\u6df1\u8272' : '\u6d45\u8272'}\u4e3b\u9898`
    );
  }
}

export const test = base.extend<{ editPage: EditorPage }>({
  editPage: async ({ page }, use) => {
    const editorPage = new EditorPage(page);
    await editorPage.start();
    await editorPage.toggleSampleDiagrams();
    await use(editorPage);
  }
});

export { expect } from '@playwright/test';
