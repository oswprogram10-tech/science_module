import {
  interpolateStringSound,
  simulateStringSound,
  validateStringSoundExperiment,
  type StringSoundParams,
  type StringSoundResult,
  type StringSoundSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { freqText, levelText, soundOptions } from './initial';
import { SoundAirView } from './SoundAirView';
import { SoundMacroView } from './SoundMacroView';

export const stringSoundModule: ExperimentModule<StringSoundSample, StringSoundResult> = {
  kind: 'string-sound',
  validate: validateStringSoundExperiment,
  simulate: (values, exp) => simulateStringSound(values as unknown as StringSoundParams, soundOptions(exp)),
  interpolate: interpolateStringSound,
  // 그래프(앞 시행의 흐린 선 포함)는 줄의 떨림으로 그리고, 예측 비교는 1초 동안 떨린 횟수(높낮이)로 한다.
  // 세기만 바꾸면 이 값은 변하지 않는다. 세기는 결과표의 소리의 크기와 그래프의 물결 높이로 본다.
  metric: { sampleKey: 'displacement', resultKey: 'freq', sameThreshold: () => 5 },
  // 재생이 끝나면 플레이헤드를 20 ms(그래프 끝)에 둔다.
  restPlayhead: 20,
  graph: {
    yLabel: '줄의 떨림',
    yMin: -1,
    yTicks: [-1, -0.5, 0, 0.5, 1],
    xLabel: '시간(1000분의 1초)',
    xTicks: [0, 5, 10, 15, 20],
    xTickFormat: (t) => String(t),
  },
  resultColumns: () => [
    { label: '1초 동안 떨린 횟수(번)', value: (r) => freqText(r) },
    { label: '소리의 크기(눈금)', value: (r) => levelText(r.level) },
  ],
  // 가상 소리 센서: 소리의 크기 눈금을 보여 준다. 실제 소리를 재는 것이 아니다.
  sensors: (snapshot) => [{ id: 'sound', label: '가상 소리 센서', unit: '눈금', kind: 'sound', source: snapshot?.level ?? 0 }],
  MacroView: SoundMacroView,
  MicroView: SoundAirView,
};
