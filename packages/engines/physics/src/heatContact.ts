import type { VariableExperiment as Experiment } from '@sci/schema';

export const HEAT_HOTS = [50, 60, 70] as const;
export const HEAT_COLDS = [100, 300] as const;
export const HEAT_CUPS = ['metal', 'plastic'] as const;
export type HeatCup = (typeof HEAT_CUPS)[number];
export const HEAT_LABELS = ['yellow', 'green'] as const;
export type HeatLabel = (typeof HEAT_LABELS)[number];

export interface HeatContactParams {
  /** 안쪽 컵 물의 처음 온도(°C) */
  hotC: number;
  /** 바깥 비커 찬물의 양(mL) */
  coldMl: number;
  /** 안쪽 컵 재료: 빠르기만 바뀐다. */
  cup: HeatCup;
  /** 컵에 붙인 이름표 색: 계산에 쓰지 않는 대조 변인 */
  label: HeatLabel;
}

export interface HeatContactSample {
  /** 분 */
  t: number;
  /** 안쪽 물의 온도(°C) */
  innerC: number;
  /** 바깥 물의 온도(°C) */
  outerC: number;
}

export interface HeatContactResult {
  /** 10분 뒤 안쪽 물 온도(°C), 정수 */
  inner10: number;
  /** 10분 뒤 바깥 물 온도(°C), 정수 */
  outer10: number;
  /** 두 온도 차가 1 °C 안이 된 때(분), 정수. 20분 안에 안 되면 null(화면에는 "20분 넘음") */
  sameMin: number | null;
}

export interface HeatContactOutput {
  samples: HeatContactSample[];
  result: HeatContactResult;
}

/** 안쪽 컵 물의 양(mL): 고정 */
export const INNER_ML = 100;
/** 찬물의 처음 온도(°C): 고정 */
export const COLD_START_C = 20;
/** 컵 재료의 빠르기 k₀(/분): 금속 0.6, 플라스틱 0.2 */
export const K0: Record<HeatCup, number> = { metal: 0.6, plastic: 0.2 };
/** 결과를 읽는 때(분) */
export const READ_MIN = 10;
/** 그래프·표본이 끝나는 때(분) */
export const HEAT_TOTAL_MIN = 20;
export const HEAT_SAMPLE_MIN = 0.25;
/** 두 온도 차가 이 값 이하이면 "1 °C 안"이다. */
export const SAME_DIFF_C = 1;
/** 화면에서 두 온도를 같다고 보는 기준(°C): 정수로 읽으므로 0.5 */
export const HEAT_SAME_C = 0.5;
/** 그래프 세로축 끝(°C) */
export const HEAT_Y_MAX_C = 80;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: HeatContactParams): void => {
  if (typeof p.hotC !== 'number' || !(HEAT_HOTS as readonly number[]).includes(p.hotC)) throw new RangeError(`안쪽 컵 물의 처음 온도 ${String(p.hotC)}은(는) ${HEAT_HOTS.join(', ')} °C 중 하나여야 합니다.`);
  if (typeof p.coldMl !== 'number' || !(HEAT_COLDS as readonly number[]).includes(p.coldMl)) throw new RangeError(`찬물의 양 ${String(p.coldMl)}은(는) ${HEAT_COLDS.join(', ')} mL 중 하나여야 합니다.`);
  if (!(HEAT_CUPS as readonly string[]).includes(p.cup)) throw new RangeError(`안쪽 컵 재료 ${String(p.cup)}은(는) ${HEAT_CUPS.join(', ')} 중 하나여야 합니다.`);
  if (!(HEAT_LABELS as readonly string[]).includes(p.label)) throw new RangeError(`이름표 색 ${String(p.label)}은(는) ${HEAT_LABELS.join(', ')} 중 하나여야 합니다.`);
};

/** 나중 온도 Tf = (100·Th + m·20) / (100 + m) */
export const finalC = (p: Pick<HeatContactParams, 'hotC' | 'coldMl'>): number => (INNER_ML * p.hotC + p.coldMl * COLD_START_C) / (INNER_ML + p.coldMl);

/** 빠르기 k = k₀ · 100 · (1/100 + 1/m) (/분) */
export const rateOf = (p: Pick<HeatContactParams, 'coldMl' | 'cup'>): number => K0[p.cup] * INNER_ML * (1 / INNER_ML + 1 / p.coldMl);

/** 두 물의 온도 차 D(t) = (Th − 20) · e^(−kt) */
export const diffAt = (p: Pick<HeatContactParams, 'hotC' | 'coldMl' | 'cup'>, minutes: number): number => (p.hotC - COLD_START_C) * Math.exp(-rateOf(p) * minutes);

/** 안쪽 = Tf + D · m/(100+m), 바깥 = Tf − D · 100/(100+m) */
export function temperaturesAt(p: Pick<HeatContactParams, 'hotC' | 'coldMl' | 'cup'>, minutes: number): { innerC: number; outerC: number } {
  const tf = finalC(p);
  const d = diffAt(p, minutes);
  return { innerC: tf + (d * p.coldMl) / (INNER_ML + p.coldMl), outerC: tf - (d * INNER_ML) / (INNER_ML + p.coldMl) };
}

/** 두 온도 차가 1 °C 안이 된 때(분): D(t) ≤ 1인 가장 이른 정수 분 = ceil(ln(D₀) / k). 20분 안에 안 되면 null. */
export function sameMinOf(p: Pick<HeatContactParams, 'hotC' | 'coldMl' | 'cup'>): number | null {
  for (let m = 0; m <= HEAT_TOTAL_MIN; m++) {
    if (diffAt(p, m) <= SAME_DIFF_C + 1e-9) return m;
  }
  return null;
}

/**
 * 온도가 다른 두 물이 닿을 때. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 안쪽 컵 물 100 mL와 바깥 비커 찬물(처음 20 °C). 차이 D(t) = (Th − 20)·e^(−kt)로 줄고, 안쪽과 바깥은 나중 온도 Tf를 사이에 두고 양쪽에서 다가간다.
 * 컵 재료와 이름표 색 가운데 이름표 색은 계산에 쓰지 않는다. 0~20분을 0.25분 간격으로 계산한다.
 */
export function simulateHeatContact(params: HeatContactParams): HeatContactOutput {
  checkParams(params);
  const steps = Math.round(HEAT_TOTAL_MIN / HEAT_SAMPLE_MIN);
  const samples: HeatContactSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * HEAT_SAMPLE_MIN, 6);
    const { innerC, outerC } = temperaturesAt(params, t);
    samples.push({ t, innerC: roundTo(innerC, 9), outerC: roundTo(outerC, 9) });
  }
  const at10 = temperaturesAt(params, READ_MIN);
  return { samples, result: { inner10: Math.round(roundTo(at10.innerC, 9)), outer10: Math.round(roundTo(at10.outerC, 9)), sameMin: sameMinOf(params) } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateHeatContact(a: HeatContactSample, b: HeatContactSample, k: number): HeatContactSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), innerC: lerp(a.innerC, b.innerC), outerC: lerp(a.outerC, b.outerC) };
}

const KEYS = ['hotC', 'coldMl', 'cup', 'label'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { hotC: HEAT_HOTS, coldMl: HEAT_COLDS, cup: HEAT_CUPS, label: HEAT_LABELS };

/** 매니페스트의 온도가 다른 두 물 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateHeatContactExperiment(exp: Experiment): string[] {
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
