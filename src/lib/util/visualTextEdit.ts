import { getDiagramKeyword } from './diagramBranch';
import { getBlockEdges, getBlockEdgeStyleId } from './blockFreeLayout';

export interface VisualTextTarget {
  occurrence?: number;
  sourceId?: string;
  styleId?: string;
  text: string;
}

export interface SourceTextRange {
  end: number;
  start: number;
}

export const normalizeVisibleText = (value = '') => value.replace(/\s+/g, ' ').trim();

const comparableVisibleText = (value = '') => normalizeVisibleText(value).toLocaleLowerCase();

const requirementDeclarationKinds = [
  'requirement',
  'functionalRequirement',
  'interfaceRequirement',
  'performanceRequirement',
  'physicalRequirement',
  'designConstraint'
] as const;

const requirementKindPattern = requirementDeclarationKinds.join('|');

const requirementKindAliases = new Map<string, (typeof requirementDeclarationKinds)[number]>([
  ['requirement', 'requirement'],
  ['需求', 'requirement'],
  ['普通需求', 'requirement'],
  ['functionalrequirement', 'functionalRequirement'],
  ['功能需求', 'functionalRequirement'],
  ['interfacerequirement', 'interfaceRequirement'],
  ['接口需求', 'interfaceRequirement'],
  ['performancerequirement', 'performanceRequirement'],
  ['性能需求', 'performanceRequirement'],
  ['physicalrequirement', 'physicalRequirement'],
  ['物理需求', 'physicalRequirement'],
  ['designconstraint', 'designConstraint'],
  ['设计约束', 'designConstraint']
]);

const getRequirementDeclarationKind = (
  value: string
): (typeof requirementDeclarationKinds)[number] | undefined =>
  requirementKindAliases.get(
    value
      .trim()
      .toLocaleLowerCase()
      .replace(/[\s_-]+/g, '')
  );

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface IndexedRegExpExecArray extends RegExpExecArray {
  indices?: ([number, number] | undefined)[];
}

const getMatchedValue = (match: RegExpExecArray): { groupIndex: number; value: string } => {
  for (let index = 1; index < match.length; index += 1) {
    const value = match[index];
    if (value !== undefined) {
      return { groupIndex: index, value };
    }
  }
  return { groupIndex: 0, value: '' };
};

const getValueRange = (match: RegExpExecArray, value: string, groupIndex = 1): SourceTextRange => {
  const indexedRange = (match as IndexedRegExpExecArray).indices?.[groupIndex];
  if (indexedRange) return { start: indexedRange[0], end: indexedRange[1] };
  const valueStart = match.index + match[0].indexOf(value);
  return {
    end: valueStart + value.length,
    start: valueStart
  };
};

export const findSourceIdLabelRange = (
  code: string,
  sourceId: string
): SourceTextRange | undefined => {
  if (!sourceId) {
    return undefined;
  }
  const id = escapeRegExp(sourceId);
  const pattern = new RegExp(
    String.raw`(^|[^A-Za-z0-9_])(${id})\s*([\[\(\{])([^\]\)\}]*)([\]\)\}])`,
    'gmd'
  );
  const match = pattern.exec(code);
  if (!match) {
    return undefined;
  }
  const valueRange = getValueRange(match, match[4], 4);
  const trimmedValue = match[4].trim();
  const quote = trimmedValue[0];
  if (
    trimmedValue.length >= 2 &&
    (quote === '"' || quote === "'") &&
    trimmedValue.at(-1) === quote
  ) {
    const leadingWhitespace = match[4].length - match[4].trimStart().length;
    return {
      start: valueRange.start + leadingWhitespace + 1,
      end: valueRange.start + leadingWhitespace + trimmedValue.length - 1
    };
  }
  return valueRange;
};

const visibleTextPatterns = [
  /"([^"]+)"/g,
  /'([^']+)'/g,
  /\[([^\]]+)\]/g,
  /\(([^)]+)\)/g,
  /\{([^}]+)\}/g,
  /\|([^|\n]+)\|/g,
  /^\s*(?:participant|actor)\s+([A-Za-z][\w-]*)\b/gim,
  /^\s*(?:branch|checkout|switch|merge)\s+([^\s]+)/gim,
  /^\s*(?:anchor|component)\s+(.+?)\s+\[/gim,
  /^\s*@(?:Actor|Boundary|EC2|Lambda|AzureFunction)\s+(?:<<[^>]+>>\s+)?([A-Za-z][\w-]*)/gim,
  /^\s*([A-Za-z][\w-]*)\s*\{/gm,
  /^\s*[A-Za-z][\w-]*\.([A-Za-z][\w-]*\([^\n)]*\))/gm,
  /^\s*([A-Za-z][\w-]*)\s*(?=(?:-->>?|->>|-->|->|-\)))/gm,
  /(?:-->>?|->>|-->|->|-\))\s*([A-Za-z][\w-]*)/g,
  /\bas\s+([^\n]+)/g,
  /^\s*section\s+([^\n]+)/gim,
  /\btitle\s+([^\n]+)/g,
  /^\s*([^:\n]+?)\s*:\s*-?\d+(?:\.\d+)?\s*:\s*[^\n]+$/gm,
  /^\s*([^:\n]+?)\s*:\s*[^:\n]+$/gm,
  /:\s*([^:\n]+)(?=\n|$)/g,
  /^(?!\s*(?:---|%%|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|pie|mindmap|timeline|treemap-beta|treeView-beta|kanban|block-beta|quadrantChart|journey|gantt|gitGraph|erDiagram|requirementDiagram|architecture-beta|xychart-beta|sankey-beta|packet|radar-beta|venn-beta|wardley-beta)\b)\s*([^:\n"'`()[\]{}][^:\n]*?)\s*$/gim
];

export const findVisibleTextRange = (
  code: string,
  text: string,
  occurrence = 0
): SourceTextRange | undefined => {
  const normalizedText = normalizeVisibleText(text);
  if (!normalizedText) {
    return undefined;
  }

  const ranges = visibleTextPatterns
    .flatMap((pattern) => {
      const indexedPattern = pattern.hasIndices
        ? pattern
        : new RegExp(pattern.source, `${pattern.flags}d`);
      return Array.from(code.matchAll(indexedPattern))
        .map((match) => {
          const { groupIndex, value } = getMatchedValue(match);
          return {
            range: getValueRange(match, value, groupIndex),
            value
          };
        })
        .filter(
          ({ value }) => comparableVisibleText(value) === comparableVisibleText(normalizedText)
        );
    })
    .sort((left, right) => left.range.start - right.range.start)
    .filter(
      (item, index, items) =>
        index === 0 ||
        item.range.start !== items[index - 1].range.start ||
        item.range.end !== items[index - 1].range.end
    );

  return ranges[occurrence]?.range ?? (ranges.length === 1 ? ranges[0].range : undefined);
};

export const findVisualTextRange = (
  code: string,
  { occurrence = 0, sourceId, text }: VisualTextTarget
): SourceTextRange | undefined => {
  const sourceRange = sourceId ? findSourceIdLabelRange(code, sourceId) : undefined;
  const sourceText = sourceRange ? code.slice(sourceRange.start, sourceRange.end) : undefined;
  const directRange =
    sourceText !== undefined && comparableVisibleText(sourceText) === comparableVisibleText(text)
      ? sourceRange
      : findVisibleTextRange(code, text, occurrence);
  if (directRange) return directRange;
  if (getDiagramKeyword(code) === 'xychart-beta') {
    const axis = /^\s*x-axis\s*\[([^\]]*)\]/im.exec(code);
    if (axis) {
      const valuesStart = axis.index + axis[0].indexOf(axis[1]);
      const entries = [...axis[1].matchAll(/[^,]+/g)];
      const entry = entries.filter(
        (match) => normalizeVisibleText(match[0]) === normalizeVisibleText(text)
      )[occurrence];
      if (entry?.index !== undefined) {
        const leading = entry[0].length - entry[0].trimStart().length;
        const value = entry[0].trim();
        const start = valuesStart + entry.index + leading;
        return { start, end: start + value.length };
      }
    }
  }
  return undefined;
};

