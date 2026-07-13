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
      `"pako:eNp1kt9uEkEUxl9lMt5oApFKK4ULEwHBaGwaIU2U7cWwO7tM2J0hs4u2AZKm2kCtTeq_amOCEdNgL9DEJg2WSl8Gdpe3cJeFdNF2LjaZ8_3Od86cPRUoMgnDGJRV9lwsIG6AbFKgwDl3c3b_3XDrcNDtmPt188WxefxhFQSDd6rDH03z44nd_mY296ogft16_8Vs7A0_9-2v3294yXEXBInKaGPb3DkadHcG3Q2zc1jz1MTYxuq1rV7HOtu3-2-qIJnzCtmvNq3N38O3r-3zpnV6vurPGDbq5m5r0O2NWp-q4F7OPDqwDv6Mtnbt7V-j1ku73ZjFf54N66eO56B3UgWp3PJSGtwEmZU08GJjGAagwokEYwYv4wDUMNeQe4UVVxUuBiPAGKh49gKkztQyJSQSqrjxxVBgqnBEiz4lGnKFWsAzMwpYw25YgBKWUVl1XP3SCuIE5VWszxTLI7GocFamkpd6TZblCJYmqeMmGTVSSCPqukcIggAfEZEznckGeILuY-KGAsD9LjutpRBVQCZxEVxiBgMZRHWQePBwRnmMxTLXyTMMpt15mu7AQR1zIvsaUQnFCaYyPukUo4XFkOgDnOHSeFG56iHuXOOMS3hqIEcj4bnbPqLEiYb4ugf5S11FzjAylqSF_5ksXjP83Hx4bj4U8XE6FhmVLq-bj94Ki5exs5Xd46MMzA3yL4SlCELO73NXRqA1ZzdLiD5lTJuup7MFSgHGZKTqzk2nqJRlad_6lksSMnCSIIWjSVLtL8r3akM"`
    );
  });

  it('should serialize and deserialize with base64 serde', () => {
    expect(verifySerde(defaultState, 'base64')).toMatchInlineSnapshot(
      `"base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgQVvovpPlhaXkuK3mlofmg7Pms5VdIC0tPnzlrp7ml7bop6PmnpB8IEIo55Sf5oiQ5Zu-6KGoKVxuICAgIEIgLS0-IEN76YCJ5oup5LiL5LiA5q2lfVxuICAgIEMgLS0-fOe7p-e7ree8lui-kXwgRFvkuK3mlofoioLngrnlkozov57nur9dXG4gICAgQyAtLT585YiH5o2i5Li76aKYfCBFW-apmeeZvemFjeiJsumihOiniF1cbiAgICBDIC0tPnzlr7zlh7rmlofku7Z8IEZbUE5HIC8gU1ZHIOaWh-S7tl1cbiAgIiwiZ3JpZCI6dHJ1ZSwibWVybWFpZCI6IntcbiAgXCJmbG93Y2hhcnRcIjoge1xuICAgIFwibm9kZVNwYWNpbmdcIjogODAsXG4gICAgXCJyYW5rU3BhY2luZ1wiOiA5MFxuICB9LFxuICBcInRoZW1lXCI6IFwiZGVmYXVsdFwiLFxuICBcInRoZW1lVmFyaWFibGVzXCI6IHtcbiAgICBcImJhY2tncm91bmRcIjogXCIjZmZmN2VkXCIsXG4gICAgXCJmb250RmFtaWx5XCI6IFwiXFxcIk1pY3Jvc29mdCBZYUhlaVxcXCIsIFxcXCJQaW5nRmFuZyBTQ1xcXCIsIFxcXCJOb3RvIFNhbnMgQ0pLIFNDXFxcIiwgXFxcIlJlY3Vyc2l2ZSBWYXJpYWJsZVxcXCIsIHNhbnMtc2VyaWZcIixcbiAgICBcImxpbmVDb2xvclwiOiBcIiNlYTU4MGNcIixcbiAgICBcIm1haW5Ca2dcIjogXCIjZmZmN2VkXCIsXG4gICAgXCJub2RlQm9yZGVyXCI6IFwiI2Y5NzMxNlwiLFxuICAgIFwicHJpbWFyeUJvcmRlckNvbG9yXCI6IFwiI2Y5NzMxNlwiLFxuICAgIFwicHJpbWFyeUNvbG9yXCI6IFwiI2ZmZWRkNVwiLFxuICAgIFwicHJpbWFyeVRleHRDb2xvclwiOiBcIiM0MzE0MDdcIixcbiAgICBcInNlY29uZGFyeUJvcmRlckNvbG9yXCI6IFwiI2ZiOTIzY1wiLFxuICAgIFwic2Vjb25kYXJ5Q29sb3JcIjogXCIjZmZmZmZmXCIsXG4gICAgXCJ0ZXJ0aWFyeUNvbG9yXCI6IFwiI2ZlZDdhYVwiXG4gIH1cbn0iLCJwYW5ab29tIjp0cnVlLCJyb3VnaCI6ZmFsc2UsInNuYXBUb0dyaWQiOnRydWUsInVwZGF0ZURpYWdyYW0iOnRydWV9"`
    );
  });

  it('should serialize and deserialize with pako serde', () => {
    expect(verifySerde(defaultState, 'pako')).toMatchInlineSnapshot(
      `"pako:eNp1kt9uEkEUxl9lMt5oApFKK4ULEwHBaGwaIU2U7cWwO7tM2J0hs4u2AZKm2kCtTeq_amOCEdNgL9DEJg2WSl8Gdpe3cJeFdNF2LjaZ8_3Od86cPRUoMgnDGJRV9lwsIG6AbFKgwDl3c3b_3XDrcNDtmPt188WxefxhFQSDd6rDH03z44nd_mY296ogft16_8Vs7A0_9-2v3294yXEXBInKaGPb3DkadHcG3Q2zc1jz1MTYxuq1rV7HOtu3-2-qIJnzCtmvNq3N38O3r-3zpnV6vurPGDbq5m5r0O2NWp-q4F7OPDqwDv6Mtnbt7V-j1ku73ZjFf54N66eO56B3UgWp3PJSGtwEmZU08GJjGAagwokEYwYv4wDUMNeQe4UVVxUuBiPAGKh49gKkztQyJSQSqrjxxVBgqnBEiz4lGnKFWsAzMwpYw25YgBKWUVl1XP3SCuIE5VWszxTLI7GocFamkpd6TZblCJYmqeMmGTVSSCPqukcIggAfEZEznckGeILuY-KGAsD9LjutpRBVQCZxEVxiBgMZRHWQePBwRnmMxTLXyTMMpt15mu7AQR1zIvsaUQnFCaYyPukUo4XFkOgDnOHSeFG56iHuXOOMS3hqIEcj4bnbPqLEiYb4ugf5S11FzjAylqSF_5ksXjP83Hx4bj4U8XE6FhmVLq-bj94Ki5exs5Xd46MMzA3yL4SlCELO73NXRqA1ZzdLiD5lTJuup7MFSgHGZKTqzk2nqJRlad_6lksSMnCSIIWjSVLtL8r3akM"`
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
