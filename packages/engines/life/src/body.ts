import type { VariableExperiment as Experiment } from '@sci/schema';

export type ExerciseKind = 'sit' | 'walk' | 'run';
export type WristKind = 'left' | 'right';

export interface BodyParams {
  kind: ExerciseKind;
  /** 운동 시간(분) */
  minutes: number;
  /** 맥박을 잰 손목. 대조 변인이라 계산에는 쓰지 않는다. */
  wrist: WristKind;
}

export interface BodyOptions {
  /** 전체 관찰 시간(분) */
  totalMin?: number;
  /** 운동 전에 쉬는 시간(분) */
  restBeforeMin?: number;
  /** 샘플 간격(분) */
  sampleEveryMin?: number;
}

export interface BodySample {
  /** 경과 시간(분) */
  t: number;
  /** 맥박(회/분) */
  pulse: number;
  /** 호흡(회/분) */
  breath: number;
  /** 운동 강도(0~1): 운동 중이면 I, 아니면 0 */
  effort: number;
}

export interface BodyResult {
  /** 운동이 끝난 순간 맥박(회/분, 반올림) */
  pulseEnd: number;
  /** 운동이 끝난 순간 호흡(회/분, 반올림) */
  breathEnd: number;
  /** 원래 맥박으로 돌아오는 데 걸린 시간(분, 소수 첫째 자리) */
  recoverMin: number;
}

export interface BodyOutput {
  samples: BodySample[];
  result: BodyResult;
}

export const EXERCISE_KINDS: readonly ExerciseKind[] = ['sit', 'walk', 'run'];
export const WRISTS: readonly WristKind[] = ['left', 'right'];
export const BODY_DEFAULT_TOTAL_MIN = 10;
export const BODY_DEFAULT_REST_BEFORE_MIN = 1;
export const BODY_MIN_EXERCISE_MIN = 0.5;
export const BODY_MAX_EXERCISE_MIN = 5;
/** 운동이 끝난 뒤 적어도 이만큼은 관찰한다(분). */
export const BODY_MIN_AFTER_MIN = 5;
export const REST_PULSE = 85;
export const REST_BREATH = 20;
/** 운동이 끝난 뒤 쉴 때 값으로 돌아가는 시간 상수(분) */
const RECOVER_TAU_MIN = 1.5;
/** 운동이 시작된 뒤 목표 값에 다가가는 시간 상수(분) */
const RISE_TAU_MIN = 0.5;
/** 맥박이 쉴 때 값에서 이 안이면 돌아온 것으로 본다(회/분). */
const RECOVERED_WITHIN = 5;

