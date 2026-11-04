import type { VariableExperiment as Experiment } from '@sci/schema';

export type WrapKind = 'none' | 'paper' | 'cotton' | 'bubble' | 'foil';
export type LidKind = 'on' | 'off';

export interface InsulatedCupParams {
  wrap: WrapKind;
  layers: 1 | 2;
  lid: LidKind;
  waterMl: number;
}

export interface InsulatedCupOptions {
  startC?: number;
  roomC?: number;
  durationS?: number;
  sampleEvery?: number;
}

export interface InsulatedCupSample {
  t: number;
  waterC: number;
  /** 컵 옆면 바깥 온도 */
  surfaceSideC: number;
  /** 컵 윗면 온도 */
  surfaceTopC: number;
  /** 옆면으로 빠져나가는 열(W) */
  lossSideW: number;
  /** 윗면으로 빠져나가는 열(W) */
  lossTopW: number;
}

export interface InsulatedCupResult {
  endC: number;
  dropC: number;
  /** t=0일 때 옆면 바깥 온도 */
  surfaceSideStartC: number;
}

export interface InsulatedCupOutput {
  samples: InsulatedCupSample[];
  result: InsulatedCupResult;
}

export const WRAPS: readonly WrapKind[] = ['none', 'paper', 'cotton', 'bubble', 'foil'];

/** 물 1 mL의 열용량(J/K). */
export const WATER_J_PER_ML_K = 4.18;
/** 물 200 mL일 때 컵 옆면 넓이(m²). 물이 닿은 높이만 따진다. */
export const SIDE_AREA_200ML_M2 = 0.0198;
export const TOP_AREA_M2 = 0.0038;
/** 바깥 공기 열전달 계수(W/m²K). */
export const H_AIR = 10;
/** 포일 겉면의 열전달 계수(복사를 막는 효과를 근사). */
export const H_FOIL = 6;
/** 재료 1겹당 열저항(m²K/W). */
export const LAYER_R: Record<WrapKind, number> = { none: 0, paper: 0.002, cotton: 0.125, bubble: 0.1, foil: 0.02 };
/** 뚜껑의 열저항(m²K/W). */
export const LID_R = 0.05;
/** 뚜껑이 없을 때 윗면 U(W/m²K). 김이 나며 빠져나가는 열까지 포함한 근사. */
export const U_TOP_OPEN = 25;

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function checkParams(p: InsulatedCupParams): void {
  if (!WRAPS.includes(p.wrap)) throw new RangeError(`감싸는 재료 ${String(p.wrap)}은(는) 알 수 없는 값입니다.`);
  if (!Number.isInteger(p.layers) || p.layers < 1 || p.layers > 3) {
    throw new RangeError(`겹 수 ${String(p.layers)}은(는) 1~3의 정수여야 합니다.`);
  }
  if (p.lid !== 'on' && p.lid !== 'off') throw new RangeError(`뚜껑 ${String(p.lid)}은(는) on, off 중 하나여야 합니다.`);
  if (typeof p.waterMl !== 'number' || !Number.isFinite(p.waterMl) || p.waterMl < 50 || p.waterMl > 500) {
    throw new RangeError(`물의 양 ${String(p.waterMl)}은(는) 50 이상 500 이하의 수여야 합니다.`);
  }
}

/**
 * 뜨거운 물이 담긴 컵의 식는 모습. 뉴턴 냉각 법칙의 해석해를 쓴다.
 * UA = A_side / R_side + A_top × U_top, τ = C / UA, waterC(t) = roomC + (startC - roomC)·e^(-t/τ).
 * 수치는 근사값이며 교사 검수 대상이다.
 */
