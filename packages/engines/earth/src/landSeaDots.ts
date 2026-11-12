import type { VariableExperiment as Experiment } from '@sci/schema';

export const LS_DOTS = [10, 50, 100, 500] as const;
export const LS_ROUNDS = [1, 2, 3] as const;
export const LS_GLOBES = ['red', 'blue'] as const;
export type LsGlobe = (typeof LS_GLOBES)[number];

export interface LandSeaDotsParams {
  /** 찍은 점의 수 */
  dots: number;
  /** 점 찍기 차례(1~3): 차례마다 다른 고정 난수 씨앗 */
  round: number;
  /** 지구본 받침 색: 계산에 쓰지 않는 대조 변인 */
  globeColor: LsGlobe;
}

export interface LandSeaDotsSample {
  /** 점 순서 축(0~찍은 점의 수). 이 모델의 그래프 가로축이다. */
  t: number;
  /** 지금까지 바다에 떨어진 점(개) */
  sea: number;
  /** 지금까지 육지에 떨어진 점(개) */
  land: number;
  /** 지금까지 바다 비율(%): 아직 점이 없는 t = 0에서는 NaN */
  seaPct: number;
}

export interface LandSeaDotsResult {
  /** 바다에 떨어진 점의 비율(%), 정수 */
  seaPct: number;
  sea: number;
  land: number;
}

export interface LandSeaDotsOutput {
  samples: LandSeaDotsSample[];
  result: LandSeaDotsResult;
}

/** 구 위에 찍은 점 하나 */
export interface LandSeaPoint {
  /** 위도(°, 북쪽이 +) */
  lat: number;
  /** 경도(°, 동쪽이 +, −180~180) */
  lon: number;
  /** 바다에 떨어졌으면 true */
  sea: boolean;
}

/** 화면에서 두 비율을 같다고 보는 기준(%p) */
export const LS_SAME_PCT = 1;

/** 손으로 그린 낮은 해상도 육지 지도(위도 2° × 경도 2° 칸 90 × 180). 위쪽(북위 90°)부터 한 줄씩이고, 각 줄은 육지인 경도 칸 번호 구간("시작-끝")이다. 칸 j는 경도 −180 + 2j ~ −180 + 2(j + 1)°. */
export const LS_MASK_ROWS: readonly string[] = [
  '',
  '',
  '',
  '70-75',
  '45-79',
  '43-79,97-101',
  '55-80,141-142',
  '29-32,61-80,134-144',
  '28-28,62-79,117-117,130-152',
  '12-12,32-39,47-53,62-78,124-164',
  '8-30,45-47,50-56,63-75,98-106,120-179',
  '7-48,52-58,63-72,97-109,112-179',
  '0-3,6-46,51-57,64-69,78-82,96-100,102-179',
  '7-43,65-68,94-99,101-170',
  '7-42,53-54,66-68,93-98,101-173',
  '10-13,22-42,51-57,92-98,102-159,168-171',
  '10-10,23-43,51-58,87-88,96-97,101-157,168-170',
  '24-47,51-59,87-88,94-94,100-157,168-169',
  '25-48,51-60,85-86,88-90,92-159,161-161,168-168',
  '26-60,87-161',
  '28-56,61-62,88-159,161-161',
  '28-57,62-62,89-158',
  '28-57,89-95,97-103,107-107,109-112,117-157',
  '28-54,85-91,95-96,99-103,110-113,116-155,160-161',
  '28-53,86-90,97-98,100-114,116-154,160-160',
  '28-52,85-89,100-101,103-114,117-149,152-153,160-160',
  '29-51,86-88,93-94,104-114,117-150,153-154,158-159',
  '30-51,87-94,108-149,153-153,156-159',
  '31-50,86-95,107-149',
  '32-49,85-105,107-150',
  '32-32,34-42,49-49,85-105,107-113,115-150',
  '35-40,49-49,83-106,108-114,117-149',
  '36-40,82-106,108-115,117-117,123-149',
  '37-40,82-107,109-118,124-147',
  '37-40,45-45,50-51,81-107,109-118,125-132,136-143',
  '38-41,44-45,53-54,82-108,110-118,126-131,136-142',
  '40-45,82-108,110-116,126-130,137-143,150-150',
  '44-47,81-109,111-114,127-129,139-143,150-150',
  '46-47,82-110,112-112,127-129,139-144',
  '47-47,52-54,82-115,128-129,139-139,141-143',
  '48-59,83-114,128-128,139-139,142-142',
  '51-60,84-114,130-130,140-140,151-152',
  '51-63,86-87,93-113,140-141,147-148',
  '51-63,95-112,138-141,146-148',
  '50-64,95-111,139-140,144-148',
  '50-65,94-110,139-141,145-148,150-150',
  '50-68,95-109,140-142,145-147,150-150,158-160',
  '50-71,96-109,142-142,158-162',
  '50-71,96-109,143-145,159-163',
  '51-71,96-109,163-163',
  '51-71,97-109,161-161',
  '52-70,97-109,114-114,154-157,161-161',
  '52-69,96-109,113-114,152-157,161-162',
  '54-69,96-108,112-114,151-158,160-162',
  '55-69,96-107,112-114,151-162',
  '55-69,97-107,112-113,148-163',
  '55-67,97-107,112-113,147-164',
  '55-65,98-106,112-112,147-165',
  '54-65,98-105,147-166',
  '54-64,98-105,147-166',
  '54-63,99-104,147-165',
  '54-63,99-103,147-152,157-165',
  '54-60,159-165',
  '53-60,160-164',
  '53-58,177-177',
  '53-58,176-177',
  '53-56,163-163,175-175',
  '53-56,174-174',
  '53-55',
  '53-55',
  '53-54',
  '54-55',
  '55-56',
  '',
  '',
  '',
  '',
  '59-60',
  '57-59,135-160',
  '56-58,103-123,126-166',
  '54-58,78-171',
  '48-58,74-174',
  '23-58,73-176',
  '15-63,72-178',
  '0-179',
  '0-179',
  '0-179',
  '0-179',
  '0-179',
  '0-179',
];

