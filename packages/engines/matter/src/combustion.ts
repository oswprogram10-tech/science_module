import type { VariableExperiment as Experiment } from '@sci/schema';

export type CandleKind = 'thin' | 'thick';

export interface CombustionParams {
  jarMl: number;
  candle: CandleKind;
  candleCount: number;
  candleColor: string;
}

export interface CombustionOptions {
  dt?: number;
  sampleEvery?: number;
  tailS?: number;
  oxygenStartPct?: number;
  oxygenOutPct?: number;
}

export interface CombustionSample {
  t: number;
  oxygenPct: number;
  co2Pct: number;
  /** 불꽃 세기 0~1 */
  flame: number;
  /** 집기병 안쪽 물방울 정도 0~1 */
  fog: number;
  /** 불이 켜져 있으면 1, 꺼졌으면 0 (보간 가능하게 숫자) */
  lit: number;
}

export interface CombustionResult {
  extinguishS: number;
  oxygenEndPct: number;
  co2EndPct: number;
  /** 꺼질 때까지 쓰인 산소의 양(mL). 집기병 크기에 따라 달라진다. */
  usedOxygenMl: number;
}

export interface CombustionOutput {
  samples: CombustionSample[];
  result: CombustionResult;
}

/** 초 1개의 산소 소비 속도(mL/s). */
export const CANDLE_RATE_ML_S: Record<CandleKind, number> = { thin: 2.5, thick: 4.0 };
/** 불꽃이 아주 약해져도 남는 소비 속도의 비율. */
export const MIN_BURN_FACTOR = 0.3;
/** 소비한 산소 부피 대비 늘어나는 이산화 탄소 부피의 비. */
export const CO2_PER_O2 = 0.7;
export const CO2_START_PCT = 0.04;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: CombustionParams, start: number, out: number): void {
  if (typeof p.jarMl !== 'number' || !Number.isFinite(p.jarMl) || p.jarMl < 100 || p.jarMl > 5000) {
    throw new RangeError(`집기병 크기 ${String(p.jarMl)}은(는) 100 이상 5000 이하의 수여야 합니다.`);
  }
  if (p.candle !== 'thin' && p.candle !== 'thick') {
    throw new RangeError(`초의 굵기 ${String(p.candle)}은(는) thin, thick 중 하나여야 합니다.`);
  }
  if (!Number.isInteger(p.candleCount) || p.candleCount < 1 || p.candleCount > 4) {
    throw new RangeError(`초의 개수 ${String(p.candleCount)}은(는) 1~4의 정수여야 합니다.`);
  }
  if (!(start > out)) throw new RangeError('처음 산소 비율은 꺼지는 산소 비율보다 커야 합니다.');
}

/**
 * 집기병으로 덮은 촛불. 산소를 쓰는 속도는 불꽃이 약해질수록 느려진다.
 * x = 쓴 산소 / 쓸 수 있는 산소 라 하면 dx/dt = k(1 - 0.7x), k = r·개수 / 쓸 수 있는 산소.
 * 해석해 x(t) = (1 - e^(-0.7kt)) / 0.7 로 계산해, 시간 간격과 상관없이 꺼진 시각이 정확히 k에 반비례한다.
 * 수치는 교실 관찰값에 맞춘 근사이며 교사 검수 대상이다.
 */
export function simulateCombustion(params: CombustionParams, opts: CombustionOptions = {}): CombustionOutput {
  const { sampleEvery = 0.25, tailS = 3, oxygenStartPct = 21, oxygenOutPct = 16 } = opts;
  checkParams(params, oxygenStartPct, oxygenOutPct);
  const span = oxygenStartPct - oxygenOutPct;
  const usableMl = (params.jarMl * span) / 100;
  const k = (CANDLE_RATE_ML_S[params.candle] * params.candleCount) / usableMl;
  const c = MIN_BURN_FACTOR;
  const rate = (1 - c) * k;
  const tOut = -Math.log(c) / rate;

  const at = (t: number): CombustionSample => {
    const out = t >= tOut;
    const x = out ? 1 : Math.min(1, (1 - Math.exp(-rate * t)) / (1 - c));
    return {
      t: round(t, 6),
      oxygenPct: oxygenStartPct - span * x,
      co2Pct: CO2_START_PCT + CO2_PER_O2 * span * x,
      flame: out ? 0 : 1 - x,
      fog: x,
      lit: out ? 0 : 1,
    };
  };

  const samples: CombustionSample[] = [];
  const burnSteps = Math.floor(tOut / sampleEvery - 1e-9);
  for (let i = 0; i <= burnSteps; i++) samples.push(at(i * sampleEvery));
  samples.push(at(tOut));
  const tailEnd = tOut + tailS;
  for (let i = Math.floor(tOut / sampleEvery + 1e-9) + 1; i * sampleEvery < tailEnd - 1e-9; i++) {
    samples.push(at(i * sampleEvery));
  }
  samples.push(at(tailEnd));

  const end = at(tOut);
  return {
    samples,
    result: {
      extinguishS: round(tOut, 1),
      oxygenEndPct: round(end.oxygenPct, 1),
      co2EndPct: round(end.co2Pct, 2),
      usedOxygenMl: round((params.jarMl * (oxygenStartPct - end.oxygenPct)) / 100, 1),
    },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateCombustion(a: CombustionSample, b: CombustionSample, k: number): CombustionSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    oxygenPct: lerp(a.oxygenPct, b.oxygenPct),
    co2Pct: lerp(a.co2Pct, b.co2Pct),
    flame: lerp(a.flame, b.flame),
    fog: lerp(a.fog, b.fog),
    lit: lerp(a.lit, b.lit),
  };
}

const COMBUSTION_KEYS = ['jarMl', 'candle', 'candleCount', 'candleColor'] as const;

/** 매니페스트의 연소 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateCombustionExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of COMBUSTION_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'jarMl') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < 100 || val > 5000) bad('집기병 크기는 100~5000 mL 범위여야 합니다.');
      } else if (key === 'candle') {
        if (val !== 'thin' && val !== 'thick') bad('thin, thick 중 하나여야 합니다.');
      } else if (key === 'candleCount') {
        if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 4) bad('1~4의 정수여야 합니다.');
      } else if (typeof val !== 'string') {
        bad('문자열이어야 합니다.');
      }
    }
  }
  const start = exp.params?.oxygenStartPct;
  const out = exp.params?.oxygenOutPct;
  if (typeof start !== 'number' || !Number.isFinite(start) || typeof out !== 'number' || !Number.isFinite(out)) {
    errors.push('params.oxygenStartPct와 params.oxygenOutPct는 숫자여야 합니다.');
  } else if (!(start > out)) {
    errors.push('params.oxygenStartPct는 params.oxygenOutPct보다 커야 합니다.');
  }
  return errors;
}
