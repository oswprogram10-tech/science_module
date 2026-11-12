import {
  SPRING_COLORS,
  SPRING_OBJECTS,
  SPRING_WEIGHTS,
  simulateSpringScale,
  type SpringColor,
  type SpringObject,
  type SpringScaleParams,
  type SpringScaleResult,
  type SpringScaleSample,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): SpringScaleParams => {
  const w = Number(values.weights);
  return {
    weights: (SPRING_WEIGHTS as readonly number[]).includes(w) ? w : 0,
    object: pick(SPRING_OBJECTS, values.object, 'none'),
    springColor: pick(SPRING_COLORS, values.springColor, 'yellow'),
  };
};

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const springOutput = (values: Values) => simulateSpringScale(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 용수철은 늘어나지 않았다. */
export const startSample = (values: Values): SpringScaleSample => springOutput(values).samples[0]!;

export const springResult = (values: Values): SpringScaleResult => springOutput(values).result;

export const OBJECT_TEXT: Record<SpringObject, string> = { none: '없음', case: '필통', scissors: '가위', glue: '풀', pencils: '색연필 묶음' };
export const COLOR_TEXT: Record<SpringColor, string> = { yellow: '노란색', green: '초록색' };
export const COLOR_FILL: Record<SpringColor, string> = { yellow: '#eab308', green: '#16a34a' };

/** 결과 열 글자 */
export const stretchText = (r: Pick<SpringScaleResult, 'stretch'>) => r.stretch.toFixed(1);
export const readingText = (r: Pick<SpringScaleResult, 'reading'>) => String(r.reading);

/** 눈으로 보기 아래 문구 */
export const springNote = (s: Pick<SpringScaleSample, 't' | 'stretchCm'>) => `${s.t.toFixed(1)}초 · 용수철이 ${s.stretchCm.toFixed(1)} cm 늘어남`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
