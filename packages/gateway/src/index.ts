import { josa } from './josa';

export { josa } from './josa';
export type { JosaPair } from './josa';

export type Prediction = 'increase' | 'decrease' | 'same';
export type Values = Record<string, string | number>;

export interface TrialLike {
  values: Values;
  ivKey: string | null;
}

export type AnalysisKind = 'first-trial' | 'repeat' | 'fair-test' | 'confounded' | 'iv-unchanged';

export interface TrialAnalysis {
  kind: AnalysisKind;
  changed: string[];
}

export interface GatewayRunConfig {
  requirePrediction: boolean;
  requireSingleIV: boolean;
}

export interface RunState {
  ivKey: string | null;
  prediction: Prediction | null;
}

export const REASON_NEED_PREDICTION = '예측을 먼저 골라 주세요.';
export const REASON_NEED_IV = '바꿀 조건(조작변인)을 하나 골라 주세요.';

export function canRun(
  state: RunState,
  config: GatewayRunConfig,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (config.requirePrediction && !state.prediction) reasons.push(REASON_NEED_PREDICTION);
  if (config.requireSingleIV && !state.ivKey) reasons.push(REASON_NEED_IV);
  return { ok: reasons.length === 0, reasons };
}

/** 바로 앞 시행과 비교해 시행의 종류를 분류한다. */
export function analyzeTrial(
  prev: TrialLike | undefined,
  current: TrialLike,
  _variableLabels?: Record<string, string>,
): TrialAnalysis {
  if (!prev) return { kind: 'first-trial', changed: [] };
  const keys = new Set([...Object.keys(prev.values), ...Object.keys(current.values)]);
  const changed = [...keys].filter((k) => prev.values[k] !== current.values[k]);
  if (changed.length === 0) return { kind: 'repeat', changed: [] };
  if (changed.length === 1 && changed[0] === current.ivKey) {
    return { kind: 'fair-test', changed };
  }
  if (current.ivKey !== null && !changed.includes(current.ivKey)) {
    return { kind: 'iv-unchanged', changed };
  }
  return { kind: 'confounded', changed };
}

/** "A와 B" 형태로 조사를 맞춰 잇는다. 마지막 낱말에는 아무것도 붙이지 않는다. */
export function joinLabels(words: string[]): string {
  return words
    .map((w, i) => (i < words.length - 1 ? `${w}${josa(w, '와/과')}` : w))
    .join(' ');
}

export function structuralFeedback(
  analysis: TrialAnalysis,
  labels: Record<string, string>,
  ivKey?: string | null,
): string | null {
  const words = analysis.changed.map((k) => labels[k] ?? k);
  if (words.length === 0) return null;
  if (analysis.kind === 'iv-unchanged') {
    if (!ivKey) return null;
    const iv = labels[ivKey] ?? ivKey;
    return `바꿀 조건으로 고른 ${iv}${josa(iv, '은/는')} 그대로이고, ${joinLabels(words)}${josa(words[words.length - 1]!, '이/가')} 바뀌었어요.`;
  }
  if (analysis.kind !== 'confounded') return null;
  const list = joinLabels(words);
  const last = words[words.length - 1]!;
  return `${list}${josa(last, '이/가')} 함께 바뀌어서, 녹은 양이 무엇 때문에 달라졌는지 알 수 없어요.`;
}

/** 두 시행의 녹은 양을 비교한다. 차이가 숟가락 1개 이하이면 'same'. */
export function observedOutcome(prevG: number, currentG: number, spoonGrams: number): Prediction {
  const diff = currentG - prevG;
  if (Math.abs(diff) <= spoonGrams + 1e-9) return 'same';
  return diff > 0 ? 'increase' : 'decrease';
}

export const PREDICTION_LABEL: Record<Prediction, string> = {
  increase: '늘어난다',
  decrease: '줄어든다',
  same: '변하지 않는다',
};
export const OBSERVED_LABEL: Record<Prediction, string> = {
  increase: '늘어났다',
  decrease: '줄어들었다',
  same: '변하지 않았다',
};
