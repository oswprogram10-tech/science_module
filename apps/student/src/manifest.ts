import { ManifestError, parseManifest, type Experiment, type Manifest } from '@sci/schema';
import manifestJson from '../../../content/units/g5-solution/manifest.json';

export type LoadedManifest =
  | { ok: true; manifest: Manifest; experiment: Experiment }
  | { ok: false; issues: string[] };

export function loadManifest(): LoadedManifest {
  try {
    const manifest = parseManifest(manifestJson);
    return { ok: true, manifest, experiment: manifest.experiments[0]! };
  } catch (e) {
    return { ok: false, issues: e instanceof ManifestError ? e.issues : [String(e)] };
  }
}
