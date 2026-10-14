/**
 * Keeps Mermaid Gantt schedules valid after tasks are deleted.
 *
 * A task such as `验收测试 :crit, test, after integration, 3d` only has a start
 * date while `integration` exists. Deleting the referenced task used to leave
 * a dangling `after` reference, which Mermaid renders as NaN bars and shifts
 * every following task. The repair below re-points dependants to the start of
 * the task that was removed, so the rest of the plan keeps its position.
 */

const TASK_TAGS = new Set(['active', 'crit', 'done', 'milestone']);
const NON_TASK_LINE =
  /^\s*(?:gantt|title|dateformat|axisformat|tickinterval|excludes|includes|todaymarker|weekday|weekend|section|displaymode|click|acctitle|accdescr|inclusiveenddates|topaxis|%%)\b/i;

interface GanttTask {
  id?: string;
  /** The raw start item: a date, `after a b`, or undefined when implicit. */
  start?: string;
}

interface TaskLine {
  items: string[];
  lineIndex: number;
  metaStart: number;
  startIndex: number;
  task: GanttTask;
}

const parseTaskLine = (line: string, lineIndex: number): TaskLine | undefined => {
  if (!line.trim() || NON_TASK_LINE.test(line)) return undefined;
  const colon = line.indexOf(':');
  if (colon <= 0) return undefined;
  const items = line
    .slice(colon + 1)
    .split(',')
    .map((item) => item.trim());
  let firstData = 0;
  while (firstData < items.length && TASK_TAGS.has(items[firstData].toLowerCase())) firstData += 1;
  const data = items.slice(firstData);
  if (data.length === 0 || data.every((item) => !item)) return undefined;
  if (data.length === 1) {
    return { items, lineIndex, metaStart: colon + 1, startIndex: -1, task: {} };
  }
  if (data.length === 2) {
    return {
      items,
      lineIndex,
      metaStart: colon + 1,
      startIndex: firstData,
      task: { start: data[0] }
    };
  }
  return {
    items,
    lineIndex,
    metaStart: colon + 1,
    startIndex: firstData + 1,
    task: { id: data[0], start: data[1] }
  };
};

const collectTasks = (code: string): TaskLine[] =>
  code
    .split('\n')
    .map((line, index) => parseTaskLine(line, index))
    .filter((task): task is TaskLine => task !== undefined);

const afterIds = (start = ''): string[] | undefined => {
  const match = /^after\s+(.+)$/i.exec(start.trim());
  return match ? match[1].split(/\s+/).filter(Boolean) : undefined;
};

/**
 * Returns `nextCode` with every `after <removed id>` reference rewritten to the
 * removed task's own start (recursively, when that start pointed at another
 * removed task). Code that does not reference removed tasks is returned as is.
 */
export const repairGanttDependencies = (previousCode: string, nextCode: string): string => {
  const previousTasks = collectTasks(previousCode);
  const remainingIds = new Set(
    collectTasks(nextCode)
      .map(({ task }) => task.id)
      .filter((id): id is string => Boolean(id))
  );
  const startById = new Map<string, string | undefined>();
  previousTasks.forEach(({ task }, index) => {
    if (!task.id) return;
    let start = task.start;
    if (!start) {
      // Implicit start: the task begins after the previous task in the file.
      const previousId = previousTasks
        .slice(0, index)
        .map(({ task: candidate }) => candidate.id)
        .findLast(Boolean);
      start = previousId ? `after ${previousId}` : undefined;
    }
    startById.set(task.id, start);
  });
  const removed = [...startById.keys()].filter((id) => !remainingIds.has(id));
  if (removed.length === 0) return nextCode;
  const removedSet = new Set(removed);
  const fallbackDate = previousTasks
    .map(({ task }) => task.start)
    .find((start) => start && !afterIds(start));

  const resolve = (ids: string[], seen = new Set<string>()): { date?: string; ids: string[] } => {
    const resolvedIds: string[] = [];
    let date: string | undefined;
    for (const id of ids) {
      if (!removedSet.has(id)) {
        if (!resolvedIds.includes(id)) resolvedIds.push(id);
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      const start = startById.get(id);
      const nested = afterIds(start);
      if (nested) {
        const result = resolve(nested, seen);
        for (const nestedId of result.ids)
          if (!resolvedIds.includes(nestedId)) resolvedIds.push(nestedId);
        date ??= result.date;
      } else if (start) {
        date ??= start;
      }
    }
    return { date, ids: resolvedIds };
  };

  const lines = nextCode.split('\n');
  for (const taskLine of collectTasks(nextCode)) {
    const ids = afterIds(taskLine.task.start);
    if (!ids || !ids.some((id) => removedSet.has(id))) continue;
    const { date, ids: nextIds } = resolve(ids);
    const replacement = nextIds.length > 0 ? `after ${nextIds.join(' ')}` : (date ?? fallbackDate);
    if (!replacement) continue;
    const items = [...taskLine.items];
    items[taskLine.startIndex] = replacement;
    const line = lines[taskLine.lineIndex];
    const leading = /^\s*/.exec(line.slice(taskLine.metaStart))?.[0] ?? '';
    lines[taskLine.lineIndex] = `${line.slice(0, taskLine.metaStart)}${leading}${items.join(', ')}`;
  }
  return lines.join('\n');
};
