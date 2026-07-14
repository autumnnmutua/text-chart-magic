import { describe, expect, it } from 'vitest';
import {
  createArchitectureGroup,
  parseArchitectureGroups,
  removeArchitectureGroupCode,
  resizeArchitectureGroup,
  upsertArchitectureGroupCode
} from './architectureGroups';

describe('architectureGroups', () => {
  it('round-trips a group through Mermaid-safe metadata', () => {
    const initial = 'architecture-beta\n  service api(server)[API]\n';
    const group = createArchitectureGroup(initial);
    const code = upsertArchitectureGroupCode(initial, { ...group, memberIds: ['api'] });
    expect(parseArchitectureGroups(code)).toEqual([{ ...group, memberIds: ['api'] }]);
    expect(removeArchitectureGroupCode(code, group.id)).toBe(initial);
  });

  it('resizes all edges while respecting the minimum size', () => {
    const group = createArchitectureGroup('architecture-beta');
    expect(resizeArchitectureGroup(group, 'bottom-right', { x: 40, y: 20 })).toMatchObject({
      height: 200,
      width: 360
    });
    expect(resizeArchitectureGroup(group, 'top-left', { x: 999, y: 999 })).toMatchObject({
      height: 96,
      width: 160,
      x: group.x + 160,
      y: group.y + 84
    });
  });

  it('clamps malformed legacy metadata to safe canvas limits', () => {
    const code = `architecture-beta
%% architecture-group {"id":"architecture-group-1","label":"旧分组","width":999999,"height":-2,"x":999999,"y":-999999,"memberIds":[],"moveMembers":true}`;
    expect(parseArchitectureGroups(code)[0]).toMatchObject({
      height: 96,
      width: 5_000,
      x: 10_000,
      y: -10_000
    });
  });
});
