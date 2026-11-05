import {
  interpolateStream,
  pourSeconds,
  simulateStream,
  validateStreamExperiment,
  type StreamParams,
  type StreamResult,
  type StreamSample,
} from '@sci/engine-earth';
import { BEAKER_G } from '@sci/sensors';
import type { ExperimentModule } from '../types';
import { streamOptions, toParams } from './initial';
import { StreamMacroView } from './StreamMacroView';
import { StreamGrainView } from './StreamGrainView';

export const streamTableModule: ExperimentModule<StreamSample, StreamResult> = {
  kind: 'stream-table',
  validate: validateStreamExperiment,
  simulate: (values, exp) => simulateStream(values as unknown as StreamParams, streamOptions(exp)),
  interpolate: interpolateStream,
  // 예측 비교는 깎인 흙(g)으로 한다. 0.5 g 안이면 같은 결과로 본다(그릇만 바꾸면 완전히 같다).
  metric: { sampleKey: 'eroded', resultKey: 'eroded', sameThreshold: () => 0.5 },
  // 재생이 끝나면 플레이헤드를 60초(그래프 끝)에 둔다.
  restPlayhead: 60,
  graph: {
    yLabel: '흙의 양(g)',
    // 가파르게 2 L의 깎인 흙 100 g까지 담도록 0~100 고정
    yTicks: [0, 20, 40, 60, 80, 100],
    xLabel: '시간(초)',
    xTicks: [0, 10, 20, 30, 40, 50, 60],
    // 붓기가 끝나는 때는 물의 양에 따라 다르다.
    markers: (_exp, trial) => [{ t: pourSeconds(toParams(trial.values).waterL), label: '붓기 끝' }],
    series: [
      { key: 'eroded', label: '깎인 흙(g)', color: '#b45309' },
      { key: 'deposited', label: '쌓인 흙(g)', color: '#1d4ed8', dash: '7 4' },
    ],
  },
  resultColumns: () => [
    { label: '깎인 흙(g)', value: (r) => String(r.eroded) },
    { label: '쌓인 흙(g)', value: (r) => String(r.deposited) },
  ],
  // 가상 전자저울: 아래쪽 평평한 곳에 쌓인 흙의 무게(받침 100 g은 빼고 보여 준다).
  sensors: (snapshot) => [{ id: 'deposit-scale', label: '가상 전자저울: 쌓인 흙', unit: 'g', kind: 'scale', source: (snapshot?.deposited ?? 0) - BEAKER_G }],
  MacroView: StreamMacroView,
  MicroView: StreamGrainView,
};
