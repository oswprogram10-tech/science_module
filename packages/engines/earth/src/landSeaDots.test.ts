import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  LS_DOTS,
  LS_GLOBES,
  LS_LAT_CELLS,
  LS_LON_CELLS,
  LS_MASK_ROWS,
  LS_ROUNDS,
  interpolateLandSeaDots,
  isLandAt,
  isLandCell,
  landSeaPoints,
  seaFractionByArea,
  simulateLandSeaDots,
  validateLandSeaDotsExperiment,
} from './landSeaDots';
import earthSeaJson from '../../../../content/units/g3-earth-sea/manifest.json';

const p = (dots: number, round: number, globeColor: 'red' | 'blue' = 'red') => ({ dots, round, globeColor });

describe('육지 마스크(손으로 그린 낮은 해상도 지도)', () => {
  it('위도 2° × 경도 2° 칸 90줄 × 180칸이고 줄마다 구간 표기가 맞다', () => {
    expect([LS_LAT_CELLS, LS_LON_CELLS, LS_MASK_ROWS.length]).toEqual([90, 180, 90]);
    for (const row of LS_MASK_ROWS) {
      if (row === '') continue;
      let prevEnd = -2;
      for (const run of row.split(',')) {
        expect(run).toMatch(/^\d+-\d+$/);
        const [a, b] = run.split('-').map(Number) as [number, number];
        expect(a).toBeLessThanOrEqual(b);
        expect(b).toBeLessThan(180);
        expect(a).toBeGreaterThan(prevEnd + 1);
        prevEnd = b;
      }
    }
  });

  it('넓이로 가중한 바다 비율이 70~72 %이다 (실제 지구는 약 71 %)', () => {
    const sea = seaFractionByArea();
    expect(sea).toBeGreaterThanOrEqual(0.7);
    expect(sea).toBeLessThanOrEqual(0.72);
  });

  it('알아볼 수 있는 곳이 맞다: 태평양 한가운데는 바다, 아프리카·남극·오스트레일리아는 육지', () => {
    expect(isLandAt(0, -150)).toBe(false);
    expect(isLandAt(-30, -120)).toBe(false);
    expect(isLandAt(10, 20)).toBe(true);
    expect(isLandAt(-80, 0)).toBe(true);
    expect(isLandAt(-25, 134)).toBe(true);
    expect(isLandAt(40, 110)).toBe(true);
    expect(isLandAt(-89.9, 10)).toBe(true);
    expect(isLandAt(89.9, 10)).toBe(false);
    expect(isLandCell(0, 0)).toBe(false);
  });
});

describe('점 찍기', () => {
  it('구 위에 고르게 찍는다: 위도는 asin 분포라 적도 쪽이 극 쪽보다 많다', () => {
    const pts = landSeaPoints(1, 500);
    expect(pts).toHaveLength(500);
    for (const q of pts) {
      expect(q.lat).toBeGreaterThanOrEqual(-90);
      expect(q.lat).toBeLessThanOrEqual(90);
      expect(q.lon).toBeGreaterThanOrEqual(-180);
      expect(q.lon).toBeLessThan(180);
    }
    const many = [1, 2, 3].flatMap((r) => landSeaPoints(r, 500));
    // 구면 넓이: 위도 |lat| < 30°는 전체의 50 %, |lat| > 60°는 약 13 %
    const low = many.filter((q) => Math.abs(q.lat) < 30).length / many.length;
    const high = many.filter((q) => Math.abs(q.lat) > 60).length / many.length;
    expect(low).toBeGreaterThan(0.44);
    expect(low).toBeLessThan(0.56);
    expect(high).toBeGreaterThan(0.08);
    expect(high).toBeLessThan(0.18);
  });

  it('같은 입력은 언제나 같은 결과이고(씨앗 고정) 받침 색은 아무것도 바꾸지 않는다', () => {
    for (const dots of LS_DOTS) {
      for (const round of LS_ROUNDS) {
        const a = simulateLandSeaDots(p(dots, round));
        expect(simulateLandSeaDots(p(dots, round))).toEqual(a);
        expect(simulateLandSeaDots(p(dots, round, 'blue'))).toEqual(a);
        expect(landSeaPoints(round, dots)).toEqual(landSeaPoints(round, dots));
      }
    }
  });

  it('차례마다 점이 다르다', () => {
    for (const dots of LS_DOTS) {
      const key = (r: number) => JSON.stringify(landSeaPoints(r, dots));
      expect(new Set([1, 2, 3].map(key)).size).toBe(3);
    }
  });

  it('점이 500개이면 세 차례 모두 바다 비율이 65~77 %이다', () => {
    for (const round of LS_ROUNDS) {
      const r = simulateLandSeaDots(p(500, round)).result;
      expect(r.seaPct, `${round}번째`).toBeGreaterThanOrEqual(65);
      expect(r.seaPct, `${round}번째`).toBeLessThanOrEqual(77);
    }
  });

  it('점이 10개이면 차례마다 값이 달라서 적어도 두 차례가 서로 다르다', () => {
    const pcts = LS_ROUNDS.map((r) => simulateLandSeaDots(p(10, r)).result.seaPct);
    expect(new Set(pcts).size).toBeGreaterThanOrEqual(2);
  });

  it('결과: 바다 점 + 육지 점 = 찍은 점, 비율은 반올림한 정수', () => {
    for (const dots of LS_DOTS) {
      for (const round of LS_ROUNDS) {
        const { result } = simulateLandSeaDots(p(dots, round));
        expect(result.sea + result.land).toBe(dots);
        expect(result.seaPct).toBe(Math.round((result.sea / dots) * 100));
        expect(Number.isInteger(result.seaPct)).toBe(true);
        expect(landSeaPoints(round, dots).filter((q) => q.sea)).toHaveLength(result.sea);
      }
    }
  });
});