export const findRequirementFieldRange = (
  code: string,
  displayText: string,
  sourceId = ''
): SourceTextRange | undefined => {
  if (getDiagramKeyword(code) !== 'requirementdiagram') return undefined;
  const normalizedDisplayText = normalizeVisibleText(displayText);
  const stereotypeMatch = normalizedDisplayText.match(/^<<\s*(.+?)\s*>>$/);
  const stereotypeKind = stereotypeMatch
    ? getRequirementDeclarationKind(stereotypeMatch[1])
    : undefined;
  const fieldMatch = normalizedDisplayText.match(
    /^(ID|Text|Risk|Verification(?: Method)?|Verify Method|Type|Doc(?:ument)? Ref(?:erence)?):\s*(.+)$/i
  );
  if (!fieldMatch && !stereotypeKind) return undefined;
  const key = (() => {
    if (stereotypeKind) return 'type';
    if (!fieldMatch) return '';
    const label = fieldMatch[1].toLowerCase();
    if (label.startsWith('verification') || label.startsWith('verify')) return 'verifymethod';
    if (label.startsWith('doc')) return 'docref';
    return label;
  })();
  const fieldValue = stereotypeKind ?? fieldMatch?.[2] ?? '';
  const wantedValue = comparableVisibleText(fieldValue);
  const escapedId = escapeRegExp(sourceId);
  const blockPattern = sourceId
    ? new RegExp(
        String.raw`^\s*(?:${requirementKindPattern}|element)\s+${escapedId}\s*\{([\s\S]*?)^\s*\}`,
        'im'
      )
    : undefined;
  const block = blockPattern?.exec(code);
  const searchStart = block ? block.index : 0;
  const searchCode = block ? block[0] : code;
  const fieldPattern = new RegExp(
    String.raw`^\s*${escapeRegExp(key)}\s*:\s*(?:"([^"]*)"|([^\n]+))`,
    'gimd'
  );
  for (const match of searchCode.matchAll(fieldPattern)) {
    const value = match[1] ?? match[2].trim();
    if (comparableVisibleText(value) !== wantedValue) continue;
    const localRange = getValueRange(match, value, match[1] !== undefined ? 1 : 2);
    return { start: searchStart + localRange.start, end: searchStart + localRange.end };
  }

  if (key !== 'type' || !sourceId || !block) return undefined;
  const wantedKind = stereotypeKind ?? getRequirementDeclarationKind(fieldValue);
  if (!wantedKind) return undefined;
  const declarationPattern = new RegExp(
    String.raw`^\s*(${requirementKindPattern})\s+${escapedId}\b`,
    'imd'
  );
  const declaration = declarationPattern.exec(block[0]);
  if (!declaration || declaration[1].toLocaleLowerCase() !== wantedKind.toLocaleLowerCase()) {
    return undefined;
  }
  const localRange = getValueRange(declaration, declaration[1], 1);
  return { start: searchStart + localRange.start, end: searchStart + localRange.end };
};

export const replaceVisualText = (
  code: string,
  range: SourceTextRange,
  nextText: string
): { code: string; range: SourceTextRange } => ({
  code: `${code.slice(0, range.start)}${nextText}${code.slice(range.end)}`,
  range: {
    end: range.start + nextText.length,
    start: range.start
  }
});

