import {
  interpolateMagma,
  simulateMagma,
  validateMagmaExperiment,
  type MagmaParams,
  type MagmaResult,
  type MagmaSample,
} from '@sci/engine-earth';
import type { ExperimentModule } from '../types';
import { ROCK_TEXT, magmaOptions, magmaWindow } from './initial';
import { MagmaMacroView } from './MagmaMacroView';
import { MagmaGrainView } from './MagmaGrainView';

/** 실험 전(스냅샷이 없을 때) 센서가 보여 주는 녹인 물질의 온도(°C). 매니페스트 params의 startC 기본값과 같다. */
export const START_FALLBACK_C = 90;

export const magmaCoolingModule: ExperimentModule<MagmaSample, MagmaResult> = {
  kind: 'magma-cooling',
  validate: validateMagmaExperiment,
  simulate: (values, exp) => simulateMagma(values as unknown as MagmaParams, magmaOptions(exp)),
  interpolate: interpolateMagma,
  // 예측 비교는 알갱이의 크기로, 그래프는 물질의 온도로 그린다. rockLike는 비교에 쓰지 않는다.
  metric: { sampleKey: 'tempC', resultKey: 'sizeMm', sameThreshold: () => 0.05 },
  graph: {
    yLabel: '물질의 온도(°C)',
    yMin: 0,
    // 알갱이가 자라는 구간은 시행마다 다르므로 시행의 조건에서 계산한다.
    markers: (exp, trial) => {
      const { startS, endS } = magmaWindow(trial.values, exp);
      return [
        { t: startS, label: '알갱이 생김' },
        { t: endS, label: '다 자람' },
      ];
    },
  },
  resultColumns: () => [
    { label: '알갱이의 크기(mm)', value: (r) => r.sizeMm.toFixed(2) },
    { label: '다 굳을 때까지 걸린 시간(초)', value: (r) => r.solidS.toFixed(1) },
    { label: '닮은 암석', value: (r) => ROCK_TEXT[r.rockLike] },
  ],
  sensors: (snapshot) => [
    {
      id: 'melt',
      label: '가상 온도 센서: 녹인 물질',
      unit: '°C',
      kind: 'temperature',
      source: snapshot?.tempC ?? START_FALLBACK_C,
    },
  ],
  MacroView: MagmaMacroView,
  MicroView: MagmaGrainView,
};
