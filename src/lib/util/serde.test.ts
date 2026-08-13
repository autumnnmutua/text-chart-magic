import { describe, expect, it } from 'vitest';
import { serializeState, deserializeState, type SerdeType } from './serde';
import { defaultState } from './state.svelte';
import type { State } from '$lib/types';

const verifySerde = (state: State, serde?: SerdeType): string => {
  const serialized = serializeState(state, serde);
  const deserialized = deserializeState(serialized);
  expect(deserialized).to.deep.equal(state);
  return serialized;
};

describe('Serde tests', () => {
  it('should serialize and deserialize with default serde', () => {
    expect(verifySerde(defaultState)).toMatch(/^pako:/);
  });

  it('should serialize and deserialize with base64 serde', () => {
    expect(verifySerde(defaultState, 'base64')).toMatch(/^base64:/);
  });

  it('should serialize and deserialize with pako serde', () => {
    expect(verifySerde(defaultState, 'pako')).toMatch(/^pako:/);
  });

  it('should throw error for unrecognized serde', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(() => serializeState(defaultState, 'unknown')).toThrowError(
      'Unknown serde type: unknown'
    );
    expect(() => deserializeState('unknown:hello')).toThrowError('Unknown serde type: unknown');
  });

  it('rejects oversized shared-state input before decoding it', () => {
    expect(() => deserializeState(`pako:${'a'.repeat(1_000_001)}`)).toThrow('链接中的图表数据过大');
  });

  it('rejects states whose uncompressed JSON exceeds the document limit', () => {
    expect(() =>
      serializeState({
        ...defaultState,
        code: 'x'.repeat(4 * 1024 * 1024)
      })
    ).toThrow('图表状态超过 4 MB');
  });
});
