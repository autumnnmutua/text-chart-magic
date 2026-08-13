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

export interface XYAxisTitle {
  label: string;
  unit: string;
}

export interface XYChartModel {
  series: XYSeries[];
  xAxis: XYAxisTitle;
  xLabels: string[];
  yAxis: XYAxisTitle & {
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
const xAxisPattern =
  /^([ \t]*x-axis)(?:\s+(?:"([^"]*)"|'([^']*)'|([^\n[]+?)))?\s*\[([^\]]*)\]([ \t]*)$/im;
const yAxisPattern = new RegExp(
  String.raw`^([ \t]*y-axis\s+)(?:(?:"([^"]*)"|'([^']*)'|(.+?))\s+)?(${numberPattern})\s*-->\s*(${numberPattern})([ \t]*)$`,
  'im'
);
const unitSuffixPattern = /^(.*?)\s*[（(]\s*单位\s*[：:]\s*(.*?)\s*[）)]\s*$/;

const isXYChart = (code: string): boolean => /^\s*xychart-beta\b/im.test(code);

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

const parseAxisTitle = (value: string | undefined, fallback: string): XYAxisTitle => {
  const title = stripQuotes(value) || fallback;
  const unitMatch = title.match(unitSuffixPattern);
  if (!unitMatch) return { label: title, unit: '' };
  return {
    label: unitMatch[1].trim() || fallback,
    unit: unitMatch[2].trim()
  };
};

const formatAxisTitle = ({ label, unit }: XYAxisTitle): string => {
  const normalizedLabel = label.trim();
  const normalizedUnit = unit.trim();
  return normalizedUnit ? `${normalizedLabel}（单位：${normalizedUnit}）` : normalizedLabel;
};

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

const formatXAxis = (
  prefix: string,
  axis: XYAxisTitle,
  labels: readonly string[],
  suffix = ''
): string =>
  `${prefix} ${quoteLabel(formatAxisTitle(axis))} [${labels.map(quoteLabel).join(', ')}]${suffix}`;

const replaceRange = (code: string, start: number, end: number, value: string): string =>
  `${code.slice(0, start)}${value}${code.slice(end)}`;

const replaceRanges = (
  code: string,
  replacements: readonly { end: number; start: number; value: string }[]
): string =>
  [...replacements]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, replacement) =>
        replaceRange(current, replacement.start, replacement.end, replacement.value),
      code
    );

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
  while (used.has(`新数据系列 ${index}`.toLocaleLowerCase())) index += 1;
  return `新数据系列 ${index}`;
};

const uniqueCategoryLabel = (model: XYChartModel): string => {
  const used = new Set(model.xLabels.map((label) => label.trim().toLocaleLowerCase()));
  let index = 1;
  while (used.has(`新分类 ${index}`.toLocaleLowerCase())) index += 1;
  return `新分类 ${index}`;
};

const getXAxisMatch = (code: string): RegExpExecArray | null => xAxisPattern.exec(code);

const replaceXAxis = (
  code: string,
  model: XYChartModel,
  axis: XYAxisTitle,
  labels: readonly string[]
): string | undefined => {
  if (!axis.label.trim() || labels.length === 0 || labels.some((label) => !label.trim())) {
    return undefined;
  }
  const match = getXAxisMatch(code);
  const line = formatXAxis(match?.[1] ?? '  x-axis', axis, labels, match?.[6] ?? '');
  if (match) return replaceRange(code, match.index, match.index + match[0].length, line);
  const yAxis = yAxisPattern.exec(code);
  const insertionPoint = yAxis?.index ?? model.series[0]?.start ?? code.length;
  return `${code.slice(0, insertionPoint)}${line}\n${code.slice(insertionPoint)}`;
};

const replaceSeriesValues = (
  code: string,
  model: XYChartModel,
  transform: (values: readonly number[], series: XYSeries) => number[]
): string =>
  replaceRanges(
    code,
    model.series.map((series) => ({
      end: series.end,
      start: series.start,
      value: formatSeries(
        series.raw.match(/^[ \t]*/)?.[0] ?? '',
        series.type,
        series.label,
        transform(series.values, series),
        series.raw.match(/[ \t]*$/)?.[0] ?? ''
      )
    }))
  );

