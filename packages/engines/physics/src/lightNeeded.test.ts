import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  LN_BOXES,
  LN_FLASHLIGHTS,
  LN_OBJECTS,
  LN_TABLE,
  interpolateLightNeeded,
  simulateLightNeeded,
  validateLightNeededExperiment,
  type LightNeededParams,
  type LnBox,
  type LnFlashlight,
  type LnObject,
  type LnVisible,
} from './lightNeeded';
import lightJson from '../../../../content/units/g5-light/manifest.json';

const p = (flashlight: LnFlashlight, object: LnObject, boxColor: LnBox = 'black'): LightNeededParams => ({ flashlight, object, boxColor });

// 사양 §4 표 고정: [손전등, 물체, 밝기 눈금, 구멍으로 본 물체]
const TABLE: [LnFlashlight, LnObject, number, LnVisible][] = [
  ['off', 'doll', 0, 'hidden'],
  ['on', 'doll', 8, 'visible'],
  ['off', 'bulb', 3, 'visible'],
  ['on', 'bulb', 9, 'visible'],
];

describe('물체를 보려면 빛이 필요할까 모델: 사양 기준값 4칸 × 상자 겉 색깔 두 가지', () => {
  for (const box of LN_BOXES) {
    for (const [flashlight, object, brightness, visible] of TABLE) {
      it(`${box} 상자, 손전등 ${flashlight}, ${object}: ${brightness}눈금 ${visible}`, () => {
        expect(simulateLightNeeded(p(flashlight, object, box)).result).toEqual({ brightness, visible });
      });
    }
  }

  it('상자 겉 색깔은 모든 조건에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const f of LN_FLASHLIGHTS) for (const o of LN_OBJECTS) expect(simulateLightNeeded(p(f, o, 'white'))).toEqual(simulateLightNeeded(p(f, o, 'black')));
  });

  it('표는 정수 눈금 0~10이고, 켜진 전구는 손전등을 꺼도 보인다', () => {
    for (const o of LN_OBJECTS) for (const f of LN_FLASHLIGHTS) {
      const r = LN_TABLE[o][f];
      expect(Number.isInteger(r.brightness)).toBe(true);
      expect(r.brightness).toBeGreaterThanOrEqual(0);
      expect(r.brightness).toBeLessThanOrEqual(10);
    }
    expect(LN_TABLE.bulb.off.visible).toBe('visible');
    expect(LN_TABLE.doll.off.visible).toBe('hidden');
    // 손전등을 켜면 같은 물체의 밝기가 더 크다.
    expect(LN_TABLE.doll.on.brightness).toBeGreaterThan(LN_TABLE.doll.off.brightness);
    expect(LN_TABLE.bulb.on.brightness).toBeGreaterThan(LN_TABLE.bulb.off.brightness);
  });
});

describe('물체를 보려면 빛이 필요할까 모델: 표본', () => {
  it('0~2초 0.05초 간격 41개이고, 밝기는 0에서 시작해 1.5초 안에 결과에 이르며 그 뒤 멈춰 있다', () => {
    for (const [f, o, brightness, visible] of TABLE) {
      const { samples } = simulateLightNeeded(p(f, o));
      expect(samples).toHaveLength(41);
      expect(samples[0]).toEqual({ t: 0, level: 0, seen: 0 });
      expect(samples.at(-1)!.t).toBe(2);
      expect(samples.at(-1)!.level).toBeCloseTo(brightness, 9);
      expect(samples.at(-1)!.seen).toBe(visible === 'visible' ? 1 : 0);
      for (const s of samples.filter((x) => x.t >= 1.5)) expect(s.level).toBeCloseTo(brightness, 9);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.level - samples[i - 1]!.level).toBeGreaterThanOrEqual(-1e-9);
      // 보이지 않는 조건은 내내 깜깜하다.
      if (visible === 'hidden') expect(samples.every((s) => s.seen === 0)).toBe(true);
      expect(Math.max(...samples.map((s) => s.level))).toBeLessThanOrEqual(10);
    }
  });

  it('선형 보간', () => {
    const { samples } = simulateLightNeeded(p('on', 'doll'));
    const m = interpolateLightNeeded(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(0.225, 9);
    expect(m.level).toBeCloseTo((samples[4]!.level + samples[5]!.level) / 2, 9);
    expect(m.seen).toBeCloseTo((samples[4]!.seen + samples[5]!.seen) / 2, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateLightNeeded({ ...p('on', 'doll'), flashlight: 'dim' as never })).toThrow(RangeError);
    expect(() => simulateLightNeeded({ ...p('on', 'doll'), object: 'cat' as never })).toThrow(RangeError);
    expect(() => simulateLightNeeded({ ...p('on', 'doll'), boxColor: 'red' as never })).toThrow(RangeError);
  });
});

describe('validateLightNeededExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(lightJson.experiments[1])) as VariableExperiment;

  it('g5-light 활동 2 매니페스트는 통과한다', () => {
    expect(validateLightNeededExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'boxColor');
    expect(validateLightNeededExperiment(a).join()).toContain('"boxColor"');
    const b = exp();
    b.variables.find((v) => v.key === 'flashlight')!.options.push({ value: 'dim', label: 'x' });
    b.variables.find((v) => v.key === 'object')!.options.push({ value: 'cat', label: 'y' });
    b.variables.find((v) => v.key === 'boxColor')!.options.push({ value: 'red', label: 'z' });
    expect(validateLightNeededExperiment(b)).toHaveLength(3);
  });
});
