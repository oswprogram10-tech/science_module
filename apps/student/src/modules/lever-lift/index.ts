import {
  LIFT_SAME_G,
  interpolateLeverLift,
  simulateLeverLift,
  validateLeverLiftExperiment,
  type LeverLiftParams,
  type LeverLiftResult,
  type LeverLiftSample,
} from '@sci/engine-physics';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { LiftBarsView } from './LiftBarsView';
import { LiftMacroView } from './LiftMacroView';

export const leverLiftModule: ExperimentModule<LeverLiftSample, LeverLiftResult> = {
  kind: 'lever-lift',
  validate: validateLeverLiftExperiment,
  // 변인 이름은 armCm(힘을 주는 쪽 길이)이고 모델 입력은 arm이다.
  simulate: (values) => simulateLeverLift({ tool: values.tool, arm: values.armCm, color: values.color } as unknown as LeverLiftParams),
  interpolate: interpolateLeverLift,
  // 그래프는 sampleKey(저울 눈금 force)를 그린다. 예측 비교는 결과의 force(저울 눈금, g)로 하고, 5 g 안이면 같은 결과로 본다.
  metric: { sampleKey: 'force', resultKey: 'force', sameThreshold: () => LIFT_SAME_G },
  graph: {
    yLabel: '저울 눈금(g)',
    // 0~250 g 고정: 도구 없이 200 g도 담긴다.
    yTicks: [0, 50, 100, 150, 200, 250],
    // 가로축은 손으로 당긴 거리: 시행마다 가로선이 당긴 거리만큼 이어진다.
    xLabel: '손으로 당긴 거리(cm)',
    xTicks: [0, 30, 60, 90, 120],
  },
  resultColumns: () => [
    { label: '저울 눈금(g)', value: (r) => String(r.force) },
    { label: '손으로 당긴 거리(cm)', value: (r) => String(r.pullCm) },
  ],
  // 가상 용수철저울: 상자를 들어 올리는 동안 눈금(받침 100 g은 빼고 보여 준다).
  sensors: (snapshot) => [{ id: 'spring-scale', label: '가상 용수철저울: 저울 눈금', unit: 'g', kind: 'scale', source: (snapshot?.force ?? 0) - BEAKER_G }],
  MacroView: LiftMacroView,
  MicroView: LiftBarsView,
};
