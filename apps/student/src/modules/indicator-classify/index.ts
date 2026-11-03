import { validateIndicatorExperiment } from '@sci/engine-matter';
import type { ClassifyModule } from '../types';

export const classifyModule: ClassifyModule = {
  kind: 'indicator-classify',
  validate: validateIndicatorExperiment,
};
