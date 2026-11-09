import { simulateMold, type MoistureKind, type MoldLightKind, type MoldParams, type MoldResult, type MoldSample } from '@sci/engine-life';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const moldOptions = (exp: VariableExperiment) => ({
  days: typeof exp.params?.days === 'number' ? exp.params.days : undefined,
});

const toParams = (values: Values) => values as unknown as MoldParams;

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const moldOutput = (values: Values, exp?: VariableExperiment) => simulateMold(toParams(values), exp ? moldOptions(exp) : {});

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 0일째 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): MoldSample => moldOutput(values, exp).samples[0]!;

export const moistureOf = (values: Values): MoistureKind => (values.moisture === 'dry' ? 'dry' : 'wet');
export const lightOf = (values: Values): MoldLightKind => (values.light === 'dark' ? 'dark' : 'bright');

export const MOISTURE_TEXT: Record<MoistureKind, string> = { dry: '마른 빵', wet: '물을 뿌린 빵' };
export const LIGHT_TEXT: Record<MoldLightKind, string> = { bright: '밝은 곳', dark: '어두운 곳' };

/** 결과 열 글자 */
export const cover7Text = (r: MoldResult) => String(r.cover7);
export const cover10Text = (r: MoldResult) => String(r.cover10);
export const firstDayText = (r: MoldResult) => (r.firstDay === null ? '–' : r.firstDay.toFixed(1));

/** 가상 습도 센서: 봉지 안의 습도(%) */
export const HUMIDITY_PCT: Record<MoistureKind, number> = { dry: 40, wet: 90 };

/** 날짜(일)를 "7", "3.5"로 */
export const dayText = (t: number) => String(Number(t.toFixed(1)));

/** 곰팡이 얼룩과 균사의 색: 포자가 많을수록 희끄무레한 초록(0)에서 짙은 청록(1)으로 */
export function moldColor(spores: number): string {
  const k = Math.min(1, Math.max(0, spores));
  const from = [167, 196, 160];
  const to = [15, 118, 110];
  const [r, g, b] = from.map((v, i) => Math.round(v + (to[i]! - v) * k));
  return `rgb(${r}, ${g}, ${b})`;
}

/** 시드를 고정한 간단한 난수열(0 이상 1 미만). 화면이 매번 같은 모양으로 그려지게 한다. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
