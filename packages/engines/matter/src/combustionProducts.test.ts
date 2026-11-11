import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  CP_BURN_MIN,
  CP_CLOUD_AT,
  CP_JARS,
  CP_OUTCOME_LABEL,
  CP_SAME_STAGE,
  CP_STAGES,
  CP_TESTS,
  CP_TOTAL_MIN,
  cloudAtBurn,
  interpolateCombustionProducts,
  limewaterOutcome,
  outcomeOf,
  simulateCombustionProducts,
  stageOf,
  validateCombustionProductsExperiment,
  type CombustionProductsParams,
  type CpTest,
} from './combustionProducts';
import combustionJson from '../../../../content/units/g6-combustion/manifest.json';

const p = (burnMin: number, test: CpTest = 'paper', jar = 'clear'): CombustionProductsParams => ({ burnMin, test, jar });

describe('연소 전과 후 비교하기 모델: 사양 기준값', () => {
  it('종이: 0분이면 푸른색 그대로, 1분·3분이면 붉은색으로 변함. 뿌연 정도는 "—"(null)', () => {
    expect(simulateCombustionProducts(p(0, 'paper')).result).toEqual({ result: 'paperBlue', cloud: null, shorterMm: 0, stage: 0 });
    expect(simulateCombustionProducts(p(1, 'paper')).result).toEqual({ result: 'paperRed', cloud: null, shorterMm: 1, stage: 1 });
    expect(simulateCombustionProducts(p(3, 'paper')).result).toEqual({ result: 'paperRed', cloud: null, shorterMm: 3, stage: 1 });
  });

  it('석회수: 0분 0(맑음), 1분 3(조금 뿌예짐), 3분 8(뿌예짐)', () => {
    expect(CP_CLOUD_AT).toEqual({ 0: 0, 1: 3, 3: 8 });
    expect(simulateCombustionProducts(p(0, 'limewater')).result).toEqual({ result: 'limeClear', cloud: 0, shorterMm: 0, stage: 0 });
    expect(simulateCombustionProducts(p(1, 'limewater')).result).toEqual({ result: 'limeSlight', cloud: 3, shorterMm: 1, stage: 1 });
    expect(simulateCombustionProducts(p(3, 'limewater')).result).toEqual({ result: 'limeCloudy', cloud: 8, shorterMm: 3, stage: 2 });
  });

  it('결과 글자는 사양대로다', () => {
    expect(CP_OUTCOME_LABEL).toEqual({ paperBlue: '푸른색 그대로', paperRed: '붉은색으로 변함', limeClear: '맑음', limeSlight: '조금 뿌예짐', limeCloudy: '뿌예짐' });
    expect(CP_STAGES.paper.map((o) => CP_OUTCOME_LABEL[o])).toEqual(['푸른색 그대로', '붉은색으로 변함']);
    expect(CP_STAGES.limewater.map((o) => CP_OUTCOME_LABEL[o])).toEqual(['맑음', '조금 뿌예짐', '뿌예짐']);
  });

  it('초가 짧아진 길이(mm) = 태운 시간(분) × 1, 소수 첫째 자리', () => {
    for (const b of CP_BURN_MIN) for (const t of CP_TESTS) expect(simulateCombustionProducts(p(b, t)).result.shorterMm).toBe(b);
  });

  it('변화 단계: 종이 0~1, 석회수 0~2. 태운 시간이 같을 때 두 검사의 단계는 종이 ≤ 석회수 (1분 1·1, 3분 1·2)', () => {
    const stages = (t: CpTest) => CP_BURN_MIN.map((b) => simulateCombustionProducts(p(b, t)).result.stage);
    expect(stages('paper')).toEqual([0, 1, 1]);
    expect(stages('limewater')).toEqual([0, 1, 2]);
    expect(stageOf('limeCloudy', 'limewater')).toBe(2);
    expect(CP_SAME_STAGE).toBe(0.5);
  });

  it('집기병 색은 모든 조건(12가지)에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    expect(CP_JARS).toEqual(['clear', 'blue']);
    for (const b of CP_BURN_MIN) for (const t of CP_TESTS) {
      const a = simulateCombustionProducts(p(b, t, 'clear'));
      const c = simulateCombustionProducts(p(b, t, 'blue'));
      expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    }
  });
});

