import {
  POLE_COVERS,
  POLE_FACINGS,
  POLE_SIZES,
  simulateMagnetPoles,
  type MagnetPolesParams,
  type MagnetPolesResult,
  type MagnetPolesSample,
  type PoleCover,
  type PoleFacing,
  type PoleMotion,
  type PoleSize,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): MagnetPolesParams => {
  const gap = Number(values.gapCm);
  return {
    facing: pick(POLE_FACINGS, values.facing, 'NS'),
    gapCm: gap === 2 || gap === 4 ? gap : 1,
    size: pick(POLE_SIZES, values.size, 'small'),
    cover: pick(POLE_COVERS, values.cover, 'color'),
  };
};

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const polesOutput = (values: Values) => simulateMagnetPoles(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 오른쪽 자석은 처음 자리에 있다. */
export const startSample = (values: Values): MagnetPolesSample => polesOutput(values).samples[0]!;

export const polesResult = (values: Values): MagnetPolesResult => polesOutput(values).result;

export const FACING_TEXT: Record<PoleFacing, string> = { NN: 'N극–N극', NS: 'N극–S극', SS: 'S극–S극' };
export const SIZE_TEXT: Record<PoleSize, string> = { small: '작은 자석', large: '큰 자석' };
export const COVER_TEXT: Record<PoleCover, string> = { color: '빨강·파랑', gray: '회색' };
export const MOTION_TEXT: Record<PoleMotion, string> = { attract: '다가와 붙음', repel: '밀려남', none: '움직이지 않음' };

/** 결과 열 글자 */
export const motionText = (r: Pick<MagnetPolesResult, 'motion'>) => MOTION_TEXT[r.motion];
export const moveText = (r: Pick<MagnetPolesResult, 'moveCm'>) => r.moveCm.toFixed(1);

/** 눈으로 보기 아래 문구 */
export const polesNote = (s: Pick<MagnetPolesSample, 't' | 'gapCm'>) => `${s.t.toFixed(1)}초 · 두 자석 사이 ${s.gapCm.toFixed(1)} cm`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
