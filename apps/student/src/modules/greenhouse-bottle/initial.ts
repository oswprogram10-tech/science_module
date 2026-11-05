import { GREENHOUSE_START_C, simulateGreenhouse, type AirKind, type CapKind, type CoverKind, type GreenhouseParams, type GreenhouseResult, type GreenhouseSample } from '@sci/engine-ssi';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const greenhouseOptions = (exp?: VariableExperiment) => ({
  totalMin: typeof exp?.params?.totalMin === 'number' ? exp.params.totalMin : undefined,
});

export const toParams = (values: Values): GreenhouseParams => ({
  cover: (values.cover === 'film' ? 'film' : 'none') satisfies CoverKind,
  air: (values.air === 'co2' ? 'co2' : 'normal') satisfies AirKind,
  cap: (values.cap === 'blue' ? 'blue' : 'white') satisfies CapKind,
});

export const greenhouseOutput = (values: Values, exp?: VariableExperiment) => simulateGreenhouse(toParams(values), greenhouseOptions(exp));

export const greenhouseResult = (values: Values, exp?: VariableExperiment): GreenhouseResult => greenhouseOutput(values, exp).result;

/** 실험 전(0분): 처음 온도뿐이다. 조건에 따라 달라지지 않는 시작 상태라 결과를 드러내지 않는다. */
export const IDLE_SAMPLE: GreenhouseSample = { t: 0, temp: GREENHOUSE_START_C, rise: 0, trapped: 0 };

/** 오른 온도는 화면에 보이는 온도 − 22로 정해, 두 숫자가 언제나 맞는다. */
export const shownTemp = (s: Pick<GreenhouseSample, 'temp'>) => s.temp.toFixed(1);
export const shownRise = (s: Pick<GreenhouseSample, 'temp'>) => (Number(shownTemp(s)) - GREENHOUSE_START_C).toFixed(1);

/** 결과표의 오른 온도: 양수에는 + 기호를 붙인다. */
export const signedRise = (rise: number) => (rise > 0 ? `+${rise.toFixed(1)}` : rise.toFixed(1));

/** 눈으로 보기 아래 문구 */
export const bottleNote = (s: Pick<GreenhouseSample, 't' | 'temp'>) => `${s.t.toFixed(1)}분 · 병 속 ${shownTemp(s)} °C (처음보다 +${shownRise(s)} °C)`;

export const IDLE_NOTE = '실험하면 병 속 온도가 어떻게 달라지는지 볼 수 있어요.';
export const FLOW_IDLE_NOTE = '실험하면 빛과 열이 드나드는 모습을 볼 수 있어요.';
/** 열이 드나드는 모습 아래 문구(화면 설명) */
export const FLOW_NOTE = '공기층은 담요처럼 열이 빠져나가는 것을 늦춰요.';
export const LIMITS_TITLE = '모형의 한계';
export const LIMITS_TEXT = '실제 지구는 병보다 훨씬 크고, 바다·구름·숲 같은 많은 것이 함께 영향을 줘요.';

/** 빠져나가려는 열 화살표 수와, 그중 되돌아오는 수(trapped에 비례) */
export const HEAT_COUNT = 8;
export const RETURN_MAX = 6;
export const returningCount = (trapped: number) => Math.round(RETURN_MAX * Math.min(1, Math.max(0, trapped)));

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
