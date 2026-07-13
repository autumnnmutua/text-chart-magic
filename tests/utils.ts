import { type Page, expect } from '@playwright/test';
import { statSync } from 'node:fs';

export interface EditorOptions {
  bottom?: boolean;
  newline?: boolean;
}

export async function setEditorCode(
  page: Page,
  code: string,
  { waitForRender = true }: { waitForRender?: boolean } = {}
): Promise<void> {
  const renderMarker = `before-editor-update-${Date.now()}-${Math.random()}`;
  const previousSvg = page.locator('#view svg').first();
  const hadPreviousSvg = (await previousSvg.count()) > 0;
  if (hadPreviousSvg && waitForRender) {
    await previousSvg.evaluate(
      (svg, marker) => svg.setAttribute('data-test-render-marker', marker),
      renderMarker
    );
  }
  await page.locator('#editor:visible, .cm-content:visible').first().click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(code);
  await page.waitForFunction((expected) => {
    const saved = window.localStorage.getItem('codeStore');
    const normalize = (value: string) =>
      value
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim();
    return saved
      ? normalize((JSON.parse(saved) as { code: string }).code) === normalize(expected)
      : false;
  }, code);
  if (hadPreviousSvg) {
    await page.waitForFunction(
      ({ expected, marker }) => {
        const normalize = (value: string) =>
          value
            .replace(/\r/g, '')
            .split('\n')
            .map((line) => line.trim())
            .join('\n')
            .trim();
        const current = document.querySelector('#view svg');
        if (!current || current.getAttribute('data-test-render-marker') !== marker) return true;
        const saved = window.localStorage.getItem('codeStore');
        return saved
          ? normalize((JSON.parse(saved) as { code: string }).code) !== normalize(expected)
          : false;
      },
      { expected: code, marker: renderMarker }
    );
  } else {
    await page.waitForSelector('#view svg');
  }
}

export async function verifyFileSizeGreaterThan(
  page: Page,
  extension: string,
  size: number
): Promise<number> {
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename().toLowerCase()).toMatch(
    new RegExp(`\\.${extension.toLowerCase()}$`)
  );
  const path = await download.path();
  if (!path) throw new Error('Download path not available');
  const fileSize = statSync(path).size;
  expect(fileSize).toBeGreaterThan(size);
  return fileSize;
}
