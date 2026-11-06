import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest } from '@sci/schema';
import type { AnyRecord, Dataset, PairRecord, RecordKind, RedteamRecord, Scenario, SftRecord, UnitData } from './dataset';

/**
 * 튜터 데이터를 다루는 단원: 튜터가 있는 모든 단원(답을 알려 줄 위험이 없는 g6-career 포트폴리오만 뺀다).
 * 학년 순, 같은 학년은 앱 목록(apps/student/src/units.ts)의 순서다(테스트가 확인한다).
 * 시나리오(scenarios/), 학습 레코드(data/<단원>/), 가져오기 검증이 모두 이 목록을 따른다.
 */
export const TUTOR_UNITS = [
  'g3-lifecycle', 'g3-animal', 'g3-plantlife', 'g3-force', 'g3-sound', 'g3-material', 'g3-earth-sea', 'g3-health',
  'g4-gases', 'g4-land', 'g4-ecosystem', 'g4-microbe', 'g4-magnet', 'g4-water-state', 'g4-night-sky', 'g4-climate',
  'g5-solution', 'g5-heat', 'g5-light', 'g5-body', 'g5-mixture', 'g5-strata', 'g5-weather', 'g5-energy',
  'g6-acid-base', 'g6-combustion', 'g6-electricity', 'g6-earth-motion', 'g6-seasons', 'g6-plant', 'g6-motion',
] as const;

/** 견본 레코드(source: "example")를 둔 단원. 나머지 단원은 빈 파일로 시작한다. */
export const EXAMPLE_UNITS = ['g5-solution', 'g4-gases', 'g6-acid-base'] as const;

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const CONTENT_DIR = join(repoRoot, 'content', 'units');
export const TUTOR_DIR = join(repoRoot, 'ml', 'tutor');

export const loadUnits = (ids: readonly string[] = TUTOR_UNITS): Record<string, UnitData> =>
  Object.fromEntries(
    ids.map((id) => [id, { manifest: parseManifest(JSON.parse(readFileSync(join(CONTENT_DIR, id, 'manifest.json'), 'utf8'))) }]),
  );

export class JsonlError extends Error {}

export function readJsonl<T = unknown>(file: string): T[] {
  if (!existsSync(file)) return [];
  const out: T[] = [];
  for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
    if (line.trim() === '') continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      throw new JsonlError(`${file}:${i + 1}: JSON으로 읽을 수 없습니다.`);
    }
  }
  return out;
}

export function writeJsonl(file: string, items: unknown[]): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, items.map((x) => JSON.stringify(x)).join('\n') + (items.length ? '\n' : ''));
}

export const scenarioFile = (dir: string, unitId: string) => join(dir, 'scenarios', `${unitId}.jsonl`);
export const dataFile = (dir: string, unitId: string, kind: RecordKind) => join(dir, 'data', unitId, `${kind}.jsonl`);

/** ml/tutor 아래의 모든 시나리오와 레코드를 읽는다. data/<단원> 폴더가 있는 단원만 읽는다. */
export function loadDataset(dir: string = TUTOR_DIR, unitIds: readonly string[] = TUTOR_UNITS): Dataset {
  const ds: Dataset = { units: loadUnits(unitIds), scenarios: [], sft: [], pairs: [], redteam: [] };
  for (const id of unitIds) {
    ds.scenarios.push(...readJsonl<Scenario>(scenarioFile(dir, id)));
    ds.sft.push(...readJsonl<SftRecord>(dataFile(dir, id, 'sft')));
    ds.pairs.push(...readJsonl<PairRecord>(dataFile(dir, id, 'pairs')));
    ds.redteam.push(...readJsonl<RedteamRecord>(dataFile(dir, id, 'redteam')));
  }
  return ds;
}

/** data/ 아래에 있는데 단원 목록에 없는 폴더(검증이 놓치지 않도록). */
export function strayDataDirs(dir: string = TUTOR_DIR, unitIds: readonly string[] = TUTOR_UNITS): string[] {
  const root = join(dir, 'data');
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => !unitIds.includes(d));
}

export function appendRecords(dir: string, unitId: string, kind: RecordKind, records: AnyRecord[]): void {
  const file = dataFile(dir, unitId, kind);
  writeJsonl(file, [...readJsonl(file), ...records]);
}
