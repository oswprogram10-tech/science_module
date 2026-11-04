import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateScenarios, situationCounts } from '../scripts/scenarios';
import { TUTOR_DIR, TUTOR_UNITS, loadUnits, scenarioFile } from './datasetIo';

const units = loadUnits();

describe('시나리오 생성기', () => {
  const generated = TUTOR_UNITS.flatMap((id) => generateScenarios(id, units[id]!));

  it('두 번 만들어도 같고, 저장소의 scenarios/*.jsonl과 같다(결정성·최신 여부)', () => {
    const again = TUTOR_UNITS.flatMap((id) => generateScenarios(id, units[id]!));
    expect(again).toEqual(generated);
    for (const id of TUTOR_UNITS) {
      const expected = generated.filter((s) => s.unitId === id).map((s) => JSON.stringify(s)).join('\n') + '\n';
      expect(readFileSync(scenarioFile(TUTOR_DIR, id), 'utf8'), `${id}: pnpm tutor:scenarios를 다시 실행하세요`).toBe(expected);
    }
  });

  it('상황 키마다 2개 이상', () => {
    const counts = situationCounts(units, generated);
    const variable = ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'];
    const classify = ['before-test', 'testing', 'prediction-mismatch', 'check-untested', 'check-inconsistent', 'check-complete'];
    for (const u of ['g5-solution', 'g4-gases']) for (const k of variable) expect(counts[u]![k], `${u}/${k}`).toBeGreaterThanOrEqual(2);
    for (const k of classify) expect(counts['g6-acid-base']![k], `g6/${k}`).toBeGreaterThanOrEqual(2);
  });

  it('조작변인마다 fair-test가 있다', () => {
    for (const id of ['g5-solution', 'g4-gases']) {
      const exp = units[id]!.manifest.experiments[0]!;
      if (!('variables' in exp)) throw new Error('변인 실험이 아닙니다.');
      for (const v of exp.variables) {
        const has = generated.some(
          (s) => s.unitId === id && s.state.kind === 'variable' && s.state.trials.at(-1)?.analysis.kind === 'fair-test' && s.state.trials.at(-1)?.ivKey === v.key,
        );
        expect(has, `${id}/${v.key}`).toBe(true);
      }
    }
  });
});
