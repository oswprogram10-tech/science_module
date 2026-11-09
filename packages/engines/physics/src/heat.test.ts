import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  interpolateInsulatedCup,
  simulateInsulatedCup,
  validateInsulatedCupExperiment,
  type InsulatedCupParams,
} from './heat';
import heatJson from '../../../../content/units/g5-heat/manifest.json';

const base: InsulatedCupParams = { wrap: 'none', layers: 1, lid: 'off', waterMl: 200 };
const run = (p: Partial<InsulatedCupParams> = {}) => simulateInsulatedCup({ ...base, ...p });
const drop = (p: Partial<InsulatedCupParams> = {}) => run(p).result.dropC;

describe('보온 컵 모델', () => {
  it('기준값: 감싸지 않음, 1겹, 뚜껑 없음, 200 mL에서 τ ≈ 2853초, 10분 뒤 7.6 °C 식는다', () => {
    const r = run().result;
    expect(r).toEqual({ endC: 52.4, dropC: 7.6, surfaceSideStartC: 60 });
    // τ = C / UA: 마지막 샘플의 지수 감쇠에서 거꾸로 구한다.
    const last = run().samples.at(-1)!;
    const tau = -600 / Math.log((last.waterC - 20) / 40);
    expect(tau).toBeGreaterThan(2853 - 1);
    expect(tau).toBeLessThan(2853 + 1);
    expect(Math.abs(r.dropC - 7.6)).toBeLessThanOrEqual(0.1);
  });

  it('각 조건의 식은 정도 (실제 값 고정)', () => {
    expect(drop({ wrap: 'paper' })).toBe(7.5);
    expect(drop({ wrap: 'foil' })).toBe(5.4);
    expect(drop({ wrap: 'bubble' })).toBe(5.2);
    expect(drop({ wrap: 'cotton' })).toBe(4.9);
    expect(drop({ lid: 'on' })).toBe(5.9);
    expect(drop({ waterMl: 100 })).toBe(9.7);
  });

  it('식은 정도 순서: none ≥ paper > foil > bubble > cotton', () => {
    const d = (wrap: InsulatedCupParams['wrap']) => drop({ wrap });
    expect(d('none')).toBeGreaterThanOrEqual(d('paper'));
    expect(d('paper')).toBeGreaterThan(d('foil'));
    expect(d('foil')).toBeGreaterThan(d('bubble'));
    expect(d('bubble')).toBeGreaterThan(d('cotton'));
  });

  it('종이와 감싸지 않음의 차이는 0.3 °C 이하', () => {
    expect(drop() - drop({ wrap: 'paper' })).toBeLessThanOrEqual(0.3);
  });

  it('wrap = none이면 겹 수가 결과에 영향이 없다', () => {
    expect(run({ wrap: 'none', layers: 2 })).toEqual(run({ wrap: 'none', layers: 1 }));
    expect(drop({ wrap: 'cotton', layers: 2 })).toBeLessThan(drop({ wrap: 'cotton', layers: 1 }));
  });

  it('뚜껑을 덮으면 덜 식는다', () => {
    expect(drop({ lid: 'on' })).toBeLessThan(drop());
  });

  it('물 100 mL는 200 mL보다 많이 식는다', () => {
    expect(drop({ waterMl: 100 })).toBeGreaterThan(drop({ waterMl: 200 }));
  });

  it('모든 샘플에서 waterC는 단조 감소하고 roomC보다 크며, surfaceSideC는 roomC와 waterC 사이에 있다', () => {
    for (const wrap of ['none', 'paper', 'cotton', 'bubble', 'foil'] as const) {
      for (const lid of ['on', 'off'] as const) {
        const { samples } = run({ wrap, lid, layers: 2 });
        expect(samples).toHaveLength(121);
        expect(samples[0]!.t).toBe(0);
        expect(samples.at(-1)!.t).toBe(600);
        samples.forEach((s, i) => {
          if (i > 0) expect(s.waterC).toBeLessThan(samples[i - 1]!.waterC);
          expect(s.waterC).toBeGreaterThan(20);
          expect(s.surfaceSideC).toBeGreaterThanOrEqual(20);
          expect(s.surfaceSideC).toBeLessThanOrEqual(s.waterC + 1e-9);
          expect(s.surfaceTopC).toBeGreaterThanOrEqual(20);
          expect(s.surfaceTopC).toBeLessThanOrEqual(s.waterC + 1e-9);
          expect(s.lossSideW).toBeGreaterThan(0);
          expect(s.lossTopW).toBeGreaterThan(0);
        });
      }
    }
  });

  it('솜으로 감싼 컵의 처음 바깥 온도는 감싸지 않은 컵보다 낮다', () => {
    expect(run({ wrap: 'cotton' }).result.surfaceSideStartC).toBeLessThan(run().result.surfaceSideStartC);
  });

  it('뚜껑이 없으면 윗면은 물과 같은 온도, 덮으면 더 낮다', () => {
    const open = run().samples[0]!;
    expect(open.surfaceTopC).toBe(open.waterC);
    expect(run({ lid: 'on' }).samples[0]!.surfaceTopC).toBeLessThan(60);
  });

  it('순수 함수: 같은 입력은 항상 같은 결과', () => {
    expect(run({ wrap: 'bubble' })).toEqual(run({ wrap: 'bubble' }));
  });

  it('옵션을 바꿀 수 있고, 범위 밖 입력은 RangeError', () => {
    expect(simulateInsulatedCup(base, { startC: 80, durationS: 300 }).samples.at(-1)!.t).toBe(300);
    expect(() => run({ waterMl: 10 })).toThrow(RangeError);
    expect(() => run({ lid: 'half' as never })).toThrow(RangeError);
    expect(() => run({ wrap: 'wool' as never })).toThrow(RangeError);
    expect(() => simulateInsulatedCup(base, { startC: 20 })).toThrow(RangeError);
  });

  it('보간은 양 끝에서 각 샘플과 같고 가운데는 평균이다', () => {
    const [a, b] = run().samples;
    expect(interpolateInsulatedCup(a!, b!, 0)).toEqual(a);
    expect(interpolateInsulatedCup(a!, b!, 1)).toEqual(b);
    expect(interpolateInsulatedCup(a!, b!, 0.5).waterC).toBeCloseTo((a!.waterC + b!.waterC) / 2, 9);
  });
});

