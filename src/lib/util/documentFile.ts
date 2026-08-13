import type { State } from '$lib/types';
import {
  CURRENT_DOCUMENT_SCHEMA_VERSION,
  DOCUMENT_FORMAT,
  MAX_DOCUMENT_FILE_BYTES,
  utf8ByteLength
} from './documentSchema';
import { normalizeState } from './state.svelte';

export interface DiagramDocument {
  exportedAt: string;
  format: typeof DOCUMENT_FORMAT;
  schemaVersion: number;
  state: State;
}

const assertSupportedVersion = (version: unknown): void => {
  if (
    typeof version === 'number' &&
    Number.isFinite(version) &&
    version > CURRENT_DOCUMENT_SCHEMA_VERSION
  ) {
    throw new Error('这个作品由更高版本的编辑器创建，请升级编辑器后再导入。');
  }
};

const assertDocumentSize = (text: string): void => {
  if (utf8ByteLength(text) > MAX_DOCUMENT_FILE_BYTES) {
    throw new Error('作品文件超过 4 MB，已停止导入以保护当前页面。');
  }
};

export const createDocumentBackup = (state: State): string => {
  const normalized = normalizeState(state);
  const document: DiagramDocument = {
    exportedAt: new Date().toISOString(),
    format: DOCUMENT_FORMAT,
    schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
    state: normalized
  };
  const text = JSON.stringify(document, undefined, 2);
  assertDocumentSize(text);
  return text;
};

export const parseDocumentBackup = (text: string): State => {
  assertDocumentSize(text);
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('作品文件必须是 JSON 对象。');
  }

  const candidate = parsed as Partial<DiagramDocument> & Partial<State>;
  let rawState: unknown;
  if (candidate.format === DOCUMENT_FORMAT) {
    assertSupportedVersion(candidate.schemaVersion);
    rawState = candidate.state;
  } else if (typeof candidate.code === 'string') {
    // Accept the legacy raw-state JSON shape as a one-way compatibility path.
    assertSupportedVersion(candidate.schemaVersion);
    rawState = candidate;
  } else {
    throw new Error('无法识别这个作品文件。');
  }

  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    throw new Error('作品文件缺少图表状态。');
  }
  const state = rawState as Partial<State>;
  if (typeof state.code !== 'string' || typeof state.mermaid !== 'string') {
    throw new Error('作品文件缺少代码或图表配置。');
  }
  assertSupportedVersion(state.schemaVersion);
  return normalizeState(state);
};
