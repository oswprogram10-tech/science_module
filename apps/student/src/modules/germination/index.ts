import {
  interpolateGermination,
  simulateGermination,
  validateGerminationExperiment,
  type GerminationParams,
  type GerminationResult,
  type GerminationSample,
} from '@sci/engine-life';
import type { ExperimentModule } from '../types';
import { firstDayText, germinationOptions, leafColorText, sproutedText } from './initial';
import { GerminationMacroView } from './GerminationMacroView';
import { SeedMicroView } from './SeedMicroView';

/** 가상 빛 센서 값(%): 밝은 곳과 어두운 곳(상자를 덮음) */
const LIGHT_PCT = { bright: 80, dark: 2 } as const;

export const germinationModule: ExperimentModule<GerminationSample, GerminationResult> = {
  kind: 'germination',
  validate: validateGerminationExperiment,
  simulate: (values, exp) => simulateGermination(values as unknown as GerminationParams, germinationOptions(exp)),
  interpolate: interpolateGermination,
  // 예측 비교는 7일째 싹 튼 씨앗 수로, 그래프는 날마다 싹 튼 씨앗 수로 그린다.
  metric: { sampleKey: 'sprouted', resultKey: 'sproutedDay7', sameThreshold: () => 0.5 },
  restPlayhead: 7,
  graph: {
    yLabel: '싹 튼 씨앗 수(개)',
    yMin: 0,
    integerTicks: true,
    xLabel: '날짜(일)',
    xTicks: [0, 2, 4, 6, 8, 10],
    xTickFormat: (t) => String(t),
    markers: [{ t: 7, label: '7일째' }],
  },
  resultColumns: () => [
    { label: '7일째 싹 튼 씨앗 수(개)', value: (r) => sproutedText(r) },
    { label: '처음 싹 튼 날(일)', value: (r) => firstDayText(r) },
    { label: '떡잎 색', value: (r) => leafColorText(r) },
  ],
  sensors: (_snapshot, values) => [
    { id: 'temp', label: '가상 온도계', unit: '°C', kind: 'temperature', source: Number(values.tempC) },
    { id: 'light', label: '가상 빛 센서', unit: '%', kind: 'light', source: values.light === 'dark' ? LIGHT_PCT.dark : LIGHT_PCT.bright },
  ],
  MacroView: GerminationMacroView,
  MicroView: SeedMicroView,
};
