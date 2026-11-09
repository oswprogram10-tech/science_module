import {
  interpolateLever,
  simulateLever,
  validateLeverExperiment,
  type LeverParams,
  type LeverResult,
  type LeverSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { leverOptions, sideText } from './initial';
import { LeverMacroView } from './LeverMacroView';
import { LeverTurnView } from './LeverTurnView';

export const leverBalanceModule: ExperimentModule<LeverSample, LeverResult> = {
  kind: 'lever-balance',
  validate: validateLeverExperiment,
  simulate: (values, exp) => simulateLever(values as unknown as LeverParams, leverOptions(exp)),
  interpolate: interpolateLever,
  // 예측 비교는 오른쪽 끝의 높이(cm)로 한다. 10 cm(수평)보다 높은지 낮은지가 늘었다·줄었다로 읽힌다.
  metric: { sampleKey: 'rightHeightCm', resultKey: 'rightHeightCm', sameThreshold: () => 1 },
  restPlayhead: 1,
  graph: {
    yLabel: '오른쪽 끝 높이(cm)',
    yMin: 0,
    // 높이는 0~20 cm로 고정한다(바닥 0, 수평 10, 반대쪽 끝 20).
    yTicks: [0, 5, 10, 15, 20],
    xLabel: '시간(초, 느린 화면)',
    xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    xTickFormat: (t) => t.toFixed(1),
  },
  resultColumns: () => [
    { label: '기울어진 쪽', value: (r) => sideText(r) },
    { label: '오른쪽 끝의 높이(cm)', value: (r) => String(r.rightHeightCm) },
  ],
  sensors: (snapshot) => [{ id: 'tilt', label: '가상 기울기 센서', unit: '°', kind: 'tilt', source: snapshot?.angleDeg ?? 0 }],
  MacroView: LeverMacroView,
  MicroView: LeverTurnView,
};