describe('연소 전과 후 비교하기 모델: 꺾은선과 경계', () => {
  it('뿌연 정도는 (0, 0) (1, 3) (3, 8)을 잇는 꺾은선이고 줄지 않는다', () => {
    expect([0, 0.5, 1, 2, 3].map(cloudAtBurn)).toEqual([0, 1.5, 3, 5.5, 8]);
    for (let b = 0; b < 3; b += 0.1) expect(cloudAtBurn(b + 0.1)).toBeGreaterThanOrEqual(cloudAtBurn(b));
    expect(cloudAtBurn(-1)).toBe(0);
    expect(cloudAtBurn(5)).toBe(8);
  });

  it('결과 말 경계: 0.5 미만 맑음, 5.5 미만 조금 뿌예짐, 그 이상 뿌예짐. 사양 값 0, 3, 8은 경계에서 멀다', () => {
    expect([0, 0.49, 0.5, 3, 5.49, 5.5, 8, 10].map(limewaterOutcome)).toEqual(['limeClear', 'limeClear', 'limeSlight', 'limeSlight', 'limeSlight', 'limeCloudy', 'limeCloudy', 'limeCloudy']);
    for (const b of CP_BURN_MIN) expect(outcomeOf(b, 'limewater')).toBe(['limeClear', 'limeSlight', 'limeCloudy'][CP_BURN_MIN.indexOf(b)]);
  });

  it('표본은 0~3분 0.1분 간격 31개: 태운 시간 뒤에는 값이 그대로이고 끝 값은 결과와 같다', () => {
    for (const b of CP_BURN_MIN) for (const t of CP_TESTS) {
      const { samples, result } = simulateCombustionProducts(p(b, t));
      expect(samples).toHaveLength(31);
      expect(samples[0]).toMatchObject({ t: 0, burned: 0, red: 0, shorterMm: 0 });
      expect(samples.at(-1)!.t).toBe(CP_TOTAL_MIN);
      expect(samples.at(-1)!.burned).toBe(b);
      expect(samples.at(-1)!.shorterMm).toBe(result.shorterMm);
      expect(samples.at(-1)!.red).toBe(b > 0 ? 1 : 0);
      for (const s of samples) {
        expect(s.burned).toBeLessThanOrEqual(b);
        if (t === 'limewater') expect(Number.isFinite(s.cloud)).toBe(true);
        else expect(Number.isNaN(s.cloud)).toBe(true);
      }
      if (t === 'limewater') {
        expect(samples.at(-1)!.cloud).toBe(result.cloud);
        expect(samples[0]!.cloud).toBe(0);
        for (let i = 1; i < samples.length; i++) expect(samples[i]!.cloud).toBeGreaterThanOrEqual(samples[i - 1]!.cloud);
      }
    }
    // 태우지 않으면(0분) 시간 축 전체에서 변화가 없다
    for (const s of simulateCombustionProducts(p(0, 'limewater')).samples) expect(s).toMatchObject({ burned: 0, cloud: 0, red: 0, shorterMm: 0 });
  });

  it('선형 보간(NaN은 NaN 그대로)', () => {
    const { samples } = simulateCombustionProducts(p(3, 'limewater'));
    const m = interpolateCombustionProducts(samples[10]!, samples[11]!, 0.5);
    expect(m.t).toBeCloseTo(1.05, 9);
    expect(m.cloud).toBeCloseTo((samples[10]!.cloud + samples[11]!.cloud) / 2, 9);
    const paper = simulateCombustionProducts(p(3, 'paper')).samples;
    expect(Number.isNaN(interpolateCombustionProducts(paper[1]!, paper[2]!, 0.5).cloud)).toBe(true);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateCombustionProducts(p(2))).toThrow(RangeError);
    expect(() => simulateCombustionProducts(p(-1))).toThrow(RangeError);
    expect(() => simulateCombustionProducts({ ...p(0), test: 'litmus' as never })).toThrow(RangeError);
    expect(() => simulateCombustionProducts(p(1, 'paper', 'red'))).toThrow(RangeError);
    expect(() => simulateCombustionProducts({ ...p(0), burnMin: '1' as never })).toThrow(RangeError);
  });
});

describe('validateCombustionProductsExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(combustionJson.experiments[1])) as VariableExperiment;

  it('g6-combustion 활동 2 매니페스트는 통과한다', () => {
    expect(validateCombustionProductsExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'jar');
    expect(validateCombustionProductsExperiment(a).join()).toContain('"jar"');
    const b = exp();
    b.variables.find((v) => v.key === 'burnMin')!.options.push({ value: 2, label: 'x' });
    b.variables.find((v) => v.key === 'test')!.options.push({ value: 'litmus', label: 'y' });
    b.variables.find((v) => v.key === 'jar')!.options.push({ value: 'red', label: 'z' });
    expect(validateCombustionProductsExperiment(b)).toHaveLength(3);
  });
});
