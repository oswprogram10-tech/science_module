import type { VariableExperiment as Experiment } from '@sci/schema';

export const PHASES = ['day', 'night'] as const;
export type PhaseKind = (typeof PHASES)[number];
export const BOWLS = ['plastic', 'glass'] as const;
export type BowlKind = (typeof BOWLS)[number];
export type BreezeKind = 'sea-to-land' | 'land-to-sea' | 'calm';

export interface BreezeParams {
  phase: PhaseKind;
  /** 전등과의 거리(cm) */
  lampCm: number;
  /** 그릇: 계산에 쓰지 않는 대조 변인 */
  bowl: BowlKind;
}

export interface BreezeOptions {
  /** 관찰하는 시간(분) */
  totalMin?: number;
  sampleEveryMin?: number;
}

export interface BreezeSample {
  t: number;
  /** 모래(육지) 온도(°C) */
  sand: number;
  /** 물(바다) 온도(°C) */
  water: number;
  /** 모래 − 물(°C) */
  diff: number;
  /** 바람 세기(화면용, −1~1). +이면 바다 → 육지이다. */
  wind: number;
}

export interface BreezeResult {
  /** 모래 온도(°C), 소수 첫째 자리 */
  sand: number;
  /** 물 온도(°C), 소수 첫째 자리 */
  water: number;
  /** 온도 차 모래 − 물(°C): 반올림 전 값의 차를 소수 첫째 자리로 반올림 */
  diff: number;
  breeze: BreezeKind;
}

export interface BreezeOutput {
  samples: BreezeSample[];
  result: BreezeResult;
}

/** 주변 온도(°C) (근사값, 교사 검수 대상) */
export const BREEZE_AMBIENT_C = 20;
/** 기준 거리(cm): 이때 빛 세기 P = 1 */
export const LAMP_REF_CM = 20;
/** 기준 거리(20 cm)에서 끝없이 비추었을 때의 최대 상승(°C) */
export const MAX_RISE_C = 16;
/** 시간 상수(분) */
export const TAU_SAND_MIN = 4;
export const TAU_WATER_MIN = 20;
/** 낮 시행의 길이(분). 밤 시행은 같은 거리의 낮 시행이 끝난 상태에서 시작한다. */
export const DAY_MIN = 10;
export const DEFAULT_TOTAL_MIN = 10;
/** 이 값(°C) 이하의 온도 차는 바람이 거의 없다고 본다 */
export const CALM_DIFF_C = 0.5;
/** wind = diff / WIND_SCALE_C (−1~1로 자름) */
export const WIND_SCALE_C = 8;
export const LAMP_MIN_CM = 15;
export const LAMP_MAX_CM = 60;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 빛 세기 P = (20 / lampCm)² */
export const lightPower = (lampCm: number) => (LAMP_REF_CM / lampCm) ** 2;
/** 최대 상승 R = 16·P */
export const maxRise = (lampCm: number) => MAX_RISE_C * lightPower(lampCm);

