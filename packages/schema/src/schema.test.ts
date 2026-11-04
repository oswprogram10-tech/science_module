import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/units/g5-solution/manifest.json';
import gasesJson from '../../../content/units/g4-gases/manifest.json';
import acidBaseJson from '../../../content/units/g6-acid-base/manifest.json';
import combustionJson from '../../../content/units/g6-combustion/manifest.json';
import {
  ManifestError,
  isVariableExperiment,
  parseManifest,
  type ClassificationExperiment,
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

  it('네 매니페스트가 모두 검증을 통과한다', () => {
    for (const j of [manifestJson, gasesJson, acidBaseJson, combustionJson]) expect(() => parseManifest(j)).not.toThrow();
  });

  it('연소 매니페스트의 점검표와 경고 문구를 읽는다', () => {
    const e = parseManifest(combustionJson).experiments[0] as VariableExperiment;
    expect(e.module).toBe('candle-jar');
    expect(e.safetyChecklist).toHaveLength(3);
    expect(e.safetyMessages).toEqual({ NO_GOGGLES: '불을 다루기 전에 보안경을 먼저 착용해 주세요!' });
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
