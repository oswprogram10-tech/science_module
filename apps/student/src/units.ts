import {
  ManifestError,
  isCardSortExperiment,
  isObservationExperiment,
  isPortfolioExperiment,
  isVariableExperiment,
  parseManifest,
  type CardSortExperiment,
  type ClassificationExperiment,
  type Manifest,
  type ModuleKind,
  type ObservationExperiment,
  type PortfolioExperiment,
  type VariableExperiment,
} from '@sci/schema';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import solutionJson from '../../../content/units/g5-solution/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';
import combustionJson from '../../../content/units/g6-combustion/manifest.json';
import heatJson from '../../../content/units/g5-heat/manifest.json';
import lightJson from '../../../content/units/g5-light/manifest.json';
import electricityJson from '../../../content/units/g6-electricity/manifest.json';
import landJson from '../../../content/units/g4-land/manifest.json';
import earthMotionJson from '../../../content/units/g6-earth-motion/manifest.json';
import seasonsJson from '../../../content/units/g6-seasons/manifest.json';
import lifecycleJson from '../../../content/units/g3-lifecycle/manifest.json';
import plantJson from '../../../content/units/g6-plant/manifest.json';
import ecosystemJson from '../../../content/units/g4-ecosystem/manifest.json';
import microbeJson from '../../../content/units/g4-microbe/manifest.json';
import bodyJson from '../../../content/units/g5-body/manifest.json';
import animalJson from '../../../content/units/g3-animal/manifest.json';
import plantlifeJson from '../../../content/units/g3-plantlife/manifest.json';
import forceJson from '../../../content/units/g3-force/manifest.json';
import soundJson from '../../../content/units/g3-sound/manifest.json';
import magnetJson from '../../../content/units/g4-magnet/manifest.json';
import motionJson from '../../../content/units/g6-motion/manifest.json';
import waterStateJson from '../../../content/units/g4-water-state/manifest.json';
import mixtureJson from '../../../content/units/g5-mixture/manifest.json';
import earthSeaJson from '../../../content/units/g3-earth-sea/manifest.json';
import weatherJson from '../../../content/units/g5-weather/manifest.json';
import healthJson from '../../../content/units/g3-health/manifest.json';
import climateJson from '../../../content/units/g4-climate/manifest.json';
import energyJson from '../../../content/units/g5-energy/manifest.json';
import nightSkyJson from '../../../content/units/g4-night-sky/manifest.json';
import materialJson from '../../../content/units/g3-material/manifest.json';
import strataJson from '../../../content/units/g5-strata/manifest.json';
import careerJson from '../../../content/units/g6-career/manifest.json';
import { MODULES } from './modules';
import { classifyModule } from './modules/indicator-classify';
import { observeModule } from './modules/sky-observation';
import { cardSortModule } from './modules/card-sort';
import { portfolioModule } from './modules/career-portfolio';
import type { AnyModule, CardSortModule, ClassifyModule, ObserveModule, PortfolioModule } from './modules/types';

/** 단원의 활동 하나. 매니페스트 experiments의 항목마다 하나씩 있고 순서도 같다. */
export type ActivityEntry =
  | { activity: 'variable'; experiment: VariableExperiment; module: AnyModule }
  | { activity: 'classify'; experiment: ClassificationExperiment; module: ClassifyModule }
  | { activity: 'observe'; experiment: ObservationExperiment; module: ObserveModule }
  | { activity: 'card-sort'; experiment: CardSortExperiment; module: CardSortModule }
  | { activity: 'portfolio'; experiment: PortfolioExperiment; module: PortfolioModule };

/** 최상위 activity/experiment/module은 첫 활동의 값이다(activities[0]과 같다). */
export type UnitEntry =
  | (ActivityEntry & { ok: true; id: string; manifest: Manifest; activities: ActivityEntry[] })
  | { ok: false; id: string; title: string; issues: string[] };

type OkUnit = Extract<UnitEntry, { ok: true }>;

