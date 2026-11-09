import { BREEZE_AMBIENT_C, breezeOf, simulateBreeze, type BreezeKind, type BreezeParams, type BreezeResult, type BreezeSample } from '@sci/engine-earth';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const breezeOptions = (exp?: VariableExperiment) => ({
  totalMin: typeof exp?.params?.totalMin === 'number' ? exp.params.totalMin : undefined,
});

export const toParams = (values: Values): BreezeParams => ({
  phase: values.phase === 'night' ? 'night' : 'day',
  lampCm: Number(values.lampCm),
  bowl: values.bowl === 'glass' ? 'glass' : 'plastic',
});

export const breezeOutput = (values: Values, exp?: VariableExperiment) => simulateBreeze(toParams(values), breezeOptions(exp));

export const breezeResult = (values: Values, exp?: VariableExperiment): BreezeResult => breezeOutput(values, exp).result;

/** 실험 전에는 어느 쪽이 따뜻한지 드러나지 않도록 두 쪽 모두 주변 온도로 그린다. */
export const IDLE_SAMPLE: BreezeSample = { t: 0, sand: BREEZE_AMBIENT_C, water: BREEZE_AMBIENT_C, diff: 0, wind: 0 };

export const BREEZE_TEXT: Record<BreezeKind, string> = { 'sea-to-land': '바다 → 육지', 'land-to-sea': '육지 → 바다', calm: '거의 없음' };

/** 음수는 유니코드 빼기 기호(−)로 쓴다. */
const minus = (s: string) => s.replace('-', '−');

/** 부호 있는 온도 차: +8.4, 0.0, −2.6 */
export const signedC = (x: number) => (x > 0 ? `+${x.toFixed(1)}` : minus((Math.abs(x) < 0.05 ? 0 : x).toFixed(1)));

/** 눈으로 보기 아래 문구. 바람 방향은 표본의 온도 차로 정한다. */
export const breezeNote = (s: Pick<BreezeSample, 't' | 'sand' | 'water' | 'diff'>) =>
  `${s.t.toFixed(1)}분 · 모래 ${s.sand.toFixed(1)} °C · 물 ${s.water.toFixed(1)} °C · 바람: ${BREEZE_TEXT[breezeOf(s.diff)]}`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
