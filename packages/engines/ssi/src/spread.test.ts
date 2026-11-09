import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import healthJson from '../../../../content/units/g3-health/manifest.json';
import { CLASS_SIZE, headcount, interpolateSpread, largestRemainder, simulateSpread, validateSpreadExperiment, type SpreadParams } from './spread';

const P = (contacts: number, wash: 'rarely' | 'often', mask: 'off' | 'on', seat: 'front' | 'back' = 'front'): SpreadParams => ({ wash, mask, contacts, seat });

// 사양 §2.1 기준값: [만나는 친구, 손 씻기, 마스크, 감염된 사람(반올림), 반올림 전, 가장 많이 아팠던 날의 아픈 사람(반올림)]
const TABLE: Array<[number, 'rarely' | 'often', 'off' | 'on', number, number, number]> = [
  [4, 'rarely', 'off', 12, 12.11, 3],
  [4, 'rarely', 'on', 3, 2.9, 1],
  [4, 'often', 'off', 4, 3.88, 1],
  [4, 'often', 'on', 2, 1.75, 1],
  [8, 'rarely', 'off', 28, 27.97, 10],
  [8, 'rarely', 'on', 12, 12.11, 3],
  [8, 'often', 'off', 18, 17.72, 5],
  [8, 'often', 'on', 4, 3.88, 1],
];

describe('simulateSpread 기준값', () => {
  for (const seat of ['front', 'back'] as const) {
    for (const [contacts, wash, mask, total, raw, peak] of TABLE) {
      it(`${seat} · 만남 ${contacts} · ${wash} · ${mask}: 감염 ${total}명, 가장 많이 아픈 ${peak}명`, () => {
        const out = simulateSpread(P(contacts, wash, mask, seat));
        expect(out.result.total).toBe(total);
        expect(Math.abs(out.raw.total - raw)).toBeLessThanOrEqual(0.05);
        expect(out.result.peak).toBe(peak);
      });
    }
  }

  it('가장 많이 아픈 사람 수는 반올림 전 값도 고정한다(소수 셋째 자리)', () => {
    const peaks = TABLE.map(([c, w, m]) => Number(simulateSpread(P(c, w, m)).raw.peak.toFixed(3)));
    expect(peaks).toEqual([3.078, 1, 1, 1, 10.08, 3.078, 4.723, 1]);
  });
});

describe('simulateSpread 표본과 불변식', () => {
  const all = TABLE.map(([c, w, m]) => simulateSpread(P(c, w, m)));

  it('하루마다 t = 0..20, 21개이고 처음은 S 29, I 1, R 0', () => {
    for (const o of all) {
      expect(o.samples.map((s) => s.t)).toEqual(Array.from({ length: 21 }, (_, i) => i));
      expect(o.samples[0]).toEqual({ t: 0, susceptible: 29, sick: 1, recovered: 0, total: 1 });
    }
  });

  it('모든 표본에서 S + I + R = 30 (±1e-9)이고 total = 30 − S', () => {
    for (const o of all) {
      for (const s of o.samples) {
        expect(Math.abs(s.susceptible + s.sick + s.recovered - CLASS_SIZE)).toBeLessThan(1e-9);
        expect(Math.abs(s.total - (CLASS_SIZE - s.susceptible))).toBeLessThan(1e-9);
      }
    }
  });

  it('total은 단조 비감소이고 마지막 표본의 total이 결과의 반올림 전 값이다', () => {
    for (const o of all) {
      for (let i = 1; i < o.samples.length; i++) expect(o.samples[i]!.total).toBeGreaterThanOrEqual(o.samples[i - 1]!.total);
      expect(o.samples[20]!.total).toBeCloseTo(o.raw.total, 12);
    }
  });

  it('자리만 바꾸면 결과와 표본이 모두 같다', () => {
    for (const [c, w, m] of TABLE) {
      expect(simulateSpread(P(c, w, m, 'back'))).toEqual(simulateSpread(P(c, w, m, 'front')));
    }
  });

  it('습관 하나를 더 지키면(다른 조건 같음) total이 늘지 않는다', () => {
    for (const c of [4, 8]) {
      const t = (w: 'rarely' | 'often', m: 'off' | 'on') => simulateSpread(P(c, w, m)).raw.total;
      expect(t('often', 'off')).toBeLessThanOrEqual(t('rarely', 'off'));
      expect(t('rarely', 'on')).toBeLessThanOrEqual(t('rarely', 'off'));
      expect(t('often', 'on')).toBeLessThanOrEqual(t('often', 'off'));
      expect(t('often', 'on')).toBeLessThanOrEqual(t('rarely', 'on'));
    }
  });

  it('만나는 친구가 늘면 total이 늘지 않는 일이 없다', () => {
    for (const w of ['rarely', 'often'] as const) for (const m of ['off', 'on'] as const) {
      expect(simulateSpread(P(8, w, m)).raw.total).toBeGreaterThanOrEqual(simulateSpread(P(4, w, m)).raw.total);
    }
  });

  it('난수가 없어 같은 입력은 같은 출력이다', () => {
    expect(simulateSpread(P(8, 'rarely', 'off'))).toEqual(simulateSpread(P(8, 'rarely', 'off')));
  });

  it('days 옵션은 표본 수를 바꾼다', () => {
    expect(simulateSpread(P(4, 'rarely', 'off'), { days: 10 }).samples).toHaveLength(11);
  });
});

