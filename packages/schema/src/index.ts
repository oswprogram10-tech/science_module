import { z } from 'zod';

const optionValue = z.union([z.string(), z.number()]);

export const optionSchema = z.object({
  value: optionValue,
  label: z.string().min(1),
});

export const variableSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('choice'),
    unit: z.string().optional(),
    options: z.array(optionSchema).min(1),
    default: optionValue,
  })
  .refine((v) => v.options.some((o) => o.value === v.default), {
    message: 'default는 options 중 하나여야 합니다.',
    path: ['default'],
  });

export const dependentSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().optional(),
});

export const gatewaySchema = z.object({
  mode: z.enum(['open', 'guided']),
  requirePrediction: z.boolean(),
  requireSingleIV: z.boolean(),
});

export const probeWhenSchema = z.enum([
  'before-run',
  'first-trial',
  'confounded',
  'iv-unchanged',
  'repeat',
  'fair-test',
  'prediction-mismatch',
]);

export const probeSchema = z.object({
  when: probeWhenSchema,
  /** 이 조작변인일 때만 쓰는 질문. */
  iv: z.string().min(1).optional(),
  text: z.string().min(1),
});

export const tutorConfigSchema = z.object({
  forbiddenAnswers: z.array(z.string().min(1)),
  probes: z.array(probeSchema).min(1),
});

/** 변인 실험(조작변인을 바꿔 수치를 비교하는 활동)의 모듈 종류. */
export const moduleKindSchema = z.enum(['dissolution', 'gas-syringe', 'candle-jar', 'insulated-cup', 'convex-lens', 'electromagnet', 'magma-cooling', 'sun-angle', 'germination', 'transpiration', 'food-web', 'mold-growth', 'exercise-body', 'lever-balance', 'string-sound', 'magnet-distance', 'ramp-cart']);

export const safetyNoticeSchema = z.object({
  key: z.string().min(1),
  value: optionValue,
  text: z.string().min(1),
});

const commonShape = {
  id: z.string().min(1),
  title: z.string().min(1),
  question: z.string().min(1),
  /** 모듈별 설정. 모듈의 validate가 검사한다. */
  params: z.record(z.string(), z.unknown()).optional(),
  safety: z.array(z.string()).default([]),
  safetyNotices: z.array(safetyNoticeSchema).optional(),
  limits: z.array(z.string()).default([]),
};

/** 안전 경고 배너 문구를 단원에 맞게 바꾼다. 없는 종류는 기본 문구를 쓴다. */
export const safetyMessagesSchema = z.object({
  NO_GOGGLES: z.string().min(1).optional(),
  NO_GLOVES: z.string().min(1).optional(),
  SPILL: z.string().min(1).optional(),
  FOOD: z.string().min(1).optional(),
});

export const variableExperimentSchema = z.object({
  ...commonShape,
  /** 있으면 처음 실행을 누를 때 안전 점검표 대화상자를 띄운다. */
  safetyChecklist: z.array(z.string().min(1)).optional(),
  safetyMessages: safetyMessagesSchema.optional(),
  module: moduleKindSchema,
  /** dissolution 모듈의 validate가 필수로 검사한다. */
  spoonGrams: z.number().positive().optional(),
  predictionPrompt: z.string().min(1),
  variables: z.array(variableSchema).min(1),
  dependent: z.array(dependentSchema).min(1),
  gateway: gatewaySchema,
  tutor: tutorConfigSchema,
});

// ---- 분류 활동 ----

export const CLASSIFY_MODULE = 'indicator-classify' as const;

export const classifyProbeWhenSchema = z.enum([
  'before-test',
  'testing',
  'check-inconsistent',
  'check-untested',
  'check-complete',
  'prediction-mismatch',
]);

export const classifyProbeSchema = z.object({
  when: classifyProbeWhenSchema,
  text: z.string().min(1),
});

export const classifyTutorConfigSchema = z.object({
  forbiddenAnswers: z.array(z.string().min(1)),
  probes: z.array(classifyProbeSchema).min(1),
});

export const colorPatternSchema = z.enum([
  'none',
  'diagonal',
  'diagonal-sparse',
  'dots',
  'cross',
  'horizontal',
  'vertical',
]);

export const colorDefSchema = z.object({
  label: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, '#rrggbb 형식이어야 합니다.'),
  pattern: colorPatternSchema,
});

