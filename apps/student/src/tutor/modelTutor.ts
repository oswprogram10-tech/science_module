import {
  CHAT_STOP,
  PROMPT_VERSION,
  TUTOR_SYSTEM,
  buildTutorInput,
  finalizeModelOutput,
  formatChat,
  type TutorModelInfo,
  type TutorState,
  type UnitInfo,
} from '@sci/tutor';
import type { VariableExperiment } from '@sci/schema';
import type { TutorLlmPlugin } from './llmPlugin';

/**
 * 기기 안 튜터 모델로 질문 한 문장을 만드는 실행기(사양 docs/specs/tutor-on-device-v1.md §4.4).
 * buildTutorInput → 대화 형식 → generate → finalizeModelOutput. 어느 단계든 실패하면 기본 질문(fallback)을 돌려 준다.
 * 학생 말·튜터 입력·출력은 이 안(기기)에서만 쓰고 저장하거나 어디로도 보내지 않는다(로그도 남기지 않는다).
 * 이 파일은 네트워크를 쓰지 않는다. 모델 파일 내려받기는 modelSync(3b)가 한다.
 */

export type ModelTutorLlm = Pick<TutorLlmPlugin, 'load' | 'generate' | 'unload'>;

export interface ModelTutorOptions {
  llm: ModelTutorLlm;
  model: TutorModelInfo;
  /** 앱 전용 저장소의 모델 파일 이름(tutorModelState.file). */
  file: string;
  /** 생성 금지 토큰(한자·일본 글자). 모델 정보에 아직 경로가 없으면 비운다. */
  suppressTokenIds?: number[];
  nCtx?: number;
  nThreads?: number;
  maxTokens?: number;
  /** 첫 토큰까지 걸린 시간이 이보다 길면(느린 기기) 그 결과를 쓰지 않고 기본 질문을 쓴다. 기본 3000ms. */
  firstTokenBudgetMs?: number;
  /** 생성 전체의 상한. 넘으면 생성을 멈추고(모델을 내림) 기본 질문을 쓴다. 기본 20000ms. */
  hardTimeoutMs?: number;
}

export interface AskInput {
  experiment: VariableExperiment;
  state: TutorState;
  /** 학생이 방금 한 말. 모델 입력에 넣기 전에 개인정보를 가린다(buildTutorInput). */
  utterance?: string;
  unit: UnitInfo;
  /** 직전에 학생에게 보여 준 튜터 문장. 첫 차례면 비운다. */
  previousTutor?: string;
  /** 모델을 못 쓰거나 출력이 규칙에 걸릴 때 보일 기본 질문(selectProbe 결과). */
  fallback: string;
  /** 그동안 새 요청이 들어와 이 요청이 낡았으면 false를 돌려 준다. 낡은 요청은 모델을 돌리지 않는다. */
  isCurrent?: () => boolean;
}

export type AskResult =
  | { source: 'model'; text: string; firstTokenMs: number; tokensPerSec: number }
  | { source: 'fallback'; text: string; reason: string };

export interface ModelTutor {
  ask(input: AskInput): Promise<AskResult>;
  /** 모델을 내린다(실험 화면을 떠날 때). 진행 중인 생성은 멈춘다. */
  dispose(): Promise<void>;
}

const defaultThreads = (): number => {
  const hc = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency ?? 4;
  return Math.min(4, Math.max(2, hc - 2));
};

export function createModelTutor(opts: ModelTutorOptions): ModelTutor {
  const { llm, model, file } = opts;
  const maxTokens = opts.maxTokens ?? 96;
  const budgetMs = opts.firstTokenBudgetMs ?? 3000;
  const hardMs = opts.hardTimeoutMs ?? 20000;

  let loaded: Promise<boolean> | null = null; // 한 번만 올린다(동시에 여러 번 불러도 하나).
  let loadFailed = false;
  let disposed = false;
  // 네이티브는 한 번에 하나만 생성하므로 요청을 줄 세운다.
  let chain: Promise<unknown> = Promise.resolve();

  const ensureLoaded = (): Promise<boolean> => {
    if (!loaded) {
      loaded = llm
        .load({ file, nCtx: opts.nCtx ?? 2048, nThreads: opts.nThreads ?? defaultThreads() })
        .then((r) => {
          if (!r.ok) loadFailed = true;
          return r.ok;
        })
        .catch(() => {
          loadFailed = true;
          return false;
        });
    }
    return loaded;
  };

  const run = async (input: AskInput): Promise<AskResult> => {
    const fb = (reason: string): AskResult => ({ source: 'fallback', text: input.fallback, reason });
    if (disposed) return fb('disposed');
    if (model.promptVersion !== PROMPT_VERSION) return fb('prompt-version');
    if (loadFailed) return fb('load-failed');
    if (input.isCurrent && !input.isCurrent()) return fb('stale');

    const user = buildTutorInput(input.experiment, input.state, input.utterance, input.unit, input.previousTutor);
    const prompt = formatChat(model.chatFormat, TUTOR_SYSTEM, user);

    if (!(await ensureLoaded())) return fb('load-failed');
    if (disposed) return fb('disposed');
    if (input.isCurrent && !input.isCurrent()) return fb('stale');

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), hardMs);
      });
      const out = await Promise.race([
        llm.generate({ prompt, maxTokens, stop: [...CHAT_STOP], suppressTokenIds: opts.suppressTokenIds ?? [] }),
        timeout,
      ]);
      if (out === 'timeout') {
        // 멈추지 않는 생성은 모델을 내려 끊고, 다음 요청 때 다시 올린다.
        loaded = null;
        void llm.unload().catch(() => undefined);
        return fb('timeout');
      }
      if (out.firstTokenMs > budgetMs) return fb('slow');
      const fin = finalizeModelOutput(out.text, {
        limits: input.experiment.limits,
        tutor: { forbiddenAnswers: input.experiment.tutor.forbiddenAnswers },
      });
      if (!fin.ok) return fb(`rejected:${fin.problems.join(',')}`);
      return { source: 'model', text: fin.text, firstTokenMs: out.firstTokenMs, tokensPerSec: out.tokensPerSec };
    } catch {
      return fb('error');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };

  return {
    ask(input) {
      const p = chain.then(() => run(input));
      chain = p.catch(() => undefined);
      return p;
    },
    async dispose() {
      disposed = true;
      loaded = null;
      await llm.unload().catch(() => undefined);
    },
  };
}
