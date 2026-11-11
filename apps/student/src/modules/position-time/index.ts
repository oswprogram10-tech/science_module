import {
  PT_SAME_M,
  interpolatePositionTime,
  simulatePositionTime,
  validatePositionTimeExperiment,
  type PositionTimeParams,
  type PositionTimeResult,
  type PositionTimeSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { metersText } from './initial';
import { PositionLogView } from './PositionLogView';
import { PositionMacroView } from './PositionMacroView';

export const positionTimeModule: ExperimentModule<PositionTimeSample, PositionTimeResult> = {
  kind: 'position-time',
  validate: validatePositionTimeExperiment,
  simulate: (values) => simulatePositionTime(values as unknown as PositionTimeParams),
  interpolate: interpolatePositionTime,
  // 그래프는 sampleKey(출발 위치에서의 위치 posM)를 그린다. 예측 비교는 결과의 distM(움직인 거리, m)로 하고, 0.005 m 안이면 같은 결과로 본다.
  metric: { sampleKey: 'posM', resultKey: 'distM', sameThreshold: () => PT_SAME_M },
  graph: {
    yLabel: '위치(m)',
    // 자전거가 10초 동안 가는 거리(40 m)까지 담도록 0~40 고정
    yTicks: [0, 10, 20, 30, 40],
    xLabel: '시간(초)',
    xTicks: [0, 2, 4, 6, 8, 10],
  },
  resultColumns: () => [
    { label: '움직인 거리(m)', value: (r) => metersText(r.distM) },
    { label: '나중 위치(m)', value: (r) => metersText(r.endM) },
  ],
  // 이 활동에는 가상 센서가 없다. 거리 센서의 눈금은 소수 첫째 자리라 달팽이가 움직인 0.05 m를 읽을 수 없고, 위치는 위치 기록표와 그래프로 본다.
  sensors: () => [],
  MacroView: PositionMacroView,
  MicroView: PositionLogView,
};
