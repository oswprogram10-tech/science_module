import {
  BL_SAME_LEVEL,
  interpolateBulb,
  simulateBulbLight,
  validateBulbLightExperiment,
  type BulbLightParams,
  type BulbResult,
  type BulbSample,
} from '@sci/engine-physics';
import type { ExperimentModule, SensorSpec } from '../types';
import { BulbBarsView } from './BulbBarsView';
import { BulbLightMacroView } from './BulbMacroView';

/** 두 전구 활동이 같이 쓰는 센서: 가상 조도계. 조도 센서는 상대 빛 세기(%)로 읽으므로 눈금 × 10을 읽고, 화면에는 눈금(÷10)으로 보여 준다(눈금 6 = 60 %). */
export const bulbSensors = (snapshot: BulbSample | null): SensorSpec[] => [
  { id: 'light-meter', label: '가상 조도계: 전구의 밝기', unit: '눈금', kind: 'light', source: (snapshot?.level ?? 0) * 10, display: { scale: 0.1, unitLabel: '눈금' } },
];

/** 두 전구 활동이 같이 쓰는 그래프와 예측 기준 */
export const bulbGraph: ExperimentModule<BulbSample, BulbResult>['graph'] = {
  yLabel: '전구의 밝기(눈금)',
  // 눈금 10까지 담도록 0~10 고정
  yTicks: [0, 2, 4, 6, 8, 10],
  xLabel: '시간(초)',
  xTicks: [0, 1, 2],
};

export const bulbResultColumns: ExperimentModule<BulbSample, BulbResult>['resultColumns'] = () => [
  { label: '전구의 밝기(눈금)', value: (r) => String(r.brightness) },
  { label: '전구', value: (r) => r.lit },
];

export const bulbLightModule: ExperimentModule<BulbSample, BulbResult> = {
  kind: 'bulb-light',
  validate: validateBulbLightExperiment,
  simulate: (values) => simulateBulbLight(values as unknown as BulbLightParams),
  interpolate: interpolateBulb,
  // 그래프는 sampleKey(전구의 밝기 level)를 그린다. 예측 비교는 결과의 brightness(밝기 눈금)로 하고, 0.5눈금 안이면 같은 결과로 본다.
  // 전구가 켜졌는지(켜짐·켜지지 않음)는 숫자가 아니라 결과 열에만 쓴다. 시행끼리 견주는 막대 그래프는 둘째 그림(BulbBarsView)이 그린다.
  metric: { sampleKey: 'level', resultKey: 'brightness', sameThreshold: () => BL_SAME_LEVEL },
  graph: bulbGraph,
  resultColumns: bulbResultColumns,
  sensors: bulbSensors,
  MacroView: BulbLightMacroView,
  MicroView: BulbBarsView,
};
