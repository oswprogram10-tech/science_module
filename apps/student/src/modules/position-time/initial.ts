import {
  PT_OBJECTS,
  PT_WEATHER,
  simulatePositionTime,
  type PositionTimeParams,
  type PositionTimeResult,
  type PositionTimeSample,
  type PtObject,
  type PtWeather,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): PositionTimeParams => ({
  object: pick(PT_OBJECTS, values.object, 'bike'),
  watchS: Number(values.watchS) === 10 ? 10 : 5,
  weather: pick(PT_WEATHER, values.weather, 'sunny'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const positionOutput = (values: Values) => simulatePositionTime(toParams(values));

export const positionResult = (values: Values): PositionTimeResult => positionOutput(values).result;

export const OBJECT_TEXT: Record<PtObject, string> = { bike: '자전거', walker: '걷는 사람', snail: '달팽이', tree: '나무' };
export const WEATHER_TEXT: Record<PtWeather, string> = { sunny: '맑음', cloudy: '흐림' };

/** 눈금자의 끝(m): 물체마다 10초 동안 움직이는 거리에 맞춘다(자전거 40, 걷는 사람 12, 달팽이 0.1, 나무는 움직이지 않으므로 1). */
export const RULER_MAX: Record<PtObject, number> = { bike: 40, walker: 12, snail: 0.1, tree: 1 };

/** 눈금자 눈금 글자: 0, 가운데, 끝 */
export const rulerTicks = (object: PtObject): number[] => [0, RULER_MAX[object] / 2, RULER_MAX[object]];

/** 위치(m)는 소수 둘째 자리로 쓴다. */
export const metersText = (x: number): string => x.toFixed(2);
export const secondsText = (t: number): string => t.toFixed(1);

/** 눈으로 보기 아래 문구 */
export const positionNote = (s: Pick<PositionTimeSample, 't' | 'posM'> | null, watchS: number): string =>
  s ? `관찰 ${watchS}초 중 ${secondsText(s.t)}초 · 출발 위치에서 ${metersText(s.posM)} m` : `관찰 시간 ${watchS}초. 실험하면 1초마다 물체의 위치가 겹쳐 그려져요.`;
