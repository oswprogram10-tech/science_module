import {
  HT_SAME_S,
  interpolateHeatTransfer,
  simulateHeatTransfer,
  validateHeatTransferExperiment,
  type HeatTransferParams,
  type HeatTransferResult,
  type HeatTransferSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { HeatTransferBarsView } from './HeatTransferBarsView';
import { HeatTransferMacroView } from './HeatTransferMacroView';
import { pathText, transferResult } from './initial';

export const heatTransferModule: ExperimentModule<HeatTransferSample, HeatTransferResult> = {
  kind: 'heat-transfer',
  validate: validateHeatTransferExperiment,
  simulate: (values) => simulateHeatTransfer(values as unknown as HeatTransferParams),
  interpolate: interpolateHeatTransfer,
  // 그래프는 sampleKey(색이 바뀐 붙임딱지 비율 pct)를 시간에 따라 그린다. 예측 비교는 결과의 time(가장 먼 곳까지 걸린 시간, 초)으로 하고, 0.5초 안이면 같은 결과로 본다.
  // 열이 퍼진 모습(범주)은 숫자가 아니라 결과 열에만 쓴다. 시행끼리 견주는 막대 그래프는 둘째 그림(HeatTransferBarsView)이 그린다.
  metric: { sampleKey: 'pct', resultKey: 'time', sameThreshold: () => HT_SAME_S },
  graph: {
    yLabel: '색이 바뀐 비율(%)',
    // 0~100 % 고정, 가로는 0~130초(철판 120초까지 담는다)
    yTicks: [0, 25, 50, 75, 100],
    xLabel: '시간(초)',
    xTicks: [0, 65, 130],
  },
  resultColumns: () => [
    { label: '가장 먼 곳까지 걸린 시간(초)', value: (r) => String(r.time) },
    { label: '열이 퍼진 모습', value: pathText },
  ],
  // 가상 초시계: 가장 먼 곳까지 열이 전해진 시간에서 멈춘다. 실험 전에는 0.
  sensors: (snapshot, values) => [{ id: 'stopwatch', label: '가상 초시계', unit: '초', kind: 'time', source: snapshot ? Math.min(snapshot.t, transferResult(values).time) : 0 }],
  MacroView: HeatTransferMacroView,
  MicroView: HeatTransferBarsView,
};

