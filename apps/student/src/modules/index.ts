import type { ModuleKind } from '@sci/schema';
import type { AnyModule } from './types';
import { dissolutionModule } from './dissolution';
import { candleJarModule } from './candle-jar';
import { gasSyringeModule } from './gas-syringe';
import { insulatedCupModule } from './insulated-cup';

export const MODULES: Record<ModuleKind, AnyModule> = {
  dissolution: dissolutionModule,
  'gas-syringe': gasSyringeModule,
  'candle-jar': candleJarModule,
  'insulated-cup': insulatedCupModule,
};
