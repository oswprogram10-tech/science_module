import {
  BL_ENDS,
  BL_SWITCHES,
  BL_WIRES,
  BS_CELLS,
  simulateBatterySeries,
  simulateBulbLight,
  type BatterySeriesParams,
  type BlEnd,
  type BlSwitch,
  type BlWire,
  type BsCells,
  type BulbResult,
  type BulbSample,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export interface BulbLightViewParams {
  plusEnd: BlEnd;
  minusEnd: BlEnd;
  switch: BlSwitch;
  wireColor: BlWire;
}

export const toParams = (values: Values): BulbLightViewParams => ({
  plusEnd: pick(BL_ENDS, values.plusEnd, 'none'),
  minusEnd: pick(BL_ENDS, values.minusEnd, 'none'),
  switch: pick(BL_SWITCHES, values.switch, 'open'),
  wireColor: pick(BL_WIRES, values.wireColor, 'red'),
});

export const toBatteryParams = (values: Values): BatterySeriesParams => ({
  cells: pick(BS_CELLS, values.cells, 'one'),
  wireColor: pick(BL_WIRES, values.wireColor, 'red'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const bulbOutput = (values: Values) => simulateBulbLight(toParams(values));
export const batteryOutput = (values: Values) => simulateBatterySeries(toBatteryParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 불이 꺼져 있다. */
export const startSample = (values: Values): BulbSample => bulbOutput(values).samples[0]!;

export const END_TEXT: Record<BlEnd, string> = { tip: '전구 꼭지', side: '전구 옆면 쇠붙이', none: '대지 않음' };
export const SWITCH_TEXT: Record<BlSwitch, string> = { open: '열림', closed: '닫힘' };
export const WIRE_TEXT: Record<BlWire, string> = { red: '빨간색', black: '검은색' };
export const CELLS_TEXT: Record<BsCells, string> = { one: '전지 1개', two: '전지 2개를 한 줄로', reversed: '전지 2개 중 하나를 반대로' };

/** 눈으로 보기 아래 문구 */
export const bulbNote = (s: Pick<BulbSample, 't' | 'level'>, r: BulbResult) => `${s.t.toFixed(1)}초 · 전구의 밝기 ${s.level.toFixed(1)}눈금 · 전구: ${r.lit}`;
export const BULB_NOTE_EMPTY = '실험하면 전구의 불빛이 나타나요.';
