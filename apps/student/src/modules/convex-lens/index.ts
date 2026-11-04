import {
  interpolateConvexLens,
  simulateConvexLens,
  validateConvexLensExperiment,
  type ConvexLensParams,
  type ConvexLensResult,
  type ConvexLensSample,
} from '@sci/engine-physics';
import type { ExperimentModule } from '../types';
import { lensOptions } from './initial';
import { LensMacroView } from './LensMacroView';
import { LensRayView } from './LensRayView';

/** 실험 전(스냅샷이 없을 때) 센서가 보여 주는 종이의 온도(°C). 매니페스트 params.roomC의 기본값과 같다. */
export const ROOM_FALLBACK_C = 20;

export const convexLensModule: ExperimentModule<ConvexLensSample, ConvexLensResult> = {
  kind: 'convex-lens',
  validate: validateConvexLensExperiment,
  simulate: (values, exp) => simulateConvexLens(values as unknown as ConvexLensParams, lensOptions(exp)),
  interpolate: interpolateConvexLens,
  // 예측 비교와 그래프 모두 빛이 모인 곳의 온도로 한다.
  metric: { sampleKey: 'spotC', resultKey: 'endC', sameThreshold: () => 1 },
  graph: { yLabel: '빛이 모인 곳의 온도(°C)', yMin: 20 },
  resultColumns: () => [
    { label: '빛 원의 지름(mm)', value: (r) => r.spotMm.toFixed(1) },
    { label: '밝기', value: (r) => (r.concentration >= 1000 ? '1000배 이상' : `햇빛의 ${r.concentration}배`) },
    { label: '1분 뒤 온도(°C)', value: (r) => r.endC.toFixed(1) },
    { label: '그을림', value: (r) => (r.scorched ? '그을림' : '–') },
  ],
  sensors: (snapshot) => [
    {
      id: 'spot',
      label: '가상 온도 센서: 종이 아래',
      unit: '°C',
      kind: 'temperature',
      source: snapshot?.spotC ?? ROOM_FALLBACK_C,
    },
  ],
  MacroView: LensMacroView,
  MicroView: LensRayView,
};
