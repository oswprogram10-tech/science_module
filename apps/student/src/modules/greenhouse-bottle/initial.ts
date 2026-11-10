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

/** 진짜 기온 자료 패널(ClimateDataPanel)의 화면 글. 까닭(원인)을 말하지 않는다. */
export const CLIMATE_DATA_TITLE = '진짜 기온 자료: 서울의 해마다 평균 기온';
export const CLIMATE_DATA_INTRO = '기상청이 서울에서 잰 해마다의 평균 기온이에요. 오래전과 요즘을 비교해 볼까요?';
export const CLIMATE_DATA_QUESTION = '처음 30년과 최근 30년의 평균 기온은 얼마나 다른가요? 해마다 오르내림이 있는데도 긴 기간을 보면 어떤가요?';
export const CLIMATE_DATA_CAUTION = '서울은 도시가 커지면서 더 따뜻해진 부분도 있어요. 기온이 달라진 까닭은 한 가지로 정할 수 없어요.';
export const CLIMATE_DATA_SOURCE = '출처: 기상청 기상자료개방포털, 서울(지점 108) 연평균기온, 1908~2025년. 공공누리 제1유형.';
export const CLIMATE_DATA_TABLE_SUMMARY = '표로 보기';
export const CLIMATE_DATA_TABLE_CAPTION = '서울 10년 평균 기온';
export const CLIMATE_DATA_TABLE_HEADS = ['기간', '평균 기온(°C)'] as const;
export const CLIMATE_DATA_X_LABEL = '연도';
export const CLIMATE_DATA_Y_LABEL = '평균 기온(°C)';
export const CLIMATE_DATA_NO_DATA = '자료 없음(1950~1953)';
export const climateDataFirstLabel = (shown: string) => `처음 30년 평균 ${shown} °C`;
export const climateDataLastLabel = (shown: string) => `최근 30년 평균 ${shown} °C`;
export const climateDataAria = (first: string, last: string) => `서울의 해마다 평균 기온, 1908년부터 2025년까지. 처음 30년 평균 ${first}도, 최근 30년 평균 ${last}도.`;
