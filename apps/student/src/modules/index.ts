import type { ModuleKind } from '@sci/schema';
import type { AnyModule } from './types';
import { dissolutionModule } from './dissolution';
import { candleJarModule } from './candle-jar';
import { gasSyringeModule } from './gas-syringe';
import { insulatedCupModule } from './insulated-cup';
import { convexLensModule } from './convex-lens';
import { electromagnetModule } from './electromagnet';

export const MODULES: Record<ModuleKind, AnyModule> = {
  dissolution: dissolutionModule,
  'gas-syringe': gasSyringeModule,
  'candle-jar': candleJarModule,
  'insulated-cup': insulatedCupModule,
  'convex-lens': convexLensModule,
  electromagnet: electromagnetModule,
};
