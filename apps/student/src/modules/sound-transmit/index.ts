import {
  ST_SAME_LEVEL,
  interpolateSoundTransmit,
  simulateSoundTransmit,
  validateSoundTransmitExperiment,
  type SoundTransmitParams,
  type SoundTransmitResult,
  type SoundTransmitSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { heardText } from './initial';
import { SoundBarsView } from './SoundBarsView';
import { SoundMacroView } from './SoundMacroView';

export const soundTransmitModule: ExperimentModule<SoundTransmitSample, SoundTransmitResult> = {
  kind: 'sound-transmit',
  validate: validateSoundTransmitExperiment,
  simulate: (values) => simulateSoundTransmit(values as unknown as SoundTransmitParams),
  interpolate: interpolateSoundTransmit,
  // 그래프는 sampleKey(소음계 눈금 level)를 그린다. 예측 비교는 결과의 level(소음계 눈금)로 하고, 0.5눈금 안이면 같은 결과로 본다.
  // 귀에 들리는지(들림·들리지 않음)는 숫자가 아니라 결과 열에만 쓴다. 시행끼리 견주는 막대 그래프는 둘째 그림(SoundBarsView)이 그린다.
  metric: { sampleKey: 'level', resultKey: 'level', sameThreshold: () => ST_SAME_LEVEL },
  graph: {
    yLabel: '소음계 눈금',
    // 눈금 10까지 담도록 0~10 고정
    yTicks: [0, 2, 4, 6, 8, 10],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
  },
  resultColumns: () => [
    { label: '소음계 눈금', value: (r) => String(r.level) },
    { label: '귀에 들리나요', value: heardText },
  ],
  // 가상 소음계: 소음계 눈금. 실험 전에는 0이다.
  sensors: (snapshot) => [{ id: 'sound-meter', label: '가상 소음계', unit: '눈금', kind: 'sound', source: snapshot?.level ?? 0 }],
  MacroView: SoundMacroView,
  MicroView: SoundBarsView,
};
