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
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import mixtureJson from '../../../content/units/g5-mixture/manifest.json';
import { ActivityTabs, ActivityTabsContext, ActivityTabsSlot } from './components/ActivityTabs';
import { UNITS, activityOf, buildRegistry, parseRoute, unitHash } from './units';

const clone = (j: unknown) => JSON.parse(JSON.stringify(j));

describe('단원 레지스트리', () => {
  it('열 단원이 모두 로드된다', () => {
    expect(UNITS.map((u) => u.id)).toEqual(['g4-gases', 'g5-solution', 'g6-acid-base', 'g6-combustion', 'g5-heat', 'g5-light', 'g6-electricity', 'g4-land', 'g6-earth-motion', 'g6-seasons', 'g3-lifecycle', 'g6-plant', 'g4-ecosystem', 'g4-microbe', 'g5-body', 'g3-animal', 'g3-plantlife', 'g3-force', 'g3-sound', 'g4-magnet', 'g6-motion', 'g3-material', 'g4-water-state', 'g5-mixture', 'g3-earth-sea', 'g4-night-sky', 'g5-strata', 'g5-weather', 'g3-health', 'g4-climate', 'g5-energy', 'g6-career']);
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
    const sound = UNITS[18]!;
    expect(sound.ok && sound.activity).toBe('variable');
    if (sound.ok) expect(sound.module.kind).toBe('string-sound');
    const magnet = UNITS[19]!;
    expect(magnet.ok && magnet.activity).toBe('variable');
    if (magnet.ok) expect(magnet.module.kind).toBe('magnet-distance');
    const motion = UNITS[20]!;
    expect(motion.ok && motion.activity).toBe('variable');
    if (motion.ok) expect(motion.module.kind).toBe('ramp-cart');
    const water = UNITS[22]!;
    expect(water.ok && water.activity).toBe('variable');
    if (water.ok) expect(water.module.kind).toBe('freeze-melt');
    const mixture = UNITS[23]!;
    expect(mixture.ok && mixture.activity).toBe('variable');
    if (mixture.ok) expect(mixture.module.kind).toBe('salt-sand');
    const stream = UNITS[7]!;
    expect(stream.ok && stream.activities.map((a) => a.activity)).toEqual(['variable', 'variable', 'card-sort']);
    if (stream.ok) expect(stream.activities[1]!.module.kind).toBe('stream-table');
    const sea = UNITS[24]!;
    expect(sea.ok && sea.activity).toBe('variable');
    if (sea.ok) expect(sea.module.kind).toBe('sea-water');
    const night = UNITS[25]!;
    expect(night.ok && night.activity).toBe('observe');
    if (night.ok) expect(night.module.kind).toBe('sky-observation');
    const strata = UNITS[26]!;
    expect(strata.ok && strata.activity).toBe('card-sort');
    if (strata.ok && strata.activity === 'card-sort') expect(strata.experiment.layout).toBe('order');
    const weather = UNITS[27]!;
    expect(weather.ok && weather.activity).toBe('variable');
    if (weather.ok) expect(weather.module.kind).toBe('land-sea-breeze');
    const health = UNITS[28]!;
    expect(health.ok && health.activity).toBe('variable');
    if (health.ok) expect(health.module.kind).toBe('infection-spread');
    const energy = UNITS[30]!;
    expect(energy.ok && energy.activity).toBe('variable');
    if (energy.ok) expect(energy.module.kind).toBe('solar-panel');
    const career = UNITS[31]!;
    expect(career.ok && career.activity).toBe('portfolio');
    if (career.ok) expect(career.module.kind).toBe('career-portfolio');
    const material = UNITS[21]!;
    expect(material.ok && material.activity).toBe('card-sort');
    if (material.ok && material.activity === 'card-sort') expect(material.experiment.layout).toBe('groups');
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

describe('해시 라우팅: 활동 주소', () => {
  it('#/unit/{id}는 활동을 정하지 않고 #/unit/{id}/{experimentId}는 활동을 정한다', () => {
    expect(parseRoute('#/unit/g5-mixture')).toEqual({ page: 'unit', unitId: 'g5-mixture' });
    expect(parseRoute('#/unit/g5-mixture/')).toEqual({ page: 'unit', unitId: 'g5-mixture' });
    expect(parseRoute('#/unit/g5-mixture/separation-methods')).toEqual({ page: 'unit', unitId: 'g5-mixture', experimentId: 'separation-methods' });
    expect(parseRoute('#/unit/g5-mixture/separation-methods/')).toEqual({ page: 'unit', unitId: 'g5-mixture', experimentId: 'separation-methods' });
    expect(parseRoute('#/unit/g5-mixture/no-such')).toEqual({ page: 'unit', unitId: 'g5-mixture', experimentId: 'no-such' });
  });
  it('unitHash는 두 형식을 만들고 parseRoute와 맞물린다', () => {
    expect(unitHash('g5-mixture')).toBe('#/unit/g5-mixture');
    expect(unitHash('g5-mixture', 'separation-methods')).toBe('#/unit/g5-mixture/separation-methods');
    for (const [u, e] of [['g5-mixture', 'separation-methods'], ['a b', 'c/d']] as const) {
      expect(parseRoute(unitHash(u, e))).toEqual({ page: 'unit', unitId: u, experimentId: e });
    }
  });
  it('깨진 인코딩이나 경로가 더 깊은 주소는 목록으로 돌아간다', () => {
    expect(parseRoute('#/unit/g5-mixture/%E0%A4%A')).toEqual({ page: 'list' });
    expect(parseRoute('#/unit/g5-mixture/a/b')).toEqual({ page: 'list' });
  });
  it('활동 고르기: 없거나 모르는 experimentId는 첫 활동', () => {
    const u = UNITS.find((x) => x.id === 'g5-mixture')!;
    if (!u.ok) throw new Error('g5-mixture');
    expect(activityOf(u).experiment.id).toBe('salt-sand');
    expect(activityOf(u, 'salt-sand').experiment.id).toBe('salt-sand');
    expect(activityOf(u, 'separation-methods').experiment.id).toBe('separation-methods');
    expect(activityOf(u, 'nope').experiment.id).toBe('salt-sand');
    // 활동이 하나인 단원은 어떤 id로도 첫(유일한) 활동이다.
    const light = UNITS.find((x) => x.id === 'g6-electricity')!;
    if (!light.ok) throw new Error('g6-electricity');
    expect(light.activities).toHaveLength(1);
    expect(activityOf(light, 'separation-methods')).toBe(light.activities[0]);
    // 활동이 둘인 여러 가지 기체는 모르는 id를 첫 활동으로 돌리고, 둘째 활동 id는 둘째 활동이다.
    const gases = UNITS.find((x) => x.id === 'g4-gases')!;
    if (!gases.ok) throw new Error('g4-gases');
    expect(activityOf(gases, 'separation-methods')).toBe(gases.activities[0]);
    expect(activityOf(gases, 'gas-weight')).toBe(gases.activities[1]);
  });
});

describe('레지스트리 activities', () => {
  it('모든 experiment가 매니페스트 순서대로 활동이 되고 최상위 값은 첫 활동과 같다', () => {
    for (const u of UNITS) {
      if (!u.ok) throw new Error(u.id);
      expect(u.activities.map((a) => a.experiment.id), u.id).toEqual(u.manifest.experiments.map((e) => e.id));
      const first = u.activities[0]!;
      expect([u.activity, u.experiment, u.module], u.id).toEqual([first.activity, first.experiment, first.module]);
    }
  });
  it('활동이 둘 이상인 단원은 g4-gases, g5-solution, g6-acid-base, g6-combustion, g5-heat, g5-light, g4-land, g3-lifecycle, g4-ecosystem, g3-animal, g3-plantlife, g3-force, g3-sound, g4-magnet, g6-motion, g5-mixture, g3-material, g4-water-state, g3-earth-sea, g5-strata, g5-weather뿐이다', () => {
    const multi = UNITS.filter((u) => u.ok && u.activities.length > 1).map((u) => u.id);
    expect(multi).toEqual(['g4-gases', 'g5-solution', 'g6-acid-base', 'g6-combustion', 'g5-heat', 'g5-light', 'g4-land', 'g3-lifecycle', 'g4-ecosystem', 'g3-animal', 'g3-plantlife', 'g3-force', 'g3-sound', 'g4-magnet', 'g6-motion', 'g3-material', 'g4-water-state', 'g5-mixture', 'g3-earth-sea', 'g5-strata', 'g5-weather']);
    // 변인 실험을 두 번째 활동으로 더한 단원(교육과정 4과09-02 등). 첫 활동은 그대로다. 힘과 우리 생활·소리의 성질·여러 가지 기체는 활동이 셋 이상이라 아래에서 따로 본다.
    for (const [id, first, second, kind, standards] of [
      ['g4-magnet', 'magnet-distance', 'magnet-poles', 'magnet-poles', ['4과09-01', '4과09-02']],
    ] as const) {
      const u = UNITS.find((x) => x.id === id)!;
      expect(u.ok && u.activities.map((a) => [a.activity, a.experiment.id, a.module.kind]), id).toEqual([['variable', first, first], ['variable', second, kind]]);
      expect(u.ok && u.module.kind, id).toBe(first);
      expect(u.ok && u.manifest.standards, id).toEqual(standards);
    }
    // 변인 실험을 두 번째 활동으로 더한 네 단원(교육과정 6과03-02, 6과07-02, 6과02-01, 6과09-02). 첫 활동은 그대로다(지시약 단원의 첫 활동은 분류 활동).
    for (const [id, first, firstKind, second, standards] of [
      ['g5-solution', 'dissolve-amount', 'variable', 'concentration', ['6과03-01', '6과03-02']],
      ['g5-heat', 'insulated-cup', 'variable', 'heat-contact', ['6과07-02', '6과07-04']],
      ['g5-light', 'convex-lens', 'variable', 'light-needed', ['6과02-01', '6과02-02']],
      ['g6-acid-base', 'indicator-classify', 'classify', 'acid-base-mix', ['6과09-01', '6과09-02']],
    ] as const) {
      const u = UNITS.find((x) => x.id === id)!;
      expect(u.ok && u.activities.map((a) => [a.activity, a.experiment.id]), id).toEqual([[firstKind, first], ['variable', second]]);
      expect(u.ok && u.activities[1]!.module.kind, id).toBe(second);
      expect(u.ok && u.activity, id).toBe(firstKind);
      expect(u.ok && u.experiment.id, id).toBe(first);
      expect(u.ok && u.manifest.standards, id).toEqual(standards);
    }
    // 변인 실험을 두 번째 활동으로 더한 두 단원(교육과정 6과10-01, 6과14-03). 첫 활동은 그대로다.
    for (const [id, first, second, standards] of [
      ['g6-motion', 'ramp-cart', 'position-time', ['6과10-01', '6과10-02']],
      ['g6-combustion', 'candle-jar', 'combustion-products', ['6과14-01', '6과14-02', '6과14-03']],
    ] as const) {
      const u = UNITS.find((x) => x.id === id)!;
      // 물질의 연소는 세 번째 활동(property-change, 카드 분류)이 더해져 활동이 셋이다. 앞의 두 활동은 그대로다.
      expect(u.ok && u.activities.slice(0, 2).map((a) => [a.activity, a.experiment.id]), id).toEqual([['variable', first], ['variable', second]]);
      expect(u.ok && u.activities[1]!.module.kind, id).toBe(second);
      expect(u.ok && u.activity, id).toBe('variable');
      expect(u.ok && u.experiment.id, id).toBe(first);
      expect(u.ok && u.manifest.standards, id).toEqual(standards);
    }
    // 힘과 우리 생활은 변인 실험이 넷이다(지레와 빗면 4과01-04, 밀고 당기기 4과01-01, 용수철저울 4과01-03). 첫 활동·둘째 활동은 그대로다.
    const force = UNITS.find((x) => x.id === 'g3-force')!;
    expect(force.ok && force.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([
      ['variable', 'lever-balance', 'lever-balance'],
      ['variable', 'lever-lift', 'lever-lift'],
      ['variable', 'push-pull', 'push-pull'],
      ['variable', 'spring-scale', 'spring-scale'],
    ]);
    expect(force.ok && [force.activity, force.module.kind, force.experiment.id]).toEqual(['variable', 'lever-balance', 'lever-balance']);
    expect(force.ok && force.manifest.standards).toEqual(['4과01-01', '4과01-02', '4과01-03', '4과01-04']);
    // 여러 가지 기체는 두 번째 활동 공기를 넣은 페트병의 무게(4과15-01)를 더했다. 첫 활동은 그대로다.
    const gases = UNITS.find((x) => x.id === 'g4-gases')!;
    expect(gases.ok && gases.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'syringe-volume', 'gas-syringe'], ['variable', 'gas-weight', 'gas-weight']]);
    expect(gases.ok && [gases.activity, gases.module.kind, gases.experiment.id]).toEqual(['variable', 'gas-syringe', 'syringe-volume']);
    expect(gases.ok && gases.manifest.standards).toEqual(['4과15-01', '4과15-02']);
    // 소리의 성질은 활동이 셋이다(4과07-01 소리 나는 물체의 떨림, 4과07-03 소리가 전달되는 물질과 소음 줄이기). 앞의 두 활동은 그대로다.
    const sound = UNITS.find((u) => u.id === 'g3-sound')!;
    expect(sound.ok && sound.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'string-sound', 'string-sound'], ['variable', 'sound-vibration', 'sound-vibration'], ['variable', 'sound-transmit', 'sound-transmit']]);
    expect(sound.ok && sound.module.kind).toBe('string-sound');
    expect(sound.ok && sound.manifest.standards).toEqual(['4과07-01', '4과07-02', '4과07-03']);
    const land = UNITS.find((u) => u.id === 'g4-land')!;
    // 땅의 변화는 세 번째 활동(화산에서 나오는 것 나누기, 카드 분류)이 더해져 활동이 셋이다. 앞의 두 활동은 그대로다.
    expect(land.ok && land.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'magma-cooling', 'magma-cooling'], ['variable', 'stream-table', 'stream-table'], ['card-sort', 'volcano-ejecta', 'card-sort']]);
    expect(land.ok && land.manifest.standards).toEqual(['4과11-01', '4과11-02', '4과11-03']);
    // 옛 흐르는 물 단원 id를 다시 쓴다: 「지구와 바다」는 바닷물과 강물 비교하기(변인)와 밀물과 썰물 관찰하기(관찰) 두 활동 단원이다.
    const sea = UNITS.find((x) => x.id === 'g3-earth-sea')!;
    expect(sea.ok && sea.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'sea-water', 'sea-water'], ['observe', 'tide', 'sky-observation'], ['variable', 'land-sea-dots', 'land-sea-dots']]);
    expect(sea.ok && [sea.manifest.title, sea.manifest.grade, sea.manifest.engine, sea.manifest.standards]).toEqual(['지구와 바다', 3, 'earth', ['4과06-01', '4과06-02', '4과06-03']]);
    // 생물의 한살이는 씨가 싹 트는 조건(4과04-02)에 배추흰나비의 한살이 관찰 기록(4과04-01)이 두 번째 활동으로 더해졌다. 첫 활동은 그대로다.
    const life = UNITS.find((x) => x.id === 'g3-lifecycle')!;
    expect(life.ok && life.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'germination', 'germination'], ['variable', 'butterfly-life', 'butterfly-life']]);
    expect(life.ok && life.module.kind).toBe('germination');
    expect(life.ok && life.manifest.standards).toEqual(['4과04-01', '4과04-02']);
    const m = UNITS.find((u) => u.id === 'g5-mixture')!;
    expect(m.ok && m.activities.map((a) => [a.activity, a.experiment.id])).toEqual([['variable', 'salt-sand'], ['card-sort', 'separation-methods']]);
    expect(m.ok && m.module.kind).toBe('salt-sand');
    const w = UNITS.find((u) => u.id === 'g5-weather')!;
    expect(w.ok && w.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'land-sea-breeze', 'land-sea-breeze'], ['card-sort', 'dew-fog-cloud', 'card-sort']]);
    expect(w.ok && w.manifest.standards).toEqual(['6과06-02', '6과06-03']);
    // 카드 분류 두 번째 활동 넷(1차 묶음): 첫 활동의 종류는 변인 실험(생물과 환경)·카드 분류 무리(동물)·트리(식물)·순서(지층)로 서로 다르다.
    const second = (id: string) => {
      const u = UNITS.find((x) => x.id === id)!;
      return u.ok ? [u.activities.map((a) => [a.activity, a.experiment.id]), u.manifest.standards] : null;
    };
    expect(second('g3-animal')).toEqual([[['card-sort', 'animal-sort'], ['card-sort', 'animal-habitat']], ['4과02-01', '4과02-02']]);
    expect(second('g3-plantlife')).toEqual([[['card-sort', 'leaf-tree'], ['card-sort', 'plant-habitat']], ['4과03-01', '4과03-02']]);
    expect(second('g4-ecosystem')).toEqual([[['variable', 'food-web'], ['card-sort', 'living-nonliving']], ['4과14-01', '4과14-02']]);
    expect(second('g5-strata')).toEqual([[['card-sort', 'strata-order'], ['card-sort', 'rock-grain']], ['6과01-01', '6과01-02', '6과01-03']]);
    // 최상위 값은 첫 활동이다(생물과 환경은 변인 실험 그대로).
    const eco = UNITS.find((x) => x.id === 'g4-ecosystem')!;
    expect(eco.ok && [eco.activity, eco.module.kind]).toEqual(['variable', 'food-web']);
    // 카드 분류 활동 넷(3차 묶음): 물체와 물질·물의 상태 변화는 두 번째 활동, 땅의 변화·물질의 연소는 세 번째 활동으로 덧붙는다(활동이 셋이어도 활동 탭은 그대로 맞는다).
    const last = (id: string) => {
      const u = UNITS.find((x) => x.id === id)!;
      return u.ok ? [u.activities.map((a) => [a.activity, a.experiment.id]), u.activities[u.activities.length - 1]!.module.kind, u.manifest.standards] : null;
    };
    expect(last('g3-material')).toEqual([[['card-sort', 'material-sort'], ['card-sort', 'matter-shape-volume']], 'card-sort', ['4과05-01', '4과05-02']]);
    expect(last('g4-water-state')).toEqual([[['variable', 'freeze-melt'], ['card-sort', 'water-around']], 'card-sort', ['4과10-01', '4과10-02']]);
    expect(last('g4-land')).toEqual([[['variable', 'magma-cooling'], ['variable', 'stream-table'], ['card-sort', 'volcano-ejecta']], 'card-sort', ['4과11-01', '4과11-02', '4과11-03']]);
    expect(last('g6-combustion')).toEqual([[['variable', 'candle-jar'], ['variable', 'combustion-products'], ['card-sort', 'property-change']], 'card-sort', ['6과14-01', '6과14-02', '6과14-03']]);
    // 최상위 값은 첫 활동이다(물의 상태 변화·땅의 변화·물질의 연소는 변인 실험 그대로).
    for (const [id, kind] of [['g3-material', 'card-sort'], ['g4-water-state', 'variable'], ['g4-land', 'variable'], ['g6-combustion', 'variable']] as const) {
      const u = UNITS.find((x) => x.id === id)!;
      expect(u.ok && u.activity, id).toBe(kind);
    }
  });
  it('두 번째 활동이 깨져도 그 단원만 오류 항목이 된다(모든 experiment를 검사)', () => {
    const broken = clone(mixtureJson);
    broken.experiments[1].cards[0].features.size = 'maybe';
    const units = buildRegistry([gasesJson, broken, solutionJson]);
    expect(units.map((u) => u.ok)).toEqual([true, false, true]);
    const bad = units[1]!;
    if (!bad.ok) expect(bad.issues.join()).toContain('maybe');
  });
});

