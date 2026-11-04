import { describe, expect, it } from 'vitest';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import solutionJson from '../../../content/units/g5-solution/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';
import combustionJson from '../../../content/units/g6-combustion/manifest.json';
import heatJson from '../../../content/units/g5-heat/manifest.json';
import lightJson from '../../../content/units/g5-light/manifest.json';
import electricityJson from '../../../content/units/g6-electricity/manifest.json';
import animalJson from '../../../content/units/g3-animal/manifest.json';
import landJson from '../../../content/units/g4-land/manifest.json';
import { UNITS, buildRegistry, parseRoute, unitHash } from './units';

const clone = (j: unknown) => JSON.parse(JSON.stringify(j));

describe('단원 레지스트리', () => {
  it('열 단원이 모두 로드된다', () => {
    expect(UNITS.map((u) => u.id)).toEqual(['g4-gases', 'g5-solution', 'g6-acid-base', 'g6-combustion', 'g5-heat', 'g5-light', 'g6-electricity', 'g4-land', 'g6-earth-motion', 'g6-seasons', 'g3-lifecycle', 'g6-plant', 'g4-ecosystem', 'g4-microbe', 'g5-body', 'g3-animal', 'g3-plantlife', 'g3-force']);
    expect(UNITS.every((u) => u.ok)).toBe(true);
    const gases = UNITS[0]!;
    if (gases.ok) expect(gases.module.kind).toBe('gas-syringe');
    const solution = UNITS[1]!;
    if (solution.ok) expect(solution.module.kind).toBe('dissolution');
    const acidBase = UNITS[2]!;
    expect(acidBase.ok && acidBase.activity).toBe('classify');
    if (acidBase.ok) expect(acidBase.module.kind).toBe('indicator-classify');
    const combustion = UNITS[3]!;
    expect(combustion.ok && combustion.activity).toBe('variable');
    if (combustion.ok) expect(combustion.module.kind).toBe('candle-jar');
    const heat = UNITS[4]!;
    expect(heat.ok && heat.activity).toBe('variable');
    if (heat.ok) expect(heat.module.kind).toBe('insulated-cup');
    const light = UNITS[5]!;
    expect(light.ok && light.activity).toBe('variable');
    if (light.ok) expect(light.module.kind).toBe('convex-lens');
    const electricity = UNITS[6]!;
    expect(electricity.ok && electricity.activity).toBe('variable');
    if (electricity.ok) expect(electricity.module.kind).toBe('electromagnet');
    const land = UNITS[7]!;
    expect(land.ok && land.activity).toBe('variable');
    if (land.ok) expect(land.module.kind).toBe('magma-cooling');
    const earth = UNITS[8]!;
    expect(earth.ok && earth.activity).toBe('observe');
    if (earth.ok) expect(earth.module.kind).toBe('sky-observation');
    const seasons = UNITS[9]!;
    expect(seasons.ok && seasons.activity).toBe('variable');
    if (seasons.ok) expect(seasons.module.kind).toBe('sun-angle');
    const lifecycle = UNITS[10]!;
    expect(lifecycle.ok && lifecycle.activity).toBe('variable');
    if (lifecycle.ok) expect(lifecycle.module.kind).toBe('germination');
    const plant = UNITS[11]!;
    expect(plant.ok && plant.activity).toBe('variable');
    if (plant.ok) expect(plant.module.kind).toBe('transpiration');
    const ecosystem = UNITS[12]!;
    expect(ecosystem.ok && ecosystem.activity).toBe('variable');
    if (ecosystem.ok) expect(ecosystem.module.kind).toBe('food-web');
    const microbe = UNITS[13]!;
    expect(microbe.ok && microbe.activity).toBe('variable');
    if (microbe.ok) expect(microbe.module.kind).toBe('mold-growth');
    const body = UNITS[14]!;
    expect(body.ok && body.activity).toBe('variable');
    if (body.ok) expect(body.module.kind).toBe('exercise-body');
    const animal = UNITS[15]!;
    expect(animal.ok && animal.activity).toBe('card-sort');
    if (animal.ok) expect(animal.module.kind).toBe('card-sort');
    const plantlife = UNITS[16]!;
    expect(plantlife.ok && plantlife.activity).toBe('card-sort');
    if (plantlife.ok && plantlife.activity === 'card-sort') expect(plantlife.experiment.layout).toBe('tree');
    const force = UNITS[17]!;
    expect(force.ok && force.activity).toBe('variable');
    if (force.ok) expect(force.module.kind).toBe('lever-balance');
  });

  it('카드 분류 매니페스트가 깨져도 다른 단원은 로드된다', () => {
    const broken = clone(animalJson);
    broken.experiments[0].cards[0].features.legs = 'maybe';
    const units = buildRegistry([gasesJson, broken, solutionJson]);
    expect(units.map((u) => u.ok)).toEqual([true, false, true]);
    const bad = units[1]!;
    if (!bad.ok) expect(bad.issues.join()).toContain('maybe');
    const noFeature = clone(animalJson);
    delete noFeature.experiments[0].cards[0].observations.wings;
    expect(buildRegistry([noFeature])[0]!.ok).toBe(false);
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

describe('연소 단원 로드', () => {
  it('모듈 validate에 실패하면 오류 항목이 되고 다른 단원은 계속 쓸 수 있다', () => {
    const broken = clone(combustionJson);
    broken.experiments[0].variables.find((v: { key: string }) => v.key === 'jarMl').options[0].value = 10;
    const units = buildRegistry([gasesJson, broken]);
    expect(units.map((u) => u.ok)).toEqual([true, false]);
    if (!units[1]!.ok) expect(units[1]!.issues.join()).toContain('jarMl');
  });
});

describe('보온 컵 단원 로드', () => {
  it('모듈 validate에 실패하면 오류 항목이 되고 다른 단원은 계속 쓸 수 있다', () => {
    const broken = clone(heatJson);
    broken.experiments[0].variables.find((v: { key: string }) => v.key === 'waterMl').options[0].value = 1000;
    const units = buildRegistry([gasesJson, broken]);
    expect(units.map((u) => u.ok)).toEqual([true, false]);
    if (!units[1]!.ok) expect(units[1]!.issues.join()).toContain('waterMl');
  });
});

describe('볼록 렌즈 단원 로드', () => {
  it('모듈 validate에 실패하면 오류 항목이 되고 다른 단원은 계속 쓸 수 있다', () => {
    const broken = clone(lightJson);
    broken.experiments[0].variables.find((v: { key: string }) => v.key === 'distanceCm').options[3].value = 100;
    const units = buildRegistry([gasesJson, broken]);
    expect(units.map((u) => u.ok)).toEqual([true, false]);
    if (!units[1]!.ok) expect(units[1]!.issues.join()).toContain('distanceCm');
  });
});

describe('전자석 단원 로드', () => {
  it('모듈 validate에 실패하면 오류 항목이 되고 다른 단원은 계속 쓸 수 있다', () => {
    const broken = clone(electricityJson);
    broken.experiments[0].variables.find((v: { key: string }) => v.key === 'turns').options[0].value = 1000;
    const units = buildRegistry([gasesJson, broken]);
    expect(units.map((u) => u.ok)).toEqual([true, false]);
    if (!units[1]!.ok) expect(units[1]!.issues.join()).toContain('turns');
  });
});

describe('마그마 냉각 단원 로드', () => {
  it('모듈 validate에 실패하면 오류 항목이 되고 다른 단원은 계속 쓸 수 있다', () => {
    const broken = clone(landJson);
    broken.experiments[0].variables.find((v: { key: string }) => v.key === 'grams').options[1].value = 100;
    const units = buildRegistry([gasesJson, broken]);
    expect(units.map((u) => u.ok)).toEqual([true, false]);
    if (!units[1]!.ok) expect(units[1]!.issues.join()).toContain('grams');
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
