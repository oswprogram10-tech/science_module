import {
  START_HEIGHT_CM,
  interpolateMagnet,
  simulateMagnet,
  validateMagnetExperiment,
  type MagnetParams,
  type MagnetResult,
  type MagnetSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { magnetOptions } from './initial';
import { ClipMacroView } from './ClipMacroView';
import { ClipReachView } from './ClipReachView';

export const magnetDistanceModule: ExperimentModule<MagnetSample, MagnetResult> = {
  kind: 'magnet-distance',
  validate: validateMagnetExperiment,
  simulate: (values, exp) => simulateMagnet(values as unknown as MagnetParams, magnetOptions(exp)),
  interpolate: interpolateMagnet,
  // 예측 비교는 끌려온 클립 수로 한다. 개수이므로 1개만 달라도 다른 결과로 본다.
  metric: { sampleKey: 'clipsHeld', resultKey: 'clips', sameThreshold: () => 0 },
  // 재생이 끝나면 플레이헤드를 6초(그래프 끝)에 둔다.
  restPlayhead: 6,
  graph: {
    yLabel: '붙은 클립의 수(개)',
    yMin: 0,
    integerTicks: true,
    // 위쪽에 표식 라벨 자리를 남기려고 축을 0~25로 고정한다(최대 19개).
    yTicks: [0, 5, 10, 15, 20, 25],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2, 3, 4, 5, 6],
    // 자석이 가장 가까워지는 때(3초)와 들어 올리기 시작하는 때(4초)는 모든 조건에서 같다.
    markers: [
      { t: 3, label: '가장 가까이' },
      { t: 4, label: '들어 올리기' },
    ],
  },
  resultColumns: () => [{ label: '끌려온 클립의 수(개)', value: (r) => String(r.clips) }],
  // 가상 거리 센서: 클립 더미 위 자석의 높이(cm)를 보여 준다. 실제 거리를 재는 것이 아니다.
  sensors: (snapshot) => [{ id: 'distance', label: '가상 거리 센서', unit: 'cm', kind: 'distance', source: snapshot?.heightCm ?? START_HEIGHT_CM }],
  MacroView: ClipMacroView,
  MicroView: ClipReachView,
};
