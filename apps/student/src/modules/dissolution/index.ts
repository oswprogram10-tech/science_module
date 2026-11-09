import {
  interpolateDissolution,
  simulateDissolution,
  validateDissolutionExperiment,
  type DissolutionParams,
  type DissolutionResult,
  type DissolutionSample,
} from '@sci/engine-matter';
import type { ExperimentModule } from '../types';
import { BeakerView } from './BeakerView';
import { ParticleView } from './ParticleView';

export const dissolutionModule: ExperimentModule<DissolutionSample, DissolutionResult> = {
  kind: 'dissolution',
  validate: validateDissolutionExperiment,
  simulate: (values, exp) =>
    simulateDissolution(values as unknown as DissolutionParams, { spoonGrams: exp.spoonGrams }),
  interpolate: interpolateDissolution,
  metric: {
    sampleKey: 'dissolvedG',
    resultKey: 'dissolvedG',
    // 차이가 숟가락 1개 이하이면 '변하지 않음'으로 본다.
    sameThreshold: (exp) => exp.spoonGrams ?? 0,
  },
  graph: { yLabel: '녹은 양(g)' },
  resultColumns: () => [
    { label: '녹은 양(g)', value: (r) => r.dissolvedG.toFixed(1) },
    { label: '숟가락 수', value: (r) => String(r.spoonsFullyDissolved) },
    { label: '걸린 시간(초)', value: (r) => r.timeS.toFixed(1) },
  ],
  sensors: (snapshot, values) => [
    { id: 'temperature', label: '가상 온도계', unit: '°C', kind: 'temperature', source: Number(values.waterTempC) },
    {
      id: 'scale',
      label: '전자저울',
      unit: 'g',
      kind: 'scale',
      source: Number(values.waterMl) + (snapshot?.addedG ?? 0),
    },
  ],
  MacroView: BeakerView,
  MicroView: ParticleView,
};
