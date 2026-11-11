import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/units/g5-solution/manifest.json';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';
import combustionJson from '../../../content/units/g6-combustion/manifest.json';
import heatJson from '../../../content/units/g5-heat/manifest.json';
import lightJson from '../../../content/units/g5-light/manifest.json';
import electricityJson from '../../../content/units/g6-electricity/manifest.json';
import landJson from '../../../content/units/g4-land/manifest.json';
import seasonsJson from '../../../content/units/g6-seasons/manifest.json';
import lifecycleJson from '../../../content/units/g3-lifecycle/manifest.json';
import plantJson from '../../../content/units/g6-plant/manifest.json';
import ecosystemJson from '../../../content/units/g4-ecosystem/manifest.json';
import microbeJson from '../../../content/units/g4-microbe/manifest.json';
import bodyJson from '../../../content/units/g5-body/manifest.json';
import forceJson from '../../../content/units/g3-force/manifest.json';
import soundJson from '../../../content/units/g3-sound/manifest.json';
import magnetJson from '../../../content/units/g4-magnet/manifest.json';
import motionJson from '../../../content/units/g6-motion/manifest.json';
import strataJson from '../../../content/units/g5-strata/manifest.json';
import waterStateJson from '../../../content/units/g4-water-state/manifest.json';
import mixtureJson from '../../../content/units/g5-mixture/manifest.json';
import earthSeaJson from '../../../content/units/g3-earth-sea/manifest.json';
import weatherJson from '../../../content/units/g5-weather/manifest.json';
import healthJson from '../../../content/units/g3-health/manifest.json';
import climateJson from '../../../content/units/g4-climate/manifest.json';
import energyJson from '../../../content/units/g5-energy/manifest.json';
import animalJson from '../../../content/units/g3-animal/manifest.json';
import plantlifeJson from '../../../content/units/g3-plantlife/manifest.json';
import earthJson from '../../../content/units/g6-earth-motion/manifest.json';
import nightSkyJson from '../../../content/units/g4-night-sky/manifest.json';
import {
  ManifestError,
  isCardSortExperiment,
  isClassificationExperiment,
  isObservationExperiment,
  observationAnswerSchema,
  isVariableExperiment,
  parseManifest,
  type CardSortExperiment,
  type ClassificationExperiment,
  type ObservationExperiment,
  type VariableExperiment,
} from './index';

