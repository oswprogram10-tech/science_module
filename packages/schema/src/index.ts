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
export const moduleKindSchema = z.enum(['dissolution', 'gas-syringe', 'candle-jar', 'insulated-cup', 'convex-lens', 'electromagnet', 'magma-cooling', 'sun-angle', 'germination', 'transpiration', 'food-web', 'mold-growth', 'exercise-body', 'lever-balance', 'string-sound', 'magnet-distance', 'ramp-cart', 'freeze-melt', 'salt-sand', 'stream-table', 'land-sea-breeze', 'infection-spread', 'greenhouse-bottle', 'solar-panel']);

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
  'jupiter-earth-size',
  'neptune-distance',
  'pointer-star-target',
  'polaris-motion',
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
  view: z.enum(['rotation', 'revolution', 'solar-system', 'north-sky']),
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
  'order-check-unplaced',
  'order-check-unobserved',
  'order-check-inconsistent',
  'order-check-complete',
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

/** 카드 배치 형태. 무리 나누기(groups), 두 갈래 트리(tree), 순서 놓기(order)가 있다. */
export const cardSortLayoutSchema = z.enum(['groups', 'tree', 'order']);

export const sortFeatureSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 돋보기 버튼 문구(예: "구부려 보기"). 없으면 "{label} 살펴보기". */
  action: z.string().min(1).optional(),
});

export const sortCriterionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 객관적 기준이 보는 특징. 주관적 기준에는 없다. */
  feature: z.string().min(1).optional(),
  /**
   * 판정에서 "관찰했는가"를 따질 특징. 없으면 feature이다. 판정 기준 특징과 관찰 근거 특징이 다를 때만 둔다
   * (예: 환경(env)은 화석(fossil)을 관찰해서 추리한다).
   */
  evidenceFeature: z.string().min(1).optional(),
  objective: z.boolean(),
  /** 무리. 객관적 기준에서는 value가 특징값과 1:1로 대응한다. */
  groups: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).min(2),
});

export const sortCardSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 카드 이름 아래에 덧붙이는 짧은 말(예: 물체를 이루는 물질 "금속"). 없으면 보이지 않는다. */
  sublabel: z.string().min(1).optional(),
  /** 그림 key. 학생 앱이 key별 그림을 그린다. */
  icon: z.string().min(1),
  /** 특징 key -> 특징값. 화면에 드러내지 않는다. */
  features: z.record(z.string(), z.union([z.string().min(1), z.number()])),
  /** 특징 key -> 관찰 문장(보이는 사실만). */
  observations: z.record(z.string(), z.string().min(1)),
});

/** 순서 놓기(order)의 정렬 기준. 카드의 이 특징값(숫자)이 작은 것부터(ascending) 또는 큰 것부터(descending) 놓는다. */
export const orderBySchema = z.object({
  feature: z.string().min(1),
  direction: z.enum(['ascending', 'descending']),
});

export const cardSortExperimentSchema = z.object({
  ...commonShape,
  module: z.literal(CARD_SORT_MODULE),
  layout: cardSortLayoutSchema,
  features: z.array(sortFeatureSchema).min(1),
  /** 순서 놓기(order)에서는 비워 둘 수 있다. 다른 배치에서는 1개 이상. */
  criteria: z.array(sortCriterionSchema),
  /** order일 때 필수. */
  orderBy: orderBySchema.optional(),
  /** order일 때 필수. 처음 더미 순서(카드 key를 한 번씩). */
  initialOrder: z.array(z.string().min(1)).optional(),
  /** order에서 순서를 맞춘 뒤 이어서 하는 무리 나누기 한 단계(선택). */
  followUp: sortCriterionSchema.optional(),
  /** 처음부터 보이는 안내 문구(활동의 전제. 예: 지층이 뒤집히지 않았다). 없으면 보이지 않는다. */
  notice: z.string().min(1).optional(),
  /** 항상 보이는 배경 지식 카드. 카드별 정답은 말하지 않는 일반 지식만 담는다. */
  background: z.object({ title: z.string().min(1), text: z.string().min(1) }).optional(),
  cards: z.array(sortCardSchema).min(1),
  safetyChecklist: z.array(z.string().min(1)).default([]),
  tutor: cardSortTutorConfigSchema,
}).refine(
  (e) =>
    e.layout !== 'tree' ||
    e.criteria.every((c) => c.groups.length === 2 && c.groups[0]!.value === 'yes' && c.groups[1]!.value === 'no'),
  { message: '트리에서는 모든 기준의 무리가 정확히 예(yes)·아니요(no) 둘이어야 합니다.', path: ['criteria'] },
).refine((e) => e.layout === 'order' || e.criteria.length >= 1, {
  message: '분류 기준이 1개 이상 있어야 합니다.',
  path: ['criteria'],
}).refine((e) => e.layout === 'order' || (!e.orderBy && !e.initialOrder && !e.followUp), {
  message: 'orderBy, initialOrder, followUp은 순서 놓기(order)에서만 씁니다.',
  path: ['layout'],
}).refine((e) => e.layout !== 'order' || !!e.orderBy, {
  message: '순서 놓기에는 orderBy가 필요합니다.',
  path: ['orderBy'],
}).refine(
  (e) =>
    e.layout !== 'order' ||
    !e.orderBy ||
    (e.features.some((f) => f.key === e.orderBy!.feature) &&
      e.cards.every((c) => typeof c.features[e.orderBy!.feature] === 'number')),
  { message: 'orderBy 특징은 features에 있어야 하고 모든 카드에 숫자값이 있어야 합니다.', path: ['orderBy'] },
).refine(
  (e) => {
    if (e.layout !== 'order') return true;
    const ids = e.initialOrder;
    if (!ids) return false;
    const keys = e.cards.map((c) => c.key);
    return ids.length === keys.length && new Set(ids).size === ids.length && keys.every((k) => ids.includes(k));
  },
  { message: '순서 놓기의 initialOrder는 모든 카드 key를 한 번씩 포함해야 합니다.', path: ['initialOrder'] },
).refine((e) => !e.followUp || (e.followUp.objective && !!e.followUp.feature), {
  message: 'followUp은 특징(feature)이 있는 객관적 기준이어야 합니다.',
  path: ['followUp'],
});