describe('표본', () => {
  it('t = 0~찍은 점의 수(점 하나마다 하나)이고, 처음에는 비율이 없고(NaN) 마지막 표본이 결과와 같다', () => {
    for (const dots of LS_DOTS) {
      const { samples, result } = simulateLandSeaDots(p(dots, 2));
      expect(samples).toHaveLength(dots + 1);
      expect(samples[0]).toMatchObject({ t: 0, sea: 0, land: 0 });
      expect(Number.isNaN(samples[0]!.seaPct)).toBe(true);
      const last = samples.at(-1)!;
      expect([last.t, last.sea, last.land]).toEqual([dots, result.sea, result.land]);
      expect(Math.round(last.seaPct)).toBe(result.seaPct);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]!.sea + samples[i]!.land).toBe(i);
        expect(samples[i]!.sea).toBeGreaterThanOrEqual(samples[i - 1]!.sea);
        expect(samples[i]!.seaPct).toBeGreaterThanOrEqual(0);
        expect(samples[i]!.seaPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it('점이 늘수록 비율의 흔들림이 줄어든다 (500개 구간의 뒷부분이 앞부분보다 안정)', () => {
    const { samples } = simulateLandSeaDots(p(500, 1));
    const spread = (from: number, to: number) => {
      const v = samples.slice(from, to).map((s) => s.seaPct);
      return Math.max(...v) - Math.min(...v);
    };
    expect(spread(400, 501)).toBeLessThan(spread(5, 60));
  });

  it('선형 보간(비율이 아직 없는 처음 구간은 NaN)', () => {
    const { samples } = simulateLandSeaDots(p(50, 1));
    const m = interpolateLandSeaDots(samples[10]!, samples[11]!, 0.5);
    expect(m.t).toBeCloseTo(10.5, 9);
    expect(m.seaPct).toBeCloseTo((samples[10]!.seaPct + samples[11]!.seaPct) / 2, 9);
    expect(Number.isNaN(interpolateLandSeaDots(samples[0]!, samples[1]!, 0.5).seaPct)).toBe(true);
    expect(interpolateLandSeaDots(samples[0]!, samples[1]!, 1).seaPct).toBe(samples[1]!.seaPct);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateLandSeaDots(p(20, 1))).toThrow(RangeError);
    expect(() => simulateLandSeaDots(p(10, 4))).toThrow(RangeError);
    expect(() => simulateLandSeaDots({ dots: 10, round: 1, globeColor: 'green' as never })).toThrow(RangeError);
    expect([...LS_GLOBES]).toEqual(['red', 'blue']);
  });
});

describe('validateLandSeaDotsExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(earthSeaJson.experiments[2])) as VariableExperiment;

  it('g3-earth-sea 활동 3 매니페스트는 통과한다', () => {
    expect(validateLandSeaDotsExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'round');
    expect(validateLandSeaDotsExperiment(a).join()).toContain('"round"');
    const b = exp();
    b.variables.find((v) => v.key === 'dots')!.options.push({ value: 20, label: 'x' });
    b.variables.find((v) => v.key === 'round')!.options.push({ value: 4, label: 'y' });
    b.variables.find((v) => v.key === 'globeColor')!.options.push({ value: 'green', label: 'z' });
    expect(validateLandSeaDotsExperiment(b)).toHaveLength(3);
  });
});
