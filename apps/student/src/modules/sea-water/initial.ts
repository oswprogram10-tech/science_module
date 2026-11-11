import { simulateSeaWater, type SeaDishKind, type SeaWaterParams, type SeaWaterResult, type SeaWaterSample, type WaterKind } from '@sci/engine-earth';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const seaWaterOptions = (exp?: VariableExperiment) => ({
  totalMin: typeof exp?.params?.totalMin === 'number' ? exp.params.totalMin : undefined,
});

export const toParams = (values: Values): SeaWaterParams => ({
  water: values.water === 'sea' ? 'sea' : 'river',
  volumeMl: Number(values.volumeMl),
  dish: values.dish === 'square' ? 'square' : 'round',
});

export const seaWaterOutput = (values: Values, exp?: VariableExperiment) => simulateSeaWater(toParams(values), seaWaterOptions(exp));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): SeaWaterSample => seaWaterOutput(values, exp).samples[0]!;

export const seaWaterResult = (values: Values, exp?: VariableExperiment): SeaWaterResult => seaWaterOutput(values, exp).result;

export const WATER_TEXT: Record<WaterKind, string> = { river: '강물', sea: '바닷물' };
export const DISH_TEXT: Record<SeaDishKind, string> = { round: '둥근 증발 접시', square: '네모난 증발 접시' };

/** 눈으로 보기 아래 문구 */
export const seaWaterNote = (s: Pick<SeaWaterSample, 't' | 'dishWaterMl' | 'residueG'>) =>
  `${s.t.toFixed(1)}분 · 접시에 남은 물 ${Math.round(s.dishWaterMl)} mL · 접시 위 가루 ${s.residueG.toFixed(1)} g`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
