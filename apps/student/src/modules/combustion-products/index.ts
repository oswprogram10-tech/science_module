import {
  CP_SAME_STAGE,
  interpolateCombustionProducts,
  simulateCombustionProducts,
  validateCombustionProductsExperiment,
  type CombustionProductsParams,
  type CombustionProductsResult,
  type CombustionProductsSample,
} from '@sci/engine-matter';
import type { ExperimentModule } from '../types';
import { cloudText, outcomeName } from './initial';
import { ProductsMacroView } from './ProductsMacroView';
import { ProductsRecordView } from './ProductsRecordView';

export const combustionProductsModule: ExperimentModule<CombustionProductsSample, CombustionProductsResult> = {
  kind: 'combustion-products',
  validate: validateCombustionProductsExperiment,
  simulate: (values) => simulateCombustionProducts(values as unknown as CombustionProductsParams),
  interpolate: interpolateCombustionProducts,
  // 그래프는 sampleKey(석회수 뿌연 정도 cloud)를 그린다. 종이 검사에는 이 값이 없어(NaN) 선을 그리지 않는다.
  // 예측 비교는 결과의 stage(변화 단계: 0 = 변화 없음, 종이 0~1, 석회수 0~2)로 하고, 한 단계 아래 차이는 같은 결과로 본다(0.5).
  // 검사 결과 이름(범주)은 숫자가 아니라 결과 열과 검사 결과 기록(둘째 그림)에 쓴다.
  metric: { sampleKey: 'cloud', resultKey: 'stage', sameThreshold: () => CP_SAME_STAGE },
  graph: {
    yLabel: '석회수 뿌연 정도(눈금)',
    // 석회수 8까지 담도록 0~10 고정
    yTicks: [0, 2, 4, 6, 8, 10],
    xLabel: '시간(분)',
    xTicks: [0, 1, 2, 3],
    emptyText: '종이 검사는 선을 그리지 않아요.',
  },
  resultColumns: () => [
    { label: '검사 결과', value: (r) => outcomeName(r.result) },
    { label: '석회수 뿌연 정도(눈금 0~10)', value: (r) => cloudText(r.cloud) },
    { label: '초가 짧아진 길이(mm)', value: (r) => r.shorterMm.toFixed(1) },
    { label: '변화 단계(0 = 변화 없음)', value: (r) => String(r.stage) },
  ],
  // 이 활동에는 가상 센서가 없다(검사 결과는 눈으로 본다).
  sensors: () => [],
  MacroView: ProductsMacroView,
  MicroView: ProductsRecordView,
};
