import { useCallback, useEffect, useRef, useState } from 'react';
import { fromVariableRuntime, tutorModel, type RuntimeStateLike, type UnitInfo, type VariableModuleLike } from '@sci/tutor';
import type { AnswerKey, VariableExperiment } from '@sci/schema';
import { TutorLlm, isTutorLlmAvailable } from './llmPlugin';
import { createModelTutor, type ModelTutor } from './modelTutor';
import { createDialogue } from './dialogueTurn';
import { useTutorModelState } from './modelState';

interface Args {
  unitId: string;
  experiment: VariableExperiment;
  /** 교사 덧씌우기를 적용한 결론 목록(applyTutorAnswers). 학생이 결론을 말했는지 앱이 알아보는 데 쓴다. */
  answers: readonly AnswerKey[];
  module: VariableModuleLike;
  runtimeState: RuntimeStateLike;
  unit: UnitInfo;
  /** 지금 보여 줄 기본 질문(selectProbe). 모델을 못 쓰거나 출력이 규칙에 걸리면 이것을 쓴다. */
  fallback: string;
  /** 튜터를 끈 상황(선생님이 이 질문을 껐다)이면 true. 모델도 돌리지 않는다. */
  silent: boolean;
  /** 이 값이 바뀌면 새 상황이다(보이는 시행 수). */
  turnKey: number;
}

export interface ModelProbe {
  /** 모델이 준비되어 있어 모델 질문 흐름을 쓴다. false면 App은 기존 기본 질문만 보인다. */
  available: boolean;
  /** 보여 줄 문장. 만드는 중이거나 아직 없으면 null. */
  text: string | null;
  loading: boolean;
  /** 시험용 상태 표시(예: "모델 질문 · 0.9초", "힌트 2단계"). 학생 말은 담지 않는다. 아직 없으면 null. */
  status: string | null;
  /** 학생이 한 말을 다음 질문 만들기에 쓴다. 기기 안 메모리에서만 쓰고 저장하지 않는다. */
  say(utterance: string): void;
}

/**
 * 변인 실험 화면의 튜터 말풍선용(사양 §4.4). 모델이 준비된 기기(안드로이드)에서만 동작한다.
 * 화면을 떠나면(언마운트) 모델을 내린다.
 */
export function useModelProbe(args: Args): ModelProbe {
  const ms = useTutorModelState();
  const model = isTutorLlmAvailable() && ms.status === 'ready' && ms.modelId && ms.file ? tutorModel(ms.modelId) : null;
  const file = model ? ms.file : null;
  const available = model !== null && file !== null;

  const latest = useRef(args);
  latest.current = args;
  const runner = useRef<ModelTutor | null>(null);
  const reqId = useRef(0);
  // 힌트 단계와 직전에 보인 글은 이 안(기기 메모리)에만 둔다. 새 상황(turnKey가 바뀜)이면 힌트 단계가 처음으로 돌아간다.
  const dialogue = useRef(createDialogue(() => runner.current));
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const modelId = model?.id ?? null;
  useEffect(() => {
    if (!modelId || !file) return;
    const r = createModelTutor({ llm: TutorLlm, model: tutorModel(modelId), file });
    runner.current = r;
    return () => {
      runner.current = null;
      reqId.current++; // 늦게 오는 결과는 버린다.
      void r.dispose();
    };
  }, [modelId, file]);

  const request = useCallback((utterance?: string) => {
    if (!runner.current) return;
    const id = ++reqId.current;
    const a = latest.current;
    const shown = a.runtimeState.playing ? a.runtimeState.trials.slice(0, -1) : a.runtimeState.trials;
    setText(null);
    setStatus(null);
    setLoading(true);
    void dialogue.current
      .turn(
        {
          experiment: a.experiment,
          answers: a.answers,
          state: fromVariableRuntime(a.experiment, a.runtimeState, a.module, a.unitId),
          // 최근 3개 밖의 시행도 결과로 확인하는 근거가 된다.
          trials: shown.map((t) => ({ ivKey: t.ivKey, analysis: t.analysis })),
          unit: a.unit,
          fallback: a.fallback,
          turnKey: a.turnKey,
        },
        utterance,
        () => id === reqId.current,
      )
      .then((res) => {
        if (id !== reqId.current) return;
        setText(res?.text ?? null);
        setStatus(res?.status ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, []);

  // 새 상황(시행이 보이게 됨)이거나 모델이 준비되면 질문을 만든다.
  const { silent, turnKey } = args;
  useEffect(() => {
    if (!available || silent) return;
    request();
  }, [available, silent, turnKey, request]);

  const say = useCallback(
    (utterance: string) => {
      const u = utterance.trim().slice(0, 120);
      if (u) request(u);
    },
    [request],
  );

  return { available, text, loading, status, say };
}
