import { validatePortfolioExperiment } from '@sci/schema';
import type { PortfolioModule } from '../types';

export const portfolioModule: PortfolioModule = {
  kind: 'career-portfolio',
  validate: validatePortfolioExperiment,
};
