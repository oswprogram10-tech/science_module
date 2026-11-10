/**
 * 밀물과 썰물 근사 모델(교사 검수 대상).
 * 서해안 갯벌(예: 인천 앞바다)을 단순화한다. 하루에 밀물과 썰물이 두 번씩 있는 반일주조이다.
 * 바닷물 높이는 주기 12시간 25분의 코사인 곡선이고, 진폭은 3.5 m(높이 차이 약 7 m)이다.
 * 실제 바다의 날마다 달라지는 높이(대조·소조), 바람, 기압의 영향은 무시한다.
 */

/** 주기(시간): 12시간 25분. */
export const TIDE_PERIOD_H = 12.42;
/** 진폭(m). */
export const TIDE_AMPLITUDE_M = 3.5;
/** 하루 중 첫 번째로 바닷물이 가장 높은 시각(시). */
export const TIDE_HIGH_AT_H = 2;
/** 갯벌 높이(m). 바닷물 높이가 이보다 낮으면 갯벌이 드러난다. */
export const MUDFLAT_M = -1.5;
/** 바닷가 바위 윗부분 높이(m). 바닷물 높이가 이보다 높으면 바위가 잠긴다. */
export const ROCK_M = 1.5;

/** 시각 t(0~24시)의 바닷물 높이(m, 평균 해수면 기준). */
export const tideHeight = (t: number): number => TIDE_AMPLITUDE_M * Math.cos((2 * Math.PI * (t - TIDE_HIGH_AT_H)) / TIDE_PERIOD_H);

/** 높이가 오르는 중인가(조금 뒤의 높이가 지금보다 높다). 가장 높은 때는 막 내려가기 시작하는 것으로, 가장 낮은 때는 막 오르기 시작하는 것으로 본다. */
export const tideRising = (t: number): boolean => tideHeight(t + 0.01) > tideHeight(t);

/** 갯벌이 드러나 있는가. */
export const mudflatExposed = (t: number): boolean => tideHeight(t) < MUDFLAT_M;

/** 바닷가 바위가 물에 잠겨 있는가. */
export const rocksSubmerged = (t: number): boolean => tideHeight(t) > ROCK_M;

const SAMPLE_STEP_H = 0.01;
const samples = (): number[] => Array.from({ length: Math.round(24 / SAMPLE_STEP_H) + 1 }, (_, i) => tideHeight(i * SAMPLE_STEP_H));

/** 0~24시 사이에 높이가 극대인 횟수(양 끝은 세지 않는다). */
export function tideHighsPerDay(): number {
  const h = samples();
  let n = 0;
  for (let i = 1; i < h.length - 1; i++) if (h[i]! > h[i - 1]! && h[i]! >= h[i + 1]!) n++;
  return n;
}

/** 하루 중 가장 낮은 높이(m). */
export const lowestTideM = (): number => Math.min(...samples());

/** 하루 중 가장 낮은 때 드러나는 것: 갯벌 높이보다 낮으면 "mudflat", 아니면 "nothing". */
export const lowTideExposed = (): 'mudflat' | 'nothing' => (lowestTideM() < MUDFLAT_M ? 'mudflat' : 'nothing');
