import {
  HM_DIFFS,
  HM_DRYS,
  HM_PLACES,
  simulateHumidity,
  type HmDiff,
  type HmDry,
  type HmPlace,
  type HumidityParams,
  type HumidityResult,
  type HumiditySample,
} from '@sci/engine-earth';
import type { Values } from '@sci/gateway';

const pickNum = <T extends number>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly number[]).includes(Number(v)) ? (Number(v) as T) : fallback);
const pickStr = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): HumidityParams => ({
  dry: pickNum<HmDry>(HM_DRYS, values.dry, 20),
  diff: pickNum<HmDiff>(HM_DIFFS, values.diff, 0),
  place: pickStr<HmPlace>(HM_PLACES, values.place, 'white'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const humidityOutput = (values: Values) => simulateHumidity(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 두 온도계가 모두 건구 온도를 가리킨다. */
export const startSample = (values: Values): HumiditySample => humidityOutput(values).samples[0]!;

export const humidityResult = (values: Values): HumidityResult => humidityOutput(values).result;

export const PLACE_TEXT: Record<HmPlace, string> = { white: '흰 벽', gray: '회색 벽' };

/** 눈으로 보기 아래 문구 */
export const humidityNote = (s: Pick<HumiditySample, 't' | 'wetC' | 'rh'>) => `${s.t.toFixed(1)}초 · 습구 온도 ${s.wetC.toFixed(1)} °C · 습도 ${s.rh.toFixed(1)} %`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
