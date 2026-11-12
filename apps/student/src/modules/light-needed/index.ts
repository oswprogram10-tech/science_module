import {
  LN_SAME_LEVEL,
  interpolateLightNeeded,
  simulateLightNeeded,
  validateLightNeededExperiment,
  type LightNeededParams,
  type LightNeededResult,
  type LightNeededSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { LightBarsView } from './LightBarsView';
import { LightMacroView } from './LightMacroView';
import { visibleText } from './initial';

export const lightNeededModule: ExperimentModule<LightNeededSample, LightNeededResult> = {
  kind: 'light-needed',
  validate: validateLightNeededExperiment,
  simulate: (values) => simulateLightNeeded(values as unknown as LightNeededParams),
  interpolate: interpolateLightNeeded,
  // 그래프는 sampleKey(상자 안 밝기 level)를 그린다. 예측 비교는 결과의 brightness(밝기 눈금)로 하고, 0.5눈금 안이면 같은 결과로 본다.
  // 구멍으로 본 물체(보임·보이지 않음)는 숫자가 아니라 결과 열에만 쓴다. 시행끼리 견주는 막대 그래프는 둘째 그림(LightBarsView)이 그린다.
  metric: { sampleKey: 'level', resultKey: 'brightness', sameThreshold: () => LN_SAME_LEVEL },
  graph: {
    yLabel: '상자 안 밝기(눈금)',
    // 눈금 10까지 담도록 0~10 고정
    yTicks: [0, 2, 4, 6, 8, 10],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
  },
  resultColumns: () => [
    { label: '상자 안 밝기(눈금)', value: (r) => String(r.brightness) },
    { label: '구멍으로 본 물체', value: visibleText },
  ],
  // 가상 조도계: 상자 안 밝기. 조도 센서는 상대 빛 세기(%)로 읽으므로 눈금 × 10을 보여 준다(눈금 8 = 80 %).
  sensors: (snapshot) => [{ id: 'light-meter', label: '가상 조도계: 상자 안 밝기', unit: '%', kind: 'light', source: (snapshot?.level ?? 0) * 10 }],
  MacroView: LightMacroView,
  MicroView: LightBarsView,
};
