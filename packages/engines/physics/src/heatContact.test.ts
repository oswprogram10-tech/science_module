import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  HEAT_COLDS,
  HEAT_CUPS,
  HEAT_HOTS,
  HEAT_LABELS,
  HEAT_TOTAL_MIN,
  diffAt,
  finalC,
  interpolateHeatContact,
  rateOf,
  sameMinOf,
  simulateHeatContact,
  temperaturesAt,
  validateHeatContactExperiment,
  type HeatContactParams,
  type HeatCup,
} from './heatContact';
import heatJson from '../../../../content/units/g5-heat/manifest.json';

const p = (hotC: number, coldMl: number, cup: HeatCup, label: 'yellow' | 'green' = 'yellow'): HeatContactParams => ({ hotC, coldMl, cup, label });

// 사양 §5 식에서 계산해 고정한 표(사양 표는 근삿값이라 식을 따른다): [처음 온도, 찬물, 컵, 10분 뒤 안쪽, 10분 뒤 바깥, 같아지는 때(분)]
const TABLE: [number, number, HeatCup, number, number, number][] = [
  [50, 100, 'metal', 35, 35, 3],
  [50, 100, 'plastic', 35, 35, 9],
  [50, 300, 'metal', 28, 27, 5],
  [50, 300, 'plastic', 29, 27, 13],
  [60, 100, 'metal', 40, 40, 4],
  [60, 100, 'plastic', 40, 40, 10],
  [60, 300, 'metal', 30, 30, 5],
  [60, 300, 'plastic', 32, 29, 14],
  [70, 100, 'metal', 45, 45, 4],
  [70, 100, 'plastic', 45, 45, 10],
  [70, 300, 'metal', 33, 32, 5],
  [70, 300, 'plastic', 35, 32, 15],
];

describe('온도가 다른 두 물이 닿을 때 모델: 사양 식에서 계산한 기준값 12칸 × 이름표 색 두 가지', () => {
  for (const label of HEAT_LABELS) {
    for (const [hot, cold, cup, inner, outer, same] of TABLE) {
      it(`${label} ${hot} °C ${cold} mL ${cup}: 10분 뒤 ${inner}·${outer}, ${same}분`, () => {
        expect(simulateHeatContact(p(hot, cold, cup, label)).result).toEqual({ inner10: inner, outer10: outer, sameMin: same });
      });
    }
  }

  it('사양 표(60 °C): 나중 온도 Tf와 빠르기 k: 100 mL 금속 Tf 40·k 1.2, 플라스틱 k 0.4, 300 mL 금속 Tf 30·k 0.8, 플라스틱 k 0.267', () => {
    expect([finalC(p(60, 100, 'metal')), finalC(p(60, 300, 'metal'))]).toEqual([40, 30]);
    expect([rateOf(p(60, 100, 'metal')), rateOf(p(60, 100, 'plastic'))].map((k) => Math.round(k * 1000) / 1000)).toEqual([1.2, 0.4]);
    expect([rateOf(p(60, 300, 'metal')), rateOf(p(60, 300, 'plastic'))].map((k) => Math.round(k * 1000) / 1000)).toEqual([0.8, 0.267]);
  });

  it('사양 표(60 °C): 같아지는 때 = ceil(ln 40 / k): 4, 10, 5, 14 분이고 금속 100 mL의 10분 뒤는 40·40이다', () => {
    expect(TABLE.filter(([h]) => h === 60).map((r) => r[5])).toEqual([4, 10, 5, 14]);
    for (const [hot, cold, cup] of TABLE) {
      const k = rateOf(p(hot, cold, cup));
      expect(sameMinOf(p(hot, cold, cup))).toBe(Math.ceil(Math.log(hot - 20) / k));
    }
    expect(simulateHeatContact(p(60, 100, 'metal')).result).toMatchObject({ inner10: 40, outer10: 40 });
  });

  it('사양 표와 식이 다른 곳(보고용): 60 °C 100 mL 플라스틱 10분 뒤는 식으로 계산하면 안 40.4·바깥 39.6 → 40·40이다 (사양 표의 41·39는 식과 맞지 않는다)', () => {
    const { innerC, outerC } = temperaturesAt(p(60, 100, 'plastic'), 10);
    expect(innerC).toBeCloseTo(40 + 20 * Math.exp(-4), 9);
    expect(outerC).toBeCloseTo(40 - 20 * Math.exp(-4), 9);
    expect([Math.round(innerC), Math.round(outerC)]).toEqual([40, 40]);
  });

  it('이름표 색은 모든 조건(12가지)에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const h of HEAT_HOTS) for (const c of HEAT_COLDS) for (const cup of HEAT_CUPS) expect(simulateHeatContact(p(h, c, cup, 'green'))).toEqual(simulateHeatContact(p(h, c, cup, 'yellow')));
  });

  it('컵 재료는 빠르기만 바꾼다: 같은 조건에서 금속이 같아지는 때가 더 이르고, 나중 온도 Tf는 같다', () => {
    for (const h of HEAT_HOTS) for (const c of HEAT_COLDS) {
      expect(sameMinOf(p(h, c, 'metal'))!).toBeLessThan(sameMinOf(p(h, c, 'plastic'))!);
      const m = simulateHeatContact(p(h, c, 'metal')).samples.at(-1)!;
      const pl = simulateHeatContact(p(h, c, 'plastic')).samples.at(-1)!;
      expect(m.innerC).toBeCloseTo(finalC(p(h, c, 'metal')), 3);
      // 플라스틱은 느려서 20분 뒤에도 Tf보다 조금 높지만 Tf 아래로 내려가지는 않는다.
      expect(pl.innerC).toBeGreaterThanOrEqual(finalC(p(h, c, 'plastic')));
    }
  });

  it('찬물이 많으면 나중 온도가 낮고 (Tf 40 → 30) 같아지는 데 오래 걸린다(플라스틱), 처음 온도가 높으면 안쪽이 더 높다', () => {
    for (const h of HEAT_HOTS) {
      expect(finalC(p(h, 300, 'metal'))).toBeLessThan(finalC(p(h, 100, 'metal')));
      expect(sameMinOf(p(h, 300, 'plastic'))!).toBeGreaterThan(sameMinOf(p(h, 100, 'plastic'))!);
    }
    for (const c of HEAT_COLDS) for (const cup of HEAT_CUPS) {
      const r = HEAT_HOTS.map((h) => simulateHeatContact(p(h, c, cup)).result.inner10);
      expect(r[0]!).toBeLessThan(r[1]!);
      expect(r[1]!).toBeLessThan(r[2]!);
    }
  });

  it('차이 D(t) = (Th − 20) · e^(−kt), 안쪽 − 바깥 = D(t)', () => {
    for (const [hot, cold, cup] of TABLE) {
      for (const t of [0, 1, 5, 10, 20]) {
        const { innerC, outerC } = temperaturesAt(p(hot, cold, cup), t);
        expect(innerC - outerC).toBeCloseTo(diffAt(p(hot, cold, cup), t), 9);
      }
      expect(diffAt(p(hot, cold, cup), 0)).toBe(hot - 20);
    }
  });

  it('20분 안에 같아지지 않으면 sameMin은 null이다 (모델 범위 안의 12가지 조건은 모두 15분 이내)', () => {
    expect(Math.max(...TABLE.map((r) => r[5]))).toBeLessThanOrEqual(HEAT_TOTAL_MIN);
    // 모델 범위 밖의 아주 큰 처음 온도(검사를 건너뛰고 직접 부른 경우)는 20분 안에 1 °C 안이 되지 않는다.
    expect(sameMinOf({ hotC: 1e6, coldMl: 300, cup: 'plastic' })).toBeNull();
  });

  it('경계: 차이가 정확히 1 °C 이하가 되는 첫 정수 분(식 ceil(ln D₀ / k)와 같다)', () => {
    for (const [hot, cold, cup, , , same] of TABLE) {
      expect(diffAt(p(hot, cold, cup), same)).toBeLessThanOrEqual(1);
      expect(diffAt(p(hot, cold, cup), same - 1)).toBeGreaterThan(1);
    }
  });
});

