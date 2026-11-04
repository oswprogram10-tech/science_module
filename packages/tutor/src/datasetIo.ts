import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest } from '@sci/schema';
import type { AnyRecord, Dataset, PairRecord, RecordKind, RedteamRecord, Scenario, SftRecord, UnitData } from './dataset';

/** 튜터 데이터를 다루는 대표 단원(사양 T5). */
export const TUTOR_UNITS = ['g5-solution', 'g4-gases', 'g6-acid-base'] as const;

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

/** data/ 아래에 있는데 대표 단원 목록에 없는 폴더(검증이 놓치지 않도록). */
export function strayDataDirs(dir: string = TUTOR_DIR, unitIds: readonly string[] = TUTOR_UNITS): string[] {
  const root = join(dir, 'data');
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => !unitIds.includes(d));
}

export function appendRecords(dir: string, unitId: string, kind: RecordKind, records: AnyRecord[]): void {
  const file = dataFile(dir, unitId, kind);
  writeJsonl(file, [...readJsonl(file), ...records]);
}
