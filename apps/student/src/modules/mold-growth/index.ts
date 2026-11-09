import {
  interpolateMold,
  simulateMold,
  validateMoldExperiment,
  type MoldParams,
  type MoldResult,
  type MoldSample,
} from '@sci/engine-life';
import type { ExperimentModule } from '../types';
import { HUMIDITY_PCT, cover10Text, cover7Text, firstDayText, moistureOf, moldOptions } from './initial';
import { MoldMacroView } from './MoldMacroView';
import { MoldMicroView } from './MoldMicroView';

export const moldGrowthModule: ExperimentModule<MoldSample, MoldResult> = {
  kind: 'mold-growth',
  validate: validateMoldExperiment,
  simulate: (values, exp) => simulateMold(values as unknown as MoldParams, moldOptions(exp)),
  interpolate: interpolateMold,
  // 예측 비교는 7일째 덮은 넓이로, 그래프는 날마다 덮은 넓이로 그린다.
  metric: { sampleKey: 'coverPct', resultKey: 'cover7', sameThreshold: () => 2 },
  restPlayhead: 7,
  graph: {
    yLabel: '곰팡이가 덮은 넓이(%)',
    yMin: 0,
    // 곰팡이 넓이는 0~100%로 고정한다. 자동 축이면 냉장고의 2%가 크게 자란 것처럼 보인다.
    yTicks: [0, 20, 40, 60, 80, 100],
    xLabel: '날짜(일)',
    xTicks: [0, 2, 4, 6, 8, 10],
    xTickFormat: (t) => String(t),
    markers: [{ t: 7, label: '7일째' }],
  },
  resultColumns: () => [
    { label: '7일째 곰팡이 넓이(%)', value: (r) => cover7Text(r) },
    { label: '10일째 넓이(%)', value: (r) => cover10Text(r) },
    { label: '처음 보인 날(일)', value: (r) => firstDayText(r) },
  ],
  sensors: (_snapshot, values) => [
    { id: 'temp', label: '가상 온도계', unit: '°C', kind: 'temperature', source: Number(values.tempC) },
    { id: 'humidity', label: '가상 습도 센서: 봉지 안', unit: '%', kind: 'humidity', source: HUMIDITY_PCT[moistureOf(values)] },
  ],
  MacroView: MoldMacroView,
  MicroView: MoldMicroView,
};
