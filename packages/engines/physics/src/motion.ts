import type { VariableExperiment as Experiment } from '@sci/schema';

export type FloorKind = 'wood' | 'towel';
export type CartLoad = 0 | 2;

export interface RampParams {
  /** 수레를 놓는 높이(cm) */
  heightCm: number;
  /** 바닥 */
  floor: FloorKind;
  /** 수레에 실은 추의 수(개). 계산에는 쓰지 않는다(대조 변인). */
  load: CartLoad;
}

export interface RampOptions {
  /** 전체 시간(초) */
  durationS?: number;
  sampleEveryS?: number;
}

export interface RampSample {
  t: number;
  /** 출발선에서의 거리(m). 1.5 m 멈춤 벽을 넘지 않는다. */
  x: number;
  /** 그 순간의 빠르기(m/s). 화면용이며 멈춤 벽에 닿은 뒤에는 0이다. */
  v: number;
}

export interface RampResult {
  /** 1 m 가는 데 걸린 시간(초), 소수 둘째 자리 */
  timeS: number;
  /** 속력(m/s) = 1 ÷ timeS(반올림한 값), 소수 둘째 자리 */
  speed: number;
}

export interface RampOutput {
  samples: RampSample[];
  result: RampResult;
}

export const FLOORS: readonly FloorKind[] = ['wood', 'towel'];
export const LOADS: readonly CartLoad[] = [0, 2];

const G = 9.8;
/** 경사면에서 잃는 몫을 뺀 나머지 */
const RAMP_KEEP = 0.9;
/** 도착선까지의 거리(m) */
export const FINISH_M = 1;
/** 멈춤 벽의 위치(m) */
export const WALL_M = 1.5;
export const MIN_HEIGHT_CM = 5;
export const MAX_HEIGHT_CM = 50;
const MU: Record<FloorKind, number> = { wood: 0.02, towel: 0.06 };

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** 출발선을 지나는 빠르기 v0(m/s) */
export const startSpeed = (heightCm: number): number => Math.sqrt(2 * G * (heightCm / 100) * RAMP_KEEP);
/** 바닥의 감속 a(m/s²) */
export const decel = (floor: FloorKind): number => MU[floor] * G;

/** 이 조건으로 1 m에 닿을 수 있는지(v0² ≥ 2a) */
export const reaches1m = (heightCm: number, floor: FloorKind): boolean => startSpeed(heightCm) ** 2 >= 2 * decel(floor) * FINISH_M;

function checkParams(p: RampParams): void {
  if (typeof p.heightCm !== 'number' || !Number.isFinite(p.heightCm) || p.heightCm < MIN_HEIGHT_CM || p.heightCm > MAX_HEIGHT_CM) {
    throw new RangeError(`출발 높이 ${String(p.heightCm)}은(는) ${MIN_HEIGHT_CM} 이상 ${MAX_HEIGHT_CM} 이하(cm)여야 합니다.`);
  }
  if (!FLOORS.includes(p.floor)) throw new RangeError(`바닥 ${String(p.floor)}은(는) wood, towel 중 하나여야 합니다.`);
  if (!LOADS.includes(p.load)) throw new RangeError(`수레에 실은 추 ${String(p.load)}은(는) 0, 2 중 하나여야 합니다.`);
  if (!reaches1m(p.heightCm, p.floor)) throw new RangeError(`출발 높이 ${p.heightCm} cm, 바닥 ${p.floor}에서는 수레가 1 m에 닿지 못합니다.`);
}

/** 1 m 도착 시각(초, 반올림 전): (v0 − √(v0² − 2a)) / a */
export function arrivalS(p: Pick<RampParams, 'heightCm' | 'floor'>): number {
  const v0 = startSpeed(p.heightCm);
  const a = decel(p.floor);
  return (v0 - Math.sqrt(v0 * v0 - 2 * a * FINISH_M)) / a;
}

/**
 * 경사면 수레 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 출발선 빠르기 v0 = √(2·9.8·h·0.9), 바닥 감속 a = μ·9.8 (나무 0.02, 수건 0.06).
 * x(t) = min(1.5, v0·t − ½·a·t²). 추의 수는 계산에 쓰지 않는다.
 * 걸린 시간 = 1 m 도착 시각을 소수 둘째 자리로 반올림, 속력 = 1 ÷ (반올림한 걸린 시간)을 소수 둘째 자리로 반올림.
 */
export function simulateRamp(params: RampParams, opts: RampOptions = {}): RampOutput {
  const { durationS = 1.2, sampleEveryS = 0.01 } = opts;
  checkParams(params);
  if (!(durationS > 0) || !(sampleEveryS > 0)) throw new RangeError('시간과 표본 간격은 0보다 커야 합니다.');

  const v0 = startSpeed(params.heightCm);
  const a = decel(params.floor);
  const stopT = v0 / a;
  const at = (t: number): RampSample => {
    const tt = Math.min(t, stopT);
    const free = v0 * tt - 0.5 * a * tt * tt;
    const hitWall = free >= WALL_M;
    return {
      t: round(t, 6),
      x: Math.min(WALL_M, free),
      v: hitWall ? 0 : Math.max(0, v0 - a * tt),
    };
  };

  const steps = Math.floor(durationS / sampleEveryS + 1e-9);
  const samples: RampSample[] = [];
  for (let i = 0; i <= steps; i++) samples.push(at(round(i * sampleEveryS, 6)));
  if (samples[samples.length - 1]!.t < durationS - 1e-9) samples.push(at(durationS));

  const timeS = round(arrivalS(params), 2);
  return { samples, result: { timeS, speed: round(1 / timeS, 2) } };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateRamp(a: RampSample, b: RampSample, k: number): RampSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), x: lerp(a.x, b.x), v: lerp(a.v, b.v) };
}

const KEYS = ['heightCm', 'floor', 'load'] as const;

/** 매니페스트의 경사면 수레 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateRampExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'heightCm') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < MIN_HEIGHT_CM || val > MAX_HEIGHT_CM) bad(`출발 높이는 ${MIN_HEIGHT_CM}~${MAX_HEIGHT_CM} cm 범위여야 합니다.`);
      } else if (key === 'floor') {
        if (typeof val !== 'string' || !FLOORS.includes(val as FloorKind)) bad(`${FLOORS.join(', ')} 중 하나여야 합니다.`);
      } else if (val !== 0 && val !== 2) {
        bad('0 또는 2여야 합니다.');
      }
    }
  }
  // 높이 × 바닥 조합이 모두 1 m에 닿아야 한다.
  const heights = exp.variables.find((x) => x.key === 'heightCm')?.options.map((o) => o.value) ?? [];
  const floors = exp.variables.find((x) => x.key === 'floor')?.options.map((o) => o.value) ?? [];
  for (const h of heights) {
    for (const f of floors) {
      if (typeof h === 'number' && h >= MIN_HEIGHT_CM && h <= MAX_HEIGHT_CM && FLOORS.includes(f as FloorKind) && !reaches1m(h, f as FloorKind)) {
        errors.push(`출발 높이 ${h} cm, 바닥 ${String(f)}: 수레가 1 m에 닿지 못합니다.`);
      }
    }
  }
  return errors;
}
