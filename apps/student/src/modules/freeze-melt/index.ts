import {
  coolMin,
  endMin,
  interpolatePhase,
  simulatePhase,
  tempAt,
  validatePhaseExperiment,
  type PhaseParams,
  type PhaseResult,
  type PhaseSample,
} from '@sci/engine-matter';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { phaseOptions, signedMl, toParams } from './initial';
import { FreezeMacroView } from './FreezeMacroView';
import { ParticleView } from './ParticleView';

export const freezeMeltModule: ExperimentModule<PhaseSample, PhaseResult> = {
  kind: 'freeze-melt',
  validate: validatePhaseExperiment,
  simulate: (values, exp) => simulatePhase(values as unknown as PhaseParams, phaseOptions(exp)),
  interpolate: interpolatePhase,
  // 예측 비교는 부피 변화(mL)로 한다. 0.05 mL 안이면 같은 결과로 본다(시험관만 바꾸면 완전히 같다).
  metric: { sampleKey: 'dV', resultKey: 'dV', sameThreshold: () => 0.05 },
  // 재생이 끝나면 플레이헤드를 30분(그래프 끝)에 둔다.
  restPlayhead: 30,
  graph: {
    yLabel: '부피 변화(mL)',
    // 얼리기 +1.8, 녹이기 −1.8까지 담도록 −2~2 고정. 음수 눈금과 0선은 그래프가 그린다.
    yMin: -2,
    yTicks: [-2, -1, 0, 1, 2],
    xLabel: '시간(분)',
    xTicks: [0, 5, 10, 15, 20, 25, 30],
    // 식기 시작해 얼거나 녹기 시작하는 때와 다 얼거나 다 녹은 때는 처음 물의 양과 과정에 따라 다르다.
    markers: (_exp, trial) => {
      const p = toParams(trial.values);
      const freeze = p.process === 'freeze';
      return [
        { t: coolMin(p.startMl), label: freeze ? '얼기 시작' : '녹기 시작' },
        { t: endMin(p.startMl), label: freeze ? '다 얼었어요' : '다 녹았어요' },
      ];
    },
  },
  resultColumns: () => [
    { label: '부피 변화(mL)', value: (r) => signedMl(r.dV) },
    { label: '나중 부피(mL)', value: (r) => r.volumeEnd.toFixed(1) },
    // 무게는 변하지 않지만 처음 양에 따라 글자가 달라서, "처음 → 나중"으로 그대로임을 한눈에 보여 준다.
    { label: '무게(처음 → 나중)', value: (r) => r.mass },
  ],
  // 가상 온도계: 얼거나 녹는 동안 0 °C에 머문다. 가상 전자저울: 시험관 속 물의 무게(비커 100 g은 빼고 보여 준다).
  sensors: (snapshot, values) => [
    { id: 'phase-temp', label: '가상 온도계', unit: '°C', kind: 'temperature', source: snapshot?.tempC ?? tempAt(toParams(values).process, toParams(values).startMl, 0) },
    { id: 'phase-scale', label: '가상 전자저울', unit: 'g', kind: 'scale', source: (snapshot?.massG ?? toParams(values).startMl) - BEAKER_G },
  ],
  MacroView: FreezeMacroView,
  MicroView: ParticleView,
};
