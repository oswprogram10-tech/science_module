import {
  LS_SAME_PCT,
  interpolateLandSeaDots,
  simulateLandSeaDots,
  validateLandSeaDotsExperiment,
  type LandSeaDotsResult,
  type LandSeaDotsSample,
} from '@sci/engine-earth';
import type { ExperimentModule } from '../types';
import { LandSeaMacroView } from './LandSeaMacroView';
import { LandSeaMapView } from './LandSeaMapView';
import { counterPct, landText, seaPctText, seaText, toParams } from './initial';

export const landSeaDotsModule: ExperimentModule<LandSeaDotsSample, LandSeaDotsResult> = {
  kind: 'land-sea-dots',
  validate: validateLandSeaDotsExperiment,
  simulate: (values) => simulateLandSeaDots(toParams(values)),
  interpolate: interpolateLandSeaDots,
  // 그래프는 sampleKey(지금까지의 바다 비율 seaPct)를 그린다. 예측 비교는 결과의 seaPct(바다에 떨어진 점의 비율, %)로 하고, 1 %p 안이면 같은 결과로 본다.
  metric: { sampleKey: 'seaPct', resultKey: 'seaPct', sameThreshold: () => LS_SAME_PCT },
  graph: {
    yLabel: '지금까지 바다 비율(%)',
    yTicks: [0, 20, 40, 60, 80, 100],
    // 가로축은 찍은 점 순서: 점이 늘면서 비율이 흔들리다 자리 잡는다. 눈금은 시행의 점 수에 맞춰 자동으로 잡는다.
    xLabel: '찍은 점 순서(번째)',
  },
  resultColumns: () => [
    { label: '바다에 떨어진 점의 비율(%)', value: seaPctText },
    { label: '바다에 떨어진 점(개)', value: seaText },
    { label: '육지에 떨어진 점(개)', value: landText },
  ],
  // 가상 계수기: 지금까지의 바다 비율(%). 점이 없으면 0.
  sensors: (snapshot) => [{ id: 'dot-counter', label: '가상 계수기: 바다 점 비율', ariaLabel: '바다 점 비율', unit: '%', kind: 'humidity', source: counterPct(snapshot), decimals: 0 }],
  MacroView: LandSeaMacroView,
  MicroView: LandSeaMapView,
};
