import {
  PUSH_SAME_CM,
  interpolatePushPull,
  simulatePushPull,
  validatePushPullExperiment,
  type PushPullParams,
  type PushPullResult,
  type PushPullSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { directionText, distanceText, shapeText } from './initial';
import { PushMacroView } from './PushMacroView';
import { PushTapeView } from './PushTapeView';

export const pushPullModule: ExperimentModule<PushPullSample, PushPullResult> = {
  kind: 'push-pull',
  validate: validatePushPullExperiment,
  simulate: (values) => simulatePushPull(values as unknown as PushPullParams),
  interpolate: interpolatePushPull,
  // 그래프는 sampleKey(출발점에서 떨어진 거리 distanceCm)를 그린다. 예측 비교는 결과의 distance(움직인 거리, cm)로 하고, 0.5 cm 안이면 같은 결과로 본다.
  // 움직인 방향과 모양(범주)은 숫자가 아니라 결과 열에만 쓴다.
  metric: { sampleKey: 'distanceCm', resultKey: 'distance', sameThreshold: () => PUSH_SAME_CM },
  graph: {
    yLabel: '출발점에서 떨어진 거리(cm)',
    // 0~90 cm 고정: 수레를 세게 밀면 80 cm까지 간다.
    yTicks: [0, 30, 60, 90],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
  },
  resultColumns: () => [
    { label: '움직인 거리(cm)', value: distanceText },
    { label: '움직인 방향', value: directionText },
    { label: '모양', value: shapeText },
  ],
  // 가상 줄자: 출발점에서 물체까지의 거리(실험 전에는 0).
  sensors: (snapshot) => [{ id: 'tape-measure', label: '가상 줄자: 출발점에서 떨어진 거리', unit: 'cm', kind: 'distance', source: snapshot?.distanceCm ?? 0 }],
  MacroView: PushMacroView,
  MicroView: PushTapeView,
};
