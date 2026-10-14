export type XYSeriesType = 'bar' | 'line';

export interface XYSeries {
  end: number;
  index: number;
  label: string;
  raw: string;
  start: number;
  type: XYSeriesType;
  values: number[];
}

export interface XYChartModel {
  series: XYSeries[];
  xLabels: string[];
  yAxis: {
    label: string;
    max: number;
    min: number;
  };
}

export interface XYSeriesUpdate {
  label?: string;
  type?: XYSeriesType;
  values?: number[];
}

const numberPattern = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)`;
const seriesPattern = /^([ \t]*)(bar|line)(?:\s+(.+?))?\s*\[([^\]]*)\]([ \t]*)$/gim;
const yAxisPattern = new RegExp(
  String.raw`^([ \t]*y-axis\s+)(?:(?:"([^"]*)"|'([^']*)'|(.+?))\s+)?(${numberPattern})\s*-->\s*(${numberPattern})([ \t]*)$`,
  'im'
);

// `x-axis [a, b]` and the titled form `x-axis "月份" [a, b]` are both valid Mermaid.
const xAxisListPattern =
  /^([ \t]*x-axis\b(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|[^\s[\n]+))?[ \t]*\[)([^\]\n]*)(\])/im;

const yAxisTitlePattern = /^[ \t]*y-axis[ \t]+(?:"([^"\n]*)"|'([^'\n]*)'|([^\n]*?))[ \t]*$/im;

const isXYChart = (code: string): boolean => /^\s*xychart(?:-beta)?\b/im.test(code);

const stripQuotes = (value = ''): string => {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const quoteLabel = (value: string): string =>
  `"${value.trim().replaceAll('"', '”').slice(0, 120)}"`;

const parseNumberList = (value: string): number[] =>
  value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

const parseTextList = (value: string): string[] => {
  const result: string[] = [];
  let current = '';
  let quote = '';
  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === ',') {
      const item = stripQuotes(current);
      if (item) result.push(item);
      current = '';
      continue;
    }
    current += character;
  }
  const item = stripQuotes(current);
  if (item) result.push(item);
  return result;
};

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const normalized = Object.is(value, -0) ? 0 : value;
  return Number.isInteger(normalized) ? String(normalized) : String(Number(normalized.toFixed(6)));
};

const formatSeries = (
  indent: string,
  type: XYSeriesType,
  label: string,
  values: readonly number[],
  suffix = ''
): string =>
  `${indent}${type}${label.trim() ? ` ${quoteLabel(label)}` : ''} [${values
    .map(formatNumber)
    .join(', ')}]${suffix}`;

const replaceRange = (code: string, start: number, end: number, value: string): string =>
  `${code.slice(0, start)}${value}${code.slice(end)}`;

const removeLineRange = (code: string, start: number, end: number): string => {
  let nextEnd = end;
  if (code[nextEnd] === '\r') nextEnd += 1;
  if (code[nextEnd] === '\n') nextEnd += 1;
  if (nextEnd === end && start > 0 && code[start - 1] === '\n') start -= 1;
  return `${code.slice(0, start)}${code.slice(nextEnd)}`;
};

const uniqueSeriesLabel = (model: XYChartModel): string => {
  const used = new Set(model.series.map(({ label }) => label.trim().toLocaleLowerCase()));
  let index = 1;
  while (used.has(`新纵坐标 ${index}`.toLocaleLowerCase())) index += 1;
  return `新纵坐标 ${index}`;
};

export const parseXYChart = (code: string): XYChartModel | undefined => {
  if (!isXYChart(code)) return undefined;

  const xAxis = xAxisListPattern.exec(code);
  const yAxis = yAxisPattern.exec(code);
  const yAxisTitle = yAxis ? undefined : yAxisTitlePattern.exec(code);
  const series: XYSeries[] = [];
  let barIndex = 0;
  let lineIndex = 0;

  for (const match of code.matchAll(seriesPattern)) {
    if (match.index === undefined) continue;
    const type = match[2].toLocaleLowerCase() as XYSeriesType;
    const typeIndex = type === 'bar' ? ++barIndex : ++lineIndex;
    const explicitLabel = stripQuotes(match[3]);
    series.push({
      end: match.index + match[0].length,
      index: series.length,
      label: explicitLabel || `${type === 'bar' ? '柱状' : '折线'}系列 ${typeIndex}`,
      raw: match[0],
      start: match.index,
      type,
      values: parseNumberList(match[4])
    });
  }

  const min = Number(yAxis?.[5] ?? 0);
  const max = Number(yAxis?.[6] ?? 100);
  return {
    series,
    xLabels: xAxis ? parseTextList(xAxis[2]) : [],
    yAxis: {
      label: (
        yAxis?.[2] ??
        yAxis?.[3] ??
        yAxis?.[4] ??
        yAxisTitle?.[1] ??
        yAxisTitle?.[2] ??
        (yAxisTitle?.[3] || '纵坐标')
      ).trim(),
      max: Number.isFinite(max) ? max : 100,
      min: Number.isFinite(min) ? min : 0
    }
  };
};