describe('manifest schema', () => {
  it('실제 매니페스트가 검증을 통과한다', () => {
    const m = parseManifest(manifestJson);
    expect(m.id).toBe('g5-solution');
    expect((m.experiments[0] as VariableExperiment).variables).toHaveLength(4);
    expect((m.experiments[0] as VariableExperiment).tutor.probes).toHaveLength(8);
    expect((m.experiments[0] as VariableExperiment).tutor.probes.map((p) => p.when)).toContain('iv-unchanged');
  });

  it('필수 필드가 없으면 거부한다', () => {
    const bad = JSON.parse(JSON.stringify(manifestJson));
    delete bad.experiments[0].question;
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('default가 options에 없으면 거부한다', () => {
    const bad = JSON.parse(JSON.stringify(manifestJson));
    bad.experiments[0].variables[1].default = 999;
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('알 수 없는 probe 시점과 빈 experiments를 거부한다', () => {
    const bad = JSON.parse(JSON.stringify(manifestJson));
    bad.experiments[0].tutor.probes[0].when = 'nope';
    expect(() => parseManifest(bad)).toThrow(ManifestError);
    expect(() => parseManifest({ ...manifestJson, experiments: [] })).toThrow(ManifestError);
    expect(() => parseManifest(null)).toThrow(ManifestError);
  });
});

describe('다단원 필드', () => {
  const clone = (j: unknown = manifestJson) => JSON.parse(JSON.stringify(j));

  it('두 매니페스트가 모두 검증을 통과한다', () => {
    const solution = parseManifest(manifestJson);
    const gases = parseManifest(gasesJson);
    expect(solution.experiments[0]!.module).toBe('dissolution');
    expect(gases.id).toBe('g4-gases');
    expect(gases.grade).toBe(4);
    const e = gases.experiments[0]! as VariableExperiment;
    expect(e.module).toBe('gas-syringe');
    expect(e.params).toEqual({ syringeMaxMl: 60 });
    expect(e.predictionPrompt).toBe('예측: 기체의 부피는?');
    expect(e.spoonGrams).toBeUndefined();
    expect(e.safetyNotices).toHaveLength(1);
    expect(e.tutor.probes.filter((p) => p.iv)).toHaveLength(2);
  });

  it('용해 매니페스트로 옮긴 safetyNotices와 iv probe', () => {
    const e = parseManifest(manifestJson).experiments[0]! as VariableExperiment;
    expect(e.predictionPrompt).toBe('예측: 녹는 양은?');
    expect(e.safetyNotices).toEqual([
      { key: 'waterTempC', value: 60, text: '⚠ 뜨거운 물 주의: 60 °C의 물은 화상을 입을 수 있어요. 실제 실험에서는 선생님과 함께 조심해서 다뤄요.' },
    ]);
    const stir = e.tutor.probes.find((p) => p.iv === 'stir')!;
    expect(stir.when).toBe('fair-test');
    expect(stir.text).toContain('젓는 빠르기');
  });

  it('fair-test-stir는 더 이상 허용하지 않는다', () => {
    const bad = clone();
    bad.experiments[0].tutor.probes[0].when = 'fair-test-stir';
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('module은 필수이고 알 수 없는 값은 거부한다', () => {
    const none = clone();
    delete none.experiments[0].module;
    expect(() => parseManifest(none)).toThrow(ManifestError);
    const bad = clone();
    bad.experiments[0].module = 'nope';
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('predictionPrompt는 필수', () => {
    const bad = clone();
    delete bad.experiments[0].predictionPrompt;
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('spoonGrams는 선택이고 standards는 빈 배열을 허용한다', () => {
    const ok = clone(gasesJson);
    ok.standards = [];
    expect(parseManifest(ok).standards).toEqual([]);
    const solution = clone();
    delete solution.experiments[0].spoonGrams;
    expect(() => parseManifest(solution)).not.toThrow();
  });

  it('safetyNotices 항목 형식을 검사한다', () => {
    const bad = clone();
    bad.experiments[0].safetyNotices = [{ key: 'waterTempC', value: 60 }];
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });
});


describe('활동 유형 union (module 기준)', () => {
  const clone = (j: unknown) => JSON.parse(JSON.stringify(j));

  it('세 매니페스트가 모두 검증을 통과한다', () => {
    for (const j of [manifestJson, gasesJson, acidBaseJson]) expect(() => parseManifest(j)).not.toThrow();
    const e = parseManifest(acidBaseJson).experiments[0]!;
    expect(e.module).toBe('indicator-classify');
    expect(isVariableExperiment(e)).toBe(false);
    const c = e as ClassificationExperiment;
    expect(c.solutions).toHaveLength(8);
    expect(c.indicators).toHaveLength(4);
    expect(c.safetyChecklist).toHaveLength(3);
    expect(c.tutor.probes.map((p) => p.when)).toEqual([
      'before-test', 'testing', 'prediction-mismatch', 'check-untested', 'check-inconsistent', 'check-complete',
    ]);
    expect(isVariableExperiment(parseManifest(manifestJson).experiments[0]!)).toBe(true);
  });

  it('잘못된 module을 거부한다', () => {
    const bad = clone(acidBaseJson);
    bad.experiments[0].module = 'nope';
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('활동 유형끼리 필드를 섞으면 거부한다', () => {
    const noSolutions = clone(acidBaseJson);
    delete noSolutions.experiments[0].solutions;
    expect(() => parseManifest(noSolutions)).toThrow(ManifestError);
    const asVariable = clone(acidBaseJson);
    asVariable.experiments[0].module = 'dissolution';
    expect(() => parseManifest(asVariable)).toThrow(ManifestError);
    const wrongProbe = clone(acidBaseJson);
    wrongProbe.experiments[0].tutor.probes[0].when = 'before-run';
    expect(() => parseManifest(wrongProbe)).toThrow(ManifestError);
    const wrongHex = clone(acidBaseJson);
    wrongHex.experiments[0].colors.red.hex = 'red';
    expect(() => parseManifest(wrongHex)).toThrow(ManifestError);
  });
});

describe('변인 실험 선택 필드: safetyChecklist, safetyMessages', () => {
  const clone = (j: unknown) => JSON.parse(JSON.stringify(j));

  it('아홉 매니페스트가 모두 검증을 통과한다', () => {
    for (const j of [manifestJson, gasesJson, acidBaseJson, combustionJson, heatJson, lightJson, electricityJson, landJson, seasonsJson, lifecycleJson, plantJson, ecosystemJson, microbeJson, bodyJson, forceJson, soundJson, magnetJson, motionJson, waterStateJson, mixtureJson, weatherJson, healthJson, climateJson, energyJson]) expect(() => parseManifest(j)).not.toThrow();
  });

  it('연소 매니페스트의 점검표와 경고 문구를 읽는다', () => {
    const e = parseManifest(combustionJson).experiments[0] as VariableExperiment;
    expect(e.module).toBe('candle-jar');
    expect(e.safetyChecklist).toHaveLength(3);
    expect(e.safetyMessages).toEqual({ NO_GOGGLES: '불을 다루기 전에 보안경을 먼저 착용해 주세요!' });
  });

  it('보온 컵 매니페스트의 점검표와 경고 문구 네 가지를 읽는다', () => {
    const e = parseManifest(heatJson).experiments[0] as VariableExperiment;
    expect(e.module).toBe('insulated-cup');
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {}).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
  });

  it('볼록 렌즈 매니페스트의 점검표와 안전 종류를 읽는다', () => {
    const e = parseManifest(lightJson).experiments[0] as VariableExperiment;
    expect(e.module).toBe('convex-lens');
    expect(e.safetyChecklist).toHaveLength(3);
    expect(e.safety).toEqual(['sunlight', 'fire']);
  });

  it('전자석 매니페스트의 점검표, 경고 문구, 안전 종류, 변인을 읽는다', () => {
    const e = parseManifest(electricityJson).experiments[0] as VariableExperiment;
    expect(e.module).toBe('electromagnet');
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {}).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.safety).toEqual(['electric', 'hot']);
    expect(e.variables.map((v) => v.key)).toEqual(['turns', 'battery', 'core', 'direction']);
    expect(e.dependent.map((d) => d.key)).toEqual(['clipsMax', 'headPole']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['battery', 'direction', 'core']);
  });

  it('땅의 변화 매니페스트의 점검표, 경고 문구, 안전 종류, 변인을 읽는다', () => {
    const m = parseManifest(landJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-land', 4, 'earth', ['4과11-01', '4과11-02', '4과11-03']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('magma-cooling');
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {}).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.safety).toEqual(['hot']);
    expect(e.variables.map((v) => v.key)).toEqual(['place', 'grams', 'dish', 'color']);
    expect(e.dependent.map((d) => d.key)).toEqual(['sizeMm', 'solidS']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['place', 'color']);
  });

  it('계절의 변화 매니페스트의 점검표, 안전 종류, 변인을 읽는다', () => {
    const m = parseManifest(seasonsJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g6-seasons', 6, 'earth', ['6과13-01', '6과13-02', '6과13-03']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('sun-angle');
    expect(e.safetyChecklist).toHaveLength(3);
    expect(e.safety).toEqual(['sunlight']);
    expect(e.variables.map((v) => v.key)).toEqual(['season', 'tiltDeg', 'stickCm']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([0, 23.44, 30]);
    expect(e.dependent.map((d) => d.key)).toEqual(['noonAltDeg', 'noonShadowCm']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['season', 'tiltDeg', 'stickCm']);
  });

  it('생물의 한살이 매니페스트의 변인, 안전 종류, 탐침을 읽는다', () => {
    const m = parseManifest(lifecycleJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g3-lifecycle', 3, 'life', ['4과04-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('germination');
    expect(e.safety).toEqual([]);
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.variables.map((v) => v.key)).toEqual(['water', 'tempC', 'light']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([5, 20, 30]);
    expect(e.dependent.map((d) => d.key)).toEqual(['sproutedDay7', 'firstDay']);
    expect(e.params).toEqual({ seeds: 10, days: 10 });
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['light', 'tempC']);
  });

  it('식물의 구조와 기능 매니페스트의 변인, 안전 종류, 탐침을 읽는다', () => {
    const m = parseManifest(plantJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g6-plant', 6, 'life', ['6과11-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('transpiration');
    expect(e.safety).toEqual([]);
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.variables.map((v) => v.key)).toEqual(['leaves', 'light', 'wind', 'startMl']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual([0, 4, 8]);
    expect(e.variables[3]!.options.map((o) => o.value)).toEqual([100, 150]);
    expect(e.dependent.map((d) => d.key)).toEqual(['lostMl', 'remainingMl']);
    expect(e.params).toEqual({ hours: 48 });
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['leaves', 'startMl']);
  });

  it('생물과 환경 매니페스트의 변인, 안전 종류, 탐침을 읽는다', () => {
    const m = parseManifest(ecosystemJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-ecosystem', 4, 'life', ['4과14-01', '4과14-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('food-web');
    expect(e.safety).toEqual([]);
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.variables.map((v) => v.key)).toEqual(['rabbits0', 'foxes0', 'rain', 'furColor']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual([10, 20]);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([0, 2, 4]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['low', 'normal', 'high']);
    expect(e.variables[3]!.options.map((o) => o.value)).toEqual(['white', 'brown']);
    expect(e.dependent.map((d) => d.key)).toEqual(['grassDay60', 'rabbitsMax']);
    expect(e.params).toEqual({ days: 60 });
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['foxes0', 'furColor']);
  });

  it('다양한 생물과 우리 생활 매니페스트의 변인, 안전 종류, 점검표, 탐침을 읽는다', () => {
    const m = parseManifest(microbeJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-microbe', 4, 'life', ['4과12-01']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('mold-growth');
    expect(e.safety).toEqual(['microbe']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {})).toEqual(['NO_GOGGLES', 'NO_GLOVES', 'SPILL', 'FOOD']);
    expect(e.variables.map((v) => v.key)).toEqual(['moisture', 'tempC', 'light']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual(['dry', 'wet']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([5, 20, 30]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['bright', 'dark']);
    expect(e.dependent.map((d) => d.key)).toEqual(['cover7', 'firstDay']);
    expect(e.params).toEqual({ days: 10 });
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['tempC', 'light']);
  });

  it('우리 몸의 구조와 기능 매니페스트의 변인, 안전 종류, 점검표, 탐침을 읽는다', () => {
    const m = parseManifest(bodyJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g5-body', 5, 'life', ['6과04-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('exercise-body');
    expect(e.safety).toEqual(['exercise']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {})).toEqual(['NO_GOGGLES', 'NO_GLOVES', 'SPILL', 'FOOD']);
    expect(e.variables.map((v) => v.key)).toEqual(['kind', 'minutes', 'wrist']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual(['sit', 'walk', 'run']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([1, 3]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['left', 'right']);
    expect(e.dependent.map((d) => d.key)).toEqual(['pulseEnd', 'breathEnd']);
    expect(e.params).toEqual({ totalMin: 10 });
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['kind', 'wrist']);
  });

  it('힘과 우리 생활 매니페스트의 변인, 안전 종류, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(forceJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g3-force', 3, 'physics', ['4과01-02', '4과01-04']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('lever-balance');
    expect(e.safety).toEqual([]);
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.variables.map((v) => v.key)).toEqual(['count', 'distance', 'shape']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual([1, 2, 4]);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([2, 4, 8]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['cylinder', 'cube']);
    expect(e.variables.map((v) => v.default)).toEqual([2, 4, 'cylinder']);
    expect(e.dependent.map((d) => d.key)).toEqual(['rightHeightCm']);
    expect(e.params).toEqual({ durationS: 1 });
    expect(e.tutor.forbiddenAnswers).toHaveLength(6);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['distance', 'count', 'shape']);
  });

  it('소리의 성질 매니페스트의 변인, 안전 종류, 금지 구절, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(soundJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g3-sound', 3, 'physics', ['4과07-01', '4과07-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('string-sound');
    expect(e.safety).toEqual([]);
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.variables.map((v) => v.key)).toEqual(['strength', 'lengthCm', 'color']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual(['weak', 'strong']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([15, 20, 30]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['red', 'yellow']);
    expect(e.variables.map((v) => v.default)).toEqual(['weak', 20, 'red']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['freq', '번'], ['level', '눈금']]);
    expect(e.params).toEqual({ windowMs: 20 });
    expect(e.limits).toEqual(['진동수', '진폭', '헤르츠', '데시벨', '파장', '음파']);
    expect(e.tutor.forbiddenAnswers).toHaveLength(5);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['strength', 'lengthCm']);
  });

  it('자석의 이용 매니페스트의 변인, 안전 종류와 점검표, 금지 구절, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(magnetJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-magnet', 4, 'physics', ['4과09-01', '4과09-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('magnet-distance');
    expect(e.safety).toEqual(['magnet']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {})).toEqual(['NO_GOGGLES', 'NO_GLOVES', 'SPILL', 'FOOD']);
    expect(e.safetyMessages?.NO_GOGGLES).not.toContain('보안경');
    expect(e.variables.map((v) => v.key)).toEqual(['gapCm', 'magnets', 'between']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual([0, 0.5, 1, 2]);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([1, 2]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['none', 'paper', 'plastic', 'iron']);
    expect(e.variables.map((v) => v.default)).toEqual([0.5, 1, 'none']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['clips', '개']]);
    expect(e.params).toEqual({ totalS: 6 });
    expect(e.limits).toEqual(['자기력', '자기장', '자기력선', '투자율', '강자성', 'N극과 S극의 세기']);
    expect(e.tutor.forbiddenAnswers).toHaveLength(6);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['gapCm', 'between']);
  });

  it('물체의 운동 매니페스트의 변인, 측정, 금지 구절, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(motionJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g6-motion', 6, 'physics', ['6과10-01', '6과10-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('ramp-cart');
    expect(e.safety).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['heightCm', 'floor', 'load']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual([10, 20, 40]);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual(['wood', 'towel']);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual([0, 2]);
    expect(e.variables.map((v) => v.default)).toEqual([20, 'wood', 0]);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['timeS', '초'], ['speed', 'm/s']]);
    expect(e.params).toEqual({ durationS: 1.2 });
    expect(e.limits).toEqual(['가속도', '운동 에너지', '위치 에너지', '에너지 보존', '마찰 계수', '관성']);
    expect(e.tutor.forbiddenAnswers).toHaveLength(9);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['heightCm', 'load']);
  });

  it('물의 상태 변화 매니페스트의 변인, 측정, 안전, 금지 구절, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(waterStateJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-water-state', 4, 'matter', ['4과10-01', '4과10-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('freeze-melt');
    expect(e.safety).toEqual(['cold']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {}).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.variables.map((v) => v.key)).toEqual(['process', 'startMl', 'tube']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual(['freeze', 'melt']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([10, 20]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['glass', 'plastic']);
    expect(e.variables.map((v) => v.default)).toEqual(['freeze', 10, 'glass']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['dV', 'mL'], ['volumeEnd', 'mL']]);
    expect(e.params).toEqual({ totalMin: 30 });
    expect(e.limits).toEqual(['밀도', '분자', '수소 결합', '잠열', '응고점', '녹는점']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['process', 'tube']);
  });

  it('혼합물의 분리 매니페스트의 변인, 측정, 안전, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(mixtureJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g5-mixture', 5, 'matter', ['6과05-01', '6과05-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('salt-sand');
    expect(e.safety).toEqual(['heat']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {}).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.variables.map((v) => v.key)).toEqual(['waterMl', 'filter', 'stirrer']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual([20, 50]);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual(['paper', 'pour']);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['glass', 'wood']);
    expect(e.variables.map((v) => v.default)).toEqual([50, 'paper', 'glass']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['salt', 'g'], ['sand', 'g']]);
    expect(e.params).toEqual({ totalMin: 20 });
    expect(e.limits).toEqual(['순도', '포화 용액', '재결정', '용해도 곡선', '여과액']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['waterMl', 'filter']);
  });

  it('땅의 변화 두 번째 활동(흐르는 물)의 변인, 측정, 안전 없음, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(landJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-land', 4, 'earth', ['4과11-01', '4과11-02', '4과11-03']]);
    expect(m.experiments.map((x) => x.id)).toEqual(['magma-cooling', 'stream-table', 'volcano-ejecta']);
    const e = m.experiments[1] as VariableExperiment;
    expect(e.module).toBe('stream-table');
    expect(e.safety).toEqual([]);
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.safetyNotices).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['slope', 'waterL', 'vessel']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual(['gentle', 'steep']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([1, 2]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['cup', 'bottle']);
    expect(e.variables.map((v) => v.default)).toEqual(['gentle', 1, 'cup']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['eroded', 'g'], ['deposited', 'g']]);
    expect(e.params).toEqual({ totalS: 60 });
    expect(e.limits).toEqual(['침식', '퇴적', '운반', '유속', '삼각주', '선상지']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['slope', 'vessel']);
  });

  it('지구와 바다(바닷물과 강물 비교하기) 매니페스트의 변인, 측정, 안전, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(earthSeaJson);
    expect([m.id, m.title, m.grade, m.engine, m.standards]).toEqual(['g3-earth-sea', '지구와 바다', 3, 'earth', ['4과06-02', '4과06-03']]);
    expect(m.experiments.map((x) => x.id)).toEqual(['sea-water', 'tide']);
    const e = m.experiments[0] as VariableExperiment;
    expect([e.id, e.module]).toEqual(['sea-water', 'sea-water']);
    expect(e.safety).toEqual(['heat', 'taste']);
    expect(e.safetyChecklist).toEqual(['보안경을 썼어요.', '가열하는 증발 접시는 맨손으로 만지지 않아요.', '알코올램프 주변에 종이를 두지 않았어요.']);
    expect(Object.keys(e.safetyMessages ?? {}).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.variables.map((v) => v.key)).toEqual(['water', 'volumeMl', 'dish']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual(['river', 'sea']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([50, 100]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['round', 'square']);
    expect(e.variables.map((v) => v.default)).toEqual(['river', 50, 'round']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['residue', 'g'], ['dryMin', '분']]);
    expect(e.params).toEqual({ totalMin: 20 });
    expect(e.limits).toEqual(['염분', '염화 나트륨', '용질', '용매', '농도', '밀도', '퍼밀']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['water', 'volumeMl', 'dish']);
    expect(['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'].every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    for (const f of ['바닷물에는 소금이 녹아 있', '바닷물에는 소금이 들어 있', '바닷물에 소금이 녹아', '바닷물을 증발시키면 소금이 남', '바닷물은 하얀 가루가 남', '강물에는 소금이 거의 없', '강물은 아무것도 남지 않', '물이 많을수록 가루가 많이', '물을 많이 부을수록', '접시 모양은 관계없', '접시 모양은 상관없', '접시 모양은 영향이 없']) {
      expect(e.tutor.forbiddenAnswers, f).toContain(f);
    }
  });

  const WHENS = ['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch'];

  it('힘과 우리 생활 활동 2(지레와 빗면으로 들어 올리기)의 변인, 측정, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(forceJson);
    expect(m.experiments.map((x) => x.id)).toEqual(['lever-balance', 'lever-lift']);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question, e.predictionPrompt]).toEqual(['lever-lift', 'lever-lift', '지레와 빗면으로 들어 올리기', '도구를 쓰면 물체를 들어 올리는 힘이 어떻게 달라질까?', '예측: 용수철저울의 눈금은?']);
    expect(e.safety).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['tool', 'armCm', 'color']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([['none', 'lever', 'ramp'], ['short', 'mid', 'long'], ['red', 'blue']]);
    expect(e.variables.map((v) => v.default)).toEqual(['none', 'short', 'red']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['force', 'g'], ['pullCm', 'cm']]);
    expect(e.gateway).toEqual({ mode: 'open', requirePrediction: true, requireSingleIV: true });
    expect(e.limits).toEqual(['일의 원리', '에너지', '돌림힘', '모멘트', '마찰력', '뉴턴']);
    for (const f of ['받침점에서 멀수록 힘이 적', '손이 받침점에서 멀수록', '빗면이 길수록 힘이 적', '빗면이 완만할수록', '지레를 쓰면 힘이 덜', '빗면을 쓰면 힘이 덜', '힘은 적게 드는 대신 더 많이 당', '색깔은 관계없', '색깔은 상관없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['tool', 'armCm', 'color']);
    // 첫 활동은 그대로다.
    expect((m.experiments[0] as VariableExperiment).variables.map((v) => v.key)).toEqual(['count', 'distance', 'shape']);
  });

  it('소리의 성질 활동 2(소리 나는 물체의 떨림)의 변인, 측정, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(soundJson);
    expect(m.experiments.map((x) => x.id)).toEqual(['string-sound', 'sound-vibration']);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question, e.predictionPrompt]).toEqual(['sound-vibration', 'sound-vibration', '소리 나는 물체의 떨림', '소리가 나는 물체에는 어떤 공통점이 있을까?', '예측: 좁쌀이 튄 높이는?']);
    expect(e.safety).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['sound', 'loud', 'object', 'seed']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([['off', 'on'], ['weak', 'strong'], ['drum', 'fork', 'speaker'], ['yellow', 'white']]);
    expect(e.variables.map((v) => v.default)).toEqual(['off', 'weak', 'drum', 'yellow']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['bounce', 'mm'], ['level', '눈금']]);
    expect(e.limits).toEqual(['진동수', '진폭', '파동', '헤르츠', '데시벨']);
    for (const f of ['소리가 나는 물체는 떨', '소리 나는 물체는 모두 떨', '소리를 멈추면 떨림이 멈', '떨림이 멈추면 소리', '세게 칠수록 많이 떨', '떨림이 클수록 소리가 크', '좁쌀 색은 관계없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['sound', 'loud', 'object', 'seed']);
    expect((m.experiments[0] as VariableExperiment).variables.map((v) => v.key)).toEqual(['strength', 'lengthCm', 'color']);
  });

  it('자석의 이용 활동 2(자석과 자석 사이)의 변인, 범주 결과, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(magnetJson);
    expect(m.experiments.map((x) => x.id)).toEqual(['magnet-distance', 'magnet-poles']);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question, e.predictionPrompt]).toEqual(['magnet-poles', 'magnet-poles', '자석과 자석 사이', '자석과 자석을 가까이 하면 어떤 일이 생길까?', '예측: 오른쪽 자석이 움직인 거리는?']);
    expect(e.safety).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['facing', 'gapCm', 'size', 'cover']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([['NN', 'NS', 'SS'], [1, 2, 4], ['small', 'large'], ['color', 'gray']]);
    expect(e.variables.map((v) => v.default)).toEqual(['NS', 1, 'small', 'color']);
    // 움직임은 범주 결과 칸이라 단위가 없다(전자석의 "못 머리 쪽의 극"과 같다).
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['motion', ''], ['moveCm', 'cm']]);
    expect(e.limits).toEqual(['자기장', '자기력선', '테슬라', '인력', '척력']);
    for (const f of ['같은 극끼리 밀', '같은 극끼리는 밀어', '다른 극끼리 끌', '다른 극끼리는 끌어', '가까울수록 세게', '멀수록 약해', '색칠은 관계없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['facing', 'gapCm', 'size', 'cover']);
    expect((m.experiments[0] as VariableExperiment).variables.map((v) => v.key)).toEqual(['gapCm', 'magnets', 'between']);
  });

  it('용해와 용액 활동 2(용액의 진하기 비교하기)의 변인, 측정, 안전, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(manifestJson);
    expect([m.id, m.engine, m.standards]).toEqual(['g5-solution', 'matter', ['6과03-01', '6과03-02']]);
    expect(m.experiments.map((x) => x.id)).toEqual(['dissolve-amount', 'concentration']);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question, e.predictionPrompt]).toEqual(['concentration', 'concentration', '용액의 진하기 비교하기', '녹인 설탕의 양이 다르면 용액의 진하기를 어떻게 비교할 수 있을까?', '예측: 방울토마토가 뜬 높이는?']);
    expect(e.safety).toEqual(['taste']);
    expect(e.variables.map((v) => v.key)).toEqual(['spoons', 'waterMl', 'sugar', 'cup']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([[1, 3, 5], [50, 100], ['brown', 'white'], ['low', 'high']]);
    expect(e.variables.map((v) => v.default)).toEqual([1, 100, 'brown', 'low']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['float', '눈금'], ['mass20', 'g'], ['color', '눈금']]);
    expect(e.gateway).toEqual({ mode: 'open', requirePrediction: true, requireSingleIV: true });
    expect(e.limits).toEqual(['농도', '퍼센트', '밀도', '용해도', '포화', '부력']);
    for (const f of ['설탕을 많이 넣을수록 진', '설탕이 많을수록 진', '물이 많을수록 연', '물을 많이 넣을수록 연', '진할수록 방울토마토가 높이', '진할수록 높이 떠', '흰 설탕은 색으로 비교할 수 없', '비커 모양은 관계없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['spoons', 'waterMl', 'sugar', 'cup']);
    // 첫 활동은 그대로다.
    expect((m.experiments[0] as VariableExperiment).variables.map((v) => v.key)).toEqual(['solute', 'waterMl', 'waterTempC', 'stir']);
  });

  it('열과 우리 생활 활동 2(온도가 다른 두 물이 닿으면)의 변인, 측정, 안전, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(heatJson);
    expect([m.id, m.engine, m.standards]).toEqual(['g5-heat', 'physics', ['6과07-02', '6과07-04']]);
    expect(m.experiments.map((x) => x.id)).toEqual(['insulated-cup', 'heat-contact']);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question, e.predictionPrompt]).toEqual(['heat-contact', 'heat-contact', '온도가 다른 두 물이 닿으면', '온도가 다른 두 물체가 닿아 있으면 온도가 어떻게 변할까?', '예측: 10분 뒤 안쪽 컵 물의 온도는?']);
    expect(e.safety).toEqual(['hot-water']);
    // 뜨거운 물 점검표는 첫 활동(보온 컵)과 같다.
    expect(e.safetyChecklist).toEqual((m.experiments[0] as VariableExperiment).safetyChecklist);
    expect(e.variables.map((v) => v.key)).toEqual(['hotC', 'coldMl', 'cup', 'label']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([[50, 60, 70], [100, 300], ['metal', 'plastic'], ['yellow', 'green']]);
    expect(e.variables.map((v) => v.default)).toEqual([60, 100, 'metal', 'yellow']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['inner10', '°C'], ['outer10', '°C'], ['sameMin', '분']]);
    expect(e.limits).toEqual(['열평형', '비열', '열량', '칼로리', '전도']);
    for (const f of ['열이 이동', '열이 옮겨', '열이 전달', '따뜻한 쪽에서 차가운 쪽으로', '두 온도가 같아질 때까지', '온도가 같아져', '찬물이 많을수록 더 낮아', '이름표 색은 관계없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['hotC', 'coldMl', 'cup', 'label']);
    expect((m.experiments[0] as VariableExperiment).variables.map((v) => v.key)).toEqual(['wrap', 'layers', 'lid', 'waterMl']);
  });

  it('산과 염기 활동 2(산성 용액과 염기성 용액 섞기)의 변인, 범주 결과, 안전, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(acidBaseJson);
    expect([m.id, m.engine, m.standards]).toEqual(['g6-acid-base', 'matter', ['6과09-01', '6과09-02']]);
    expect(m.experiments.map((x) => x.id)).toEqual(['indicator-classify', 'acid-base-mix']);
    // 첫 활동은 분류 활동이다.
    expect(isVariableExperiment(m.experiments[0]!)).toBe(false);
    expect(isVariableExperiment(m.experiments[1]!)).toBe(true);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question, e.predictionPrompt]).toEqual(['acid-base-mix', 'acid-base-mix', '산성 용액과 염기성 용액 섞기', '산성 용액에 염기성 용액을 조금씩 넣으면 용액의 성질은 어떻게 변할까?', '예측: 색 띠에서 지시약 색의 자리는?']);
    expect(e.safety).toEqual(['goggles', 'gloves', 'corrosive']);
    // 보안경·장갑 점검표는 첫 활동과 같다.
    expect(e.safetyChecklist).toEqual((m.experiments[0] as { safetyChecklist?: string[] }).safetyChecklist);
    expect(e.variables.map((v) => v.key)).toEqual(['drops', 'direction', 'indicator', 'beaker']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([[0, 10, 20, 30, 40], ['acid', 'base'], ['cabbage', 'phenol'], [50, 100]]);
    expect(e.variables.map((v) => v.default)).toEqual([0, 'acid', 'cabbage', 50]);
    // 지시약 색은 범주 결과 칸이라 단위가 없다(전자석의 "못 머리 쪽의 극"과 같다).
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['color', ''], ['addedMl', 'mL'], ['slot', '칸']]);
    expect(e.limits).toEqual(['pH', '수소 이온', '수산화 이온', '몰', '중화열', '염']);
    for (const f of ['중화', '중성이 되', '산성이 약해', '염기성이 약해', '산성이 점점 약해', '염기성으로 변', '비커 크기는 관계없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['drops', 'direction', 'indicator', 'beaker']);
  });

  it('물체의 운동 활동 2(시간에 따른 위치 변화)의 변인, 측정, 안전 없음, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(motionJson);
    expect([m.id, m.engine, m.standards]).toEqual(['g6-motion', 'physics', ['6과10-01', '6과10-02']]);
    expect(m.experiments.map((x) => x.id)).toEqual(['ramp-cart', 'position-time']);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question, e.predictionPrompt]).toEqual(['position-time', 'position-time', '시간에 따른 위치 변화', '어떤 물체가 운동했는지 어떻게 알 수 있을까?', '예측: 관찰하는 동안 물체가 움직인 거리는?']);
    expect(e.safety).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['object', 'watchS', 'weather']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([['bike', 'walker', 'snail', 'tree'], [5, 10], ['sunny', 'cloudy']]);
    expect(e.variables.map((v) => v.default)).toEqual(['bike', 5, 'sunny']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['distM', 'm'], ['endM', 'm']]);
    expect(e.gateway).toEqual({ mode: 'open', requirePrediction: true, requireSingleIV: true });
    expect(e.limits).toEqual(['속도', '가속도', '변위', '등속', '벡터']);
    for (const f of ['위치가 변하면 운동', '위치가 변하지 않으면 운동하지 않', '나무는 운동하지 않', '달팽이도 운동', '날씨는 관계없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['object', 'watchS', 'weather']);
    // 첫 활동은 그대로다.
    expect((m.experiments[0] as VariableExperiment).variables.map((v) => v.key)).toEqual(['heightCm', 'floor', 'load']);
  });

  it('물질의 연소 활동 2(연소 전과 후 비교하기)의 변인, 범주 결과, 안전, 한계 용어, 금지 구절, 탐침을 읽는다', () => {
    const m = parseManifest(combustionJson);
    expect([m.id, m.engine, m.standards]).toEqual(['g6-combustion', 'matter', ['6과14-01', '6과14-02', '6과14-03']]);
    expect(m.experiments.map((x) => x.id)).toEqual(['candle-jar', 'combustion-products', 'property-change']);
    const e = m.experiments[1] as VariableExperiment;
    expect([e.id, e.module, e.title, e.question]).toEqual(['combustion-products', 'combustion-products', '연소 전과 후 비교하기', '초가 타고 난 뒤에는 어떤 물질이 생길까?']);
    expect(e.safety).toEqual(['fire', 'hot']);
    // 불 점검표와 경고 문구는 첫 활동(집기병으로 덮은 촛불)과 같다.
    const first = m.experiments[0] as VariableExperiment;
    expect(e.safetyChecklist).toEqual(first.safetyChecklist);
    expect(e.safetyMessages).toEqual(first.safetyMessages);
    expect(e.variables.map((v) => v.key)).toEqual(['burnMin', 'test', 'jar']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([[0, 1, 3], ['paper', 'limewater'], ['clear', 'blue']]);
    expect(e.variables.map((v) => v.default)).toEqual([0, 'paper', 'clear']);
    // 검사 결과는 범주 결과 칸이라 단위가 없다(전자석의 "못 머리 쪽의 극"과 같다).
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['result', ''], ['cloud', '눈금'], ['shorterMm', 'mm'], ['stage', '단계']]);
    expect(e.limits).toEqual(['산화', '탄화수소', '화학 반응식', '수증기 응결']);
    for (const f of ['물이 생겨', '물이 생긴', '이산화 탄소가 생겨', '이산화 탄소가 생긴', '물과 이산화 탄소', '집기병 색은 관계없']) expect(e.tutor.forbiddenAnswers, f).toContain(f);
    expect(WHENS.every((w) => e.tutor.probes.some((p) => p.when === w))).toBe(true);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['burnMin', 'test', 'jar']);
    expect(first.variables.map((v) => v.key)).toEqual(['jarMl', 'candle', 'candleCount', 'candleColor']);
  });

  it('날씨와 우리 생활 매니페스트의 변인, 측정, 안전, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(weatherJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g5-weather', 5, 'earth', ['6과06-02', '6과06-03']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('land-sea-breeze');
    expect(e.safety).toEqual(['heat', 'fire']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages ?? {}).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.safetyNotices).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['phase', 'lampCm', 'bowl']);
    expect(e.variables[0]!.options.map((o) => o.value)).toEqual(['day', 'night']);
    expect(e.variables[1]!.options.map((o) => o.value)).toEqual([20, 40]);
    expect(e.variables[2]!.options.map((o) => o.value)).toEqual(['plastic', 'glass']);
    expect(e.variables.map((v) => v.default)).toEqual(['day', 20, 'plastic']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['diff', '°C'], ['sand', '°C'], ['water', '°C']]);
    expect(e.params).toEqual({ totalMin: 10 });
    expect(e.limits).toEqual(['비열', '대류', '해풍', '육풍', '기압 경도력', '열용량']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['phase', 'bowl']);
  });

  it('감염병과 건강한 생활 매니페스트의 변인, 측정, 안전 없음, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(healthJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g3-health', 3, 'ssi', ['4과08-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('infection-spread');
    expect(e.safety).toEqual([]);
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.safetyNotices).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['wash', 'mask', 'contacts', 'seat']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([['rarely', 'often'], ['off', 'on'], [4, 8], ['front', 'back']]);
    expect(e.variables.map((v) => v.default)).toEqual(['rarely', 'off', 4, 'front']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['total', '명'], ['peak', '명']]);
    expect(e.params).toEqual({ days: 20 });
    expect(e.limits).toEqual(['기초 감염 재생산수', '잠복기', '치명률', '집단 면역', '백신 효능']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['contacts', 'seat']);
  });

  it('기후변화와 우리 생활 매니페스트의 변인, 측정, 안전, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(climateJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-climate', 4, 'ssi', ['4과16-01', '4과16-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('greenhouse-bottle');
    expect(e.safety).toEqual(['heat']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages!).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.safetyNotices).toEqual([]);
    expect(e.variables.map((v) => v.key)).toEqual(['cover', 'air', 'cap']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([['none', 'film'], ['normal', 'co2'], ['white', 'blue']]);
    expect(e.variables.map((v) => v.default)).toEqual(['none', 'normal', 'white']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['rise', '°C'], ['temp', '°C']]);
    expect(e.params).toEqual({ totalMin: 20 });
    expect(e.limits).toEqual(['복사 평형', '적외선 흡수', '복사 강제력', '탄소 순환', 'ppm']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['air', 'cap']);
  });

  it('자원과 에너지 매니페스트의 변인, 측정, 안전, 한계 용어, 탐침을 읽는다', () => {
    const m = parseManifest(energyJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g5-energy', 5, 'ssi', ['6과08-02']]);
    const e = m.experiments[0] as VariableExperiment;
    expect(e.module).toBe('solar-panel');
    expect(e.safety).toEqual(['sun']);
    expect(e.safetyChecklist).toHaveLength(3);
    expect(Object.keys(e.safetyMessages!).sort()).toEqual(['FOOD', 'NO_GLOVES', 'NO_GOGGLES', 'SPILL']);
    expect(e.variables.map((v) => v.key)).toEqual(['tilt', 'weather', 'shade', 'frame']);
    expect(e.variables.map((v) => v.options.map((o) => o.value))).toEqual([[0, 30, 60], ['sunny', 'cloudy'], ['none', 'half'], ['black', 'silver']]);
    expect(e.variables.map((v) => v.default)).toEqual([0, 'sunny', 'none', 'black']);
    expect(e.dependent.map((d) => [d.key, d.unit])).toEqual([['power', 'mW'], ['turns', '번']]);
    expect(e.params).toEqual({ totalS: 60, sunAltDeg: 60 });
    expect(e.limits).toEqual(['효율', '입사각', '일사량', '광전 효과', '바이패스 다이오드']);
    expect(e.tutor.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['tilt', 'frame']);
  });

  it('두 필드는 없어도 된다', () => {
    const e = parseManifest(gasesJson).experiments[0] as VariableExperiment;
    expect(e.safetyChecklist).toBeUndefined();
    expect(e.safetyMessages).toBeUndefined();
  });

  it('잘못된 모양은 거부한다', () => {
    const emptyItem = clone(combustionJson);
    emptyItem.experiments[0].safetyChecklist = [''];
    expect(() => parseManifest(emptyItem)).toThrow(ManifestError);
    const notArray = clone(combustionJson);
    notArray.experiments[0].safetyChecklist = '확인';
    expect(() => parseManifest(notArray)).toThrow(ManifestError);
    const badMsg = clone(combustionJson);
    badMsg.experiments[0].safetyMessages = { NO_GOGGLES: 3 };
    expect(() => parseManifest(badMsg)).toThrow(ManifestError);
  });
});

