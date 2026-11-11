import {
  VIB_LOUDS,
  VIB_OBJECTS,
  VIB_SEEDS,
  VIB_SOUNDS,
  simulateSoundVibration,
  type SoundVibrationParams,
  type SoundVibrationResult,
  type SoundVibrationSample,
  type VibLoud,
  type VibObject,
  type VibSeed,
  type VibSound,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): SoundVibrationParams => ({
  sound: pick(VIB_SOUNDS, values.sound, 'off'),
  loud: pick(VIB_LOUDS, values.loud, 'weak'),
  object: pick(VIB_OBJECTS, values.object, 'drum'),
  seed: pick(VIB_SEEDS, values.seed, 'yellow'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const vibOutput = (values: Values) => simulateSoundVibration(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 좁쌀은 가만히 있다. */
export const startSample = (values: Values): SoundVibrationSample => vibOutput(values).samples[0]!;

export const vibResult = (values: Values): SoundVibrationResult => vibOutput(values).result;

export const SOUND_TEXT: Record<VibSound, string> = { off: '소리를 내지 않음', on: '소리를 냄' };
export const LOUD_TEXT: Record<VibLoud, string> = { weak: '약하게', strong: '세게' };
export const OBJECT_TEXT: Record<VibObject, string> = { drum: '작은북', fork: '소리굽쇠', speaker: '스피커' };
export const SEED_TEXT: Record<VibSeed, string> = { yellow: '노란 좁쌀', white: '흰 좁쌀' };

/** 눈으로 보기 위쪽 둘째 줄: 소리를 내는지와 세기 */
export const soundLine = (p: Pick<SoundVibrationParams, 'sound' | 'loud'>): string => (p.sound === 'on' ? `${SOUND_TEXT.on} · ${LOUD_TEXT[p.loud]}` : SOUND_TEXT.off);

/** 눈으로 보기 아래 문구 */
export const vibNote = (s: Pick<SoundVibrationSample, 't' | 'bounceMm' | 'level'>) => `${s.t.toFixed(2)}초 · 좁쌀 높이 ${s.bounceMm.toFixed(1)} mm · 소리의 크기 ${Math.round(s.level)}눈금`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
