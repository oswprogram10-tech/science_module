import type { VariableExperiment as Experiment } from '@sci/schema';

export const PT_OBJECTS = ['bike', 'walker', 'snail', 'tree'] as const;
export type PtObject = (typeof PT_OBJECTS)[number];
export const PT_WATCH_S = [5, 10] as const;
export const PT_WEATHER = ['sunny', 'cloudy'] as const;
export type PtWeather = (typeof PT_WEATHER)[number];

/** 물체의 빠르기(m/s): 자전거 4, 걷는 사람 1.2, 달팽이 0.01, 나무 0(움직이지 않는다). 수치는 근사값이며 교사 검수 대상이다. */
export const PT_SPEED_MS: Record<PtObject, number> = { bike: 4, walker: 1.2, snail: 0.01, tree: 0 };

/** 출발 위치(m): 모든 물체가 0에서 시작한다. */
export const PT_START_M = 0;
/** 섬광(다중 노출) 간격(초) */
export const PT_FLASH_S = 1;
/** 샘플 간격(초) */
export const PT_SAMPLE_S = 0.25;
/** 예측 비교에서 같은 결과로 보는 거리 차(m). 결과를 소수 둘째 자리로 쓰므로 한 칸의 절반이다. */
export const PT_SAME_M = 0.005;

export interface PositionTimeParams {
  object: PtObject;
  /** 관찰 시간(초) */
  watchS: number;
  /** 날씨: 계산에 쓰지 않는 대조 변인 */
  weather: PtWeather;
}

export interface PositionTimeSample {
  /** 초 */
  t: number;
  /** 출발 위치에서 얼마나 떨어져 있는가(m). 위치 = 출발 위치 0 + 이동한 거리 */
  posM: number;
}

export interface PositionTimeResult {
  /** 관찰하는 동안 움직인 거리(m), 소수 둘째 자리 */
  distM: number;
  /** 나중 위치(m), 소수 둘째 자리. 출발 위치가 0이다. */
  endM: number;
}

export interface PositionTimeOutput {
  samples: PositionTimeSample[];
  result: PositionTimeResult;
}

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: PositionTimeParams): void => {
  if (!(PT_OBJECTS as readonly string[]).includes(p.object)) throw new RangeError(`보는 물체 ${String(p.object)}은(는) ${PT_OBJECTS.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.watchS !== 'number' || !(PT_WATCH_S as readonly number[]).includes(p.watchS)) throw new RangeError(`관찰 시간 ${String(p.watchS)}은(는) ${PT_WATCH_S.join(', ')}초 중 하나여야 합니다.`);
  if (!(PT_WEATHER as readonly string[]).includes(p.weather)) throw new RangeError(`날씨 ${String(p.weather)}은(는) ${PT_WEATHER.join(', ')} 중 하나여야 합니다.`);
};

/** t초 때의 위치(m) = 출발 위치 + 빠르기 × 시간. 날씨는 쓰지 않는다. */
export const positionAt = (object: PtObject, t: number): number => roundTo(PT_START_M + PT_SPEED_MS[object] * t, 6);

/** 1초 간격 섬광의 위치(m): 0초부터 관찰 시간까지 */
export function flashPositions(object: PtObject, watchS: number): { t: number; posM: number }[] {
  const out: { t: number; posM: number }[] = [];
  for (let t = 0; t <= watchS + 1e-9; t += PT_FLASH_S) out.push({ t: roundTo(t, 6), posM: positionAt(object, t) });
  return out;
}

/**
 * 시간에 따른 위치 변화. 물체의 빠르기는 일정하다(위치 = 빠르기 × 시간). 난수 없음.
 * 0초부터 관찰 시간까지 0.25초 간격으로 위치를 잰다.
 */
export function simulatePositionTime(params: PositionTimeParams): PositionTimeOutput {
  checkParams(params);
  const steps = Math.round(params.watchS / PT_SAMPLE_S);
  const samples: PositionTimeSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * PT_SAMPLE_S, 6);
    samples.push({ t, posM: positionAt(params.object, t) });
  }
  const end = positionAt(params.object, params.watchS);
  return { samples, result: { distM: roundTo(end - PT_START_M, 2), endM: roundTo(end, 2) } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolatePositionTime(a: PositionTimeSample, b: PositionTimeSample, k: number): PositionTimeSample {
  return { t: a.t + (b.t - a.t) * k, posM: a.posM + (b.posM - a.posM) * k };
}

const KEYS = ['object', 'watchS', 'weather'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly (string | number)[]> = { object: PT_OBJECTS, watchS: PT_WATCH_S, weather: PT_WEATHER };

/** 매니페스트의 시간에 따른 위치 변화 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validatePositionTimeExperiment(exp: Experiment): string[] {
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