function checkParams(p: BreezeParams): void {
  if (!(PHASES as readonly string[]).includes(p.phase)) throw new RangeError(`때 ${String(p.phase)}은(는) ${PHASES.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.lampCm !== 'number' || !Number.isFinite(p.lampCm) || p.lampCm < LAMP_MIN_CM || p.lampCm > LAMP_MAX_CM) {
    throw new RangeError(`전등과의 거리 ${String(p.lampCm)}은(는) ${LAMP_MIN_CM}~${LAMP_MAX_CM} cm여야 합니다.`);
  }
  if (!(BOWLS as readonly string[]).includes(p.bowl)) throw new RangeError(`그릇 ${String(p.bowl)}은(는) ${BOWLS.join(', ')} 중 하나여야 합니다.`);
}

/** 반올림 전 모래·물 온도. 밤은 같은 거리의 낮 10분 끝값에서 식기 시작한다. */
export function temperaturesAt(phase: PhaseKind, lampCm: number, t: number): { sand: number; water: number } {
  const R = maxRise(lampCm);
  if (phase === 'day') {
    return {
      sand: BREEZE_AMBIENT_C + R * (1 - Math.exp(-t / TAU_SAND_MIN)),
      water: BREEZE_AMBIENT_C + R * (1 - Math.exp(-t / TAU_WATER_MIN)),
    };
  }
  const s0 = R * (1 - Math.exp(-DAY_MIN / TAU_SAND_MIN));
  const w0 = R * (1 - Math.exp(-DAY_MIN / TAU_WATER_MIN));
  return {
    sand: BREEZE_AMBIENT_C + s0 * Math.exp(-t / TAU_SAND_MIN),
    water: BREEZE_AMBIENT_C + w0 * Math.exp(-t / TAU_WATER_MIN),
  };
}

/** 바람 세기(화면용): clamp(diff / 8, −1, 1) */
export const windOf = (diff: number) => Math.min(1, Math.max(-1, diff / WIND_SCALE_C));

/** 온도 차(모래 − 물)로 바람 방향을 정한다. +0.5보다 크면 바다 → 육지, −0.5보다 작으면 육지 → 바다. */
export const breezeOf = (diff: number): BreezeKind => (diff > CALM_DIFF_C ? 'sea-to-land' : diff < -CALM_DIFF_C ? 'land-to-sea' : 'calm');

/**
 * 모래와 물의 데워짐·식음 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 낮: T = 20 + R(1 − e^(−t/τ)), 밤: T = 20 + T0·e^(−t/τ) (τ: 모래 4분, 물 20분). 그릇은 계산에 쓰지 않는다. 난수 없음.
 */
export function simulateBreeze(params: BreezeParams, opts: BreezeOptions = {}): BreezeOutput {
  const { totalMin = DEFAULT_TOTAL_MIN, sampleEveryMin = 0.1 } = opts;
  checkParams(params);
  if (!(totalMin > 0)) throw new RangeError(`관찰 시간 ${totalMin}분은 0보다 커야 합니다.`);
  const steps = Math.round(totalMin / sampleEveryMin);
  const samples: BreezeSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = round(i * sampleEveryMin, 6);
    const { sand, water } = temperaturesAt(params.phase, params.lampCm, t);
    const diff = sand - water;
    samples.push({ t, sand: round(sand, 6), water: round(water, 6), diff: round(diff, 6), wind: round(windOf(diff), 6) });
  }
  const end = temperaturesAt(params.phase, params.lampCm, samples[samples.length - 1]!.t);
  const diff = end.sand - end.water;
  return {
    samples,
    result: { sand: round(end.sand, 1), water: round(end.water, 1), diff: round(diff, 1), breeze: breezeOf(diff) },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateBreeze(a: BreezeSample, b: BreezeSample, k: number): BreezeSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), sand: lerp(a.sand, b.sand), water: lerp(a.water, b.water), diff: lerp(a.diff, b.diff), wind: lerp(a.wind, b.wind) };
}

const BREEZE_KEYS = ['phase', 'lampCm', 'bowl'] as const;

/** 매니페스트의 바람 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateBreezeExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const total = exp.params?.totalMin;
  if (!(typeof total === 'number' && Number.isFinite(total) && total > 0)) errors.push('params.totalMin은(는) 0보다 큰 숫자여야 합니다.');
  for (const key of BREEZE_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'phase') {
        if (typeof val !== 'string' || !(PHASES as readonly string[]).includes(val)) bad(`${PHASES.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'bowl') {
        if (typeof val !== 'string' || !(BOWLS as readonly string[]).includes(val)) bad(`${BOWLS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        bad('숫자여야 합니다.');
      } else if (val < LAMP_MIN_CM || val > LAMP_MAX_CM) {
        bad(`전등과의 거리는 ${LAMP_MIN_CM}~${LAMP_MAX_CM} cm 범위여야 합니다.`);
      }
    }
  }
  return errors;
}
