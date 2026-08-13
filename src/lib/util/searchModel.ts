import {
  collectEditableSourceText,
  normalizeVisibleText,
  type SourceTextRange
} from './visualTextEdit';
import type { State } from '$lib/types';

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface DiagramSearchResult {
  connectionId?: string;
  containerText: string;
  id: string;
  kind:
    | ReturnType<typeof collectEditableSourceText>[number]['kind']
    | '箭头文字'
    | '图标文字'
    | '图形文字';
  occurrence: number;
  range: SourceTextRange;
  text: string;
  visualElementId?: string;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createSearchPattern = (query: string, options: SearchOptions): RegExp | undefined => {
  const needle = query.slice(0, 500);
  if (!needle) return undefined;
  const flags = options.caseSensitive ? 'gu' : 'giu';
  const boundary = options.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escapeRegExp(needle)}(?![\\p{L}\\p{N}_])`
    : escapeRegExp(needle);
  try {
    return new RegExp(boundary, flags);
  } catch {
    return undefined;
  }
};

const isStructuralIdentifier = (
  code: string,
  range: ReturnType<typeof collectEditableSourceText>[number]['range']
): boolean => {
  const lineStart = code.lastIndexOf('\n', range.start - 1) + 1;
  const lineEndIndex = code.indexOf('\n', range.end);
  const lineEnd = lineEndIndex < 0 ? code.length : lineEndIndex;
  const line = code.slice(lineStart, lineEnd);
  const before = code.slice(lineStart, range.start);
  const after = code.slice(range.end, lineEnd);
  if (
    /^\s*(?:%%\{|---|classDef\b|class\s+\S+\s+\S|linkStyle\b|style\b|Update(?:Element|Layout|Rel)Style\b)/i.test(
      line
    )
  )
    return true;
  if (
    /^\s*-?\d+(?:\.\d+)?%?(?:\s*,\s*-?\d+(?:\.\d+)?%?)+\s*$/.test(
      code.slice(range.start, range.end)
    )
  )
    return true;
  if (/^\s*id\s*:/i.test(line)) return true;
  if (/^\s*(?:participant|actor|branch|checkout|switch|merge)\s+$/i.test(before)) return true;
  if (/^\s*@(?:Actor|Boundary|EC2|Lambda|AzureFunction)\s+(?:<<[^>]+>>\s+)?$/i.test(before)) {
    return true;
  }
  if (/^\s*$/.test(before) && /^\s*\{/.test(after)) return true;
  if (/^\s*$/.test(before) && /^\s*(?:-->>?|->>|-->|->|-\))/.test(after)) return true;
  if (/(?:-->>?|->>|-->|->|-\))\s*$/.test(before) && /^\s*$/.test(after)) return true;
  return false;
};

export const searchEditableSourceText = (
  code: string,
  query: string,
  options: SearchOptions
): DiagramSearchResult[] => {
  const pattern = createSearchPattern(query, options);
  if (!pattern) return [];
  const containerOccurrences = new Map<string, number>();
  return collectEditableSourceText(code)
    .filter((entry) => !isStructuralIdentifier(code, entry.range))
    .flatMap((entry) => {
      const containerKey = normalizeVisibleText(entry.text).toLocaleLowerCase();
      const occurrence = containerOccurrences.get(containerKey) ?? 0;
      containerOccurrences.set(containerKey, occurrence + 1);
      return [...entry.text.matchAll(pattern)].map((match) => {
        const start = entry.range.start + (match.index ?? 0);
        const text = match[0];
        return {
          containerText: entry.text,
          id: `search:${start}:${start + text.length}`,
          kind: entry.kind,
          occurrence,
          range: { start, end: start + text.length },
          text
        } satisfies DiagramSearchResult;
      });
    });
};

export const searchVisualConnectionText = (
  connections: State['visualConnections'],
  query: string,
  options: SearchOptions
): DiagramSearchResult[] => {
  const pattern = createSearchPattern(query, options);
  if (!pattern) return [];
  return Object.values(connections ?? {}).flatMap((connection) =>
    [...connection.label.matchAll(pattern)].map((match) => {
      const start = match.index ?? 0;
      return {
        connectionId: connection.id,
        containerText: connection.label,
        id: `connection:${connection.id}:${start}:${start + match[0].length}`,
        kind: '箭头文字',
        occurrence: 0,
        range: { end: start + match[0].length, start },
        text: match[0]
      } satisfies DiagramSearchResult;
    })
  );
};

export const searchVisualElementText = (
  elements: State['visualElements'],
  query: string,
  options: SearchOptions
): DiagramSearchResult[] => {
  const pattern = createSearchPattern(query, options);
  if (!pattern) return [];
  return Object.values(elements ?? {}).flatMap((element) =>
    [...element.label.matchAll(pattern)].map((match) => {
      const start = match.index ?? 0;
      return {
        containerText: element.label,
        id: `element:${element.id}:${start}:${start + match[0].length}`,
        kind: element.kind === 'icon' ? '图标文字' : '图形文字',
        occurrence: 0,
        range: { end: start + match[0].length, start },
        text: match[0],
        visualElementId: element.id
      } satisfies DiagramSearchResult;
    })
  );
};
