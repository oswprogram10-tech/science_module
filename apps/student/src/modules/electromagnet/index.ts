import {
  HOT_C,
  ROOM_C,
  interpolateElectromagnet,
  simulateElectromagnet,
  validateElectromagnetExperiment,
  type ElectromagnetParams,
  type ElectromagnetResult,
  type ElectromagnetSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { magnetOptions, poleText } from './initial';
import { MagnetMacroView } from './MagnetMacroView';
import { MagnetFlowView } from './MagnetFlowView';

const numParam = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);

export const electromagnetModule: ExperimentModule<ElectromagnetSample, ElectromagnetResult> = {
  kind: 'electromagnet',
  validate: validateElectromagnetExperiment,
  simulate: (values, exp) => simulateElectromagnet(values as unknown as ElectromagnetParams, magnetOptions(exp)),
  interpolate: interpolateElectromagnet,
  // 예측 비교는 붙은 클립 수(극은 숫자가 아니라서 쓰지 않는다)로 한다.
  metric: { sampleKey: 'clips', resultKey: 'clipsMax', sameThreshold: () => 0.5 },
  graph: {
    yLabel: '붙은 클립의 수(개)',
    yMin: 0,
    integerTicks: true,

    markers: (exp) => [
      { t: numParam(exp.params?.onS, 2), label: '켜짐' },
      { t: numParam(exp.params?.offS, 14), label: '꺼짐' },
    ],
  },
  resultColumns: () => [
    { label: '붙은 클립의 수(개)', value: (r) => String(r.clipsMax) },
    { label: '못 머리 쪽의 극', value: (r) => poleText(r.headPole) },
    { label: '에나멜선 최고 온도(°C)', value: (r) => r.wireMaxC.toFixed(1) },
  ],
  resultNote: (r) => (r.hot ? `⚠ 에나멜선이 ${HOT_C} °C 넘게 뜨거워졌어요. 실제 실험에서는 오래 연결하지 않아요.` : null),
  sensors: (snapshot) => [
    {
      id: 'wire',
      label: '가상 온도 센서: 에나멜선',
      unit: '°C',
      kind: 'temperature',
      source: snapshot?.wireC ?? ROOM_C,
    },
  ],
  MacroView: MagnetMacroView,
  MicroView: MagnetFlowView,
};
