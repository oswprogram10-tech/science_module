import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  DEPOSIT_RATIO,
  flowAt,
  interpolateStream,
  pourSeconds,
  simulateStream,
  validateStreamExperiment,
  type SlopeKind,
  type StreamParams,
  type VesselKind,
} from './stream';
import streamJson from '../../../../content/units/g4-land/manifest.json';

const p = (slope: SlopeKind, waterL: number, vessel: VesselKind = 'cup'): StreamParams => ({ slope, waterL, vessel });

// 사양 §2.1: [기울기, 물(L), 깎인 흙(g), 쌓인 흙(g)]
const TABLE: [SlopeKind, number, number, number][] = [
  ['gentle', 1, 20, 16],
  ['gentle', 2, 40, 32],
  ['steep', 1, 50, 40],
  ['steep', 2, 100, 80],
];

describe('흐르는 물 모델: 사양 기준값 4칸 (그릇 두 가지 모두)', () => {
  for (const vessel of ['cup', 'bottle'] as const) {
    for (const [slope, water, e, d] of TABLE) {
      it(`${vessel} ${slope} ${water} L`, () => {
        const out = simulateStream(p(slope, water, vessel));
        expect(out.result).toEqual({ eroded: e, deposited: d });
        const last = out.samples.at(-1)!;
        expect(last.t).toBe(60);
        expect(last.eroded).toBeCloseTo(e, 9);
        expect(last.deposited).toBeCloseTo(d, 9);
      });
    }
  }
});

describe('흐르는 물 모델: 관계', () => {
  it('붓는 시간은 1 L 20초, 2 L 40초', () => {
    expect(pourSeconds(1)).toBe(20);
    expect(pourSeconds(2)).toBe(40);
  });

  it('그릇만 바꾸면 결과와 샘플이 같다', () => {
    for (const [slope, water] of TABLE) {
      expect(simulateStream(p(slope, water, 'bottle'))).toEqual(simulateStream(p(slope, water, 'cup')));
    }
  });

  it('샘플은 0.5초 간격으로 121개, 마지막은 t = 60', () => {
    const s = simulateStream(p('gentle', 1)).samples;
    expect(s).toHaveLength(121);
    expect(s[0]).toEqual({ t: 0, eroded: 0, deposited: 0, flow: 0.4, pouring: true });
    expect(s.at(-1)!.t).toBe(60);
  });

  it('E와 D는 단조 비감소이고 모든 샘플에서 D ≤ E이다', () => {
    for (const [slope, water] of TABLE) {
      const s = simulateStream(p(slope, water)).samples;
      for (let i = 1; i < s.length; i++) {
        expect(s[i]!.eroded).toBeGreaterThanOrEqual(s[i - 1]!.eroded);
        expect(s[i]!.deposited).toBeGreaterThanOrEqual(s[i - 1]!.deposited);
      }
      for (const x of s) expect(x.deposited).toBeLessThanOrEqual(x.eroded + 1e-9);
    }
  });

  it('t ≥ T + 2이면 값이 변하지 않고, 끝값은 D = 0.8·E', () => {
    for (const [slope, water, e] of TABLE) {
      const T = pourSeconds(water);
      const s = simulateStream(p(slope, water)).samples.filter((x) => x.t >= T + 2);
      for (const x of s) {
        expect(x.eroded).toBeCloseTo(e, 9);
        expect(x.deposited).toBeCloseTo(DEPOSIT_RATIO * e, 9);
      }
    }
  });

  it('쌓이는 것은 2초 늦게 시작한다', () => {
    const s = simulateStream(p('steep', 1)).samples;
    expect(s.find((x) => x.t === 2)!.deposited).toBe(0);
    expect(s.find((x) => x.t === 3)!.deposited).toBeCloseTo(0.8 * 2.5, 9);
  });

  it('붓는 동안 flow는 완만 0.4·가파름 1.0이고, 붓기가 끝나면 2초 동안 0으로 줄어든다', () => {
    expect(flowAt('gentle', 1, 10)).toBe(0.4);
    expect(flowAt('steep', 1, 19.5)).toBe(1);
    expect(flowAt('steep', 1, 21)).toBeCloseTo(0.5, 9);
    expect(flowAt('steep', 1, 22)).toBe(0);
    expect(flowAt('gentle', 2, 60)).toBe(0);
    const s = simulateStream(p('steep', 1)).samples;
    expect(s.filter((x) => x.pouring).at(-1)!.t).toBe(19.5);
    expect(s.find((x) => x.t === 20)!.pouring).toBe(false);
  });

  it('물이 많을수록·기울기가 가파를수록 값이 큰 것은 표에서 읽는다 (단조)', () => {
    const r = (slope: SlopeKind, w: number) => simulateStream(p(slope, w)).result;
    expect(r('gentle', 2).eroded).toBeGreaterThan(r('gentle', 1).eroded);
    expect(r('steep', 1).deposited).toBeGreaterThan(r('gentle', 1).deposited);
  });

  it('범위 밖 입력은 RangeError', () => {
    expect(() => simulateStream(p('gentle', 0.4))).toThrow(RangeError);
    expect(() => simulateStream(p('gentle', 2.6))).toThrow(RangeError);
    expect(() => simulateStream({ slope: 'flat' as never, waterL: 1, vessel: 'cup' })).toThrow(RangeError);
    expect(() => simulateStream({ slope: 'gentle', waterL: 1, vessel: 'jug' as never })).toThrow(RangeError);
    expect(() => simulateStream(p('gentle', 2.5), { totalS: 50 })).toThrow(RangeError);
    expect(() => simulateStream(p('gentle', 2.5), { totalS: 52 })).not.toThrow();
  });

  it('보간: 중간 값과 붓는 중 여부', () => {
    const s = simulateStream(p('gentle', 1)).samples;
    const a = s.find((x) => x.t === 19.5)!;
    const b = s.find((x) => x.t === 20)!;
    const mid = interpolateStream(a, b, 0.5);
    expect(mid.t).toBeCloseTo(19.75, 9);
    expect(mid.eroded).toBeCloseTo(19.75, 9);
    expect(mid.pouring).toBe(true);
    expect(interpolateStream(a, b, 1).pouring).toBe(false);
  });
});

describe('validateStreamExperiment', () => {
  const exp = () => (JSON.parse(JSON.stringify(streamJson)).experiments[1] as VariableExperiment);

  it('매니페스트는 통과한다', () => {
    expect(validateStreamExperiment(exp())).toEqual([]);
  });

  it('변인 누락·허용 범위 밖·관찰 시간 부족을 잡는다', () => {
    const noVessel = exp();
    noVessel.variables = noVessel.variables.filter((v) => v.key !== 'vessel');
    expect(validateStreamExperiment(noVessel).join()).toContain('vessel');
    const bigWater = exp();
    bigWater.variables.find((v) => v.key === 'waterL')!.options.push({ value: 3, label: '3 L' });
    expect(validateStreamExperiment(bigWater).join()).toContain('0.5~2.5');
    const short = exp();
    short.params = { totalS: 40 };
    expect(validateStreamExperiment(short).join()).toContain('params.totalS');
    const noParams = exp();
    delete noParams.params;
    expect(validateStreamExperiment(noParams).length).toBeGreaterThan(0);
    const badSlope = exp();
    badSlope.variables.find((v) => v.key === 'slope')!.options.push({ value: 'flat', label: '평평' });
    expect(validateStreamExperiment(badSlope).join()).toContain('gentle, steep');
  });
});
