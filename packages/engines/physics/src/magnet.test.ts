import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { clipsAt, interpolateMagnet, simulateMagnet, validateMagnetExperiment, type BetweenKind, type MagnetCount, type MagnetParams } from './magnet';
import magnetJson from '../../../../content/units/g4-magnet/manifest.json';

const p = (gapCm: number, magnets: MagnetCount, between: BetweenKind = 'none'): MagnetParams => ({ gapCm, magnets, between });
const GAPS = [0, 0.5, 1, 2];

// 사양 §2.1: [자석 수, 거리(cm), 클립 수]
const TABLE: [MagnetCount, number, number][] = [
  [1, 0, 12], [1, 0.5, 5], [1, 1, 2], [1, 2, 0],
  [2, 0, 19], [2, 0.5, 8], [2, 1, 4], [2, 2, 1],
];

describe('자석 모델: 사양 기준값 8칸 × 없음·종이·플라스틱', () => {
  for (const between of ['none', 'paper', 'plastic'] as const) {
    for (const [m, g, n] of TABLE) {
      it(`${between} 자석 ${m}개 ${g} cm → ${n}개`, () => {
        const r = simulateMagnet(p(g, m, between)).result;
        expect(r.clips).toBe(n);
        expect(Number.isInteger(r.clips)).toBe(true);
        expect(clipsAt(g, m, between)).toBe(n);
      });
    }
  }

  it('철판이면 모든 칸이 0이고, 모든 표본의 붙은 클립도 0이며 reach도 0이다', () => {
    for (const [m, g] of TABLE) {
      const out = simulateMagnet(p(g, m, 'iron'));
      expect(out.result.clips).toBe(0);
      for (const s of out.samples) {
        expect(s.clipsHeld).toBe(0);
        expect(s.reach).toBe(0);
      }
    }
  });

  it('종이·플라스틱·없음은 샘플까지 완전히 같다', () => {
    for (const [m, g] of TABLE) {
      const base = simulateMagnet(p(g, m, 'none'));
      expect(simulateMagnet(p(g, m, 'paper'))).toEqual(base);
      expect(simulateMagnet(p(g, m, 'plastic'))).toEqual(base);
    }
  });
});