export const replaceDiagramVisualText = (
  code: string,
  range: SourceTextRange,
  currentText: string,
  nextText: string
): { code: string; range: SourceTextRange } => {
  if (getDiagramKeyword(code) === 'requirementdiagram') {
    const lineRange = getSourceLineRange(code, range);
    const line = code.slice(lineRange.start, lineRange.end);
    const declaration = new RegExp(String.raw`^\s*(${requirementKindPattern})\s+`, 'i').exec(line);
    if (declaration) {
      const nextKind = getRequirementDeclarationKind(nextText);
      return nextKind ? replaceVisualText(code, range, nextKind) : { code, range };
    }
    if (/^\s*(?:risk|verifymethod)\s*:/i.test(line)) {
      return replaceVisualText(code, range, nextText.trim().toLowerCase());
    }
  }
  if (getDiagramKeyword(code) === 'gitgraph') {
    const lineRange = getSourceLineRange(code, range);
    const line = code.slice(lineRange.start, lineRange.end);
    if (/^\s*branch\s+/i.test(line)) {
      const safeName = nextText.trim() || currentText;
      const reference = /^[A-Za-z0-9_-]+$/.test(safeName)
        ? safeName
        : `"${safeName.replace(/"/g, '')}"`;
      const current = escapeRegExp(currentText);
      const nextCode = code.replace(
        new RegExp(
          String.raw`(^\s*(?:branch|checkout|switch|merge)\s+)(?:"${current}"|${current})(?=\s|$)`,
          'gim'
        ),
        (_line, prefix: string) => `${prefix}${reference}`
      );
      const nextRange = findVisibleTextRange(nextCode, safeName) ?? range;
      return { code: nextCode, range: nextRange };
    }
  }
  if (getDiagramKeyword(code) === 'wardley-beta') {
    const lineRange = getSourceLineRange(code, range);
    const line = code.slice(lineRange.start, lineRange.end);
    if (/^\s*(?:anchor|component)\s+/i.test(line)) {
      const safeName = nextText.trim() || currentText;
      const current = escapeRegExp(currentText);
      const renamed = replaceVisualText(code, range, safeName)
        .code.replace(
          new RegExp(String.raw`(^\s*)${current}(\s*->)`, 'gim'),
          (_line, prefix: string, suffix: string) => `${prefix}${safeName}${suffix}`
        )
        .replace(
          new RegExp(String.raw`(->\s*)${current}(\s*$)`, 'gim'),
          (_line, prefix: string, suffix: string) => `${prefix}${safeName}${suffix}`
        )
        .replace(
          new RegExp(String.raw`(^\s*evolve\s+)${current}(\s+)`, 'gim'),
          (_line, prefix: string, suffix: string) => `${prefix}${safeName}${suffix}`
        );
      return {
        code: renamed,
        range: findVisibleTextRange(renamed, safeName) ?? {
          start: range.start,
          end: range.start + safeName.length
        }
      };
    }
  }
  if (getDiagramKeyword(code) === 'zenuml') {
    const lineRange = getSourceLineRange(code, range);
    const line = code.slice(lineRange.start, lineRange.end);
    if (/^\s*@[A-Za-z][\w<>]*\s+/i.test(line)) {
      const safeName = nextText.trim().replace(/\W+/g, '') || currentText;
      const nextCode = code.replace(
        new RegExp(String.raw`\b${escapeRegExp(currentText)}\b`, 'g'),
        safeName
      );
      return {
        code: nextCode,
        range: findVisibleTextRange(nextCode, safeName) ?? {
          start: range.start,
          end: range.start + safeName.length
        }
      };
    }
  }
  return replaceVisualText(code, range, nextText);
};

export const getSourceLineRange = (code: string, range: SourceTextRange): SourceTextRange => {
  const start = code.lastIndexOf('\n', Math.max(range.start - 1, 0)) + 1;
  const nextLineBreak = code.indexOf('\n', range.end);
  return {
    end: nextLineBreak >= 0 ? nextLineBreak + 1 : code.length,
    start
  };
};

const indentationTreeKeywords = new Set([
  'ishikawa-beta',
  'kanban',
  'mindmap',
  'treemap-beta',
  'treeview-beta'
]);

const getIndentedBlockEnd = (code: string, lineRange: SourceTextRange): number => {
  const sourceLine = code.slice(lineRange.start, lineRange.end).replace(/\r?\n$/, '');
  const sourceIndent = sourceLine.match(/^\s*/)?.[0].length ?? 0;
  let end = lineRange.end;
  while (end < code.length) {
    const nextBreak = code.indexOf('\n', end);
    const nextEnd = nextBreak >= 0 ? nextBreak + 1 : code.length;
    const line = code.slice(end, nextEnd).replace(/\r?\n$/, '');
    if (line.trim() && (line.match(/^\s*/)?.[0].length ?? 0) <= sourceIndent) break;
    end = nextEnd;
  }
  return end;
};

const normalizePacketRanges = (code: string): string => {
  let nextStart = 0;
  return code.replace(
    /^(\s*)(\d+)(?:-(\d+))?(\s*:)/gm,
    (_line, indent: string, rawStart: string, rawEnd: string | undefined, suffix: string) => {
      const width = Number(rawEnd ?? rawStart) - Number(rawStart) + 1;
      const start = nextStart;
      const end = start + Math.max(width, 1) - 1;
      nextStart = end + 1;
      return `${indent}${start}${end === start ? '' : `-${end}`}${suffix}`;
    }
  );
};

const removeListIndex = (value: string, index: number): string =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((_item, itemIndex) => itemIndex !== index)
    .join(', ');

const getBalancedBlockEnd = (lines: string[], start: number): number => {
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    depth += (lines[index].match(/\{/g) ?? []).length;
    depth -= (lines[index].match(/\}/g) ?? []).length;
    if (index === start && depth <= 0) return start;
    if (index > start && depth <= 0) return index;
  }
  return lines.length - 1;
};

