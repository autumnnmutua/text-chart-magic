/* eslint sort-keys/sort-keys-fix: off -- Strategy order follows diagram families. */
const BRANCH_LABEL = '新分支';

export interface DiagramBranchRequest {
  code: string;
  label?: string;
  mode?: 'after' | 'before' | 'branch' | 'commit' | 'section' | 'split';
  sourceId?: string;
}

export interface DiagramBranchResult {
  code: string;
  notice?: string;
  optimizeFlowchart?: boolean;
}

type BranchStrategy = (
  request: Required<Omit<DiagramBranchRequest, 'mode'>> & {
    mode: NonNullable<DiagramBranchRequest['mode']>;
  }
) => string | undefined;

const normalizeLabel = (value = ''): string => value.replace(/\s+/g, ' ').trim();
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getDiagramKeyword = (code: string): string => {
  let inFrontmatter = false;
  let hasFrontmatter = false;
  const line = code
    .split('\n')
    .map((item) => item.trim())
    .find((item, index) => {
      if (!item || item.startsWith('%%')) return false;
      if (item === '---' && (index === 0 || inFrontmatter)) {
        inFrontmatter = !inFrontmatter;
        hasFrontmatter = true;
        return false;
      }
      return !(hasFrontmatter && inFrontmatter);
    });
  return line?.split(/\s+/)[0]?.toLowerCase() ?? '';
};

const getUniqueName = (code: string, prefix: string): string => {
  let index = 1;
  let name = `${prefix}${index}`;
  while (
    new RegExp(String.raw`(^|[^A-Za-z0-9_-])${escapeRegExp(name)}(?![A-Za-z0-9_-])`, 'm').test(code)
  ) {
    name = `${prefix}${++index}`;
  }
  return name;
};

const getUniqueLabel = (code: string): string => {
  if (!code.includes(BRANCH_LABEL)) return BRANCH_LABEL;
  let index = 2;
  while (code.includes(`${BRANCH_LABEL} ${index}`)) index += 1;
  return `${BRANCH_LABEL} ${index}`;
};

