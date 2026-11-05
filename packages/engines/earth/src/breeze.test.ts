import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  breezeOf,
  interpolateBreeze,
  simulateBreeze,
  validateBreezeExperiment,
  windOf,
  type BowlKind,
  type BreezeKind,
  type BreezeParams,
  type PhaseKind,
} from './breeze';
import breezeJson from '../../../../content/units/g5-weather/manifest.json';

const p = (phase: PhaseKind, lampCm: number, bowl: BowlKind = 'plastic'): BreezeParams => ({ phase, lampCm, bowl });

// 사양 §2.1: [때, 거리, 모래, 물, 온도 차, 바람, 반올림 전 차이]
const TABLE: [PhaseKind, number, number, number, number, BreezeKind, number][] = [
  ['day', 20, 34.7, 26.3, 8.4, 'sea-to-land', 8.391],
  ['day', 40, 23.7, 21.6, 2.1, 'sea-to-land', 2.098],
  ['night', 20, 21.2, 23.8, -2.6, 'land-to-sea', -2.613],
  ['night', 40, 20.3, 21.0, -0.7, 'land-to-sea', -0.653],
];

describe('바람 모델: 사양 기준값 4칸 (그릇 두 가지 모두)', () => {
  for (const bowl of ['plastic', 'glass'] as const) {
    for (const [phase, cm, sand, water, diff, breeze, rawDiff] of TABLE) {
      it(`${bowl} ${phase} ${cm} cm`, () => {
        const out = simulateBreeze(p(phase, cm, bowl));
        expect(out.result).toEqual({ sand, water, diff, breeze });
        const last = out.samples.at(-1)!;
        expect(last.t).toBe(10);
        expect(last.diff).toBeCloseTo(rawDiff, 3);
      });
    }
  }
});

