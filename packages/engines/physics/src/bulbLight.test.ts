import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  BL_ENDS,
  BL_SWITCHES,
  BL_WIRES,
  BS_BRIGHTNESS,
  BS_CELLS,
  batterySeriesResultOf,
  bulbLightResultOf,
  interpolateBulb,
  simulateBatterySeries,
  simulateBulbLight,
  touchesBothParts,
  validateBatterySeriesExperiment,
  validateBulbLightExperiment,
  type BlEnd,
  type BlSwitch,
  type BlWire,
  type BsCells,
} from './bulbLight';
import electricityJson from '../../../../content/units/g6-electricity/manifest.json';

const p = (plusEnd: BlEnd, minusEnd: BlEnd, sw: BlSwitch, wireColor: BlWire = 'red') => ({ plusEnd, minusEnd, switch: sw, wireColor });

describe('전구에 불 켜기 모델: 스위치가 닫히고 두 전선이 꼭지와 옆면에 닿을 때만 켜짐(밝기 6)', () => {
  it('3 × 3 × 2 × 2 = 36가지 조건 전부: 켜지는 조건은 4가지뿐이고 나머지는 밝기 0', () => {
    let lit = 0;
    for (const plus of BL_ENDS) for (const minus of BL_ENDS) for (const sw of BL_SWITCHES) for (const wire of BL_WIRES) {
      const r = simulateBulbLight(p(plus, minus, sw, wire)).result;
      const expectLit = sw === 'closed' && ((plus === 'tip' && minus === 'side') || (plus === 'side' && minus === 'tip'));
      expect(r, `${plus} ${minus} ${sw} ${wire}`).toEqual(expectLit ? { brightness: 6, lit: '켜짐' } : { brightness: 0, lit: '켜지지 않음' });
      if (r.lit === '켜짐') lit++;
    }
    expect(lit).toBe(4);
  });

  it('꼭지와 옆면을 함께 쓰는 두 방향(전지 극을 바꿔도)만 서로 다른 부분이다', () => {
    expect(touchesBothParts('tip', 'side')).toBe(true);
    expect(touchesBothParts('side', 'tip')).toBe(true);
    for (const [a, b] of [['tip', 'tip'], ['side', 'side'], ['tip', 'none'], ['none', 'side'], ['none', 'none']] as const) expect(touchesBothParts(a, b), `${a} ${b}`).toBe(false);
  });

  it('전선 색깔은 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const plus of BL_ENDS) for (const minus of BL_ENDS) for (const sw of BL_SWITCHES) expect(simulateBulbLight(p(plus, minus, sw, 'black'))).toEqual(simulateBulbLight(p(plus, minus, sw, 'red')));
  });

  it('0~2초 0.05초 간격 41개이고, 밝기는 0에서 시작해 1초 안에 결과에 이르며 그 뒤 멈춰 있다', () => {
    for (const [plus, minus, sw] of [['tip', 'side', 'closed'], ['none', 'none', 'open'], ['tip', 'side', 'open']] as const) {
      const { samples, result } = simulateBulbLight(p(plus, minus, sw));
      expect(samples).toHaveLength(41);
      expect(samples[0]).toEqual({ t: 0, level: 0 });
      expect(samples.at(-1)!.t).toBe(2);
      expect(samples.at(-1)!.level).toBeCloseTo(result.brightness, 9);
      for (const s of samples.filter((x) => x.t >= 1)) expect(s.level).toBeCloseTo(result.brightness, 9);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.level - samples[i - 1]!.level).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('선형 보간과 범위 밖 입력 거부', () => {
    const { samples } = simulateBulbLight(p('tip', 'side', 'closed'));
    const m = interpolateBulb(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(0.225, 9);
    expect(m.level).toBeCloseTo((samples[4]!.level + samples[5]!.level) / 2, 9);
    expect(() => simulateBulbLight({ ...p('tip', 'side', 'closed'), plusEnd: 'top' as never })).toThrow(RangeError);
    expect(() => simulateBulbLight({ ...p('tip', 'side', 'closed'), minusEnd: 'x' as never })).toThrow(RangeError);
    expect(() => simulateBulbLight({ ...p('tip', 'side', 'closed'), switch: 'half' as never })).toThrow(RangeError);
    expect(() => simulateBulbLight({ ...p('tip', 'side', 'closed'), wireColor: 'blue' as never })).toThrow(RangeError);
    expect(bulbLightResultOf(p('tip', 'side', 'closed'))).toEqual({ brightness: 6, lit: '켜짐' });
  });
});

describe('전지 직렬연결 모델: 한 개 4, 두 개 9, 하나를 반대로 넣으면 0', () => {
  const TABLE: [BsCells, number, string][] = [['one', 4, '켜짐'], ['two', 9, '켜짐'], ['reversed', 0, '켜지지 않음']];
  for (const wire of BL_WIRES) {
    for (const [cells, brightness, lit] of TABLE) {
      it(`${wire} 전선, 전지 ${cells}: ${brightness}눈금 ${lit}`, () => {
        expect(simulateBatterySeries({ cells, wireColor: wire }).result).toEqual({ brightness, lit });
      });
    }
  }

  it('전선 색깔은 결과와 표본을 바꾸지 않고, 표는 정수 눈금 0~10이다', () => {
    for (const cells of BS_CELLS) {
      expect(simulateBatterySeries({ cells, wireColor: 'black' })).toEqual(simulateBatterySeries({ cells, wireColor: 'red' }));
      expect(Number.isInteger(BS_BRIGHTNESS[cells])).toBe(true);
      expect(BS_BRIGHTNESS[cells]).toBeLessThanOrEqual(10);
    }
    expect(batterySeriesResultOf({ cells: 'two' }).brightness).toBeGreaterThan(batterySeriesResultOf({ cells: 'one' }).brightness);
  });

  it('표본은 전구 불 켜기와 같은 모양이다(41개, 1초 안에 결과에 이른다)', () => {
    for (const [cells, brightness] of TABLE) {
      const { samples } = simulateBatterySeries({ cells, wireColor: 'red' });
      expect(samples).toHaveLength(41);
      expect(samples[0]).toEqual({ t: 0, level: 0 });
      expect(samples.at(-1)!.level).toBeCloseTo(brightness, 9);
    }
    expect(() => simulateBatterySeries({ cells: 'three' as never, wireColor: 'red' })).toThrow(RangeError);
    expect(() => simulateBatterySeries({ cells: 'one', wireColor: 'blue' as never })).toThrow(RangeError);
  });
});

describe('validateBulbLightExperiment·validateBatterySeriesExperiment', () => {
  const exp = (i: number) => JSON.parse(JSON.stringify(electricityJson.experiments[i])) as VariableExperiment;

  it('g6-electricity 활동 2·3 매니페스트는 통과한다', () => {
    expect(electricityJson.experiments.map((e) => e.id)).toEqual(['electromagnet', 'bulb-light', 'battery-series']);
    expect(validateBulbLightExperiment(exp(1))).toEqual([]);
    expect(validateBatterySeriesExperiment(exp(2))).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp(1);
    a.variables = a.variables.filter((v) => v.key !== 'wireColor');
    expect(validateBulbLightExperiment(a).join()).toContain('"wireColor"');
    const b = exp(1);
    b.variables.find((v) => v.key === 'plusEnd')!.options.push({ value: 'top', label: 'x' });
    b.variables.find((v) => v.key === 'switch')!.options.push({ value: 'half', label: 'y' });
    expect(validateBulbLightExperiment(b)).toHaveLength(2);
    const c = exp(2);
    c.variables.find((v) => v.key === 'cells')!.options.push({ value: 'three', label: 'z' });
    expect(validateBatterySeriesExperiment(c)).toHaveLength(1);
    c.variables = [];
    expect(validateBatterySeriesExperiment(c)).toHaveLength(2);
  });
});
