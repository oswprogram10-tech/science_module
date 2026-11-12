import {
  TH_SAME_C,
  interpolateThermometer,
  simulateThermometer,
  validateThermometerExperiment,
  type ThermometerParams,
  type ThermometerResult,
  type ThermometerSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { ThermometerBarsView } from './ThermometerBarsView';
import { ThermometerMacroView } from './ThermometerMacroView';
import { feelText } from './initial';

export const thermometerModule: ExperimentModule<ThermometerSample, ThermometerResult> = {
  kind: 'thermometer',
  validate: validateThermometerExperiment,
  simulate: (values) => simulateThermometer(values as unknown as ThermometerParams),
  interpolate: interpolateThermometer,
  // 그래프는 sampleKey(온도계 눈금 level)를 그린다. 예측 비교는 결과의 reading(온도계 눈금, °C)으로 하고, 0.5 °C 안이면 같은 결과로 본다.
  // 손 느낌(범주)은 숫자가 아니라 결과 열에만 쓴다. 시행끼리 견주는 막대 그래프는 둘째 그림(ThermometerBarsView)이 그린다.
  metric: { sampleKey: 'level', resultKey: 'reading', sameThreshold: () => TH_SAME_C },
  graph: {
    yLabel: '온도계 눈금(°C)',
    // 0~40 °C 고정: 눈금은 20 °C에서 시작해 읽은 값까지 오른다.
    yTicks: [0, 10, 20, 30, 40],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
  },
  resultColumns: () => [
    { label: '온도계 눈금(°C)', value: (r) => String(r.reading) },
    { label: '손 느낌', value: feelText },
  ],
  // 가상 온도계: 재는 것의 실제 온도(눈높이의 어긋남 없음). 눈금이 정수라 값을 정수로 반올림해 넘긴다: 잡음(±0.2 °C)이 정수 표시를 바꾸지 않고, 다 오른 뒤에도 마지막 정수가 그대로 보인다. 실험 전에는 20 °C.
  sensors: (snapshot) => [{ id: 'thermometer', label: '가상 온도계', unit: '°C', kind: 'temperature', source: snapshot ? Math.round(snapshot.trueC) : 20, decimals: 0 }],
  MacroView: ThermometerMacroView,
  MicroView: ThermometerBarsView,
};
