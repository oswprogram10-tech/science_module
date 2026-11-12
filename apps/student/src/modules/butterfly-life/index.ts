import {
  BL_SAME_MM,
  interpolateButterflyLife,
  simulateButterflyLife,
  validateButterflyLifeExperiment,
  type ButterflyLifeResult,
  type ButterflyLifeSample,
} from '@sci/engine-life';
import type { ExperimentModule } from '../types';
import { ButterflyMacroView } from './ButterflyMacroView';
import { ButterflyRecordView } from './ButterflyRecordView';
import { eatText, lengthText, moveText, rulerCm, toParams, wingsText } from './initial';

export const butterflyLifeModule: ExperimentModule<ButterflyLifeSample, ButterflyLifeResult> = {
  kind: 'butterfly-life',
  validate: validateButterflyLifeExperiment,
  simulate: (values) => simulateButterflyLife(toParams(values)),
  interpolate: interpolateButterflyLife,
  // 그래프는 sampleKey(몸 길이 length)를 그린다. 관찰한 날에만 값이 있어 선 대신 그 날의 세로 표식을 쓰고(markers), 지금까지 관찰한 날의 점은 둘째 그림(ButterflyRecordView)이 잇는다.
  // 예측 비교는 결과의 length(몸 길이, mm)로 하고, 0.5 mm 안이면 같은 결과로 본다.
  metric: { sampleKey: 'length', resultKey: 'length', sameThreshold: () => BL_SAME_MM },
  graph: {
    yLabel: '몸 길이(mm)',
    yTicks: [0, 10, 20, 30],
    // 가로축은 관찰한 날(일): 관찰한 날에서 멈추고, 관찰하지 않은 날은 그리지 않는다.
    xLabel: '관찰한 날(일째)',
    xTicks: [0, 5, 10, 15, 20, 25, 30],
    markers: (_exp, trial) => {
      const last = trial.samples[trial.samples.length - 1];
      return last ? [{ t: last.t, label: `${last.t}일째 · ${trial.result.length} mm` }] : [];
    },
  },
  resultColumns: () => [
    { label: '몸 길이(mm)', value: lengthText },
    { label: '먹이를 먹나요', value: eatText },
    { label: '움직이나요', value: moveText },
    { label: '날개', value: wingsText },
  ],
  // 가상 자: 관찰한 날에 닿은 뒤의 몸 길이. 거리 센서는 cm로 읽으므로 source는 mm ÷ 10(cm)이고, display로 10배 해 mm로 보여 준다(28 mm = 2.8 cm → "28 mm"). 실험 전에는 0.
  sensors: (snapshot) => [{ id: 'body-ruler', label: '가상 자: 몸 길이', unit: 'mm', kind: 'distance', source: rulerCm(snapshot), decimals: 0, display: { scale: 10, unitLabel: 'mm' } }],
  MacroView: ButterflyMacroView,
  MicroView: ButterflyRecordView,
};
