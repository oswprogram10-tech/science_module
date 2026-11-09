import { validateCardSortExperiment } from '@sci/cardsort';
import type { CardSortModule } from '../types';

export const cardSortModule: CardSortModule = {
  kind: 'card-sort',
  validate: validateCardSortExperiment,
};
