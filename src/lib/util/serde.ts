import type { State } from '$lib/types';
import { fromBase64, fromUint8Array, toBase64, toUint8Array } from 'js-base64';
import { deflate, inflate } from 'pako';
import {
  MAX_SERIALIZED_STATE_CHARACTERS,
  MAX_STATE_JSON_BYTES,
  utf8ByteLength
} from './documentSchema';

interface Serde {
  serialize: (state: string) => string;
  deserialize: (state: string) => string;
}

const base64Serde: Serde = {
  serialize: (state: string): string => {
    return toBase64(state, true);
  },
  deserialize: (state: string): string => {
    return fromBase64(state);
  }
};

export const pakoSerde: Serde = {
  serialize: (state: string): string => {
    const data = new TextEncoder().encode(state);
    const compressed = deflate(data, { level: 9 });
    return fromUint8Array(compressed, true);
  },
  deserialize: (state: string): string => {
    const data = toUint8Array(state);
    return inflate(data, { to: 'string' });
  }
};

export type SerdeType = 'base64' | 'pako';

const serdes: Record<SerdeType, Serde> = {
  base64: base64Serde,
  pako: pakoSerde
};

const assertSerializedSize = (value: string): void => {
  if (value.length > MAX_SERIALIZED_STATE_CHARACTERS) {
    throw new Error('链接中的图表数据过大');
  }
};

const assertJSONSize = (value: string): void => {
  if (utf8ByteLength(value) > MAX_STATE_JSON_BYTES) {
    throw new Error('图表状态超过 4 MB');
  }
};

export const serializeState = (state: State, serde: SerdeType = 'pako'): string => {
  if (!(serde in serdes)) {
    throw new Error(`Unknown serde type: ${serde}`);
  }
  const json = JSON.stringify(state);
  assertJSONSize(json);
  const serialized = serdes[serde].serialize(json);
  assertSerializedSize(serialized);
  return `${serde}:${serialized}`;
};

export const deserializeState = (state: string): State => {
  assertSerializedSize(state);
  let type: SerdeType, serialized: string;
  const separator = state.indexOf(':');
  if (separator >= 0) {
    const tempType = state.slice(0, separator);
    serialized = state.slice(separator + 1);
    if (tempType in serdes) {
      type = tempType as SerdeType;
    } else {
      throw new Error(`Unknown serde type: ${tempType}`);
    }
  } else {
    type = 'base64';
    serialized = state;
  }
  assertSerializedSize(serialized);
  const json = serdes[type].deserialize(serialized);
  assertJSONSize(json);
  return JSON.parse(json) as State;
};
