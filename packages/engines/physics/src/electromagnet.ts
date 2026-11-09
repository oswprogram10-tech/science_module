import type { VariableExperiment as Experiment } from '@sci/schema';

export type BatteryKind = 'one' | 'series' | 'parallel';
export type CoreKind = 'nail' | 'straw';
export type DirectionKind = 'forward' | 'reverse';
export type PoleKind = 'N' | 'S';

export interface ElectromagnetParams {
  turns: number;
  battery: BatteryKind;
  core: CoreKind;
  direction: DirectionKind;
}

export interface ElectromagnetOptions {
  durationS?: number;
  /** 스위치를 켜는 시각(초). */
  onS?: number;
  /** 스위치를 끄는 시각(초). */
  offS?: number;
  sampleEvery?: number;
  roomC?: number;
  /** 최대 클립 수 = floor(감은 횟수 × I × 속 재료 계수 / clipDivisor). */
  clipDivisor?: number;
  /** 철못이 없을 때(빨대만)의 세기 계수. */
  airCore?: number;
  /** 클립이 붙는 데 걸리는 시간 상수(초). */
  attachTauS?: number;
  /** 에나멜선 온도 상승 = heatGain × P. */
  heatGain?: number;
  /** 에나멜선이 데워지고 식는 시간 상수(초). */
  heatTauS?: number;
  hotC?: number;
}

export interface ElectromagnetSample {
  t: number;
  /** 붙은 클립 수(연속값, 표시는 반올림) */
  clips: number;
  wireC: number;
  /** 흐르는 정도(켜져 있으면 I, 아니면 0) */
  flow: number;
  /** 스위치가 켜져 있으면 1, 아니면 0(보간할 수 있게 숫자) */
  on: number;
}

export interface ElectromagnetResult {
  clipsMax: number;
  headPole: PoleKind;
  /** 에나멜선 최고 온도(°C), 소수 첫째 자리 */
  wireMaxC: number;
  hot: boolean;
}

export interface ElectromagnetOutput {
  samples: ElectromagnetSample[];
  result: ElectromagnetResult;
}

export const BATTERIES: readonly BatteryKind[] = ['one', 'series', 'parallel'];
export const CORES: readonly CoreKind[] = ['nail', 'straw'];
export const DIRECTIONS: readonly DirectionKind[] = ['forward', 'reverse'];

/** 에나멜선이 뜨겁다고 알려 주는 온도(°C). */
export const HOT_C = 40;
/** 실험 전 센서가 보여 주는 에나멜선의 온도(°C). */
export const ROOM_C = 20;

/** 못 머리 쪽의 극: 처음 방향이면 N, 반대 방향이면 S. */
export const headPoleOf = (direction: DirectionKind): PoleKind => (direction === 'forward' ? 'N' : 'S');

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: ElectromagnetParams): void {
  if (typeof p.turns !== 'number' || !Number.isFinite(p.turns) || p.turns < 10 || p.turns > 500) {
    throw new RangeError(`감은 횟수 ${String(p.turns)}은(는) 10 이상 500 이하의 수여야 합니다.`);
  }
  if (!BATTERIES.includes(p.battery)) throw new RangeError(`전지 연결 ${String(p.battery)}은(는) one, series, parallel 중 하나여야 합니다.`);
  if (!CORES.includes(p.core)) throw new RangeError(`속에 넣은 것 ${String(p.core)}은(는) nail, straw 중 하나여야 합니다.`);
  if (!DIRECTIONS.includes(p.direction)) throw new RangeError(`전지 방향 ${String(p.direction)}은(는) forward, reverse 중 하나여야 합니다.`);
}

/**
 * 전자석 모델. 수치는 근사값이며 교사 검수 대상이다.
 * 코일 저항 R = 0.5 + 감은 횟수 × 0.01, 전지 1.5(직렬은 2배, 병렬은 1배), I = 전압 / R.
 * 최대 클립 수 = floor(감은 횟수 × I × 속 재료 계수 / clipDivisor).
 * 에나멜선 온도 = 실내 + heatGain × I²R × (1 − e^(−(t−onS)/τ)), 끈 뒤에는 같은 τ로 식는다.
 */