describe('보온 컵 매니페스트 검증', () => {
  const clone = () => JSON.parse(JSON.stringify(heatJson)).experiments[0] as VariableExperiment;
  const variable = (e: VariableExperiment, key: string) => e.variables.find((v) => v.key === key)!;

  it('g5-heat 매니페스트는 통과한다', () => {
    expect(validateInsulatedCupExperiment(clone())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류', () => {
    const noLid = clone();
    noLid.variables = noLid.variables.filter((v) => v.key !== 'lid');
    expect(validateInsulatedCupExperiment(noLid).join()).toContain('lid');

    const badWrap = clone();
    variable(badWrap, 'wrap').options[0]!.value = 'wool';
    expect(validateInsulatedCupExperiment(badWrap).join()).toContain('wrap');

    const badLayers = clone();
    variable(badLayers, 'layers').options[0]!.value = 4;
    expect(validateInsulatedCupExperiment(badLayers).join()).toContain('layers');

    const badWater = clone();
    variable(badWater, 'waterMl').options[0]!.value = 1000;
    expect(validateInsulatedCupExperiment(badWater).join()).toContain('waterMl');

    const badLid = clone();
    variable(badLid, 'lid').options[0]!.value = 'half';
    expect(validateInsulatedCupExperiment(badLid).join()).toContain('lid');
  });

  it('startC가 roomC보다 커야 한다', () => {
    const e = clone();
    e.params = { startC: 20, roomC: 20, durationS: 600 };
    expect(validateInsulatedCupExperiment(e).join()).toContain('startC');
    e.params = {};
    expect(validateInsulatedCupExperiment(e).join()).toContain('startC');
  });
});

describe('알루미늄 포일(얇은 공기층 근사)', () => {
  it('포일로 감싼 컵은 열화상에서 맨 컵보다 바깥이 덜 뜨겁다', () => {
    const bare = run({ wrap: 'none' }).result.surfaceSideStartC;
    const foil = run({ wrap: 'foil' }).result.surfaceSideStartC;
    expect(foil).toBeLessThan(bare);
    expect(foil).toBeCloseTo(55.7, 1);
  });
});
