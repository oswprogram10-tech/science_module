import {
  interpolateBreeze,
  simulateBreeze,
  validateBreezeExperiment,
  type BreezeParams,
  type BreezeResult,
  type BreezeSample,
} from '@sci/engine-earth';
import type { ExperimentModule } from '../types';
import { BREEZE_TEXT, IDLE_SAMPLE, breezeOptions, signedC } from './initial';
import { BreezeMacroView } from './BreezeMacroView';
import { BreezeAirView } from './BreezeAirView';

export const landSeaBreezeModule: ExperimentModule<BreezeSample, BreezeResult> = {
  kind: 'land-sea-breeze',
  validate: validateBreezeExperiment,
  simulate: (values, exp) => simulateBreeze(values as unknown as BreezeParams, breezeOptions(exp)),
  interpolate: interpolateBreeze,
  // 예측 비교는 결과의 온도 차(모래 − 물, diff)로 하고 0.2 °C 안이면 같은 결과로 본다(그릇만 바꾸면 완전히 같다).
  // 그래프가 앞 시행을 흐리게 겹치는 선(sampleKey)은 y축 15~40 안에 들어오도록 모래 온도로 둔다(diff는 −3~8이라 축 밖이다).
  metric: { sampleKey: 'sand', resultKey: 'diff', sameThreshold: () => 0.2 },
  // 재생이 끝나면 플레이헤드를 10분(그래프 끝)에 둔다.
  restPlayhead: 10,
  graph: {
    yLabel: '온도(°C)',
    // 낮 20 cm의 모래 34.7 °C까지 담도록 15~40 고정
    yMin: 15,
    yTicks: [15, 20, 25, 30, 35, 40],
    xLabel: '시간(분)',
    xTicks: [0, 2, 4, 6, 8, 10],
    series: [
      { key: 'sand', label: '모래 온도(°C)', color: '#8a4b12' },
      { key: 'water', label: '물 온도(°C)', color: '#1d4ed8', dash: '7 4' },
    ],
  },
  resultColumns: () => [
    { label: '모래 온도(°C)', value: (r) => r.sand.toFixed(1) },
    { label: '물 온도(°C)', value: (r) => r.water.toFixed(1) },
    { label: '온도 차(°C)', value: (r) => signedC(r.diff) },
    { label: '바람 방향', value: (r) => BREEZE_TEXT[r.breeze] },
  ],
  // 가상 온도계 두 개: 실행 전에는 둘 다 주변 온도(어느 쪽이 따뜻한지 드러내지 않는다)
  sensors: (snapshot) => [
    { id: 'breeze-sand', label: '가상 온도계: 모래', unit: '°C', kind: 'temperature', source: (snapshot ?? IDLE_SAMPLE).sand, ariaLabel: '모래 온도' },
    { id: 'breeze-water', label: '가상 온도계: 물', unit: '°C', kind: 'temperature', source: (snapshot ?? IDLE_SAMPLE).water, ariaLabel: '물 온도' },
  ],
  MacroView: BreezeMacroView,
  MicroView: BreezeAirView,
};
