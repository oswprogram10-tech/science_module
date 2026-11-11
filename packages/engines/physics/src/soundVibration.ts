import type { VariableExperiment as Experiment } from '@sci/schema';

export const VIB_SOUNDS = ['off', 'on'] as const;
export type VibSound = (typeof VIB_SOUNDS)[number];
export const VIB_LOUDS = ['weak', 'strong'] as const;
export type VibLoud = (typeof VIB_LOUDS)[number];
export const VIB_OBJECTS = ['drum', 'fork', 'speaker'] as const;
export type VibObject = (typeof VIB_OBJECTS)[number];
export const VIB_SEEDS = ['yellow', 'white'] as const;
export type VibSeed = (typeof VIB_SEEDS)[number];

export interface SoundVibrationParams {
  /** 소리를 내는가 */
  sound: VibSound;
  /** 소리의 세기 */
  loud: VibLoud;
  /** 소리를 내는 물체 */
  object: VibObject;
  /** 좁쌀 색: 계산에 쓰지 않는 대조 변인 */
  seed: VibSeed;
}

export interface SoundVibrationSample {
  /** 초 */
  t: number;
  /** 좁쌀 높이(mm): 튄 높이에 절댓값 사인 곡선을 곱한 값 */
  bounceMm: number;
  /** 소리의 크기(눈금): 시행 내내 일정하다. */
  level: number;
}

export interface SoundVibrationResult {
  /** 좁쌀이 튄 높이(mm), 정수 */
  bounce: number;
  /** 소리의 크기(눈금), 0~10 정수 */
  level: number;
}

export interface SoundVibrationOutput {
  samples: SoundVibrationSample[];
  result: SoundVibrationResult;
}

/** 소리를 내고 세게 했을 때 좁쌀이 튄 높이(mm): 물체마다 다르다. */
export const BOUNCE_STRONG_MM: Record<VibObject, number> = { drum: 12, fork: 6, speaker: 9 };
/** 약하게 하면 이 비율로 줄이고 반올림한다. */
export const WEAK_RATIO = 0.4;
/** 소리의 크기 = round(튄 높이 × 0.6), 상한 10 */
export const LEVEL_PER_MM = 0.6;
export const LEVEL_MAX = 10;
export const VIB_TOTAL_S = 3;
export const VIB_SAMPLE_S = 0.025;
/** 좁쌀은 1초에 두 번 튄다(절댓값 사인 곡선의 한 마루가 0.5초). 눈으로 따라갈 수 있는 느린 화면이다. */
export const VIB_HOPS_PER_S = 2;
/** 화면에서 두 결과를 같다고 보는 기준(mm) */
export const VIB_SAME_MM = 0.5;
/** 그래프 세로축 끝(mm) */
export const VIB_Y_MAX_MM = 15;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: SoundVibrationParams): void => {
  const bad = (name: string, v: unknown, list: readonly string[]) => new RangeError(`${name} ${String(v)}은(는) ${list.join(', ')} 중 하나여야 합니다.`);
  if (!(VIB_SOUNDS as readonly string[]).includes(p.sound)) throw bad('소리 내기', p.sound, VIB_SOUNDS);
  if (!(VIB_LOUDS as readonly string[]).includes(p.loud)) throw bad('소리의 세기', p.loud, VIB_LOUDS);
  if (!(VIB_OBJECTS as readonly string[]).includes(p.object)) throw bad('물체', p.object, VIB_OBJECTS);
  if (!(VIB_SEEDS as readonly string[]).includes(p.seed)) throw bad('좁쌀 색', p.seed, VIB_SEEDS);
};

/** 좁쌀이 튄 높이(mm), 정수. 소리를 내지 않으면 0. 약하게 하면 × 0.4 후 반올림. */
export function bounceMmOf(p: Pick<SoundVibrationParams, 'sound' | 'loud' | 'object'>): number {
  if (p.sound === 'off') return 0;
  const strong = BOUNCE_STRONG_MM[p.object];
  return p.loud === 'strong' ? strong : Math.round(strong * WEAK_RATIO);
}

/** 소리의 크기(눈금) = round(튄 높이 × 0.6), 상한 10 */
export const vibLevelOf = (bounceMm: number): number => Math.min(LEVEL_MAX, Math.round(bounceMm * LEVEL_PER_MM));

/**
 * 소리 나는 물체 위의 좁쌀. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 소리를 내지 않으면 0과 0이고, 좁쌀 색은 계산에 쓰지 않는다.
 * 높이는 튄 높이 × |sin(π × 2 × t)|로 그린다(0~3초, 0.025초 간격).
 */
export function simulateSoundVibration(params: SoundVibrationParams): SoundVibrationOutput {
  checkParams(params);
  const bounce = bounceMmOf(params);
  const level = vibLevelOf(bounce);
  const steps = Math.round(VIB_TOTAL_S / VIB_SAMPLE_S);
  const samples: SoundVibrationSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * VIB_SAMPLE_S, 6);
    const hop = Math.abs(Math.sin(Math.PI * VIB_HOPS_PER_S * t));
    samples.push({ t, bounceMm: roundTo(bounce * hop, 9), level });
  }
  return { samples, result: { bounce, level } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateSoundVibration(a: SoundVibrationSample, b: SoundVibrationSample, k: number): SoundVibrationSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), bounceMm: lerp(a.bounceMm, b.bounceMm), level: lerp(a.level, b.level) };
}

const KEYS = ['sound', 'loud', 'object', 'seed'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly string[]> = { sound: VIB_SOUNDS, loud: VIB_LOUDS, object: VIB_OBJECTS, seed: VIB_SEEDS };

/** 매니페스트의 소리 나는 물체의 떨림 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateSoundVibrationExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (typeof o.value !== 'string' || !ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
