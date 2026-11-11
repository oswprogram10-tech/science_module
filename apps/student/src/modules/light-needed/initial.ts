import {
  LN_BOXES,
  LN_FLASHLIGHTS,
  LN_OBJECTS,
  LN_VISIBLE_LABEL,
  simulateLightNeeded,
  type LightNeededParams,
  type LightNeededResult,
  type LightNeededSample,
  type LnBox,
  type LnFlashlight,
  type LnObject,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): LightNeededParams => ({
  flashlight: pick(LN_FLASHLIGHTS, values.flashlight, 'off'),
  object: pick(LN_OBJECTS, values.object, 'doll'),
  boxColor: pick(LN_BOXES, values.boxColor, 'black'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const lightOutput = (values: Values) => simulateLightNeeded(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 깜깜하다. */
export const startSample = (values: Values): LightNeededSample => lightOutput(values).samples[0]!;

export const lightResult = (values: Values): LightNeededResult => lightOutput(values).result;

export const FLASHLIGHT_TEXT: Record<LnFlashlight, string> = { off: '손전등 끔', on: '손전등 켬' };
export const OBJECT_TEXT: Record<LnObject, string> = { doll: '인형', bulb: '켜진 작은 전구' };
export const BOX_TEXT: Record<LnBox, string> = { black: '검은 상자', white: '흰 상자' };

/** 결과표의 "구멍으로 본 물체" 글자 */
export const visibleText = (r: LightNeededResult): string => LN_VISIBLE_LABEL[r.visible];

/** 눈으로 보기 아래 문구 */
export const lightNote = (s: Pick<LightNeededSample, 't' | 'level'>, r: LightNeededResult) => `${s.t.toFixed(1)}초 · 상자 안 밝기 ${s.level.toFixed(1)}눈금 · 구멍으로 본 물체: ${visibleText(r)}`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
