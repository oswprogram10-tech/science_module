import type { ProbeTemplate } from './index';

/**
 * 한 활동의 튜터 질문 덧씌우기. 모양은 `@sci/classroom`의 `ExperimentEdits`(zod)와 같다
 * (이 패키지는 수업 연결 패키지에 기대지 않으므로 구조만 맞춘다).
 */
export interface ExperimentEdits {
  changed: Record<string, { text?: string; off?: true }>;
  added: { task?: string; when: string; iv?: string; text: string }[];
}

/** 질문 하나를 구별하는 키: `${task ?? ''}|${when}|${iv ?? ''}`. */
export const probeEditKey = (task: string | undefined, when: string, iv: string | undefined): string => `${task ?? ''}|${when}|${iv ?? ''}`;

/**
 * 매니페스트의 질문(probes)에 선생님의 덧씌우기를 적용한다. 매니페스트는 바꾸지 않는다.
 * - 바뀐 질문은 text를 바꾼다.
 * - 꺼진 질문은 `off: true`를 단 채로 남긴다(고르면 TUTOR_SILENT).
 * - added 가운데 같은 (task, when, iv)에 켜진 기본 질문이 없는 것만, 이 task의 것만 뒤에 붙인다.
 * - 없는 키는 무시한다. 덧씌우기가 없으면 받은 배열을 그대로 돌려준다.
 * task는 관찰 활동의 과제 id(과제의 probes를 넘길 때). 활동 전체의 probes에는 비운다.
 */
export function applyTutorEdits(probes: ProbeTemplate[], exp?: ExperimentEdits, task?: string): ProbeTemplate[] {
  if (!exp) return probes;
  const out = probes.map((p): ProbeTemplate => {
    const e = exp.changed[probeEditKey(task, p.when, p.iv)];
    if (!e) return p;
    const next: ProbeTemplate = { ...p };
    if (e.text !== undefined) next.text = e.text;
    if (e.off) next.off = true;
    return next;
  });
  for (const a of exp.added) {
    if ((a.task ?? '') !== (task ?? '')) continue;
    if (out.some((p) => !p.off && p.when === a.when && (p.iv ?? '') === (a.iv ?? ''))) continue;
    out.push({ when: a.when, ...(a.iv !== undefined ? { iv: a.iv } : {}), text: a.text });
  }
  return out;
}
