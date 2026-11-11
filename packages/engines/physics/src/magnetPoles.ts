import type { VariableExperiment as Experiment } from '@sci/schema';

export const POLE_FACINGS = ['NN', 'NS', 'SS'] as const;
export type PoleFacing = (typeof POLE_FACINGS)[number];
export const POLE_GAPS = [1, 2, 4] as const;
export const POLE_SIZES = ['small', 'large'] as const;
export type PoleSize = (typeof POLE_SIZES)[number];
export const POLE_COVERS = ['color', 'gray'] as const;
export type PoleCover = (typeof POLE_COVERS)[number];
export type PoleMotion = 'attract' | 'repel' | 'none';

export interface MagnetPolesParams {
  /** 마주 보는 극 */
  facing: PoleFacing;
  /** 두 자석 사이 거리(cm) */
  gapCm: number;
  /** 자석 크기 */
  size: PoleSize;
  /** 자석 겉 색칠: 계산에 쓰지 않는 대조 변인 */
  cover: PoleCover;
}

export interface MagnetPolesSample {
  /** 초 */
  t: number;
  /** 두 자석 사이 거리(cm) */
  gapCm: number;
}

export interface MagnetPolesResult {
  /** 오른쪽 자석의 움직임(범주) */
  motion: PoleMotion;
  /** 움직인 거리(cm), 소수 첫째 자리 */
  moveCm: number;
}

export interface MagnetPolesOutput {
  samples: MagnetPolesSample[];
  result: MagnetPolesResult;
}

/** 자석 크기에 따른 세기 계수 s: 작은 자석 1, 큰 자석 2 */
export const SIZE_STRENGTH: Record<PoleSize, number> = { small: 1, large: 2 };
/** 힘 F가 이 값보다 작으면 움직이지 않는다. */
export const MIN_FORCE = 0.1;
/** 같은 극이 밀려나는 거리 = min(6, round(4F, 1)) */
export const REPEL_CM_PER_F = 4;
export const REPEL_MAX_CM = 6;
export const POLES_TOTAL_S = 2;
export const POLES_SAMPLE_S = 0.05;
/** 움직임은 1.5초 안에 끝나고 나머지는 멈춰 있다. */
export const POLES_MOVE_S = 1.5;
/** 화면에서 두 움직인 거리를 같다고 보는 기준(cm) */
export const POLES_SAME_CM = 0.05;
/** 그래프 세로축 끝(cm) */
export const POLES_Y_MAX_CM = 10;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 마주 보는 두 극이 같은 극인가 */
export const isSamePole = (facing: PoleFacing): boolean => facing !== 'NS';

/** 힘 F = s / gap² (상대값) */
export const forceOf = (size: PoleSize, gapCm: number): number => SIZE_STRENGTH[size] / (gapCm * gapCm);

const checkParams = (p: MagnetPolesParams): void => {
  if (!(POLE_FACINGS as readonly string[]).includes(p.facing)) throw new RangeError(`마주 보는 극 ${String(p.facing)}은(는) ${POLE_FACINGS.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.gapCm !== 'number' || !(POLE_GAPS as readonly number[]).includes(p.gapCm)) throw new RangeError(`두 자석 사이 거리 ${String(p.gapCm)}은(는) ${POLE_GAPS.join(', ')} cm 중 하나여야 합니다.`);
  if (!(POLE_SIZES as readonly string[]).includes(p.size)) throw new RangeError(`자석 크기 ${String(p.size)}은(는) ${POLE_SIZES.join(', ')} 중 하나여야 합니다.`);
  if (!(POLE_COVERS as readonly string[]).includes(p.cover)) throw new RangeError(`자석 겉 색칠 ${String(p.cover)}은(는) ${POLE_COVERS.join(', ')} 중 하나여야 합니다.`);
};

/** 움직임과 움직인 거리(cm, 소수 첫째 자리). 다른 극은 다가와 붙고(거리 = 처음 거리), 같은 극은 밀려난다. */
export function motionOf(p: Pick<MagnetPolesParams, 'facing' | 'gapCm' | 'size'>): MagnetPolesResult {
  const f = forceOf(p.size, p.gapCm);
  if (f < MIN_FORCE) return { motion: 'none', moveCm: 0 };
  if (!isSamePole(p.facing)) return { motion: 'attract', moveCm: roundTo(p.gapCm, 1) };
  return { motion: 'repel', moveCm: Math.min(REPEL_MAX_CM, roundTo(REPEL_CM_PER_F * f, 1)) };
}

/**
 * 막대자석 두 개 사이의 힘. 수치는 이상화한 근사값이며 교사 검수 대상이다. 난수 없음.
 * F = s / gap²(작은 자석 s = 1, 큰 자석 s = 2). F가 0.1보다 작으면 움직이지 않는다.
 * 다른 극이면 오른쪽 자석이 다가와 붙고(움직인 거리 = 처음 거리), 같은 극이면 밀려나 min(6, 반올림(4F, 1)) cm 움직인다. 색칠은 계산에 쓰지 않는다.
 * 두 자석 사이 거리는 1.5초 동안 처음 값에서 끝 값으로 부드럽게 바뀌고 2초까지 멈춰 있다(0.05초 간격).
 */
export function simulateMagnetPoles(params: MagnetPolesParams): MagnetPolesOutput {
  checkParams(params);
  const result = motionOf(params);
  const end = result.motion === 'attract' ? 0 : result.motion === 'repel' ? roundTo(params.gapCm + result.moveCm, 1) : params.gapCm;
  const steps = Math.round(POLES_TOTAL_S / POLES_SAMPLE_S);
  const samples: MagnetPolesSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * POLES_SAMPLE_S, 6);
    const u = Math.min(1, t / POLES_MOVE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({ t, gapCm: roundTo(params.gapCm + (end - params.gapCm) * ease, 9) });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateMagnetPoles(a: MagnetPolesSample, b: MagnetPolesSample, k: number): MagnetPolesSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), gapCm: lerp(a.gapCm, b.gapCm) };
}

const KEYS = ['facing', 'gapCm', 'size', 'cover'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { facing: POLE_FACINGS, gapCm: POLE_GAPS, size: POLE_SIZES, cover: POLE_COVERS };

/** 매니페스트의 자석과 자석 사이 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateMagnetPolesExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