describe('입력 검사', () => {
  it('허용 범위 밖이면 RangeError', () => {
    expect(() => simulateSpread({ ...P(4, 'rarely', 'off'), contacts: 0 })).toThrow(RangeError);
    expect(() => simulateSpread({ ...P(4, 'rarely', 'off'), contacts: 16 })).toThrow(RangeError);
    expect(() => simulateSpread({ ...P(4, 'rarely', 'off'), contacts: 2.5 })).toThrow(RangeError);
    expect(() => simulateSpread({ ...P(4, 'rarely', 'off'), wash: 'x' as never })).toThrow(RangeError);
    expect(() => simulateSpread({ ...P(4, 'rarely', 'off'), mask: 'x' as never })).toThrow(RangeError);
    expect(() => simulateSpread({ ...P(4, 'rarely', 'off'), seat: 'x' as never })).toThrow(RangeError);
    expect(() => simulateSpread(P(4, 'rarely', 'off'), { days: 0 })).toThrow(RangeError);
    expect(() => simulateSpread(P(4, 'rarely', 'off'), { dt: 0 })).toThrow(RangeError);
  });

  const exp = () => structuredClone((parseManifest(healthJson).experiments[0] as VariableExperiment));

  it('매니페스트는 검사를 통과한다', () => {
    expect(validateSpreadExperiment(exp())).toEqual([]);
  });

  it('변인이 빠지거나 값이 범위 밖이면 오류를 돌려준다', () => {
    const noSeat = exp();
    noSeat.variables = noSeat.variables.filter((v) => v.key !== 'seat');
    expect(validateSpreadExperiment(noSeat)).toEqual(['변인 "seat"이(가) 없습니다.']);
    const bad = exp();
    bad.variables.find((v) => v.key === 'contacts')!.options[1]!.value = 16;
    expect(validateSpreadExperiment(bad)).toHaveLength(1);
    const badWash = exp();
    badWash.variables.find((v) => v.key === 'wash')!.options[0]!.value = 'x';
    expect(validateSpreadExperiment(badWash)).toHaveLength(1);
    const noDays = exp();
    noDays.params = {};
    expect(validateSpreadExperiment(noDays)).toHaveLength(1);
  });
});

describe('interpolateSpread와 가장 큰 나머지 방식', () => {
  it('보간은 선형이다', () => {
    const a = { t: 0, susceptible: 29, sick: 1, recovered: 0, total: 1 };
    const b = { t: 1, susceptible: 27, sick: 2, recovered: 1, total: 3 };
    expect(interpolateSpread(a, b, 0.5)).toEqual({ t: 0.5, susceptible: 28, sick: 1.5, recovered: 0.5, total: 2 });
  });

  it('largestRemainder는 합이 언제나 30이다', () => {
    expect(largestRemainder([10.5, 10.5, 9])).toEqual([11, 10, 9]);
    expect(largestRemainder([29, 1, 0])).toEqual([29, 1, 0]);
    for (const o of TABLE.map(([c, w, m]) => simulateSpread(P(c, w, m)))) {
      for (const s of o.samples) {
        const h = headcount(s);
        expect(h.healthy + h.sick + h.recovered).toBe(30);
        expect(h.healthy).toBeGreaterThanOrEqual(0);
        expect(h.sick).toBeGreaterThanOrEqual(0);
        expect(h.recovered).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('마지막 날 건강한 사람 수는 결과의 감염된 사람 수와 맞는다', () => {
    for (const [c, w, m, total] of TABLE) {
      expect(30 - headcount(simulateSpread(P(c, w, m)).samples[20]!).healthy).toBe(total);
    }
  });
});
