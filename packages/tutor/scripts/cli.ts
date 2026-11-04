/**
 * 튜터 데이터 도구. 사용법은 ml/tutor/README.md.
 *   tsx cli.ts scenarios [--csv] | validate | export [--include-examples] [--reviewed-only]
 *   tsx cli.ts import <csv> --unit <unitId> --kind sft|pairs|redteam --author T03
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  RECORD_KINDS,
  buildExport,
  importCsv,
  inputFor,
  toCsv,
  validateDataset,
  type RecordKind,
} from '../src/dataset';
import {
  TUTOR_DIR,
  TUTOR_UNITS,
  appendRecords,
  loadDataset,
  loadUnits,
  scenarioFile,
  strayDataDirs,
  writeJsonl,
} from '../src/datasetIo';
import { generateScenarios, situationCounts } from './scenarios';

const [cmd, ...rest] = process.argv.slice(2);

function flag(name: string): boolean {
  return rest.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
}

function scenarios() {
  const units = loadUnits();
  const all = TUTOR_UNITS.flatMap((id) => {
    const list = generateScenarios(id, units[id]!);
    writeJsonl(scenarioFile(TUTOR_DIR, id), list);
    console.log(`${id}: 시나리오 ${list.length}개`);
    return list;
  });
  console.log(JSON.stringify(situationCounts(units, all)));
  if (flag('csv')) {
    const out = join(TUTOR_DIR, 'out');
    mkdirSync(out, { recursive: true });
    for (const id of TUTOR_UNITS) {
      const rows = [['번호', '설명', '입력 미리보기']];
      for (const s of all.filter((x) => x.unitId === id)) {
        rows.push([s.scenarioId, s.title, inputFor({ units }, s, '').replaceAll('\n', ' | ')]);
      }
      writeFileSync(join(out, `scenarios-${id}.csv`), '﻿' + toCsv(rows));
      console.log(`out/scenarios-${id}.csv`);
    }
  }
}

function validate(): number {
  const stray = strayDataDirs();
  const problems = [...stray.map((d) => `data/${d}: 대표 단원 목록에 없는 폴더입니다.`), ...validateDataset(loadDataset())];
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    console.error(`검증 실패: ${problems.length}건`);
    return 1;
  }
  const ds = loadDataset();
  console.log(`검증 통과: 시나리오 ${ds.scenarios.length}, sft ${ds.sft.length}, pairs ${ds.pairs.length}, redteam ${ds.redteam.length}`);
  return 0;
}

function exportData(): number {
  const ds = loadDataset();
  const problems = validateDataset(ds);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    console.error('검증에 실패해 내보내지 않았습니다.');
    return 1;
  }
  const out = join(TUTOR_DIR, 'out');
  mkdirSync(out, { recursive: true });
  const files = buildExport(ds, { includeExamples: flag('include-examples'), reviewedOnly: flag('reviewed-only') });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
  console.log(`내보냄: ${out}\n${files['manifest.json']}`);
  return 0;
}

function importData(): number {
  const file = rest.find((a) => !a.startsWith('--') && a !== option('unit') && a !== option('kind') && a !== option('author'));
  const unitId = option('unit');
  const kind = option('kind') as RecordKind | undefined;
  const author = option('author');
  if (!file || !unitId || !kind || !author) {
    console.error('사용법: pnpm tutor:import <csv> --unit <unitId> --kind sft|pairs|redteam --author T03');
    return 2;
  }
  if (!(RECORD_KINDS as readonly string[]).includes(kind)) {
    console.error(`--kind는 ${RECORD_KINDS.join('|')} 중 하나여야 합니다.`);
    return 2;
  }
  if (!(TUTOR_UNITS as readonly string[]).includes(unitId)) {
    console.error(`--unit은 ${TUTOR_UNITS.join(', ')} 중 하나여야 합니다.`);
    return 2;
  }
  const existing = loadDataset();
  const { records, errors } = importCsv(readFileSync(resolve(file), 'utf8'), { unitId, kind, author, existing });
  if (records.length > 0) appendRecords(TUTOR_DIR, unitId, kind, records);
  console.log(`가져옴: ${records.length}행`);
  for (const e of errors) console.error(`${e.row}행: ${e.reason}`);
  return errors.length > 0 ? 1 : 0;
}

switch (cmd) {
  case 'scenarios':
    scenarios();
    break;
  case 'validate':
    process.exitCode = validate();
    break;
  case 'export':
    process.exitCode = exportData();
    break;
  case 'import':
    process.exitCode = importData();
    break;
  default:
    console.error('명령: scenarios [--csv] | validate | export [--include-examples] [--reviewed-only] | import <csv> --unit --kind --author');
    process.exitCode = 2;
}
