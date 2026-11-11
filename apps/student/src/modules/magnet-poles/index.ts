import {
  POLES_SAME_CM,
  interpolateMagnetPoles,
  simulateMagnetPoles,
  validateMagnetPolesExperiment,
  type MagnetPolesParams,
  type MagnetPolesResult,
  type MagnetPolesSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { motionText, moveText } from './initial';
import { PolesMacroView } from './PolesMacroView';
import { PolesRulerView } from './PolesRulerView';

export const magnetPolesModule: ExperimentModule<MagnetPolesSample, MagnetPolesResult> = {
  kind: 'magnet-poles',
  validate: validateMagnetPolesExperiment,
  simulate: (values) => simulateMagnetPoles(values as unknown as MagnetPolesParams),
  interpolate: interpolateMagnetPoles,
  // 그래프는 sampleKey(두 자석 사이 거리 gapCm)를 그린다. 예측 비교는 결과의 moveCm(움직인 거리, cm)로 하고, 0.05 cm 안이면 같은 결과로 본다.
  // 움직임(다가와 붙음·밀려남·움직이지 않음)은 숫자가 아니라 결과 열에만 쓴다.
  metric: { sampleKey: 'gapCm', resultKey: 'moveCm', sameThreshold: () => POLES_SAME_CM },
  graph: {
    yLabel: '두 자석 사이 거리(cm)',
    // 10 cm까지 담도록 0~10 고정: 큰 자석이 같은 극으로 밀려나도 7 cm를 넘지 않는다.
    yTicks: [0, 2, 4, 6, 8, 10],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
  },
  resultColumns: () => [
    { label: '오른쪽 자석의 움직임', value: motionText },
    { label: '움직인 거리(cm)', value: moveText },
  ],
  // 가상 거리 센서: 두 자석 사이 거리(실험 전에는 고른 처음 거리).
  sensors: (snapshot, values) => [{ id: 'gap-distance', label: '가상 거리 센서: 두 자석 사이', unit: 'cm', kind: 'distance', source: snapshot?.gapCm ?? Number(values.gapCm) }],
  MacroView: PolesMacroView,
  MicroView: PolesRulerView,
};
