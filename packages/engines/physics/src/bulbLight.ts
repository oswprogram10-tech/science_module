import type { VariableExperiment as Experiment } from '@sci/schema';

// 전구에 불 켜기(bulb-light)와 전지 한 개와 두 개 직렬연결 비교하기(battery-series)가 함께 쓰는 엔진.
// 두 활동은 모듈이 따로지만 표본·결과 모양과 시뮬레이션 틀이 같다.

/** 전선을 댄 곳: 전구 꼭지 / 전구 옆면 쇠붙이 / 대지 않음 */
export const BL_ENDS = ['tip', 'side', 'none'] as const;
export type BlEnd = (typeof BL_ENDS)[number];
export const BL_SWITCHES = ['open', 'closed'] as const;
export type BlSwitch = (typeof BL_SWITCHES)[number];
/** 전선 색깔: 계산에 쓰지 않는 대조 변인 */
export const BL_WIRES = ['red', 'black'] as const;
export type BlWire = (typeof BL_WIRES)[number];
export const BS_CELLS = ['one', 'two', 'reversed'] as const;
export type BsCells = (typeof BS_CELLS)[number];
/** 전구(범주). 값이 곧 결과표와 튜터 입력에 쓰는 글자다. */
export const BL_LIT_ON = '켜짐';
export const BL_LIT_OFF = '켜지지 않음';
export type BlLit = typeof BL_LIT_ON | typeof BL_LIT_OFF;

export interface BulbLightParams {
  /** 전지 (+)극 쪽 전선을 댄 곳 */
  plusEnd: BlEnd;
  /** 전지 (−)극 쪽 전선을 댄 곳 */
  minusEnd: BlEnd;
  switch: BlSwitch;
  wireColor: BlWire;
}

export interface BatterySeriesParams {
  cells: BsCells;
  wireColor: BlWire;
}

export interface BulbSample {
  /** 초 */
  t: number;
  /** 전구의 밝기(눈금 0~10): 0에서 최종 값까지 올라간다. */
  level: number;
}

export interface BulbResult {
  /** 전구의 밝기(눈금 0~10), 정수 */
  brightness: number;
  lit: BlLit;
}

export interface BulbOutput {
  samples: BulbSample[];
  result: BulbResult;
}

/** 전구가 켜질 때의 밝기(눈금) */
export const BL_LIT_BRIGHTNESS = 6;
/** 전지 연결별 밝기(눈금): 한 개 4, 두 개 직렬 9, 하나를 반대로 넣으면 0 */
export const BS_BRIGHTNESS: Record<BsCells, number> = { one: 4, two: 9, reversed: 0 };

export const BL_LEVEL_MAX = 10;
export const BL_TOTAL_S = 2;
export const BL_SAMPLE_S = 0.05;
/** 밝기는 1초 동안 올라가고 2초까지 멈춰 있다. */
export const BL_RISE_S = 1;
/** 화면에서 두 밝기를 같다고 보는 기준(눈금) */
export const BL_SAME_LEVEL = 0.5;

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f || 0;
};

const bad = (name: string, v: unknown, list: readonly string[]) => new RangeError(`${name} ${String(v)}은(는) ${list.join(', ')} 중 하나여야 합니다.`);

const checkOne = (name: string, v: unknown, list: readonly string[]): void => {
  if (!list.includes(String(v))) throw bad(name, v, list);
};

/** 두 전선이 전구의 서로 다른 부분(꼭지와 옆면)에 닿았는가 */
export const touchesBothParts = (plusEnd: BlEnd, minusEnd: BlEnd): boolean => (plusEnd === 'tip' && minusEnd === 'side') || (plusEnd === 'side' && minusEnd === 'tip');

/** 스위치가 닫혀 있고 두 전선이 전구의 서로 다른 부분에 닿았을 때만 켜지고 밝기 6. 전선 색깔은 쓰지 않는다. */
export const bulbLightResultOf = (p: Pick<BulbLightParams, 'plusEnd' | 'minusEnd' | 'switch'>): BulbResult =>
  p.switch === 'closed' && touchesBothParts(p.plusEnd, p.minusEnd) ? { brightness: BL_LIT_BRIGHTNESS, lit: BL_LIT_ON } : { brightness: 0, lit: BL_LIT_OFF };

/** 전지 연결별 밝기. 전선 색깔은 쓰지 않는다. */
export const batterySeriesResultOf = (p: Pick<BatterySeriesParams, 'cells'>): BulbResult => {
  const brightness = BS_BRIGHTNESS[p.cells];
  return { brightness, lit: brightness > 0 ? BL_LIT_ON : BL_LIT_OFF };
};

/** 0~1초 동안 올라가고 2초까지 멈춰 있는 밝기 표본(0.05초 간격) */
function rampSamples(result: BulbResult): BulbSample[] {
  const steps = Math.round(BL_TOTAL_S / BL_SAMPLE_S);
  const samples: BulbSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = roundTo(i * BL_SAMPLE_S, 6);
    const u = Math.min(1, t / BL_RISE_S);
    const ease = 1 - (1 - u) * (1 - u);
    samples.push({ t, level: roundTo(result.brightness * ease, 9) });
  }
  return samples;
}

export function simulateBulbLight(params: BulbLightParams): BulbOutput {
  checkOne('전지 (+)극 쪽 전선을 댄 곳', params.plusEnd, BL_ENDS);
  checkOne('전지 (−)극 쪽 전선을 댄 곳', params.minusEnd, BL_ENDS);
  checkOne('스위치', params.switch, BL_SWITCHES);
  checkOne('전선 색깔', params.wireColor, BL_WIRES);
  const result = bulbLightResultOf(params);
  return { samples: rampSamples(result), result };
}

export function simulateBatterySeries(params: BatterySeriesParams): BulbOutput {
  checkOne('전지 연결', params.cells, BS_CELLS);
  checkOne('전선 색깔', params.wireColor, BL_WIRES);
  const result = batterySeriesResultOf(params);
  return { samples: rampSamples(result), result };
}

/** 두 샘플 사이를 선형 보간한다. */
export function interpolateBulb(a: BulbSample, b: BulbSample, k: number): BulbSample {
  return { t: a.t + (b.t - a.t) * k, level: a.level + (b.level - a.level) * k };
}

type Keys = Record<string, readonly string[]>;

function validateKeys(exp: Experiment, allowed: Keys): string[] {
  const errors: string[] = [];
  for (const [key, list] of Object.entries(allowed)) {
    const v = exp.variables.find((x) => x.key === key);
    if (!v) {
      errors.push(`변인 "${key}"이(가) 없습니다.`);
      continue;
    }
    for (const o of v.options) {
      if (typeof o.value !== 'string' || !list.includes(o.value)) errors.push(`변인 "${key}"의 선택지 값 ${JSON.stringify(o.value)}: ${list.join(', ')} 중 하나여야 합니다.`);
    }
  }
  return errors;
}

/** 매니페스트의 전구에 불 켜기 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export const validateBulbLightExperiment = (exp: Experiment): string[] => validateKeys(exp, { plusEnd: BL_ENDS, minusEnd: BL_ENDS, switch: BL_SWITCHES, wireColor: BL_WIRES });

/** 매니페스트의 전지 직렬연결 비교 실험이 모델이 다룰 수 있는 범위인지 검사한다. */
export const validateBatterySeriesExperiment = (exp: Experiment): string[] => validateKeys(exp, { cells: BS_CELLS, wireColor: BL_WIRES });
