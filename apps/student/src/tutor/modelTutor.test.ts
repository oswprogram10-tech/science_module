import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime } from '@sci/runtime';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import {
  CHAT_STOP,
  TUTOR_MODELS,
  TUTOR_SYSTEM,
  buildTutorInput,
  formatChat,
  fromVariableRuntime,
  tutorModel,
  type TutorModelInfo,
} from '@sci/tutor';
import gasesJson from '../../../../content/units/g4-gases/manifest.json';
import { MODULES } from '../modules';
import { createModelTutor, type AskInput, type ModelTutorLlm } from './modelTutor';

const gases = parseManifest(gasesJson);
const exp = gases.experiments[0] as VariableExperiment;
const unit = { title: gases.title, grade: gases.grade };
const mod = MODULES['gas-syringe'];

const rt = createRuntime({ defaults: Object.fromEntries(exp.variables.map((v) => [v.key, v.default])) });
const state = fromVariableRuntime(exp, rt.getSnapshot(), mod, gases.id);
const FALLBACK = '기본 질문이에요. 무엇을 바꿨나요?';
const GOOD = '이번에는 어떤 조건을 바꿔 보았나요?';

const base = (over: Partial<AskInput> = {}): AskInput => ({ experiment: exp, state, unit, fallback: FALLBACK, ...over });
const model = tutorModel('qwen3-1.7b');