const removeFlowchartNode = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const sourceId = target.sourceId?.match(/^[A-Za-z][A-Za-z0-9_]*$/)?.[0];
  let id = sourceId ?? '';
  if (!id) {
    for (const match of code.matchAll(
      /\b([A-Za-z][A-Za-z0-9_]*)\s*(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})/g
    )) {
      if (
        [match[2], match[3], match[4]].some(
          (value) => normalizeVisibleText(value?.replace(/^['"]|['"]$/g, '')) === wanted
        )
      ) {
        id = match[1];
        break;
      }
    }
  }
  if (!id) return undefined;

  const escapedId = escapeRegExp(id);
  const declaration = new RegExp(String.raw`(^|\s)${escapedId}\s*(?:\[|\(|\{|$)`);
  const outgoing = new RegExp(String.raw`(^|\s)${escapedId}\s*(?:-->|---|==>|-\.->)`);
  const incoming = new RegExp(
    String.raw`(?:-->|---|==>|-\.->)(?:\|[^|]*\|)?\s*${escapedId}(?=\s|$|\[|\(|\{)`
  );
  const metadata = new RegExp(String.raw`^\s*(?:click|style)\s+${escapedId}\b`, 'i');
  const lines = code.split('\n');
  const removedLines: string[] = [];
  const filtered = lines.filter((line) => {
    const remove =
      declaration.test(line) || outgoing.test(line) || incoming.test(line) || metadata.test(line);
    if (remove) removedLines.push(line);
    return !remove;
  });
  if (filtered.length === lines.length) return undefined;

  const retainedCode = filtered.join('\n');
  const preservedDeclarations: string[] = [];
  const preservedIds = new Set<string>();
  for (const line of removedLines) {
    const indent = line.match(/^\s*/)?.[0] ?? '';
    for (const match of line.matchAll(
      /\b([A-Za-z][A-Za-z0-9_]*)\s*(\[[^\]]+\]|\([^)]*\)|\{[^}]*\})/g
    )) {
      const retainedId = match[1];
      if (retainedId === id || preservedIds.has(retainedId)) continue;
      const retainedDeclaration = new RegExp(
        String.raw`\b${escapeRegExp(retainedId)}\s*(?:\[|\(|\{)`
      );
      if (retainedDeclaration.test(retainedCode)) continue;
      preservedIds.add(retainedId);
      preservedDeclarations.push(`${indent}${retainedId}${match[2]}`);
    }
  }
  return `${[...filtered, ...preservedDeclarations].join('\n')}\n`;
};

const removeClassElement = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const declaration = lines
    .map((line, index) => ({
      index,
      match: line.match(/^\s*class\s+([A-Za-z][\w-]*)(?:\s*\["?([^"\]]+)"?\])?/i)
    }))
    .find(({ match }) => match?.slice(1).some((value) => normalizeVisibleText(value) === wanted));
  if (!declaration?.match) return undefined;

  const id = declaration.match[1];
  const end = getBalancedBlockEnd(lines, declaration.index);
  lines.splice(declaration.index, end - declaration.index + 1);
  const idToken = new RegExp(String.raw`(^|[^A-Za-z0-9_-])${escapeRegExp(id)}(?=[^A-Za-z0-9_-]|$)`);
  return `${lines
    .filter(
      (line) =>
        !new RegExp(String.raw`^\s*${escapeRegExp(id)}\s*:`).test(line) &&
        !(idToken.test(line) && /(?:--|\.\.|^\s*(?:note|class)\b)/i.test(line))
    )
    .join('\n')}\n`;
};

const removeSequenceParticipant = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const participant = lines
    .map((line, index) => ({
      index,
      match: line.match(/^\s*(?:participant|actor)\s+([A-Za-z][\w-]*)(?:\s+as\s+(.+))?/i)
    }))
    .find(({ match }) => match?.slice(1).some((value) => normalizeVisibleText(value) === wanted));
  const implicitId = /^[A-Za-z][\w-]*$/.test(wanted)
    ? [...code.matchAll(/^\s*([A-Za-z][\w-]*)\s*(?:--?>?>|--?[)x])\s*([A-Za-z][\w-]*)/gm)]
        .flatMap((match) => [match[1], match[2]])
        .find((id) => id === wanted)
    : undefined;
  const id = participant?.match?.[1] ?? implicitId;
  if (!id) return undefined;

  const idToken = new RegExp(String.raw`(^|[^A-Za-z0-9_-])${escapeRegExp(id)}(?=[^A-Za-z0-9_-]|$)`);
  const filtered = lines.filter((line, index) => {
    if (index === participant?.index) return false;
    if (!idToken.test(line)) return true;
    return !(
      /(?:--?>?>|--?[)x])/.test(line) ||
      /^\s*(?:activate|deactivate|link|links|note|properties)\b/i.test(line)
    );
  });
  return `${filtered.join('\n')}\n`;
};

const removeStateNode = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const declaration = lines
    .map((line, index) => {
      const labelled = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.+)$/);
      const aliased = line.match(/^\s*state\s+"([^"]+)"\s+as\s+([A-Za-z][\w-]*)/i);
      const block = line.match(/^\s*state\s+([A-Za-z][\w-]*)\s*\{/i);
      return {
        id: labelled?.[1] ?? aliased?.[2] ?? block?.[1] ?? '',
        index,
        labels: [labelled?.[1], labelled?.[2], aliased?.[1], aliased?.[2], block?.[1]]
      };
    })
    .find(({ labels }) => labels.some((value) => normalizeVisibleText(value) === wanted));
  const implicitId = /^[A-Za-z][\w-]*$/.test(wanted)
    ? [...code.matchAll(/^\s*([A-Za-z][\w-]*)\s*-->\s*([A-Za-z][\w-]*)/gm)]
        .flatMap((match) => [match[1], match[2]])
        .find((candidate) => candidate === wanted)
    : undefined;
  const id = declaration?.id ?? implicitId;
  if (!id) return undefined;

  if (declaration) {
    const end = getBalancedBlockEnd(lines, declaration.index);
    lines.splice(declaration.index, end - declaration.index + 1);
  }
  const idToken = new RegExp(String.raw`(^|[^A-Za-z0-9_-])${escapeRegExp(id)}(?=[^A-Za-z0-9_-]|$)`);
  return `${lines.filter((line) => !(idToken.test(line) && /-->/.test(line))).join('\n')}\n`;
};

