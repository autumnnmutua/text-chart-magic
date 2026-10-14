import { describe, expect, it } from 'vitest';
import { removeDiagramElementCode } from './visualTextEdit';
import { repairGanttDependencies } from './ganttDependencies';
import { parse } from './mermaid';

const plan = `gantt
  title 产品发布计划
  dateFormat YYYY-MM-DD
  axisFormat %m-%d

  section 需求与设计
  用户调研 :done, research, 2026-07-01, 3d
  需求确认 :milestone, confirm, after research, 0d
  交互设计 :active, design, after confirm, 4d

  section 开发与联调
  核心开发 :develop, after design, 6d
  接口联调 :integration, after develop, 3d

  section 测试与发布
  验收测试 :crit, test, after integration, 3d
  正式发布 :milestone, release, after test, 0d
`;

describe('gantt dependency repair', () => {
  it('re-points dependants to the start of a deleted task', async () => {
    const next = removeDiagramElementCode(plan, { text: '接口联调' }) ?? '';
    expect(next).not.toContain('接口联调');
    expect(next).not.toContain('integration');
    expect(next).toContain('验收测试 :crit, test, after develop, 3d');
    await expect(parse(next)).resolves.toBeDefined();
  });

  it('resolves chains when a whole section of dependencies is deleted', async () => {
    const next = removeDiagramElementCode(plan, { text: '开发与联调' }) ?? '';
    expect(next).not.toContain('核心开发');
    expect(next).toContain('验收测试 :crit, test, after design, 3d');
    await expect(parse(next)).resolves.toBeDefined();
  });

  it('falls back to the deleted task date when nothing else remains', () => {
    const code = `gantt
  dateFormat YYYY-MM-DD
  起步 :a, 2026-01-05, 2d
  后续 :b, after a, 1d`;
    const next = repairGanttDependencies(code, code.replace('  起步 :a, 2026-01-05, 2d\n', ''));
    expect(next).toContain('后续 :b, 2026-01-05, 1d');
  });

  it('keeps other ids of a multi-dependency start', () => {
    const code = `gantt
  dateFormat YYYY-MM-DD
  甲 :a, 2026-01-05, 2d
  乙 :b, 2026-01-06, 2d
  丙 :c, after a b, 1d`;
    const next = repairGanttDependencies(code, code.replace('  乙 :b, 2026-01-06, 2d\n', ''));
    expect(next).toContain('丙 :c, after a, 1d');
  });
});
