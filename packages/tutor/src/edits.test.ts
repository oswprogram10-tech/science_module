import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyProbeWhenSchema,
  cardSortProbeWhenSchema,
  observationProbeWhenSchema,
  parseManifest,
  PORTFOLIO_STAGES,
  probeWhenSchema,
  type CardSortExperiment,
} from '@sci/schema';
import animalJson from '../../../content/units/g3-animal/manifest.json';
import {
  FALLBACK_PROBE,
  PLACEHOLDER_DISPLAY,
  SITUATIONS_BY_KIND,
  SITUATION_LABELS,
  TUTOR_SILENT,
  activityKindOf,
  applyTutorEdits,
  checkEditedText,
  classifyWhen,
  fromDisplayText,
  observeWhen,
  pickProbeKey,
  probeEditKey,
  problemMessage,
  renderAndGuard,
  selectProbe,
  situationLabel,
  toDisplayText,
  unknownPlaceholders,
  cardSortWhen,
  type ExperimentEdits,
  type ProbeTemplate,
} from './index';

const GUARD = { forbiddenAnswers: ['높을수록 빨라'], limits: ['가속도'] };
const probes: ProbeTemplate[] = [
  { when: 'before-run', text: '{iv}을(를) 바꾸면 어떻게 될까요?' },
  { when: 'repeat', text: '같은 결과가 나왔나요?' },
  { when: 'fair-test', text: '{iv}만 바꾸었을 때 무엇이 달라졌나요?' },
  { when: 'fair-test', iv: 'heightCm', text: '높이만 바꾸었어요. 무엇이 달라졌나요?' },
];
const exp = (e: Partial<ExperimentEdits>): ExperimentEdits => ({ changed: {}, added: [], ...e });

describe('applyTutorEdits', () => {
  it('덧씌우기가 없으면 받은 질문을 그대로 돌려준다', () => {
    expect(applyTutorEdits(probes)).toBe(probes);
    expect(applyTutorEdits(probes, undefined, 't')).toBe(probes);
  });
  it('바뀐 질문은 text만 바꾸고 원본은 그대로다', () => {
    const out = applyTutorEdits(probes, exp({ changed: { '|before-run|': { text: '먼저 예측해 볼까요?' } } }));
    expect(out[0]).toEqual({ when: 'before-run', text: '먼저 예측해 볼까요?' });
    expect(out.slice(1)).toEqual(probes.slice(1));
    expect(probes[0]!.text).toBe('{iv}을(를) 바꾸면 어떻게 될까요?');
  });
  it('iv가 있는 질문은 iv까지 같은 키만 바뀐다', () => {
    const out = applyTutorEdits(probes, exp({ changed: { '|fair-test|heightCm': { text: '바뀐 것을 비교해 볼까요?' } } }));
    expect(out[2]).toEqual(probes[2]);
    expect(out[3]).toEqual({ when: 'fair-test', iv: 'heightCm', text: '바뀐 것을 비교해 볼까요?' });
  });
  it('끈 질문은 off: true를 단 채로 남는다', () => {
    const out = applyTutorEdits(probes, exp({ changed: { '|repeat|': { off: true } } }));
    expect(out[1]).toEqual({ when: 'repeat', text: '같은 결과가 나왔나요?', off: true });
    expect(out).toHaveLength(probes.length);
  });
  it('더하기는 켜진 기본 질문이 없는 (task, when, iv)에만 뒤에 붙는다', () => {
    const added = [
      { when: 'repeat', text: '이미 있는 상황' }, // 켜진 기본 질문이 있어 붙지 않는다
      { when: 'fair-test', iv: 'floor', text: '바닥만 바꾸었어요. 무엇이 달라졌나요?' }, // iv가 다른 새 상황
      { when: 'first-trial', text: '첫 결과를 어떻게 읽을까요?' },
    ];
    const out = applyTutorEdits(probes, exp({ added }));
    expect(out.slice(probes.length)).toEqual([
      { when: 'fair-test', iv: 'floor', text: '바닥만 바꾸었어요. 무엇이 달라졌나요?' },
      { when: 'first-trial', text: '첫 결과를 어떻게 읽을까요?' },
    ]);
  });
  it('끈 기본 질문 자리에도 붙지 않고 켜진 것만 막는다(끄면 off 질문이 남아 조용하다)', () => {
    const out = applyTutorEdits(probes, exp({ changed: { '|repeat|': { off: true } }, added: [{ when: 'repeat', text: '다시 한 까닭은 무엇인가요?' }] }));
    expect(out.filter((p) => p.when === 'repeat')).toHaveLength(2);
    expect(out[1]!.off).toBe(true);
  });
  it('task가 다른 added는 빼고 붙인다. 키의 task도 같아야 바뀐다', () => {
    const e = exp({
      changed: { 't1|observing|': { text: '무엇이 보이나요?' }, '|observing|': { text: '다른 칸' } },
      added: [
        { task: 't1', when: 'record-match', text: '기록이 잘 맞았나요?' },
        { task: 't2', when: 'record-match', text: '다른 과제의 질문인가요?' },
        { when: 'record-match', text: '과제 없는 질문인가요?' },
      ],
    });
    const taskProbes: ProbeTemplate[] = [{ when: 'observing', text: '관찰하는 중이에요?' }];
    const t1 = applyTutorEdits(taskProbes, e, 't1');
    expect(t1).toEqual([
      { when: 'observing', text: '무엇이 보이나요?' },
      { when: 'record-match', text: '기록이 잘 맞았나요?' },
    ]);
    expect(applyTutorEdits(taskProbes, e, 't2')).toEqual([taskProbes[0], { when: 'record-match', text: '다른 과제의 질문인가요?' }]);
    // task가 없는(활동 전체) probes에는 task가 없는 키와 added만 적용된다.
    expect(applyTutorEdits(taskProbes, e)).toEqual([{ when: 'observing', text: '다른 칸' }, { when: 'record-match', text: '과제 없는 질문인가요?' }]);
  });
  it('없는 키는 무시한다', () => {
    const out = applyTutorEdits(probes, exp({ changed: { '|nope|': { text: 'x?' }, '|before-run|heightCm': { off: true } } }));
    expect(out).toEqual(probes);
  });
  it('probeEditKey', () => {
    expect(probeEditKey(undefined, 'before-run', undefined)).toBe('|before-run|');
    expect(probeEditKey('t1', 'fair-test', 'tiltDeg')).toBe('t1|fair-test|tiltDeg');
  });
});

