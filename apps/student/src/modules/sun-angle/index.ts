import {
  interpolateSunAngle,
  simulateSunAngle,
  validateSunAngleExperiment,
  type SunAngleParams,
  type SunAngleResult,
  type SunAngleSample,
} from '@sci/engine-earth';
import type { ExperimentModule } from '../types';
import { dayLengthText, noonSample, sunOptions } from './initial';
import { SunMacroView } from './SunMacroView';
import { SunSpaceView } from './SunSpaceView';

export const sunAngleModule: ExperimentModule<SunAngleSample, SunAngleResult> = {
  kind: 'sun-angle',
  validate: validateSunAngleExperiment,
  simulate: (values, exp) => simulateSunAngle(values as unknown as SunAngleParams, sunOptions(exp)),
  interpolate: interpolateSunAngle,
  // 예측 비교는 남중 고도로, 그래프는 하루 동안의 태양 고도로 그린다.
  metric: { sampleKey: 'sunAltDeg', resultKey: 'noonAltDeg', sameThreshold: () => 0.5 },
  restPlayhead: 12,
  graph: {
    yLabel: '태양 고도(°)',
    yMin: 0,
    xLabel: '시각(시)',
    xTicks: [0, 6, 12, 18, 24],
    xTickFormat: (t) => String(t),
    markers: [{ t: 12, label: '남중' }],
  },
  resultColumns: () => [
    { label: '남중 고도(°)', value: (r) => r.noonAltDeg.toFixed(1) },
    { label: '낮 12시 그림자(cm)', value: (r) => r.noonShadowCm.toFixed(1) },
    { label: '낮의 길이', value: (r) => dayLengthText(r.dayLengthH) },
    { label: '하루 동안 받은 에너지(봄 = 100)', value: (r) => String(r.energyIdx) },
  ],
  // 실험 전에는 고른 조건의 낮 12시 값을 보여 준다(눈으로 보기 화면도 같다).
  sensors: (snapshot, values) => [
    {
      id: 'light',
      label: '가상 빛 세기 센서',
      unit: '%',
      kind: 'light',
      source: snapshot?.lightPct ?? noonSample(values).lightPct,
    },
  ],
  MacroView: SunMacroView,
  MicroView: SunSpaceView,
};