export const parseXYChart = (code: string): XYChartModel | undefined => {
  if (!isXYChart(code)) return undefined;

  const xAxis = getXAxisMatch(code);
  const yAxis = yAxisPattern.exec(code);
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
    xAxis: parseAxisTitle(xAxis?.[2] ?? xAxis?.[3] ?? xAxis?.[4], '横坐标'),
    xLabels: xAxis ? parseTextList(xAxis[5]) : [],
    yAxis: {
      ...parseAxisTitle(yAxis?.[2] ?? yAxis?.[3] ?? yAxis?.[4], '纵坐标'),
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
    nextValues.some((value) => !Number.isFinite(value)) ||
    (model.xLabels.length > 0 && nextValues.length !== model.xLabels.length)
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

export const updateXYValue = (
  code: string,
  seriesIndex: number,
  categoryIndex: number,
  value: number
): string | undefined => {
  if (!Number.isFinite(value)) return undefined;
  const model = parseXYChart(code);
  const series = model?.series[seriesIndex];
  if (!model || !series || categoryIndex < 0 || categoryIndex >= model.xLabels.length) {
    return undefined;
  }
  const values = Array.from(
    { length: model.xLabels.length },
    (_, index) => series.values[index] ?? 0
  );
  values[categoryIndex] = value;
  return updateXYSeries(code, seriesIndex, { values });
};

export const removeXYSeries = (code: string, index: number): string | undefined => {
  const model = parseXYChart(code);
  if (!model) return undefined;
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

export const updateXYXAxis = (code: string, update: Partial<XYAxisTitle>): string | undefined => {
  const model = parseXYChart(code);
  if (!model) return undefined;
  return replaceXAxis(
    code,
    model,
    {
      label: (update.label ?? model.xAxis.label).trim(),
      unit: (update.unit ?? model.xAxis.unit).trim()
    },
    model.xLabels
  );
};

export const updateXYAxis = (
  code: string,
  update: Partial<XYChartModel['yAxis']>
): string | undefined => {
  const model = parseXYChart(code);
  if (!model) return undefined;
  const axisTitle = {
    label: (update.label ?? model.yAxis.label).trim(),
    unit: (update.unit ?? model.yAxis.unit).trim()
  };
  const min = update.min ?? model.yAxis.min;
  const max = update.max ?? model.yAxis.max;
  if (!axisTitle.label || !Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return undefined;
  }
  const axis = yAxisPattern.exec(code);
  const line = `${axis?.[1] ?? '  y-axis '}${quoteLabel(formatAxisTitle(axisTitle))} ${formatNumber(min)} --> ${formatNumber(max)}${axis?.[7] ?? ''}`;
  if (axis) return replaceRange(code, axis.index, axis.index + axis[0].length, line);
  const firstSeries = model.series[0];
  if (firstSeries)
    return `${code.slice(0, firstSeries.start)}${line}\n${code.slice(firstSeries.start)}`;
  return `${code.trimEnd()}\n${line}\n`;
};

export const updateXYCategory = (
  code: string,
  index: number,
  label: string
): string | undefined => {
  const model = parseXYChart(code);
  if (!model || !model.xLabels[index] || !label.trim()) return undefined;
  const labels = [...model.xLabels];
  labels[index] = label.trim();
  return replaceXAxis(code, model, model.xAxis, labels);
};

export const addXYCategory = (code: string): string | undefined => {
  const model = parseXYChart(code);
  if (!model) return undefined;
  const labels = [...model.xLabels, uniqueCategoryLabel(model)];
  const withValues = replaceSeriesValues(code, model, (values) => [...values, 0]);
  const nextModel = parseXYChart(withValues);
  return nextModel ? replaceXAxis(withValues, nextModel, model.xAxis, labels) : undefined;
};

export const removeXYCategory = (code: string, index: number): string | undefined => {
  const model = parseXYChart(code);
  if (!model || model.xLabels.length <= 1 || !model.xLabels[index]) return undefined;
  const labels = model.xLabels.filter((_, categoryIndex) => categoryIndex !== index);
  const withValues = replaceSeriesValues(code, model, (values) =>
    values.filter((_, categoryIndex) => categoryIndex !== index)
  );
  const nextModel = parseXYChart(withValues);
  return nextModel ? replaceXAxis(withValues, nextModel, model.xAxis, labels) : undefined;
};

export const moveXYCategory = (
  code: string,
  index: number,
  direction: -1 | 1
): string | undefined => {
  const model = parseXYChart(code);
  const targetIndex = index + direction;
  if (!model || !model.xLabels[index] || !model.xLabels[targetIndex]) return undefined;
  const labels = [...model.xLabels];
  [labels[index], labels[targetIndex]] = [labels[targetIndex], labels[index]];
  const withValues = replaceSeriesValues(code, model, (values) => {
    const reordered = Array.from({ length: model.xLabels.length }, (_, valueIndex) =>
      values[valueIndex] === undefined ? 0 : values[valueIndex]
    );
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    return reordered;
  });
  const nextModel = parseXYChart(withValues);
  return nextModel ? replaceXAxis(withValues, nextModel, model.xAxis, labels) : undefined;
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