export const LS_LAT_CELLS = 90;
export const LS_LON_CELLS = 180;
export const LS_CELL_DEG = 2;

const decodeMask = (): Uint8Array => {
  const cells = new Uint8Array(LS_LAT_CELLS * LS_LON_CELLS);
  LS_MASK_ROWS.forEach((row, i) => {
    if (row === '') return;
    for (const run of row.split(',')) {
      const [a, b] = run.split('-').map(Number) as [number, number];
      for (let j = a; j <= b; j++) cells[i * LS_LON_CELLS + j] = 1;
    }
  });
  return cells;
};

const MASK = decodeMask();

/** 칸 (줄 i: 북쪽부터 0, 칸 j: 서쪽부터 0)이 육지인가 */
export const isLandCell = (i: number, j: number): boolean => MASK[i * LS_LON_CELLS + j] === 1;

/** 위도(°)·경도(°)에 있는 점이 육지인가 */
export function isLandAt(latDeg: number, lonDeg: number): boolean {
  const i = Math.min(LS_LAT_CELLS - 1, Math.max(0, Math.floor((90 - latDeg) / LS_CELL_DEG)));
  const j = Math.min(LS_LON_CELLS - 1, Math.max(0, Math.floor((lonDeg + 180) / LS_CELL_DEG)));
  return isLandCell(i, j);
}

/** 지도 전체에서 바다가 차지하는 넓이의 비율(0~1): 줄마다 구면 넓이(sin 위도 차)로 가중한다. */
export function seaFractionByArea(): number {
  let total = 0;
  let land = 0;
  for (let i = 0; i < LS_LAT_CELLS; i++) {
    const top = ((90 - i * LS_CELL_DEG) * Math.PI) / 180;
    const bottom = ((90 - (i + 1) * LS_CELL_DEG) * Math.PI) / 180;
    const w = Math.sin(top) - Math.sin(bottom);
    let n = 0;
    for (let j = 0; j < LS_LON_CELLS; j++) n += MASK[i * LS_LON_CELLS + j]!;
    total += w * LS_LON_CELLS;
    land += w * n;
  }
  return 1 - land / total;
}

