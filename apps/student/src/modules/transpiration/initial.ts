import {
  PER_LEAF_ML_PER_DAY,
  WIND_FACTOR,
  perLeafPerDay,
  simulateTranspiration,
  type Droplets,
  type LightKind,
  type TranspirationParams,
  type TranspirationResult,
  type TranspirationSample,
  type WindKind,
} from '@sci/engine-life';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const transpirationOptions = (exp: VariableExperiment) => ({
  hours: typeof exp.params?.hours === 'number' ? exp.params.hours : undefined,
});

const toParams = (values: Values) => values as unknown as TranspirationParams;

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const transpirationOutput = (values: Values, exp?: VariableExperiment) =>
  simulateTranspiration(toParams(values), exp ? transpirationOptions(exp) : {});

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 0시간째 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): TranspirationSample => transpirationOutput(values, exp).samples[0]!;

/** 결과 열 글자 */
export const lostText = (r: TranspirationResult) => r.lostMl.toFixed(1);
export const remainingText = (r: TranspirationResult) => r.remainingMl.toFixed(1);
export const DROPLETS_TEXT: Record<Droplets, string> = { none: '없음', some: '조금', many: '많음' };
export const dropletsText = (r: TranspirationResult) => DROPLETS_TEXT[r.droplets];

/** 시간(시간)을 "48", "12.5"로 */
export const hourText = (t: number) => String(Number(t.toFixed(1)));
/** 물의 양(mL)을 소수 첫째 자리로 */
export const mlText = (ml: number) => ml.toFixed(1);

/** 가상 빛 센서 값(%): 밝은 곳과 어두운 곳 */
export const LIGHT_PCT = { bright: 80, dark: 2 } as const;
/** 가상 습도 센서: 비닐봉지 안 습도(%) = fog × 60 + 35 */
export const humidityPct = (fog: number) => fog * 60 + 35;

export const lightOf = (values: Values): LightKind => (values.light === 'dark' ? 'dark' : 'bright');
export const windOf = (values: Values): WindKind => (values.wind === 'on' ? 'on' : 'off');
export const leavesOf = (values: Values): number => Math.max(0, Math.round(Number(values.leaves)));

/** 증산 빠르기(0~1): 잎 한 장이 내보내는 양을 가장 많은 조건(밝음·바람)에 견준 값. 잎이 없으면 0. */
export function transpirationRate(leaves: number, light: LightKind, wind: WindKind): number {
  if (leaves <= 0) return 0;
  return perLeafPerDay(light, wind) / (PER_LEAF_ML_PER_DAY.bright * WIND_FACTOR);
}

/** 기공 하나에서 나오는 수증기 점의 수: 증산 빠르기에 비례해 1~6개. 잎이 없으면 0. */
export const vaporPerStoma = (rate: number) => (rate > 0 ? Math.max(1, Math.round(rate * 6)) : 0);