export function simulateInsulatedCup(params: InsulatedCupParams, opts: InsulatedCupOptions = {}): InsulatedCupOutput {
  const { startC = 60, roomC = 20, durationS = 600, sampleEvery = 5 } = opts;
  checkParams(params);
  if (!(startC > roomC)) throw new RangeError('처음 물의 온도는 실내 온도보다 높아야 합니다.');
  if (!(durationS > 0) || !(sampleEvery > 0)) throw new RangeError('시간과 표본 간격은 0보다 커야 합니다.');

  const capacity = params.waterMl * WATER_J_PER_ML_K;
  const aSide = SIDE_AREA_200ML_M2 * (params.waterMl / 200);
  const hSide = params.wrap === 'foil' ? H_FOIL : H_AIR;
  const layers = params.wrap === 'none' ? 0 : params.layers;
  const rSide = 1 / hSide + layers * LAYER_R[params.wrap];
  const lidOn = params.lid === 'on';
  const uTop = lidOn ? 1 / (1 / H_AIR + LID_R) : U_TOP_OPEN;
  const ua = aSide / rSide + TOP_AREA_M2 * uTop;
  const tau = capacity / ua;
  const sideShare = 1 / hSide / rSide;
  const topShare = 1 / H_AIR / (1 / H_AIR + LID_R);

  const at = (t: number): InsulatedCupSample => {
    const waterC = roomC + (startC - roomC) * Math.exp(-t / tau);
    const dT = waterC - roomC;
    return {
      t: round(t, 6),
      waterC,
      surfaceSideC: roomC + dT * sideShare,
      surfaceTopC: lidOn ? roomC + dT * topShare : waterC,
      lossSideW: (dT * aSide) / rSide,
      lossTopW: dT * TOP_AREA_M2 * uTop,
    };
  };

  const samples: InsulatedCupSample[] = [];
  const steps = Math.floor(durationS / sampleEvery + 1e-9);
  for (let i = 0; i <= steps; i++) samples.push(at(i * sampleEvery));
  if (samples[samples.length - 1]!.t < durationS - 1e-9) samples.push(at(durationS));

  const end = samples[samples.length - 1]!;
  return {
    samples,
    result: {
      endC: round(end.waterC, 1),
      dropC: round(startC - end.waterC, 1),
      surfaceSideStartC: round(samples[0]!.surfaceSideC, 1),
    },
  };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateInsulatedCup(a: InsulatedCupSample, b: InsulatedCupSample, k: number): InsulatedCupSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t: lerp(a.t, b.t),
    waterC: lerp(a.waterC, b.waterC),
    surfaceSideC: lerp(a.surfaceSideC, b.surfaceSideC),
    surfaceTopC: lerp(a.surfaceTopC, b.surfaceTopC),
    lossSideW: lerp(a.lossSideW, b.lossSideW),
    lossTopW: lerp(a.lossTopW, b.lossTopW),
  };
}

const INSULATED_CUP_KEYS = ['wrap', 'layers', 'lid', 'waterMl'] as const;

/** 매니페스트의 보온 컵 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateInsulatedCupExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of INSULATED_CUP_KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      const val = o.value;
      const bad = (why: string) => errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(val)}: ${why}`);
      if (key === 'wrap') {
        if (typeof val !== 'string' || !WRAPS.includes(val as WrapKind)) bad(`${WRAPS.join(', ')} 중 하나여야 합니다.`);
      } else if (key === 'layers') {
        if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 3) bad('1~3의 정수여야 합니다.');
      } else if (key === 'lid') {
        if (val !== 'on' && val !== 'off') bad('on, off 중 하나여야 합니다.');
      } else if (typeof val !== 'number' || !Number.isFinite(val)) {
        bad('숫자여야 합니다.');
      } else if (val < 50 || val > 500) {
        bad('물의 양은 50~500 mL 범위여야 합니다.');
      }
    }
  }
  const start = exp.params?.startC;
  const room = exp.params?.roomC;
  if (typeof start !== 'number' || !Number.isFinite(start) || typeof room !== 'number' || !Number.isFinite(room)) {
    errors.push('params.startC와 params.roomC는 숫자여야 합니다.');
  } else if (!(start > room)) {
    errors.push('params.startC는 params.roomC보다 커야 합니다.');
  }
  return errors;
}
