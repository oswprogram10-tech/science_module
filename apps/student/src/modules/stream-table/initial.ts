import { simulateStream, type SlopeKind, type StreamParams, type StreamResult, type StreamSample, type VesselKind } from '@sci/engine-earth';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const streamOptions = (exp?: VariableExperiment) => ({
  totalS: typeof exp?.params?.totalS === 'number' ? exp.params.totalS : undefined,
});

export const toParams = (values: Values): StreamParams => ({
  slope: values.slope === 'steep' ? 'steep' : 'gentle',
  waterL: Number(values.waterL),
  vessel: values.vessel === 'bottle' ? 'bottle' : 'cup',
});

export const streamOutput = (values: Values, exp?: VariableExperiment) => simulateStream(toParams(values), streamOptions(exp));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): StreamSample => streamOutput(values, exp).samples[0]!;

export const streamResult = (values: Values, exp?: VariableExperiment): StreamResult => streamOutput(values, exp).result;

export const SLOPE_TEXT: Record<SlopeKind, string> = { gentle: '완만한 언덕', steep: '가파른 언덕' };
export const VESSEL_TEXT: Record<VesselKind, string> = { cup: '컵', bottle: '페트병' };

/** 눈으로 보기 아래 문구 */
export const streamNote = (s: Pick<StreamSample, 't' | 'eroded' | 'deposited'>) => `${s.t.toFixed(1)}초 · 깎인 흙 ${Math.round(s.eroded)} g · 쌓인 흙 ${Math.round(s.deposited)} g`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
