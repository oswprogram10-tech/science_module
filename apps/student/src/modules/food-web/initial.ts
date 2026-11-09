import { simulateFoodWeb, type FoodWebParams, type FoodWebResult, type FoodWebSample, type RainKind } from '@sci/engine-life';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const foodWebOptions = (exp: VariableExperiment) => ({
  days: typeof exp.params?.days === 'number' ? exp.params.days : undefined,
});

const toParams = (values: Values) => values as unknown as FoodWebParams;

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const foodWebOutput = (values: Values, exp?: VariableExperiment) => simulateFoodWeb(toParams(values), exp ? foodWebOptions(exp) : {});

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 0일째 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): FoodWebSample => foodWebOutput(values, exp).samples[0]!;

export type FurColor = 'white' | 'brown';
export const rainOf = (values: Values): RainKind => (values.rain === 'low' || values.rain === 'high' ? values.rain : 'normal');
export const furOf = (values: Values): FurColor => (values.furColor === 'brown' ? 'brown' : 'white');

export const RAIN_TEXT: Record<RainKind, string> = { low: '적게', normal: '보통', high: '많이' };
export const FUR_TEXT: Record<FurColor, string> = { white: '흰색', brown: '갈색' };
/** 가상 비 측정기 대신 구름과 빗줄기 수로 비를 보여 준다. */
export const CLOUDS: Record<RainKind, number> = { low: 1, normal: 2, high: 3 };
export const RAIN_LINES: Record<RainKind, number> = { low: 3, normal: 6, high: 10 };

/** 화면에 보이는 동물 수와 풀의 양(반올림) */
export const shownCounts = (s: FoodWebSample) => ({
  grass: Math.round(s.grassPct),
  rabbits: Math.round(s.rabbits),
  foxes: Math.round(s.foxes),
});

/** 아래 문구 */
export function foodWebNote(s: FoodWebSample): string {
  const c = shownCounts(s);
  return `${Math.round(s.t)}일째 · 풀 ${c.grass}% · 토끼 ${c.rabbits}마리 · 여우 ${c.foxes}마리`;
}

/** 결과 열 글자 */
export const grassText = (r: FoodWebResult) => String(r.grassDay60);
export const rabbitsText = (r: FoodWebResult) => String(r.rabbitsDay60);
export const foxesText = (r: FoodWebResult) => String(r.foxesDay60);
export const rabbitsMaxText = (r: FoodWebResult) => String(r.rabbitsMax);
