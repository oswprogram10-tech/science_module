import { simulateSeparation, type SeparationFilter, type SeparationParams, type SeparationResult, type SeparationSample, type SeparationStage, type SeparationStirrer } from '@sci/engine-matter';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const separationOptions = (exp?: VariableExperiment) => ({
  totalMin: typeof exp?.params?.totalMin === 'number' ? exp.params.totalMin : undefined,
});

export const toParams = (values: Values): SeparationParams => ({
  waterMl: Number(values.waterMl),
  filter: values.filter === 'pour' ? 'pour' : 'paper',
  stirrer: values.stirrer === 'wood' ? 'wood' : 'glass',
});

export const separationOutput = (values: Values, exp?: VariableExperiment) => simulateSeparation(toParams(values), separationOptions(exp));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): SeparationSample => separationOutput(values, exp).samples[0]!;

export const separationResult = (values: Values, exp?: VariableExperiment): SeparationResult => separationOutput(values, exp).result;

export const FILTER_TEXT: Record<SeparationFilter, string> = { paper: '거름종이로 거르기', pour: '거름종이 없이 윗물만 따르기' };
export const STIRRER_TEXT: Record<SeparationStirrer, string> = { glass: '유리 막대', wood: '나무 젓가락' };

/** 단계 이름. 거르는 방법에 따라 2단계 이름이 다르다. */
export const stageName = (stage: SeparationStage, filter: SeparationFilter) => (stage === 'dissolve' ? '녹이기' : stage === 'filter' ? (filter === 'paper' ? '거르기' : '따르기') : '증발시키기');

/** 눈으로 보기 아래 문구 */
export const separationNote = (s: Pick<SeparationSample, 't' | 'stage' | 'solidG'>, filter: SeparationFilter) => `${s.t.toFixed(1)}분 · ${stageName(s.stage, filter)} · 접시 위 가루 ${s.solidG.toFixed(1)} g`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