function fakeLlm(text: string | (() => Promise<never> | string), extra: { firstTokenMs?: number } = {}) {
  const load = vi.fn<ModelTutorLlm['load']>(async () => ({ ok: true, loadMs: 5 }));
  const generate = vi.fn<ModelTutorLlm['generate']>(async () => ({
    text: typeof text === 'function' ? await text() : text,
    firstTokenMs: extra.firstTokenMs ?? 400,
    tokensPerSec: 9,
    tokens: 12,
  }));
  const unload = vi.fn<ModelTutorLlm['unload']>(async () => undefined);
  const abort = vi.fn<ModelTutorLlm['abort']>(async () => undefined);
  return { llm: { load, generate, unload, abort } satisfies ModelTutorLlm, load, generate, unload, abort };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('modelTutor: 모델 질문 만들기', () => {
  it('좋은 출력은 그대로 쓰고, 대화 형식·멈춤 문자열·최대 토큰을 plugin에 넘긴다', async () => {
    const f = fakeLlm(GOOD);
    const t = createModelTutor({ llm: f.llm, model, file: 'qwen3-1.7b.gguf', nThreads: 3 });
    const r = await t.ask(base({ utterance: '밝아졌어요' }));
    expect(r).toMatchObject({ source: 'model', text: GOOD });
    expect(f.load).toHaveBeenCalledWith({ file: 'qwen3-1.7b.gguf', nCtx: 2048, nThreads: 3 });
    const arg = f.generate.mock.calls[0]![0];
    expect(arg.maxTokens).toBe(96);
    expect(arg.stop).toEqual([...CHAT_STOP]);
    expect(arg.suppressTokenIds).toEqual([]);
    expect(arg.prompt).toBe(formatChat('qwen3-nothink', TUTOR_SYSTEM, buildTutorInput(exp, state, '밝아졌어요', unit)));
  });

  it('모델이 올라가는 것은 한 번뿐이다(여러 요청이 겹쳐도)', async () => {
    const f = fakeLlm(GOOD);
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    await Promise.all([t.ask(base()), t.ask(base()), t.ask(base())]);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.generate).toHaveBeenCalledTimes(3);
  });

  it('previousTutor와 학생 말을 입력에 넣는다(개인정보는 가린다)', async () => {
    const f = fakeLlm(GOOD);
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    await t.ask(base({ previousTutor: '무엇을 바꿨나요?', utterance: '저는 이서연이에요 밝아졌어요' }));
    const prompt = f.generate.mock.calls[0]![0].prompt;
    expect(prompt).toContain('\n[튜터가 방금 한 질문] 무엇을 바꿨나요?\n');
    expect(prompt).toContain('[이름]');
    expect(prompt).not.toContain('이서연');
    // 첫 차례(previousTutor 없음)에는 그 줄이 없다.
    await t.ask(base());
    expect(f.generate.mock.calls[1]![0].prompt).not.toMatch(/\n\[튜터가 방금 한 질문\]/); // (시스템 문장 6번에도 이 말이 나오므로 줄 머리로 본다)
  });

  it('4B 모델은 생각 블록 없는 ChatML을 쓴다', async () => {
    const f = fakeLlm(GOOD);
    const t = createModelTutor({ llm: f.llm, model: tutorModel('qwen3-4b'), file: 'b.gguf', nThreads: 2 });
    await t.ask(base());
    const p = f.generate.mock.calls[0]![0].prompt;
    expect(p.endsWith('<|im_start|>assistant\n')).toBe(true);
    expect(p).not.toContain('<think>');
  });

  it('규칙에 걸린 출력(질문 아님, 정답 말함, 영어 섞임)은 기본 질문으로 대체한다', async () => {
    const bad = ['이 실험은 부피가 줄어드는 것이 정답입니다.', 'Why did you change the pressure?', ''];
    for (const text of bad) {
      const f = fakeLlm(text);
      const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
      const r = await t.ask(base());
      expect(r, text).toMatchObject({ source: 'fallback', text: FALLBACK });
      expect((r as { reason: string }).reason).toMatch(/^rejected:/);
    }
  });

  it('첫 토큰이 예산(3초)보다 늦으면 그 결과를 쓰지 않는다', async () => {
    const f = fakeLlm(GOOD, { firstTokenMs: 3500 });
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    expect(await t.ask(base())).toMatchObject({ source: 'fallback', reason: 'slow', text: FALLBACK });
  });

  it('생성이 끝나지 않으면 시간 초과로 기본 질문을 쓰고 모델을 내린다', async () => {
    vi.useFakeTimers();
    const f = fakeLlm(() => new Promise<never>(() => undefined));
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2, hardTimeoutMs: 5000 });
    const p = t.ask(base());
    await vi.advanceTimersByTimeAsync(5001);
    expect(await p).toMatchObject({ source: 'fallback', reason: 'timeout', text: FALLBACK });
    expect(f.unload).toHaveBeenCalledTimes(1);
  });

  it('모델 올리기에 실패하면 기본 질문이고 다시 시도하지 않는다', async () => {
    const f = fakeLlm(GOOD);
    f.load.mockRejectedValue(new Error('no memory'));
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    expect(await t.ask(base())).toMatchObject({ source: 'fallback', reason: 'load-failed' });
    expect(await t.ask(base())).toMatchObject({ source: 'fallback', reason: 'load-failed' });
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.generate).not.toHaveBeenCalled();
  });

  it('generate가 던져도 기본 질문이다', async () => {
    const f = fakeLlm(GOOD);
    f.generate.mockRejectedValue(new Error('boom'));
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    expect(await t.ask(base())).toMatchObject({ source: 'fallback', reason: 'error', text: FALLBACK });
  });

  it('낡은 요청(새 요청이 들어옴)은 모델을 돌리지 않는다', async () => {
    const f = fakeLlm(GOOD);
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    expect(await t.ask(base({ isCurrent: () => false }))).toMatchObject({ source: 'fallback', reason: 'stale' });
    expect(f.generate).not.toHaveBeenCalled();
  });

  it('생성 중인 요청이 새 요청에 밀려 낡아지면 abort를 부르고, 낡은 결과는 쓰지 않는다', async () => {
    let current = 1;
    let release!: () => void;
    const f = fakeLlm(GOOD);
    f.generate.mockImplementationOnce(() => new Promise((r) => (release = () => r({ text: GOOD, firstTokenMs: 400, tokensPerSec: 9, tokens: 12 }))));
    const t = createModelTutor({ llm: f.llm, model, file: 'qwen3-1.7b.gguf' });
    const first = t.ask(base({ isCurrent: () => current === 1 }));
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledTimes(1));
    current = 2; // 새 요청이 첫 요청을 대체했다
    const second = t.ask(base({ isCurrent: () => current === 2 }));
    expect(f.abort).toHaveBeenCalledTimes(1);
    release();
    expect(await first).toEqual({ source: 'fallback', text: FALLBACK, reason: 'stale' });
    expect((await second).source).toBe('model');
  });

  it('줄 서 있던 낡은 요청은 generate를 부르지 않고, 끝난 생성에는 abort를 부르지 않는다', async () => {
    let current = 1;
    let release!: () => void;
    const f = fakeLlm(GOOD);
    f.generate.mockImplementationOnce(() => new Promise((r) => (release = () => r({ text: GOOD, firstTokenMs: 400, tokensPerSec: 9, tokens: 12 }))));
    const t = createModelTutor({ llm: f.llm, model, file: 'qwen3-1.7b.gguf' });
    const a = t.ask(base({ isCurrent: () => current === 1 }));
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledTimes(1));
    const b = t.ask(base({ isCurrent: () => current <= 2 })); // 줄에서 기다리는 중
    current = 3; // 그 사이 더 새 요청이 와서 a·b 모두 낡았다
    const c = t.ask(base({ isCurrent: () => current === 3 }));
    expect(f.abort).toHaveBeenCalledTimes(1);
    release();
    expect((await a).source).toBe('fallback');
    expect(await b).toEqual({ source: 'fallback', text: FALLBACK, reason: 'stale' });
    expect((await c).source).toBe('model');
    expect(f.generate).toHaveBeenCalledTimes(2); // a와 c만
    // 끝난 뒤의 새 요청은 abort하지 않는다.
    await t.ask(base());
    expect(f.abort).toHaveBeenCalledTimes(1);
  });

  it('학습한 입력 형식 버전이 다른 모델은 쓰지 않는다', async () => {
    const f = fakeLlm(GOOD);
    const old: TutorModelInfo = { ...model, promptVersion: 'v2' };
    const t = createModelTutor({ llm: f.llm, model: old, file: 'a.gguf', nThreads: 2 });
    expect(await t.ask(base())).toMatchObject({ source: 'fallback', reason: 'prompt-version' });
    expect(f.load).not.toHaveBeenCalled();
  });

  it('dispose는 모델을 내리고 그 뒤 요청은 기본 질문이다', async () => {
    const f = fakeLlm(GOOD);
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    await t.ask(base());
    await t.dispose();
    expect(f.unload).toHaveBeenCalledTimes(1);
    expect(await t.ask(base())).toMatchObject({ source: 'fallback', reason: 'disposed' });
  });

  it('네트워크를 쓰지 않는다(fetch, XMLHttpRequest, WebSocket 호출 없음)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', fetchSpy);
    vi.stubGlobal('WebSocket', fetchSpy);
    const f = fakeLlm(GOOD);
    const t = createModelTutor({ llm: f.llm, model, file: 'a.gguf', nThreads: 2 });
    await t.ask(base({ utterance: '안녕' }));
    await t.dispose();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('모든 모델 정보가 이 실행기의 대화 형식을 지원한다', () => {
    for (const m of TUTOR_MODELS) expect(['qwen3-nothink', 'chatml']).toContain(m.chatFormat);
  });
});
