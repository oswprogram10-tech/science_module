import { describe, expect, it } from 'vitest';
import type { Experiment } from '@sci/schema';
import { UNITS } from '../units';
import { MODULES } from './index';

// 매니페스트 dependent.values(숫자가 아닌 결과의 화면 이름)는 튜터 입력이 쓴다(@sci/tutor buildTutorInput, 프롬프트 v2).
// 학생이 결과표에서 보는 말과 튜터가 보는 말이 같아야 한다.
describe('결과 값 이름(dependent.values)', () => {
  const experiments: Experiment[] = UNITS.flatMap((u) => (u.ok ? u.manifest.experiments : []));
  const withValues = experiments.flatMap((exp) =>
    'dependent' in exp && exp.dependent ? exp.dependent.filter((d) => d.values).map((d) => ({ exp, d })) : [],
  );

  it('값 이름이 있는 결과 칸이 있다', () => {
    expect(withValues.length).toBeGreaterThanOrEqual(14);
  });

  for (const { exp, d } of withValues) {
    it(`${exp.id}의 「${d.label}」은 결과표와 같은 이름이다`, () => {
      const mod = MODULES[exp.module as keyof typeof MODULES];
      const column = mod.resultColumns(exp as never).find((c) => c.label === d.label);
      expect(column, `${exp.id} 결과표에 「${d.label}」 칸`).toBeTruthy();
      for (const [code, label] of Object.entries(d.values!)) {
        expect(column!.value({ [d.key]: code } as never), `${exp.id} ${d.key}=${code}`).toBe(label);
      }
    });
  }
});
