import {
  interpolateAcidBaseMix,
  simulateAcidBaseMix,
  validateAcidBaseMixExperiment,
  type AcidBaseMixParams,
  type AcidBaseMixResult,
  type AcidBaseMixSample,
} from '@sci/engine-matter';
import type { ExperimentModule } from '../types';
import { MixMacroView } from './MixMacroView';
import { MixStripView } from './MixStripView';
import { colorName } from './initial';

export const acidBaseMixModule: ExperimentModule<AcidBaseMixSample, AcidBaseMixResult> = {
  kind: 'acid-base-mix',
  validate: validateAcidBaseMixExperiment,
  simulate: (values) => simulateAcidBaseMix(values as unknown as AcidBaseMixParams),
  interpolate: interpolateAcidBaseMix,
  // 그래프는 sampleKey(그때 지시약 색이 색 띠에서 몇 번째 칸인가, slot)를 그린다. 예측 비교는 결과의 slot으로 하고, 한 칸 아래 차이는 같은 결과로 본다(0.5).
  // 지시약 색 이름(범주)은 숫자가 아니라 결과 열과 색 띠 기록(둘째 그림)에 쓴다.
  metric: { sampleKey: 'slot', resultKey: 'slot', sameThreshold: () => 0.5 },
  graph: {
    yLabel: '색 띠에서의 자리(칸)',
    // 붉은 양배추 지시약의 색 띠 6칸까지 담도록 0~6 고정
    yTicks: [0, 1, 2, 3, 4, 5, 6],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2, 3],
    integerTicks: true,
  },
  resultColumns: () => [
    { label: '지시약 색', value: (r) => colorName(r.color) },
    { label: '넣은 양(mL)', value: (r) => r.addedMl.toFixed(1) },
    { label: '색 띠에서의 자리(칸)', value: (r) => String(r.slot) },
  ],
  // 이 활동에는 가상 센서가 없다(색은 눈으로 본다).
  sensors: () => [],
  MacroView: MixMacroView,
  MicroView: MixStripView,
};
