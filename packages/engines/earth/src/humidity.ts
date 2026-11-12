import type { VariableExperiment as Experiment } from '@sci/schema';

export const HM_DRYS = [10, 15, 20, 25, 30] as const;
export type HmDry = (typeof HM_DRYS)[number];
export const HM_DIFFS = [0, 1, 2, 3, 4, 5, 6] as const;
export type HmDiff = (typeof HM_DIFFS)[number];
export const HM_PLACES = ['white', 'gray'] as const;
export type HmPlace = (typeof HM_PLACES)[number];

export interface HumidityParams {
  /** 건구 온도(°C) */
  dry: number;
  /** 건구와 습구의 온도 차(°C) */
  diff: number;
  /** 습도계를 둔 곳 벽 색: 계산에 쓰지 않는 대조 변인 */
  place: HmPlace;
}

export interface HumiditySample {
  /** 초 */
  t: number;
  /** 건구 온도(°C): 내내 같다. */
  dryC: number;
  /** 습구 온도(°C): 건구 온도에서 정해진 값까지 내려간다. */
  wetC: number;
  /** 습도(%): 0에서 습도표 값까지 올라간다. */
  rh: number;
}

export interface HumidityResult {
  /** 습도(%), 정수 */
  rh: number;
  /** 습구 온도(°C) = 건구 − 온도 차 */
  wet: number;
}

export interface HumidityOutput {
  samples: HumiditySample[];
  result: HumidityResult;
}

export const HM_TOTAL_S = 2;
export const HM_SAMPLE_S = 0.05;
/** 눈금은 1.5초 동안 움직이고 2초까지 멈춰 있다. */
export const HM_MOVE_S = 1.5;
/** 화면에서 두 습도를 같다고 보는 기준(%) */
export const HM_SAME_RH = 0.5;
/** 습도식의 건습구 상수(0.000800 × 기압 1013 hPa) */
export const HM_PSYCHRO = 0.0008 * 1013;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 포화 수증기압(hPa) es(t) = 6.1078 × 10^(7.5t ÷ (237.3 + t)) */
export const saturationHpa = (c: number): number => 6.1078 * 10 ** ((7.5 * c) / (237.3 + c));

/** 습도(%) = round(100 × (es(Tw) − 0.000800 × 1013 × (T − Tw)) ÷ es(T)). 온도 차가 0이면 100. */
export const humidityOf = (dry: number, diff: number): number => {
  const wet = dry - diff;
  return Math.round((100 * (saturationHpa(wet) - HM_PSYCHRO * (dry - wet))) / saturationHpa(dry));
};

/** 습도표: 건구 온도 행 × 온도 차 열 */
export const HM_TABLE: Record<HmDry, number[]> = {
  10: HM_DIFFS.map((d) => humidityOf(10, d)),
  15: HM_DIFFS.map((d) => humidityOf(15, d)),
  20: HM_DIFFS.map((d) => humidityOf(20, d)),
  25: HM_DIFFS.map((d) => humidityOf(25, d)),
  30: HM_DIFFS.map((d) => humidityOf(30, d)),
};

const checkParams = (p: HumidityParams): void => {
  if (typeof p.dry !== 'number' || !(HM_DRYS as readonly number[]).includes(p.dry)) throw new RangeError(`건구 온도 ${String(p.dry)}은(는) ${HM_DRYS.join(', ')} °C 중 하나여야 합니다.`);
  if (typeof p.diff !== 'number' || !(HM_DIFFS as readonly number[]).includes(p.diff)) throw new RangeError(`온도 차 ${String(p.diff)}은(는) ${HM_DIFFS.join(', ')} °C 중 하나여야 합니다.`);
  if (!(HM_PLACES as readonly string[]).includes(p.place)) throw new RangeError(`벽 색 ${String(p.place)}은(는) ${HM_PLACES.join(', ')} 중 하나여야 합니다.`);
};

/**
 * 건습구 습도계로 습도 구하기. 습도표 값은 식으로 만들고 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 습도계를 둔 곳 벽 색은 계산에 쓰지 않는다. 습구 온도와 습도는 0~1.5초 동안 정해진 값에 이르고 2초까지 멈춰 있다(0.05초 간격).
 */
export function simulateHumidity(params: HumidityParams): HumidityOutput {
  checkParams(params);
  const result: HumidityResult = { rh: humidityOf(params.dry, params.diff), wet: params.dry - params.diff };
  const steps = Math.round(HM_TOTAL_S / HM_SAMPLE_S);
  const samples: HumiditySample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * HM_SAMPLE_S, 6);
    const u = Math.min(1, t / HM_MOVE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({ t, dryC: params.dry, wetC: roundTo(params.dry - params.diff * ease, 9), rh: roundTo(result.rh * ease, 9) });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateHumidity(a: HumiditySample, b: HumiditySample, k: number): HumiditySample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), dryC: lerp(a.dryC, b.dryC), wetC: lerp(a.wetC, b.wetC), rh: lerp(a.rh, b.rh) };
}

const KEYS = ['dry', 'diff', 'place'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { dry: HM_DRYS, diff: HM_DIFFS, place: HM_PLACES };

/** 매니페스트의 건습구 습도계 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateHumidityExperiment(exp: Experiment): string[] {
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