describe('TUTOR_SILENT와 자리표시', () => {
  it('끈 질문을 고르면 renderAndGuard와 selectProbe 모두 빈 문자열', () => {
    const off = applyTutorEdits(probes, exp({ changed: { '|repeat|': { off: true }, '|fair-test|heightCm': { off: true } } }));
    expect(TUTOR_SILENT).toBe('');
    expect(renderAndGuard('repeat', {}, off, GUARD)).toBe(TUTOR_SILENT);
    expect(selectProbe({ lastAnalysis: { kind: 'repeat', changed: [] }, ivKey: 'heightCm', labels: {} }, off, GUARD)).toBe(TUTOR_SILENT);
    // iv 전용 질문을 껐으면 그 iv의 fair-test는 조용하고, 다른 iv는 iv 없는 질문이 나온다.
    expect(selectProbe({ lastAnalysis: { kind: 'fair-test', changed: ['heightCm'] }, ivKey: 'heightCm', labels: { heightCm: '높이' } }, off, GUARD)).toBe(TUTOR_SILENT);
    expect(selectProbe({ lastAnalysis: { kind: 'fair-test', changed: ['floor'] }, ivKey: 'floor', labels: { floor: '바닥' } }, off, GUARD)).toBe('바닥만 바꾸었을 때 무엇이 달라졌나요?');
    // 질문이 아예 없는 상황은 이전처럼 FALLBACK
    expect(renderAndGuard('nope', {}, off, GUARD)).toBe(FALLBACK_PROBE);
  });
  it('edits가 없으면 문장이 이전과 같다', () => {
    expect(renderAndGuard('before-run', { iv: '높이' }, probes, GUARD)).toBe('높이을(를) 바꾸면 어떻게 될까요?'.replace('높이을(를)', '높이를'));
    expect(selectProbe({ ivKey: 'floor', labels: { floor: '바닥' } }, probes, GUARD)).toBe('바닥을 바꾸면 어떻게 될까요?');
  });
  it('바꾼 뒤에도 {이름}이 남으면 FALLBACK_PROBE', () => {
    const p: ProbeTemplate[] = [{ when: 'sorting', text: '{card}와 {mystery}는 어떻게 다른가요?' }];
    expect(renderAndGuard('sorting', { card: '개미' }, p, GUARD)).toBe(FALLBACK_PROBE);
    expect(renderAndGuard('sorting', { card: '개미', mystery: '달팽이' }, p, GUARD)).toBe('개미와 달팽이는 어떻게 다른가요?');
    expect(selectProbe({ ivKey: 'floor', labels: {} }, [{ when: 'before-run', text: '{card}를 보세요?' }], GUARD)).toBe(FALLBACK_PROBE);
  });
  it('끈 질문은 가드·자리표시 검사보다 먼저 빈 문자열이다', () => {
    expect(renderAndGuard('sorting', {}, [{ when: 'sorting', text: '{x}', off: true }], GUARD)).toBe(TUTOR_SILENT);
  });
});

