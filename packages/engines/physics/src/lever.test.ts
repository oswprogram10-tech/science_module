import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { THETA_MAX, interpolateLever, simulateLever, validateLeverExperiment, type LeverParams, type TiltSide, type WeightShape } from './lever';
import forceJson from '../../../../content/units/g3-force/manifest.json';

const lever = (count: number, distance: number, shape: WeightShape = 'cylinder'): LeverParams => ({ count, distance, shape });

// 사양 §2.1: [추 수, 거리, 기울어진 쪽, 오른쪽 끝 높이(cm), tTouch(초)]
const TABLE: [number, number, TiltSide, number, number | null][] = [
  [1, 2, 'left', 20, 0.234],
  [1, 4, 'left', 20, 0.299],
  [1, 8, 'level', 10, null],
  [2, 2, 'left', 20, 0.291],
  [2, 4, 'level', 10, null],
  [2, 8, 'right', 0, 0.277],
  [4, 2, 'level', 10, null],
  [4, 4, 'right', 0, 0.241],
  [4, 8, 'right', 0, 0.194],
];

describe('막대 모델: 사양 기준값 9칸 × 모양 두 가지', () => {
  for (const shape of ['cylinder', 'cube'] as const) {
    for (const [count, distance, side, height, touch] of TABLE) {
      it(`${shape} ${count}개 ${distance}칸`, () => {
        const r = simulateLever(lever(count, distance, shape)).result;
        expect(r.side).toBe(side);
        expect(r.rightHeightCm).toBe(height);
        if (touch === null) expect(r.touchS).toBeNull();
        else expect(Math.abs(r.touchS! - touch)).toBeLessThanOrEqual(0.001);
      });
    }
  }

  it('모양만 바꾸면 결과와 샘플이 같다', () => {
    for (const [count, distance] of TABLE) {
      expect(simulateLever(lever(count, distance, 'cube'))).toEqual(simulateLever(lever(count, distance, 'cylinder')));
    }
  });
});

describe('막대 모델: 움직임', () => {
  it('기울 때 |angleDeg|는 단조 증가하다가 θmax에서 멈춘다', () => {
    const max = (THETA_MAX * 180) / Math.PI;
    for (const [count, distance, side, , touch] of TABLE) {
      if (side === 'level') continue;
      const { samples } = simulateLever(lever(count, distance));
      const abs = samples.map((s) => Math.abs(s.angleDeg));
      for (let i = 1; i < abs.length; i++) expect(abs[i]!).toBeGreaterThanOrEqual(abs[i - 1]!);
      expect(abs[0]).toBe(0);
      expect(abs[abs.length - 1]!).toBeCloseTo(max, 6);
      expect(max).toBeCloseTo(12.84, 1);
      // 닿은 뒤에는 변하지 않는다.
      for (const s of samples.filter((x) => x.t > touch! + 0.011)) expect(Math.abs(s.angleDeg)).toBeCloseTo(max, 6);
      // 부호: 오른쪽이 내려가면 +
      expect(Math.sign(samples[samples.length - 1]!.angleDeg)).toBe(side === 'right' ? 1 : -1);
    }
  });

  it('수평 조건은 모든 샘플이 0°, 10 cm이다', () => {
    for (const [count, distance, side] of TABLE) {
      if (side !== 'level') continue;
      for (const s of simulateLever(lever(count, distance)).samples) {
        expect(s.angleDeg).toBe(0);
        expect(s.rightHeightCm).toBe(10);
      }
    }
  });

  it('오른쪽 끝 높이는 10에서 시작해 0 또는 20에서 멈춘다', () => {
    const { samples } = simulateLever(lever(4, 8));
    expect(samples[0]!.rightHeightCm).toBe(10);
    expect(samples[samples.length - 1]!.rightHeightCm).toBeCloseTo(0, 9);
    expect(samples.every((s) => s.rightHeightCm > -1e-9 && s.rightHeightCm < 20 + 1e-9)).toBe(true);
    expect(simulateLever(lever(1, 2)).samples.at(-1)!.rightHeightCm).toBeCloseTo(20, 9);
  });

  it('마지막 샘플은 t = 1이고 표본은 0.01초 간격 101개다', () => {
    for (const [count, distance] of TABLE) {
      const { samples } = simulateLever(lever(count, distance));
      expect(samples[0]!.t).toBe(0);
      expect(samples[samples.length - 1]!.t).toBe(1);
      expect(samples).toHaveLength(101);
    }
  });

  it('화면용 돌리려는 정도: 왼쪽 8, 오른쪽 추의 수 × 거리', () => {
    const s = simulateLever(lever(4, 2)).samples[0]!;
    expect([s.leftTurn, s.rightTurn]).toEqual([8, 8]);
    const t = simulateLever(lever(1, 4)).samples[0]!;
    expect([t.leftTurn, t.rightTurn]).toEqual([8, 4]);
  });

  it('옵션: 시간·간격을 바꿀 수 있고 잘못된 값은 거부한다', () => {
    expect(simulateLever(lever(4, 8), { durationS: 0.5, sampleEveryS: 0.1 }).samples.map((s) => s.t)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(() => simulateLever(lever(4, 8), { durationS: 0 })).toThrow(RangeError);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateLever(lever(0, 4))).toThrow(RangeError);
    expect(() => simulateLever(lever(7, 4))).toThrow(RangeError);
    expect(() => simulateLever(lever(1.5, 4))).toThrow(RangeError);
    expect(() => simulateLever(lever(2, 9))).toThrow(RangeError);
    expect(() => simulateLever({ count: 2, distance: 4, shape: 'ball' as never })).toThrow(RangeError);
  });

  it('선형 보간', () => {
    const a = simulateLever(lever(4, 8)).samples[10]!;
    const b = simulateLever(lever(4, 8)).samples[11]!;
    const m = interpolateLever(a, b, 0.5);
    expect(m.angleDeg).toBeCloseTo((a.angleDeg + b.angleDeg) / 2, 9);
    expect(m.t).toBeCloseTo((a.t + b.t) / 2, 9);
  });
});

describe('validateLeverExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(forceJson.experiments[0])) as VariableExperiment;

  it('g3-force 매니페스트는 통과한다', () => {
    expect(validateLeverExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'shape');
    expect(validateLeverExperiment(a).join()).toContain('"shape"');
    const b = exp();
    b.variables.find((v) => v.key === 'count')!.options.push({ value: 7, label: '7개' });
    b.variables.find((v) => v.key === 'distance')!.options.push({ value: 2.5, label: 'x' });
    b.variables.find((v) => v.key === 'shape')!.options.push({ value: 'ball', label: 'y' });
    expect(validateLeverExperiment(b)).toHaveLength(3);
  });
});
