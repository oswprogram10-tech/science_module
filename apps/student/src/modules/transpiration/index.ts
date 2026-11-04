import {
  interpolateTranspiration,
  simulateTranspiration,
  validateTranspirationExperiment,
  type TranspirationParams,
  type TranspirationResult,
  type TranspirationSample,
} from '@sci/engine-life';
import type { ExperimentModule } from '../types';
import { LIGHT_PCT, dropletsText, humidityPct, lightOf, lostText, remainingText, transpirationOptions } from './initial';
import { CylinderMacroView } from './CylinderMacroView';
import { LeafMicroView } from './LeafMicroView';

export const transpirationModule: ExperimentModule<TranspirationSample, TranspirationResult> = {
  kind: 'transpiration',
  validate: validateTranspirationExperiment,
  simulate: (values, exp) => simulateTranspiration(values as unknown as TranspirationParams, transpirationOptions(exp)),
  interpolate: interpolateTranspiration,
  // 예측 비교는 이틀 동안 줄어든 물의 양으로, 그래프는 시간에 따른 남은 물의 양으로 그린다.
  metric: { sampleKey: 'remainingMl', resultKey: 'lostMl', sameThreshold: () => 0.5 },
  restPlayhead: 48,
  graph: {
    yLabel: '남은 물의 양(mL)',
    yMin: 0,
    xLabel: '시간(시간)',
    xTicks: [0, 12, 24, 36, 48],
    xTickFormat: (t) => String(t),
    markers: [{ t: 24, label: '하루' }],
  },
  resultColumns: () => [
    { label: '이틀 동안 줄어든 물(mL)', value: (r) => lostText(r) },
    { label: '남은 물(mL)', value: (r) => remainingText(r) },
    { label: '비닐봉지 속 물방울', value: (r) => dropletsText(r) },
  ],
  sensors: (snapshot, values) => [
    { id: 'humidity', label: '가상 습도 센서: 비닐봉지 안', unit: '%', kind: 'humidity', source: humidityPct(snapshot?.fog ?? 0) },
    { id: 'light', label: '가상 빛 센서', unit: '%', kind: 'light', source: LIGHT_PCT[lightOf(values)] },
  ],
  MacroView: CylinderMacroView,
  MicroView: LeafMicroView,
};
