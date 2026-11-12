import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  HT_COLORS,
  HT_GRID,
  HT_MATERIALS,
  HT_SPOTS,
  HT_TABLE,
  HT_TOTAL_S,
  changeTimeOf,
  changedCount,
  interpolateHeatTransfer,
  simulateHeatTransfer,
  stickersOf,
  validateHeatTransferExperiment,
  type HeatTransferParams,
  type HtColor,
  type HtMaterial,
  type HtSpot,
} from './heatTransfer';
import heatJson from '../../../../content/units/g5-heat/manifest.json';

const p = (material: HtMaterial, heatAt: HtSpot, stickerColor: HtColor = 'pink'): HeatTransferParams => ({ material, heatAt, stickerColor });

// 사양 §8 표 고정: [데우는 것, 데우는 곳, 시간(초), 열이 퍼진 모습]
const TABLE: [HtMaterial, HtSpot, number, 'plate' | 'water'][] = [
  ['copper', 'edge', 40, 'plate'],
  ['copper', 'center', 25, 'plate'],
  ['iron', 'edge', 120, 'plate'],
  ['iron', 'center', 75, 'plate'],
  ['water', 'edge', 60, 'water'],
  ['water', 'center', 45, 'water'],
];

describe('열이 이동하는 모습 모델: 사양 표 6칸 × 색 두 가지', () => {
  for (const color of HT_COLORS) {
    for (const [material, spot, time, path] of TABLE) {
      it(`${color}, ${material}, ${spot}: ${time}초 ${path}`, () => {
        expect(simulateHeatTransfer(p(material, spot, color)).result).toEqual({ time, path });
      });
    }
  }

  it('붙임딱지(색소) 색은 모든 조건에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const m of HT_MATERIALS) for (const s of HT_SPOTS) expect(simulateHeatTransfer(p(m, s, 'blue'))).toEqual(simulateHeatTransfer(p(m, s, 'pink')));
  });

  it('가운데를 데우면 가장자리를 데울 때보다 빨리 먼 곳까지 전해지고, 구리판이 철판보다 빠르다', () => {
    for (const m of HT_MATERIALS) expect(HT_TABLE[m].center).toBeLessThan(HT_TABLE[m].edge);
    expect(HT_TABLE.copper.edge).toBeLessThan(HT_TABLE.iron.edge);
    expect(HT_TABLE.copper.center).toBeLessThan(HT_TABLE.iron.center);
  });
});

describe('열이 이동하는 모습 모델: 붙임딱지 격자', () => {
  it('7 × 7 = 49개이고 데운 곳에 가까운 순서로 놓이며 거리 비율이 0에서 1까지다', () => {
    for (const spot of HT_SPOTS) {
      const list = stickersOf(spot);
      expect(list).toHaveLength(HT_GRID * HT_GRID);
      expect(list[0]!.frac).toBe(0);
      expect(list.at(-1)!.frac).toBe(1);
      for (let i = 1; i < list.length; i++) expect(list[i]!.frac).toBeGreaterThanOrEqual(list[i - 1]!.frac);
    }
    // 가장자리는 왼쪽 변 가운데(0, 3), 가운데는 (3, 3)이 가장 가깝다.
    expect([stickersOf('edge')[0]!.col, stickersOf('edge')[0]!.row]).toEqual([0, 3]);
    expect([stickersOf('center')[0]!.col, stickersOf('center')[0]!.row]).toEqual([3, 3]);
  });

  it('데운 곳에서 멀수록 색이 늦게 바뀐다: 바뀌는 때는 거리에 비례하고 가장 먼 것은 걸린 시간에 바뀐다', () => {
    for (const [, spot, time] of TABLE.filter((r) => r[0] === 'copper')) {
      const list = stickersOf(spot);
      const times = list.map((s) => changeTimeOf(s.frac, time));
      expect(times.at(-1)).toBe(time);
      for (let i = 1; i < times.length; i++) expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
      expect(changedCount(spot, time, 0)).toBe(0);
      expect(changedCount(spot, time, time)).toBe(49);
      expect(changedCount(spot, time, time - 0.01)).toBeLessThan(49);
    }
  });
});

describe('열이 이동하는 모습 모델: 표본', () => {
  it('0~130초 1초 간격 131개이고 0에서 시작해 걸린 시간에 100 %가 되며 그 뒤 멈춰 있다', () => {
    for (const [material, spot, time] of TABLE) {
      const { samples } = simulateHeatTransfer(p(material, spot));
      expect(samples).toHaveLength(HT_TOTAL_S + 1);
      expect(samples[0]).toEqual({ t: 0, pct: 0, front: 0 });
      expect(samples.at(-1)!.t).toBe(130);
      expect(samples[time]!.pct, `${material} ${spot}`).toBe(100);
      expect(samples[time - 1]!.pct).toBeLessThan(100);
      expect(samples[time]!.front).toBe(1);
      for (const s of samples.filter((x) => x.t >= time)) expect([s.pct, s.front]).toEqual([100, 1]);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.pct).toBeGreaterThanOrEqual(samples[i - 1]!.pct);
    }
  });

  it('물은 색소가 퍼진 비율이 시간에 비례해 늘어난다', () => {
    const { samples } = simulateHeatTransfer(p('water', 'edge'));
    expect(samples[30]!.pct).toBeCloseTo(50, 9);
    expect(samples[30]!.front).toBeCloseTo(0.5, 9);
  });

  it('선형 보간과 범위 밖 입력 거부', () => {
    const { samples } = simulateHeatTransfer(p('copper', 'edge'));
    const m = interpolateHeatTransfer(samples[10]!, samples[11]!, 0.5);
    expect(m.t).toBeCloseTo(10.5, 9);
    expect(m.pct).toBeCloseTo((samples[10]!.pct + samples[11]!.pct) / 2, 9);
    expect(() => simulateHeatTransfer({ ...p('copper', 'edge'), material: 'gold' as never })).toThrow(RangeError);
    expect(() => simulateHeatTransfer({ ...p('copper', 'edge'), heatAt: 'corner' as never })).toThrow(RangeError);
    expect(() => simulateHeatTransfer({ ...p('copper', 'edge'), stickerColor: 'red' as never })).toThrow(RangeError);
  });
});

describe('validateHeatTransferExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(heatJson.experiments[3])) as VariableExperiment;

  it('g5-heat 활동 4 매니페스트는 통과한다', () => {
    expect(validateHeatTransferExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'stickerColor');
    expect(validateHeatTransferExperiment(a).join()).toContain('"stickerColor"');
    const b = exp();
    b.variables.find((v) => v.key === 'material')!.options.push({ value: 'gold', label: 'x' });
    b.variables.find((v) => v.key === 'heatAt')!.options.push({ value: 'corner', label: 'y' });
    b.variables.find((v) => v.key === 'stickerColor')!.options.push({ value: 'red', label: 'z' });
    expect(validateHeatTransferExperiment(b)).toHaveLength(3);
  });
});