/** 카드 분류 두 번째 활동을 더한 단원 넷(1차 묶음). */
const CARD_SORT_BATCH_A = ['g3-animal', 'g3-plantlife', 'g4-ecosystem', 'g5-strata'];
/** 카드 분류 활동을 더한 단원 넷(3차 묶음). 땅의 변화·물질의 연소는 활동이 셋이다. */
const CARD_SORT_BATCH_C = ['g3-material', 'g4-water-state', 'g4-land', 'g6-combustion'];

describe('활동 탭 화면', () => {
  const m = UNITS.find((u) => u.id === 'g5-mixture')!;
  if (!m.ok) throw new Error('g5-mixture');
  it('탭이 없으면(활동이 하나인 단원) 자리가 아무것도 그리지 않는다', () => {
    expect(renderToStaticMarkup(createElement('div', null, createElement(ActivityTabsSlot)))).toBe('<div></div>');
    expect(renderToStaticMarkup(createElement(ActivityTabsContext.Provider, { value: null }, createElement('div', null, createElement(ActivityTabsSlot))))).toBe('<div></div>');
    // 활동이 하나인 단원은 탭을 만들 필요가 없다.
    for (const u of UNITS) if (u.ok && u.id !== 'g5-mixture' && u.id !== 'g4-land' && u.id !== 'g3-earth-sea' && u.id !== 'g5-weather' && u.id !== 'g4-gases' && u.id !== 'g3-force' && u.id !== 'g3-sound' && u.id !== 'g4-magnet' && u.id !== 'g5-solution' && u.id !== 'g5-heat' && u.id !== 'g5-light' && u.id !== 'g3-lifecycle' && u.id !== 'g6-acid-base' && u.id !== 'g6-motion' && u.id !== 'g6-combustion' && !CARD_SORT_BATCH_A.includes(u.id) && !CARD_SORT_BATCH_C.includes(u.id)) expect(u.activities, u.id).toHaveLength(1);
  });
  it('활동이 셋인 단원(땅의 변화·물질의 연소)도 탭 셋을 그리고 마지막 활동 탭이 선택된다', () => {
    for (const [id, last, title] of [['g4-land', 'volcano-ejecta', '화산에서 나오는 것 나누기'], ['g6-combustion', 'property-change', '변하기 전과 후의 성질 비교하기']] as const) {
      const u = UNITS.find((x) => x.id === id)!;
      if (!u.ok) throw new Error(id);
      expect(u.activities, id).toHaveLength(3);
      const html = renderToStaticMarkup(createElement(ActivityTabs, { activities: u.activities, currentId: last, onSelect: () => {} }));
      expect(html.match(/role="tab"/g), id).toHaveLength(3);
      expect(html.match(/aria-selected="true"/g), id).toHaveLength(1);
      expect(html, id).toMatch(new RegExp(`aria-selected="true"[^>]*tabindex="0"[^>]*>활동 3 · ${title}`));
      expect(html, id).toMatch(/aria-selected="false"[^>]*tabindex="-1"[^>]*>활동 1 · /);
      expect(html, id).toMatch(/aria-selected="false"[^>]*tabindex="-1"[^>]*>활동 2 · /);
    }
  });
  it('활동이 셋인 소리의 성질은 탭 셋을 "활동 n · 제목" 이름으로 그리고, 마지막 활동이 선택될 수 있다', () => {
    const u = UNITS.find((x) => x.id === 'g3-sound')!;
    if (!u.ok) throw new Error('g3-sound');
    expect(u.activities).toHaveLength(3);
    const html = renderToStaticMarkup(createElement(ActivityTabs, { activities: u.activities, currentId: 'sound-transmit', onSelect: () => {} }));
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"[^>]*>활동 1 · /);
    expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"[^>]*>활동 2 · 소리 나는 물체의 떨림/);
    expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"[^>]*>활동 3 · 소리가 전달되는 물질과 소음 줄이기/);
  });
  it('탭은 tablist와 tab, aria-selected, "활동 n · 제목" 이름을 가진다', () => {
    const html = renderToStaticMarkup(
      createElement(ActivityTabs, { activities: m.activities, currentId: 'separation-methods', onSelect: () => {} }),
    );
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"[^>]*>활동 1 · [^<]+/);
    expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"[^>]*>활동 2 · 혼합물의 성질에 따라 분리 방법 고르기/);
    const inSlot = renderToStaticMarkup(
      createElement(ActivityTabsContext.Provider, { value: createElement(ActivityTabs, { activities: m.activities, currentId: 'salt-sand', onSelect: () => {} }) }, createElement(ActivityTabsSlot)),
    );
    expect(inSlot).toMatch(/aria-selected="true"[^>]*tabindex="0"[^>]*>활동 1 · /);
  });
  it('활동이 넷인 힘과 우리 생활도 탭 넷이 순서대로 "활동 n · 제목"이고, 고른 탭만 선택·tabindex 0이다', () => {
    const f = UNITS.find((u) => u.id === 'g3-force')!;
    if (!f.ok) throw new Error('g3-force');
    for (const [i, current] of f.activities.map((a) => a.experiment.id).entries()) {
      const html = renderToStaticMarkup(createElement(ActivityTabs, { activities: f.activities, currentId: current, onSelect: () => {} }));
      expect(html.match(/role="tab"/g), current).toHaveLength(4);
      expect(html.match(/aria-selected="true"/g), current).toHaveLength(1);
      expect(html.match(/tabindex="0"/g), current).toHaveLength(1);
      expect([...html.matchAll(/>활동 (\d) · ([^<]+)</g)].map((m) => [m[1], m[2]]), current).toEqual([
        ['1', '막대의 수평 잡기'],
        ['2', '지레와 빗면으로 들어 올리기'],
        ['3', '밀고 당기면 생기는 변화'],
        ['4', '용수철저울로 무게 비교하기'],
      ]);
      expect(html, current).toMatch(new RegExp(`aria-selected="true"[^>]*>활동 ${i + 1} · `));
    }
  });
});
