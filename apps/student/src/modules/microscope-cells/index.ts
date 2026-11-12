import {
  MC_SAME_MM,
  MC_SIZE_MAX,
  interpolateMicroscope,
  simulateMicroscope,
  validateMicroscopeExperiment,
  type MicroscopeParams,
  type MicroscopeResult,
  type MicroscopeSample,
} from '@sci/engine-life';
import type { ExperimentModule } from '../types';
import { MicroscopeBarsView } from './MicroscopeBarsView';
import { MicroscopeMacroView } from './MicroscopeMacroView';
import { sizeText } from './initial';

export const microscopeCellsModule: ExperimentModule<MicroscopeSample, MicroscopeResult> = {
  kind: 'microscope-cells',
  validate: validateMicroscopeExperiment,
  simulate: (values) => simulateMicroscope(values as unknown as MicroscopeParams),
  interpolate: interpolateMicroscope,
  // 그래프는 sampleKey(화면에서 본 칸 하나의 길이 size)를 그린다. 초점을 맞추지 않으면 칸이 보이지 않아(NaN) 선을 그리지 않는다.
  // 예측 비교도 결과의 size로 하고(값이 없으면 0으로 본다), 0.5 mm 안이면 같은 결과로 본다.
  // 보인 것(범주)은 숫자가 아니라 결과 열에만 쓴다. 시행끼리 견주는 막대 그래프는 둘째 그림(MicroscopeBarsView)이 그린다.
  metric: { sampleKey: 'size', resultKey: 'size', sameThreshold: () => MC_SAME_MM },
  graph: {
    yLabel: '화면에서 본 칸 하나의 길이(mm)',
    // 가장 큰 값(100 mm)을 담도록 0~110 고정
    yTicks: [0, 55, MC_SIZE_MAX],
    xLabel: '시간(초)',
    xTicks: [0, 1, 2],
    emptyText: '초점이 맞지 않아 칸이 보이지 않아요',
  },
  resultColumns: () => [
    { label: '화면에서 본 칸 하나의 길이(mm)', value: (r) => sizeText(r.size) },
    { label: '보인 것', value: (r) => r.seen },
  ],
  // 가상 눈금자(시야 눈금): 거리 센서는 cm로 읽으므로 mm ÷ 10을 읽고, 화면에는 mm(× 10)로 보여 준다. 칸이 보이지 않으면 0.
  sensors: (snapshot) => [
    {
      id: 'field-ruler',
      label: '가상 눈금자: 시야의 칸 길이',
      unit: 'mm',
      kind: 'distance',
      source: snapshot && Number.isFinite(snapshot.size) ? snapshot.size / 10 : 0,
      decimals: 0,
      display: { scale: 10, unitLabel: 'mm' },
    },
  ],
  MacroView: MicroscopeMacroView,
  MicroView: MicroscopeBarsView,
};
