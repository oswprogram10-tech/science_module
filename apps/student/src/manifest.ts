import { validateDissolutionExperiment } from '@sci/engine-matter';
import { ManifestError, parseManifest, type Experiment, type Manifest } from '@sci/schema';
import manifestJson from '../../../content/units/g5-solution/manifest.json';

export type LoadedManifest =
  | { ok: true; manifest: Manifest; experiment: Experiment }
  | { ok: false; issues: string[] };

export function loadManifest(): LoadedManifest {
  try {
    const manifest = parseManifest(manifestJson);
    const experiment = manifest.experiments[0]!;
    const issues = validateDissolutionExperiment(experiment);
    if (issues.length > 0) return { ok: false, issues };
    return { ok: true, manifest, experiment };
  } catch (e) {
    return { ok: false, issues: e instanceof ManifestError ? e.issues : [String(e)] };
  }
}
