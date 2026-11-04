import {
  interpolateCombustion,
  simulateCombustion,
  validateCombustionExperiment,
  type CombustionParams,
  type CombustionResult,
  type CombustionSample,
} from '@sci/engine-matter';
import type { ExperimentModule } from '../types';
import { CandleMacroView } from './CandleMacroView';
import { CandleMicroView } from './CandleMicroView';

/** 실험 전(스냅샷이 없을 때) 센서가 보여 주는 공기의 산소·이산화 탄소 비율(%). */
export const AIR_OXYGEN_PCT = 21;
export const AIR_CO2_PCT = 0.04;

const numParam = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

export const candleJarModule: ExperimentModule<CombustionSample, CombustionResult> = {
  kind: 'candle-jar',
  validate: validateCombustionExperiment,
  simulate: (values, exp) =>
    simulateCombustion(values as unknown as CombustionParams, {
      oxygenStartPct: numParam(exp.params?.oxygenStartPct),
      oxygenOutPct: numParam(exp.params?.oxygenOutPct),
    }),
  interpolate: interpolateCombustion,
  // 예측 비교는 걸린 시간으로, 그래프는 산소 비율로 그린다.
  metric: { sampleKey: 'oxygenPct', resultKey: 'extinguishS', sameThreshold: () => 1 },
  graph: { yLabel: '산소 비율(%)', yMin: 14 },
  resultColumns: () => [
    { label: '걸린 시간(초)', value: (r) => r.extinguishS.toFixed(1) },
    { label: '쓰인 산소의 양(mL)', value: (r) => r.usedOxygenMl.toFixed(1) },
  ],
  sensors: (snapshot) => [
    { id: 'oxygen', label: '가상 산소 센서', unit: '%', kind: 'oxygen', source: snapshot?.oxygenPct ?? AIR_OXYGEN_PCT },
    { id: 'co2', label: '가상 이산화 탄소 센서', unit: '%', kind: 'carbonDioxide', source: snapshot?.co2Pct ?? AIR_CO2_PCT },
  ],
  MacroView: CandleMacroView,
  MicroView: CandleMicroView,
};
