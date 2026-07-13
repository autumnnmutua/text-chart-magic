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
    expect(verifySerde(defaultState)).toMatchInlineSnapshot(
      `"pako:eNp1kl1rE0EUhv_KMN4oJJia1jS5EExiKoqlmFLQbC8mu7ObIbszYXajLUmgVEtSa6F-VYsQMVJiL6JgocSmpn8m-5F_4W42oRtt52Jhzvuc95w5eypQZBKGCSir7LlYQNwAy2mBAvfczTn9d-bW4aDbsfbr1otj6_jDKgiH71TNH03r44nT_mY196oged1-_8Vq7Jmf-87X7zf85KQHglRluLFt7RwNujuD7obVOaz5ampkY_fadq9jn-07_TdVkM75hZxXm_bmb_Pta-e8aZ-erwYzzEbd2m0Nur1h61MV3MtZRwf2wZ_h1q6z_WvYeum0G9P4zzOzfup6DnonVZDJLS0ugJsgu7IA_NgIhiGocCLBhMHLOAQ1zDXkXWHFU4WLwQgwASq-vQCpO7VsCYmEKl58PhKaKBzRYkCJRzyhFvLNjALWsBcWoIRlVFZd16C0gjhBeRXrU8XySCwqnJWp5Kdek2U5hqVx6qhJRo0M0oi67hOCIMBHRORMZ7IBnqD7mHihEPC-S25rGUQVkE1dBBeZwUAWUR2kHjycUh5jscx18gyDSXe-prtwWMecyIFGVEJxiqmMjzvFaG4-IgYAd7g0WVSueog31yTjEp4YyPFYdOZ2gChxoiG-7kPBUleRU4yMJWnuf2YZrxlBbjY6MxuJBTgdi4xKl9fNx29FxcvY6creCVAG5gb5F8JSDCH393krI9Cau5slRJ8ypk3W090CpQATMlJ191YuScjAaYIUjsZI7S-QlGPe"`
    );
  });

  it('should serialize and deserialize with base64 serde', () => {
    expect(verifySerde(defaultState, 'base64')).toMatchInlineSnapshot(
      `"base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgQVvovpPlhaXkuK3mlofmg7Pms5VdIC0tPnzlrp7ml7bop6PmnpB8IEIo55Sf5oiQ5Zu-6KGoKVxuICAgIEIgLS0-IEN76YCJ5oup5LiL5LiA5q2lfVxuICAgIEMgLS0-fOe7p-e7ree8lui-kXwgRFvkuK3mlofoioLngrnlkozov57nur9dXG4gICAgQyAtLT585YiH5o2i5Li76aKYfCBFW-apmeeZvemFjeiJsumihOiniF1cbiAgICBDIC0tPnzlr7zlh7rmlofku7Z8IEZbUE5HIC8gU1ZHIOaWh-S7tl1cbiAgIiwiZ3JpZCI6dHJ1ZSwibWVybWFpZCI6IntcbiAgXCJmbG93Y2hhcnRcIjoge1xuICAgIFwibm9kZVNwYWNpbmdcIjogODAsXG4gICAgXCJyYW5rU3BhY2luZ1wiOiA5MFxuICB9LFxuICBcInRoZW1lXCI6IFwiZGVmYXVsdFwiLFxuICBcInRoZW1lVmFyaWFibGVzXCI6IHtcbiAgICBcImJhY2tncm91bmRcIjogXCIjZmZmN2VkXCIsXG4gICAgXCJmb250RmFtaWx5XCI6IFwiXFxcIk1pY3Jvc29mdCBZYUhlaVxcXCIsIFxcXCJQaW5nRmFuZyBTQ1xcXCIsIFxcXCJOb3RvIFNhbnMgQ0pLIFNDXFxcIiwgXFxcIlJlY3Vyc2l2ZSBWYXJpYWJsZVxcXCIsIHNhbnMtc2VyaWZcIixcbiAgICBcImxpbmVDb2xvclwiOiBcIiNlYTU4MGNcIixcbiAgICBcIm1haW5Ca2dcIjogXCIjZmZmN2VkXCIsXG4gICAgXCJub2RlQm9yZGVyXCI6IFwiI2Y5NzMxNlwiLFxuICAgIFwicHJpbWFyeUJvcmRlckNvbG9yXCI6IFwiI2Y5NzMxNlwiLFxuICAgIFwicHJpbWFyeUNvbG9yXCI6IFwiI2ZmZWRkNVwiLFxuICAgIFwicHJpbWFyeVRleHRDb2xvclwiOiBcIiM0MzE0MDdcIixcbiAgICBcInNlY29uZGFyeUJvcmRlckNvbG9yXCI6IFwiI2ZiOTIzY1wiLFxuICAgIFwic2Vjb25kYXJ5Q29sb3JcIjogXCIjZmZmZmZmXCIsXG4gICAgXCJ0ZXJ0aWFyeUNvbG9yXCI6IFwiI2ZlZDdhYVwiXG4gIH1cbn0iLCJwYW5ab29tIjp0cnVlLCJyb3VnaCI6ZmFsc2UsInVwZGF0ZURpYWdyYW0iOnRydWV9"`
    );
  });

  it('should serialize and deserialize with pako serde', () => {
    expect(verifySerde(defaultState, 'pako')).toMatchInlineSnapshot(
      `"pako:eNp1kl1rE0EUhv_KMN4oJJia1jS5EExiKoqlmFLQbC8mu7ObIbszYXajLUmgVEtSa6F-VYsQMVJiL6JgocSmpn8m-5F_4W42oRtt52Jhzvuc95w5eypQZBKGCSir7LlYQNwAy2mBAvfczTn9d-bW4aDbsfbr1otj6_jDKgiH71TNH03r44nT_mY196oged1-_8Vq7Jmf-87X7zf85KQHglRluLFt7RwNujuD7obVOaz5ampkY_fadq9jn-07_TdVkM75hZxXm_bmb_Pta-e8aZ-erwYzzEbd2m0Nur1h61MV3MtZRwf2wZ_h1q6z_WvYeum0G9P4zzOzfup6DnonVZDJLS0ugJsgu7IA_NgIhiGocCLBhMHLOAQ1zDXkXWHFU4WLwQgwASq-vQCpO7VsCYmEKl58PhKaKBzRYkCJRzyhFvLNjALWsBcWoIRlVFZd16C0gjhBeRXrU8XySCwqnJWp5Kdek2U5hqVx6qhJRo0M0oi67hOCIMBHRORMZ7IBnqD7mHihEPC-S25rGUQVkE1dBBeZwUAWUR2kHjycUh5jscx18gyDSXe-prtwWMecyIFGVEJxiqmMjzvFaG4-IgYAd7g0WVSueog31yTjEp4YyPFYdOZ2gChxoiG-7kPBUleRU4yMJWnuf2YZrxlBbjY6MxuJBTgdi4xKl9fNx29FxcvY6creCVAG5gb5F8JSDCH393krI9Cau5slRJ8ypk3W090CpQATMlJ191YuScjAaYIUjsZI7S-QlGPe"`
    );
  });

  it('should throw error for unrecognized serde', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(() => serializeState(defaultState, 'unknown')).toThrowError(
      'Unknown serde type: unknown'
    );
    expect(() => deserializeState('unknown:hello')).toThrowError('Unknown serde type: unknown');
  });
});
