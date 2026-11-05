import type { VariableExperiment as Experiment } from '@sci/schema';

export const COVER_KINDS = ['none', 'film'] as const;
export type CoverKind = (typeof COVER_KINDS)[number];
export const AIR_KINDS = ['normal', 'co2'] as const;
export type AirKind = (typeof AIR_KINDS)[number];
export const CAP_KINDS = ['white', 'blue'] as const;
export type CapKind = (typeof CAP_KINDS)[number];

export interface GreenhouseParams {
  /** 투명 비닐 덮개 */
  cover: CoverKind;
  /** 병 속 공기 */
  air: AirKind;
  /** 병 뚜껑 색: 계산에 쓰지 않는 대조 변인 */
  cap: CapKind;
}

export interface GreenhouseOptions {
  /** 전등으로 비추는 시간(분) */
  totalMin?: number;
  sampleEveryMin?: number;
}

export interface GreenhouseSample {
  /** 시간(분) */
  t: number;
  /** 병 속 공기 온도(°C) */
  temp: number;
  /** 처음보다 오른 온도(°C) = temp − 22 */
  rise: number;
  /** 화면용 0~1: 오를 수 있는 최대 온도 차 / 11.5 */
  trapped: number;
}

export interface GreenhouseResult {
  /** 마지막 시각의 병 속 온도(°C), 소수 첫째 자리 */
  temp: number;
  /** 오른 온도(°C), 반올림 전 값에서 소수 첫째 자리로 반올림 */
  rise: number;
}

export interface GreenhouseOutput {
  samples: GreenhouseSample[];
  result: GreenhouseResult;
  /** 반올림 전 값 */
  raw: { temp: number; rise: number };
}

/** 처음 온도(°C)와 시간 상수(분). 근사 모델이며 교사 검수 대상이다. */
export const GREENHOUSE_START_C = 22;
export const GREENHOUSE_TAU_MIN = 6;
export const GREENHOUSE_BASE_RISE_C = 6;
export const GREENHOUSE_FILM_RISE_C = 4;
export const GREENHOUSE_CO2_RISE_C = 1.5;
/** trapped = R / 이 값(덮개와 이산화 탄소를 모두 썼을 때의 R) */
export const GREENHOUSE_MAX_RISE_C = GREENHOUSE_BASE_RISE_C + GREENHOUSE_FILM_RISE_C + GREENHOUSE_CO2_RISE_C;
export const GREENHOUSE_DEFAULT_MIN = 20;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 오를 수 있는 최대 온도 차 R = 6 + (덮개 4) + (이산화 탄소 1.5) */
export const maxRiseOf = (p: Pick<GreenhouseParams, 'cover' | 'air'>) =>
  GREENHOUSE_BASE_RISE_C + (p.cover === 'film' ? GREENHOUSE_FILM_RISE_C : 0) + (p.air === 'co2' ? GREENHOUSE_CO2_RISE_C : 0);

/** 덮개 효과(°C)와 이산화 탄소 효과(°C) */
export const coverEffect = GREENHOUSE_FILM_RISE_C;
export const co2Effect = GREENHOUSE_CO2_RISE_C;

function checkParams(p: GreenhouseParams): void {
  if (!(COVER_KINDS as readonly string[]).includes(p.cover)) throw new RangeError(`덮개 ${String(p.cover)}은(는) ${COVER_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!(AIR_KINDS as readonly string[]).includes(p.air)) throw new RangeError(`병 속 공기 ${String(p.air)}은(는) ${AIR_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!(CAP_KINDS as readonly string[]).includes(p.cap)) throw new RangeError(`뚜껑 색 ${String(p.cap)}은(는) ${CAP_KINDS.join(', ')} 중 하나여야 합니다.`);
}

/**
 * 온실 모형 병의 온도 모델. 수치는 근사값이며 교사 검수 대상이다.
 * T(t) = 22 + R·(1 − e^(−t/6)), R = 6 + (덮개 4) + (이산화 탄소 1.5). 뚜껑 색은 계산에 쓰지 않는다. 난수 없음.
 */
export function simulateGreenhouse(params: GreenhouseParams, opts: GreenhouseOptions = {}): GreenhouseOutput {
  const { totalMin = GREENHOUSE_DEFAULT_MIN, sampleEveryMin = 0.1 } = opts;
  checkParams(params);
  if (!(totalMin > 0)) throw new RangeError(`관찰 시간 ${totalMin}분은 0보다 커야 합니다.`);
  if (!(sampleEveryMin > 0)) throw new RangeError(`표본 간격 ${sampleEveryMin}분은 0보다 커야 합니다.`);
  const R = maxRiseOf(params);
  const trapped = round(R / GREENHOUSE_MAX_RISE_C, 6);
  const riseAt = (t: number) => R * (1 - Math.exp(-t / GREENHOUSE_TAU_MIN));
  const steps = Math.max(1, Math.round(totalMin / sampleEveryMin));
  const samples: GreenhouseSample[] = [];
  for (let i = 0; i <= steps; i++) {
    // 마지막 표본은 정확히 totalMin이다.
    const t = i === steps ? totalMin : round((i * totalMin) / steps, 6);
    const rise = riseAt(t);
    samples.push({ t, temp: round(GREENHOUSE_START_C + rise, 6), rise: round(rise, 6), trapped });
  }
  const rawRise = riseAt(totalMin);
  const rawTemp = GREENHOUSE_START_C + rawRise;
  return {
    samples,
    // 오른 온도는 반올림 전 값에서 반올림한다. 표시하는 온도 − 22와 같다(테스트로 고정).
    result: { temp: round(rawTemp, 1), rise: round(rawRise, 1) },
    raw: { temp: rawTemp, rise: rawRise },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateGreenhouse(a: GreenhouseSample, b: GreenhouseSample, k: number): GreenhouseSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), temp: lerp(a.temp, b.temp), rise: lerp(a.rise, b.rise), trapped: lerp(a.trapped, b.trapped) };
}

const GREENHOUSE_KEYS = ['cover', 'air', 'cap'] as const;

/** 매니페스트의 온실 모형 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateGreenhouseExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const totalMin = exp.params?.totalMin;
  if (!(typeof totalMin === 'number' && totalMin > 0)) errors.push('params.totalMin은(는) 0보다 큰 수여야 합니다.');
  for (const key of GREENHOUSE_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    const kinds = key === 'cover' ? COVER_KINDS : key === 'air' ? AIR_KINDS : CAP_KINDS;
    for (const o of v.options) {
      if (typeof o.value !== 'string' || !(kinds as readonly string[]).includes(o.value)) {
        errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${kinds.join(', ')} 중 하나여야 합니다.`);
      }
    }
  }
  return errors;
}