describe('온도가 다른 두 물이 닿을 때 모델: 표본', () => {
  it('0~20분 0.25분 간격 81개이고, 안쪽은 처음 온도에서 바깥은 20 °C에서 시작해 Tf로 다가가며 두 선이 만나지 않는다', () => {
    for (const [hot, cold, cup] of TABLE) {
      const { samples } = simulateHeatContact(p(hot, cold, cup));
      expect(samples).toHaveLength(81);
      expect(samples[0]).toEqual({ t: 0, innerC: hot, outerC: 20 });
      expect(samples.at(-1)!.t).toBe(20);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]!.innerC).toBeLessThanOrEqual(samples[i - 1]!.innerC + 1e-9);
        expect(samples[i]!.outerC).toBeGreaterThanOrEqual(samples[i - 1]!.outerC - 1e-9);
        expect(samples[i]!.innerC).toBeGreaterThan(samples[i]!.outerC);
      }
      const tf = finalC(p(hot, cold, cup));
      for (const s of samples) {
        expect(s.innerC).toBeGreaterThanOrEqual(tf - 1e-9);
        expect(s.outerC).toBeLessThanOrEqual(tf + 1e-9);
        expect(s.innerC).toBeLessThanOrEqual(80);
        expect(s.outerC).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('결과의 10분 뒤 값은 표본의 10분 값을 반올림한 것과 같다', () => {
    for (const [hot, cold, cup] of TABLE) {
      const out = simulateHeatContact(p(hot, cold, cup));
      const s = out.samples.find((x) => x.t === 10)!;
      expect([Math.round(s.innerC), Math.round(s.outerC)]).toEqual([out.result.inner10, out.result.outer10]);
    }
  });

  it('선형 보간', () => {
    const { samples } = simulateHeatContact(p(60, 100, 'plastic'));
    const m = interpolateHeatContact(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(1.125, 9);
    expect(m.innerC).toBeCloseTo((samples[4]!.innerC + samples[5]!.innerC) / 2, 9);
    expect(m.outerC).toBeCloseTo((samples[4]!.outerC + samples[5]!.outerC) / 2, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateHeatContact(p(55, 100, 'metal'))).toThrow(RangeError);
    expect(() => simulateHeatContact(p(60, 200, 'metal'))).toThrow(RangeError);
    expect(() => simulateHeatContact({ ...p(60, 100, 'metal'), cup: 'glass' as never })).toThrow(RangeError);
    expect(() => simulateHeatContact({ ...p(60, 100, 'metal'), label: 'red' as never })).toThrow(RangeError);
  });
});

describe('validateHeatContactExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(heatJson.experiments[1])) as VariableExperiment;

  it('g5-heat 활동 2 매니페스트는 통과한다', () => {
    expect(validateHeatContactExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'label');
    expect(validateHeatContactExperiment(a).join()).toContain('"label"');
    const b = exp();
    b.variables.find((v) => v.key === 'hotC')!.options.push({ value: 55, label: 'x' });
    b.variables.find((v) => v.key === 'coldMl')!.options.push({ value: 200, label: 'y' });
    b.variables.find((v) => v.key === 'cup')!.options.push({ value: 'glass', label: 'z' });
    b.variables.find((v) => v.key === 'label')!.options.push({ value: 'red', label: 'w' });
    expect(validateHeatContactExperiment(b)).toHaveLength(4);
  });
});
