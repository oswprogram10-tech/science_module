import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  PT_FLASH_S,
  PT_OBJECTS,
  PT_SAME_M,
  PT_SAMPLE_S,
  PT_SPEED_MS,
  PT_START_M,
  PT_WATCH_S,
  PT_WEATHER,
  flashPositions,
  interpolatePositionTime,
  positionAt,
  simulatePositionTime,
  validatePositionTimeExperiment,
  type PositionTimeParams,
  type PtObject,
} from './positionTime';
import motionJson from '../../../../content/units/g6-motion/manifest.json';

const p = (object: PtObject, watchS = 5, weather: 'sunny' | 'cloudy' = 'sunny'): PositionTimeParams => ({ object, watchS, weather });

// 사양 §7 표 고정: [물체, 관찰 시간, 움직인 거리, 나중 위치]
const TABLE: [PtObject, number, number, number][] = [
  ['bike', 5, 20, 20],
  ['bike', 10, 40, 40],
  ['walker', 5, 6, 6],
  ['walker', 10, 12, 12],
  ['snail', 5, 0.05, 0.05],
  ['snail', 10, 0.1, 0.1],
  ['tree', 5, 0, 0],
  ['tree', 10, 0, 0],
];

describe('시간에 따른 위치 변화 모델: 사양 기준값', () => {
  it('빠르기는 자전거 4, 걷는 사람 1.2, 달팽이 0.01, 나무 0 m/s이고 출발 위치는 0이다', () => {
    expect(PT_SPEED_MS).toEqual({ bike: 4, walker: 1.2, snail: 0.01, tree: 0 });
    expect(PT_START_M).toBe(0);
    expect(PT_OBJECTS).toEqual(['bike', 'walker', 'snail', 'tree']);
    expect(PT_WATCH_S).toEqual([5, 10]);
    expect(PT_WEATHER).toEqual(['sunny', 'cloudy']);
  });

  it('사양 표: 5초 자전거 20.00, 사람 6.00, 달팽이 0.05, 나무 0.00 (10초는 두 배)', () => {
    for (const [o, s, dist, end] of TABLE) expect(simulatePositionTime(p(o, s)).result, `${o} ${s}`).toEqual({ distM: dist, endM: end });
  });

  it('거리 = 빠르기 × 시간 (소수 부동소수점 오차 없이 소수 둘째 자리)', () => {
    for (const o of PT_OBJECTS) for (const s of PT_WATCH_S) expect(simulatePositionTime(p(o, s)).result.distM).toBe(Math.round(PT_SPEED_MS[o] * s * 100) / 100);
    expect(positionAt('walker', 3)).toBe(3.6);
    expect(positionAt('walker', 7)).toBe(8.4);
    expect(positionAt('snail', 3)).toBe(0.03);
  });

  it('나중 위치는 출발 위치(0)에 움직인 거리를 더한 값이다', () => {
    for (const o of PT_OBJECTS) for (const s of PT_WATCH_S) {
      const { result } = simulatePositionTime(p(o, s));
      expect(result.endM).toBe(PT_START_M + result.distM);
    }
  });

  it('날씨는 모든 조건(8가지)에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const o of PT_OBJECTS) for (const s of PT_WATCH_S) expect(simulatePositionTime(p(o, s, 'cloudy'))).toEqual(simulatePositionTime(p(o, s, 'sunny')));
  });

  it('반올림 경계: 달팽이 1초 0.01, 나무 0은 −0이 아니다, 같은 결과 기준은 0.01 한 칸의 절반', () => {
    expect(positionAt('snail', 1)).toBe(0.01);
    expect(Object.is(simulatePositionTime(p('tree')).result.distM, 0)).toBe(true);
    expect(PT_SAME_M).toBe(0.005);
    // 결과를 소수 둘째 자리로 쓰므로 서로 다른 두 결과의 차는 언제나 같은 결과 기준보다 크다.
    const dists = [...new Set(TABLE.map((r) => r[2]))].sort((a, b) => a - b);
    for (let i = 1; i < dists.length; i++) expect(dists[i]! - dists[i - 1]!).toBeGreaterThan(PT_SAME_M);
  });
});

describe('시간에 따른 위치 변화 모델: 표본과 섬광', () => {
  it('0초부터 관찰 시간까지 0.25초 간격이고 위치는 줄지 않는다', () => {
    for (const o of PT_OBJECTS) for (const s of PT_WATCH_S) {
      const { samples, result } = simulatePositionTime(p(o, s));
      expect(samples).toHaveLength(s / PT_SAMPLE_S + 1);
      expect(samples[0]).toEqual({ t: 0, posM: 0 });
      expect(samples.at(-1)).toEqual({ t: s, posM: result.endM });
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]!.t - samples[i - 1]!.t).toBeCloseTo(PT_SAMPLE_S, 9);
        expect(samples[i]!.posM).toBeGreaterThanOrEqual(samples[i - 1]!.posM);
      }
    }
  });

  it('그래프 y축 0~40 m 안에 언제나 들어온다', () => {
    for (const o of PT_OBJECTS) for (const s of PT_WATCH_S) expect(Math.max(...simulatePositionTime(p(o, s)).samples.map((x) => x.posM))).toBeLessThanOrEqual(40);
  });

  it('1초 간격 섬광: 0초부터 관찰 시간까지, 위치는 빠르기 × 시간', () => {
    expect(PT_FLASH_S).toBe(1);
    expect(flashPositions('bike', 5)).toEqual([0, 1, 2, 3, 4, 5].map((t) => ({ t, posM: 4 * t })));
    expect(flashPositions('walker', 5).map((f) => f.posM)).toEqual([0, 1.2, 2.4, 3.6, 4.8, 6]);
    expect(flashPositions('snail', 10)).toHaveLength(11);
    expect(flashPositions('tree', 10).every((f) => f.posM === 0)).toBe(true);
  });

  it('선형 보간', () => {
    const { samples } = simulatePositionTime(p('bike', 10));
    const m = interpolatePositionTime(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(1.125, 9);
    expect(m.posM).toBeCloseTo(4.5, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulatePositionTime(p('car' as never))).toThrow(RangeError);
    expect(() => simulatePositionTime(p('bike', 7))).toThrow(RangeError);
    expect(() => simulatePositionTime({ ...p('bike'), watchS: '5' as never })).toThrow(RangeError);
    expect(() => simulatePositionTime(p('bike', 5, 'rainy' as never))).toThrow(RangeError);
  });
});

describe('validatePositionTimeExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(motionJson.experiments[1])) as VariableExperiment;

  it('g6-motion 활동 2 매니페스트는 통과한다', () => {
    expect(validatePositionTimeExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'weather');
    expect(validatePositionTimeExperiment(a).join()).toContain('"weather"');
    const b = exp();
    b.variables.find((v) => v.key === 'object')!.options.push({ value: 'car', label: 'x' });
    b.variables.find((v) => v.key === 'watchS')!.options.push({ value: 7, label: 'y' });
    b.variables.find((v) => v.key === 'weather')!.options.push({ value: 'rainy', label: 'z' });
    expect(validatePositionTimeExperiment(b)).toHaveLength(3);
  });
});
