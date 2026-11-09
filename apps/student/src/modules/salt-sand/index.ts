import {
  interpolateSeparation,
  simulateSeparation,
  validateSeparationExperiment,
  type SeparationParams,
  type SeparationResult,
  type SeparationSample,
} from '@sci/engine-matter';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { separationOptions } from './initial';
import { SaltSandMacroView } from './SaltSandMacroView';
import { SaltSandParticleView } from './SaltSandParticleView';

export const saltSandModule: ExperimentModule<SeparationSample, SeparationResult> = {
  kind: 'salt-sand',
  validate: validateSeparationExperiment,
  simulate: (values, exp) => simulateSeparation(values as unknown as SeparationParams, separationOptions(exp)),
  interpolate: interpolateSeparation,
  // 그래프는 sampleKey(접시 위 가루 solidG)를 그린다. 예측 비교는 결과의 salt(얻은 소금, g)로 하고, 0.05 g 안이면 같은 결과로 본다.
  metric: { sampleKey: 'solidG', resultKey: 'salt', sameThreshold: () => 0.05 },
  // 재생이 끝나면 플레이헤드를 20분(그래프 끝)에 둔다.
  restPlayhead: 20,
  graph: {
    yLabel: '접시 위 가루(g)',
    // 따르기 + 50 mL에서 소금 9.0 g + 모래 1.5 g = 10.5 g까지 담도록 0~12 고정
    yTicks: [0, 3, 6, 9, 12],
    xLabel: '시간(분)',
    xTicks: [0, 4, 8, 12, 16, 20],
    markers: [
      { t: 3, label: '거르기 시작' },
      { t: 8, label: '가열 시작' },
    ],
  },
  resultColumns: () => [
    { label: '얻은 소금(g)', value: (r) => r.salt.toFixed(1) },
    { label: '섞인 모래(g)', value: (r) => r.sand.toFixed(1) },
  ],
  // 가상 전자저울: 증발 접시 위 가루의 무게(비커 100 g은 빼고 보여 준다).
  sensors: (snapshot) => [{ id: 'dish-scale', label: '가상 전자저울: 증발 접시', unit: 'g', kind: 'scale', source: (snapshot?.solidG ?? 0) - BEAKER_G }],
  MacroView: SaltSandMacroView,
  MicroView: SaltSandParticleView,
};
