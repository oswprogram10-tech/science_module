import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { arrivalS, interpolateRamp, simulateRamp, validateRampExperiment, type CartLoad, type FloorKind, type RampParams } from './motion';
import motionJson from '../../../../content/units/g6-motion/manifest.json';

const p = (heightCm: number, floor: FloorKind, load: CartLoad = 0): RampParams => ({ heightCm, floor, load });

// 사양 §2.1: [바닥, 높이(cm), 걸린 시간(초), 속력(m/s), 반올림 전 t1m]
const TABLE: [FloorKind, number, number, number, number][] = [
  ['wood', 10, 0.8, 1.25, 0.8002],
  ['wood', 20, 0.55, 1.82, 0.5481],
  ['wood', 40, 0.38, 2.63, 0.3818],
  ['towel', 10, 0.95, 1.05, 0.9547],
  ['towel', 20, 0.59, 1.69, 0.5862],
  ['towel', 40, 0.39, 2.56, 0.3936],
];

describe('경사면 수레 모델: 사양 기준값 6칸 × 추 두 가지', () => {
  for (const load of [0, 2] as const) {
    for (const [floor, h, timeS, speed, t1m] of TABLE) {
      it(`${floor} ${h} cm 추 ${load}개 → ${timeS}초, ${speed} m/s`, () => {
        const r = simulateRamp(p(h, floor, load)).result;
        expect(r.timeS).toBe(timeS);
        expect(r.speed).toBe(speed);
        expect(Math.abs(arrivalS(p(h, floor, load)) - t1m)).toBeLessThanOrEqual(0.00005);
      });
    }
  }

  it('추만 바꾸면 결과와 샘플이 같다', () => {
    for (const [floor, h] of TABLE) expect(simulateRamp(p(h, floor, 2))).toEqual(simulateRamp(p(h, floor, 0)));
  });

  it('높을수록 걸린 시간이 짧고 속력이 크며, 수건이 나무보다 느리다', () => {
    for (const floor of ['wood', 'towel'] as const) {
      const r = [10, 20, 40].map((h) => simulateRamp(p(h, floor)).result);
      expect(r[0]!.timeS).toBeGreaterThan(r[1]!.timeS);
      expect(r[1]!.timeS).toBeGreaterThan(r[2]!.timeS);
      expect(r[0]!.speed).toBeLessThan(r[1]!.speed);
      expect(r[1]!.speed).toBeLessThan(r[2]!.speed);
    }
    for (const h of [10, 20, 40]) expect(simulateRamp(p(h, 'towel')).result.speed).toBeLessThan(simulateRamp(p(h, 'wood')).result.speed);
  });

  it('speed × timeS는 1에서 ±0.01 안이다', () => {
    for (const [floor, h] of TABLE) {
      const r = simulateRamp(p(h, floor)).result;
      expect(Math.abs(r.speed * r.timeS - 1)).toBeLessThanOrEqual(0.01);
    }
  });
});

describe('경사면 수레 모델: 움직임', () => {
  it('t = 0 에서 x = 0, 마지막 샘플은 t = 1.2 이고 0.01초 간격이다', () => {
    for (const [floor, h] of TABLE) {
      const { samples } = simulateRamp(p(h, floor));
      expect(samples[0]).toEqual({ t: 0, x: 0, v: expect.any(Number) });
      expect(samples).toHaveLength(121);
      expect(samples[samples.length - 1]!.t).toBe(1.2);
    }
  });

  it('x는 단조 비감소이고 1.5를 넘지 않는다', () => {
    for (const [floor, h] of TABLE) {
      const { samples } = simulateRamp(p(h, floor));
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.x).toBeGreaterThanOrEqual(samples[i - 1]!.x);
      for (const s of samples) {
        expect(s.x).toBeLessThanOrEqual(1.5);
        expect(s.v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('40 cm는 멈춤 벽(1.5 m)에 닿아 머물고 빠르기는 0이 된다, 10 cm 나무 판은 벽에 닿지 않는다', () => {
    const fast = simulateRamp(p(40, 'wood')).samples;
    expect(fast[fast.length - 1]).toMatchObject({ x: 1.5, v: 0 });
    const slow = simulateRamp(p(10, 'wood')).samples;
    expect(slow[slow.length - 1]!.x).toBeLessThan(1.5);
    expect(slow[slow.length - 1]!.v).toBeGreaterThan(0);
  });

  it('t1m에서 x는 1이다 (±0.005)', () => {
    for (const [floor, h] of TABLE) {
      const t = arrivalS(p(h, floor));
      const { samples } = simulateRamp(p(h, floor));
      const before = samples.filter((s) => s.t <= t).pop()!;
      const after = samples.find((s) => s.t >= t)!;
      const k = after.t === before.t ? 0 : (t - before.t) / (after.t - before.t);
      expect(Math.abs(interpolateRamp(before, after, k).x - 1)).toBeLessThanOrEqual(0.005);
    }
  });

  it('보간은 선형이다', () => {
    expect(interpolateRamp({ t: 0, x: 0, v: 2 }, { t: 1, x: 1, v: 1 }, 0.5)).toEqual({ t: 0.5, x: 0.5, v: 1.5 });
  });

  it('같은 입력이면 같은 출력이다 (순수 함수)', () => {
    expect(simulateRamp(p(20, 'wood'))).toEqual(simulateRamp(p(20, 'wood')));
  });
});

describe('경사면 수레 모델: 입력 검사', () => {
  it('범위 밖 입력은 RangeError를 던진다', () => {
    expect(() => simulateRamp(p(4, 'wood'))).toThrow(RangeError);
    expect(() => simulateRamp(p(51, 'wood'))).toThrow(RangeError);
    expect(() => simulateRamp(p(20, 'ice' as FloorKind))).toThrow(RangeError);
    expect(() => simulateRamp(p(20, 'wood', 1 as CartLoad))).toThrow(RangeError);
    expect(() => simulateRamp(p(5, 'towel'))).toThrow(RangeError); // 1 m에 못 미친다
  });
});

describe('validateRampExperiment', () => {
  const clone = () => JSON.parse(JSON.stringify(motionJson.experiments[0])) as VariableExperiment;

  it('매니페스트는 통과한다', () => {
    expect(validateRampExperiment(clone())).toEqual([]);
  });

  it('변인이 없거나 값이 범위를 벗어나면 오류를 낸다', () => {
    const noFloor = clone();
    noFloor.variables = noFloor.variables.filter((v) => v.key !== 'floor');
    expect(validateRampExperiment(noFloor).join('\n')).toContain('"floor"');
    const high = clone();
    high.variables.find((v) => v.key === 'heightCm')!.options.push({ value: 60, label: '60 cm' });
    expect(validateRampExperiment(high).join('\n')).toContain('5~50');
    const badFloor = clone();
    badFloor.variables.find((v) => v.key === 'floor')!.options.push({ value: 'ice', label: '얼음' });
    expect(validateRampExperiment(badFloor).join('\n')).toContain('wood, towel');
    const badLoad = clone();
    badLoad.variables.find((v) => v.key === 'load')!.options.push({ value: 1, label: '1개' });
    expect(validateRampExperiment(badLoad).join('\n')).toContain('0 또는 2');
  });

  it('1 m에 닿지 못하는 조합(5 cm 수건)은 거부한다', () => {
    const e = clone();
    e.variables.find((v) => v.key === 'heightCm')!.options.push({ value: 5, label: '5 cm' });
    expect(validateRampExperiment(e).join('\n')).toContain('1 m에 닿지 못합니다');
  });
});
