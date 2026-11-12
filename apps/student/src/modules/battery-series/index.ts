import {
  BL_SAME_LEVEL,
  interpolateBulb,
  simulateBatterySeries,
  validateBatterySeriesExperiment,
  type BatterySeriesParams,
  type BulbResult,
  type BulbSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { BulbBarsView } from '../bulb-light/BulbBarsView';
import { BatterySeriesMacroView } from '../bulb-light/BulbMacroView';
import { bulbGraph, bulbResultColumns, bulbSensors } from '../bulb-light';

// 전구에 불 켜기(bulb-light)와 엔진 파일(bulbLight.ts)·그림 부품(BulbCircuit)·막대 그래프·센서를 함께 쓴다. 모듈은 따로다.
export const batterySeriesModule: ExperimentModule<BulbSample, BulbResult> = {
  kind: 'battery-series',
  validate: validateBatterySeriesExperiment,
  simulate: (values) => simulateBatterySeries(values as unknown as BatterySeriesParams),
  interpolate: interpolateBulb,
  metric: { sampleKey: 'level', resultKey: 'brightness', sameThreshold: () => BL_SAME_LEVEL },
  graph: bulbGraph,
  resultColumns: bulbResultColumns,
  sensors: bulbSensors,
  MacroView: BatterySeriesMacroView,
  MicroView: BulbBarsView,
};
