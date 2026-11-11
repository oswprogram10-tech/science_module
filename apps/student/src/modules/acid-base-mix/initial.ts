import {
  MIX_COLOR_LABEL,
  MIX_DIRECTIONS,
  MIX_INDICATORS,
  MIX_SCALE,
  addedMlOf,
  colorAtDrops,
  simulateAcidBaseMix,
  type AcidBaseMixParams,
  type AcidBaseMixResult,
  type AcidBaseMixSample,
  type MixColor,
  type MixDirection,
  type MixIndicator,
} from '@sci/engine-matter';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): AcidBaseMixParams => {
  const drops = Number(values.drops);
  const beaker = Number(values.beaker);
  return {
    drops: drops === 10 || drops === 20 || drops === 30 || drops === 40 ? drops : 0,
    direction: pick(MIX_DIRECTIONS, values.direction, 'acid'),
    indicator: pick(MIX_INDICATORS, values.indicator, 'cabbage'),
    beaker: beaker === 100 ? 100 : 50,
  };
};

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const mixOutput = (values: Values) => simulateAcidBaseMix(toParams(values));

export const mixResult = (values: Values): AcidBaseMixResult => mixOutput(values).result;

/** 첫 활동(지시약으로 여러 가지 용액 분류하기) 매니페스트의 colors[키].hex와 같다. */
export const COLOR_HEX: Record<MixColor, string> = {
  cabRed: '#d6336c',
  cabPink: '#c86fa8',
  cabPurple: '#7b4e9b',
  cabBlue: '#3a8fb7',
  cabGreen: '#3fa36b',
  cabYellow: '#c9c23a',
  clear: '#f1f1ee',
  magenta: '#e0479e',
};

export const colorName = (c: MixColor): string => MIX_COLOR_LABEL[c];

export const INDICATOR_TEXT: Record<MixIndicator, string> = { cabbage: '붉은 양배추 지시약', phenol: '페놀프탈레인 용액' };
/** 눈으로 보기에 쓰는 짧은 글자: 처음 용액과 넣는 용액 */
export const FIRST_TEXT: Record<MixDirection, string> = { acid: '묽은 염산 10 mL', base: '묽은 수산화 나트륨 10 mL' };
export const ADDED_TEXT: Record<MixDirection, string> = { acid: '묽은 수산화 나트륨', base: '묽은 염산' };
export const DIRECTION_TEXT: Record<MixDirection, string> = {
  acid: '묽은 염산 10 mL에 묽은 수산화 나트륨 용액을 넣음',
  base: '묽은 수산화 나트륨 용액 10 mL에 묽은 염산을 넣음',
};

/** 지시약의 색 띠를 "1 붉은색 → 2 연한 붉은색 …" 글자로 쓴다. */
export const scaleText = (indicator: MixIndicator): string => MIX_SCALE[indicator].map((c, i) => `${i + 1} ${MIX_COLOR_LABEL[c]}`).join(' → ');

/** 지금 순간(스냅샷)의 정수 방울 수 */
export const dropsNow = (s: Pick<AcidBaseMixSample, 'drops'>): number => Math.round(s.drops);

/** 방울 수, 방향, 지시약으로 정해지는 색 */
export const colorFor = (drops: number, direction: MixDirection, indicator: MixIndicator): MixColor => colorAtDrops(drops, direction, indicator);

export const mlText = (drops: number): string => addedMlOf(drops).toFixed(1);

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
