import {
  GAS_SAME_G,
  interpolateGasWeight,
  simulateGasWeight,
  validateGasWeightExperiment,
  type GasWeightParams,
  type GasWeightResult,
  type GasWeightSample,
} from '@sci/engine-matter';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { firmText, weightText } from './initial';
import { GasGaugeView } from './GasGaugeView';
import { GasMacroView } from './GasMacroView';

export const gasWeightModule: ExperimentModule<GasWeightSample, GasWeightResult> = {
  kind: 'gas-weight',
  validate: validateGasWeightExperiment,
  simulate: (values) => simulateGasWeight(values as unknown as GasWeightParams),
  interpolate: interpolateGasWeight,
  // 그래프는 sampleKey(전자저울 무게 weight)를 그린다. 예측 비교는 결과의 weight(전자저울 무게, g)로 하고, 0.05 g 안이면 같은 결과로 본다.
  // 손으로 눌렀을 때(범주)는 숫자가 아니라 결과 열에만 쓴다.
  metric: { sampleKey: 'weight', resultKey: 'weight', sameThreshold: () => GAS_SAME_G },
  graph: {
    yLabel: '전자저울 무게(g)',
    // 45.0~47.0 g 고정: 처음 45.3 g에서 60번 눌러도 46.8 g이다.
    yMin: 45,
    yTicks: [45, 45.5, 46, 46.5, 47],
    // 가로축은 누른 횟수: 정한 횟수까지 누르고 나면 더 누르지 않아 선이 수평이 된다.
    xLabel: '누른 횟수(번)',
    xTicks: [0, 20, 40, 60],
  },
  resultColumns: () => [
    { label: '전자저울 무게(g)', value: weightText },
    { label: '손으로 눌렀을 때', value: firmText },
  ],
  // 가상 전자저울: 저울 위 병의 무게(소수 첫째 자리, 떨림 없음). 실험 전에는 0.
  sensors: (snapshot) => [{ id: 'bottle-scale', label: '가상 전자저울: 페트병', unit: 'g', kind: 'scale', source: (snapshot?.weight ?? 0) - BEAKER_G, decimals: 1 }],
  MacroView: GasMacroView,
  MicroView: GasGaugeView,
};