const getUniqueDisplayName = (code: string, base: string): string => {
  if (!code.includes(base)) return base;
  let index = 2;
  while (code.includes(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
};

const getCodeIndent = (code: string): string =>
  code
    .split('\n')
    .find((line) => /^\s+\S/.test(line))
    ?.match(/^\s+/)?.[0] ?? '    ';

const getLineLabels = (line: string): string[] => {
  const quoted = [...line.matchAll(/["'`]([^"'`]+)["'`]/g)].map((match) => match[1]);
  const bracketed = [...line.matchAll(/\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\}/g)].map(
    (match) => match[1] ?? match[2] ?? match[3]
  );
  const beforeColon = line.match(/^\s*(?:section\s+)?([^:\n]+?)\s*(?=:|$)/i)?.[1];
  return [...quoted, ...bracketed, beforeColon ?? ''].map(normalizeLabel).filter(Boolean);
};

const findLineIndexByLabel = (lines: string[], label: string): number => {
  const wanted = normalizeLabel(label);
  if (!wanted) return -1;
  const exact = lines.findIndex((line) => getLineLabels(line).includes(wanted));
  if (exact >= 0) return exact;
  return lines.findIndex((line) => normalizeLabel(line).includes(wanted));
};

const insertNearLabelLine = (
  code: string,
  label: string,
  line: string,
  { asChild = false }: { asChild?: boolean } = {}
): string | undefined => {
  const lines = code.trimEnd().split('\n');
  const index = findLineIndexByLabel(lines, label);
  if (normalizeLabel(label) && index < 0) return undefined;
  const referenceLine = index >= 0 ? lines[index] : (lines.at(-1) ?? '');
  const indent = referenceLine.match(/^\s*/)?.[0] ?? getCodeIndent(code);
  lines.splice(
    index >= 0 ? index + 1 : lines.length,
    0,
    `${asChild ? `${indent}  ` : indent}${line.trimStart()}`
  );
  return `${lines.join('\n')}\n`;
};

const collectFlowchartNodeIDs = (code: string): string[] => {
  const ids = new Set<string>();
  const id = String.raw`[A-Za-z][A-Za-z0-9_]*`;
  for (const pattern of [
    new RegExp(String.raw`\b(${id})(?=\s*(?:\[|\(|\{))`, 'g'),
    new RegExp(String.raw`\b(${id})\s*(?:-->|---|==>|-.->)`, 'g'),
    new RegExp(String.raw`(?:-->|---|==>|-.->)(?:\|[^|]*\|)?\s*(${id})\b`, 'g')
  ]) {
    for (const match of code.matchAll(pattern)) ids.add(match[1]);
  }
  return [...ids];
};

const findFlowchartNodeIdByLabel = (code: string, label: string): string => {
  const wanted = normalizeLabel(label);
  for (const match of code.matchAll(
    /\b([A-Za-z][A-Za-z0-9_]*)\s*(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})/g
  )) {
    if (normalizeLabel(match[2] ?? match[3] ?? match[4]) === wanted) return match[1];
  }
  return '';
};

const addFlowchartBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const cleanSourceId = (sourceId || findFlowchartNodeIdByLabel(code, label)).match(
    /[A-Za-z][A-Za-z0-9_]*/
  )?.[0];
  if (!cleanSourceId) return undefined;
  const ids = collectFlowchartNodeIDs(code);
  if (!ids.includes(cleanSourceId)) return undefined;
  let index = 1;
  let branchId = `${cleanSourceId}_branch_${index}`;
  while (ids.includes(branchId)) branchId = `${cleanSourceId}_branch_${++index}`;
  const lines = code.trimEnd().split('\n');
  const source = escapeRegExp(cleanSourceId);
  let insertIndex = lines.findLastIndex((line) =>
    new RegExp(String.raw`^\s*${source}\s*(?:-->|---|==>|-.->)`).test(line)
  );
  if (insertIndex < 0) {
    insertIndex = lines.findLastIndex((line) =>
      new RegExp(String.raw`\b${source}\s*(?:\[|\(|\{)`).test(line)
    );
  }
  const branchLabel = index === 1 ? BRANCH_LABEL : `${BRANCH_LABEL} ${index}`;
  lines.splice(
    insertIndex < 0 ? lines.length : insertIndex + 1,
    0,
    `${getCodeIndent(code)}${cleanSourceId} -->|关系| ${branchId}[${branchLabel}]`
  );
  return `${lines.join('\n')}\n`;
};

const addMindmapBranch: BranchStrategy = ({ code, label }) => {
  const lines = code.trimEnd().split('\n');
  const index = findLineIndexByLabel(lines, label);
  if (normalizeLabel(label) && index < 0) return undefined;
  const parent = index >= 0 ? lines[index] : (lines.at(-1) ?? '');
  const indent = `${parent.match(/^\s*/)?.[0] ?? '  '}  `;
  lines.splice(index >= 0 ? index + 1 : lines.length, 0, `${indent}${getUniqueLabel(code)}`);
  return `${lines.join('\n')}\n`;
};

const addSequenceBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const branchId = getUniqueName(code, 'Branch');
  const wanted = normalizeLabel(label);
  const participants = [
    ...code.matchAll(/^\s*(?:participant|actor)\s+([A-Za-z][\w-]*)(?:\s+as\s+(.+))?/gim)
  ];
  const implicitParticipants = [
    ...code.matchAll(
      /^\s*([A-Za-z][\w-]*)\s*(?:-->>?|->>|-->|->|-\)|--\)|-x|--x)\s*([A-Za-z][\w-]*)/gim
    )
  ].flatMap((match) => [match[1], match[2]]);
  const participant = participants.find(
    (match) => match[1] === wanted || normalizeLabel(match[2]) === wanted
  );
  const source =
    participant?.[1] ??
    participants.find((match) => match[1] === sourceId)?.[1] ??
    implicitParticipants.find((name) => name === sourceId || normalizeLabel(name) === wanted) ??
    (!normalizeLabel(label) ? implicitParticipants[0] : undefined);
  if (!source) return undefined;
  return `${code.trimEnd()}\n    participant ${branchId} as ${getUniqueLabel(code)}\n    ${source}->>${branchId}: ${getUniqueLabel(code)}\n`;
};

const addClassBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const branchId = getUniqueName(code, 'Branch');
  const wanted = normalizeLabel(label);
  const classes = [...code.matchAll(/^\s*class\s+([A-Za-z][\w-]*)(?:\s*\["?([^"\]]+)"?\])?/gim)];
  const source =
    classes.find((match) => match[1] === wanted || normalizeLabel(match[2]) === wanted)?.[1] ||
    (sourceId && classes.some((match) => match[1] === sourceId) ? sourceId : '') ||
    (!wanted ? code.match(/^\s*class\s+([A-Za-z][\w-]*)/im)?.[1] : '');
  if (!source) return undefined;
  const memberOwner = source;
  const selectedIsMember =
    wanted && !classes.some((match) => match[1] === wanted || normalizeLabel(match[2]) === wanted);
  if (selectedIsMember && memberOwner) {
    const lines = code.trimEnd().split('\n');
    const declaration = lines.findIndex((line) =>
      new RegExp(String.raw`^\s*class\s+${escapeRegExp(memberOwner)}\b`).test(line)
    );
    if (declaration >= 0) {
      let end = declaration;
      while (end < lines.length && !/^\s*}\s*$/.test(lines[end])) end += 1;
      if (end < lines.length) {
        const count = (code.match(/新字段/g) ?? []).length + 1;
        lines.splice(end, 0, `      +String 新字段${count > 1 ? count : ''}`);
        return `${lines.join('\n')}\n`;
      }
    }
  }
  return `${code.trimEnd()}\n    class ${branchId}["${getUniqueLabel(code)}"] {\n      +String 新字段\n      +新方法()\n    }\n    ${source} <|-- ${branchId}\n`;
};

const addStateBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const branchId = getUniqueName(code, 'Branch');
  const wanted = normalizeLabel(label);
  const explicitSource = [...code.matchAll(/^\s*([A-Za-z][\w-]*)\s*:\s*(.+)$/gm)].find(
    (match) => match[1] === wanted || normalizeLabel(match[2]) === wanted
  )?.[1];
  const stateIds = new Set(
    [...code.matchAll(/(?:^|\s)([A-Za-z][\w-]*)\s*(?=-->|:)|-->\s*([A-Za-z][\w-]*)/gm)].flatMap(
      (match) => [match[1], match[2]].filter(Boolean)
    )
  );
  const source =
    explicitSource ||
    (sourceId && stateIds.has(sourceId) ? sourceId : '') ||
    ([...stateIds].find((id) => normalizeLabel(id) === wanted) ?? '') ||
    (!wanted ? '[*]' : '');
  if (!source) return undefined;
  return `${code.trimEnd()}\n    ${branchId}: ${getUniqueLabel(code)}\n    ${source} --> ${branchId}\n`;
};

const addGanttBranch: BranchStrategy = ({ code, label, mode }) => {
  const taskId = getUniqueName(code, 'task');
  const lines = code.trimEnd().split('\n');
  const wanted = normalizeLabel(label);
  if (wanted && findLineIndexByLabel(lines, label) < 0) return undefined;
  const sectionIndex = lines.findIndex(
    (line) => normalizeLabel(line.replace(/^\s*section\s+/i, '')) === wanted
  );
  if (mode === 'section') {
    const sectionLabel = getUniqueDisplayName(code, '新分组');
    const sectionTaskId = getUniqueName(code, 'task');
    const sectionCount = (code.match(/^\s*section\s+/gim) ?? []).length;
    const sectionState = sectionCount % 2 === 0 ? 'active' : 'crit';
    const start = code.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? new Date().toISOString().slice(0, 10);
    let insertIndex = lines.length;
    if (sectionIndex >= 0) {
      const nextSection = lines.findIndex(
        (line, index) => index > sectionIndex && /^\s*section\s+/i.test(line)
      );
      insertIndex = nextSection >= 0 ? nextSection : lines.length;
    }
    lines.splice(
      insertIndex,
      0,
      `${getCodeIndent(code)}section ${sectionLabel}`,
      `${getCodeIndent(code)}新任务 :${sectionState}, ${sectionTaskId}, ${start}, 1d`
    );
    return `${lines.join('\n')}\n`;
  }
  if (sectionIndex >= 0) {
    const nextSection = lines.findIndex(
      (line, index) => index > sectionIndex && /^\s*section\s+/i.test(line)
    );
    const start = code.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? new Date().toISOString().slice(0, 10);
    lines.splice(
      nextSection >= 0 ? nextSection : lines.length,
      0,
      `${getCodeIndent(code)}${getUniqueLabel(code)} :${taskId}, ${start}, 1d`
    );
    return `${lines.join('\n')}\n`;
  }
  const taskMatch = [...code.matchAll(/^\s*([^:\n]+?)\s*:\s*([^\n]+)$/gm)].find(
    (match) => normalizeLabel(match[1]) === wanted
  );
  const taskStates = new Set(['active', 'crit', 'done', 'milestone']);
  const sourceId =
    taskMatch?.[2]
      .split(',')
      .map((token) => token.trim())
      .find(
        (token) => /^[A-Za-z][\w-]*$/.test(token) && !taskStates.has(token.toLocaleLowerCase())
      ) ?? '';
  const start = sourceId
    ? `after ${sourceId}, 1d`
    : `${code.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? new Date().toISOString().slice(0, 10)}, 1d`;
  return insertNearLabelLine(code, label, `${getUniqueLabel(code)} :${taskId}, ${start}`);
};

const addJourneyBranch: BranchStrategy = ({ code, label }) => {
  const lines = code.trimEnd().split('\n');
  const sectionIndex = lines.findIndex(
    (line) => normalizeLabel(line.replace(/^\s*section\s+/i, '')) === normalizeLabel(label)
  );
  const branchLabel = getUniqueLabel(code);
  if (sectionIndex < 0) return insertNearLabelLine(code, label, `${branchLabel}: 5: 用户`);
  const nextSection = lines.findIndex(
    (line, index) => index > sectionIndex && /^\s*section\s+/i.test(line)
  );
  lines.splice(
    nextSection >= 0 ? nextSection : lines.length,
    0,
    `    section ${branchLabel}`,
    `      ${branchLabel}内容: 5: 用户`
  );
  return `${lines.join('\n')}\n`;
};

const getIndentLength = (line: string): number => line.match(/^\s*/)?.[0].length ?? 0;

const addTreemapBranch: BranchStrategy = ({ code, label }) => {
  const lines = code.trimEnd().split('\n');
  const index = findLineIndexByLabel(lines, label);
  if (index < 0) {
    return normalizeLabel(label) ? undefined : `${code.trimEnd()}\n"${getUniqueLabel(code)}": 1\n`;
  }
  const parentIndent = getIndentLength(lines[index]);
  const leafValue = lines[index].match(/:\s*(-?\d+(?:\.\d+)?)\s*$/)?.[1];
  if (leafValue) {
    lines[index] = lines[index].replace(/\s*:\s*-?\d+(?:\.\d+)?\s*$/, '');
    lines.splice(
      index + 1,
      0,
      `${' '.repeat(parentIndent + 2)}"${getUniqueDisplayName(code, '原有内容')}": ${leafValue}`
    );
  }
  let insertIndex = index + 1;
  while (insertIndex < lines.length && getIndentLength(lines[insertIndex]) > parentIndent) {
    insertIndex += 1;
  }
  lines.splice(insertIndex, 0, `${' '.repeat(parentIndent + 2)}"${getUniqueLabel(code)}": 1`);
  return `${lines.join('\n')}\n`;
};

interface PacketField {
  indent: string;
  label: string;
  lineIndex: number;
  width: number;
}

const getPacketFields = (code: string): PacketField[] =>
  code
    .split('\n')
    .map((line, lineIndex) => {
      const match = line.match(/^(\s*)(\d+)(?:-(\d+))?\s*:\s*"([^"]+)"/);
      if (!match) return undefined;
      return {
        indent: match[1],
        label: match[4],
        lineIndex,
        width: Number(match[3] ?? match[2]) - Number(match[2]) + 1
      };
    })
    .filter((field): field is PacketField => field !== undefined);

const renderPacketFields = (code: string, fields: PacketField[]): string => {
  const lines = code
    .trimEnd()
    .split('\n')
    .filter((line) => !/^\s*\d+(?:-\d+)?\s*:/.test(line));
  let nextBit = 0;
  const rendered = fields.map((field) => {
    const start = nextBit;
    const end = start + Math.max(field.width, 1) - 1;
    nextBit = end + 1;
    return `${field.indent}${start}${end === start ? '' : `-${end}`}: "${field.label}"`;
  });
  return `${[...lines, ...rendered].join('\n')}\n`;
};

const addPacketBranch: BranchStrategy = ({ code, label, mode }) => {
  const fields = getPacketFields(code);
  const selectedIndex = fields.findIndex(
    (field) => normalizeLabel(field.label) === normalizeLabel(label)
  );
  if (normalizeLabel(label) && selectedIndex < 0) return undefined;
  const insertIndex =
    selectedIndex < 0 ? fields.length : selectedIndex + (mode === 'before' ? 0 : 1);
  const selected = fields[selectedIndex];
  const newField: PacketField = {
    indent: selected?.indent ?? '',
    label: getUniqueLabel(code),
    lineIndex: -1,
    width: 16
  };
  if (mode === 'split' && selected && selected.width > 1) {
    const newWidth = Math.max(Math.floor(selected.width / 2), 1);
    selected.width -= newWidth;
    newField.width = newWidth;
  }
  fields.splice(insertIndex, 0, newField);
  return renderPacketFields(code, fields);
};

const appendListValue = (value: string, item: string): string =>
  value.trim() ? `${value.trim()}, ${item}` : item;

const addRadarDimension: BranchStrategy = ({ code }) => {
  const dimensionId = getUniqueName(code, 'dimension').toLowerCase();
  const dimensionLabel = getUniqueLabel(code);
  let nextCode = code;
  const axisPattern = /^(\s*axis\s+)([^\n]+)$/im;
  if (axisPattern.test(nextCode)) {
    nextCode = nextCode.replace(
      axisPattern,
      (_line, prefix: string, axes: string) =>
        `${prefix}${appendListValue(axes, `${dimensionId}["${dimensionLabel}"]`)}`
    );
  } else {
    nextCode = `${nextCode.trimEnd()}\n  axis ${dimensionId}["${dimensionLabel}"]\n`;
  }
  return nextCode.replace(
    /^(\s*curve\s+[^\n{]+\{)([^}]*)(\})/gim,
    (_line, prefix: string, values: string, suffix: string) =>
      `${prefix}${appendListValue(values, '50')}${suffix}`
  );
};

const addXYDimension: BranchStrategy = ({ code }) => {
  const label = `"${getUniqueLabel(code)}"`;
  let nextCode = code;
  const axisPattern = /^(\s*x-axis\s*\[)([^\]]*)(\])/im;
  if (axisPattern.test(nextCode)) {
    nextCode = nextCode.replace(
      axisPattern,
      (_line, prefix: string, values: string, suffix: string) =>
        `${prefix}${appendListValue(values, label)}${suffix}`
    );
  } else {
    nextCode = `${nextCode.trimEnd()}\n    x-axis [${label}]\n`;
  }
  return nextCode.replace(
    /^(\s*(?:bar|line)\s*\[)([^\]]*)(\])/gim,
    (_line, prefix: string, values: string, suffix: string) =>
      `${prefix}${appendListValue(values, '0')}${suffix}`
  );
};

const addTimelineBranch: BranchStrategy = ({ code, label }) => {
  const lines = code.trimEnd().split('\n');
  const index = findLineIndexByLabel(lines, label);
  if (index < 0) {
    return normalizeLabel(label)
      ? undefined
      : `${code.trimEnd()}\n    ${getUniqueLabel(code)} : 新事件\n`;
  }
  const periodMatch = lines[index].match(/^\s*([^:]+?)\s*:\s*(.*)$/);
  if (periodMatch && normalizeLabel(periodMatch[1]) === normalizeLabel(label)) {
    let insertIndex = index + 1;
    while (insertIndex < lines.length && /^\s*:\s*/.test(lines[insertIndex])) insertIndex += 1;
    lines.splice(
      insertIndex,
      0,
      `${lines[index].match(/^\s*/)?.[0] ?? '    '}${getUniqueLabel(code)} : 新事件`
    );
  } else {
    lines.splice(
      index + 1,
      0,
      `${lines[index].match(/^\s*/)?.[0] ?? '    '}: ${getUniqueLabel(code)}`
    );
  }
  return `${lines.join('\n')}\n`;
};

interface C4Element {
  id: string;
  kind: string;
  lineIndex: number;
}

const findC4Element = (code: string, label: string, sourceId = ''): C4Element | undefined => {
  const wanted = normalizeLabel(label);
  const lines = code.split('\n');
  for (const [lineIndex, line] of lines.entries()) {
    const match = line.match(/^\s*([A-Za-z][\w]*)\(\s*([A-Za-z][\w-]*)\s*,\s*"([^"]+)"/);
    if (!match) continue;
    const quotedValues = [...line.matchAll(/"([^"]+)"/g)].map((item) => normalizeLabel(item[1]));
    if ((sourceId && match[2] === sourceId) || quotedValues.includes(wanted)) {
      return { id: match[2], kind: match[1], lineIndex };
    }
  }
  return undefined;
};

const findEnclosingC4Boundary = (lines: string[], lineIndex: number): C4Element | undefined => {
  const stack: C4Element[] = [];
  for (let index = 0; index < lineIndex; index += 1) {
    const declaration = lines[index].match(
      /^\s*([A-Za-z][\w]*Boundary)\(\s*([A-Za-z][\w-]*)\s*,\s*"[^"]+"[^)]*\)\s*\{/
    );
    if (declaration) stack.push({ id: declaration[2], kind: declaration[1], lineIndex: index });
    for (const character of lines[index]) {
      if (character === '}' && stack.length) stack.pop();
    }
  }
  return stack.at(-1);
};

const findC4BoundaryEnd = (lines: string[], boundary: C4Element): number => {
  let depth = 0;
  for (let index = boundary.lineIndex; index < lines.length; index += 1) {
    depth += (lines[index].match(/\{/g) ?? []).length;
    depth -= (lines[index].match(/\}/g) ?? []).length;
    if (depth === 0) return index;
  }
  return lines.length;
};

const addC4Branch: BranchStrategy = ({ code, label, sourceId }) => {
  const id = getUniqueName(code, 'Branch');
  const source = findC4Element(code, label, sourceId);
  if ((normalizeLabel(label) || sourceId) && !source) return undefined;
  const keyword = getDiagramKeyword(code);
  const kind =
    keyword === 'c4component' ? 'Component' : keyword === 'c4container' ? 'Container' : 'System';
  const lines = code.trimEnd().split('\n');
  const selectedBoundary = source?.kind.toLowerCase().endsWith('boundary') ? source : undefined;
  const boundary =
    selectedBoundary ?? (source ? findEnclosingC4Boundary(lines, source.lineIndex) : undefined);
  const layoutIndex = lines.findIndex((line) => /^\s*UpdateLayoutConfig\(/i.test(line));
  const insertIndex = boundary
    ? findC4BoundaryEnd(lines, boundary)
    : layoutIndex >= 0
      ? layoutIndex
      : lines.length;
  const indent = boundary
    ? `${lines[boundary.lineIndex].match(/^\s*/)?.[0] ?? ''}  `
    : getCodeIndent(code);
  lines.splice(insertIndex, 0, `${indent}${kind}(${id}, "${getUniqueLabel(code)}", "新增模块")`);
  if (source && !selectedBoundary) {
    const relationshipIndex = lines.findIndex((line) => /^\s*UpdateLayoutConfig\(/i.test(line));
    lines.splice(
      relationshipIndex >= 0 ? relationshipIndex : lines.length,
      0,
      `${getCodeIndent(code)}Rel(${source.id}, ${id}, "包含")`
    );
  }
  if (!lines.some((line) => /^\s*UpdateLayoutConfig\(/i.test(line))) {
    lines.push('    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")');
  }
  return `${lines.join('\n')}\n`;
};

const findRequirementByLabel = (
  code: string,
  label: string
): { id: string; kind: string } | undefined => {
  const wanted = normalizeLabel(label).replace(/^"|"$/g, '');
  for (const match of code.matchAll(
    /^\s*(requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint)\s+([\w-]+)\s*\{([\s\S]*?)^\s*\}/gim
  )) {
    const text = match[3].match(/^\s*text\s*:\s*"?([^"\n]+)"?/im)?.[1];
    const visibleId = match[3].match(/^\s*id\s*:\s*"?([^"\n]+)"?/im)?.[1];
    if ([match[2], text, visibleId].some((value) => normalizeLabel(value) === wanted)) {
      return { id: match[2], kind: match[1] };
    }
  }
  return undefined;
};

const addRequirementBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const id = getUniqueName(code, 'branch').toLowerCase();
  const sourceParent = sourceId
    ? [
        ...code.matchAll(
          /^\s*(requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint)\s+([\w-]+)\s*\{/gim
        )
      ].find((match) => match[2] === sourceId)
    : undefined;
  const parent = sourceParent
    ? { id: sourceParent[2], kind: sourceParent[1] }
    : findRequirementByLabel(code, label);
  if ((normalizeLabel(label) || sourceId) && !parent) return undefined;
  const kind = parent?.kind ?? 'requirement';
  const relation = parent ? `\n    ${parent.id} - contains -> ${id}` : '';
  return `${code.trimEnd()}\n\n    ${kind} ${id} {\n      id: ${id}\n      text: "${getUniqueLabel(code)}"\n      risk: low\n      verifymethod: test\n    }${relation}\n`;
};

const findArchitectureService = (code: string, label: string, sourceId = '') => {
  const wanted = normalizeLabel(label);
  for (const match of code.matchAll(
    /^\s*service\s+([\w-]+)\(([^)]+)\)\["?([^\]"\n]+)"?\](?:\s+in\s+([\w-]+))?/gim
  )) {
    if (
      match[1] === sourceId ||
      [match[1], match[3]].some((value) => normalizeLabel(value) === wanted)
    ) {
      return { group: match[4] ?? '', id: match[1] };
    }
  }
  return undefined;
};

const findArchitectureGroup = (code: string, label: string, sourceId = ''): string => {
  const wanted = normalizeLabel(label);
  for (const match of code.matchAll(/^\s*group\s+([\w-]+)\([^)]+\)\["?([^\]"\n]+)"?\]/gim)) {
    if (
      match[1] === sourceId ||
      [match[1], match[2]].some((value) => normalizeLabel(value) === wanted)
    )
      return match[1];
  }
  return '';
};

const addArchitectureBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const source = findArchitectureService(code, label, sourceId);
  const selectedGroup = findArchitectureGroup(code, label, sourceId);
  if ((normalizeLabel(label) || sourceId) && !source && !selectedGroup) return undefined;
  const id = getUniqueName(code, 'service').toLowerCase();
  const parentGroup = source?.group || selectedGroup;
  const group = parentGroup ? ` in ${parentGroup}` : '';
  const outgoingCount = source
    ? code
        .split('\n')
        .filter((line) => new RegExp(`^\\s*${escapeRegExp(source.id)}:[TBRL]\\s*--`).test(line))
        .length
    : 0;
  const directions = [
    ['R', 'L'],
    ['B', 'T'],
    ['L', 'R'],
    ['T', 'B']
  ];
  const [sourceSide, targetSide] = directions[outgoingCount % directions.length];
  const edge = source ? `\n    ${source.id}:${sourceSide} -- ${targetSide}:${id}` : '';
  return `${code.trimEnd()}\n    service ${id}(server)[${getUniqueLabel(code)}]${group}${edge}\n`;
};

const findEREntity = (code: string, label: string, sourceId = ''): string => {
  const wanted = normalizeLabel(label);
  const entities = new Set<string>();
  for (const match of code.matchAll(/^\s*([A-Za-z][\w-]*)\s*\{/gm)) entities.add(match[1]);
  for (const match of code.matchAll(
    /^\s*([A-Za-z][\w-]*)\s+(?:\|\||o\||\}\||\|o|oo|\}o)--(?:\|\||o\||\}\||\|o|oo|\}o)\s+([A-Za-z][\w-]*)/gm
  )) {
    entities.add(match[1]);
    entities.add(match[2]);
  }
  return (
    [...entities].find((entity) => entity === sourceId || normalizeLabel(entity) === wanted) ?? ''
  );
};

const addERBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const parent = findEREntity(code, label, sourceId);
  if ((normalizeLabel(label) || sourceId) && !parent) return undefined;
  const id = getUniqueName(code, 'ENTITY').toUpperCase();
  const relation = parent ? `    ${parent} ||--o{ ${id} : "包含"\n` : '';
  return `${code.trimEnd()}\n${relation}    ${id} {\n        string id PK "主键"\n        string name "${getUniqueLabel(code)}"\n    }\n`;
};

const findWardleyComponent = (code: string, label: string): string => {
  const wanted = normalizeLabel(label);
  for (const match of code.matchAll(/^\s*(?:anchor|component)\s+(.+?)\s+\[/gim)) {
    if (normalizeLabel(match[1]) === wanted) return match[1].trim();
  }
  return '';
};

const addWardleyBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const name = getUniqueName(code, 'Component');
  const parent =
    (sourceId ? findWardleyComponent(code, sourceId) : '') || findWardleyComponent(code, label);
  if ((normalizeLabel(label) || sourceId) && !parent) return undefined;
  const dependency = parent ? `${parent} -> ${name}\n` : '';
  return `${code.trimEnd()}\ncomponent ${name} [0.50, 0.50] label [-20, 4]\n${dependency}`;
};

const addZenUMLBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const participant = getUniqueName(code, 'Participant');
  const step = getUniqueName(code, 'newStep');
  const wanted = normalizeLabel(label);
  const participants = [
    ...code.matchAll(/^\s*@[A-Za-z][\w<>]*\s+(?:<<[^>]+>>\s+)?([A-Za-z][\w-]*)/gm)
  ].map((match) => match[1]);
  const caller =
    participants.find((item) => item === sourceId || normalizeLabel(item) === wanted) ??
    (!wanted && !sourceId ? participants[0] : undefined);
  if (caller) return `${code.trimEnd()}\n    ${caller}.${step}()\n`;
  if (wanted || sourceId) return undefined;
  return `${code.trimEnd()}\n    @Participant ${participant}\n    ${participant}.${step}()\n`;
};

const findVennSetId = (code: string, label: string): string => {
  const wanted = normalizeLabel(label);
  for (const match of code.matchAll(/^\s*set\s+([\w-]+)(?:\["?([^\]"\n]+)"?\])?/gim)) {
    if ([match[1], match[2]].some((value) => normalizeLabel(value) === wanted)) return match[1];
  }
  for (const match of code.matchAll(/^\s*union\s+([\w,-]+)\["?([^\]"\n]+)"?\]/gim)) {
    if (normalizeLabel(match[2]) === wanted) return match[1].split(',')[0];
  }
  return '';
};

const addVennBranch: BranchStrategy = ({ code, label }) => {
  const id = getUniqueName(code, 'Set');
  const source = findVennSetId(code, label);
  const union = source ? `\n    union ${source},${id}["${getUniqueName(code, '交集')}"]` : '';
  return `${code.trimEnd()}\n    set ${id}["${getUniqueLabel(code)}"]${union}\n`;
};

const getGitBranchForLabel = (code: string, label: string): string | undefined => {
  const wanted = normalizeLabel(label).replace(/^"|"$/g, '');
  if (wanted === 'main') return 'main';
  const declared = [
    ...code.matchAll(/^\s*branch\s+(?:"([^"]+)"|([^\s]+))(?:\s+order:\s*\d+)?/gim)
  ].find((match) => normalizeLabel(match[1] ?? match[2]) === wanted);
  if (declared) return declared[1] ? `"${declared[1]}"` : declared[2];
  let current = 'main';
  for (const line of code.split('\n')) {
    const branchMatch = line.match(/^\s*branch\s+(?:"([^"]+)"|([^\s]+))/i);
    const checkoutMatch = line.match(/^\s*(?:checkout|switch)\s+(?:"([^"]+)"|([^\s]+))/i);
    const branch = branchMatch?.[1] ? `"${branchMatch[1]}"` : branchMatch?.[2];
    const checkout = checkoutMatch?.[1] ? `"${checkoutMatch[1]}"` : checkoutMatch?.[2];
    if (branch) current = branch;
    if (checkout) current = checkout;
    const commit = line.match(/^\s*commit(?:\s+id:\s*(?:"([^"]+)"|([^\s]+)))?/i);
    if (commit && normalizeLabel(commit[1] ?? commit[2] ?? '') === wanted) return current;
  }
  return undefined;
};

const addGitBranch: BranchStrategy = ({ code, label, mode }) => {
  const sourceBranch = normalizeLabel(label) ? getGitBranchForLabel(code, label) : 'main';
  if (!sourceBranch) return undefined;
  const checkout = sourceBranch ? `\n    checkout ${sourceBranch}` : '';
  const commitId = getUniqueLabel(code).replace(/\s+/g, '-');
  if (mode === 'commit') {
    return `${code.trimEnd()}${checkout}\n    commit id: "${commitId}"\n`;
  }
  const branchId = getUniqueName(code, 'branch').toLowerCase();
  return `${code.trimEnd()}${checkout}\n    branch ${branchId}\n    checkout ${branchId}\n    commit id: "${commitId}"\n`;
};

const findBlockId = (code: string, label: string): string => {
  const wanted = normalizeLabel(label);
  for (const match of code.matchAll(
    /(?:^|\s)([A-Za-z][\w-]*)\s*(?:\["?([^\]"\n]+)"?\]|\(\("?([^)"]+)"?\)\)|\("?([^)"]+)"?\))/gm
  )) {
    if (
      [match[1], match[2], match[3], match[4]].some((value) => normalizeLabel(value) === wanted)
    ) {
      return match[1];
    }
  }
  return '';
};

const addBlockBranch: BranchStrategy = ({ code, label, sourceId }) => {
  const source = findBlockId(code, sourceId || label);
  if ((normalizeLabel(label) || sourceId) && !source) return undefined;
  const id = getUniqueName(code, 'Branch');
  const edge = source ? `\n  ${source} --> ${id}` : '';
  return `${code.trimEnd()}\n  ${id}["${getUniqueLabel(code)}"]${edge}\n`;
};

export const createBlockArrowCode = (
  code: string,
  sourceLabel: string,
  targetLabel: string
): string | undefined => {
  if (getDiagramKeyword(code) !== 'block-beta') return undefined;
  const source = findBlockId(code, sourceLabel);
  const target = findBlockId(code, targetLabel);
  if (!source || !target || source === target) return undefined;
  const duplicate = new RegExp(
    String.raw`^\s*${escapeRegExp(source)}\s*(?:-->|==>|-\.->|--\s*(?:"[^"]*"|[^\n]+?)\s*-->)\s*${escapeRegExp(target)}\s*$`,
    'm'
  );
  if (duplicate.test(code)) return undefined;
  return `${code.trimEnd()}\n  ${source} -- "${getUniqueName(code, '箭头')}" --> ${target}\n`;
};

export type PacketFieldSize = 'large' | 'medium' | 'small';

export const resizePacketFieldCode = (
  code: string,
  label: string,
  size: PacketFieldSize
): string | undefined => {
  if (getDiagramKeyword(code) !== 'packet') return undefined;
  const fields = getPacketFields(code);
  const field = fields.find((item) => normalizeLabel(item.label) === normalizeLabel(label));
  if (!field) return undefined;
  field.width = { large: 32, medium: 16, small: 8 }[size];
  return renderPacketFields(code, fields);
};

const strategies: Record<string, BranchStrategy> = {
  flowchart: addFlowchartBranch,
  'flowchart-elk': addFlowchartBranch,
  'flowchart-v2': addFlowchartBranch,
  graph: addFlowchartBranch,
  mindmap: addMindmapBranch,
  sequencediagram: addSequenceBranch,
  classdiagram: addClassBranch,
  'classdiagram-v2': addClassBranch,
  statediagram: addStateBranch,
  'statediagram-v2': addStateBranch,
  gantt: addGanttBranch,
  journey: addJourneyBranch,
  'treemap-beta': addTreemapBranch,
  packet: addPacketBranch,
  'block-beta': addBlockBranch,
  pie: ({ code, label }) => insertNearLabelLine(code, label, `"${getUniqueLabel(code)}" : 1`),
  quadrantchart: ({ code, label }) =>
    insertNearLabelLine(code, label, `${getUniqueLabel(code)}: [0.75, 0.75]`),
  timeline: addTimelineBranch,
  kanban: ({ code, label }) => insertNearLabelLine(code, label, `[${getUniqueLabel(code)}]`),
  'ishikawa-beta': ({ code, label }) =>
    insertNearLabelLine(code, label, getUniqueLabel(code), { asChild: true }),
  'treeview-beta': ({ code, label }) =>
    insertNearLabelLine(code, label, `"${getUniqueLabel(code)}"`, { asChild: true }),
  'xychart-beta': addXYDimension,
  'sankey-beta': ({ code, label }) => {
    const source = normalizeLabel(label);
    if (!source) return undefined;
    const branchLabel = getUniqueLabel(code);
    const escapeCsv = (value: string) => value.replaceAll('"', '""');
    return `${code.trimEnd()}\n"${escapeCsv(source)}","${escapeCsv(branchLabel)}",1\n`;
  },
  'venn-beta': addVennBranch,
  'wardley-beta': addWardleyBranch,
  'radar-beta': addRadarDimension,
  requirementdiagram: addRequirementBranch,
  'architecture-beta': addArchitectureBranch,
  gitgraph: addGitBranch,
  erdiagram: addERBranch,
  zenuml: addZenUMLBranch
};

export const createDiagramBranch = ({
  code,
  label = '',
  mode = 'branch',
  sourceId = ''
}: DiagramBranchRequest): DiagramBranchResult | undefined => {
  const keyword = getDiagramKeyword(code);
  const strategy = keyword.startsWith('c4') ? addC4Branch : strategies[keyword];
  const nextCode = strategy?.({ code, label, mode, sourceId });
  if (!nextCode || nextCode === code) return undefined;
  const result: DiagramBranchResult = {
    code: nextCode,
    optimizeFlowchart: ['flowchart', 'flowchart-elk', 'flowchart-v2', 'graph'].includes(keyword)
  };
  if (keyword === 'pie') {
    const total = [...nextCode.matchAll(/:\s*(-?\d+(?:\.\d+)?)/g)].reduce(
      (sum, match) => sum + Number(match[1]),
      0
    );
    result.notice = `饼图占比由左侧数值决定。你已新增一个分支，请在左侧数据面板中修改该分支的数值。当前总数值为：${total}。修改后，饼图会根据各项数值自动重新计算占比。`;
  }
  if (keyword === 'quadrantchart') {
    result.notice =
      '已新增象限图元素。你可以拖动该元素调整它所在的象限位置，也可以在左侧面板修改名称、坐标或相关数据。元素位置会根据坐标或拖动结果同步更新。';
  }
  return result;
};

export const moveTimelinePeriodCode = (
  code: string,
  label: string,
  direction: -1 | 1
): string | undefined => {
  if (getDiagramKeyword(code) !== 'timeline') return undefined;
  const lines = code.trimEnd().split('\n');
  const periods = lines
    .map((line, index) => {
      const trimmed = line.trimStart();
      const colonIndex = trimmed.indexOf(':');
      const period = colonIndex > 0 ? trimmed.slice(0, colonIndex).trim() : '';
      return { index, period };
    })
    .filter(({ period }) => period && !/^(?:title|accTitle|accDescr)\b/i.test(period));
  const current = periods.findIndex(
    ({ period }) => normalizeLabel(period) === normalizeLabel(label)
  );
  const target = current + direction;
  if (current < 0 || target < 0 || target >= periods.length) return undefined;
  const blocks = periods.map(({ index }, position) =>
    lines.slice(index, periods[position + 1]?.index ?? lines.length)
  );
  [blocks[current], blocks[target]] = [blocks[target], blocks[current]];
  const prefix = lines.slice(0, periods[0].index);
  return `${[...prefix, ...blocks.flat()].join('\n')}\n`;
};

const moveLineByLabel = (code: string, sourceLabel: string, targetLabel: string) => {
  const lines = code.trimEnd().split('\n');
  const source = findLineIndexByLabel(lines, sourceLabel);
  const target = findLineIndexByLabel(lines, targetLabel);
  if (source < 0 || target < 0 || source === target) return undefined;
  const [line] = lines.splice(source, 1);
  lines.splice(source < target ? target - 1 : target, 0, line);
  return `${lines.join('\n')}\n`;
};

const getRequirementBlockRange = (lines: string[], label: string) => {
  const wanted = normalizeLabel(label).replace(/^(?:Text|ID):\s*/i, '');
  for (let start = 0; start < lines.length; start += 1) {
    const declaration = lines[start].match(
      /^\s*(?:requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+([\w-]+)\s*\{/i
    );
    if (!declaration) continue;
    let end = start + 1;
    while (end < lines.length && !/^\s*\}\s*$/.test(lines[end])) end += 1;
    const block = lines.slice(start, end + 1).join('\n');
    const text = block.match(/^\s*text\s*:\s*"?([^"\n]+)"?/im)?.[1];
    const visibleId = block.match(/^\s*id\s*:\s*"?([^"\n]+)"?/im)?.[1];
    if ([declaration[1], text, visibleId].some((value) => normalizeLabel(value) === wanted)) {
      return { end, start };
    }
  }
  return undefined;
};

export const moveDiagramElementCode = (
  code: string,
  sourceLabel: string,
  targetLabel: string
): string | undefined => {
  const keyword = getDiagramKeyword(code);
  if (normalizeLabel(sourceLabel) === normalizeLabel(targetLabel)) return undefined;
  if (keyword === 'block-beta') return moveLineByLabel(code, sourceLabel, targetLabel);
  if (keyword === 'gantt') {
    const lines = code.trimEnd().split('\n');
    const sourceSection = lines.findIndex(
      (line) => normalizeLabel(line.replace(/^\s*section\s+/i, '')) === normalizeLabel(sourceLabel)
    );
    const targetSection = lines.findIndex(
      (line) => normalizeLabel(line.replace(/^\s*section\s+/i, '')) === normalizeLabel(targetLabel)
    );
    if (sourceSection >= 0 && targetSection >= 0) {
      const nextSource = lines.findIndex(
        (line, index) => index > sourceSection && /^\s*section\s+/i.test(line)
      );
      const sourceEnd = nextSource >= 0 ? nextSource : lines.length;
      const block = lines.splice(sourceSection, sourceEnd - sourceSection);
      const adjustedTarget = lines.findIndex(
        (line) =>
          normalizeLabel(line.replace(/^\s*section\s+/i, '')) === normalizeLabel(targetLabel)
      );
      lines.splice(adjustedTarget, 0, ...block);
      return `${lines.join('\n')}\n`;
    }
    return moveLineByLabel(code, sourceLabel, targetLabel);
  }
  if (keyword === 'requirementdiagram') {
    const lines = code.trimEnd().split('\n');
    const source = getRequirementBlockRange(lines, sourceLabel);
    const target = getRequirementBlockRange(lines, targetLabel);
    if (!source || !target) return undefined;
    const block = lines.splice(source.start, source.end - source.start + 1);
    const adjustedTarget = getRequirementBlockRange(lines, targetLabel);
    if (!adjustedTarget) return undefined;
    lines.splice(adjustedTarget.start, 0, ...block, '');
    return `${lines.join('\n')}\n`;
  }
  if (keyword === 'architecture-beta') return moveLineByLabel(code, sourceLabel, targetLabel);
  return undefined;
};

export const createDiagramBranchCode = (request: DiagramBranchRequest): string | undefined =>
  createDiagramBranch(request)?.code;