const findRadarAxis = (code: string, target: VisualTextTarget) => {
  const wanted = normalizeVisibleText(target.text);
  let occurrence = 0;
  let axisIndex = 0;
  for (const lineMatch of code.matchAll(/^\s*axis\s+([^\n]+)$/gim)) {
    const entries = [...lineMatch[1].matchAll(/([A-Za-z][\w-]*)\s*\["([^"]+)"\]/g)];
    for (const entry of entries) {
      if (normalizeVisibleText(entry[2]) === wanted) {
        if (occurrence === (target.occurrence ?? 0)) {
          return { axisIndex, lineMatch, localIndex: entries.indexOf(entry) };
        }
        occurrence += 1;
      }
      axisIndex += 1;
    }
  }
  return undefined;
};

const removeRadarDimension = (code: string, target: VisualTextTarget): string | undefined => {
  const found = findRadarAxis(code, target);
  if (!found) return undefined;
  const line = found.lineMatch[0];
  const entries = [...found.lineMatch[1].matchAll(/[A-Za-z][\w-]*\s*\["[^"]+"\]/g)].map(
    (match) => match[0]
  );
  const localIndex = found.localIndex;
  if (localIndex < 0) return undefined;
  const nextEntries = entries.filter((_entry, index) => index !== localIndex);
  let nextCode =
    nextEntries.length > 0
      ? `${code.slice(0, found.lineMatch.index)}${line.replace(found.lineMatch[1], nextEntries.join(', '))}${code.slice(found.lineMatch.index + line.length)}`
      : `${code.slice(0, found.lineMatch.index)}${code.slice(found.lineMatch.index + line.length + (code[found.lineMatch.index + line.length] === '\n' ? 1 : 0))}`;
  nextCode = nextCode.replace(
    /^(\s*curve\s+[^\n{]+\{)([^}]*)(\})/gim,
    (_line, prefix: string, values: string, suffix: string) =>
      `${prefix}${removeListIndex(values, found.axisIndex)}${suffix}`
  );
  return nextCode;
};

const removeXYDimension = (code: string, target: VisualTextTarget): string | undefined => {
  const axis = /^(\s*x-axis\s*\[)([^\]]*)(\])/im.exec(code);
  if (!axis) return undefined;
  const values = axis[2].split(',').map((item) => item.trim());
  const index = values.findIndex(
    (item) => normalizeVisibleText(item.replace(/^"|"$/g, '')) === normalizeVisibleText(target.text)
  );
  if (index < 0) return undefined;
  let nextCode = `${code.slice(0, axis.index)}${axis[1]}${removeListIndex(axis[2], index)}${axis[3]}${code.slice(axis.index + axis[0].length)}`;
  nextCode = nextCode.replace(
    /^(\s*(?:bar|line)\s*\[)([^\]]*)(\])/gim,
    (_line, prefix: string, series: string, suffix: string) =>
      `${prefix}${removeListIndex(series, index)}${suffix}`
  );
  return nextCode;
};

const removeRequirementBlock = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text).replace(/^"|"$/g, '');
  const wantedSourceId = normalizeVisibleText(target.sourceId);
  const lines = code.split('\n');
  let selectedId = '';
  for (let start = 0; start < lines.length; start += 1) {
    const declaration = lines[start].match(
      /^\s*(?:requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+([\w-]+)\s*\{/i
    );
    if (!declaration) continue;
    let end = start + 1;
    while (end < lines.length && !/^\s*\}\s*$/.test(lines[end])) end += 1;
    if (end >= lines.length) continue;
    const block = lines.slice(start, end + 1).join('\n');
    const text = block.match(/^\s*text\s*:\s*"?([^"\n]+)"?/im)?.[1];
    const visibleId = block.match(/^\s*id\s*:\s*"?([^"\n]+)"?/im)?.[1];
    if (
      ![declaration[1], text, visibleId].some(
        (value) =>
          normalizeVisibleText(value) === wanted ||
          (wantedSourceId && normalizeVisibleText(value) === wantedSourceId)
      )
    )
      continue;
    selectedId = declaration[1];
    break;
  }
  if (!selectedId) return undefined;

  const removedIds = new Set([selectedId]);
  const containsRelations = [
    ...code.matchAll(/^\s*([\w-]+)\s*-\s*contains\s*->\s*([\w-]+)\s*$/gim)
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const relation of containsRelations) {
      if (removedIds.has(relation[1]) && !removedIds.has(relation[2])) {
        removedIds.add(relation[2]);
        changed = true;
      }
    }
  }

  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const declaration = lines[index].match(
      /^\s*(?:requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+([\w-]+)\s*\{/i
    );
    if (declaration && removedIds.has(declaration[1])) {
      while (index < lines.length && !/^\s*\}\s*$/.test(lines[index])) index += 1;
      continue;
    }
    const relation = lines[index].match(/^\s*([\w-]+)\s*-\s*[\w-]+\s*->\s*([\w-]+)\s*$/i);
    if (relation && (removedIds.has(relation[1]) || removedIds.has(relation[2]))) continue;
    output.push(lines[index]);
  }
  return `${output.join('\n')}\n`;
};

