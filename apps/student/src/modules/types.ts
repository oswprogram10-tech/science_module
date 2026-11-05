import type { ComponentType } from 'react';
import type { Values } from '@sci/gateway';
import type { Trial } from '@sci/runtime';
import type { SensorKind } from '@sci/sensors';
import type { CardSortExperiment, ClassificationExperiment, ObservationExperiment, VariableExperiment as Experiment, ModuleKind } from '@sci/schema';

/** 화면이 그리는 데 필요한 값. values는 화면에 보이는 시행(없으면 현재 선택)의 조건이다. */
export interface ViewProps<S extends { t: number }> {
  experiment: Experiment;
  trial: Trial<S, unknown> | undefined;
  snapshot: S | null;
  values: Values;
  playhead: number;
}

/** 표시할 모의 센서와 원천값. App이 kind에 맞는 Mock 드라이버를 만들어 읽는다. */
export interface SensorSpec {
  id: string;
  label: string;
  unit: string;
  kind: SensorKind;
  source: number;
  /** 같은 종류의 센서가 둘 이상일 때 접근성 이름(기본: 종류 이름). */
  ariaLabel?: string;
}

export interface GraphMarker {
  /** 그래프 x축 위치(x축 단위. 기본은 초) */
  t: number;
  label: string;
  /** 'left'이면 라벨을 언제나 선의 왼쪽에 쓴다(기본: 자리가 모자랄 때만). 선이 라벨 오른쪽을 지나가는 그래프용. */
  labelSide?: 'left';
}

export interface GraphSeries {
  /** 샘플의 숫자 속성 이름 */
  key: string;
  /** 범례 글자 */
  label: string;
  color: string;
  dash?: string;
}

export interface ResultColumn<R> {
  label: string;
  value(r: R): string;
}

export interface ExperimentModule<S extends { t: number }, R> {
  kind: ModuleKind;
  validate(exp: Experiment): string[];
  simulate(values: Values, exp: Experiment): { samples: S[]; result: R };
  interpolate(a: S, b: S, k: number): S;
  /** 예측 비교와 그래프 y축에 쓰는 주 측정값 */
  metric: { sampleKey: keyof S; resultKey: keyof R; sameThreshold(exp: Experiment): number };
  /** yMin: y축 눈금이 시작하는 값(기본 0). markers: x축 위의 세로 점선과 라벨(예: 스위치 켜짐·꺼짐 시각), 없으면 그리지 않는다. */
  /** 재생이 끝난 뒤 플레이헤드를 옮겨 둘 시각. 없으면 끝에 둔다(예: 하루 실험은 정오). */
  restPlayhead?: number | ((exp: Experiment, trial: Trial<S, R>) => number);
  graph: {
    yLabel: string;
    /** x축 라벨(기본 '시간(초)'). 괄호 안은 단위로, 플레이헤드 읽기(aria-valuetext)에도 쓴다. */
    xLabel?: string;
    /** x축 눈금 위치. 없으면 재생 길이에 맞춰 자동으로 잡는다. 있으면 마지막 값이 x축 끝이다. */
    xTicks?: number[];
    /** x축 눈금 글자(기본: 자동 눈금의 소수 자릿수에 맞춘 숫자). */
    xTickFormat?: (t: number) => string;
    yMin?: number;
    /** y축 눈금 위치. 없으면 자료에 맞춰 자동으로 잡는다. 있으면 마지막 값이 y축 끝이다. */
    yTicks?: number[];
    /** 개수처럼 정수만 의미 있는 값이면 true: 눈금 간격을 1 이상으로 둔다. */
    integerTicks?: boolean;
    /** 고정 배열, 또는 실험(과 그래프에 보이는 시행)에서 계산하는 함수. 시행마다 시각이 다르면 trial의 조건·결과로 계산한다. */
    /** 여러 선을 한 그래프에 그릴 때의 선 목록. 없으면 metric.sampleKey 한 줄만 그린다. 앞 시행은 언제나 metric.sampleKey만 흐리게 겹친다. dash는 SVG stroke-dasharray(없으면 실선). */
    series?: GraphSeries[];
    markers?: GraphMarker[] | ((exp: Experiment, trial: Trial<S, R>) => GraphMarker[]);
  };
  resultColumns(exp: Experiment): ResultColumn<R>[];
  /** 가장 최근에 끝난 시행의 결과에 따라 결과표 아래에 보여 줄 경고(없으면 null). 없는 모듈은 아무것도 보이지 않는다. */
  resultNote?(r: R): string | null;
  sensors(snapshot: S | null, values: Values): SensorSpec[];
  /** 결과표 아래에 덧붙이는 영역(선택 기능 등). 시뮬레이션·결과·튜터에는 연결하지 않는다. 없으면 아무것도 그리지 않는다. */
  ResultsExtra?: ComponentType<{ experiment: Experiment; values: Values }>;
  MacroView: ComponentType<ViewProps<S>>;
  MicroView: ComponentType<ViewProps<S>>;
}

/** 레지스트리와 App처럼 모듈 종류를 가리지 않는 곳에서 쓰는 형태. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModule = ExperimentModule<any, any>;

/** 분류 활동 모듈. 화면은 ClassifyLab이 그리고, 모듈은 매니페스트 검증만 맡는다. */
export interface ClassifyModule {
  kind: 'indicator-classify';
  validate(exp: ClassificationExperiment): string[];
}

/** 관찰 활동 모듈. 화면은 ObserveLab이 그리고, 모듈은 매니페스트 검증만 맡는다. */
export interface ObserveModule {
  kind: 'sky-observation';
  validate(exp: ObservationExperiment): string[];
}

/** 카드 분류 활동 모듈. 화면은 CardSortLab이 그리고, 모듈은 매니페스트 검증만 맡는다. */
export interface CardSortModule {
  kind: 'card-sort';
  validate(exp: CardSortExperiment): string[];
}
