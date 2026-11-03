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
  'fair-test-stir',
  'prediction-mismatch',
]);

export const probeSchema = z.object({
  when: probeWhenSchema,
  text: z.string().min(1),
});

export const tutorConfigSchema = z.object({
  forbiddenAnswers: z.array(z.string().min(1)),
  probes: z.array(probeSchema).min(1),
});

export const experimentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  question: z.string().min(1),
  spoonGrams: z.number().positive(),
  variables: z.array(variableSchema).min(1),
  dependent: z.array(dependentSchema).min(1),
  gateway: gatewaySchema,
  safety: z.array(z.string()).default([]),
  limits: z.array(z.string()).default([]),
  tutor: tutorConfigSchema,
});

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
export type Probe = z.infer<typeof probeSchema>;
export type ProbeWhen = z.infer<typeof probeWhenSchema>;
export type GatewayConfig = z.infer<typeof gatewaySchema>;
export type TutorConfig = z.infer<typeof tutorConfigSchema>;
export type Experiment = z.infer<typeof experimentSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

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