const removeC4Element = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const relationIndex = target.sourceId
    ? -1
    : lines.findIndex((line) => {
        if (!/^\s*(?:BiRel|Rel|Rel_[A-Za-z]+)\(/i.test(line)) return false;
        return [...line.matchAll(/"([^"]+)"/g)].some(
          (item) => normalizeVisibleText(item[1]) === wanted
        );
      });
  if (relationIndex >= 0) {
    lines.splice(relationIndex, 1);
    return `${lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd()}\n`;
  }
  const declarations = lines
    .map((line, index) => ({
      index,
      match: line.match(/^\s*([A-Za-z][\w]*)\(\s*([A-Za-z][\w-]*)\s*,((?:[^"\n]*"[^"]*")*[^\n]*)/)
    }))
    .filter(
      ({ match }) => match && !/^(?:BiRel|Rel|Rel_[A-Za-z]+|UpdateLayoutConfig)$/i.test(match[1])
    );
  const selected = declarations.find(({ match }) => {
    if (!match) return false;
    const quoted = [...match[3].matchAll(/"([^"]+)"/g)].map((item) =>
      normalizeVisibleText(item[1])
    );
    return (
      quoted.includes(wanted) ||
      target.sourceId === match[2] ||
      Boolean(target.styleId?.includes(match[2]))
    );
  });
  if (!selected?.match) return undefined;

  const removedIds = new Set([selected.match[2]]);
  let end = selected.index + 1;
  if (/\{\s*$/.test(lines[selected.index])) {
    let depth = 0;
    for (let index = selected.index; index < lines.length; index += 1) {
      depth += (lines[index].match(/\{/g) ?? []).length;
      depth -= (lines[index].match(/\}/g) ?? []).length;
      const child = lines[index].match(/^\s*[A-Za-z][\w]*\(\s*([A-Za-z][\w-]*)/);
      if (child) removedIds.add(child[1]);
      end = index + 1;
      if (depth === 0) break;
    }
  }
  lines.splice(selected.index, end - selected.index);
  const referencesRemovedId = (line: string) => {
    const relation = line.match(/^\s*(?:BiRel|Rel|Rel_[A-Za-z]+)\(\s*([^,]+)\s*,\s*([^,]+)/i);
    return relation
      ? removedIds.has(relation[1].trim()) || removedIds.has(relation[2].trim())
      : false;
  };
  return `${lines
    .filter((line) => !referencesRemovedId(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
};

const removeTimelinePeriod = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.trimEnd().split('\n');
  const index = lines.findIndex((line) => {
    const match = line.match(/^\s*([^:]+?)\s*:/);
    return match && normalizeVisibleText(match[1]) === wanted;
  });
  if (index < 0) return undefined;
  let end = index + 1;
  while (end < lines.length && /^\s*:\s*/.test(lines[end])) end += 1;
  lines.splice(index, end - index);
  return `${lines.join('\n')}\n`;
};

const removeArchitectureElement = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const wantedSourceId = normalizeVisibleText(target.sourceId);
  const lines = code.split('\n');
  const matchesTarget = (...values: (string | undefined)[]): boolean =>
    values.some(
      (value) =>
        normalizeVisibleText(value) === wanted ||
        (wantedSourceId && normalizeVisibleText(value) === wantedSourceId)
    );
  const groupIndex = lines.findIndex((line) => {
    const match = line.match(/^\s*group\s+([\w-]+)\([^)]+\)\["?([^\]"\n]+)"?\]/i);
    return Boolean(match && matchesTarget(match[1], match[2]));
  });
  if (groupIndex >= 0) {
    const groupId = lines[groupIndex].match(/^\s*group\s+([\w-]+)/i)?.[1];
    if (!groupId) return undefined;
    const removedGroups = new Set([groupId]);
    let foundNestedGroup = true;
    while (foundNestedGroup) {
      foundNestedGroup = false;
      for (const line of lines) {
        const nested = line.match(/^\s*group\s+([\w-]+)\([^)]+\)\[[^\]]+\](?:\s+in\s+([\w-]+))?/i);
        if (nested?.[2] && removedGroups.has(nested[2]) && !removedGroups.has(nested[1])) {
          removedGroups.add(nested[1]);
          foundNestedGroup = true;
        }
      }
    }
    const removedServices = new Set(
      lines
        .map((line) => line.match(/^\s*service\s+([\w-]+)\([^)]+\)\[[^\]]+\]\s+in\s+([\w-]+)/i))
        .filter((match) => Boolean(match?.[2] && removedGroups.has(match[2])))
        .map((match) => match?.[1] ?? '')
    );
    return `${lines
      .filter((line) => {
        const group = line.match(/^\s*group\s+([\w-]+)/i)?.[1];
        if (group && removedGroups.has(group)) return false;
        const service = line.match(/^\s*service\s+([\w-]+)/i)?.[1];
        if (service && removedServices.has(service)) return false;
        const edge = line.match(/^\s*([\w-]+):[TBRL]\s*--[^\n]*?[TBRL]:([\w-]+)\s*$/i);
        return !edge || (!removedServices.has(edge[1]) && !removedServices.has(edge[2]));
      })
      .join('\n')}\n`;
  }
  const serviceIndex = lines.findIndex((line) => {
    const match = line.match(
      /^\s*service\s+([\w-]+)\([^)]+\)\["?([^\]"\n]+)"?\](?:\s+in\s+[\w-]+)?/i
    );
    return Boolean(match && matchesTarget(match[1], match[2]));
  });
  if (serviceIndex < 0) return undefined;
  const id = lines[serviceIndex].match(/^\s*service\s+([\w-]+)/i)?.[1];
  if (!id) return undefined;
  const idPattern = escapeRegExp(id);
  return `${lines
    .filter(
      (line, index) =>
        index !== serviceIndex &&
        !new RegExp(String.raw`^\s*${idPattern}:[TBRL]\s*--`).test(line) &&
        !new RegExp(String.raw`--\s*[TBRL]:${idPattern}\s*$`).test(line)
    )
    .join('\n')}\n`;
};

const removeVennElement = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const set = lines
    .map((line, index) => ({
      index,
      match: line.match(/^\s*set\s+([\w-]+)(?:\["?([^\]"\n]+)"?\])?/i)
    }))
    .find(({ match }) => match?.slice(1).some((value) => normalizeVisibleText(value) === wanted));
  if (!set?.match) return undefined;
  const id = set.match[1];
  const referencesId = (line: string) => {
    const members = line.match(/^\s*(?:union|style)\s+([\w,-]+)/i)?.[1]?.split(',') ?? [];
    return members.includes(id);
  };
  return `${lines.filter((line, index) => index !== set.index && !referencesId(line)).join('\n')}\n`;
};

const removeGitElement = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text).replace(/^"|"$/g, '');
  const lines = code.split('\n');
  const branchExists = lines.some((line) => {
    const match = line.match(/^\s*branch\s+(?:"([^"]+)"|([^\s]+))/i);
    return normalizeVisibleText(match?.[1] ?? match?.[2]) === wanted;
  });
  if (!branchExists) {
    const commitIndex = lines.findIndex((line) => {
      const match = line.match(/^\s*commit\s+id:\s*(?:"([^"]+)"|([^\s]+))/i);
      return normalizeVisibleText(match?.[1] ?? match?.[2]) === wanted;
    });
    if (commitIndex < 0) return undefined;
    lines.splice(commitIndex, 1);
    return `${lines.join('\n')}\n`;
  }
  let current = 'main';
  const filtered = lines.filter((line) => {
    const branchMatch = line.match(/^\s*branch\s+(?:"([^"]+)"|([^\s]+))/i);
    const checkoutMatch = line.match(/^\s*(?:checkout|switch)\s+(?:"([^"]+)"|([^\s]+))/i);
    const branch = branchMatch?.[1] ?? branchMatch?.[2];
    const checkout = checkoutMatch?.[1] ?? checkoutMatch?.[2];
    if (branch) current = branch;
    if (checkout) current = checkout;
    if (branch === wanted || checkout === wanted) return false;
    if (
      new RegExp(
        String.raw`^\s*merge\s+(?:"${escapeRegExp(wanted)}"|${escapeRegExp(wanted)})(?:\s|$)`,
        'i'
      ).test(line)
    ) {
      return false;
    }
    if (/^\s*commit\b/i.test(line) && current === wanted) return false;
    return true;
  });
  return `${filtered.join('\n')}\n`;
};

const removeBlockElement = (code: string, target: VisualTextTarget): string | undefined => {
  const matchedEdge = target.styleId
    ? getBlockEdges(code).find((edge) => getBlockEdgeStyleId(edge) === target.styleId)
    : undefined;
  if (matchedEdge) {
    const lines = code.split('\n');
    lines.splice(matchedEdge.lineIndex, 1);
    return `${lines.join('\n')}\n`;
  }
  const edgeId = target.styleId?.match(/(?:^|-)L_(.+?)_(.+?)_\d+$/);
  if (edgeId) {
    const source = escapeRegExp(edgeId[1]);
    const destination = escapeRegExp(edgeId[2]);
    const lines = code.split('\n');
    const edgeIndex = lines.findIndex((line) =>
      new RegExp(
        String.raw`^\s*${source}\s*(?:-->|==>|-\.->|--\s*(?:"[^"]*"|[^\n]+?)\s*-->)\s*${destination}\s*$`
      ).test(line)
    );
    if (edgeIndex >= 0) {
      lines.splice(edgeIndex, 1);
      return `${lines.join('\n')}\n`;
    }
  }
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const declarationPattern =
    /(?:^|\s)([A-Za-z][\w-]*)\s*(?:\["?([^\]"\n]+)"?\]|\(\("?([^)"]+)"?\)\)|\("?([^)"]+)"?\))/g;
  const node = lines
    .flatMap((line, index) =>
      [...line.matchAll(declarationPattern)].map((match) => ({ index, match }))
    )
    .find(({ match }) => match.slice(1).some((value) => normalizeVisibleText(value) === wanted));
  if (!node?.match) return undefined;
  const id = node.match[1];
  const edgeReferencesId = (line: string): boolean => {
    const edge = line.match(
      /^\s*([A-Za-z][\w-]*)\s*(?:-->|==>|-\.->|--\s*(?:"[^"]*"|[^\n]+?)\s*-->)\s*([A-Za-z][\w-]*)\s*$/
    );
    return Boolean(edge && (edge[1] === id || edge[2] === id));
  };
  const declarationStart = node.match.index ?? 0;
  const declarationEnd = declarationStart + node.match[0].length;
  const declarationLine =
    `${lines[node.index].slice(0, declarationStart)}${lines[node.index].slice(declarationEnd)}`
      .replace(/\s{2,}/g, ' ')
      .trimEnd();
  return `${lines
    .flatMap((line, index) => {
      if (edgeReferencesId(line)) return [];
      if (index !== node.index) return [line];
      return declarationLine.trim() ? [declarationLine] : [];
    })
    .join('\n')}\n`;
};

const removeERElement = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const start = lines.findIndex((line) => {
    const match = line.match(/^\s*([A-Za-z][\w-]*)\s*\{/);
    return normalizeVisibleText(match?.[1]) === wanted;
  });
  if (start < 0) return undefined;
  const id = lines[start].match(/^\s*([A-Za-z][\w-]*)/)?.[1];
  if (!id) return undefined;
  let end = start + 1;
  while (end < lines.length && !/^\s*\}/.test(lines[end])) end += 1;
  lines.splice(start, Math.min(end + 1, lines.length) - start);
  const idPattern = new RegExp(String.raw`(^|\s)${escapeRegExp(id)}(?=\s|$)`, 'i');
  return `${lines.filter((line) => !(/--/.test(line) && idPattern.test(line))).join('\n')}\n`;
};