// ---- 진로 포트폴리오 활동 ----

export const PORTFOLIO_MODULE = 'career-portfolio' as const;

/** 진로 활동의 튜터 질문은 네 단계마다 하나씩 있다. */
export const PORTFOLIO_STAGES = ['stage-1', 'stage-2', 'stage-3', 'stage-4'] as const;
export const portfolioProbeWhenSchema = z.enum(PORTFOLIO_STAGES);

export const portfolioProbeSchema = z.object({
  when: portfolioProbeWhenSchema,
  text: z.string().min(1),
});

/** 정답 누설 개념이 없는 활동이라 forbiddenAnswers는 빈 배열이어도 된다(다른 활동도 같은 형태). */
export const portfolioTutorConfigSchema = z.object({
  forbiddenAnswers: z.array(z.string().min(1)),
  probes: z.array(portfolioProbeSchema).min(1),
});

export const portfolioAreaSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 이 영역에 속하는 단원 id. 영역끼리 겹치지 않는다. */
  units: z.array(z.string().min(1)),
});

export const portfolioSkillSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export const portfolioJobSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  area: z.string().min(1),
  /** 하는 일 한 문장. 성별 중립으로 쓴다("이 일을 하는 사람은 …"). */
  does: z.string().min(1),
  /** 쓰이는 탐구 능력 key (2~3개). */
  skills: z.array(z.string().min(1)),
  /** 관련 단원 id (1~3개). */
  units: z.array(z.string().min(1)),
  /** 그림 key. 사람 그림 없이 도구 아이콘만 쓴다. */
  icon: z.string().min(1),
});

/** 나의 진로 탐색 카드(4단계)의 칸 이름. */
export const portfolioPromptsSchema = z.object({
  job: z.string().min(1),
  skills: z.string().min(1),
  more: z.string().min(1),
});

export const portfolioExperimentSchema = z.object({
  ...commonShape,
  module: z.literal(PORTFOLIO_MODULE),
  areas: z.array(portfolioAreaSchema).min(1),
  skills: z.array(portfolioSkillSchema).min(1),
  jobs: z.array(portfolioJobSchema).min(1),
  prompts: portfolioPromptsSchema,
  tutor: portfolioTutorConfigSchema,
});

export const experimentSchema = z.discriminatedUnion('module', [
  variableExperimentSchema,
  classificationExperimentSchema,
  observationExperimentSchema,
  cardSortExperimentSchema,
  portfolioExperimentSchema,
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
export type OrderBy = z.infer<typeof orderBySchema>;
export type SortFeature = z.infer<typeof sortFeatureSchema>;
export type SortCriterion = z.infer<typeof sortCriterionSchema>;
export type SortCard = z.infer<typeof sortCardSchema>;
export type PortfolioExperiment = z.infer<typeof portfolioExperimentSchema>;
export type PortfolioArea = z.infer<typeof portfolioAreaSchema>;
export type PortfolioSkill = z.infer<typeof portfolioSkillSchema>;
export type PortfolioJob = z.infer<typeof portfolioJobSchema>;
export type PortfolioProbe = z.infer<typeof portfolioProbeSchema>;
export type PortfolioStage = (typeof PORTFOLIO_STAGES)[number];
export type Experiment = VariableExperiment | ClassificationExperiment | ObservationExperiment | CardSortExperiment | PortfolioExperiment;
export type ClassifyProbe = z.infer<typeof classifyProbeSchema>;
export type ClassifyProbeWhen = z.infer<typeof classifyProbeWhenSchema>;
export type ColorDef = z.infer<typeof colorDefSchema>;
export type ColorPattern = z.infer<typeof colorPatternSchema>;
export type ClassifySolution = z.infer<typeof solutionSchema>;
export type ClassifyIndicator = z.infer<typeof indicatorSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export const isVariableExperiment = (e: Experiment): e is VariableExperiment =>
  e.module !== CLASSIFY_MODULE && e.module !== OBSERVE_MODULE && e.module !== CARD_SORT_MODULE && e.module !== PORTFOLIO_MODULE;
export const isClassificationExperiment = (e: Experiment): e is ClassificationExperiment =>
  e.module === CLASSIFY_MODULE;

export const isObservationExperiment = (e: Experiment): e is ObservationExperiment => e.module === OBSERVE_MODULE;
export const isCardSortExperiment = (e: Experiment): e is CardSortExperiment => e.module === CARD_SORT_MODULE;
export const isPortfolioExperiment = (e: Experiment): e is PortfolioExperiment => e.module === PORTFOLIO_MODULE;

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

export * from './portfolio';
