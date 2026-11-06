// 교사 입력 화면에 넣을 시나리오·단원 데이터를 만든다(입력 미리보기는 buildTutorInput 그대로).
import { writeFileSync } from 'node:fs';
import { buildTutorInput, situationOf } from '../src/context';
import { loadDataset, TUTOR_UNITS } from '../src/datasetIo';
import { JUDGMENT_WORDS, MAX_RESPONSE_CHARS, MAX_SENTENCES } from '../src/check';
import { REDTEAM_CATEGORY_LABEL, REJECTED_REASON_LABEL, experimentOf } from '../src/dataset';

const out = process.argv[2];
if (!out) throw new Error('출력 파일 경로를 주세요');
const ds = loadDataset();
// TUTOR_UNITS는 학년 순, 같은 학년은 앱 목록(apps/student/src/units.ts) 순서다(scenarios.test.ts가 확인한다).
// 단원마다 실험은 하나이고, 질문·한계·금지 답은 실험 수준(experiments[0])의 값이다. 관찰 단원도 같다.
const units = TUTOR_UNITS.map((id) => {
  const m = ds.units[id]!.manifest;
  const e = m.experiments[0]!;
  return { id, title: m.title, grade: m.grade, question: e.question, limits: e.limits, forbiddenAnswers: e.tutor.forbiddenAnswers };
});
const scenarios = ds.scenarios.map((s) => {
  const m = ds.units[s.unitId]!.manifest;
  const e = experimentOf(ds.units, s)!;
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