export function simulateElectromagnet(params: ElectromagnetParams, opts: ElectromagnetOptions = {}): ElectromagnetOutput {
  const {
    durationS = 20,
    onS = 2,
    offS = 14,
    sampleEvery = 0.25,
    roomC = ROOM_C,
    clipDivisor = 8,
    airCore = 0.05,
    attachTauS = 0.3,
    heatGain = 4,
    heatTauS = 8,
    hotC = HOT_C,
  } = opts;
  checkParams(params);
  if (!(durationS > 0) || !(sampleEvery > 0)) throw new RangeError('시간과 표본 간격은 0보다 커야 합니다.');
  if (!(attachTauS > 0) || !(heatTauS > 0)) throw new RangeError('시간 상수는 0보다 커야 합니다.');
  if (!(onS >= 0) || !(offS > onS) || !(offS <= durationS)) throw new RangeError('켜는 시각과 끄는 시각이 올바르지 않습니다.');

  const resistance = 0.5 + params.turns * 0.01;
  const cells = params.battery === 'series' ? 2 : 1;
  const current = (1.5 * cells) / resistance;
  const clipsMax = Math.floor((params.turns * current * (params.core === 'nail' ? 1 : airCore)) / clipDivisor + 1e-9);
  const power = current * current * resistance;
  const riseC = heatGain * power;

  /** offS 직전에 넣는 표본의 시각: 끊기는 순간(과 그 직전의 최고 상태)을 놓치지 않게 한다. */
  const BEFORE_OFF_S = 1e-3;

  const at = (t: number): ElectromagnetSample => {
    const on = t >= onS && t < offS;
    let clips = 0;
    let wireC = roomC;
    if (on) {
      clips = clipsMax * (1 - Math.exp(-(t - onS) / attachTauS));
      wireC = roomC + riseC * (1 - Math.exp(-(t - onS) / heatTauS));
    } else if (t >= offS) {
      const atOff = roomC + riseC * (1 - Math.exp(-(offS - onS) / heatTauS));
      wireC = roomC + (atOff - roomC) * Math.exp(-(t - offS) / heatTauS);
    }
    return { t: round(t, 6), clips, wireC, flow: on ? current : 0, on: on ? 1 : 0 };
  };

  const times: number[] = [];
  const steps = Math.floor(durationS / sampleEvery + 1e-9);
  for (let i = 0; i <= steps; i++) times.push(round(i * sampleEvery, 6));
  if (times[times.length - 1]! < durationS - 1e-9) times.push(durationS);
  for (const extra of [offS - BEFORE_OFF_S, offS]) {
    const r = round(extra, 6);
    if (!times.some((x) => Math.abs(x - r) < 1e-9)) times.push(r);
  }
  times.sort((a, b) => a - b);

  const samples = times.map(at);
  const wireMax = Math.max(...samples.map((s) => s.wireC));
  return {
    samples,
    result: {
      clipsMax,
      headPole: headPoleOf(params.direction),
      wireMaxC: round(wireMax, 1),
      hot: wireMax >= hotC,
    },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateElectromagnet(a: ElectromagnetSample, b: ElectromagnetSample, k: number): ElectromagnetSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), clips: lerp(a.clips, b.clips), wireC: lerp(a.wireC, b.wireC), flow: lerp(a.flow, b.flow), on: lerp(a.on, b.on) };
}

const KEYS = ['turns', 'battery', 'core', 'direction'] as const;

/** 매니페스트의 전자석 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateElectromagnetExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const allowed: Record<string, readonly string[]> = { battery: BATTERIES, core: CORES, direction: DIRECTIONS };
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'turns') {
        if (typeof val !== 'number' || !Number.isFinite(val)) bad('숫자여야 합니다.');
        else if (val < 10 || val > 500) bad('감은 횟수는 10~500회 범위여야 합니다.');
      } else if (typeof val !== 'string' || !allowed[key]!.includes(val)) {
        bad(`${allowed[key]!.join(', ')} 중 하나여야 합니다.`);
      }
    }
  }
  return errors;
}
