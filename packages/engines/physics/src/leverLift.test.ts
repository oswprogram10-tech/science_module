import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  ARM_CM,
  LIFT_ARMS,
  LIFT_COLORS,
  LIFT_HEIGHT_CM,
  LIFT_TOOLS,
  forceRaw,
  interpolateLeverLift,
  pullCmOf,
  simulateLeverLift,
  validateLeverLiftExperiment,
  type LeverLiftParams,
  type LiftArm,
  type LiftTool,
} from './leverLift';
import forceJson from '../../../../content/units/g3-force/manifest.json';

const p = (tool: LiftTool, arm: LiftArm, color: 'red' | 'blue' = 'red'): LeverLiftParams => ({ tool, arm, color });

// 사양 §1: [도구, 팔 길이, 저울 눈금(g), 손으로 당긴 거리(cm)]
const TABLE: [LiftTool, LiftArm, number, number][] = [
  ['none', 'short', 200, 20],
  ['none', 'mid', 200, 20],
  ['none', 'long', 200, 20],
  ['lever', 'short', 200, 20],
  ['lever', 'mid', 100, 40],
  ['lever', 'long', 67, 60],
  ['ramp', 'short', 110, 40],
  ['ramp', 'mid', 55, 80],
  ['ramp', 'long', 37, 120],
];

describe('지레와 빗면 모델: 사양 기준값 9칸 × 물체 색깔 두 가지', () => {
  for (const color of LIFT_COLORS) {
    for (const [tool, arm, force, pull] of TABLE) {
      it(`${color} ${tool} ${arm}: ${force} g · ${pull} cm`, () => {
        expect(simulateLeverLift(p(tool, arm, color)).result).toEqual({ force, pullCm: pull });
      });
    }
  }

  it('모든 조건(18가지)에서 물체 색깔을 바꿔도 결과와 표본이 같다 (대조 변인)', () => {
    for (const tool of LIFT_TOOLS) for (const arm of LIFT_ARMS) expect(simulateLeverLift(p(tool, arm, 'blue'))).toEqual(simulateLeverLift(p(tool, arm, 'red')));
  });

  it('도구 없이는 힘을 주는 쪽 길이를 바꿔도 결과가 같다', () => {
    for (const arm of LIFT_ARMS) expect(simulateLeverLift(p('none', arm))).toEqual(simulateLeverLift(p('none', 'short')));
  });

  it('지레와 빗면은 길이가 길수록 눈금이 줄고 손으로 당긴 거리가 늘어난다 (표 값의 단조성)', () => {
    for (const tool of ['lever', 'ramp'] as const) {
      const r = LIFT_ARMS.map((a) => simulateLeverLift(p(tool, a)).result);
      expect(r[0]!.force).toBeGreaterThan(r[1]!.force);
      expect(r[1]!.force).toBeGreaterThan(r[2]!.force);
      expect(r[0]!.pullCm).toBeLessThan(r[1]!.pullCm);
      expect(r[1]!.pullCm).toBeLessThan(r[2]!.pullCm);
    }
  });

  it('반올림 경계: 지레 길게는 66.67 → 67, 빗면 길게는 36.67 → 37, 빗면 중간은 55 (부동소수점 오차 없음)', () => {
    expect(forceRaw('lever', 'long')).toBeCloseTo(66.6667, 3);
    expect(forceRaw('ramp', 'long')).toBeCloseTo(36.6667, 3);
    expect(forceRaw('ramp', 'mid')).toBe(55);
    expect(forceRaw('ramp', 'short')).toBe(110);
    expect(forceRaw('lever', 'mid')).toBe(100);
    expect(Number.isInteger(simulateLeverLift(p('lever', 'long')).result.force)).toBe(true);
    // 힘 × 당긴 거리는 지레에서 4000 g·cm에 가깝게 보존된다(반올림 오차 안): 일의 이름은 화면에 쓰지 않는다.
    for (const arm of LIFT_ARMS) {
      const { force, pullCm } = simulateLeverLift(p('lever', arm)).result;
      expect(Math.abs(force * pullCm - 4000)).toBeLessThanOrEqual(20);
    }
  });

  it('길이 표: 지레 20/40/60 cm, 빗면 40/80/120 cm, 도구 없이 20 cm', () => {
    expect(ARM_CM).toEqual({ lever: { short: 20, mid: 40, long: 60 }, ramp: { short: 40, mid: 80, long: 120 } });
    expect(pullCmOf('none', 'long')).toBe(20);
    expect(LIFT_HEIGHT_CM).toBe(20);
  });
});

