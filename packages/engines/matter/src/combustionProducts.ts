import type { VariableExperiment as Experiment } from '@sci/schema';

export const CP_BURN_MIN = [0, 1, 3] as const;
export const CP_TESTS = ['paper', 'limewater'] as const;
export type CpTest = (typeof CP_TESTS)[number];
export const CP_JARS = ['clear', 'blue'] as const;

/** 검사 결과(범주). 종이: 푸른색 그대로 / 붉은색으로 변함, 석회수: 맑음 / 조금 뿌예짐 / 뿌예짐 */
export type CpOutcome = 'paperBlue' | 'paperRed' | 'limeClear' | 'limeSlight' | 'limeCloudy';

/** 검사 결과 글자 */
export const CP_OUTCOME_LABEL: Record<CpOutcome, string> = {
  paperBlue: '푸른색 그대로',
  paperRed: '붉은색으로 변함',
  limeClear: '맑음',
  limeSlight: '조금 뿌예짐',
  limeCloudy: '뿌예짐',
};

/** 검사마다 가능한 결과를 변화가 큰 순서(변화 단계 0, 1, 2)로 나열한다. */
export const CP_STAGES: Record<CpTest, readonly CpOutcome[]> = {
  paper: ['paperBlue', 'paperRed'],
  limewater: ['limeClear', 'limeSlight', 'limeCloudy'],
};

/** 석회수의 뿌연 정도(눈금 0~10): 태운 시간(분)별 값. 0분 0(맑음), 1분 3(조금 뿌예짐), 3분 8(뿌예짐). 수치는 근사값이며 교사 검수 대상이다. */
export const CP_CLOUD_AT: Record<(typeof CP_BURN_MIN)[number], number> = { 0: 0, 1: 3, 3: 8 };
/** 초가 짧아지는 빠르기(mm/분) */
export const CP_SHORTER_MM_PER_MIN = 1;
/** 시간 축 길이(분): 태운 시간 가운데 가장 긴 것 */
export const CP_TOTAL_MIN = 3;
export const CP_SAMPLE_MIN = 0.1;
/** 예측 비교에서 같은 결과로 보는 변화 단계 차 */
export const CP_SAME_STAGE = 0.5;

export interface CombustionProductsParams {
  /** 초를 태운 시간(분) */
  burnMin: number;
  test: CpTest;
  /** 집기병 색: 계산에 쓰지 않는 대조 변인 */
  jar: string;
}

export interface CombustionProductsSample {
  /** 분. 0부터 3분까지 같은 시간 축이다. */
  t: number;
  /** 지금까지 태운 시간(분) = min(t, 고른 태운 시간) */
  burned: number;
  /** 석회수 뿌연 정도(눈금 0~10). 종이 검사에는 이 값이 없어 NaN이다(그래프에 선을 그리지 않는다). */
  cloud: number;
  /** 푸른색 염화 코발트 종이가 붉게 변한 정도(0 푸른색 ~ 1 붉은색) */
  red: number;
  /** 지금까지 짧아진 초의 길이(mm) */
  shorterMm: number;
}

export interface CombustionProductsResult {
  /** 검사 결과(범주) */
  result: CpOutcome;
  /** 석회수 뿌연 정도(눈금 0~10). 종이 검사이면 null("—"). */
  cloud: number | null;
  /** 초가 짧아진 길이(mm), 소수 첫째 자리 */
  shorterMm: number;
  /** 변화 단계(0 = 변화 없음). 예측 비교에 쓴다. 종이 0~1, 석회수 0~2 */
  stage: number;
}

export interface CombustionProductsOutput {
  samples: CombustionProductsSample[];
  result: CombustionProductsResult;
}

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: CombustionProductsParams): void => {
  if (typeof p.burnMin !== 'number' || !(CP_BURN_MIN as readonly number[]).includes(p.burnMin)) throw new RangeError(`초를 태운 시간 ${String(p.burnMin)}은(는) ${CP_BURN_MIN.join(', ')}분 중 하나여야 합니다.`);
  if (!(CP_TESTS as readonly string[]).includes(p.test)) throw new RangeError(`검사 방법 ${String(p.test)}은(는) ${CP_TESTS.join(', ')} 중 하나여야 합니다.`);
  if (!(CP_JARS as readonly string[]).includes(p.jar)) throw new RangeError(`집기병 색 ${String(p.jar)}은(는) ${CP_JARS.join(', ')} 중 하나여야 합니다.`);
};