const removeWardleyElement = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const index = lines.findIndex((line) => {
    const match = line.match(/^\s*(?:anchor|component)\s+(.+?)\s+\[/i);
    return normalizeVisibleText(match?.[1]) === wanted;
  });
  if (index < 0) return undefined;
  lines.splice(index, 1);
  return `${lines
    .filter((line) => {
      const edge = line.match(/^\s*(.+?)\s*->\s*(.+?)\s*$/);
      if (edge && [edge[1], edge[2]].some((value) => normalizeVisibleText(value) === wanted)) {
        return false;
      }
      const evolve = line.match(/^\s*evolve\s+(.+?)\s+-?\d/i);
      return !evolve || normalizeVisibleText(evolve[1]) !== wanted;
    })
    .join('\n')}\n`;
};

const removeZenUMLElement = (code: string, target: VisualTextTarget): string | undefined => {
  const wanted = normalizeVisibleText(target.text);
  const lines = code.split('\n');
  const declaration = lines.findIndex((line) => {
    const match = line.match(/^\s*@[A-Za-z][\w<>]*\s+(?:<<[^>]+>>\s+)?([A-Za-z][\w-]*)/i);
    return normalizeVisibleText(match?.[1]) === wanted;
  });
  if (declaration < 0) {
    const range = findVisualTextRange(code, target);
    if (!range) return undefined;
    const lineIndex = code.slice(0, range.start).split('\n').length - 1;
    const end = getBalancedBlockEnd(lines, lineIndex);
    lines.splice(lineIndex, end - lineIndex + 1);
    return `${lines.join('\n')}\n`;
  }
  const reference = new RegExp(String.raw`\b${escapeRegExp(wanted)}\b`);
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (index === declaration) continue;
    if (!reference.test(line)) {
      output.push(line);
      continue;
    }
    if (!line.includes('{')) continue;
    let depth = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    while (depth > 0 && ++index < lines.length) {
      depth += (lines[index].match(/\{/g) ?? []).length;
      depth -= (lines[index].match(/\}/g) ?? []).length;
    }
  }
  return `${output.join('\n')}\n`;
};

