import {
  interpolateGas,
  simulateGas,
  validateGasExperiment,
  type GasParams,
  type GasResult,
  type GasSample,
} from '@sci/engine-matter';
import type { ExperimentModule } from '../types';
import { GasMacroView } from './GasMacroView';
import { GasMicroView } from './GasMicroView';

export const KPA_PER_ATM = 101.3;
const signed = (x: number) => (x > 0 ? `+${x.toFixed(1)}` : x.toFixed(1));

export const gasSyringeModule: ExperimentModule<GasSample, GasResult> = {
  kind: 'gas-syringe',
  validate: validateGasExperiment,
  simulate: (values, exp) =>
    simulateGas(values as unknown as GasParams, {
      syringeMaxMl: typeof exp.params?.syringeMaxMl === 'number' ? exp.params.syringeMaxMl : undefined,
    }),
  interpolate: interpolateGas,
  metric: { sampleKey: 'volumeMl', resultKey: 'volumeMl', sameThreshold: () => 1 },
  graph: { yLabel: '기체의 부피(mL)' },
  resultColumns: () => [
    { label: '기체의 부피(mL)', value: (r) => r.volumeMl.toFixed(1) },
    { label: '부피 변화(mL)', value: (r) => signed(r.changeMl) },
    { label: '안정 시간(초)', value: (r) => r.settleS.toFixed(1) },
  ],
  sensors: (snapshot) => [
    { id: 'gas-temp', label: '가상 온도계', unit: '°C', kind: 'temperature', source: snapshot?.gasTempC ?? 20 },
    {
      id: 'gas-pressure',
      label: '가상 압력 센서',
      unit: 'kPa',
      kind: 'pressure',
      source: Math.round((snapshot?.pressureAtm ?? 1) * KPA_PER_ATM * 10) / 10,
    },
  ],
  MacroView: GasMacroView,
  MicroView: GasMicroView,
};