describe('관찰 활동 (sky-observation)', () => {
  const clone = (j: unknown) => JSON.parse(JSON.stringify(j));
  const e = parseManifest(earthJson).experiments[0]!;

  it('지구의 운동 매니페스트가 검증을 통과하고 관찰 활동으로 판별된다', () => {
    expect(isObservationExperiment(e)).toBe(true);
    expect(isVariableExperiment(e)).toBe(false);
    expect(isClassificationExperiment(e)).toBe(false);
    const o = e as ObservationExperiment;
    expect(o.tasks.map((t) => t.id)).toEqual(['sun-path', 'day-night', 'star-path', 'season-stars', 'winter-stars']);
    expect(o.tasks.map((t) => t.view)).toEqual(['rotation', 'rotation', 'rotation', 'revolution', 'revolution']);
    expect(o.tasks.map((t) => t.answer)).toEqual([
      'sun-path-direction', 'antipode-day-night', 'star-path-direction', 'constellation-changes', 'winter-constellation',
    ]);
    for (const t of o.tasks) expect(t.probes.map((p) => p.when).sort()).toEqual(
      ['before-observe', 'observing', 'prediction-mismatch', 'record-match', 'record-mismatch'],
    );
    expect(o.tutor.probes).toEqual([]);
    expect(o.params).toEqual({ latDeg: 37.5 });
  });

  it('기존 활동 유형은 관찰 활동으로 판별되지 않는다', () => {
    expect(isObservationExperiment(parseManifest(acidBaseJson).experiments[0]!)).toBe(false);
    expect(isObservationExperiment(parseManifest(manifestJson).experiments[0]!)).toBe(false);
    expect(isVariableExperiment(parseManifest(landJson).experiments[0]!)).toBe(true);
  });

  it('잘못된 관찰 활동을 거부한다', () => {
    const edit = (fn: (x: any) => void) => {
      const c = clone(earthJson);
      fn(c.experiments[0]);
      return c;
    };
    expect(() => parseManifest(edit((x) => { x.tasks[0].answer = 'nope'; }))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { x.tasks[0].view = 'orbit'; }))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { x.tasks[1].options = [x.tasks[1].options[0]]; }))).toThrow(ManifestError);
    expect(() =>
      parseManifest(edit((x) => { x.tasks[3].options = Array.from({ length: 6 }, (_, i) => ({ value: `v${i}`, label: `v${i}` })); })),
    ).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { x.tasks[0].controls[0].default = 'sideways'; }))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { x.tasks[0].probes[0].when = 'before-run'; }))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { x.tasks = []; }))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { delete x.tasks; }))).toThrow(ManifestError);
  });

  it('밤하늘 관찰 매니페스트: 과제 6개(달 모양 과제 둘은 기존 넷 뒤), 새 보기 셋, 새 정답 규칙 여섯, 선택지 value는 문자열', () => {
    const m = parseManifest(nightSkyJson);
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-night-sky', 4, 'earth', ['4과13-01', '4과13-02', '4과13-03']]);
    const o = m.experiments[0] as ObservationExperiment;
    expect(isObservationExperiment(o)).toBe(true);
    expect([o.id, o.module, o.params]).toEqual(['night-sky', 'sky-observation', { latDeg: 37.5 }]);
    expect(o.tasks.map((t) => t.id)).toEqual(['planet-size', 'planet-distance', 'find-polaris', 'polaris-still', 'moon-change', 'full-moon']);
    expect(o.tasks.map((t) => t.view)).toEqual(['solar-system', 'solar-system', 'north-sky', 'north-sky', 'moon', 'moon']);
    expect(o.tasks.map((t) => t.answer)).toEqual(['jupiter-earth-size', 'neptune-distance', 'pointer-star-target', 'polaris-motion', 'moon-evening-change', 'full-moon-day']);
    expect(o.tasks.map((t) => t.options.map((x) => x.value))).toEqual([
      ['2', '5', '11', '50'],
      ['3', '10', '30', '100'],
      ['polaris', 'kochab', 'capella', 'vega'],
      ['nearly-still', 'east-to-west', 'west-to-east'],
      ['waxes-east', 'wanes-west', 'same'],
      ['3', '8', '15', '22'],
    ]);
    for (const t of o.tasks) {
      for (const x of t.options) expect(typeof x.value).toBe('string');
      expect(t.probes.map((p) => p.when).sort()).toEqual(
        ['before-observe', 'observing', 'prediction-mismatch', 'record-match', 'record-mismatch'],
      );
    }
    expect(o.tasks.map((t) => (t.controls ?? []).map((c) => c.key))).toEqual([['compare'], ['compare'], [], ['rotation'], [], []]);
    expect(o.tasks.map((t) => (t.controls ?? []).map((c) => c.default))).toEqual([['size'], ['distance'], [], ['forward'], [], []]);
    expect(o.limits).toEqual(['천구', '적경', '적위', '광년', '천문단위', '등급', '세차 운동', '위상', '이각', '삭망월', '황도']);
    expect(o.tutor.probes).toEqual([]);
  });

  it('새 보기와 규칙 이름은 받아들이고 그 밖의 이름은 거부한다', () => {
    const edit = (fn: (x: any) => void) => {
      const c = clone(nightSkyJson);
      fn(c.experiments[0]);
      return c;
    };
    expect(observationAnswerSchema.options).toEqual([
      'sun-path-direction', 'antipode-day-night', 'star-path-direction', 'constellation-changes', 'winter-constellation',
      'jupiter-earth-size', 'neptune-distance', 'pointer-star-target', 'polaris-motion',
      'moon-evening-change', 'full-moon-day', 'tide-highs-per-day', 'low-tide-exposed',
    ]);
    expect(() => parseManifest(edit((x) => { x.tasks[0].view = 'moon-phase'; }))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { x.tasks[0].answer = 'moon-phase'; }))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => { x.tasks[2].view = 'north-sky'; x.tasks[2].answer = 'polaris-motion'; }))).not.toThrow();
    expect(() => parseManifest(edit((x) => { x.tasks[0].view = 'moon'; x.tasks[0].answer = 'moon-evening-change'; }))).not.toThrow();
    expect(() => parseManifest(edit((x) => { x.tasks[0].view = 'tide'; x.tasks[0].answer = 'tide-highs-per-day'; }))).not.toThrow();
    expect(() => parseManifest(edit((x) => { x.tasks[0].answer = 'low-tide'; }))).toThrow(ManifestError);
  });

  it('지구와 바다 활동 2(밀물과 썰물 관찰하기)는 관찰 활동이고, 과제 둘이 tide 보기와 새 규칙 둘을 쓴다', () => {
    const m = parseManifest(earthSeaJson);
    const o = m.experiments[1] as ObservationExperiment;
    expect([o.id, o.module, o.title]).toEqual(['tide', 'sky-observation', '밀물과 썰물 관찰하기']);
    expect(o.question).toBe('바닷가의 바닷물 높이는 하루 동안 어떻게 달라질까?');
    expect(o.tasks.map((t) => [t.id, t.view, t.answer])).toEqual([
      ['tide-count', 'tide', 'tide-highs-per-day'],
      ['tide-flat', 'tide', 'low-tide-exposed'],
    ]);
    expect(o.tasks.map((t) => t.options.map((x) => x.value))).toEqual([['1', '2', '4'], ['mudflat', 'nothing', 'desert']]);
    for (const t of o.tasks) expect(t.probes.map((p) => p.when).sort()).toEqual(['before-observe', 'observing', 'prediction-mismatch', 'record-match', 'record-mismatch']);
    expect(o.limits).toEqual(['조석', '만조', '간조', '조차', '기조력', '인력', '반일주조']);
    expect(o.tutor.probes).toEqual([]);
  });
});

