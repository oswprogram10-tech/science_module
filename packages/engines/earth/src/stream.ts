import type { VariableExperiment as Experiment } from '@sci/schema';

export const SLOPES = ['gentle', 'steep'] as const;
export type SlopeKind = (typeof SLOPES)[number];
export const VESSELS = ['cup', 'bottle'] as const;
export type VesselKind = (typeof VESSELS)[number];

export interface StreamParams {
  slope: SlopeKind;
  /** 흘려보내는 물의 양(L) */
  waterL: number;
  /** 물을 붓는 그릇: 계산에 쓰지 않는 대조 변인 */
  vessel: VesselKind;
}

export interface StreamOptions {
  /** 관찰하는 시간(초) */
  totalS?: number;
  sampleEveryS?: number;
}

export interface StreamSample {
  t: number;
  /** 깎인 흙의 누적(g) */
  eroded: number;
  /** 쌓인 흙의 누적(g) */
  deposited: number;
  /** 물 흐름 빠르기(화면용). 붓는 동안 일정하고, 붓기가 끝나면 2초 동안 0으로 줄어든다. */
  flow: number;
  pouring: boolean;
}

export interface StreamResult {
  /** 깎인 흙(g), 정수 */
  eroded: number;
  /** 쌓인 흙(g), 정수 */
  deposited: number;
}

export interface StreamOutput {
  samples: StreamSample[];
  result: StreamResult;
}

/** 물을 붓는 빠르기(L/s). 그릇이 달라도 같다. */
export const POUR_L_PER_S = 0.05;
/** 깎이는 빠르기(g/s) (근사값, 교사 검수 대상) */
export const ERODE_RATE: Record<SlopeKind, number> = { gentle: 1.0, steep: 2.5 };
/** 물 흐름 빠르기(화면용) */
export const FLOW_SPEED: Record<SlopeKind, number> = { gentle: 0.4, steep: 1.0 };
/** 깎인 흙 가운데 아래쪽 평평한 곳에 쌓이는 비율(나머지는 물받이로 흘러 나간다) */
export const DEPOSIT_RATIO = 0.8;
/** 깎인 흙이 아래까지 가는 데 걸리는 시간(초) */
export const DELAY_S = 2;
export const WATER_MIN_L = 0.5;
export const WATER_MAX_L = 2.5;
export const DEFAULT_TOTAL_S = 60;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

/** 붓는 시간 T(초) = 물의 양 / 0.05 */
export const pourSeconds = (waterL: number) => round(waterL / POUR_L_PER_S, 6);

function checkParams(p: StreamParams): void {
  if (!(SLOPES as readonly string[]).includes(p.slope)) throw new RangeError(`기울기 ${String(p.slope)}은(는) ${SLOPES.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.waterL !== 'number' || !Number.isFinite(p.waterL) || p.waterL < WATER_MIN_L || p.waterL > WATER_MAX_L) {
    throw new RangeError(`물의 양 ${String(p.waterL)}은(는) ${WATER_MIN_L}~${WATER_MAX_L} L여야 합니다.`);
  }
  if (!(VESSELS as readonly string[]).includes(p.vessel)) throw new RangeError(`그릇 ${String(p.vessel)}은(는) ${VESSELS.join(', ')} 중 하나여야 합니다.`);
}

/** 깎인 흙의 누적 E(t) */
export const erodedAt = (slope: SlopeKind, waterL: number, t: number) => ERODE_RATE[slope] * Math.min(t, pourSeconds(waterL));
/** 쌓인 흙의 누적 D(t): 2초 늦게 쌓이기 시작한다. 끝값은 0.8·E이다. */
export const depositedAt = (slope: SlopeKind, waterL: number, t: number) =>
  DEPOSIT_RATIO * ERODE_RATE[slope] * Math.max(0, Math.min(t, pourSeconds(waterL) + DELAY_S) - DELAY_S);
/** 물 흐름 빠르기: 붓는 동안 일정, 붓기가 끝나면 2초 동안 0으로 줄어든다. */
export function flowAt(slope: SlopeKind, waterL: number, t: number): number {
  const T = pourSeconds(waterL);
  const f = FLOW_SPEED[slope];
  if (t < T) return f;
  return f * Math.max(0, 1 - (t - T) / DELAY_S);
}

/**
 * 흐르는 물 모델. 수치는 근사값이며 교사 검수 대상이다.
 * T = waterL / 0.05, E = r·min(t, T), D = 0.8·r·max(0, min(t, T + 2) − 2). 그릇은 계산에 쓰지 않는다. 난수 없음.
 */
export function simulateStream(params: StreamParams, opts: StreamOptions = {}): StreamOutput {
  const { totalS = DEFAULT_TOTAL_S, sampleEveryS = 0.5 } = opts;
  checkParams(params);
  const T = pourSeconds(params.waterL);
  if (!(totalS >= T + DELAY_S)) throw new RangeError(`관찰 시간 ${totalS}초는 붓는 시간 ${T}초에 ${DELAY_S}초를 더한 값 이상이어야 합니다.`);
  const steps = Math.round(totalS / sampleEveryS);
  const samples: StreamSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = round(i * sampleEveryS, 6);
    samples.push({
      t,
      eroded: round(erodedAt(params.slope, params.waterL, t), 6),
      deposited: round(depositedAt(params.slope, params.waterL, t), 6),
      flow: round(flowAt(params.slope, params.waterL, t), 6),
      pouring: t < T,
    });
  }
  const last = samples[samples.length - 1]!;
  return { samples, result: { eroded: Math.round(last.eroded), deposited: Math.round(last.deposited) } };
}

/** 두 샘플 사이를 선형 보간한다. 붓는 중인지는 k < 1이면 앞 샘플의 것을 따른다. */
export function interpolateStream(a: StreamSample, b: StreamSample, k: number): StreamSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    eroded: lerp(a.eroded, b.eroded),
    deposited: lerp(a.deposited, b.deposited),
    flow: lerp(a.flow, b.flow),
    pouring: k < 1 ? a.pouring : b.pouring,
  };
}

const STREAM_KEYS = ['slope', 'waterL', 'vessel'] as const;

/** 매니페스트의 흐르는 물 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateStreamExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const total = exp.params?.totalS;
  const totalOk = typeof total === 'number' && Number.isFinite(total) && total > 0;
  if (!totalOk) errors.push('params.totalS은(는) 0보다 큰 숫자여야 합니다.');
  for (const key of STREAM_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'slope') {
        if (typeof val !== 'string' || !(SLOPES as readonly string[]).includes(val)) bad(`${SLOPES.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'vessel') {
        if (typeof val !== 'string' || !(VESSELS as readonly string[]).includes(val)) bad(`${VESSELS.join(', ')} 중 하나여야 합니다.`);
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        bad('숫자여야 합니다.');
      } else if (val < WATER_MIN_L || val > WATER_MAX_L) {
        bad(`물의 양은 ${WATER_MIN_L}~${WATER_MAX_L} L 범위여야 합니다.`);
      } else if (totalOk && pourSeconds(val) + DELAY_S > total) {
        bad(`붓는 시간 ${pourSeconds(val)}초에 ${DELAY_S}초를 더한 값이 params.totalS(${total}초)보다 길어요.`);
      }
    }
  }
  return errors;
}
