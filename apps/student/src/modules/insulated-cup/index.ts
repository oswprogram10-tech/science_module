import {
  interpolateInsulatedCup,
  simulateInsulatedCup,
  validateInsulatedCupExperiment,
  type InsulatedCupParams,
  type InsulatedCupResult,
  type InsulatedCupSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { cupOptions } from './initial';
import { CupMacroView } from './CupMacroView';
import { CupThermalView } from './CupThermalView';

/** 실험 전(스냅샷이 없을 때) 센서가 보여 주는 물과 실내 공기의 온도(°C). 매니페스트 params의 기본값과 같다. */
export const START_FALLBACK_C = 60;
export const ROOM_FALLBACK_C = 20;

export const insulatedCupModule: ExperimentModule<InsulatedCupSample, InsulatedCupResult> = {
  kind: 'insulated-cup',
  validate: validateInsulatedCupExperiment,
  simulate: (values, exp) => simulateInsulatedCup(values as unknown as InsulatedCupParams, cupOptions(exp)),
  interpolate: interpolateInsulatedCup,
  // 예측 비교는 식은 정도로, 그래프는 물의 온도로 그린다.
  metric: { sampleKey: 'waterC', resultKey: 'dropC', sameThreshold: () => 0.5 },
  graph: { yLabel: '물의 온도(°C)', yMin: 20 },
  resultColumns: () => [
    { label: '물이 식은 정도(°C)', value: (r) => r.dropC.toFixed(1) },
    { label: '10분 뒤 물의 온도(°C)', value: (r) => r.endC.toFixed(1) },
    { label: '처음 컵 바깥 온도(°C)', value: (r) => r.surfaceSideStartC.toFixed(1) },
  ],
  sensors: (snapshot) => [
    {
      id: 'water',
      label: '가상 온도 센서 1: 컵 속 물',
      ariaLabel: '온도 센서 1, 컵 속 물',
      unit: '°C',
      kind: 'temperature',
      source: snapshot?.waterC ?? START_FALLBACK_C,
    },
    {
      id: 'room',
      label: '가상 온도 센서 2: 실내 공기',
      ariaLabel: '온도 센서 2, 실내 공기',
      unit: '°C',
      kind: 'temperature',
      source: ROOM_FALLBACK_C,
    },
  ],
  MacroView: CupMacroView,
  MicroView: CupThermalView,
};