export const groupSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export const solutionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 내부 값. 화면, 튜터, xAPI에 드러내지 않는다. */
  level: z.number(),
  hazard: z.boolean().optional(),
});

export const indicatorSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['paper', 'drop']),
  colors: z.array(z.object({ max: z.number(), color: z.string().min(1) })).min(1),
  initial: z.string().min(1),
});

export const classificationExperimentSchema = z.object({
  ...commonShape,
  module: z.literal(CLASSIFY_MODULE),
  groups: z.array(groupSchema).min(1),
  solutions: z.array(solutionSchema).min(1),
  indicators: z.array(indicatorSchema).min(1),
  colors: z.record(z.string(), colorDefSchema),
  safetyChecklist: z.array(z.string().min(1)).default([]),
  tutor: classifyTutorConfigSchema,
});

// ---- 관찰 활동 ----

export const OBSERVE_MODULE = 'sky-observation' as const;

export const observationProbeWhenSchema = z.enum([
  'before-observe',
  'observing',
  'record-mismatch',
  'record-match',
  'prediction-mismatch',
]);

export const observationProbeSchema = z.object({
  when: observationProbeWhenSchema,
  text: z.string().min(1),
});

/** 관찰 과제의 모델 결과를 계산하는 규칙 이름. 계산은 @sci/engine-earth의 answerFor가 맡는다. */
export const observationAnswerSchema = z.enum([
  'sun-path-direction',
  'antipode-day-night',
  'star-path-direction',
  'constellation-changes',
  'winter-constellation',
]);

export const observationControlSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    options: z.array(optionSchema).min(1),
    default: optionValue,
  })
  .refine((c) => c.options.some((o) => o.value === c.default), {
    message: 'default는 options 중 하나여야 합니다.',
    path: ['default'],
  });

export const observationTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  question: z.string().min(1),
  options: z.array(optionSchema).min(2).max(5),
  view: z.enum(['rotation', 'revolution']),
  controls: z.array(observationControlSchema).optional(),
  answer: observationAnswerSchema,
  probes: z.array(observationProbeSchema),
});

export const observationTutorConfigSchema = z.object({
  forbiddenAnswers: z.array(z.string().min(1)),
  /** 관찰 활동의 질문은 과제(tasks[].probes)에 있다. */
  probes: z.array(z.unknown()),
});

export const observationExperimentSchema = z.object({
  ...commonShape,
  module: z.literal(OBSERVE_MODULE),
  tasks: z.array(observationTaskSchema).min(1),
  tutor: observationTutorConfigSchema,
});

// ---- 카드 분류 활동 ----

export const CARD_SORT_MODULE = 'card-sort' as const;

export const cardSortProbeWhenSchema = z.enum([
  'choose-criterion',
  'pick-card',
  'before-observe',
  'sorting',
  'check-subjective',
  'check-unplaced',
  'check-unobserved',
  'check-inconsistent',
  'check-complete',
  'tree-split-empty',
  'tree-next-node',
  'finished',
]);

export const cardSortProbeSchema = z.object({
  when: cardSortProbeWhenSchema,
  text: z.string().min(1),
});

export const cardSortTutorConfigSchema = z.object({
  forbiddenAnswers: z.array(z.string().min(1)),
  probes: z.array(cardSortProbeSchema).min(1),
});

/** 카드 배치 형태. 무리 나누기(groups)와 두 갈래 트리(tree)가 있고, 나중에 'order'를 더한다. */
export const cardSortLayoutSchema = z.enum(['groups', 'tree']);

export const sortFeatureSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export const sortCriterionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 객관적 기준이 보는 특징. 주관적 기준에는 없다. */
  feature: z.string().min(1).optional(),
  objective: z.boolean(),
  /** 무리. 객관적 기준에서는 value가 특징값과 1:1로 대응한다. */
  groups: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).min(2),
});

export const sortCardSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 그림 key. 학생 앱이 key별 그림을 그린다. */
  icon: z.string().min(1),
  /** 특징 key -> 특징값. 화면에 드러내지 않는다. */
  features: z.record(z.string(), z.string().min(1)),
  /** 특징 key -> 관찰 문장(보이는 사실만). */
  observations: z.record(z.string(), z.string().min(1)),
});

