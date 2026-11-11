import {
  GAS_CAPS,
  GAS_LABELS,
  GAS_PUMPS,
  simulateGasWeight,
  type GasCap,
  type GasFirm,
  type GasLabel,
  type GasWeightParams,
  type GasWeightResult,
  type GasWeightSample,
} from '@sci/engine-matter';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): GasWeightParams => {
  const n = Number(values.pumps);
  return {
    pumps: (GAS_PUMPS as readonly number[]).includes(n) ? n : 0,
    cap: pick(GAS_CAPS, values.cap, 'closed'),
    label: pick(GAS_LABELS, values.label, 'red'),
  };
};

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const gasOutput = (values: Values) => simulateGasWeight(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 아직 누르지 않았고 병은 말랑하다. */
export const startSample = (values: Values): GasWeightSample => gasOutput(values).samples[0]!;

export const gasResult = (values: Values): GasWeightResult => gasOutput(values).result;

export const CAP_TEXT: Record<GasCap, string> = { closed: '닫아 둠', open: '열어서 공기를 뺌' };
export const LABEL_TEXT: Record<GasLabel, string> = { red: '빨간색', blue: '파란색' };
export const LABEL_FILL: Record<GasLabel, string> = { red: '#ef4444', blue: '#3b82f6' };
export const FIRM_TEXT: Record<GasFirm, string> = { soft: '말랑함', slight: '조금 단단함', firm: '단단함', hard: '아주 단단함' };

/** 결과 열 글자 */
export const weightText = (r: Pick<GasWeightResult, 'weight'>) => r.weight.toFixed(1);
export const firmText = (r: Pick<GasWeightResult, 'firm'>) => FIRM_TEXT[r.firm];

/** 눈으로 보기 아래 문구 */
export const gasNote = (s: Pick<GasWeightSample, 'pressed' | 'weight'>) => `${Math.floor(s.pressed + 1e-9)}번 누름 · 저울 ${s.weight.toFixed(1)} g`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
