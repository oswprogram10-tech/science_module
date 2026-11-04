import {
  REST_PULSE,
  interpolateBody,
  simulateBody,
  validateExerciseExperiment,
  type BodyParams,
  type BodyResult,
  type BodySample,
} from '@sci/engine-life';
import type { ExperimentModule } from '../types';
import { BodyMacroView } from './BodyMacroView';
import { BodyMicroView } from './BodyMicroView';
import { BodyResultsExtra } from './BodyResultsExtra';
import { bodyOptions, breathEndText, endMin, pulseEndText, recoverText, startMin } from './initial';

export const exerciseBodyModule: ExperimentModule<BodySample, BodyResult> = {
  kind: 'exercise-body',
  validate: validateExerciseExperiment,
  simulate: (values, exp) => simulateBody(values as unknown as BodyParams, bodyOptions(exp)),
  interpolate: interpolateBody,
  // 예측 비교는 운동 직후 맥박으로, 그래프는 맥박(실선)과 호흡(점선) 두 선으로 그린다. 앞 시행은 맥박만 겹쳐 그린다.
  metric: { sampleKey: 'pulse', resultKey: 'pulseEnd', sameThreshold: () => 2 },
  // 재생이 끝나면 운동이 끝난 순간(시행마다 다르다)에 플레이헤드를 둔다.
  restPlayhead: (exp, trial) => endMin(trial.values, exp),
  graph: {
    yLabel: '회/분',
    yMin: 0,
    yTicks: [0, 30, 60, 90, 120, 150, 180],
    xLabel: '시간(분)',
    xTicks: [0, 2, 4, 6, 8, 10],
    xTickFormat: (t) => String(t),
    series: [
      { key: 'pulse', label: '맥박(회/분)', color: '#dc2626' },
      { key: 'breath', label: '호흡(회/분)', color: '#2563eb', dash: '7 4' },
    ],
    markers: (exp, trial) => [
      { t: startMin(exp), label: '운동 시작' },
      { t: endMin(trial.values, exp), label: '운동 끝' },
    ],
  },
  resultColumns: () => [
    { label: '운동 직후 맥박(회/분)', value: (r) => pulseEndText(r) },
    { label: '운동 직후 호흡(회/분)', value: (r) => breathEndText(r) },
    { label: '돌아오는 데 걸린 시간(분)', value: (r) => recoverText(r) },
  ],
  // 가상 맥박계: 가상 친구의 맥박을 보여 준다. 실제 학생의 측정이 아니다.
  sensors: (snapshot) => [
    { id: 'pulse', label: '가상 맥박계', unit: '회/분', kind: 'pulse', source: snapshot ? snapshot.pulse : REST_PULSE },
  ],
  ResultsExtra: BodyResultsExtra,
  MacroView: BodyMacroView,
  MicroView: BodyMicroView,
};