describe('바람 모델: 관계', () => {
  it('그릇만 바꾸면 결과와 샘플이 같다', () => {
    for (const [phase, cm] of TABLE) {
      expect(simulateBreeze(p(phase, cm, 'glass'))).toEqual(simulateBreeze(p(phase, cm, 'plastic')));
    }
  });

  it('결과 diff는 표시되는 모래 − 물과 같다 (소수 첫째 자리). 매니페스트가 고르게 하는 거리 20·40 cm가 대상이다', () => {
    for (const phase of ['day', 'night'] as const) {
      for (const cm of [20, 40]) {
        const r = simulateBreeze(p(phase, cm)).result;
        expect(r.diff, `${phase} ${cm}`).toBe(Math.round((r.sand - r.water) * 10) / 10);
      }
    }
  });

  it('샘플은 0.1분 간격으로 101개, 마지막은 t = 10, 처음 낮은 주변 온도 20 °C', () => {
    const s = simulateBreeze(p('day', 20)).samples;
    expect(s).toHaveLength(101);
    expect(s[0]).toEqual({ t: 0, sand: 20, water: 20, diff: 0, wind: 0 });
    expect(s.at(-1)!.t).toBe(10);
  });

  it('낮에는 sand·water가 단조 증가하고, 밤에는 단조 감소한다', () => {
    for (const cm of [20, 40]) {
      const day = simulateBreeze(p('day', cm)).samples;
      const night = simulateBreeze(p('night', cm)).samples;
      for (let i = 1; i < day.length; i++) {
        expect(day[i]!.sand).toBeGreaterThan(day[i - 1]!.sand);
        expect(day[i]!.water).toBeGreaterThan(day[i - 1]!.water);
        expect(night[i]!.sand).toBeLessThan(night[i - 1]!.sand);
        expect(night[i]!.water).toBeLessThan(night[i - 1]!.water);
      }
    }
  });

  it('낮의 모든 샘플에서 sand ≥ water이다', () => {
    for (const cm of [20, 40]) for (const x of simulateBreeze(p('day', cm)).samples) expect(x.sand).toBeGreaterThanOrEqual(x.water);
  });

  it('밤 t = 0의 값은 같은 거리의 낮 t = 10의 값과 같다 (모든 샘플 값)', () => {
    for (const cm of [15, 20, 40, 60]) {
      const d = simulateBreeze(p('day', cm)).samples.at(-1)!;
      const n = simulateBreeze(p('night', cm)).samples[0]!;
      expect({ ...n, t: 0 }).toEqual({ ...d, t: 0 });
    }
  });

  it('밤에는 모래가 물보다 빨리 식어 온도 차가 +에서 −로 바뀐다', () => {
    const s = simulateBreeze(p('night', 20)).samples;
    expect(s[0]!.diff).toBeGreaterThan(0.5);
    expect(s.at(-1)!.diff).toBeLessThan(-0.5);
    expect(s[0]!.wind).toBe(1);
    expect(s.at(-1)!.wind).toBeLessThan(0);
  });

  it('바람 세기는 diff / 8을 −1~1로 자른 값이고, 방향은 ±0.5에서 나뉜다', () => {
    expect(windOf(8.391)).toBe(1);
    expect(windOf(4)).toBe(0.5);
    expect(windOf(-2.613)).toBeCloseTo(-0.3266, 4);
    expect(windOf(-20)).toBe(-1);
    expect(breezeOf(0.51)).toBe('sea-to-land');
    expect(breezeOf(0.5)).toBe('calm');
    expect(breezeOf(0)).toBe('calm');
    expect(breezeOf(-0.5)).toBe('calm');
    expect(breezeOf(-0.51)).toBe('land-to-sea');
  });

  it('범위 밖 입력은 RangeError', () => {
    expect(() => simulateBreeze(p('day', 14))).toThrow(RangeError);
    expect(() => simulateBreeze(p('day', 61))).toThrow(RangeError);
    expect(() => simulateBreeze(p('day', Number.NaN))).toThrow(RangeError);
    expect(() => simulateBreeze({ phase: 'dusk' as never, lampCm: 20, bowl: 'plastic' })).toThrow(RangeError);
    expect(() => simulateBreeze({ phase: 'day', lampCm: 20, bowl: 'metal' as never })).toThrow(RangeError);
    expect(() => simulateBreeze(p('day', 20), { totalMin: 0 })).toThrow(RangeError);
  });

  it('보간: 중간 값', () => {
    const s = simulateBreeze(p('day', 20)).samples;
    const mid = interpolateBreeze(s[10]!, s[11]!, 0.5);
    expect(mid.t).toBeCloseTo(1.05, 9);
    expect(mid.sand).toBeCloseTo((s[10]!.sand + s[11]!.sand) / 2, 9);
    expect(mid.diff).toBeCloseTo((s[10]!.diff + s[11]!.diff) / 2, 9);
  });
});

describe('validateBreezeExperiment', () => {
  const exp = () => (JSON.parse(JSON.stringify(breezeJson)).experiments[0] as VariableExperiment);

  it('매니페스트는 통과한다', () => {
    expect(validateBreezeExperiment(exp())).toEqual([]);
  });

  it('변인 누락·허용 범위 밖·params 누락을 잡는다', () => {
    const noBowl = exp();
    noBowl.variables = noBowl.variables.filter((v) => v.key !== 'bowl');
    expect(validateBreezeExperiment(noBowl).join()).toContain('bowl');
    const farLamp = exp();
    farLamp.variables.find((v) => v.key === 'lampCm')!.options.push({ value: 80, label: '80 cm' });
    expect(validateBreezeExperiment(farLamp).join()).toContain('15~60');
    const badPhase = exp();
    badPhase.variables.find((v) => v.key === 'phase')!.options.push({ value: 'dawn', label: '새벽' });
    expect(validateBreezeExperiment(badPhase).join()).toContain('day, night');
    const noParams = exp();
    delete noParams.params;
    expect(validateBreezeExperiment(noParams).join()).toContain('params.totalMin');
  });
});