function toActivity(experiment: Manifest['experiments'][number], modules: Record<ModuleKind, AnyModule>): ActivityEntry {
  if (isObservationExperiment(experiment)) return { activity: 'observe', experiment, module: observeModule };
  if (isCardSortExperiment(experiment)) return { activity: 'card-sort', experiment, module: cardSortModule };
  if (isPortfolioExperiment(experiment)) return { activity: 'portfolio', experiment, module: portfolioModule };
  if (!isVariableExperiment(experiment)) return { activity: 'classify', experiment, module: classifyModule };
  return { activity: 'variable', experiment, module: modules[experiment.module] };
}

/** 매니페스트 하나를 schema 검증과 모듈 validate에 통과시킨다. 실패하면 오류 항목을 돌려준다. */
export function loadUnit(
  raw: unknown,
  index: number,
  modules: Record<ModuleKind, AnyModule> = MODULES,
): UnitEntry {
  const rec = (raw && typeof raw === 'object' ? raw : {}) as { id?: unknown; title?: unknown };
  const fallbackId = typeof rec.id === 'string' && rec.id ? rec.id : `unit-${index + 1}`;
  const fallbackTitle = typeof rec.title === 'string' && rec.title ? rec.title : fallbackId;
  try {
    const manifest = parseManifest(raw);
    const issues: string[] = [];
    for (const exp of manifest.experiments) {
      const msgs = isVariableExperiment(exp)
        ? modules[exp.module].validate(exp)
        : isObservationExperiment(exp)
          ? observeModule.validate(exp)
          : isCardSortExperiment(exp)
            ? cardSortModule.validate(exp)
            : isPortfolioExperiment(exp)
              ? portfolioModule.validate(exp)
              : classifyModule.validate(exp);
      for (const msg of msgs) issues.push(`${exp.id}: ${msg}`);
    }
    if (issues.length > 0) return { ok: false, id: manifest.id, title: manifest.title, issues };
    const activities = manifest.experiments.map((exp) => toActivity(exp, modules));
    return { ...activities[0]!, ok: true, id: manifest.id, manifest, activities } as OkUnit;
  } catch (e) {
    return {
      ok: false,
      id: fallbackId,
      title: fallbackTitle,
      issues: e instanceof ManifestError ? e.issues : [String(e)],
    };
  }
}

/** 여러 매니페스트를 읽는다. 한 단원이 깨져도 다른 단원은 그대로 로드된다. */
export function buildRegistry(
  raws: unknown[],
  modules: Record<ModuleKind, AnyModule> = MODULES,
): UnitEntry[] {
  return raws.map((raw, i) => loadUnit(raw, i, modules));
}

export const UNITS: UnitEntry[] = buildRegistry([gasesJson, solutionJson, acidBaseJson, combustionJson, heatJson, lightJson, electricityJson, landJson, earthMotionJson, seasonsJson, lifecycleJson, plantJson, ecosystemJson, microbeJson, bodyJson, animalJson, plantlifeJson, forceJson, soundJson, magnetJson, motionJson, materialJson, waterStateJson, mixtureJson, earthSeaJson, nightSkyJson, strataJson, weatherJson, healthJson, climateJson, energyJson, careerJson]);

/** experimentId는 주소에 있을 때만 들어 있다(없으면 첫 활동). */
export type Route = { page: 'list' } | { page: 'unit'; unitId: string; experimentId?: string };

/** `#/` → 목록, `#/unit/{id}` → 첫 활동, `#/unit/{id}/{experimentId}` → 그 활동. */
export function parseRoute(hash: string): Route {
  const m = /^#\/unit\/([^/?#]+)(?:\/([^/?#]+))?\/?$/.exec(hash);
  if (m) {
    try {
      const unitId = decodeURIComponent(m[1]!);
      return m[2] === undefined ? { page: 'unit', unitId } : { page: 'unit', unitId, experimentId: decodeURIComponent(m[2]) };
    } catch {
      return { page: 'list' };
    }
  }
  return { page: 'list' };
}

export const unitHash = (id: string, experimentId?: string) =>
  `#/unit/${encodeURIComponent(id)}${experimentId === undefined ? '' : `/${encodeURIComponent(experimentId)}`}`;

/** 주소의 experimentId에 해당하는 활동. 없거나 모르는 id면 첫 활동. */
export function activityOf(unit: OkUnit, experimentId?: string): ActivityEntry {
  return unit.activities.find((a) => a.experiment.id === experimentId) ?? unit.activities[0]!;
}
