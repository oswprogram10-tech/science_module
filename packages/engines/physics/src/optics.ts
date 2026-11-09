import type { VariableExperiment as Experiment } from '@sci/schema';

export type CurveKind = 'low' | 'high';

export interface ConvexLensParams {
  distanceCm: number;
  curve: CurveKind;
  diameterCm: number;
}

export interface ConvexLensOptions {
  roomC?: number;
  durationS?: number;
  sampleEvery?: number;
  /** 종이가 데워지는 시간 상수(초). */
  tauS?: number;
  /** 해의 겉보기 각 지름(rad). 약 0.53도. */
  sunAngle?: number;
  /** 평형 온도 상승 = gainC × √(밝기 배율). */
  gainC?: number;
  maxRiseC?: number;
  scorchC?: number;
}

export interface ConvexLensSample {
  t: number;
  spotC: number;
  /** 종이가 그을리는 온도 이상이면 1, 아니면 0(보간할 수 있게 숫자) */
  scorched: number;
}

export interface ConvexLensResult {
  /** 종이에 생긴 빛 원의 지름(mm), 소수 첫째 자리 */
  spotMm: number;
  /** 햇빛 대비 밝기 배율, 정수 */
  concentration: number;
  /** 마지막 온도(°C), 소수 첫째 자리 */
  endC: number;
  scorched: boolean;
}

export interface ConvexLensOutput {
  samples: ConvexLensSample[];
  result: ConvexLensResult;
}

export const CURVES: readonly CurveKind[] = ['low', 'high'];

/** 빛이 한곳에 모이는 거리(cm). 조금 볼록 15, 많이 볼록 10. */
export const FOCUS_CM: Record<CurveKind, number> = { low: 15, high: 10 };

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: ConvexLensParams): void {
  if (typeof p.distanceCm !== 'number' || !Number.isFinite(p.distanceCm) || p.distanceCm < 1 || p.distanceCm > 50) {
    throw new RangeError(`거리 ${String(p.distanceCm)}은(는) 1 이상 50 이하의 수여야 합니다.`);
  }
  if (!CURVES.includes(p.curve)) throw new RangeError(`볼록한 정도 ${String(p.curve)}은(는) low, high 중 하나여야 합니다.`);
  if (typeof p.diameterCm !== 'number' || !Number.isFinite(p.diameterCm) || p.diameterCm < 1 || p.diameterCm > 20) {
    throw new RangeError(`렌즈 지름 ${String(p.diameterCm)}은(는) 1 이상 20 이하의 수여야 합니다.`);
  }
}

/**
 * 렌즈 높이 heightMm(광축에서 잰 높이)로 들어온 평행 광선이 렌즈에서 꺾여 (fCm, 0)을 향해 가다가
 * 렌즈에서 distanceCm 떨어진 종이와 만나는 높이(mm). 부호는 광축 반대쪽이면 음수.
 */
export function traceRay(heightMm: number, fCm: number, distanceCm: number): { xAtPaperMm: number } {
  return { xAtPaperMm: heightMm * (1 - distanceCm / fCm) };
}

/**
 * 얇은 볼록 렌즈와 햇빛(평행 광선) 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 빛 원 지름 = max(기하 지름, 해의 겉보기 크기), 밝기 = (렌즈 지름 / 빛 원 지름)²,
 * 평형 온도 상승 = min(gainC·√밝기, maxRiseC), 온도 = 실내 + 상승·(1 − e^(−t/τ)).
 */
export function simulateConvexLens(params: ConvexLensParams, opts: ConvexLensOptions = {}): ConvexLensOutput {
  const { roomC = 20, durationS = 60, sampleEvery = 0.5, tauS = 5, sunAngle = 0.0093, gainC = 5, maxRiseC = 300, scorchC = 230 } = opts;
  checkParams(params);
  if (!(durationS > 0) || !(sampleEvery > 0)) throw new RangeError('시간과 표본 간격은 0보다 커야 합니다.');
  if (!(tauS > 0)) throw new RangeError('시간 상수는 0보다 커야 합니다.');

  const f = FOCUS_CM[params.curve];
  const lensMm = params.diameterCm * 10;
  const geometricMm = (lensMm * Math.abs(params.distanceCm - f)) / f;
  const spotMm = Math.max(geometricMm, f * 10 * sunAngle);
  const concentration = (lensMm / spotMm) ** 2;
  const riseC = Math.min(gainC * Math.sqrt(concentration), maxRiseC);

  const at = (t: number): ConvexLensSample => {
    const spotC = roomC + riseC * (1 - Math.exp(-t / tauS));
    return { t: round(t, 6), spotC, scorched: spotC >= scorchC ? 1 : 0 };
  };

  const samples: ConvexLensSample[] = [];
  const steps = Math.floor(durationS / sampleEvery + 1e-9);
  for (let i = 0; i <= steps; i++) samples.push(at(i * sampleEvery));
  if (samples[samples.length - 1]!.t < durationS - 1e-9) samples.push(at(durationS));

  const end = samples[samples.length - 1]!;
  return {
    samples,
    result: {
      spotMm: round(spotMm, 1),
      concentration: Math.round(concentration),
      endC: round(end.spotC, 1),
      scorched: end.scorched >= 0.5,
    },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateConvexLens(a: ConvexLensSample, b: ConvexLensSample, k: number): ConvexLensSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), spotC: lerp(a.spotC, b.spotC), scorched: lerp(a.scorched, b.scorched) };
}

const CONVEX_LENS_KEYS = ['distanceCm', 'curve', 'diameterCm'] as const;

/** 매니페스트의 볼록 렌즈 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateConvexLensExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of CONVEX_LENS_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'curve') {
        if (val !== 'low' && val !== 'high') bad('low, high 중 하나여야 합니다.');
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        bad('숫자여야 합니다.');
      } else if (key === 'distanceCm' && (val < 1 || val > 50)) {
        bad('거리는 1~50 cm 범위여야 합니다.');
      } else if (key === 'diameterCm' && (val < 1 || val > 20)) {
        bad('렌즈 지름은 1~20 cm 범위여야 합니다.');
      }
    }
  }
  return errors;
}