export const removeDiagramElementCode = (
  code: string,
  target: VisualTextTarget
): string | undefined => {
  const keyword = getDiagramKeyword(code);
  if (['flowchart', 'flowchart-elk', 'flowchart-v2', 'graph'].includes(keyword)) {
    const flowchartCode = removeFlowchartNode(code, target);
    if (flowchartCode) return flowchartCode;
  }
  if (keyword === 'classdiagram' || keyword === 'classdiagram-v2') {
    const classCode = removeClassElement(code, target);
    if (classCode) return classCode;
  }
  if (keyword === 'sequencediagram') {
    const sequenceCode = removeSequenceParticipant(code, target);
    if (sequenceCode) return sequenceCode;
  }
  if (keyword === 'statediagram' || keyword === 'statediagram-v2') {
    const stateCode = removeStateNode(code, target);
    if (stateCode) return stateCode;
  }
  if (keyword === 'radar-beta') return removeRadarDimension(code, target);
  if (keyword === 'xychart-beta') return removeXYDimension(code, target);
  if (keyword === 'requirementdiagram') return removeRequirementBlock(code, target);
  if (keyword.startsWith('c4')) return removeC4Element(code, target);
  if (keyword === 'architecture-beta') return removeArchitectureElement(code, target);
  if (keyword === 'venn-beta') return removeVennElement(code, target);
  if (keyword === 'gitgraph') return removeGitElement(code, target);
  if (keyword === 'erdiagram') return removeERElement(code, target);
  if (keyword === 'wardley-beta') return removeWardleyElement(code, target);
  if (keyword === 'zenuml') {
    const zenCode = removeZenUMLElement(code, target);
    if (zenCode) return zenCode;
  }
  if (keyword === 'block-beta') {
    const blockCode = removeBlockElement(code, target);
    if (blockCode) return blockCode;
  }
  if (keyword === 'timeline') {
    const periodCode = removeTimelinePeriod(code, target);
    if (periodCode) return periodCode;
  }
  const range = findVisualTextRange(code, target);
  if (!range) return undefined;
  const lineRange = getSourceLineRange(code, range);
  let end = lineRange.end;
  if (indentationTreeKeywords.has(keyword)) {
    end = getIndentedBlockEnd(code, lineRange);
  } else if (/^\s*section\s+/i.test(code.slice(lineRange.start, lineRange.end))) {
    const nextSection = code.slice(lineRange.end).search(/^\s*section\s+/im);
    end = nextSection >= 0 ? lineRange.end + nextSection : code.length;
  }
  const nextCode = `${code.slice(0, lineRange.start)}${code.slice(end)}`;
  return keyword === 'packet' ? normalizePacketRanges(nextCode) : nextCode;
};

export const findQuadrantPoint = (
  code: string,
  text: string,
  occurrence = 0
): { x: number; y: number } | undefined => {
  const wanted = normalizeVisibleText(text);
  let matched = 0;
  for (const match of code.matchAll(
    /^\s*([^:\n]+?)\s*:\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/gm
  )) {
    if (normalizeVisibleText(match[1]) !== wanted) continue;
    if (matched++ < occurrence) continue;
    return { x: Number(match[2]), y: Number(match[3]) };
  }
  return undefined;
};

export const replaceQuadrantPoint = (
  code: string,
  text: string,
  point: { x: number; y: number },
  occurrence = 0
): string | undefined => {
  const wanted = normalizeVisibleText(text);
  let matched = 0;
  for (const match of code.matchAll(
    /^\s*([^:\n]+?)\s*:\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/gm
  )) {
    if (normalizeVisibleText(match[1]) !== wanted) continue;
    if (matched++ < occurrence) continue;
    const coordinates = `[${point.x.toFixed(2)}, ${point.y.toFixed(2)}]`;
    const coordinateStart = match.index + match[0].indexOf('[');
    const coordinateEnd = match.index + match[0].lastIndexOf(']') + 1;
    return `${code.slice(0, coordinateStart)}${coordinates}${code.slice(coordinateEnd)}`;
  }
  return undefined;
};

export const findWardleyPoint = (
  code: string,
  text: string
): { x: number; y: number } | undefined => {
  const wanted = normalizeVisibleText(text);
  for (const match of code.matchAll(
    /^\s*(?:anchor|component)\s+(.+?)\s+\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/gim
  )) {
    if (normalizeVisibleText(match[1]) === wanted) {
      return { x: Number(match[2]), y: Number(match[3]) };
    }
  }
  return undefined;
};

export const replaceWardleyPoint = (
  code: string,
  text: string,
  point: { x: number; y: number }
): string | undefined => {
  const wanted = normalizeVisibleText(text);
  for (const match of code.matchAll(
    /^\s*(?:anchor|component)\s+(.+?)\s+\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/gim
  )) {
    if (normalizeVisibleText(match[1]) !== wanted) continue;
    const start = match.index + match[0].indexOf('[');
    const end = match.index + match[0].indexOf(']', match[0].indexOf('[')) + 1;
    return `${code.slice(0, start)}[${point.x.toFixed(2)}, ${point.y.toFixed(2)}]${code.slice(end)}`;
  }
  return undefined;
};

export const findJourneyScore = (
  code: string,
  text: string,
  occurrence = 0
): number | undefined => {
  const normalizedText = normalizeVisibleText(text);
  let matchedOccurrence = 0;
  for (const match of code.matchAll(/^\s*([^:\n]+?)\s*:\s*(\d+(?:\.\d+)?)\s*:/gm)) {
    if (normalizeVisibleText(match[1]) !== normalizedText) {
      continue;
    }
    if (matchedOccurrence < occurrence) {
      matchedOccurrence += 1;
      continue;
    }
    return Number.parseFloat(match[2]);
  }
  return undefined;
};

export const replaceJourneyScore = (
  code: string,
  text: string,
  score: number,
  occurrence = 0
): string | undefined => {
  const normalizedText = normalizeVisibleText(text);
  let matchedOccurrence = 0;
  for (const match of code.matchAll(/^\s*([^:\n]+?)\s*:\s*(\d+(?:\.\d+)?)\s*:/gm)) {
    if (normalizeVisibleText(match[1]) !== normalizedText) {
      continue;
    }
    if (matchedOccurrence < occurrence) {
      matchedOccurrence += 1;
      continue;
    }
    const scoreStart = match.index + match[0].indexOf(match[2]);
    return `${code.slice(0, scoreStart)}${score}${code.slice(scoreStart + match[2].length)}`;
  }
  return undefined;
};
