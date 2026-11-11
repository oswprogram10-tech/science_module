import {
  HEAT_CUPS,
  HEAT_LABELS,
  simulateHeatContact,
  type HeatContactParams,
  type HeatContactResult,
  type HeatContactSample,
  type HeatCup,
  type HeatLabel,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): HeatContactParams => {
  const hot = Number(values.hotC);
  const cold = Number(values.coldMl);
  return {
    hotC: hot === 50 || hot === 70 ? hot : 60,
    coldMl: cold === 300 ? 300 : 100,
    cup: pick(HEAT_CUPS, values.cup, 'metal'),
    label: pick(HEAT_LABELS, values.label, 'yellow'),
  };
};

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const heatOutput = (values: Values) => simulateHeatContact(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 안쪽은 고른 처음 온도, 바깥은 20 °C */
export const startSample = (values: Values): HeatContactSample => heatOutput(values).samples[0]!;

export const heatResult = (values: Values): HeatContactResult => heatOutput(values).result;

export const CUP_TEXT: Record<HeatCup, string> = { metal: '얇은 금속 컵', plastic: '플라스틱 컵' };
export const LABEL_TEXT: Record<HeatLabel, string> = { yellow: '노랑', green: '초록' };

/** "두 온도 차가 1 °C 안이 된 때" 결과 칸 글자 */
export const sameMinText = (r: Pick<HeatContactResult, 'sameMin'>): string => (r.sameMin === null ? '20분 넘음' : String(r.sameMin));

/** 눈으로 보기 아래 문구 */
export const heatNote = (s: Pick<HeatContactSample, 't' | 'innerC' | 'outerC'>) => `${s.t.toFixed(1)}분 · 안쪽 ${s.innerC.toFixed(1)} °C · 바깥 ${s.outerC.toFixed(1)} °C`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