/** 운동 강도 I */
export const EXERCISE_INTENSITY: Record<ExerciseKind, number> = { sit: 0, walk: 0.35, run: 1 };

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: BodyParams): void {
  if (!EXERCISE_KINDS.includes(p.kind)) throw new RangeError(`운동 ${String(p.kind)}은(는) ${EXERCISE_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.minutes !== 'number' || !Number.isFinite(p.minutes)) throw new RangeError(`운동 시간 ${String(p.minutes)}은(는) 수여야 합니다.`);
  if (p.minutes < BODY_MIN_EXERCISE_MIN || p.minutes > BODY_MAX_EXERCISE_MIN) {
    throw new RangeError(`운동 시간은 ${BODY_MIN_EXERCISE_MIN}~${BODY_MAX_EXERCISE_MIN}분 범위여야 합니다.`);
  }
  if (!WRISTS.includes(p.wrist)) throw new RangeError(`손목 ${String(p.wrist)}은(는) ${WRISTS.join(', ')} 중 하나여야 합니다.`);
}

/**
 * 운동할 때 맥박과 호흡이 달라지는 근사 모델. 수치는 초등 고학년의 평균을 단순화한 근사값이며 교사 검수 대상이다.
 * 손목은 쓰지 않는다(대조 변인). 순수 함수, 난수 없음.
 */
export function simulateBody(params: BodyParams, opts: BodyOptions = {}): BodyOutput {
  checkParams(params);
  const totalMin = opts.totalMin ?? BODY_DEFAULT_TOTAL_MIN;
  const t0 = opts.restBeforeMin ?? BODY_DEFAULT_REST_BEFORE_MIN;
  const sampleEveryMin = opts.sampleEveryMin ?? 0.05;
  const t1 = t0 + params.minutes;
  if (!(t0 >= 0)) throw new RangeError('운동 전에 쉬는 시간이 올바르지 않습니다.');
  if (!(totalMin >= t1 + BODY_MIN_AFTER_MIN)) throw new RangeError(`운동이 끝난 뒤 ${BODY_MIN_AFTER_MIN}분 이상 관찰해야 합니다.`);
  if (!(sampleEveryMin > 0 && sampleEveryMin <= totalMin)) throw new RangeError('샘플 간격이 올바르지 않습니다.');

  const I = EXERCISE_INTENSITY[params.kind];
  const targetPulse = REST_PULSE + 85 * I;
  const targetBreath = REST_BREATH + 25 * I;
  /** 운동이 시작된 뒤 t분째 값 */
  const rising = (rest: number, target: number, t: number) => rest + (target - rest) * (1 - Math.exp(-(t - t0) / RISE_TAU_MIN));
  const pulseEndRaw = rising(REST_PULSE, targetPulse, t1);
  const breathEndRaw = rising(REST_BREATH, targetBreath, t1);
  const falling = (rest: number, end: number, t: number) => rest + (end - rest) * Math.exp(-(t - t1) / RECOVER_TAU_MIN);
  const pulseAt = (t: number) => (t <= t0 ? REST_PULSE : t <= t1 ? rising(REST_PULSE, targetPulse, t) : falling(REST_PULSE, pulseEndRaw, t));
  const breathAt = (t: number) => (t <= t0 ? REST_BREATH : t <= t1 ? rising(REST_BREATH, targetBreath, t) : falling(REST_BREATH, breathEndRaw, t));

  const steps = Math.floor(totalMin / sampleEveryMin + 1e-9);
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) times.push(round(i * sampleEveryMin, 6));
  if (times[times.length - 1]! < totalMin - 1e-9) times.push(totalMin);
  // 운동이 끝난 순간이 샘플 사이에 끼면 따로 넣어, 끝난 순간 값이 그래프와 재생에 그대로 나오게 한다.
  if (!times.some((t) => Math.abs(t - t1) < 1e-9)) {
    times.push(t1);
    times.sort((a, b) => a - b);
  }
  const samples = times.map((t): BodySample => ({
    t,
    pulse: pulseAt(t),
    breath: breathAt(t),
    effort: t > t0 + 1e-9 && t < t1 - 1e-9 ? I : 0,
  }));

  const diff = pulseEndRaw - REST_PULSE;
  const result: BodyResult = {
    pulseEnd: Math.round(pulseEndRaw),
    breathEnd: Math.round(breathEndRaw),
    recoverMin: diff <= RECOVERED_WITHIN ? 0 : round(RECOVER_TAU_MIN * Math.log(diff / RECOVERED_WITHIN), 1),
  };
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateBody(a: BodySample, b: BodySample, k: number): BodySample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), pulse: lerp(a.pulse, b.pulse), breath: lerp(a.breath, b.breath), effort: lerp(a.effort, b.effort) };
}

const KEYS = ['kind', 'minutes', 'wrist'] as const;

/** 매니페스트의 운동 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateExerciseExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const totalMin = typeof exp.params?.totalMin === 'number' ? exp.params.totalMin : BODY_DEFAULT_TOTAL_MIN;
  const restBefore = typeof exp.params?.restBeforeMin === 'number' ? exp.params.restBeforeMin : BODY_DEFAULT_REST_BEFORE_MIN;
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'kind') {
        if (typeof val !== 'string' || !EXERCISE_KINDS.includes(val as ExerciseKind)) bad(`${EXERCISE_KINDS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'wrist') {
        if (typeof val !== 'string' || !WRISTS.includes(val as WristKind)) bad(`${WRISTS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
      else if (val < BODY_MIN_EXERCISE_MIN || val > BODY_MAX_EXERCISE_MIN) bad(`운동 시간은 ${BODY_MIN_EXERCISE_MIN}~${BODY_MAX_EXERCISE_MIN}분 범위여야 합니다.`);
      else if (restBefore + val + BODY_MIN_AFTER_MIN > totalMin) bad(`쉬는 시간 ${restBefore}분 + 운동 시간 + ${BODY_MIN_AFTER_MIN}분이 전체 ${totalMin}분을 넘습니다.`);
    }
  }
  const { totalMin: tm, restBeforeMin: rb } = exp.params ?? {};
  if (tm !== undefined && !(typeof tm === 'number' && Number.isFinite(tm) && tm > 0 && tm <= 30)) errors.push('params.totalMin은 0 초과 30 이하의 수여야 합니다.');
  if (rb !== undefined && !(typeof rb === 'number' && Number.isFinite(rb) && rb >= 0 && rb <= 5)) errors.push('params.restBeforeMin은 0~5 사이 수여야 합니다.');
  return errors;
}
