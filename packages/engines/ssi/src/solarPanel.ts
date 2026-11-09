import type { VariableExperiment as Experiment } from '@sci/schema';

export const WEATHER_KINDS = ['sunny', 'cloudy'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];
export const SHADE_KINDS = ['none', 'half'] as const;
export type ShadeKind = (typeof SHADE_KINDS)[number];
export const FRAME_KINDS = ['black', 'silver'] as const;
export type FrameKind = (typeof FRAME_KINDS)[number];

export interface SolarParams {
  /** 패널 기울기(°). 0 = 바닥에 눕힘 */
  tilt: number;
  weather: WeatherKind;
  /** 그늘: half = 패널 절반을 가림 */
  shade: ShadeKind;
  /** 패널 테두리 색: 계산에 쓰지 않는 대조 변인 */
  frame: FrameKind;
}

export interface SolarOptions {
  /** 발전하는 시간(초) */
  totalS?: number;
  sampleEveryS?: number;
  /** 태양 높이(°) */
  sunAltDeg?: number;
}

export interface SolarSample {
  /** 시간(초) */
  t: number;
  /** 만든 전기(mW), 반올림 전 */
  powerMw: number;
  /** 누적 프로펠러 회전수(번) */
  turns: number;
  /** 화면용: 날씨 세기 × cos(빛이 닿는 각) */
  light: number;
}

export interface SolarResult {
  /** 만든 전기(mW), 반올림 전 P에서 반올림 */
  power: number;
  /** 1분 동안 돈 횟수(번), 반올림 전 P·0.24에서 반올림 */
  turns: number;
}

export interface SolarOutput {
  samples: SolarSample[];
  result: SolarResult;
  /** 반올림 전 값 */
  raw: { power: number; turns: number };
}

/** 근사 모델이며 교사 검수 대상이다. */
export const SOLAR_MAX_MW = 500;
export const SOLAR_CLOUDY_LIGHT = 0.3;
/** 프로펠러가 1분 동안 도는 횟수 / 만든 전기: (번/분)/mW */
export const SOLAR_PROP_PER_MW = 0.24;
export const SOLAR_DEFAULT_TOTAL_S = 60;
export const SOLAR_DEFAULT_SUN_ALT_DEG = 60;
export const SOLAR_TILTS = [0, 30, 60] as const;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 빛이 닿는 각 inc = |90 − 태양 높이 − 기울기| (°) */
export const incidenceDeg = (tilt: number, sunAltDeg = SOLAR_DEFAULT_SUN_ALT_DEG) => Math.abs(90 - sunAltDeg - tilt);

/** 빛이 패널에 똑바로 닿는 정도 cos(inc) */
export const alignment = (tilt: number, sunAltDeg = SOLAR_DEFAULT_SUN_ALT_DEG) => Math.cos((incidenceDeg(tilt, sunAltDeg) * Math.PI) / 180);

function checkParams(p: SolarParams): void {
  if (!(typeof p.tilt === 'number' && Number.isFinite(p.tilt) && p.tilt >= 0 && p.tilt <= 90)) throw new RangeError(`기울기 ${String(p.tilt)}은(는) 0~90 사이여야 합니다.`);
  if (!(WEATHER_KINDS as readonly string[]).includes(p.weather)) throw new RangeError(`날씨 ${String(p.weather)}은(는) ${WEATHER_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!(SHADE_KINDS as readonly string[]).includes(p.shade)) throw new RangeError(`그늘 ${String(p.shade)}은(는) ${SHADE_KINDS.join(', ')} 중 하나여야 합니다.`);
  if (!(FRAME_KINDS as readonly string[]).includes(p.frame)) throw new RangeError(`테두리 ${String(p.frame)}은(는) ${FRAME_KINDS.join(', ')} 중 하나여야 합니다.`);
}

/**
 * 태양광 패널 발전 모델. 수치는 근사값이며 교사 검수 대상이다.
 * P = 500·I·cos(inc)·(그늘 절반이면 0.5), inc = |90 − 태양 높이 − 기울기|, I = 맑음 1 / 흐림 0.3.
 * turns(t) = P·0.24·t/60(시작 가속 없음). 테두리 색은 계산에 쓰지 않는다. 난수 없음.
 */
export function simulateSolar(params: SolarParams, opts: SolarOptions = {}): SolarOutput {
  const { totalS = SOLAR_DEFAULT_TOTAL_S, sampleEveryS = 0.5, sunAltDeg = SOLAR_DEFAULT_SUN_ALT_DEG } = opts;
  checkParams(params);
  if (!(totalS > 0)) throw new RangeError(`발전 시간 ${totalS}초는 0보다 커야 합니다.`);
  if (!(sampleEveryS > 0)) throw new RangeError(`표본 간격 ${sampleEveryS}초는 0보다 커야 합니다.`);
  const intensity = params.weather === 'cloudy' ? SOLAR_CLOUDY_LIGHT : 1;
  const light = intensity * alignment(params.tilt, sunAltDeg);
  const P = SOLAR_MAX_MW * light * (params.shade === 'half' ? 0.5 : 1);
  const turnsAt = (t: number) => (P * SOLAR_PROP_PER_MW * t) / 60;
  const steps = Math.max(1, Math.round(totalS / sampleEveryS));
  const samples: SolarSample[] = [];
  for (let i = 0; i <= steps; i++) {
    // 마지막 표본은 정확히 totalS이다.
    const t = i === steps ? totalS : round((i * totalS) / steps, 6);
    samples.push({ t, powerMw: P, turns: turnsAt(t), light });
  }
  const rawTurns = P * SOLAR_PROP_PER_MW;
  return {
    samples,
    result: { power: Math.round(P), turns: Math.round(rawTurns) },
    raw: { power: P, turns: rawTurns },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateSolar(a: SolarSample, b: SolarSample, k: number): SolarSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), powerMw: lerp(a.powerMw, b.powerMw), turns: lerp(a.turns, b.turns), light: lerp(a.light, b.light) };
}

const CHOICE_KINDS = { weather: WEATHER_KINDS, shade: SHADE_KINDS, frame: FRAME_KINDS } as const;
const SOLAR_KEYS = ['tilt', 'weather', 'shade', 'frame'] as const;

/** 매니페스트의 태양광 패널 실험이 모델이 다룰 수 있는 범위인지 검사한다. tilt는 0~90. */
export function validateSolarExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const totalS = exp.params?.totalS;
  if (!(typeof totalS === 'number' && totalS > 0)) errors.push('params.totalS은(는) 0보다 큰 수여야 합니다.');
  const alt = exp.params?.sunAltDeg;
  if (alt !== undefined && !(typeof alt === 'number' && alt >= 0 && alt <= 90)) errors.push('params.sunAltDeg은(는) 0~90 사이의 수여야 합니다.');
  for (const key of SOLAR_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (key === 'tilt') {
        if (typeof o.value !== 'number' || !(o.value >= 0 && o.value <= 90)) errors.push(`변인 "tilt"의 선택지 값 ${JSON.stringify(o.value)}: 0~90 사이의 수여야 합니다.`);
      } else {
        const kinds = CHOICE_KINDS[key];
        if (typeof o.value !== 'string' || !(kinds as readonly string[]).includes(o.value)) {
          errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${kinds.join(', ')} 중 하나여야 합니다.`);
        }
      }
    }
  }
  return errors;
}
