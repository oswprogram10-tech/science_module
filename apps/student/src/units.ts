import { ManifestError, parseManifest, type Experiment, type Manifest, type ModuleKind } from '@sci/schema';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import solutionJson from '../../../content/units/g5-solution/manifest.json';
import { MODULES } from './modules';
import type { AnyModule } from './modules/types';

export type UnitEntry =
  | { ok: true; id: string; manifest: Manifest; experiment: Experiment; module: AnyModule }
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
      for (const msg of modules[exp.module].validate(exp)) issues.push(`${exp.id}: ${msg}`);
    }
    if (issues.length > 0) return { ok: false, id: manifest.id, title: manifest.title, issues };
    const experiment = manifest.experiments[0]!;
    return { ok: true, id: manifest.id, manifest, experiment, module: modules[experiment.module] };
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

export const UNITS: UnitEntry[] = buildRegistry([gasesJson, solutionJson]);

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
