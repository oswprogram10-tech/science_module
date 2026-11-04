import {
  ManifestError,
  isVariableExperiment,
  parseManifest,
  type ClassificationExperiment,
  type Manifest,
  type ModuleKind,
  type VariableExperiment,
} from '@sci/schema';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import solutionJson from '../../../content/units/g5-solution/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';
import combustionJson from '../../../content/units/g6-combustion/manifest.json';
import { MODULES } from './modules';
import { classifyModule } from './modules/indicator-classify';
import type { AnyModule, ClassifyModule } from './modules/types';

export type UnitEntry =
  | { ok: true; activity: 'variable'; id: string; manifest: Manifest; experiment: VariableExperiment; module: AnyModule }
  | { ok: true; activity: 'classify'; id: string; manifest: Manifest; experiment: ClassificationExperiment; module: ClassifyModule }
  | { ok: false; id: string; title: string; issues: string[] };

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
      const msgs = isVariableExperiment(exp) ? modules[exp.module].validate(exp) : classifyModule.validate(exp);
      for (const msg of msgs) issues.push(`${exp.id}: ${msg}`);
    }
    if (issues.length > 0) return { ok: false, id: manifest.id, title: manifest.title, issues };
    const experiment = manifest.experiments[0]!;
    if (!isVariableExperiment(experiment)) {
      return { ok: true, activity: 'classify', id: manifest.id, manifest, experiment, module: classifyModule };
    }
    return { ok: true, activity: 'variable', id: manifest.id, manifest, experiment, module: modules[experiment.module] };
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

export const UNITS: UnitEntry[] = buildRegistry([gasesJson, solutionJson, acidBaseJson, combustionJson]);

export type Route = { page: 'list' } | { page: 'unit'; unitId: string };

/** `#/` → 목록, `#/unit/{id}` → 실험 화면. */
export function parseRoute(hash: string): Route {
  const m = /^#\/unit\/([^/?#]+)\/?$/.exec(hash);
  if (m) {
    try {
      return { page: 'unit', unitId: decodeURIComponent(m[1]!) };
    } catch {
      return { page: 'list' };
    }
  }
  return { page: 'list' };
}

export const unitHash = (id: string) => `#/unit/${encodeURIComponent(id)}`;