describe('자석 모델: 높이와 붙은 클립', () => {
  it('높이: 0~3 s 5에서 gapCm까지 일정하게 내려오고, 3~4 s 멈추고, 4~6 s 5까지 올라온다', () => {
    for (const g of GAPS) {
      const { samples } = simulateMagnet(p(g, 1));
      const h = (t: number) => samples.find((s) => Math.abs(s.t - t) < 1e-9)!.heightCm;
      expect(h(0)).toBe(5);
      expect(h(3)).toBeCloseTo(g, 9);
      expect(h(3.5)).toBeCloseTo(g, 9);
      expect(h(4)).toBeCloseTo(g, 9);
      expect(h(6)).toBeCloseTo(5, 9);
      expect(h(1.5)).toBeCloseTo((5 + g) / 2, 9);
      expect(h(5)).toBeCloseTo((5 + g) / 2, 9);
      for (const s of samples) {
        expect(s.heightCm).toBeGreaterThanOrEqual(g - 1e-9);
        expect(s.heightCm).toBeLessThanOrEqual(5 + 1e-9);
      }
    }
  });

  it('clipsHeld는 단조 비감소이고 정수이다', () => {
    for (const [m, g] of TABLE) {
      const ys = simulateMagnet(p(g, m)).samples.map((s) => s.clipsHeld);
      for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]!);
      expect(ys.every(Number.isInteger)).toBe(true);
    }
  });

  it('3~6 s 동안 clipsHeld는 변하지 않고 표의 값이다', () => {
    for (const [m, g, n] of TABLE) {
      for (const s of simulateMagnet(p(g, m)).samples.filter((x) => x.t >= 3 - 1e-9)) expect(s.clipsHeld).toBe(n);
    }
  });

  it('붙은 클립은 지나온 가장 낮은 높이에서의 값이다', () => {
    const { samples } = simulateMagnet(p(0, 2));
    for (const s of samples.filter((x) => x.t <= 3 + 1e-9)) expect(s.clipsHeld).toBe(clipsAt(s.heightCm, 2, 'none'));
    expect(samples[0]!.clipsHeld).toBe(0);
  });

  it('마지막 샘플은 t = 6이고 표본은 0.05초 간격 121개이다', () => {
    for (const [m, g] of TABLE) {
      const { samples } = simulateMagnet(p(g, m));
      expect(samples[0]!.t).toBe(0);
      expect(samples.at(-1)!.t).toBe(6);
      expect(samples).toHaveLength(121);
    }
  });

  it('거리가 늘면 같은 자석 수에서 clips가 늘지 않는다', () => {
    for (const m of [1, 2] as const) {
      for (const between of ['none', 'paper', 'plastic', 'iron'] as const) {
        const cs = GAPS.map((g) => simulateMagnet(p(g, m, between)).result.clips);
        for (let i = 1; i < cs.length; i++) expect(cs[i]!).toBeLessThanOrEqual(cs[i - 1]!);
      }
    }
  });

  it('자석 2개는 1개보다 많이 끌지만 두 배는 아니다 (0 cm)', () => {
    expect(clipsAt(0, 2, 'none')).toBeGreaterThan(clipsAt(0, 1, 'none'));
    expect(clipsAt(0, 2, 'none')).toBeLessThan(2 * clipsAt(0, 1, 'none'));
  });

  it('reach: 철판이 아니면 자석의 세기(1, 1.6)', () => {
    expect(simulateMagnet(p(1, 1)).samples[0]!.reach).toBe(1);
    expect(simulateMagnet(p(1, 2)).samples[0]!.reach).toBe(1.6);
  });

  it('옵션: 시간·간격을 바꿀 수 있고 잘못된 값은 거부한다', () => {
    expect(simulateMagnet(p(0, 1), { totalS: 6, sampleEveryS: 1 }).samples.map((s) => s.t)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(() => simulateMagnet(p(0, 1), { totalS: 0 })).toThrow(RangeError);
    expect(() => simulateMagnet(p(0, 1), { sampleEveryS: 0 })).toThrow(RangeError);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateMagnet(p(-1, 1))).toThrow(RangeError);
    expect(() => simulateMagnet(p(4.5, 1))).toThrow(RangeError);
    expect(() => simulateMagnet(p(Number.NaN, 1))).toThrow(RangeError);
    expect(() => simulateMagnet(p(1, 3 as never))).toThrow(RangeError);
    expect(() => simulateMagnet(p(1, 1, 'wood' as never))).toThrow(RangeError);
  });

  it('순수 함수: 같은 입력이면 같은 출력', () => {
    expect(simulateMagnet(p(0.5, 2, 'paper'))).toEqual(simulateMagnet(p(0.5, 2, 'paper')));
  });

  it('보간: 높이는 선형, 붙은 클립은 다음 표본에 닿기 전까지 앞 값(정수)', () => {
    const { samples } = simulateMagnet(p(0, 1));
    const a = samples[10]!;
    const b = samples[11]!;
    const m = interpolateMagnet(a, b, 0.5);
    expect(m.heightCm).toBeCloseTo((a.heightCm + b.heightCm) / 2, 9);
    expect(m.t).toBeCloseTo((a.t + b.t) / 2, 9);
    expect(Number.isInteger(m.clipsHeld)).toBe(true);
    expect(m.clipsHeld).toBe(a.clipsHeld);
    expect(interpolateMagnet(a, b, 1).clipsHeld).toBe(b.clipsHeld);
  });
});

describe('validateMagnetExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(magnetJson.experiments[0])) as VariableExperiment;

  it('g4-magnet 매니페스트는 통과한다', () => {
    expect(validateMagnetExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'between');
    expect(validateMagnetExperiment(a).join()).toContain('"between"');
    const b = exp();
    b.variables.find((v) => v.key === 'gapCm')!.options.push({ value: 5, label: 'x' });
    b.variables.find((v) => v.key === 'magnets')!.options.push({ value: 3, label: 'y' });
    b.variables.find((v) => v.key === 'between')!.options.push({ value: 'wood', label: 'z' });
    expect(validateMagnetExperiment(b)).toHaveLength(3);
  });
});