describe('지레와 빗면 모델: 표본', () => {
  it('손으로 당긴 거리 0에서 끝까지 1 cm 간격이고, 저울 눈금은 일정하며, 물체는 0에서 20 cm까지 비례해 올라간다', () => {
    for (const [tool, arm, force, pull] of TABLE) {
      const { samples } = simulateLeverLift(p(tool, arm));
      expect(samples).toHaveLength(pull + 1);
      expect(samples[0]).toEqual({ t: 0, force, liftCm: 0 });
      expect(samples.at(-1)).toEqual({ t: pull, force, liftCm: 20 });
      expect(samples.every((s) => s.force === force)).toBe(true);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]!.t - samples[i - 1]!.t).toBe(1);
        expect(samples[i]!.liftCm).toBeGreaterThan(samples[i - 1]!.liftCm);
      }
      expect(samples[Math.floor(pull / 2)]!.liftCm).toBeCloseTo(10 * (Math.floor(pull / 2) / (pull / 2)), 9);
    }
  });

  it('가로축 120 cm, 세로축 250 g 안에 모두 담긴다 (그래프 고정 범위)', () => {
    for (const [tool, arm] of TABLE) {
      const { samples } = simulateLeverLift(p(tool, arm));
      expect(Math.max(...samples.map((s) => s.t))).toBeLessThanOrEqual(120);
      expect(Math.max(...samples.map((s) => s.force))).toBeLessThanOrEqual(250);
    }
  });

  it('같은 조건은 몇 번을 돌려도 같다 (난수 없음)', () => {
    expect(simulateLeverLift(p('ramp', 'mid'))).toEqual(simulateLeverLift(p('ramp', 'mid')));
  });

  it('선형 보간', () => {
    const a = simulateLeverLift(p('lever', 'long')).samples[10]!;
    const b = simulateLeverLift(p('lever', 'long')).samples[11]!;
    const m = interpolateLeverLift(a, b, 0.5);
    expect(m.t).toBeCloseTo(10.5, 9);
    expect(m.force).toBe(67);
    expect(m.liftCm).toBeCloseTo((a.liftCm + b.liftCm) / 2, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateLeverLift({ tool: 'pulley' as never, arm: 'short', color: 'red' })).toThrow(RangeError);
    expect(() => simulateLeverLift({ tool: 'lever', arm: 'huge' as never, color: 'red' })).toThrow(RangeError);
    expect(() => simulateLeverLift({ tool: 'lever', arm: 'short', color: 'green' as never })).toThrow(RangeError);
    expect(() => simulateLeverLift({ tool: 'lever', arm: undefined as never, color: 'red' })).toThrow(RangeError);
  });
});

describe('validateLeverLiftExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(forceJson.experiments[1])) as VariableExperiment;

  it('g3-force 활동 2 매니페스트는 통과한다', () => {
    expect(validateLeverLiftExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'color');
    expect(validateLeverLiftExperiment(a).join()).toContain('"color"');
    const b = exp();
    b.variables.find((v) => v.key === 'tool')!.options.push({ value: 'pulley', label: 'x' });
    b.variables.find((v) => v.key === 'armCm')!.options.push({ value: 30, label: 'y' });
    b.variables.find((v) => v.key === 'color')!.options.push({ value: 'green', label: 'z' });
    expect(validateLeverLiftExperiment(b)).toHaveLength(3);
  });
});
