import {
  SPRING_SAME_CM,
  interpolateSpringScale,
  simulateSpringScale,
  validateSpringScaleExperiment,
  type SpringScaleParams,
  type SpringScaleResult,
  type SpringScaleSample,
} from '@sci/engine-physics';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { readingText, stretchText } from './initial';
import { SpringBarsView } from './SpringBarsView';
import { SpringMacroView } from './SpringMacroView';

export const springScaleModule: ExperimentModule<SpringScaleSample, SpringScaleResult> = {
  kind: 'spring-scale',
  validate: validateSpringScaleExperiment,
  simulate: (values) => simulateSpringScale(values as unknown as SpringScaleParams),
  interpolate: interpolateSpringScale,
  // 그래프는 sampleKey(용수철이 늘어난 길이 stretchCm)를 그린다. 예측 비교는 결과의 stretch(늘어난 길이, cm)로 하고, 0.05 cm 안이면 같은 결과로 본다.
  metric: { sampleKey: 'stretchCm', resultKey: 'stretch', sameThreshold: () => SPRING_SAME_CM },
  graph: {
    yLabel: '늘어난 길이(cm)',
    // 0~18 cm 고정: 추 5개와 필통(16 cm)이 살짝 흔들릴 때까지 담긴다.
    yTicks: [0, 3, 6, 9, 12, 15, 18],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
  },
  resultColumns: () => [
    { label: '늘어난 길이(cm)', value: stretchText },
    { label: '저울 눈금(g)', value: readingText },
  ],
  // 가상 저울: 용수철에 걸린 것의 눈금(정수 g, 받침 100 g은 빼고 보여 준다). 실험 전에는 0.
  sensors: (snapshot) => [{ id: 'spring-reading', label: '가상 저울: 저울 눈금', unit: 'g', kind: 'scale', source: (snapshot?.readingG ?? 0) - BEAKER_G, decimals: 0 }],
  MacroView: SpringMacroView,
  MicroView: SpringBarsView,
};