/** 태운 시간(분)에서의 석회수 뿌연 정도: (0, 0) (1, 3) (3, 8)을 잇는 꺾은선 */
export function cloudAtBurn(burned: number): number {
  const b = Math.min(CP_TOTAL_MIN, Math.max(0, burned));
  if (b <= 1) return roundTo(CP_CLOUD_AT[0] + (CP_CLOUD_AT[1] - CP_CLOUD_AT[0]) * b, 3);
  return roundTo(CP_CLOUD_AT[1] + ((CP_CLOUD_AT[3] - CP_CLOUD_AT[1]) * (b - 1)) / 2, 3);
}

/** 석회수의 뿌연 정도로 정해지는 결과 말: 0.5 미만 맑음, 5.5 미만 조금 뿌예짐, 그 이상 뿌예짐 (표의 값 0, 3, 8 사이의 가운데 값) */
export function limewaterOutcome(cloud: number): CpOutcome {
  if (cloud < 0.5) return 'limeClear';
  return cloud < 5.5 ? 'limeSlight' : 'limeCloudy';
}

/** 태운 시간에서 정해지는 검사 결과(범주) */
export function outcomeOf(burnMin: number, test: CpTest): CpOutcome {
  return test === 'paper' ? (burnMin > 0 ? 'paperRed' : 'paperBlue') : limewaterOutcome(cloudAtBurn(burnMin));
}

/** 변화 단계(0 = 변화 없음) */
export const stageOf = (outcome: CpOutcome, test: CpTest): number => CP_STAGES[test].indexOf(outcome);

/**
 * 연소 전과 후 비교하기. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 시간 축은 0~3분이다. 초는 0분부터 고른 시간까지만 타고 그 뒤에는 꺼 둔다(검사 결과는 그대로 남는다).
 * 푸른색 염화 코발트 종이: 0분이면 푸른색 그대로, 1분·3분이면 붉은색(1분이 되면 붉게 변해 있다).
 * 석회수: 0분 0(맑음), 1분 3(조금 뿌예짐), 3분 8(뿌예짐). 집기병 색은 쓰지 않는다.
 * 그래프가 그리는 석회수 뿌연 정도는 종이 검사에는 없다.
 */
export function simulateCombustionProducts(params: CombustionProductsParams): CombustionProductsOutput {
  checkParams(params);
  const steps = Math.round(CP_TOTAL_MIN / CP_SAMPLE_MIN);
  const samples: CombustionProductsSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * CP_SAMPLE_MIN, 6);
    const burned = Math.min(t, params.burnMin);
    samples.push({
      t,
      burned: roundTo(burned, 6),
      cloud: params.test === 'limewater' ? cloudAtBurn(burned) : Number.NaN,
      red: params.burnMin > 0 ? roundTo(Math.min(1, burned / 1), 6) : 0,
      shorterMm: roundTo(CP_SHORTER_MM_PER_MIN * burned, 6),
    });
  }
  const outcome = outcomeOf(params.burnMin, params.test);
  return {
    samples,
    result: {
      result: outcome,
      cloud: params.test === 'limewater' ? cloudAtBurn(params.burnMin) : null,
      shorterMm: roundTo(CP_SHORTER_MM_PER_MIN * params.burnMin, 1),
      stage: stageOf(outcome, params.test),
    },
  };
}

/** 두 샘플 사이를 선형 보간한다(NaN은 그대로 NaN). */
export function interpolateCombustionProducts(a: CombustionProductsSample, b: CombustionProductsSample, k: number): CombustionProductsSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), burned: lerp(a.burned, b.burned), cloud: lerp(a.cloud, b.cloud), red: lerp(a.red, b.red), shorterMm: lerp(a.shorterMm, b.shorterMm) };
}

const KEYS = ['burnMin', 'test', 'jar'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { burnMin: CP_BURN_MIN, test: CP_TESTS, jar: CP_JARS };

/** 매니페스트의 연소 전과 후 비교하기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateCombustionProductsExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