export const cardSortExperimentSchema = z.object({
  ...commonShape,
  module: z.literal(CARD_SORT_MODULE),
  layout: cardSortLayoutSchema,
  features: z.array(sortFeatureSchema).min(1),
  criteria: z.array(sortCriterionSchema).min(1),
  cards: z.array(sortCardSchema).min(1),
  safetyChecklist: z.array(z.string().min(1)).default([]),
  tutor: cardSortTutorConfigSchema,
}).refine(
  (e) =>
    e.layout !== 'tree' ||
    e.criteria.every((c) => c.groups.length === 2 && c.groups[0]!.value === 'yes' && c.groups[1]!.value === 'no'),
  { message: '트리에서는 모든 기준의 무리가 정확히 예(yes)·아니요(no) 둘이어야 합니다.', path: ['criteria'] },
);

export const experimentSchema = z.discriminatedUnion('module', [
  variableExperimentSchema,
  classificationExperimentSchema,
  observationExperimentSchema,
  cardSortExperimentSchema,
]);

export const manifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  standards: z.array(z.string()),
  engine: z.string().min(1),
  experiments: z.array(experimentSchema).min(1),
});

export type OptionValue = string | number;
export type Variable = z.infer<typeof variableSchema>;
export type ModuleKind = z.infer<typeof moduleKindSchema>;
export type SafetyNotice = z.infer<typeof safetyNoticeSchema>;
export type SafetyMessages = z.infer<typeof safetyMessagesSchema>;
export type Probe = z.infer<typeof probeSchema>;
export type ProbeWhen = z.infer<typeof probeWhenSchema>;
export type GatewayConfig = z.infer<typeof gatewaySchema>;
export type TutorConfig = z.infer<typeof tutorConfigSchema>;
export type VariableExperiment = z.infer<typeof variableExperimentSchema>;
export type ClassificationExperiment = z.infer<typeof classificationExperimentSchema>;
export type ObservationExperiment = z.infer<typeof observationExperimentSchema>;
export type ObservationTask = z.infer<typeof observationTaskSchema>;
export type ObservationControl = z.infer<typeof observationControlSchema>;
export type ObservationAnswerRule = z.infer<typeof observationAnswerSchema>;
export type ObservationProbe = z.infer<typeof observationProbeSchema>;
export type ObservationProbeWhen = z.infer<typeof observationProbeWhenSchema>;
export type CardSortExperiment = z.infer<typeof cardSortExperimentSchema>;
export type CardSortProbe = z.infer<typeof cardSortProbeSchema>;
export type CardSortProbeWhen = z.infer<typeof cardSortProbeWhenSchema>;
export type SortFeature = z.infer<typeof sortFeatureSchema>;
export type SortCriterion = z.infer<typeof sortCriterionSchema>;
export type SortCard = z.infer<typeof sortCardSchema>;
export type Experiment = VariableExperiment | ClassificationExperiment | ObservationExperiment | CardSortExperiment;
export type ClassifyProbe = z.infer<typeof classifyProbeSchema>;
export type ClassifyProbeWhen = z.infer<typeof classifyProbeWhenSchema>;
export type ColorDef = z.infer<typeof colorDefSchema>;
export type ColorPattern = z.infer<typeof colorPatternSchema>;
export type ClassifySolution = z.infer<typeof solutionSchema>;
export type ClassifyIndicator = z.infer<typeof indicatorSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export const isVariableExperiment = (e: Experiment): e is VariableExperiment =>
  e.module !== CLASSIFY_MODULE && e.module !== OBSERVE_MODULE && e.module !== CARD_SORT_MODULE;
export const isClassificationExperiment = (e: Experiment): e is ClassificationExperiment =>
  e.module === CLASSIFY_MODULE;

export const isObservationExperiment = (e: Experiment): e is ObservationExperiment => e.module === OBSERVE_MODULE;
export const isCardSortExperiment = (e: Experiment): e is CardSortExperiment => e.module === CARD_SORT_MODULE;

export class ManifestError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`매니페스트 검증 실패:\n${issues.join('\n')}`);
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

/** 매니페스트를 검증해 돌려준다. 실패하면 ManifestError를 던진다. */
export function parseManifest(input: unknown): Manifest {
  const result = manifestSchema.safeParse(input);
  if (!result.success) {
    throw new ManifestError(
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return result.data;
}
