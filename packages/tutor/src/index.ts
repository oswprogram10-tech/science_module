import {
  joinLabels,
  josa,
  type JosaPair,
  type Prediction,
  type TrialAnalysis,
} from '@sci/gateway';
import { echoesMask, hasForeignScript } from './privacy';

/** guardOutput 걸림 이름: 한자·일본 글자 섞임, 개인정보 자리표시 되풀이. */
export const FOREIGN_SCRIPT_HIT = '한자·일본 글자';
export const MASK_ECHO_HIT = '개인정보 자리표시';

export const FALLBACK_PROBE = '지금까지의 결과표를 다시 살펴볼까요? 무엇이 달라졌나요?';

/** 선생님이 끈 상황: 튜터가 아무 말도 하지 않는다. 화면은 이 값(빈 문자열)이면 튜터 말풍선을 그리지 않는다. */
export const TUTOR_SILENT = '';

/** 바꾼 뒤에도 남은 `{이름}` 자리표시(선생님이 모르는 자리표시를 쓴 경우). */
const LEFTOVER_PLACEHOLDER = /\{[^{}]*\}/;

export interface ProbeTemplate {
  when: string;
  /** 이 조작변인일 때만 쓰는 질문. */
  iv?: string;
  text: string;
  /** 선생님이 끈 질문. renderAndGuard와 selectProbe가 이 질문을 고르면 TUTOR_SILENT를 돌려준다. */
  off?: boolean;
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

const normalize = (s: string) => s.normalize('NFC').replace(/[\s\p{P}\p{S}\p{Cf}]/gu, '');

/** 낱말(어절)로 나눈다. 보이지 않는 글자(폭 없는 공백 등)는 지우고, 띄어쓰기·문장 부호·기호에서 끊으며, 영문은 소문자로 맞춘다. */
const words = (s: string) =>
  s.normalize('NFC').toLowerCase().replace(/\p{Cf}/gu, '').split(/[\s\p{P}\p{S}]+/u).filter(Boolean);

/**
 * 제한 낱말 바로 뒤에 붙어도 그 낱말을 쓴 것으로 보는 조사·어미의 시작.
 * 이것으로 시작하지 않는 글자가 이어지면 다른 낱말이다(전자 → 전자석, 염 → 염산, 몰 → 몰라요).
 */
const PARTICLE_START =
  /^(?:은|는|이|인|가|을|를|의|에|와|과|도|만|로|으로|까지|부터|처럼|보다|이나|나|이랑|랑|이라|라는|라고|이란|이야|야|예요|이에|이다|입|들|하|해|했|한|할|함|합|되|돼|됐|된|될|됨|됩|시키|시켜|시킨)/;

/** 낱말 하나가 제한 낱말로 시작하고, 뒤에 아무것도 없거나 조사·어미만 붙었는가. */
const wordUses = (word: string, term: string) => word.startsWith(term) && (word.length === term.length || PARTICLE_START.test(word.slice(term.length)));

/**
 * 제한 낱말(limits)을 낱말 단위로 찾는다. 글자 일부만 같은 다른 낱말(전자석·이산화 탄소·염산·몰라요)은 걸지 않는다.
 * 여러 낱말로 된 용어(운동 에너지)는 이어진 낱말들로 찾고, 붙여 쓴 꼴(운동에너지)도 찾는다.
 */
export function usesLimitTerm(text: string, limit: string): boolean {
  const parts = words(limit);
  if (parts.length === 0) return false;
  const ws = words(text);
  const joined = parts.join('');
  for (let i = 0; i < ws.length; i++) {
    if (parts.length > 1 && wordUses(ws[i]!, joined)) return true;
    if (i + parts.length > ws.length) continue;
    const head = parts.slice(0, -1).every((p, k) => ws[i + k] === p);
    if (head && wordUses(ws[i + parts.length - 1]!, parts[parts.length - 1]!)) return true;
  }
  return false;
}

/**
 * 출력 가드. 정답 구절(forbiddenAnswers)은 띄어쓰기·문장 부호를 무시한 부분 일치로 찾고(구절 앞부분만 적어 두어도 걸리게),
 * 제한 낱말(limits)은 낱말 단위로 찾는다(usesLimitTerm).
 */
export function guardOutput(text: string, config: GuardConfig): GuardResult {
  const haystack = normalize(text);
  const forbidden = config.forbiddenAnswers.filter((phrase) => {
    const needle = normalize(phrase);
    return needle.length > 0 && haystack.includes(needle);
  });
  const limits = config.limits.filter((term) => usesLimitTerm(text, term));
  // 한자·일본 글자가 섞였거나(기본 모델의 언어 섞임) 입력의 개인정보 자리표시를 되풀이하면 막는다.
  const extra = [...(hasForeignScript(text) ? [FOREIGN_SCRIPT_HIT] : []), ...(echoesMask(text) ? [MASK_ECHO_HIT] : [])];
  const hits = [...forbidden, ...limits, ...extra];
  return { ok: hits.length === 0, hits };
}

const JOSA_PATTERN = /(\S)(을\(를\)|이\(가\)|와\(과\)|은\(는\))/g;

function fixJosa(text: string): string {
  return text.replace(JOSA_PATTERN, (_m, prev: string, pair: string, offset: number) => {
    const p = `${pair[0]}/${pair[2]}` as JosaPair;
    // 앞 글자가 ')'면 괄호 설명 앞 낱말로 판단해야 하므로 앞부분 전체를 넘긴다.
    return prev + josa(text.slice(0, offset + prev.length), p);
  });
}

/** 템플릿의 {iv}, {changed}를 라벨로 바꾸고, 괄호형 조사를 앞 낱말 받침에 맞춘다. */
export function renderProbe(
  template: string,
  vars: { iv: string; changed: string[] },
): string {
  return fixJosa(
    template.replaceAll('{iv}', vars.iv).replaceAll('{changed}', joinLabels(vars.changed)),
  );
}

/**
 * 활동 유형과 무관한 탐침 선택: when이 같은 첫 probe의 {이름}을 vars로 바꾸고 조사를 맞춘 뒤 출력 가드를 건다.
 * 맞는 probe가 없거나 가드에 걸리면 FALLBACK_PROBE.
 */
export function renderAndGuard(
  when: string,
  vars: Record<string, string>,
  probes: ProbeTemplate[],
  guard: GuardConfig,
): string {
  const probe = probes.find((p) => p.when === when);
  if (!probe) return FALLBACK_PROBE;
  if (probe.off) return TUTOR_SILENT;
  let text = probe.text;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  text = fixJosa(text);
  if (LEFTOVER_PLACEHOLDER.test(text)) return FALLBACK_PROBE;
  return guardOutput(text, guard).ok ? text : FALLBACK_PROBE;
}

export function pickProbeKey(context: ProbeContext): string {
  const a = context.lastAnalysis;
  if (!a) return 'before-run';
  if (a.kind === 'confounded') return 'confounded';
  if (a.kind === 'iv-unchanged') return 'iv-unchanged';
  if (a.kind === 'repeat') return 'repeat';
  if (a.kind === 'fair-test') {
    if (context.prediction && context.observed && context.prediction !== context.observed) {
      return 'prediction-mismatch';
    }
    return 'fair-test';
  }
  return 'first-trial';
}

export function selectProbe(
  context: ProbeContext,
  probes: ProbeTemplate[],
  guard: GuardConfig,
): string {
  const key = pickProbeKey(context);
  // 바꿀 조건을 고르지 않는 활동에서 하나만 바꾼 시행(fair-test)은 그 바뀐 조건을 조작변인으로 본다.
  const a = context.lastAnalysis;
  const ivKey = context.ivKey ?? (a?.kind === 'fair-test' && a.changed.length === 1 ? a.changed[0]! : null);
  // 같은 시점 안에서 현재 조작변인과 iv가 일치하는 probe를 먼저, 없으면 iv가 없는 probe를 고른다.
  const sameWhen = probes.filter((p) => p.when === key);
  const probe =
    (ivKey ? sameWhen.find((p) => p.iv === ivKey) : undefined) ??
    sameWhen.find((p) => p.iv === undefined);
  if (!probe) return FALLBACK_PROBE;
  if (probe.off) return TUTOR_SILENT;
  const ivLabel = ivKey ? (context.labels[ivKey] ?? ivKey) : '조건';
  const changed = (context.lastAnalysis?.changed ?? []).map((k) => context.labels[k] ?? k);
  const text = renderProbe(probe.text, { iv: ivLabel, changed });
  if (LEFTOVER_PLACEHOLDER.test(text)) return FALLBACK_PROBE;
  if (!guardOutput(text, guard).ok) return FALLBACK_PROBE;
  return text;
}

export * from './privacy';
export * from './check';
export * from './edits';
export * from './editCheck';
export * from './situationLabels';
export * from './context';
export * from './observeModel';
export * from './situation';
export * from './models';