/** 시드 고정 의사난수(mulberry32), [0, 1) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 차례와 점의 수에서 정하는 고정 씨앗 */
export const landSeaSeedOf = (round: number, dots: number): number => (Math.imul(round, 100003) + Math.imul(dots, 7919) + 20250401) >>> 0;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: LandSeaDotsParams): void => {
  if (typeof p.dots !== 'number' || !(LS_DOTS as readonly number[]).includes(p.dots)) throw new RangeError(`찍은 점의 수 ${String(p.dots)}은(는) ${LS_DOTS.join(', ')} 중 하나여야 합니다.`);
  if (typeof p.round !== 'number' || !(LS_ROUNDS as readonly number[]).includes(p.round)) throw new RangeError(`점 찍기 차례 ${String(p.round)}은(는) ${LS_ROUNDS.join(', ')} 중 하나여야 합니다.`);
  if (!(LS_GLOBES as readonly string[]).includes(p.globeColor)) throw new RangeError(`받침 색 ${String(p.globeColor)}은(는) ${LS_GLOBES.join(', ')} 중 하나여야 합니다.`);
};

/**
 * 구 위에 고르게 찍은 점들(차례와 점의 수에서 정한 고정 씨앗). 경도는 −180~180에서 고르게, 위도는 sin 위도를 −1~1에서 고르게 뽑아(asin) 구면 넓이에 비례하게 한다.
 * 같은 (차례, 점의 수)는 언제나 같은 점들이다.
 */
export function landSeaPoints(round: number, dots: number): LandSeaPoint[] {
  const rng = mulberry32(landSeaSeedOf(round, dots));
  const points: LandSeaPoint[] = [];
  for (let k = 0; k < dots; k++) {
    const lon = rng() * 360 - 180;
    const lat = (Math.asin(rng() * 2 - 1) * 180) / Math.PI;
    points.push({ lat, lon, sea: !isLandAt(lat, lon) });
  }
  return points;
}

/**
 * 육지와 바다의 넓이 비교(점 찍기). 수치는 근사값이며 교사 검수 대상이다.
 * 손으로 그린 낮은 해상도 지도(넓이로 가중한 바다 비율 약 71 %) 위에 점을 고르게 찍고 바다에 떨어진 점의 비율을 센다.
 * 표본은 점 하나마다(t = 0~찍은 점의 수)이고, 값은 지금까지의 바다·육지 점 수와 바다 비율이다. 받침 색은 계산에 쓰지 않는다.
 */
export function simulateLandSeaDots(params: LandSeaDotsParams): LandSeaDotsOutput {
  checkParams(params);
  const points = landSeaPoints(params.round, params.dots);
  const samples: LandSeaDotsSample[] = [{ t: 0, sea: 0, land: 0, seaPct: NaN }];
  let sea = 0;
  points.forEach((p, k) => {
    if (p.sea) sea++;
    const n = k + 1;
    samples.push({ t: n, sea, land: n - sea, seaPct: roundTo((sea / n) * 100, 6) });
  });
  return { samples, result: { seaPct: Math.round((sea / params.dots) * 100), sea, land: params.dots - sea } };
}

/** 두 샘플 사이를 선형 보간한다(비율이 아직 없는 처음 구간은 NaN을 그대로 둔다). */
export function interpolateLandSeaDots(a: LandSeaDotsSample, b: LandSeaDotsSample, k: number): LandSeaDotsSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), sea: lerp(a.sea, b.sea), land: lerp(a.land, b.land), seaPct: Number.isFinite(a.seaPct) ? lerp(a.seaPct, b.seaPct) : k >= 1 ? b.seaPct : NaN };
}

/** 매니페스트의 육지와 바다의 넓이 비교 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateLandSeaDotsExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  const allowed: Record<string, readonly (string | number)[]> = { dots: LS_DOTS, round: LS_ROUNDS, globeColor: LS_GLOBES };
  for (const key of Object.keys(allowed)) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (!allowed[key]!.includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${allowed[key]!.join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
