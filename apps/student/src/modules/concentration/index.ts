import {
  CONC_SAME_LEVEL,
  interpolateConcentration,
  simulateConcentration,
  validateConcentrationExperiment,
  type ConcentrationParams,
  type ConcentrationResult,
  type ConcentrationSample,
} from '@sci/engine-matter';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { ConcBarsView } from './ConcBarsView';
import { ConcMacroView } from './ConcMacroView';

export const concentrationModule: ExperimentModule<ConcentrationSample, ConcentrationResult> = {
  kind: 'concentration',
  validate: validateConcentrationExperiment,
  simulate: (values) => simulateConcentration(values as unknown as ConcentrationParams),
  interpolate: interpolateConcentration,
  // 그래프는 sampleKey(방울토마토 높이 floatH)를 그린다. 예측 비교는 결과의 float(뜬 높이, 눈금)로 하고, 0.5눈금 안이면 같은 결과로 본다.
  // 시행끼리 견주는 막대 그래프는 둘째 그림(ConcBarsView)이 그린다.
  metric: { sampleKey: 'floatH', resultKey: 'float', sameThreshold: () => CONC_SAME_LEVEL },
  graph: {
    yLabel: '방울토마토 높이(눈금)',
    // 눈금 10까지 담도록 0~10 고정
    yTicks: [0, 2, 4, 6, 8, 10],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2, 3],
  },
  resultColumns: () => [
    { label: '방울토마토가 뜬 높이(눈금)', value: (r) => String(r.float) },
    { label: '20 mL의 무게(g)', value: (r) => r.mass20.toFixed(1) },
    { label: '색의 진하기(눈금)', value: (r) => String(r.color) },
  ],
  // 가상 전자저울: 20 mL의 무게(g). 받침(비커 100 g)은 빼고 보여 주고, 실험 전에는 빈 저울(0 g)이다.
  sensors: (snapshot) => [{ id: 'mass-scale', label: '가상 전자저울: 20 mL의 무게', unit: 'g', kind: 'scale', source: (snapshot?.mass20 ?? 0) - BEAKER_G }],
  MacroView: ConcMacroView,
  MicroView: ConcBarsView,
};
