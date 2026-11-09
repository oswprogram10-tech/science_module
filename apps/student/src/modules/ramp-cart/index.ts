import {
  arrivalS,
  interpolateRamp,
  simulateRamp,
  validateRampExperiment,
  type RampParams,
  type RampResult,
  type RampSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { rampOptions, toParams } from './initial';
import { RampMacroView } from './RampMacroView';
import { SpeedCalcView } from './SpeedCalcView';

export const rampCartModule: ExperimentModule<RampSample, RampResult> = {
  kind: 'ramp-cart',
  validate: validateRampExperiment,
  simulate: (values, exp) => simulateRamp(values as unknown as RampParams, rampOptions(exp)),
  interpolate: interpolateRamp,
  // 예측 비교는 속력(m/s)으로 한다. 반올림한 값 기준 0.02 m/s 안이면 같은 결과로 본다.
  metric: { sampleKey: 'x', resultKey: 'speed', sameThreshold: () => 0.02 },
  // 재생이 끝나면 플레이헤드를 1.2초(그래프 끝)에 둔다.
  restPlayhead: 1.2,
  graph: {
    yLabel: '출발선에서의 거리(m)',
    yMin: 0,
    // 멈춤 벽(1.5 m)까지를 고정 범위로 둔다. 어떤 조건에서도 축이 변하지 않는다.
    yTicks: [0, 0.5, 1, 1.5],
    xLabel: '시간(초)',
    xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2],
    xTickFormat: (t) => t.toFixed(1),
    // 1 m 도착 시각은 시행의 조건(높이·바닥)마다 다르다.
    markers: (_exp, trial) => [{ t: arrivalS(toParams(trial.values)), label: '1 m 도착', labelSide: 'left' }],
  },
  resultColumns: () => [
    { label: '1 m 가는 데 걸린 시간(초)', value: (r) => r.timeS.toFixed(2) },
    { label: '속력(m/s)', value: (r) => r.speed.toFixed(2) },
  ],
  // 가상 속력 센서: 수레의 그 순간 빠르기(m/s)를 보여 준다. 실제로 재는 것이 아니다.
  sensors: (snapshot) => [{ id: 'speed', label: '가상 속력 센서', unit: 'm/s', kind: 'speed', source: snapshot?.v ?? 0 }],
  MacroView: RampMacroView,
  MicroView: SpeedCalcView,
};