describe('toDisplayText / fromDisplayText', () => {
  it('서로 역함수', () => {
    for (const k of Object.keys(PLACEHOLDER_DISPLAY)) {
      const stored = `앞 {${k}}과 뒤 {${k}} 끝?`;
      expect(fromDisplayText(toDisplayText(stored))).toBe(stored);
      expect(toDisplayText(stored)).toBe(`앞 ${PLACEHOLDER_DISPLAY[k]}과 뒤 ${PLACEHOLDER_DISPLAY[k]} 끝?`);
      expect(toDisplayText(fromDisplayText(toDisplayText(stored)))).toBe(toDisplayText(stored));
    }
    const all = '{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. {card} {criterion} {solution}?';
    expect(fromDisplayText(toDisplayText(all))).toBe(all);
    expect(toDisplayText(all)).toContain('〔바꾼 조건〕은(는)');
    expect(toDisplayText(all)).toContain('〔함께 바뀐 조건〕이(가)');
  });
  it('모든 매니페스트의 기본 질문이 왕복해도 그대로다', () => {
    for (const exp of loadExperiments()) for (const p of allProbes(exp)) expect(fromDisplayText(toDisplayText(p.text))).toBe(p.text);
  });
  it('자리표시가 없는 글은 그대로', () => {
    expect(toDisplayText('조건을 바꿔 볼까요?')).toBe('조건을 바꿔 볼까요?');
    expect(fromDisplayText('조건을 바꿔 볼까요?')).toBe('조건을 바꿔 볼까요?');
  });
});