describe('카드 분류 활동 (card-sort)', () => {
  const clone = (j: unknown) => JSON.parse(JSON.stringify(j));
  const e = parseManifest(animalJson).experiments[0]!;

  it('동물의 생활 매니페스트가 검증을 통과하고 카드 분류 활동으로 판별된다', () => {
    expect(e.module).toBe('card-sort');
    expect(isCardSortExperiment(e)).toBe(true);
    expect(isVariableExperiment(e)).toBe(false);
    expect(isClassificationExperiment(e)).toBe(false);
    expect(isObservationExperiment(e)).toBe(false);
    const c = e as CardSortExperiment;
    expect(c.layout).toBe('groups');
    expect(c.features.map((f) => f.key)).toEqual(['habitat', 'legs', 'wings']);
    expect(c.criteria.map((x) => x.key)).toEqual(['habitat', 'legs', 'wings', 'cute']);
    expect(c.cards).toHaveLength(8);
    expect(c.safetyChecklist).toEqual([]);
    expect(c.tutor.probes.map((p) => p.when).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
    );
  });

  it('모르는 layout을 거부한다', () => {
    const bad = clone(animalJson);
    bad.experiments[0].layout = 'grid';
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('식물의 생활 매니페스트가 tree 배치로 검증을 통과한다', () => {
    const t = parseManifest(plantlifeJson).experiments[0] as CardSortExperiment;
    expect(isCardSortExperiment(t)).toBe(true);
    expect(t.layout).toBe('tree');
    expect(t.id).toBe('leaf-tree');
    expect(t.cards.map((c) => c.icon)).toEqual(['maple', 'chrysanthemum', 'cherry', 'camellia', 'persimmon', 'lilac', 'iris', 'lily']);
    expect(t.tutor.probes.map((p) => p.when).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting', 'tree-next-node', 'tree-split-empty'],
    );
  });

  it('tree에서 예/아니요가 아닌 무리를 거부한다', () => {
    const three = clone(plantlifeJson);
    three.experiments[0].criteria[0].groups.push({ value: 'maybe', label: '모르겠다' });
    expect(() => parseManifest(three)).toThrow(ManifestError);
    const renamed = clone(plantlifeJson);
    renamed.experiments[0].criteria[1].groups[0].value = 'serrated';
    expect(() => parseManifest(renamed)).toThrow(ManifestError);
    const swapped = clone(plantlifeJson);
    swapped.experiments[0].criteria[2].groups.reverse();
    expect(() => parseManifest(swapped)).toThrow(ManifestError);
    // 주관 기준도 같은 규칙이다.
    const subjective = clone(plantlifeJson);
    subjective.experiments[0].criteria[3].groups = [{ value: 'good', label: '예쁘다' }, { value: 'bad', label: '예쁘지 않다' }];
    expect(() => parseManifest(subjective)).toThrow(ManifestError);
    // groups 배치는 이 제한을 받지 않는다(동물의 생활은 세 무리 기준이 있다).
    expect(() => parseManifest(animalJson)).not.toThrow();
  });

  it('판별 합집합이 module로 갈라진다: 다른 유형의 필드로는 통과하지 못한다', () => {
    const noCards = clone(animalJson);
    delete noCards.experiments[0].cards;
    expect(() => parseManifest(noCards)).toThrow(ManifestError);
    const asClassify = clone(animalJson);
    asClassify.experiments[0].module = 'indicator-classify';
    expect(() => parseManifest(asClassify)).toThrow(ManifestError);
    const badProbe = clone(animalJson);
    badProbe.experiments[0].tutor.probes[0].when = 'before-test';
    expect(() => parseManifest(badProbe)).toThrow(ManifestError);
  });
});

describe('카드 분류 순서 놓기 (layout: order)', () => {
  const clone = (j: unknown) => JSON.parse(JSON.stringify(j));
  const edit = (fn: (x: any) => void) => {
    const m = clone(strataJson);
    fn(m.experiments[0]);
    return m;
  };
  const t = parseManifest(strataJson).experiments[0] as CardSortExperiment;

  it('지층과 화석 매니페스트가 검증을 통과한다', () => {
    expect(isCardSortExperiment(t)).toBe(true);
    expect(t.layout).toBe('order');
    expect(t.orderBy).toEqual({ feature: 'height', direction: 'ascending' });
    expect(t.initialOrder).toEqual(['shale', 'sandstone', 'conglomerate', 'limestone', 'mudstone']);
    expect(t.followUp?.evidenceFeature).toBe('fossil');
    expect(t.criteria).toEqual([]);
    expect(typeof t.cards[0]!.features.height).toBe('number');
  });

  it('initialOrder 누락을 거부한다', () => {
    expect(() => parseManifest(edit((x) => delete x.initialOrder))).toThrow(ManifestError);
  });
  it('initialOrder의 중복·누락·모르는 카드를 거부한다', () => {
    expect(() => parseManifest(edit((x) => (x.initialOrder = ['shale', 'shale', 'conglomerate', 'limestone', 'mudstone'])))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => x.initialOrder.pop()))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => (x.initialOrder[0] = 'granite')))).toThrow(ManifestError);
  });
  it('orderBy 누락, 모르는 특징, 숫자가 아닌 값을 거부한다', () => {
    expect(() => parseManifest(edit((x) => delete x.orderBy))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => (x.orderBy.feature = 'weight')))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => (x.cards[1].features.height = '1.5')))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => (x.orderBy.direction = 'sideways')))).toThrow(ManifestError);
  });
  it('followUp은 선택이지만 있으면 객관적 기준이어야 한다', () => {
    expect(() => parseManifest(edit((x) => delete x.followUp))).not.toThrow();
    expect(() => parseManifest(edit((x) => (x.followUp.objective = false)))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => delete x.followUp.feature))).toThrow(ManifestError);
  });
  it('order가 아니면 orderBy·initialOrder·followUp을 거부하고 기준이 1개 이상 있어야 한다', () => {
    const tree = clone(plantlifeJson);
    tree.experiments[0].orderBy = { feature: 'serrated', direction: 'ascending' };
    expect(() => parseManifest(tree)).toThrow(ManifestError);
    const noCriteria = clone(animalJson);
    noCriteria.experiments[0].criteria = [];
    expect(() => parseManifest(noCriteria)).toThrow(ManifestError);
  });
  it('probe when에 order-check-* 네 가지가 있다', () => {
    const whens = t.tutor.probes.map((p) => p.when);
    for (const w of ['order-check-unplaced', 'order-check-unobserved', 'order-check-inconsistent', 'order-check-complete']) expect(whens).toContain(w);
    expect(() => parseManifest(edit((x) => (x.tutor.probes[0].when = 'order-check-zzz')))).toThrow(ManifestError);
  });
  it('특징값 숫자를 허용해도 빈 문자열은 거부한다(기존 단원은 문자열 그대로)', () => {
    expect(() => parseManifest(edit((x) => (x.cards[0].features.grain = '')))).toThrow(ManifestError);
    const animal = parseManifest(animalJson).experiments[0] as CardSortExperiment;
    expect(animal.cards.every((c) => Object.values(c.features).every((v) => typeof v === 'string'))).toBe(true);
  });
  it('안내 문구와 배경 지식은 선택 필드이고 빈 문자열을 거부한다', () => {
    expect(() => parseManifest(edit((x) => { delete x.notice; delete x.background; }))).not.toThrow();
    expect(() => parseManifest(edit((x) => (x.notice = '')))).toThrow(ManifestError);
    expect(() => parseManifest(edit((x) => (x.background.text = '')))).toThrow(ManifestError);
  });
});
