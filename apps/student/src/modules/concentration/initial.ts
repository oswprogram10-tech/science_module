import {
  CONC_CUPS,
  CONC_SUGARS,
  simulateConcentration,
  type ConcCup,
  type ConcSugar,
  type ConcentrationParams,
  type ConcentrationResult,
  type ConcentrationSample,
} from '@sci/engine-matter';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): ConcentrationParams => {
  const spoons = Number(values.spoons);
  const water = Number(values.waterMl);
  return {
    spoons: spoons === 3 || spoons === 5 ? spoons : 1,
    waterMl: water === 50 ? 50 : 100,
    sugar: pick(CONC_SUGARS, values.sugar, 'brown'),
    cup: pick(CONC_CUPS, values.cup, 'low'),
  };
};

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const concOutput = (values: Values) => simulateConcentration(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 방울토마토는 바닥에 있다. */
export const startSample = (values: Values): ConcentrationSample => concOutput(values).samples[0]!;

export const concResult = (values: Values): ConcentrationResult => concOutput(values).result;

export const SUGAR_TEXT: Record<ConcSugar, string> = { brown: '황설탕', white: '흰 설탕' };
export const CUP_TEXT: Record<ConcCup, string> = { low: '낮은 비커', high: '높은 비커' };

/** 눈으로 보기 위쪽 문구: 넣은 설탕과 물의 양 */
export const mixLine = (p: Pick<ConcentrationParams, 'sugar' | 'spoons' | 'waterMl'>): string => `${SUGAR_TEXT[p.sugar]} ${p.spoons}숟가락 · 물 ${p.waterMl} mL`;

/** 눈으로 보기 아래 문구 */
export const concNote = (s: Pick<ConcentrationSample, 't' | 'floatH'>, color: number) => `${s.t.toFixed(1)}초 · 방울토마토 높이 ${s.floatH.toFixed(1)}눈금 · 색의 진하기 ${color}눈금`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
