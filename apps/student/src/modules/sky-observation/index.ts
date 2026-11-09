import { validateSkyObservation } from '@sci/engine-earth';
import type { ObserveModule } from '../types';

export const observeModule: ObserveModule = {
  kind: 'sky-observation',
  validate: validateSkyObservation,
};
