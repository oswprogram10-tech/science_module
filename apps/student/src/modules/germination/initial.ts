import {
  STEM_MM_PER_DAY,
  simulateGermination,
  type GerminationParams,
  type GerminationSample,
  type GerminationResult,
  type LeafColor,
  type LightKind,
} from '@sci/engine-life';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const germinationOptions = (exp: VariableExperiment) => ({
  seeds: typeof exp.params?.seeds === 'number' ? exp.params.seeds : undefined,
  days: typeof exp.params?.days === 'number' ? exp.params.days : undefined,
});

const toParams = (values: Values) => values as unknown as GerminationParams;

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const germinationOutput = (values: Values, exp?: VariableExperiment) =>
  simulateGermination(toParams(values), exp ? germinationOptions(exp) : {});

/** 실험 전(스냅샷이 없을 때) 화면이 보여 주는 0일째 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): GerminationSample => germinationOutput(values, exp).samples[0]!;

/** 씨앗 수(결과 열 글자용) */
export const sproutedText = (r: GerminationResult) => String(r.sproutedDay7);
export const firstDayText = (r: GerminationResult) => (r.firstDay === null ? '–' : r.firstDay.toFixed(1));
export const LEAF_COLOR_TEXT: Record<LeafColor, string> = { green: '초록색', yellow: '노란색' };
export const leafColorText = (r: GerminationResult) => (r.leafColor === null ? '–' : LEAF_COLOR_TEXT[r.leafColor]);

/** 떡잎을 그릴 색 */
export const LEAF_FILL: Record<LeafColor, string> = { green: '#16a34a', yellow: '#e5c100' };

/** 싹 튼 씨앗이 생긴 뒤 경과일에 따른 씨 하나의 단계: 0 씨, 1 뿌리가 나옴, 2 떡잎이 나옴, 3 본잎 */
export type SeedStage = 0 | 1 | 2 | 3;
export const STAGE_NAMES: Record<SeedStage, string> = { 0: '씨', 1: '뿌리가 나옴', 2: '떡잎이 나옴', 3: '본잎' };
export const COTYLEDON_DAY = 1;
export const TRUE_LEAF_DAY = 3;

/** 그 그릇에서 가장 빨리 싹 튼 씨앗의 경과(줄기 길이 ÷ 하루 자라는 길이)로 정한다. 싹이 안 텄으면 씨 그대로. */
export function seedStage(s: GerminationSample, light: LightKind): SeedStage {
  if (s.sprouted < 0.5) return 0;
  const elapsed = s.stemMm / STEM_MM_PER_DAY[light];
  return elapsed >= TRUE_LEAF_DAY ? 3 : elapsed >= COTYLEDON_DAY ? 2 : 1;
}

/** 지금 화면에 보이는 그릇에서 떡잎 색(싹이 하나도 안 텄으면 null) */
export function shownLeafColor(s: GerminationSample, light: LightKind): LeafColor | null {
  if (s.sprouted < 0.5) return null;
  return light === 'bright' ? 'green' : 'yellow';
}

/** 날짜(일)를 "7", "3.5"로 */
export const dayText = (t: number) => String(Number(t.toFixed(1)));

/** 온도 글자: 5 °C 이하는 냉장고, 25 °C 이상은 따뜻한 곳, 나머지는 실온 */
export function tempPlace(tempC: number): 'cold' | 'room' | 'warm' {
  return tempC <= 10 ? 'cold' : tempC >= 25 ? 'warm' : 'room';
}
export const TEMP_PLACE_TEXT = { cold: '냉장고', room: '실온', warm: '따뜻한 곳' } as const;
