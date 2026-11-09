import {
  interpolateFoodWeb,
  simulateFoodWeb,
  validateFoodWebExperiment,
  type FoodWebParams,
  type FoodWebResult,
  type FoodWebSample,
} from '@sci/engine-life';
import type { ExperimentModule } from '../types';
import { foodWebOptions, foxesText, grassText, rabbitsMaxText, rabbitsText } from './initial';
import { FieldMacroView } from './FieldMacroView';
import { FoodWebMicroView } from './FoodWebMicroView';

export const foodWebModule: ExperimentModule<FoodWebSample, FoodWebResult> = {
  kind: 'food-web',
  validate: validateFoodWebExperiment,
  simulate: (values, exp) => simulateFoodWeb(values as unknown as FoodWebParams, foodWebOptions(exp)),
  interpolate: interpolateFoodWeb,
  // 예측 비교는 60일 뒤 풀의 양으로, 그래프는 풀·토끼·여우 세 선으로 그린다. 앞 시행은 풀만 겹쳐 그린다.
  metric: { sampleKey: 'grassPct', resultKey: 'grassDay60', sameThreshold: () => 2 },
  restPlayhead: 60,
  graph: {
    yLabel: '수(마리) / 풀의 양(%)',
    yMin: 0,
    yTicks: [0, 20, 40, 60, 80, 100],
    xLabel: '날짜(일)',
    xTicks: [0, 10, 20, 30, 40, 50, 60],
    xTickFormat: (t) => String(t),
    series: [
      { key: 'grassPct', label: '풀의 양(%)', color: '#16a34a' },
      { key: 'rabbits', label: '토끼 수(마리)', color: '#d97706', dash: '7 4' },
      { key: 'foxes', label: '여우 수(마리)', color: '#9333ea', dash: '2 4' },
    ],
  },
  resultColumns: () => [
    { label: '60일 뒤 풀(%)', value: (r) => grassText(r) },
    { label: '60일 뒤 토끼(마리)', value: (r) => rabbitsText(r) },
    { label: '60일 뒤 여우(마리)', value: (r) => foxesText(r) },
    { label: '가장 많았던 토끼(마리)', value: (r) => rabbitsMaxText(r) },
  ],
  // 이 단원에는 센서가 없다. App은 센서가 없으면 센서 막대를 그리지 않는다.
  sensors: () => [],
  MacroView: FieldMacroView,
  MicroView: FoodWebMicroView,
};
