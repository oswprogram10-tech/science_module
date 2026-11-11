import {
  HEAT_SAME_C,
  interpolateHeatContact,
  simulateHeatContact,
  validateHeatContactExperiment,
  type HeatContactParams,
  type HeatContactResult,
  type HeatContactSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { HeatMacroView } from './HeatMacroView';
import { HeatThermalView } from './HeatThermalView';
import { sameMinText } from './initial';

export const heatContactModule: ExperimentModule<HeatContactSample, HeatContactResult> = {
  kind: 'heat-contact',
  validate: validateHeatContactExperiment,
  simulate: (values) => simulateHeatContact(values as unknown as HeatContactParams),
  interpolate: interpolateHeatContact,
  // 그래프는 안쪽·바깥 두 선을 그린다(앞 시행은 안쪽 선만 흐리게). 예측 비교는 결과의 inner10(10분 뒤 안쪽 물 온도)으로 하고, 0.5 °C 안이면 같은 결과로 본다(정수로 읽는다).
  metric: { sampleKey: 'innerC', resultKey: 'inner10', sameThreshold: () => HEAT_SAME_C },
  // 재생이 끝나면 플레이헤드를 10분에 둔다: 결과표의 "10분 뒤" 값이 화면에 보인다.
  restPlayhead: 10,
  graph: {
    yLabel: '온도(°C)',
    // 안쪽 70 °C부터 바깥 20 °C까지 담도록 0~80 고정
    yTicks: [0, 20, 40, 60, 80],
    xLabel: '시간(분)',
    xTicks: [0, 5, 10, 15, 20],
    series: [
      { key: 'innerC', label: '안쪽 물(°C)', color: '#c2410c' },
      { key: 'outerC', label: '바깥 물(°C)', color: '#1d4ed8', dash: '7 4' },
    ],
  },
  resultColumns: () => [
    { label: '10분 뒤 안쪽 물 온도(°C)', value: (r) => String(r.inner10) },
    { label: '10분 뒤 바깥 물 온도(°C)', value: (r) => String(r.outer10) },
    { label: '두 온도 차가 1 °C 안이 된 때(분)', value: sameMinText },
  ],
  // 가상 온도계 둘: 안쪽 컵 물과 바깥 비커 물(실험 전에는 처음 온도)
  sensors: (snapshot, values) => [
    { id: 'inner', label: '가상 온도 센서 1: 안쪽 컵 물', ariaLabel: '온도 센서 1, 안쪽 컵 물', unit: '°C', kind: 'temperature', source: snapshot?.innerC ?? Number(values.hotC) },
    { id: 'outer', label: '가상 온도 센서 2: 바깥 비커 물', ariaLabel: '온도 센서 2, 바깥 비커 물', unit: '°C', kind: 'temperature', source: snapshot?.outerC ?? 20 },
  ],
  MacroView: HeatMacroView,
  MicroView: HeatThermalView,
};
