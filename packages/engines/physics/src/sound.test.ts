import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { interpolateStringSound, simulateStringSound, validateStringSoundExperiment, type Strength, type StringColor, type StringSoundParams } from './sound';
import soundJson from '../../../../content/units/g3-sound/manifest.json';

const p = (strength: Strength, lengthCm: number, color: StringColor = 'red'): StringSoundParams => ({ strength, lengthCm, color });

// 사양 §2.1: [세기, 길이(cm), 떨린 횟수(번/초), 소리의 크기]
const TABLE: [Strength, number, number, number][] = [
  ['weak', 15, 440, 62.0],
  ['weak', 20, 330, 62.0],
  ['weak', 30, 220, 62.0],
  ['strong', 15, 440, 70.0],
  ['strong', 20, 330, 70.0],
  ['strong', 30, 220, 70.0],
];
const COLORS: StringColor[] = ['red', 'yellow'];
const A = { weak: 0.4, strong: 1 } as const;

/** 위로 지나가는 0점 교차 횟수: 앞 표본이 음수이고 지금 표본이 0 이상 */
const upCrossings = (d: number[]) => d.slice(1).filter((v, i) => d[i]! < 0 && v >= 0).length;

describe('줄 소리 모델: 사양 기준값 6칸 × 색 두 가지', () => {
  for (const color of COLORS) {
    for (const [strength, len, freq, level] of TABLE) {
      it(`${color} ${strength} ${len} cm`, () => {
        const r = simulateStringSound(p(strength, len, color)).result;
        expect(r.freq).toBe(freq);
        expect(r.level).toBe(level);
        expect(Number.isInteger(r.freq)).toBe(true);
        expect(r.wavesInWindow).toBe(Math.round(freq * 0.02 * 10) / 10);
      });
    }
  }

  it('물결 개수 확인값: 15 cm 8.8, 20 cm 6.6, 30 cm 4.4', () => {
    expect([15, 20, 30].map((l) => simulateStringSound(p('weak', l)).result.wavesInWindow)).toEqual([8.8, 6.6, 4.4]);
  });

  it('색만 바꾸면 결과와 샘플이 같다', () => {
    for (const [strength, len] of TABLE) {
      expect(simulateStringSound(p(strength, len, 'yellow'))).toEqual(simulateStringSound(p(strength, len, 'red')));
    }
  });

  it('세기만 바꾸면 freq가 같고, 샘플의 0점 교차 횟수가 같다', () => {
    for (const len of [15, 20, 30]) {
      const w = simulateStringSound(p('weak', len));
      const s = simulateStringSound(p('strong', len));
      expect(w.result.freq).toBe(s.result.freq);
      expect(upCrossings(w.samples.map((x) => x.displacement))).toBe(upCrossings(s.samples.map((x) => x.displacement)));
    }
  });

  it('길이만 바꾸면 level이 같다', () => {
    for (const strength of ['weak', 'strong'] as const) {
      const levels = [15, 20, 30].map((l) => simulateStringSound(p(strength, l)).result.level);
      expect(new Set(levels).size).toBe(1);
    }
  });

  it('길이가 짧을수록 freq가 크고, 세기가 셀수록 level이 크다', () => {
    const f = [15, 20, 30].map((l) => simulateStringSound(p('weak', l)).result.freq);
    expect(f[0]!).toBeGreaterThan(f[1]!);
    expect(f[1]!).toBeGreaterThan(f[2]!);
    expect(simulateStringSound(p('strong', 20)).result.level).toBeGreaterThan(simulateStringSound(p('weak', 20)).result.level);
  });
});