export const addXYSeries = (code: string, type: XYSeriesType = 'line'): string | undefined => {
  const model = parseXYChart(code);
  if (!model) return undefined;
  const count = Math.max(
    model.xLabels.length,
    ...model.series.map(({ values }) => values.length),
    1
  );
  const indent = model.series.at(-1)?.raw.match(/^[ \t]*/)?.[0] ?? '  ';
  const line = formatSeries(indent, type, uniqueSeriesLabel(model), Array(count).fill(0));
  const lastSeries = model.series.at(-1);
  if (!lastSeries) return `${code.trimEnd()}\n${line}\n`;
  return `${code.slice(0, lastSeries.end)}\n${line}${code.slice(lastSeries.end)}`;
};

export const updateXYSeries = (
  code: string,
  index: number,
  update: XYSeriesUpdate
): string | undefined => {
  const model = parseXYChart(code);
  const series = model?.series[index];
  if (!model || !series) return undefined;
  const nextType = update.type ?? series.type;
  const nextLabel = (update.label ?? series.label).trim();
  const nextValues = update.values ?? series.values;
  if (
    !nextLabel ||
    nextValues.length === 0 ||
    nextValues.some((value) => !Number.isFinite(value))
  ) {
    return undefined;
  }
  const indent = series.raw.match(/^[ \t]*/)?.[0] ?? '';
  const suffix = series.raw.match(/[ \t]*$/)?.[0] ?? '';
  return replaceRange(
    code,
    series.start,
    series.end,
    formatSeries(indent, nextType, nextLabel, nextValues, suffix)
  );
};

export const removeXYSeries = (code: string, index: number): string | undefined => {
  const model = parseXYChart(code);
  if (!model || model.series.length <= 1) return undefined;
  const series = model.series[index];
  return series ? removeLineRange(code, series.start, series.end) : undefined;
};

export const moveXYSeries = (
  code: string,
  index: number,
  direction: -1 | 1
): string | undefined => {
  const model = parseXYChart(code);
  const targetIndex = index + direction;
  if (!model || !model.series[index] || !model.series[targetIndex]) return undefined;
  const reordered = model.series.map(({ raw }) => raw);
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  let cursor = 0;
  let nextCode = '';
  for (const [seriesIndex, series] of model.series.entries()) {
    nextCode += code.slice(cursor, series.start);
    nextCode += reordered[seriesIndex];
    cursor = series.end;
  }
  return `${nextCode}${code.slice(cursor)}`;
};

export const updateXYAxis = (
  code: string,
  update: Partial<XYChartModel['yAxis']>
): string | undefined => {
  const model = parseXYChart(code);
  if (!model) return undefined;
  const label = (update.label ?? model.yAxis.label).trim();
  const min = update.min ?? model.yAxis.min;
  const max = update.max ?? model.yAxis.max;
  if (!label || !Number.isFinite(min) || !Number.isFinite(max) || min >= max) return undefined;
  const axis = yAxisPattern.exec(code);
  const line = `${axis?.[1] ?? '  y-axis '}${quoteLabel(label)} ${formatNumber(min)} --> ${formatNumber(max)}${axis?.[7] ?? ''}`;
  if (axis) return replaceRange(code, axis.index, axis.index + axis[0].length, line);
  // A title-only `y-axis "名称"` line is replaced instead of adding a second y-axis.
  const titleOnly = yAxisTitlePattern.exec(code);
  if (titleOnly) {
    const indent = /^[ \t]*/.exec(titleOnly[0])?.[0] ?? '  ';
    return replaceRange(
      code,
      titleOnly.index,
      titleOnly.index + titleOnly[0].length,
      `${indent}y-axis ${quoteLabel(label)} ${formatNumber(min)} --> ${formatNumber(max)}`
    );
  }
  const firstSeries = model.series[0];
  if (firstSeries)
    return `${code.slice(0, firstSeries.start)}${line}\n${code.slice(firstSeries.start)}`;
  return `${code.trimEnd()}\n${line}\n`;
};

