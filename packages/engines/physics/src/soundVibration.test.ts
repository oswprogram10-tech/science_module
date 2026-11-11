import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  BOUNCE_STRONG_MM,
  VIB_LOUDS,
  VIB_OBJECTS,
  VIB_SEEDS,
  VIB_SOUNDS,
  bounceMmOf,
  interpolateSoundVibration,
  simulateSoundVibration,
  validateSoundVibrationExperiment,
  vibLevelOf,
  type SoundVibrationParams,
  type VibLoud,
  type VibObject,
} from './soundVibration';
import soundJson from '../../../../content/units/g3-sound/manifest.json';

const p = (sound: 'off' | 'on', loud: VibLoud, object: VibObject, seed: 'yellow' | 'white' = 'yellow'): SoundVibrationParams => ({ sound, loud, object, seed });

// 사양 §2: [물체, 세기, 튄 높이(mm), 소리의 크기(눈금)] (소리를 낼 때)
const TABLE: [VibObject, VibLoud, number, number][] = [
  ['drum', 'strong', 12, 7],
  ['drum', 'weak', 5, 3],
  ['fork', 'strong', 6, 4],
  ['fork', 'weak', 2, 1],
  ['speaker', 'strong', 9, 5],
  ['speaker', 'weak', 4, 2],
];

describe('소리 나는 물체 모델: 사양 기준값', () => {
  for (const seed of VIB_SEEDS) {
    for (const [object, loud, bounce, level] of TABLE) {
      it(`${seed} 소리를 냄 ${object} ${loud}: ${bounce} mm · ${level}눈금`, () => {
        expect(simulateSoundVibration(p('on', loud, object, seed)).result).toEqual({ bounce, level });
      });
    }
  }

  it('소리를 내지 않으면 물체·세기·좁쌀 색과 상관없이 0과 0이고, 표본도 모두 0이다', () => {
    for (const object of VIB_OBJECTS) {
      for (const loud of VIB_LOUDS) {
        for (const seed of VIB_SEEDS) {
          const out = simulateSoundVibration(p('off', loud, object, seed));
          expect(out.result).toEqual({ bounce: 0, level: 0 });
          expect(out.samples.every((s) => s.bounceMm === 0 && s.level === 0)).toBe(true);
        }
      }
    }
  });

  it('좁쌀 색은 모든 조건(12가지)에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const sound of VIB_SOUNDS) for (const loud of VIB_LOUDS) for (const object of VIB_OBJECTS) expect(simulateSoundVibration(p(sound, loud, object, 'white'))).toEqual(simulateSoundVibration(p(sound, loud, object, 'yellow')));
  });

  it('반올림 경계: 약하게는 12 → 4.8 → 5, 6 → 2.4 → 2, 9 → 3.6 → 4, 소리의 크기는 7.2 → 7, 3.6 → 4, 5.4 → 5, 1.2 → 1, 2.4 → 2', () => {
    expect(BOUNCE_STRONG_MM).toEqual({ drum: 12, fork: 6, speaker: 9 });
    expect(bounceMmOf({ sound: 'on', loud: 'weak', object: 'drum' })).toBe(5);
    expect(bounceMmOf({ sound: 'on', loud: 'weak', object: 'fork' })).toBe(2);
    expect(bounceMmOf({ sound: 'on', loud: 'weak', object: 'speaker' })).toBe(4);
    expect([12, 6, 9, 5, 2, 4].map(vibLevelOf)).toEqual([7, 4, 5, 3, 1, 2]);
  });

  it('소리의 크기는 0~10 정수이고 상한은 10이다', () => {
    expect(vibLevelOf(100)).toBe(10);
    expect(vibLevelOf(0)).toBe(0);
    for (const [, , , level] of TABLE) expect(Number.isInteger(level) && level >= 0 && level <= 10).toBe(true);
  });

  it('세게 하면 약하게보다, 소리를 내면 내지 않을 때보다 좁쌀이 높이 튄다', () => {
    for (const object of VIB_OBJECTS) {
      const r = (sound: 'off' | 'on', loud: VibLoud) => simulateSoundVibration(p(sound, loud, object)).result.bounce;
      expect(r('on', 'strong')).toBeGreaterThan(r('on', 'weak'));
      expect(r('on', 'weak')).toBeGreaterThan(r('off', 'weak'));
    }
  });
});

describe('소리 나는 물체 모델: 표본', () => {
  it('0~3초 0.025초 간격 121개이고, 높이는 튄 높이 × |sin|이라 0 이상 튄 높이 이하이며 마루가 튄 높이와 같다', () => {
    for (const [object, loud, bounce, level] of TABLE) {
      const { samples } = simulateSoundVibration(p('on', loud, object));
      expect(samples).toHaveLength(121);
      expect(samples[0]).toEqual({ t: 0, bounceMm: 0, level });
      expect(samples.at(-1)!.t).toBe(3);
      expect(samples.every((s) => s.bounceMm >= 0 && s.bounceMm <= bounce + 1e-9 && s.level === level)).toBe(true);
      expect(Math.max(...samples.map((s) => s.bounceMm))).toBeCloseTo(bounce, 9);
      // 0.25초(첫 마루)에서 가장 높다
      expect(samples.find((s) => s.t === 0.25)!.bounceMm).toBeCloseTo(bounce, 9);
      // 0.5초에서 다시 바닥
      expect(samples.find((s) => s.t === 0.5)!.bounceMm).toBeCloseTo(0, 9);
    }
  });

  it('세로축 15 mm 안에 모두 담긴다 (그래프 고정 범위)', () => {
    for (const object of VIB_OBJECTS) for (const loud of VIB_LOUDS) expect(Math.max(...simulateSoundVibration(p('on', loud, object)).samples.map((s) => s.bounceMm))).toBeLessThanOrEqual(15);
  });

  it('선형 보간', () => {
    const { samples } = simulateSoundVibration(p('on', 'strong', 'drum'));
    const m = interpolateSoundVibration(samples[3]!, samples[4]!, 0.5);
    expect(m.bounceMm).toBeCloseTo((samples[3]!.bounceMm + samples[4]!.bounceMm) / 2, 9);
    expect(m.level).toBe(7);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateSoundVibration({ sound: 'maybe' as never, loud: 'weak', object: 'drum', seed: 'yellow' })).toThrow(RangeError);
    expect(() => simulateSoundVibration({ sound: 'on', loud: 'loudest' as never, object: 'drum', seed: 'yellow' })).toThrow(RangeError);
    expect(() => simulateSoundVibration({ sound: 'on', loud: 'weak', object: 'piano' as never, seed: 'yellow' })).toThrow(RangeError);
    expect(() => simulateSoundVibration({ sound: 'on', loud: 'weak', object: 'drum', seed: 'green' as never })).toThrow(RangeError);
  });
});

describe('validateSoundVibrationExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(soundJson.experiments[1])) as VariableExperiment;

  it('g3-sound 활동 2 매니페스트는 통과한다', () => {
    expect(validateSoundVibrationExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'seed');
    expect(validateSoundVibrationExperiment(a).join()).toContain('"seed"');
    const b = exp();
    b.variables.find((v) => v.key === 'sound')!.options.push({ value: 'maybe', label: 'x' });
    b.variables.find((v) => v.key === 'loud')!.options.push({ value: 3, label: 'y' });
    b.variables.find((v) => v.key === 'object')!.options.push({ value: 'piano', label: 'z' });
    b.variables.find((v) => v.key === 'seed')!.options.push({ value: 'green', label: 'w' });
    expect(validateSoundVibrationExperiment(b)).toHaveLength(4);
  });
});