describe('줄 소리 모델: 샘플', () => {
  it('displacement의 최댓값은 A의 ±1% 안에 있다', () => {
    for (const [strength, len] of TABLE) {
      const d = simulateStringSound(p(strength, len)).samples.map((s) => s.displacement);
      const max = Math.max(...d);
      const min = Math.min(...d);
      expect(Math.abs(max - A[strength]) / A[strength], `${strength} ${len}`).toBeLessThanOrEqual(0.01);
      expect(Math.abs(min + A[strength]) / A[strength], `${strength} ${len}`).toBeLessThanOrEqual(0.01);
    }
  });

  it('20 ms 동안 위로 지나가는 0점 교차 횟수는 floor(freq·0.02)이거나 그보다 1 많다', () => {
    for (const [strength, len, freq] of TABLE) {
      const n = upCrossings(simulateStringSound(p(strength, len)).samples.map((s) => s.displacement));
      const f = Math.floor(freq * 0.02);
      expect([f, f + 1], `${strength} ${len}`).toContain(n);
    }
  });

  it('표본은 0.1 ms 간격 201개이고 마지막 t는 20이다', () => {
    for (const [strength, len] of TABLE) {
      const { samples } = simulateStringSound(p(strength, len));
      expect(samples).toHaveLength(201);
      expect(samples[0]!.t).toBe(0);
      expect(samples[0]!.displacement).toBe(0);
      expect(samples[samples.length - 1]!.t).toBe(20);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.t).toBeGreaterThan(samples[i - 1]!.t);
    }
  });

  it('샘플마다 amplitude, freq, level이 결과와 같다', () => {
    const { samples, result } = simulateStringSound(p('strong', 15));
    for (const s of samples) {
      expect([s.amplitude, s.freq, s.level]).toEqual([1, result.freq, result.level]);
    }
  });

  it('난수 없음: 같은 입력이면 같은 출력', () => {
    expect(simulateStringSound(p('weak', 15))).toEqual(simulateStringSound(p('weak', 15)));
  });

  it('옵션: 창과 간격을 바꿀 수 있고 잘못된 값은 거부한다', () => {
    expect(simulateStringSound(p('weak', 20), { windowMs: 1, sampleEveryMs: 0.25 }).samples.map((s) => s.t)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(() => simulateStringSound(p('weak', 20), { windowMs: 0 })).toThrow(RangeError);
    expect(() => simulateStringSound(p('weak', 20), { sampleEveryMs: 0 })).toThrow(RangeError);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateStringSound(p('weak', 9))).toThrow(RangeError);
    expect(() => simulateStringSound(p('weak', 41))).toThrow(RangeError);
    expect(() => simulateStringSound(p('weak', Number.NaN))).toThrow(RangeError);
    expect(() => simulateStringSound({ strength: 'medium' as never, lengthCm: 20, color: 'red' })).toThrow(RangeError);
    expect(() => simulateStringSound({ strength: 'weak', lengthCm: 20, color: 'blue' as never })).toThrow(RangeError);
  });

  it('선형 보간', () => {
    const { samples } = simulateStringSound(p('strong', 15));
    const m = interpolateStringSound(samples[10]!, samples[11]!, 0.5);
    expect(m.displacement).toBeCloseTo((samples[10]!.displacement + samples[11]!.displacement) / 2, 9);
    expect(m.t).toBeCloseTo((samples[10]!.t + samples[11]!.t) / 2, 9);
  });
});

describe('validateStringSoundExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(soundJson.experiments[0])) as VariableExperiment;

  it('g3-sound 매니페스트는 통과한다', () => {
    expect(validateStringSoundExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'color');
    expect(validateStringSoundExperiment(a).join()).toContain('"color"');
    const b = exp();
    b.variables.find((v) => v.key === 'lengthCm')!.options.push({ value: 50, label: '50 cm' }, { value: 'x', label: 'x' });
    b.variables.find((v) => v.key === 'strength')!.options.push({ value: 'medium', label: 'y' });
    b.variables.find((v) => v.key === 'color')!.options.push({ value: 'blue', label: 'z' });
    expect(validateStringSoundExperiment(b)).toHaveLength(4);
  });
});
