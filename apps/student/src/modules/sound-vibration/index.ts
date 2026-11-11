import {
  VIB_SAME_MM,
  interpolateSoundVibration,
  simulateSoundVibration,
  validateSoundVibrationExperiment,
  type SoundVibrationParams,
  type SoundVibrationResult,
  type SoundVibrationSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { VibMacroView } from './VibMacroView';
import { VibMeterView } from './VibMeterView';

export const soundVibrationModule: ExperimentModule<SoundVibrationSample, SoundVibrationResult> = {
  kind: 'sound-vibration',
  validate: validateSoundVibrationExperiment,
  simulate: (values) => simulateSoundVibration(values as unknown as SoundVibrationParams),
  interpolate: interpolateSoundVibration,
  // 그래프는 sampleKey(좁쌀 높이 bounceMm)를 그린다. 예측 비교는 결과의 bounce(좁쌀이 튄 높이, mm)로 하고, 0.5 mm 안이면 같은 결과로 본다.
  metric: { sampleKey: 'bounceMm', resultKey: 'bounce', sameThreshold: () => VIB_SAME_MM },
  // 재생이 끝나면 플레이헤드를 첫 마루(0.25초)에 둔다: 좁쌀이 가장 높이 튄 모습이 보인다.
  restPlayhead: 0.25,
  graph: {
    yLabel: '좁쌀 높이(mm)',
    // 15 mm까지 담도록 0~15 고정: 작은북 12 mm도 담긴다.
    yTicks: [0, 5, 10, 15],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2, 3],
  },
  resultColumns: () => [
    { label: '좁쌀이 튄 높이(mm)', value: (r) => String(r.bounce) },
    { label: '소리의 크기(눈금)', value: (r) => String(r.level) },
  ],
  // 가상 소음계: 소리의 크기(눈금).
  sensors: (snapshot) => [{ id: 'sound-meter', label: '가상 소음계: 소리의 크기', unit: '눈금', kind: 'sound', source: snapshot?.level ?? 0 }],
  MacroView: VibMacroView,
  MicroView: VibMeterView,
};
