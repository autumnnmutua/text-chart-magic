import { expect, test } from './test';

test.describe('Auto sync tests', () => {
  test('should automatically defer rendering when complex diagrams are edited', async ({
    editPage
  }) => {
    test.slow(); // Complex diagram rendering can be slow under parallel load
    // Wait for the default diagram to fully render before typing
    await editPage.checkTextInView('输入中文想法');
    await editPage.typeInEditor(
      `
A & B & C & D & E --> F & G & H & I & J & K
A & B & C & D & E --> F & G & H & I & J & K
A & B & C & D & E --> F & G & H & I & J & K
A & B & C & D & E --> F & G & H & I & J & K
A & B & C & D & E --> F & G & H & I & J & K
A & B & C & D & E --> F & G & H & I & J & K
A & B & C & D & E --> F & G & H & I & J & K
A & B & C & D & E --> F & G & H & I & J & K & LongTest`
    );
    await editPage.checkTextNotInView('LongTest');
    await editPage.checkTextInView('LongTest');
  });

  test('supports commenting code out/in', async ({ editPage }) => {
    await editPage.toggleComment('导出文件');
    await editPage.checkTextNotInView('PNG / SVG 文件');
    await editPage.toggleComment('导出文件');
    await editPage.checkTextInView('PNG / SVG 文件');
  });

  test('supports editing code when code is incorrect', async ({ editPage }) => {
    test.slow(); // Error display has a 5s debounce; rendering pipeline adds more delay under load
    await editPage.clearEditor();
    await editPage.typeInEditor('gitGraph');
    await editPage.checkTextInView('main');
    await editPage.typeInEditor('\n  checkout test');
    await editPage.checkTextNotInView('test');
    await editPage.checkInEditor('checkout test');
    await editPage.checkTextInView('main');
    await expect(editPage.page.getByTestId('error-container')).toHaveCount(0);
  });

  test('should update diagram after entire text is removed', async ({ editPage }) => {
    await editPage.clearEditor();
    await editPage.typeInEditor(
      `graph LR
	A-->Bike`
    );
    await editPage.checkTextInView('Bike');
  });
});
