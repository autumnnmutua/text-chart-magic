import { describe, expect, it } from 'vitest';
import { CURRENT_DOCUMENT_SCHEMA_VERSION, DOCUMENT_FORMAT } from './documentSchema';
import { createDocumentBackup, parseDocumentBackup } from './documentFile';
import { defaultState } from './state.svelte';

describe('document backup files', () => {
  it('round-trips the complete normalized editor state', () => {
    const text = createDocumentBackup({
      ...defaultState,
      sampleDescription: '可恢复的说明',
      visualElements: {
        'element-backup': {
          height: 80,
          id: 'element-backup',
          kind: 'shape',
          label: '备份模块',
          shape: 'rounded',
          width: 140,
          x: 20,
          y: 30
        }
      }
    });
    const document = JSON.parse(text) as {
      format: string;
      schemaVersion: number;
    };
    const restored = parseDocumentBackup(text);

    expect(document.format).toBe(DOCUMENT_FORMAT);
    expect(document.schemaVersion).toBe(CURRENT_DOCUMENT_SCHEMA_VERSION);
    expect(restored.schemaVersion).toBe(CURRENT_DOCUMENT_SCHEMA_VERSION);
    expect(restored.sampleDescription).toBe('可恢复的说明');
    expect(restored.visualElements?.['element-backup'].label).toBe('备份模块');
  });

  it('accepts a legacy raw state and adds safe defaults', () => {
    const restored = parseDocumentBackup(
      JSON.stringify({
        code: 'flowchart LR\n  Legacy[旧作品]',
        mermaid: '{}',
        rough: false,
        updateDiagram: true
      })
    );

    expect(restored.code).toContain('Legacy[旧作品]');
    expect(restored.schemaVersion).toBe(CURRENT_DOCUMENT_SCHEMA_VERSION);
    expect(restored.snapToGrid).toBe(true);
  });

  it('rejects future document versions without changing any editor state', () => {
    expect(() =>
      parseDocumentBackup(
        JSON.stringify({
          format: DOCUMENT_FORMAT,
          schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION + 1,
          state: defaultState
        })
      )
    ).toThrow('更高版本');
  });

  it('rejects oversized files before parsing them', () => {
    expect(() => parseDocumentBackup(' '.repeat(4 * 1024 * 1024 + 1))).toThrow('超过 4 MB');
  });
});
