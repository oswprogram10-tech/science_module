import type { ModuleKind } from '@sci/schema';
import type { AnyModule } from './types';
import { dissolutionModule } from './dissolution';
import { candleJarModule } from './candle-jar';
import { gasSyringeModule } from './gas-syringe';
import { insulatedCupModule } from './insulated-cup';
import { convexLensModule } from './convex-lens';
import { electromagnetModule } from './electromagnet';
import { magmaCoolingModule } from './magma-cooling';
import { sunAngleModule } from './sun-angle';
import { germinationModule } from './germination';
import { transpirationModule } from './transpiration';
import { foodWebModule } from './food-web';
import { moldGrowthModule } from './mold-growth';
import { exerciseBodyModule } from './exercise-body';
import { leverBalanceModule } from './lever-balance';
import { stringSoundModule } from './string-sound';
import { magnetDistanceModule } from './magnet-distance';
import { rampCartModule } from './ramp-cart';
import { freezeMeltModule } from './freeze-melt';
import { saltSandModule } from './salt-sand';
import { streamTableModule } from './stream-table';
import { landSeaBreezeModule } from './land-sea-breeze';

export const MODULES: Record<ModuleKind, AnyModule> = {
  dissolution: dissolutionModule,
  'gas-syringe': gasSyringeModule,
  'candle-jar': candleJarModule,
  'insulated-cup': insulatedCupModule,
  'convex-lens': convexLensModule,
  electromagnet: electromagnetModule,
  'magma-cooling': magmaCoolingModule,
  'sun-angle': sunAngleModule,
  germination: germinationModule,
  transpiration: transpirationModule,
  'food-web': foodWebModule,
  'mold-growth': moldGrowthModule,
  'exercise-body': exerciseBodyModule,
  'lever-balance': leverBalanceModule,
  'string-sound': stringSoundModule,
  'magnet-distance': magnetDistanceModule,
  'ramp-cart': rampCartModule,
  'freeze-melt': freezeMeltModule,
  'salt-sand': saltSandModule,
  'stream-table': streamTableModule,
  'land-sea-breeze': landSeaBreezeModule,
};
