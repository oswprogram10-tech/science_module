import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from '@sci/runtime';
import { parseManifest, type AnswerKey, type VariableExperiment } from '@sci/schema';
import { ALTERNATE_QUESTIONS, PREFIX_OTHER, fromVariableRuntime, hasJudgment, tutorModel } from '@sci/tutor';
import gasesJson from '../../../../content/units/g4-gases/manifest.json';
import { MODULES } from '../modules';
import { createModelTutor, type ModelTutorLlm } from './modelTutor';
import { createDialogue, reasonLabel, type TurnArgs } from './dialogueTurn';

const gases = parseManifest(gasesJson);
const exp = gases.experiments[0] as VariableExperiment;
const unit = { title: gases.title, grade: gases.grade };
const mod = MODULES['gas-syringe'];
const rt = createRuntime({ defaults: Object.fromEntries(exp.variables.map((v) => [v.key, v.default])) });
const ivKey = exp.variables[0]!.key;
const ivLabel = exp.variables[0]!.label;
const baseState = fromVariableRuntime(exp, rt.getSnapshot(), mod, gases.id);
const withFair = {
  ...baseState,
  current: { ...baseState.current, ivKey },
  trials: [{ index: 1, values: {}, ivKey, prediction: null, result: {}, analysis: { kind: 'fair-test' as const, changed: [ivKey] }, observed: null }],
};

const ANSWER: AnswerKey = { iv: ivKey, conclusion: '시험용 결론.', keys: [['빨']], not: ['느려'], confirm: '네, 결과표에서도 그랬어요.' };
const FALLBACK = '기본 질문이에요. 무엇을 바꿨나요?';
const GOOD = '이번에는 어떤 조건을 바꿔 보았나요?';

function fakeLlm(texts: string[]) {
  let i = 0;
  const generate = vi.fn<ModelTutorLlm['generate']>(async () => ({ text: texts[Math.min(i++, texts.length - 1)]!, firstTokenMs: 900, tokensPerSec: 9, tokens: 12 }));
  const llm: ModelTutorLlm = {
    load: vi.fn(async () => ({ ok: true, loadMs: 1 })),
    generate,
    unload: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  };
  return { llm, generate };
}
const setup = (texts: string[]) => {
  const f = fakeLlm(texts);
  const tutor = createModelTutor({ llm: f.llm, model: tutorModel('qwen3-1.7b'), file: 'a.gguf', nThreads: 2 });
  return { ...f, dialogue: createDialogue(() => tutor) };
};
const args = (over: Partial<TurnArgs> = {}): TurnArgs => ({
  experiment: exp,
  answers: [ANSWER],
  state: baseState,
  trials: [],
  unit,
  fallback: FALLBACK,
  turnKey: 0,
  ...over,
});
const yes = () => true;

describe('dialogueTurn', () => {
  it('새 상황은 모델 질문이고 상태 표시에 시간이 들어간다', async () => {
    const s = setup([GOOD]);
    expect(await s.dialogue.turn(args(), undefined, yes)).toEqual({ text: GOOD, status: '모델 질문 · 0.9초', plan: 'model' });
  });

  it('모르겠다고 하면 모델을 부르지 않고 힌트 1~3단계, 그다음 손가락. turnKey가 바뀌면 처음부터', async () => {
    const s = setup([GOOD]);
    const a = args();
    const out: string[] = [];
    for (let i = 0; i < 5; i++) out.push((await s.dialogue.turn(a, '모르겠어요', yes))!.status);
    expect(out).toEqual(['힌트 1단계', '힌트 2단계', '힌트 3단계', '힌트 마지막 단계', '힌트 마지막 단계']);
    expect(s.generate).not.toHaveBeenCalled();
    const next = await s.dialogue.turn(args({ turnKey: 1 }), '몰라요', yes);
    expect(next?.status).toBe('힌트 1단계');
    expect(next?.text).toContain('괜찮아요');
  });

  it('같은 turnKey에서는 다른 말을 하고 와도 힌트 단계가 이어진다', async () => {
    const s = setup([GOOD, '결과표에서 무엇이 달라졌는지 말해 볼까요?']);
    await s.dialogue.turn(args(), '몰라요', yes);
    await s.dialogue.turn(args(), '재미있어요', yes);
    expect((await s.dialogue.turn(args(), '몰라요', yes))?.status).toBe('힌트 2단계');
  });

  it('결과로 확인되면 맞힘 확인(모델 없음), 아니면 예측 반응', async () => {
    const s = setup([GOOD]);
    const fair = [{ ivKey, analysis: { kind: 'fair-test', changed: [ivKey] } }];
    const confirmed = await s.dialogue.turn(args({ state: withFair, trials: fair }), '빨라요', yes);
    expect(confirmed).toMatchObject({ plan: 'confirm', status: '맞힘 확인' });
    expect(confirmed!.text.startsWith(ANSWER.confirm)).toBe(true);
    const predicted = await s.dialogue.turn(args(), '빨라요', yes);
    expect(predicted).toMatchObject({ plan: 'predict', status: '예측 반응' });
    expect(predicted!.text).toContain(ivLabel);
    expect(hasJudgment(predicted!.text)).toBe(false);
    expect(s.generate).not.toHaveBeenCalled();
  });

  it('모델이 직전과 같은 질문을 되풀이하면 반응 접두어가 붙은 기본 질문이 나오고, 그것도 직전과 같으면 대체 질문으로 바뀐다', async () => {
    const s = setup([GOOD, GOOD, '질문이 없는 말이에요.']);
    const first = await s.dialogue.turn(args(), undefined, yes);
    expect(first?.text).toBe(GOOD);
    const second = await s.dialogue.turn(args(), '재미있어요', yes);
    expect(second).toEqual({ text: `${PREFIX_OTHER}${FALLBACK}`, status: '기본 질문 · 되풀이', plan: 'model' });
    const third = await s.dialogue.turn(args(), '재미있어요', yes); // 이번에는 모델 출력이 검사에 걸린다
    expect(third?.text).toBe(`${PREFIX_OTHER}${ALTERNATE_QUESTIONS[0]}`);
  });

  it('낡은 요청의 결과는 버린다', async () => {
    const s = setup([GOOD]);
    let current = true;
    const stale = s.dialogue.turn(args(), undefined, () => current);
    current = false;
    expect(await stale).toBeNull();
  });

  it('모델이 없으면(null) 모델 계획은 null이고 힌트는 그래도 나온다', async () => {
    const d = createDialogue(() => null);
    expect(await d.turn(args(), undefined, yes)).toBeNull();
    expect((await d.turn(args(), '몰라요', yes))?.status).toBe('힌트 1단계');
  });

  it('상태 표시에는 학생 말이 들어가지 않는다', async () => {
    const s = setup([GOOD]);
    const r = await s.dialogue.turn(args(), '저는 이서연인데 재미있어요', yes);
    expect(r!.status).not.toContain('이서연');
    expect(r!.status).not.toContain('재미');
  });

  it('까닭 코드를 한국어로 바꾼다', () => {
    expect(reasonLabel('repeat')).toBe('되풀이');
    expect(reasonLabel('rejected:guard:x,no-question')).toBe('검사에 걸림');
    expect(reasonLabel('slow')).toBe('느림');
    expect(reasonLabel('zzz')).toBe('기타');
  });
});
