import { describe, expect, it } from 'vitest';
import {
  extractErrorLineText,
  findMostRelevantLineNumber,
  replaceLineNumberInErrorMessage
} from './errorHandling';

describe('error line helpers', () => {
  it('finds the line with the longest matching parser excerpt', () => {
    const code = ['flowchart TD', '  A[开始] --> B{是否继续}', '  B --> C[结束]'].join('\n');
    expect(findMostRelevantLineNumber('A[开始] --> B{是否继', code)).toBe(2);
  });

  it('returns -1 for an empty parser excerpt', () => {
    expect(findMostRelevantLineNumber('', 'flowchart TD\n  A --> B')).toBe(-1);
  });

  it('handles a long malformed line without cubic substring enumeration', () => {
    const longLine = `A[${'内容'.repeat(10_000)}] --> B`;
    expect(findMostRelevantLineNumber('内容内容内容] --> B', `flowchart TD\n${longLine}`)).toBe(2);
  });

  it('extracts parser context and replaces parser and lexer line numbers', () => {
    expect(extractErrorLineText('Error: Parse error on line 3:\n...A --> B\n----')).toBe('A --> B');
    expect(replaceLineNumberInErrorMessage('Parse error on line 3:', 8)).toContain('line 8');
    expect(replaceLineNumberInErrorMessage('Lexical error on line 2', 5)).toContain('line 5');
  });
});
