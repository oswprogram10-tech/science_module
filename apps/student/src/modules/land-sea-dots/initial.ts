import {
  LS_DOTS,
  LS_GLOBES,
  LS_ROUNDS,
  landSeaPoints,
  simulateLandSeaDots,
  type LandSeaDotsParams,
  type LandSeaDotsResult,
  type LandSeaDotsSample,
  type LandSeaPoint,
  type LsGlobe,
} from '@sci/engine-earth';
import type { Values } from '@sci/gateway';

const pickNum = (list: readonly number[], v: unknown, fallback: number): number => (list.includes(Number(v)) ? Number(v) : fallback);

export const toParams = (values: Values): LandSeaDotsParams => ({
  dots: pickNum(LS_DOTS, values.dots, 10),
  round: pickNum(LS_ROUNDS, values.round, 1),
  globeColor: (LS_GLOBES as readonly string[]).includes(String(values.globeColor)) ? (values.globeColor as LsGlobe) : 'red',
});

/** 고른 조건 그대로의 점들과 결과 */
export const dotsOf = (values: Values): LandSeaPoint[] => {
  const p = toParams(values);
  return landSeaPoints(p.round, p.dots);
};
export const landSeaResult = (values: Values): LandSeaDotsResult => simulateLandSeaDots(toParams(values)).result;

export const ROUND_TEXT: Record<number, string> = { 1: '첫째', 2: '둘째', 3: '셋째' };
export const GLOBE_TEXT: Record<LsGlobe, string> = { red: '빨간색', blue: '파란색' };
export const GLOBE_FILL: Record<LsGlobe, string> = { red: '#dc2626', blue: '#2563eb' };

/** 지금까지 찍힌 점의 수: 실행 전은 0, 재생 중에는 샘플의 t까지, 스냅샷이 없는 실행 뒤에는 전부 */
export const shownCount = (ran: boolean, snapshot: LandSeaDotsSample | null, total: number): number => (!ran ? 0 : snapshot === null ? total : Math.min(total, Math.floor(snapshot.t + 1e-9)));

/** 앞의 n개 점 가운데 바다 점의 수 */
export const seaOf = (points: readonly LandSeaPoint[], n: number): number => points.slice(0, n).filter((p) => p.sea).length;

/** 눈으로 보기 아래 문구 */
export const dotsNote = (shown: number, sea: number) => `${shown}개 찍음 · 바다 ${sea}개(원) · 육지 ${shown - sea}개(세모)${shown > 0 ? ` · 바다 비율 ${Math.round((sea / shown) * 100)} %` : ''}`;

/** 가상 계수기(%): 지금까지의 바다 비율. 점이 없으면 0 */
export const counterPct = (snapshot: LandSeaDotsSample | null): number => (snapshot !== null && Number.isFinite(snapshot.seaPct) ? snapshot.seaPct : 0);

/** 결과 열 글자 */
export const seaPctText = (r: Pick<LandSeaDotsResult, 'seaPct'>) => String(r.seaPct);
export const seaText = (r: Pick<LandSeaDotsResult, 'sea'>) => String(r.sea);
export const landText = (r: Pick<LandSeaDotsResult, 'land'>) => String(r.land);
