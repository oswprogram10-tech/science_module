import { interpolateGreenhouse, simulateGreenhouse, validateGreenhouseExperiment, type GreenhouseParams, type GreenhouseResult, type GreenhouseSample } from '@sci/engine-ssi';
import type { ExperimentModule } from '../types';
import { IDLE_SAMPLE, greenhouseOptions, signedRise } from './initial';
import { BottleView } from './BottleView';
import { HeatFlowView } from './HeatFlowView';
import { ClimateDataPanel } from './ClimateDataPanel';

export const greenhouseBottleModule: ExperimentModule<GreenhouseSample, GreenhouseResult> = {
  kind: 'greenhouse-bottle',
  validate: validateGreenhouseExperiment,
  simulate: (values, exp) => {
    const { samples, result } = simulateGreenhouse(values as unknown as GreenhouseParams, greenhouseOptions(exp));
    return { samples, result };
  },
  interpolate: interpolateGreenhouse,
  // 예측 비교는 20분 동안 오른 온도(rise)로 하고 0.2 °C 안이면 같은 결과로 본다(뚜껑 색만 바꾸면 완전히 같다).
  // 그래프가 앞 시행을 흐리게 겹치는 선(sampleKey)은 y축 20~35 안에 들어오도록 병 속 온도(temp)로 둔다(rise는 0~11이라 축 밖이다).
  metric: { sampleKey: 'temp', resultKey: 'rise', sameThreshold: () => 0.2 },
  // 재생이 끝나면 플레이헤드를 20분(그래프 끝)에 둔다.
  restPlayhead: 20,
  graph: {
    yLabel: '병 속 온도(°C)',
    // 덮개와 이산화 탄소를 모두 쓴 33.1 °C까지 담도록 20~35 고정
    yMin: 20,
    yTicks: [20, 25, 30, 35],
    xLabel: '시간(분)',
    xTicks: [0, 5, 10, 15, 20],
  },
  resultColumns: () => [
    { label: '오른 온도(°C)', value: (r) => signedRise(r.rise) },
    { label: '20분 뒤 온도(°C)', value: (r) => r.temp.toFixed(1) },
  ],
  // 실행 전에는 처음 온도(조건과 상관없음)를 보여 준다.
  sensors: (snapshot) => [{ id: 'greenhouse-temp', label: '가상 온도계: 병 속', unit: '°C', kind: 'temperature', source: (snapshot ?? IDLE_SAMPLE).temp }],
  // 결과표 아래의 접힌 실제 기온 자료(서울 연평균기온). 시뮬레이션·결과·튜터와 연결하지 않는다.
  ResultsExtra: ClimateDataPanel,
  MacroView: BottleView,
  MicroView: HeatFlowView,
};