describe('교사 검사(checkEditedText)', () => {
  const ctx = { limits: ['가속도'], tutor: { forbiddenAnswers: ['높을수록 빨라'] }, placeholders: ['iv', 'changed'] };
  it('통과', () => {
    expect(checkEditedText('출발 높이를 바꾸면 무엇이 달라질지 먼저 적어 볼까요?', ctx)).toEqual({ ok: true, messages: [] });
    expect(checkEditedText('〔바꾼 조건〕만 바꾸면 〔함께 바뀐 조건〕은(는) 어떻게 될까요?', ctx).ok).toBe(true);
  });
  it('금지 구절', () => {
    expect(checkEditedText('높이가 높을수록 빨라질까요?', ctx).messages).toEqual(['정답이나 학년에 맞지 않는 말이 들어 있어요: ‘높을수록 빨라’']);
    expect(checkEditedText('가속도가 커졌나요?', ctx).messages).toEqual(['정답이나 학년에 맞지 않는 말이 들어 있어요: ‘가속도’']);
  });
  it('길이·물음표·판정·개인정보', () => {
    expect(checkEditedText('하나요? 둘이요? 셋이요?', ctx).messages).toEqual(['120자, 두 문장 안으로 줄여 주세요']);
    expect(checkEditedText('높이를 바꿔 보세요.', ctx).messages).toEqual(['물음표로 끝나는 질문이 있어야 해요']);
    expect(checkEditedText('정답이 무엇일까요?', ctx).messages).toEqual(['맞다·틀리다는 판정 말은 쓰지 않아요']);
    expect(checkEditedText('010-1234-5678로 알려 줄래요?', ctx).messages).toEqual(['전화번호·이메일은 넣을 수 없어요']);
    expect(checkEditedText('a@b.kr 로 보낼까요?', ctx).messages).toEqual(['전화번호·이메일은 넣을 수 없어요']);
    expect(checkEditedText('  ', ctx)).toEqual({ ok: false, messages: ['질문을 입력해 주세요'] });
  });
  it('이 활동에 없는 자리표시와 모르는 칸', () => {
    expect(checkEditedText('〔카드 이름〕은 무엇이 다른가요?', ctx).messages).toEqual(['쓸 수 없는 칸이에요: 〔카드 이름〕']);
    expect(checkEditedText('〔엉뚱〕은 무엇이 다른가요?', ctx).messages).toEqual(['쓸 수 없는 칸이에요: 〔엉뚱〕']);
    expect(checkEditedText('{iv}은 무엇이 다른가요?', ctx).messages).toEqual(['쓸 수 없는 칸이에요: {iv}']);
    expect(unknownPlaceholders('〔기준〕 〔기준〕 〔바꾼 조건〕', ['iv'])).toEqual(['〔기준〕']);
  });
  it('자리표시는 예시 말로 바꿔 검사한다(자리표시 때문에 길이·금지 구절이 달라지지 않는다)', () => {
    expect(checkEditedText('〔바꾼 조건〕을(를) 바꾸면 어떻게 될까요?', { ...ctx, tutor: { forbiddenAnswers: ['조건을'] } }).ok).toBe(false);
  });
  it('problemMessage', () => {
    expect(problemMessage('guard:가속도')).toBe('정답이나 학년에 맞지 않는 말이 들어 있어요: ‘가속도’');
  });
  it('모든 매니페스트의 기본 질문은 금지 구절·자리표시 검사를 통과한다(길이·물음표 규칙은 기본 질문에 적용하지 않는다)', () => {
    const failures: string[] = [];
    for (const { exp, ctx: c } of loadExperiments().map((e) => ({ exp: e, ctx: contextOf(e) }))) {
      for (const p of allProbes(exp)) {
        const r = checkEditedText(toDisplayText(p.text), c);
        const hard = r.messages.filter((m) => m !== problemMessage('too-long') && m !== problemMessage('no-question'));
        if (hard.length > 0) failures.push(`${exp.id}: ${p.text} -> ${hard.join(' / ')}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('상황 이름과 SITUATIONS_BY_KIND', () => {
  it('매니페스트에 쓰인 모든 when에 한국어 이름이 있다', () => {
    const missing = new Set<string>();
    for (const exp of loadExperiments()) for (const p of allProbes(exp)) if (!SITUATION_LABELS[p.when]) missing.add(p.when);
    expect([...missing]).toEqual([]);
  });
  it('situationLabel', () => {
    expect(situationLabel('before-run')).toBe('실행 전(예측할 때)');
    expect(situationLabel('fair-test')).toBe('한 조건만 바꿨을 때');
    expect(situationLabel('fair-test', { ivLabel: '출발 높이' })).toBe('‘출발 높이’만 바꿨을 때');
    expect(situationLabel('record-match', { taskTitle: '해의 길' })).toBe('[해의 길] 기록이 관찰과 맞을 때');
    expect(situationLabel('zzz')).toBe('zzz');
  });
  it('스키마의 when 목록과 같다', () => {
    const sorted = (a: readonly string[]) => [...a].sort();
    expect(sorted(SITUATIONS_BY_KIND.variable)).toEqual(sorted(probeWhenSchema.options));
    expect(sorted(SITUATIONS_BY_KIND.classify)).toEqual(sorted(classifyProbeWhenSchema.options));
    expect(sorted(SITUATIONS_BY_KIND.observation)).toEqual(sorted(observationProbeWhenSchema.options));
    expect(sorted(SITUATIONS_BY_KIND.portfolio)).toEqual(sorted(PORTFOLIO_STAGES));
    const cardSort = new Set([...SITUATIONS_BY_KIND.groups, ...SITUATIONS_BY_KIND.tree, ...SITUATIONS_BY_KIND.order]);
    expect(sorted([...cardSort])).toEqual(sorted(cardSortProbeWhenSchema.options));
  });
  it('모듈의 situation 함수가 돌려주는 값과 같다', () => {
    const sorted = (a: Iterable<string>) => [...a].sort();
    // 변인 실험: pickProbeKey
    const variable = new Set<string>();
    variable.add(pickProbeKey({ labels: {} }));
    for (const kind of ['first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test'] as const) {
      variable.add(pickProbeKey({ lastAnalysis: { kind, changed: [] }, labels: {} }));
      variable.add(pickProbeKey({ lastAnalysis: { kind, changed: [] }, labels: {}, prediction: 'increase', observed: 'decrease' }));
    }
    expect(sorted(variable)).toEqual(sorted(SITUATIONS_BY_KIND.variable));
    // 분류
    const classify = new Set<string>();
    const cexp = { indicators: [], solutions: [] } as never;
    for (const selected of [null, 's']) for (const tested of [[], ['i']]) for (const checkKind of [null, 'check-untested', 'check-inconsistent', 'check-complete'] as const) for (const predictions of [{}, { s: 'acid' }]) {
      try {
        classify.add(classifyWhen(cexp, { selected, predictions, tested, checkKind: checkKind as never }));
      } catch {
        /* 근거 계산이 필요한 조합은 아래에서 따로 */
      }
    }
    classify.add('prediction-mismatch'); // evidenceGroup이 필요한 규칙은 classifyStore 테스트가 다룬다
    expect(sorted(classify)).toEqual(sorted(SITUATIONS_BY_KIND.classify));
    // 관찰
    const observe = new Set<string>();
    for (const prediction of [null, 'a']) for (const recorded of [null, 'a', 'b']) for (const matchesModel of [null, true, false]) observe.add(observeWhen({ prediction, recorded, matchesModel }));
    expect(sorted(observe)).toEqual(sorted(SITUATIONS_BY_KIND.observation));
    // 카드 분류: 무리·트리·순서
    const cs = parseManifest(animalJson).experiments[0] as CardSortExperiment;
    const checks = [null, 'check-unplaced', 'check-unobserved', 'check-inconsistent', 'check-complete', 'check-subjective'];
    const groups = new Set<string>();
    const tree = new Set<string>();
    for (const criterion of [null, cs.criteria.find((c) => c.feature)!.key, cs.criteria.find((c) => !c.feature)!.key]) for (const selected of [null, 'c']) for (const observed of [[], cs.criteria.find((c) => c.feature)!.feature!]) for (const checkKind of checks) for (const finished of [false, true]) {
      const s = { criterion, selected, observed: Array.isArray(observed) ? observed : [observed], checkKind, finished };
      groups.add(cardSortWhen(cs, s));
      for (const treeSplitEmpty of [false, true]) tree.add(cardSortWhen(cs, { ...s, tree: true, treeSplitEmpty }));
    }
    expect(sorted(groups)).toEqual(sorted(SITUATIONS_BY_KIND.groups));
    expect(sorted(tree)).toEqual(sorted(SITUATIONS_BY_KIND.tree));
    const order = new Set<string>();
    const kinds = [null, 'check-unplaced', 'check-unobserved', 'check-inconsistent', 'check-complete'];
    for (const selected of [null, 'c']) for (const observed of [[], ['height']]) for (const orderCheck of kinds) for (const followUpCheck of [null, 'check-unplaced', 'check-unobserved', 'check-inconsistent']) for (const finished of [false, true]) {
      order.add(cardSortWhen(cs, { criterion: null, selected, observed, checkKind: null, finished, order: { orderCheck, followUpCheck, feature: 'height' } }));
    }
    expect(sorted(order)).toEqual(sorted(SITUATIONS_BY_KIND.order));
  });
  it('매니페스트의 질문은 모두 그 활동 종류의 상황 목록 안에 있다', () => {
    const bad: string[] = [];
    for (const exp of loadExperiments()) {
      const kind = activityKindOf(exp as { module: string; layout?: string });
      for (const p of allProbes(exp)) {
        if (kind === 'tree' && p.when === 'check-complete') continue; // 트리에서는 일어나지 않는 질문(위 주석)
        if (!SITUATIONS_BY_KIND[kind].includes(p.when)) bad.push(`${exp.id}(${kind}): ${p.when}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('activityKindOf', () => {
    expect(activityKindOf({ module: 'ramp-cart' })).toBe('variable');
    expect(activityKindOf({ module: 'card-sort', layout: 'tree' })).toBe('tree');
    expect(activityKindOf({ module: 'card-sort', layout: 'order' })).toBe('order');
    expect(activityKindOf({ module: 'card-sort', layout: 'groups' })).toBe('groups');
    expect(activityKindOf({ module: 'indicator-classify' })).toBe('classify');
    expect(activityKindOf({ module: 'sky-observation' })).toBe('observation');
    expect(activityKindOf({ module: 'career-portfolio' })).toBe('portfolio');
  });
});

// ---- 도우미: 매니페스트 읽기 ----
type AnyExp = { id: string; module: string; layout?: string; limits: string[]; tutor: { forbiddenAnswers: string[]; probes: unknown[] }; tasks?: { id: string; probes: ProbeTemplate[] }[] };
function loadExperiments(): AnyExp[] {
  const dir = join(__dirname, '../../../content/units');
  return readdirSync(dir).flatMap((u) => (JSON.parse(readFileSync(join(dir, u, 'manifest.json'), 'utf8')) as { experiments: AnyExp[] }).experiments);
}
function allProbes(exp: AnyExp): ProbeTemplate[] {
  return exp.tasks ? exp.tasks.flatMap((t) => t.probes) : (exp.tutor.probes as ProbeTemplate[]);
}
function contextOf(exp: AnyExp) {
  const text = allProbes(exp).map((p) => p.text).join(' ');
  return { limits: exp.limits, tutor: { forbiddenAnswers: exp.tutor.forbiddenAnswers }, placeholders: Object.keys(PLACEHOLDER_DISPLAY).filter((k) => text.includes(`{${k}}`)) };
}
