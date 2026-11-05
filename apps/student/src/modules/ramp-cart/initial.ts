import { arrivalS, simulateRamp, type CartLoad, type FloorKind, type RampParams, type RampResult, type RampSample } from '@sci/engine-physics';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const rampOptions = (exp?: VariableExperiment) => ({
  durationS: typeof exp?.params?.durationS === 'number' ? exp.params.durationS : undefined,
});

export const toParams = (values: Values): RampParams => ({
  heightCm: Number(values.heightCm),
  floor: values.floor === 'towel' ? 'towel' : 'wood',
  load: values.load === 2 ? 2 : 0,
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const rampOutput = (values: Values, exp?: VariableExperiment) => simulateRamp(toParams(values), rampOptions(exp));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): RampSample => rampOutput(values, exp).samples[0]!;

export const rampResult = (values: Values, exp?: VariableExperiment): RampResult => rampOutput(values, exp).result;

export const FLOOR_TEXT: Record<FloorKind, string> = { wood: '나무 판', towel: '수건을 깐 바닥' };
export const LOAD_TEXT: Record<CartLoad, string> = { 0: '없음', 2: '2개' };

/** 이 시각에 수레가 1 m를 지났는지 */
export const passed1m = (t: number, values: Values): boolean => t >= arrivalS(toParams(values)) - 1e-9;

/** 숫자 문구: 거리는 소수 둘째 자리, 시각은 소수 첫째 자리 */
export const metersText = (x: number) => x.toFixed(2);
export const secondsText = (t: number) => t.toFixed(1);

/** 눈으로 보기 아래 문구. 1 m를 지난 뒤에는 걸린 시간을 덧붙인다. */
export const rampNote = (s: Pick<RampSample, 't' | 'x'>, values: Values, exp?: VariableExperiment): string => {
  const base = `${secondsText(s.t)}초 · 출발선에서 ${metersText(s.x)} m`;
  return passed1m(s.t, values) ? `${base} · 1 m까지 ${rampResult(values, exp).timeS.toFixed(2)}초` : base;
};
