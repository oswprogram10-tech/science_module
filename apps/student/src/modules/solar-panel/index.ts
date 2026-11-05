import { interpolateSolar, simulateSolar, validateSolarExperiment, type SolarParams, type SolarResult, type SolarSample } from '@sci/engine-ssi';
import type { ExperimentModule } from '../types';
import { solarOptions } from './initial';
import { PanelView } from './PanelView';
import { BeamView } from './BeamView';

export const solarPanelModule: ExperimentModule<SolarSample, SolarResult> = {
  kind: 'solar-panel',
  validate: validateSolarExperiment,
  simulate: (values, exp) => {
    const { samples, result } = simulateSolar(values as unknown as SolarParams, solarOptions(exp));
    return { samples, result };
  },
  interpolate: interpolateSolar,
  // 예측 비교는 만든 전기(power)로 하고 1 mW 안이면 같은 결과로 본다(테두리 색만 바꾸면 완전히 같다).
  // 그래프가 앞 시행을 흐리게 겹치는 선(sampleKey)은 y축에 쓰는 프로펠러가 돈 횟수(turns)로 둔다.
  metric: { sampleKey: 'turns', resultKey: 'power', sameThreshold: () => 1 },
  // 재생이 끝나면 플레이헤드를 60초(그래프 끝)에 둔다.
  restPlayhead: 60,
  graph: {
    yLabel: '프로펠러가 돈 횟수(번)',
    // 맑은 날 30°(120번)까지 담도록 0~125 고정
    yMin: 0,
    yTicks: [0, 25, 50, 75, 100, 125],
    integerTicks: true,
    xLabel: '시간(초)',
    xTicks: [0, 10, 20, 30, 40, 50, 60],
  },
  resultColumns: () => [
    { label: '만든 전기(mW)', value: (r) => String(r.power) },
    { label: '1분 동안 돈 횟수(번)', value: (r) => String(r.turns) },
  ],
  // 실행 전에는 0 mW(전기를 만들기 전)를 보여 준다. 조건과 상관없는 값이라 결과를 드러내지 않는다.
  sensors: (snapshot) => [{ id: 'solar-power', label: '가상 전력계', unit: 'mW', kind: 'power', source: snapshot ? Math.round(snapshot.powerMw) : 0 }],
  MacroView: PanelView,
  MicroView: BeamView,
};
