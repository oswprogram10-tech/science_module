import type { VariableExperiment as Experiment } from '@sci/schema';

export const GAS_PUMPS = [0, 20, 40, 60] as const;
export const GAS_CAPS = ['closed', 'open'] as const;
export type GasCap = (typeof GAS_CAPS)[number];
export const GAS_LABELS = ['red', 'blue'] as const;
export type GasLabel = (typeof GAS_LABELS)[number];
/** 손으로 눌렀을 때: 말랑함 / 조금 단단함 / 단단함 / 아주 단단함 */
export type GasFirm = 'soft' | 'slight' | 'firm' | 'hard';

export interface GasWeightParams {
  /** 공기 주입 마개를 누른 횟수 */
  pumps: number;
  /** 마개: 닫아 둠 / 열어서 공기를 뺌 */
  cap: GasCap;
  /** 페트병 띠지 색깔: 계산에 쓰지 않는 대조 변인 */
  label: GasLabel;
}

export interface GasWeightSample {
  /** 누른 횟수 축(0~60). 이 모델의 그래프 가로축이다. */
  t: number;
  /** 지금까지 실제로 누른 횟수 = min(t, 정한 횟수) */
  pressed: number;
  /** 전자저울 무게(g) */
  weight: number;
  /** 병이 팽팽해진 정도(0~1): 닫아 둔 병이 누른 횟수 ÷ 60만큼 팽팽하다. 마개를 열면 언제나 0이다. */
  taut: number;
}

export interface GasWeightResult {
  /** 전자저울 무게(g), 소수 첫째 자리 */
  weight: number;
  /** 손으로 눌렀을 때(범주) */
  firm: GasFirm;
}

export interface GasWeightOutput {
  samples: GasWeightSample[];
  result: GasWeightResult;
}

/** 처음 페트병 무게(g) */
export const GAS_BASE_G = 45.3;
/** 누를 때마다 늘어나는 무게(g). 교실 실측값에 맞춰 바꿀 수 있다. */
export const GAS_PER_PUMP_G = 0.025;
/** 그래프 가로축 끝(누른 횟수)과 세로축 범위(g) */
export const GAS_X_MAX = 60;
export const GAS_Y_MIN_G = 45;
export const GAS_Y_MAX_G = 47;
/** 화면에서 두 무게를 같다고 보는 기준(g): 가장 작은 차이가 0.5 g이다. */
export const GAS_SAME_G = 0.05;

/** 닫아 둔 병의 단단함: 0번 말랑함, 20번 조금 단단함, 40번 단단함, 60번 아주 단단함 */
export const FIRM_OF_PUMPS: Record<number, GasFirm> = { 0: 'soft', 20: 'slight', 40: 'firm', 60: 'hard' };

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: GasWeightParams): void => {
  if (typeof p.pumps !== 'number' || !(GAS_PUMPS as readonly number[]).includes(p.pumps)) throw new RangeError(`누른 횟수 ${String(p.pumps)}은(는) ${GAS_PUMPS.join(', ')} 중 하나여야 합니다.`);
  if (!(GAS_CAPS as readonly string[]).includes(p.cap)) throw new RangeError(`마개 ${String(p.cap)}은(는) ${GAS_CAPS.join(', ')} 중 하나여야 합니다.`);
  if (!(GAS_LABELS as readonly string[]).includes(p.label)) throw new RangeError(`띠지 색깔 ${String(p.label)}은(는) ${GAS_LABELS.join(', ')} 중 하나여야 합니다.`);
};

/** 누른 횟수(마개를 닫아 둘 때)에 따른 무게(g): 45.3 + 0.025 × 횟수 */
export const weightOfPressed = (pressed: number): number => GAS_BASE_G + GAS_PER_PUMP_G * pressed;

/**
 * 공기를 넣은 페트병의 무게. 수치는 이상화한 근사값이며 교사 검수 대상이다. 난수 없음(저울 떨림 없음).
 * 마개를 닫아 두면 무게 = 45.3 + 0.025 × 누른 횟수(0 → 45.3, 20 → 45.8, 40 → 46.3, 60 → 46.8), 마개를 열면 횟수와 상관없이 45.3 g, 말랑함.
 * 단단함은 0번 말랑함, 20번 조금 단단함, 40번 단단함, 60번 아주 단단함. 띠지 색깔은 계산에 쓰지 않는다.
 * 가로축은 누른 횟수 0~60이다(표본은 1회마다). 정한 횟수까지 누른 뒤에는 더 누르지 않아 무게와 팽팽함이 그대로이다.
 */
export function simulateGasWeight(params: GasWeightParams): GasWeightOutput {
  checkParams(params);
  const closed = params.cap === 'closed';
  const weight = roundTo(closed ? weightOfPressed(params.pumps) : GAS_BASE_G, 1);
  const firm: GasFirm = closed ? FIRM_OF_PUMPS[params.pumps]! : 'soft';
  const samples: GasWeightSample[] = [];
  for (let t = 0; t <= GAS_X_MAX; t++) {
    const pressed = Math.min(t, params.pumps);
    samples.push({
      t,
      pressed,
      weight: roundTo(closed ? weightOfPressed(pressed) : GAS_BASE_G, 9),
      taut: closed ? roundTo(pressed / GAS_X_MAX, 9) : 0,
    });
  }
  return { samples, result: { weight, firm } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateGasWeight(a: GasWeightSample, b: GasWeightSample, k: number): GasWeightSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), pressed: lerp(a.pressed, b.pressed), weight: lerp(a.weight, b.weight), taut: lerp(a.taut, b.taut) };
}

/** 매니페스트의 공기를 넣은 페트병 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateGasWeightExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const allowed: Record<string, readonly (string | number)[]> = { pumps: GAS_PUMPS, cap: GAS_CAPS, label: GAS_LABELS };
  for (const key of Object.keys(allowed)) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!allowed[key]!.includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${allowed[key]!.join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
