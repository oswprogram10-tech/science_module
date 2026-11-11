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
import { seaWaterModule } from './sea-water';
import { landSeaBreezeModule } from './land-sea-breeze';
import { infectionSpreadModule } from './infection-spread';
import { greenhouseBottleModule } from './greenhouse-bottle';
import { solarPanelModule } from './solar-panel';
import { leverLiftModule } from './lever-lift';
import { soundVibrationModule } from './sound-vibration';
import { magnetPolesModule } from './magnet-poles';
import { concentrationModule } from './concentration';
import { heatContactModule } from './heat-contact';
import { acidBaseMixModule } from './acid-base-mix';
import { positionTimeModule } from './position-time';
import { combustionProductsModule } from './combustion-products';
import { lightNeededModule } from './light-needed';
import { soundTransmitModule } from './sound-transmit';

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
  'sea-water': seaWaterModule,
  'land-sea-breeze': landSeaBreezeModule,
  'infection-spread': infectionSpreadModule,
  'greenhouse-bottle': greenhouseBottleModule,
  'solar-panel': solarPanelModule,
  'lever-lift': leverLiftModule,
  'sound-vibration': soundVibrationModule,
  'magnet-poles': magnetPolesModule,
  concentration: concentrationModule,
  'heat-contact': heatContactModule,
  'acid-base-mix': acidBaseMixModule,
  'position-time': positionTimeModule,
  'combustion-products': combustionProductsModule,
  'light-needed': lightNeededModule,
  'sound-transmit': soundTransmitModule,
};
