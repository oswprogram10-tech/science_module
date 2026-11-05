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
import animalJson from '../../../content/units/g3-animal/manifest.json';
import plantlifeJson from '../../../content/units/g3-plantlife/manifest.json';
import earthJson from '../../../content/units/g6-earth-motion/manifest.json';
import {
  ManifestError,
  isCardSortExperiment,
  isClassificationExperiment,
  isObservationExperiment,
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
    for (const j of [manifestJson, gasesJson, acidBaseJson, combustionJson, heatJson, lightJson, electricityJson, landJson, seasonsJson, lifecycleJson, plantJson, ecosystemJson, microbeJson, bodyJson, forceJson, soundJson, magnetJson, motionJson]) expect(() => parseManifest(j)).not.toThrow();
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-land', 4, 'earth', ['4과11-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g6-seasons', 6, 'earth', ['6과13-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g3-lifecycle', 3, 'life', ['4과04-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g6-plant', 6, 'life', ['6과11-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-ecosystem', 4, 'life', ['4과14-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g5-body', 5, 'life', ['6과04-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g3-force', 3, 'physics', ['4과01-02']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g3-sound', 3, 'physics', ['4과08-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g4-magnet', 4, 'physics', ['4과09-01']]);
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
    expect([m.id, m.grade, m.engine, m.standards]).toEqual(['g6-motion', 6, 'physics', ['6과02-02']]);
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
    bad.experiments[0].layout = 'order';
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
