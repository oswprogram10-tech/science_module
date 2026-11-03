import { describe, expect, it } from 'vitest';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import solutionJson from '../../../content/units/g5-solution/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';
import { UNITS, buildRegistry, parseRoute, unitHash } from './units';

const clone = (j: unknown) => JSON.parse(JSON.stringify(j));

describe('단원 레지스트리', () => {
  it('세 단원이 모두 로드된다', () => {
    expect(UNITS.map((u) => u.id)).toEqual(['g4-gases', 'g5-solution', 'g6-acid-base']);
    expect(UNITS.every((u) => u.ok)).toBe(true);
    const gases = UNITS[0]!;
    if (gases.ok) expect(gases.module.kind).toBe('gas-syringe');
    const solution = UNITS[1]!;
    if (solution.ok) expect(solution.module.kind).toBe('dissolution');
    const acidBase = UNITS[2]!;
    expect(acidBase.ok && acidBase.activity).toBe('classify');
    if (acidBase.ok) expect(acidBase.module.kind).toBe('indicator-classify');
  });

  it('schema 검증에 실패한 단원이 있어도 다른 단원은 로드된다', () => {
    const broken = clone(gasesJson);
    delete broken.experiments[0].question;
    const units = buildRegistry([broken, solutionJson]);
    expect(units[0]!.ok).toBe(false);
    expect(units[0]!.id).toBe('g4-gases');
    if (!units[0]!.ok) expect(units[0]!.issues.length).toBeGreaterThan(0);
    expect(units[1]!.ok).toBe(true);
  });

  it('모듈 validate에 실패한 단원도 목록에 오류로 남고 다른 단원은 계속 쓸 수 있다', () => {
    const broken = clone(solutionJson);
    delete broken.experiments[0].spoonGrams;
    const units = buildRegistry([gasesJson, broken]);
    expect(units[0]!.ok).toBe(true);
    expect(units[1]!.ok).toBe(false);
    if (!units[1]!.ok) expect(units[1]!.issues.join()).toContain('spoonGrams');

    const badGas = clone(gasesJson);
    badGas.experiments[0].params = { syringeMaxMl: 40 };
    const again = buildRegistry([badGas, solutionJson]);
    expect(again.map((u) => u.ok)).toEqual([false, true]);
  });

  it('분류 활동 매니페스트가 깨져도 다른 단원은 로드된다', () => {
    const broken = clone(acidBaseJson);
    broken.experiments[0].indicators[3].colors[2].color = 'ghost';
    const units = buildRegistry([gasesJson, broken, solutionJson]);
    expect(units.map((u) => u.ok)).toEqual([true, false, true]);
    const bad = units[1]!;
    if (!bad.ok) expect(bad.issues.join()).toContain('ghost');
    const badModule = clone(acidBaseJson);
    badModule.experiments[0].module = 'nope';
    expect(buildRegistry([badModule])[0]!.ok).toBe(false);
  });

  it('JSON이 아닌 입력도 목록 전체를 깨뜨리지 않는다', () => {
    const units = buildRegistry([null, solutionJson]);
    expect(units[0]!.ok).toBe(false);
    expect(units[0]!.id).toBe('unit-1');
    expect(units[1]!.ok).toBe(true);
  });
});

describe('해시 라우팅', () => {
  it('목록과 실험 화면', () => {
    expect(parseRoute('')).toEqual({ page: 'list' });
    expect(parseRoute('#/')).toEqual({ page: 'list' });
    expect(parseRoute('#/unit/g4-gases')).toEqual({ page: 'unit', unitId: 'g4-gases' });
    expect(parseRoute(unitHash('g5-solution'))).toEqual({ page: 'unit', unitId: 'g5-solution' });
    expect(parseRoute('#/nope')).toEqual({ page: 'list' });
    expect(parseRoute('#/unit/%E0%A4%A')).toEqual({ page: 'list' });
  });
});
