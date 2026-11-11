import {
  SAME_G,
  interpolateSeaWater,
  simulateSeaWater,
  validateSeaWaterExperiment,
  type SeaWaterParams,
  type SeaWaterResult,
  type SeaWaterSample,
} from '@sci/engine-earth';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { seaWaterOptions } from './initial';
import { SeaWaterMacroView } from './SeaWaterMacroView';
import { SeaWaterParticleView } from './SeaWaterParticleView';

export const seaWaterModule: ExperimentModule<SeaWaterSample, SeaWaterResult> = {
  kind: 'sea-water',
  validate: validateSeaWaterExperiment,
  simulate: (values, exp) => simulateSeaWater(values as unknown as SeaWaterParams, seaWaterOptions(exp)),
  interpolate: interpolateSeaWater,
  // 그래프는 sampleKey(접시에 남은 물 dishWaterMl)를 그린다. 예측 비교는 결과의 residue(남은 하얀 가루, g)로 하고, 0.1 g 안이면 같은 결과로 본다.
  metric: { sampleKey: 'dishWaterMl', resultKey: 'residue', sameThreshold: () => SAME_G },
  // 재생이 끝나면 플레이헤드를 20분(그래프 끝)에 둔다.
  restPlayhead: 20,
  graph: {
    yLabel: '접시에 남은 물(mL)',
    // 100 mL까지 담도록 0~100 고정
    yTicks: [0, 25, 50, 75, 100],
    xLabel: '시간(분)',
    xTicks: [0, 5, 10, 15, 20],
  },
  resultColumns: () => [
    { label: '남은 하얀 가루(g)', value: (r) => r.residue.toFixed(1) },
    { label: '물이 다 마른 시간(분)', value: (r) => String(r.dryMin) },
  ],
  // 가상 전자저울: 증발 접시 위 가루의 무게(받침 100 g은 빼고 보여 준다).
  sensors: (snapshot) => [{ id: 'dish-scale', label: '가상 전자저울: 접시 위 가루', unit: 'g', kind: 'scale', source: (snapshot?.residueG ?? 0) - BEAKER_G }],
  MacroView: SeaWaterMacroView,
  MicroView: SeaWaterParticleView,
};
