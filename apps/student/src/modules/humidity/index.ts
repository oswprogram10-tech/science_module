import {
  HM_SAME_RH,
  interpolateHumidity,
  simulateHumidity,
  validateHumidityExperiment,
  type HumidityParams,
  type HumidityResult,
  type HumiditySample,
} from '@sci/engine-earth';
import type { ExperimentModule } from '../types';
import { HumidityBarsView } from './HumidityBarsView';
import { HumidityMacroView } from './HumidityMacroView';
import { WeekLog } from './WeekLog';

export const humidityModule: ExperimentModule<HumiditySample, HumidityResult> = {
  kind: 'humidity',
  validate: validateHumidityExperiment,
  simulate: (values) => simulateHumidity(values as unknown as HumidityParams),
  interpolate: interpolateHumidity,
  // 그래프와 예측 비교는 습도(%)이다. 0.5 % 안이면 같은 결과로 본다. 시행끼리 견주는 막대 그래프는 둘째 그림(HumidityBarsView)이 그린다.
  metric: { sampleKey: 'rh', resultKey: 'rh', sameThreshold: () => HM_SAME_RH },
  graph: {
    yLabel: '습도(%)',
    // 습도 100 %까지 담도록 0~100 고정
    yTicks: [0, 20, 40, 60, 80, 100],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
  },
  resultColumns: () => [
    { label: '습도(%)', value: (r) => String(r.rh) },
    { label: '습구 온도(°C)', value: (r) => String(r.wet) },
  ],
  // 가상 습도계: 습도표에서 찾은 습도(%). 실험 전에는 0.
  sensors: (snapshot) => [{ id: 'hygrometer', label: '가상 습도계: 습도', unit: '%', kind: 'humidity', source: snapshot?.rh ?? 0 }],
  // 결과표 아래 일주일 날씨 기록(예시 자료, manifest의 params.weekLog)
  ResultsExtra: WeekLog,
  MacroView: HumidityMacroView,
  MicroView: HumidityBarsView,
};
