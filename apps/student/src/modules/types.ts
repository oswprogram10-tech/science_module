import type { ComponentType } from 'react';
import type { Values } from '@sci/gateway';
import type { Trial } from '@sci/runtime';
import type { SensorKind } from '@sci/sensors';
import type { ClassificationExperiment, VariableExperiment as Experiment, ModuleKind } from '@sci/schema';

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
  /** yMin: y축 눈금이 시작하는 값(기본 0) */
  graph: { yLabel: string; yMin?: number };
  resultColumns(exp: Experiment): ResultColumn<R>[];
  sensors(snapshot: S | null, values: Values): SensorSpec[];
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
