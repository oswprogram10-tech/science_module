import { interpolateSpread, simulateSpread, validateSpreadExperiment, type SpreadParams, type SpreadResult, type SpreadSample } from '@sci/engine-ssi';
import type { ExperimentModule } from '../types';
import { spreadOptions } from './initial';
import { ClassroomView } from './ClassroomView';
import { ContactView } from './ContactView';

export const infectionSpreadModule: ExperimentModule<SpreadSample, SpreadResult> = {
  kind: 'infection-spread',
  validate: validateSpreadExperiment,
  simulate: (values, exp) => {
    const { samples, result } = simulateSpread(values as unknown as SpreadParams, spreadOptions(exp));
    return { samples, result };
  },
  interpolate: interpolateSpread,
  // 예측 비교는 20일 동안 감염된 사람 수(total)로 하고 0.5명 안이면 같은 결과로 본다(자리만 바꾸면 완전히 같다).
  metric: { sampleKey: 'total', resultKey: 'total', sameThreshold: () => 0.5 },
  // 재생이 끝나면 플레이헤드를 20일(그래프 끝)에 둔다.
  restPlayhead: 20,
  graph: {
    yLabel: '사람 수(명)',
    // 반 전체 30명까지 담도록 0~30 고정
    yTicks: [0, 5, 10, 15, 20, 25, 30],
    xLabel: '날짜(일)',
    xTicks: [0, 5, 10, 15, 20],
    series: [
      { key: 'sick', label: '지금 아픈 사람(명)', color: '#c2410c' },
      { key: 'total', label: '지금까지 감염된 사람(명)', color: '#1d4ed8', dash: '7 4' },
    ],
  },
  resultColumns: () => [
    { label: '20일 동안 감염된 사람(명)', value: (r) => String(r.total) },
    { label: '가장 많이 아팠던 날의 아픈 사람(명)', value: (r) => String(r.peak) },
  ],
  // 센서 없음: 센서 막대를 그리지 않는다.
  sensors: () => [],
  MacroView: ClassroomView,
  MicroView: ContactView,
};
