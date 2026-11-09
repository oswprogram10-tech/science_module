import {
  growWindow,
  simulateMagma,
  type MagmaParams,
  type MagmaResult,
  type MagmaSample,
} from '@sci/engine-earth';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

const numParam = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const magmaOptions = (exp: VariableExperiment) => ({ startC: numParam(exp.params?.startC) });

const simulate = (values: Values, exp: VariableExperiment) => simulateMagma(values as unknown as MagmaParams, magmaOptions(exp));

/** 고른 조건 그대로 계산한 결과. 시간에 따라 변하지 않는다. */
export const magmaResult = (values: Values, exp: VariableExperiment): MagmaResult => simulate(values, exp).result;

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 t = 0 의 샘플(막 녹인 물질). */
export const initialSample = (values: Values, exp: VariableExperiment): MagmaSample => simulate(values, exp).samples[0]!;

/** 알갱이가 자라는 구간의 시작·끝 시각(초). */
export const magmaWindow = (values: Values, exp: VariableExperiment) => growWindow(values as unknown as MagmaParams, magmaOptions(exp));

export const ROCK_TEXT = { basalt: '현무암 쪽', between: '중간', granite: '화강암 쪽' } as const;
export const ROCK_CARD_TEXT = {
  basalt: '현무암처럼 알갱이가 작아요',
  between: '중간 크기예요',
  granite: '화강암처럼 알갱이가 커요',
} as const;
