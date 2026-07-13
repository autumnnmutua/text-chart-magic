import { type Page, expect } from '@playwright/test';
import { statSync } from 'node:fs';

export interface EditorOptions {
  bottom?: boolean;
  newline?: boolean;
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
