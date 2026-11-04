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
export const moduleKindSchema = z.enum(['dissolution', 'gas-syringe', 'candle-jar', 'insulated-cup', 'convex-lens']);

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

export const experimentSchema = z.discriminatedUnion('module', [
  variableExperimentSchema,
  classificationExperimentSchema,
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
export type Experiment = VariableExperiment | ClassificationExperiment;
export type ClassifyProbe = z.infer<typeof classifyProbeSchema>;
export type ClassifyProbeWhen = z.infer<typeof classifyProbeWhenSchema>;
export type ColorDef = z.infer<typeof colorDefSchema>;
export type ColorPattern = z.infer<typeof colorPatternSchema>;
export type ClassifySolution = z.infer<typeof solutionSchema>;
export type ClassifyIndicator = z.infer<typeof indicatorSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export const isVariableExperiment = (e: Experiment): e is VariableExperiment => e.module !== CLASSIFY_MODULE;
export const isClassificationExperiment = (e: Experiment): e is ClassificationExperiment =>
  e.module === CLASSIFY_MODULE;

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
