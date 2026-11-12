import type { VariableExperiment as Experiment } from '@sci/schema';

export const HT_MATERIALS = ['copper', 'iron', 'water'] as const;
export type HtMaterial = (typeof HT_MATERIALS)[number];
export const HT_SPOTS = ['edge', 'center'] as const;
export type HtSpot = (typeof HT_SPOTS)[number];
export const HT_COLORS = ['pink', 'blue'] as const;
export type HtColor = (typeof HT_COLORS)[number];

export interface HeatTransferParams {
  /** 데우는 것: 구리판 / 철판 / 비커 속 물 */
  material: HtMaterial;
  /** 데우는 곳: 가장자리 / 가운데 */
  heatAt: HtSpot;
  /** 열 붙임딱지 색(물에서는 색소 색): 계산에 쓰지 않는 대조 변인 */
  stickerColor: HtColor;
}

export interface HeatTransferSample {
  /** 초 */
  t: number;
  /** 색이 바뀐 붙임딱지 비율(%, 물은 색소가 퍼진 비율): 0에서 100까지 */
  pct: number;
  /** 가장 먼 곳까지 열이 전해진 정도(0 ~ 1): t ÷ 걸린 시간 */
  front: number;
}

/** 열이 퍼진 모습(범주): 관찰한 사실만 쓴다. */
export type HtPath = 'plate' | 'water';

export interface HeatTransferResult {
  /** 가장 먼 곳까지 열이 전해진 시간(초), 정수 */
  time: number;
  /** 열이 퍼진 모습(범주) */
  path: HtPath;
}

export interface HeatTransferOutput {
  samples: HeatTransferSample[];
  result: HeatTransferResult;
}

export const HT_PATH_LABEL: Record<HtPath, string> = {
  plate: '데운 곳 둘레부터 둥글게 번짐',
  water: '데운 곳 위로 올라가 위에서 옆으로 퍼진 뒤 내려옴',
};

/** 사양 표: 가장 먼 곳까지 열이 전해진 시간(초). 수치는 근사값이며 교사 검수 대상이다. */
export const HT_TABLE: Record<HtMaterial, Record<HtSpot, number>> = {
  copper: { edge: 40, center: 25 },
  iron: { edge: 120, center: 75 },
  water: { edge: 60, center: 45 },
};

export const HT_TOTAL_S = 130;
export const HT_SAMPLE_S = 1;
/** 화면에서 두 시간을 같다고 보는 기준(초) */
export const HT_SAME_S = 0.5;

/** 판 위 붙임딱지 격자(7 × 7) */
export const HT_GRID = 7;
/** 데우는 곳의 격자 위치(칸 단위): 가장자리는 왼쪽 변의 가운데, 가운데는 판의 한가운데 */
export const HT_SPOT_AT: Record<HtSpot, { col: number; row: number }> = { edge: { col: 0, row: 3 }, center: { col: 3, row: 3 } };

export interface Sticker {
  col: number;
  row: number;
  /** 데운 곳에서의 거리 ÷ 가장 먼 붙임딱지까지의 거리 (0 ~ 1) */
  frac: number;
}

/** 데운 곳에서 가까운 순서(같으면 행·열 순)로 놓은 붙임딱지 49개 */
export const stickersOf = (spot: HtSpot): Sticker[] => {
  const at = HT_SPOT_AT[spot];
  const list: Sticker[] = [];
  for (let row = 0; row < HT_GRID; row++) for (let col = 0; col < HT_GRID; col++) list.push({ col, row, frac: Math.hypot(col - at.col, row - at.row) });
  const max = Math.max(...list.map((s) => s.frac));
  return list.map((s) => ({ ...s, frac: s.frac / max })).sort((a, b) => a.frac - b.frac || a.row - b.row || a.col - b.col);
};

/** 붙임딱지가 색이 바뀌는 때(초): 데운 곳에서의 거리에 비례하고 가장 먼 것이 걸린 시간에 바뀐다. 가장 가까운 것도 1초는 걸린다. */
export const changeTimeOf = (frac: number, timeS: number): number => Math.max(1, frac * timeS);

/** t초에 색이 바뀐 붙임딱지 수 */
export const changedCount = (spot: HtSpot, timeS: number, t: number): number => stickersOf(spot).filter((s) => t >= changeTimeOf(s.frac, timeS)).length;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const checkParams = (p: HeatTransferParams): void => {
  const bad = (name: string, v: unknown, list: readonly string[]) => new RangeError(`${name} ${String(v)}은(는) ${list.join(', ')} 중 하나여야 합니다.`);
  if (!(HT_MATERIALS as readonly string[]).includes(p.material)) throw bad('데우는 것', p.material, HT_MATERIALS);
  if (!(HT_SPOTS as readonly string[]).includes(p.heatAt)) throw bad('데우는 곳', p.heatAt, HT_SPOTS);
  if (!(HT_COLORS as readonly string[]).includes(p.stickerColor)) throw bad('붙임딱지 색', p.stickerColor, HT_COLORS);
};

export const heatTransferResultOf = (p: Pick<HeatTransferParams, 'material' | 'heatAt'>): HeatTransferResult => ({
  time: HT_TABLE[p.material][p.heatAt],
  path: p.material === 'water' ? 'water' : 'plate',
});

/**
 * 열이 이동하는 모습 관찰. 수치는 근사값이며 교사 검수 대상이다. 난수 없음.
 * 판은 데운 곳에서 가까운 붙임딱지부터(거리에 비례한 때에) 색이 바뀌고, 물은 색소 띠가 정해진 시간 동안 데운 곳 위로 올라가 퍼진 뒤 내려온다.
 * 붙임딱지(색소) 색은 계산에 쓰지 않는다. 0~130초를 1초 간격으로 표본한다.
 */
export function simulateHeatTransfer(params: HeatTransferParams): HeatTransferOutput {
  checkParams(params);
  const result = heatTransferResultOf(params);
  const stickers = stickersOf(params.heatAt);
  const steps = Math.round(HT_TOTAL_S / HT_SAMPLE_S);
  const samples: HeatTransferSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * HT_SAMPLE_S, 6);
    const front = Math.min(1, t / result.time);
    const pct = params.material === 'water' ? front * 100 : (stickers.filter((s) => t >= changeTimeOf(s.frac, result.time)).length / stickers.length) * 100;
    samples.push({ t, pct: roundTo(pct, 9), front: roundTo(front, 9) });
  }
  return { samples, result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateHeatTransfer(a: HeatTransferSample, b: HeatTransferSample, k: number): HeatTransferSample {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { t: lerp(a.t, b.t), pct: lerp(a.pct, b.pct), front: lerp(a.front, b.front) };
}

const KEYS = ['material', 'heatAt', 'stickerColor'] as const;
const ALLOWED: Record<(typeof KEYS)[number], readonly string[]> = { material: HT_MATERIALS, heatAt: HT_SPOTS, stickerColor: HT_COLORS };

/** 매니페스트의 열이 이동하는 모습 관찰 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export function validateHeatTransferExperiment(exp: Experiment): string[] {
  const errors: string[] = [];
  for (const key of KEYS) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (typeof o.value !== 'string' || !ALLOWED[key].includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${ALLOWED[key].join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}
