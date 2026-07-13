import { expect, test } from './test';

test.describe('外链清理', () => {
  test('编辑器不会显示文档外链入口', async ({ editPage }) => {
    await expect(editPage.page.getByTestId('diagram-documentation-button')).toHaveCount(0);
    await editPage.toggleSampleDiagrams();
    await editPage.loadSampleDiagram('Sequence');
    await expect(editPage.page.getByTestId('diagram-documentation-button')).toHaveCount(0);
  });
});
