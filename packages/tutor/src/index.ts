import {
  joinLabels,
  josa,
  type JosaPair,
  type Prediction,
  type TrialAnalysis,
} from '@sci/gateway';

export const FALLBACK_PROBE = '지금까지의 결과표를 다시 살펴볼까요? 무엇이 달라졌나요?';

export interface ProbeTemplate {
  when: string;
  text: string;
}

export interface ProbeContext {
  /** 마지막 시행의 분석. 아직 실행한 적이 없으면 undefined. */
  lastAnalysis?: TrialAnalysis;
  /** 조작변인 키(실행 전에는 현재 선택, 실행 후에는 마지막 시행의 값). */
  ivKey?: string | null;
  labels: Record<string, string>;
  /** 마지막 시행의 예측과, fair-test일 때 관찰된 변화. */
  prediction?: Prediction | null;
  observed?: Prediction | null;
}

export interface GuardConfig {
  forbiddenAnswers: string[];
  limits: string[];
}

export interface GuardResult {
  ok: boolean;
  hits: string[];
}

const stripSpaces = (s: string) => s.replace(/\s+/g, '');

export function guardOutput(text: string, config: GuardConfig): GuardResult {
  const haystack = stripSpaces(text);
  const hits = [...config.forbiddenAnswers, ...config.limits].filter((phrase) => {
    const needle = stripSpaces(phrase);
    return needle.length > 0 && haystack.includes(needle);
  });
  return { ok: hits.length === 0, hits };
}

const JOSA_PATTERN = /(\S)(을\(를\)|이\(가\)|와\(과\)|은\(는\))/g;

/** 템플릿의 {iv}, {changed}를 라벨로 바꾸고, 괄호형 조사를 앞 낱말 받침에 맞춘다. */
export function renderProbe(
  template: string,
  vars: { iv: string; changed: string[] },
): string {
  const text = template
    .replaceAll('{iv}', vars.iv)
    .replaceAll('{changed}', joinLabels(vars.changed));
  return text.replace(JOSA_PATTERN, (_m, prev: string, pair: string) => {
    const p = `${pair[0]}/${pair[2]}` as JosaPair;
    return prev + josa(prev, p);
  });
}

export function pickProbeKey(context: ProbeContext): string {
  const a = context.lastAnalysis;
  if (!a) return 'before-run';
  if (a.kind === 'confounded') return 'confounded';
  if (a.kind === 'repeat') return 'repeat';
  if (a.kind === 'fair-test') {
    if (context.prediction && context.observed && context.prediction !== context.observed) {
      return 'prediction-mismatch';
    }
    if (context.ivKey === 'stir') return 'fair-test-stir';
    return 'fair-test';
  }
  return 'first-trial';
}

export function selectProbe(
  context: ProbeContext,
  probes: ProbeTemplate[],
  guard?: GuardConfig,
): string {
  const key = pickProbeKey(context);
  const probe = probes.find((p) => p.when === key);
  if (!probe) return FALLBACK_PROBE;
  const ivLabel = context.ivKey ? (context.labels[context.ivKey] ?? context.ivKey) : '조건';
  const changed = (context.lastAnalysis?.changed ?? []).map((k) => context.labels[k] ?? k);
  const text = renderProbe(probe.text, { iv: ivLabel, changed });
  if (guard && !guardOutput(text, guard).ok) return FALLBACK_PROBE;
  return text;
}