export const parseXYSeriesValues = (value: string, expectedCount = 0): number[] | undefined => {
  const parts = value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  const values = parts.map(Number);
  if (values.some((item) => !Number.isFinite(item))) return undefined;
  if (expectedCount > 0 && values.length !== expectedCount) return undefined;
  return values;
};

const splitListEntries = (value: string): string[] => {
  const entries: string[] = [];
  let current = '';
  let quote = '';
  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    if (character === ',') {
      entries.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (current.trim() || entries.length > 0) entries.push(current.trim());
  return entries.filter(Boolean);
};

/**
 * Rewrites the value list of every bar/line series, including titled series
 * such as `bar "实际订单" [1, 2]`, which the old `^(bar|line)\s*\[` patterns missed.
 */
const mapXYSeriesValues = (
  code: string,
  transform: (values: string[], series: XYSeries) => string[]
): string => {
  const model = parseXYChart(code);
  if (!model) return code;
  let cursor = 0;
  let nextCode = '';
  for (const series of model.series) {
    const open = series.raw.lastIndexOf('[');
    const close = series.raw.lastIndexOf(']');
    if (open < 0 || close < open) continue;
    const values = splitListEntries(series.raw.slice(open + 1, close));
    const nextRaw = `${series.raw.slice(0, open + 1)}${transform(values, series).join(', ')}${series.raw.slice(close)}`;
    nextCode += code.slice(cursor, series.start) + nextRaw;
    cursor = series.end;
  }
  return nextCode + code.slice(cursor);
};

/** Appends a horizontal category and keeps every series the same length. */
export const addXYCategory = (code: string, label: string): string | undefined => {
  const model = parseXYChart(code);
  if (!model) return undefined;
  const quoted = quoteLabel(label);
  const axis = xAxisListPattern.exec(code);
  let nextCode: string;
  if (axis) {
    const entries = splitListEntries(axis[2]);
    nextCode = `${code.slice(0, axis.index)}${axis[1]}${[...entries, quoted].join(', ')}${axis[3]}${code.slice(axis.index + axis[0].length)}`;
  } else if (/^\s*x-axis\b/im.test(code)) {
    // Numeric x-axis (`x-axis 0 --> 10`): the series simply gains one more point.
    nextCode = code;
  } else {
    const count = Math.max(0, ...model.series.map(({ values }) => values.length));
    const labels = Array.from({ length: count }, (_value, index) => `"${index + 1}"`);
    const line = `  x-axis [${[...labels, quoted].join(', ')}]`;
    const firstSeries = model.series[0];
    nextCode = firstSeries
      ? `${code.slice(0, firstSeries.start)}${line}\n${code.slice(firstSeries.start)}`
      : `${code.trimEnd()}\n${line}\n`;
  }
  return mapXYSeriesValues(nextCode, (values) => [...values, '0']);
};

/** Removes one horizontal category together with the matching value in every series. */
export const removeXYCategory = (code: string, label: string): string | undefined => {
  const axis = xAxisListPattern.exec(code);
  if (!axis) return undefined;
  const entries = splitListEntries(axis[2]);
  const wanted = label.replace(/\s+/g, ' ').trim();
  const index = entries.findIndex(
    (entry) => stripQuotes(entry).replace(/\s+/g, ' ').trim() === wanted
  );
  if (index < 0 || entries.length <= 1) return undefined;
  const nextEntries = entries.filter((_entry, entryIndex) => entryIndex !== index);
  const nextCode = `${code.slice(0, axis.index)}${axis[1]}${nextEntries.join(', ')}${axis[3]}${code.slice(axis.index + axis[0].length)}`;
  return mapXYSeriesValues(nextCode, (values) =>
    values.filter((_value, valueIndex) => valueIndex !== index)
  );
};
