import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import {
  interpolateBody,
  simulateBody,
  validateExerciseExperiment,
  type BodyParams,
  type ExerciseKind,
  type WristKind,
} from './body';
import bodyJson from '../../../../content/units/g5-body/manifest.json';

const p = (kind: ExerciseKind, minutes: number, wrist: WristKind): BodyParams => ({ kind, minutes, wrist });

// 사양 §2.1: [운동, 시간(분), 운동 직후 맥박, 운동 직후 호흡, 돌아오는 데 걸린 시간(분)]
const TABLE: [ExerciseKind, number, number, number, number][] = [
  ['sit', 1, 85, 20, 0.0],
  ['sit', 3, 85, 20, 0.0],
  ['walk', 1, 111, 28, 2.5],
  ['walk', 3, 115, 29, 2.7],
  ['run', 1, 158, 42, 4.0],
  ['run', 3, 170, 45, 4.2],
];

describe('몸 모델: 사양 기준값(손목 두 가지 각각)', () => {
  for (const wrist of ['left', 'right'] as const) {
    for (const [kind, minutes, pulse, breath, recover] of TABLE) {
      it(`${kind} ${minutes}분 ${wrist}`, () => {
        expect(simulateBody(p(kind, minutes, wrist)).result).toEqual({ pulseEnd: pulse, breathEnd: breath, recoverMin: recover });
      });
    }
  }

  it('손목만 바꾸면 결과와 샘플이 모두 같다', () => {
    for (const [kind, minutes] of TABLE) {
      expect(simulateBody(p(kind, minutes, 'right'))).toEqual(simulateBody(p(kind, minutes, 'left')));
    }
  });
});

describe('샘플', () => {
  const cases = TABLE.flatMap(([k, m]) => (['left', 'right'] as const).map((w) => p(k, m, w)));

  it('0~10분, 처음 1분은 쉴 때 값, 운동 중에는 증가, 끝난 뒤에는 감소', () => {
    for (const c of cases) {
      const { samples } = simulateBody(c);
      const t1 = 1 + c.minutes;
      expect(samples[0]!.t).toBe(0);
      expect(samples[samples.length - 1]!.t).toBe(10);
      for (const s of samples) {
        if (s.t <= 1) expect([s.pulse, s.breath]).toEqual([85, 20]);
      }
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1]!;
        const b = samples[i]!;
        if (b.t <= t1 + 1e-9) {
          expect(b.pulse, `${c.kind} t=${b.t}`).toBeGreaterThanOrEqual(a.pulse);
          expect(b.breath).toBeGreaterThanOrEqual(a.breath);
        } else if (a.t >= t1 - 1e-9) {
          expect(b.pulse, `${c.kind} t=${b.t}`).toBeLessThanOrEqual(a.pulse);
          expect(b.breath).toBeLessThanOrEqual(a.breath);
        }
      }
      if (c.kind !== 'sit') {
        // 운동 중에 엄밀히 증가하고, 끝난 뒤에 엄밀히 감소한다.
        const during = samples.filter((s) => s.t >= 1 && s.t <= t1 + 1e-9);
        for (let i = 1; i < during.length; i++) expect(during[i]!.pulse).toBeGreaterThan(during[i - 1]!.pulse);
        const after = samples.filter((s) => s.t >= t1 - 1e-9);
        for (let i = 1; i < after.length; i++) expect(after[i]!.pulse).toBeLessThan(after[i - 1]!.pulse);
      }
    }
  });

  it('운동이 끝난 순간 샘플이 있고 그 맥박 반올림이 pulseEnd이다', () => {
    for (const c of cases) {
      const { samples, result } = simulateBody(c);
      const end = samples.find((s) => Math.abs(s.t - (1 + c.minutes)) < 1e-9)!;
      expect(Math.round(end.pulse)).toBe(result.pulseEnd);
      expect(Math.round(end.breath)).toBe(result.breathEnd);
    }
  });

  it('10분째 맥박은 쉴 때 값(85)에서 ±15 안에 있다', () => {
    for (const c of cases) {
      const last = simulateBody(c).samples.at(-1)!;
      expect(Math.abs(last.pulse - 85)).toBeLessThanOrEqual(15);
      expect(Math.abs(last.breath - 20)).toBeLessThanOrEqual(15);
    }
  });

  it('effort: 운동 중이면 강도, 아니면 0', () => {
    const { samples } = simulateBody(p('run', 1, 'left'));
    expect(samples.find((s) => s.t === 0.5)!.effort).toBe(0);
    expect(samples.find((s) => s.t === 1.5)!.effort).toBe(1);
    expect(samples.find((s) => s.t === 2)!.effort).toBe(0);
    expect(samples.find((s) => s.t === 5)!.effort).toBe(0);
    expect(simulateBody(p('walk', 1, 'left')).samples.find((s) => s.t === 1.5)!.effort).toBe(0.35);
    expect(simulateBody(p('sit', 1, 'left')).samples.every((s) => s.effort === 0)).toBe(true);
  });

  it('옵션과 잘못된 값', () => {
    expect(simulateBody(p('walk', 1, 'left'), { totalMin: 12 }).samples.at(-1)!.t).toBe(12);
    expect(() => simulateBody(p('walk', 3, 'left'), { totalMin: 8 })).toThrow(RangeError);
    expect(() => simulateBody(p('walk', 1, 'left'), { sampleEveryMin: 0 })).toThrow(RangeError);
    expect(() => simulateBody({ kind: 'x' as ExerciseKind, minutes: 1, wrist: 'left' })).toThrow(RangeError);
    expect(() => simulateBody(p('walk', Number.NaN, 'left'))).toThrow(RangeError);
    expect(() => simulateBody(p('walk', 6, 'left'))).toThrow(RangeError);
    expect(() => simulateBody({ kind: 'walk', minutes: 1, wrist: 'x' as WristKind })).toThrow(RangeError);
  });

  it('같은 입력은 같은 출력이다(난수 없음)', () => {
    expect(simulateBody(p('run', 3, 'right'))).toEqual(simulateBody(p('run', 3, 'right')));
  });
});

describe('보간과 매니페스트 검증', () => {
  it('interpolateBody는 선형 보간이다', () => {
    expect(interpolateBody({ t: 0, pulse: 80, breath: 20, effort: 0 }, { t: 1, pulse: 100, breath: 30, effort: 1 }, 0.5)).toEqual({ t: 0.5, pulse: 90, breath: 25, effort: 0.5 });
  });

  const exp = () => JSON.parse(JSON.stringify(parseManifest(bodyJson).experiments[0])) as VariableExperiment;

  it('g5-body 매니페스트는 통과한다', () => {
    expect(validateExerciseExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const e = exp();
    e.variables = e.variables.filter((v) => v.key !== 'wrist');
    expect(validateExerciseExperiment(e).join()).toContain('"wrist"');
    const f = exp();
    f.variables.find((v) => v.key === 'minutes')!.options.push({ value: 9, label: '9분' });
    f.variables.find((v) => v.key === 'kind')!.options.push({ value: 'swim', label: 'x' });
    f.variables.find((v) => v.key === 'wrist')!.options.push({ value: 1, label: 'y' });
    expect(validateExerciseExperiment(f)).toHaveLength(3);
    // 쉬는 1분 + 운동 5분 + 5분 > 10분
    const g = exp();
    g.variables.find((v) => v.key === 'minutes')!.options.push({ value: 5, label: '5분' });
    expect(validateExerciseExperiment(g).join()).toContain('넘습니다');
    const h = exp();
    h.params = { totalMin: 40 };
    expect(validateExerciseExperiment(h)).toHaveLength(1);
  });
});
