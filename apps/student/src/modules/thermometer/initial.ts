import {
  TH_EYES,
  TH_FEEL_LABEL,
  TH_HANDS,
  TH_TARGETS,
  TH_TOOLS,
  simulateThermometer,
  type ThEye,
  type ThFeel,
  type ThHand,
  type ThTarget,
  type ThTool,
  type ThermometerParams,
  type ThermometerResult,
  type ThermometerSample,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): ThermometerParams => ({
  hand: pick(TH_HANDS, values.hand, 'none'),
  target: pick(TH_TARGETS, values.target, 'water'),
  tool: pick(TH_TOOLS, values.tool, 'alcohol'),
  eye: pick(TH_EYES, values.eye, 'level'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const thermometerOutput = (values: Values) => simulateThermometer(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 눈금은 20 °C, 손 느낌은 없다. */
export const startSample = (values: Values): ThermometerSample => thermometerOutput(values).samples[0]!;

export const thermometerResult = (values: Values): ThermometerResult => thermometerOutput(values).result;

export const HAND_TEXT: Record<ThHand, string> = { none: '넣지 않음', cold: '찬물(10 °C)', warm: '따뜻한 물(40 °C)' };
export const TARGET_TEXT: Record<ThTarget, string> = { water: '미지근한 물', rod: '같은 방의 철봉', wood: '같은 방의 나무 판' };
export const TOOL_TEXT: Record<ThTool, string> = { alcohol: '알코올 온도계', ir: '적외선 온도계' };
export const EYE_TEXT: Record<ThEye, string> = { above: '위에서', level: '액체 끝과 같은 높이', below: '아래에서' };
/** 그림 안 한 줄 라벨용 짧은 이름(글자가 그림 폭을 넘지 않게) */
export const EYE_SHORT: Record<ThEye, string> = { above: '위에서', level: '같은 높이', below: '아래에서' };

/** 결과표의 "손 느낌" 글자 */
export const feelText = (r: Pick<ThermometerResult, 'feel'>): string => TH_FEEL_LABEL[r.feel as ThFeel];

/** 눈으로 보기 아래 문구 */
export const thermometerNote = (s: Pick<ThermometerSample, 't' | 'level'>, r: ThermometerResult) => `${s.t.toFixed(1)}초 · 온도계 눈금 ${s.level.toFixed(1)} °C · 손 느낌: ${feelText(r)}`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
