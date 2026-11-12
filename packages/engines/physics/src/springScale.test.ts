import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  OBJECT_G,
  SPRING_COLORS,
  SPRING_OBJECTS,
  SPRING_SETTLE_S,
  SPRING_WEIGHTS,
  SPRING_Y_MAX_CM,
  interpolateSpringScale,
  settle,
  simulateSpringScale,
  stretchOf,
  totalG,
  validateSpringScaleExperiment,
  type SpringObject,
  type SpringScaleParams,
} from './springScale';
import forceJson from '../../../../content/units/g3-force/manifest.json';

const p = (weights: number, object: SpringObject, springColor: 'yellow' | 'green' = 'yellow'): SpringScaleParams => ({ weights, object, springColor });

describe('용수철저울 모델: 전체 무게 = 50 × 추 + 물체, 늘어난 길이 = 전체 무게 ÷ 25, 눈금 = 전체 무게', () => {
  it('물체 무게: 필통 150 g, 가위 70 g, 풀 60 g, 색연필 묶음 90 g, 없음 0 g', () => {
    expect(OBJECT_G).toEqual({ none: 0, case: 150, scissors: 70, glue: 60, pencils: 90 });
  });

  for (const color of SPRING_COLORS) {
    for (const object of SPRING_OBJECTS) {
      for (const weights of SPRING_WEIGHTS) {
        const total = 50 * weights + OBJECT_G[object];
        it(`${color} 추 ${weights}개 + ${object}: ${total} g, ${(total / 25).toFixed(1)} cm`, () => {
          expect(simulateSpringScale(p(weights, object, color)).result).toEqual({ stretch: Math.round((total / 25) * 10) / 10, reading: total });
        });
      }
    }
  }

  it('사양 표: 추를 하나 더 걸 때마다 2 cm(50 g)씩 늘어나고, 눈으로 비슷한 가위(2.8 cm, 70 g)와 풀(2.4 cm, 60 g)은 눈금이 다르다', () => {
    expect([0, 1, 2, 3, 4, 5].map((w) => simulateSpringScale(p(w, 'none')).result.stretch)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(simulateSpringScale(p(0, 'scissors')).result).toEqual({ stretch: 2.8, reading: 70 });
    expect(simulateSpringScale(p(0, 'glue')).result).toEqual({ stretch: 2.4, reading: 60 });
    expect(simulateSpringScale(p(0, 'case')).result).toEqual({ stretch: 6, reading: 150 });
    expect(simulateSpringScale(p(0, 'pencils')).result).toEqual({ stretch: 3.6, reading: 90 });
    expect(simulateSpringScale(p(5, 'case')).result).toEqual({ stretch: 16, reading: 400 });
  });

  it('추 1개와 풀·가위·색연필 묶음은 같은 눈금이 나올 수 있다(필통 150 g = 추 3개, 추 1개 + 풀 = 110 g)', () => {
    expect(totalG(3, 'none')).toBe(totalG(0, 'case'));
    expect(stretchOf(1, 'glue')).toBe(4.4);
  });

  it('대조 변인: 용수철 색깔은 결과와 모든 표본에 영향이 없다', () => {
    for (const w of SPRING_WEIGHTS) for (const o of SPRING_OBJECTS) expect(simulateSpringScale(p(w, o, 'yellow'))).toEqual(simulateSpringScale(p(w, o, 'green')));
  });

  it('늘어난 길이는 소수 첫째 자리(반올림 경계 없음), 눈금은 정수이다', () => {
    for (const w of SPRING_WEIGHTS) {
      for (const o of SPRING_OBJECTS) {
        const r = simulateSpringScale(p(w, o)).result;
        expect(Math.abs(r.stretch * 10 - Math.round(r.stretch * 10))).toBeLessThan(1e-9);
        expect(Number.isInteger(r.reading)).toBe(true);
      }
    }
  });
});

describe('표본: 0~2초, 살짝 흔들리다 멈춘다', () => {
  const sim = simulateSpringScale(p(5, 'case'));
  it('41개 표본이고 처음 0 cm·0 g에서 시작해 1.6초부터 결과에 멈춘다', () => {
    expect(sim.samples).toHaveLength(41);
    expect(sim.samples[0]).toEqual({ t: 0, stretchCm: 0, readingG: 0 });
    for (const s of sim.samples.filter((x) => x.t >= SPRING_SETTLE_S - 1e-9)) expect(s).toMatchObject({ stretchCm: 16, readingG: 400 });
  });
  it('흔들림이 있다: 끝 길이를 넘었다가 돌아오고, 가장 길 때도 세로축(0~18 cm)을 넘지 않는다', () => {
    const max = Math.max(...sim.samples.map((s) => s.stretchCm));
    expect(max).toBeGreaterThan(16);
    expect(max).toBeLessThanOrEqual(SPRING_Y_MAX_CM);
    for (const w of SPRING_WEIGHTS) for (const o of SPRING_OBJECTS) expect(Math.max(...simulateSpringScale(p(w, o)).samples.map((s) => s.stretchCm))).toBeLessThanOrEqual(SPRING_Y_MAX_CM);
    expect(Math.min(...sim.samples.map((s) => s.stretchCm))).toBeGreaterThanOrEqual(0);
  });
  it('아무것도 걸지 않으면(추 0개, 물체 없음) 늘어나지 않는다', () => {
    expect(simulateSpringScale(p(0, 'none')).samples.every((s) => s.stretchCm === 0 && s.readingG === 0)).toBe(true);
  });
  it('눈금은 늘어난 길이에 비례한다(25 g당 1 cm)', () => {
    for (const s of sim.samples) expect(s.readingG).toBeCloseTo(s.stretchCm * 25, 6);
  });
  it('settle: 0에서 시작해 1.6초에 정확히 1이다', () => {
    expect(settle(0)).toBe(0);
    expect(settle(SPRING_SETTLE_S)).toBeCloseTo(1, 12);
    expect(settle(5)).toBeCloseTo(1, 12);
  });
  it('난수가 없어 같은 조건은 같은 표본이다', () => {
    expect(simulateSpringScale(p(2, 'glue'))).toEqual(simulateSpringScale(p(2, 'glue')));
  });
});

describe('보간·검사', () => {
  it('두 표본 사이를 선형으로 보간한다', () => {
    expect(interpolateSpringScale({ t: 0, stretchCm: 0, readingG: 0 }, { t: 1, stretchCm: 4, readingG: 100 }, 0.5)).toEqual({ t: 0.5, stretchCm: 2, readingG: 50 });
  });
  it('모델 밖의 값은 RangeError', () => {
    expect(() => simulateSpringScale(p(6, 'none'))).toThrow(RangeError);
    expect(() => simulateSpringScale(p(1, 'x' as never))).toThrow(RangeError);
    expect(() => simulateSpringScale(p(1, 'none', 'x' as never))).toThrow(RangeError);
  });
  it('매니페스트 검사: 저장소의 활동 4는 통과하고, 없는 변인·모르는 값은 잡는다', () => {
    const exp = (forceJson.experiments as unknown as VariableExperiment[]).find((e) => e.id === 'spring-scale')!;
    expect(validateSpringScaleExperiment(exp)).toEqual([]);
    expect(validateSpringScaleExperiment({ ...exp, variables: exp.variables.filter((v) => v.key !== 'object') })).toHaveLength(1);
    const bad = structuredClone(exp);
    bad.variables[0]!.options[0]!.value = 7;
    expect(validateSpringScaleExperiment(bad).join()).toContain('7');
  });
});
