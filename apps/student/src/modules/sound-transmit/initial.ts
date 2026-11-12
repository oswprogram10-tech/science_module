import {
  ST_BLOCKS,
  ST_CLOCKS,
  ST_HEARD_LABEL,
  ST_MEDIUMS,
  simulateSoundTransmit,
  type SoundTransmitParams,
  type SoundTransmitResult,
  type SoundTransmitSample,
  type StBlock,
  type StClock,
  type StMedium,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): SoundTransmitParams => ({
  medium: pick(ST_MEDIUMS, values.medium, 'air'),
  block: pick(ST_BLOCKS, values.block, 'none'),
  clockColor: pick(ST_CLOCKS, values.clockColor, 'red'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const soundOutput = (values: Values) => simulateSoundTransmit(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 바늘은 0에 있다. */
export const startSample = (values: Values): SoundTransmitSample => soundOutput(values).samples[0]!;

export const soundResult = (values: Values): SoundTransmitResult => soundOutput(values).result;

export const MEDIUM_TEXT: Record<StMedium, string> = { air: '공기', water: '물', wood: '책상 나무', string: '실 전화기의 실' };
export const BLOCK_TEXT: Record<StBlock, string> = { none: '없음', box: '종이 상자', sponge: '스펀지', cotton: '솜' };
export const CLOCK_TEXT: Record<StClock, string> = { red: '빨간색', blue: '파란색' };

/** 결과표의 "귀에 들리나요" 글자 */
export const heardText = (r: SoundTransmitResult): string => ST_HEARD_LABEL[r.heard];

/** 눈으로 보기 아래 문구 */
export const soundNote = (s: Pick<SoundTransmitSample, 't' | 'level'>, r: SoundTransmitResult) => `${s.t.toFixed(1)}초 · 소음계 ${s.level.toFixed(1)}눈금 · 귀에 ${heardText(r)}`;
