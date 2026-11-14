import { planTurn, type EvidenceTrial, type TurnPlan, type TutorState, type UnitInfo } from '@sci/tutor';
import type { AnswerKey, VariableExperiment } from '@sci/schema';
import type { ModelTutor } from './modelTutor';

/**
 * 튜터 대화 한 차례(사양 docs/specs/tutor-dialogue-v1.md): 학생 말에 반응할 계획을 정하고(planTurn),
 * 모델이 필요한 계획이면 modelTutor에 묻는다. 힌트 단계(hintLevel)와 직전에 보인 글(lastShown)은 이 안(기기 메모리)에만 둔다.
 * 확인·예측·다시 보기·힌트 계획은 모델을 부르지 않는다. 저장하거나 어디로도 보내지 않는다.
 */

/** 한 차례에 필요한 입력(App이 지금 상황에서 모은다). */
export interface TurnArgs {
  experiment: VariableExperiment;
  /** 교사 덧씌우기를 적용한 결론 목록. */
  answers: readonly AnswerKey[];
  state: Extract<TutorState, { kind: 'variable' }>;
  /** 시행 기록 전체(결과로 확인되었는지 볼 때 쓴다). */
  trials: readonly EvidenceTrial[];
  unit: UnitInfo;
  /** 기본 질문(selectProbe 결과). */
  fallback: string;
  /** 이 값이 바뀌면 새 상황이다. 힌트 단계를 0으로 돌린다. */
  turnKey: number;
}

export interface ShownTurn {
  text: string;
  /** 시험용 상태 표시(VITE_TUTOR_DEBUG=1일 때만 화면에 보인다). 학생 말은 담지 않는다. */
  status: string;
  plan: TurnPlan['kind'];
}

/** 모델이 만들지 못해 기본 글을 쓴 까닭(AskResult.reason)을 시험용 표시의 한국어로. */
export function reasonLabel(reason: string): string {
  if (reason.startsWith('rejected:')) return '검사에 걸림';
  switch (reason) {
    case 'repeat':
      return '되풀이';
    case 'slow':
      return '느림';
    case 'timeout':
      return '시간 초과';
    case 'load-failed':
      return '모델 못 올림';
    case 'prompt-version':
      return '입력 형식 다름';
    case 'stale':
      return '낡은 요청';
    case 'disposed':
      return '모델 내림';
    case 'error':
      return '오류';
    default:
      return '기타';
  }
}

export function statusOfPlan(plan: Exclude<TurnPlan, { kind: 'model' }>): string {
  switch (plan.kind) {
    case 'hint':
      return plan.level === 'finger' ? '힌트 마지막 단계' : `힌트 ${plan.level}단계`;
    case 'confirm':
      return '맞힘 확인';
    case 'predict':
      return '예측 반응';
    case 'recheck':
      return '다시 보기 안내';
  }
}

export interface Dialogue {
  /**
   * 한 차례를 진행한다. 낡은 요청(isCurrent가 false)이면 null: 그 결과로 직전 글을 바꾸지 않는다.
   * utterance가 없으면 새 상황의 첫 질문이다.
   */
  turn(args: TurnArgs, utterance: string | undefined, isCurrent: () => boolean): Promise<ShownTurn | null>;
}

export function createDialogue(getRunner: () => ModelTutor | null): Dialogue {
  let hintLevel = 0;
  let lastShown: string | undefined;
  let turnKey: number | undefined;

  return {
    async turn(a, utterance, isCurrent) {
      // 새 상황이면 힌트 단계를 처음으로.
      if (turnKey !== a.turnKey) {
        turnKey = a.turnKey;
        hintLevel = 0;
      }
      const plan = planTurn({
        experiment: a.experiment,
        answers: a.answers,
        state: a.state,
        trials: a.trials,
        ...(utterance ? { utterance } : {}),
        ...(lastShown !== undefined ? { previousTutor: lastShown } : {}),
        hintLevel,
        fallback: a.fallback,
      });
      if (plan.kind !== 'model') {
        if (plan.kind === 'hint') hintLevel = plan.nextHintLevel;
        lastShown = plan.text;
        return { text: plan.text, status: statusOfPlan(plan), plan: plan.kind };
      }
      const runner = getRunner();
      if (!runner) return null;
      const res = await runner.ask({
        experiment: a.experiment,
        state: a.state,
        ...(utterance ? { utterance } : {}),
        unit: a.unit,
        ...(lastShown !== undefined ? { previousTutor: lastShown } : {}),
        fallback: plan.fallbackText,
        isCurrent,
      });
      if (!isCurrent()) return null;
      lastShown = res.text;
      const status = res.source === 'model' ? `모델 질문 · ${(res.firstTokenMs / 1000).toFixed(1)}초` : `기본 질문 · ${reasonLabel(res.reason)}`;
      return { text: res.text, status, plan: 'model' };
    },
  };
}
