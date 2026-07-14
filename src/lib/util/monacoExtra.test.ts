import { describe, expect, it } from 'vitest';
import { isExpectedMonacoCancellation } from './monacoExtra';

describe('Monaco cancellation guard', () => {
  it('recognizes only the known word-highlighter disposal rejection', () => {
    const cancellation = new Error('Canceled');
    cancellation.name = 'Canceled';
    cancellation.stack = 'Canceled: Canceled\n at WordHighlighter.dispose (monaco-editor/async.js)';

    expect(isExpectedMonacoCancellation(cancellation)).toBe(true);

    const unrelated = new Error('Canceled');
    unrelated.name = 'Canceled';
    unrelated.stack = 'Canceled: Canceled\n at saveDiagram (state.ts)';
    expect(isExpectedMonacoCancellation(unrelated)).toBe(false);
    expect(isExpectedMonacoCancellation(new Error('Network failed'))).toBe(false);
  });
});
