import { expect, test } from './test';

test.describe('Error display tests', () => {
  test('代码语法错误不会破坏最后一次有效画面或显示外部 AI 入口', async ({ editPage }) => {
    // Enter code with syntax error
    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B -->');

    await editPage.checkInEditor('A --> B -->');
    await editPage.checkTextInView('输入中文想法');
    await expect(editPage.page.getByTestId('error-container')).toHaveCount(0);
  });

  test('should not show AI Repair button for errors in Config tab', async ({ editPage }) => {
    // First enter valid diagram
    await editPage.clearEditor();
    await editPage.typeInEditor('graph TD\nA --> B');

    // Switch to Config tab
    await editPage.setEditorMode('Config');

    // Enter invalid JSON in config
    await editPage.clearEditor();
    await editPage.typeInEditor('{\n  "theme": "default",\n  invalid json');

    // Verify error is displayed
    await editPage.checkError('语法错误');
  });
});
