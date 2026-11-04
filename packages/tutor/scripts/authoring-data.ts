// 교사 입력 화면에 넣을 시나리오·단원 데이터를 만든다(입력 미리보기는 buildTutorInput 그대로).
import { writeFileSync } from 'node:fs';
import { buildTutorInput, situationOf } from '../src/context';
import { loadDataset, TUTOR_UNITS } from '../src/datasetIo';
import { JUDGMENT_WORDS, MAX_RESPONSE_CHARS, MAX_SENTENCES } from '../src/check';
import { REDTEAM_CATEGORY_LABEL, REJECTED_REASON_LABEL } from '../src/dataset';

const out = process.argv[2];
if (!out) throw new Error('출력 파일 경로를 주세요');
const ds = loadDataset();
const units = TUTOR_UNITS.map((id) => {
  const m = ds.units[id]!.manifest;
  const e = m.experiments[0]!;
  return { id, title: m.title, grade: m.grade, question: e.question, limits: e.limits, forbiddenAnswers: e.tutor.forbiddenAnswers };
});
const scenarios = ds.scenarios.map((s) => {
  const m = ds.units[s.unitId]!.manifest;
  const e = m.experiments[0]!;
  return {
    id: s.scenarioId,
    unitId: s.unitId,
    title: s.title,
    situation: situationOf(s.state, e),
    input: buildTutorInput(e, s.state, '', { title: m.title, grade: m.grade }),
  };
});
writeFileSync(out, JSON.stringify({
  units, scenarios,
  rules: { judgmentWords: JUDGMENT_WORDS, maxChars: MAX_RESPONSE_CHARS, maxSentences: MAX_SENTENCES },
  rejectedReasons: REJECTED_REASON_LABEL, redteamCategories: REDTEAM_CATEGORY_LABEL,
}));
console.log(`units ${units.length}, scenarios ${scenarios.length}`);
