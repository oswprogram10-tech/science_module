import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import { HM_DIFFS, HM_DRYS, HM_PLACES, HM_TABLE, humidityOf, interpolateHumidity, saturationHpa, simulateHumidity, validateHumidityExperiment, type HumidityParams } from './humidity';
import weatherJson from '../../../../content/units/g5-weather/manifest.json';

const p = (dry: number, diff: number, place: 'white' | 'gray' = 'white'): HumidityParams => ({ dry, diff, place });

// 사양 §6 식으로 만든 습도표를 고정한다(행: 건구 온도, 열: 온도 차 0~6 °C).
const TABLE: Record<number, number[]> = {
  10: [100, 87, 74, 62, 50, 38, 27],
  15: [100, 89, 78, 68, 58, 48, 39],
  20: [100, 91, 81, 72, 64, 56, 48],
  25: [100, 92, 84, 76, 68, 61, 54],
  30: [100, 92, 85, 78, 72, 65, 59],
};

describe('건습구 습도계 모델: 습도표', () => {
  it('사양의 두 행(20 °C 행, 10 °C 행)이 그대로다', () => {
    expect(HM_TABLE[20]).toEqual([100, 91, 81, 72, 64, 56, 48]);
    expect(HM_TABLE[10]).toEqual([100, 87, 74, 62, 50, 38, 27]);
  });

  it('식으로 만든 5행 × 7열 표가 고정되어 있다', () => {
    for (const dry of HM_DRYS) expect(HM_TABLE[dry], `${dry} °C`).toEqual(TABLE[dry]);
    for (const dry of HM_DRYS) for (const diff of HM_DIFFS) expect(simulateHumidity(p(dry, diff)).result, `${dry}/${diff}`).toEqual({ rh: TABLE[dry]![diff], wet: dry - diff });
  });

  it('식: es(t) = 6.1078 × 10^(7.5t ÷ (237.3 + t)), 온도 차 0이면 100, 온도 차가 커질수록 값이 작아진다', () => {
    expect(saturationHpa(0)).toBeCloseTo(6.1078, 9);
    expect(saturationHpa(20)).toBeCloseTo(23.37, 1);
    for (const dry of HM_DRYS) {
      expect(humidityOf(dry, 0)).toBe(100);
      for (let d = 1; d < HM_DIFFS.length; d++) expect(TABLE[dry]![d]!).toBeLessThan(TABLE[dry]![d - 1]!);
    }
    // 같은 온도 차에서 건구 온도가 높아도 값이 줄지 않는다.
    for (const diff of HM_DIFFS.filter((d) => d > 0)) for (let i = 1; i < HM_DRYS.length; i++) expect(TABLE[HM_DRYS[i]!]![diff]!).toBeGreaterThanOrEqual(TABLE[HM_DRYS[i - 1]!]![diff]!);
  });

  it('벽 색은 모든 조건에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const dry of HM_DRYS) for (const diff of HM_DIFFS) expect(simulateHumidity(p(dry, diff, 'gray'))).toEqual(simulateHumidity(p(dry, diff, 'white')));
    expect(HM_PLACES).toEqual(['white', 'gray']);
  });
});

describe('건습구 습도계 모델: 표본', () => {
  it('0~2초 0.05초 간격 41개이고, 습구 온도와 습도는 1.5초 안에 값에 이르며 그 뒤 멈춰 있다', () => {
    const { samples, result } = simulateHumidity(p(20, 3));
    expect(samples).toHaveLength(41);
    expect(samples[0]).toEqual({ t: 0, dryC: 20, wetC: 20, rh: 0 });
    expect(samples.at(-1)).toEqual({ t: 2, dryC: 20, wetC: 17, rh: 72 });
    expect(result).toEqual({ rh: 72, wet: 17 });
    for (const s of samples.filter((x) => x.t >= 1.5)) expect([s.wetC, s.rh]).toEqual([17, 72]);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.wetC).toBeLessThanOrEqual(samples[i - 1]!.wetC + 1e-9);
      expect(samples[i]!.rh).toBeGreaterThanOrEqual(samples[i - 1]!.rh - 1e-9);
      expect(samples[i]!.dryC).toBe(20);
    }
  });

  it('선형 보간', () => {
    const { samples } = simulateHumidity(p(25, 4));
    const m = interpolateHumidity(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(0.225, 9);
    expect(m.wetC).toBeCloseTo((samples[4]!.wetC + samples[5]!.wetC) / 2, 9);
    expect(m.rh).toBeCloseTo((samples[4]!.rh + samples[5]!.rh) / 2, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateHumidity(p(22, 1))).toThrow(RangeError);
    expect(() => simulateHumidity(p(20, 7))).toThrow(RangeError);
    expect(() => simulateHumidity({ ...p(20, 1), place: 'red' as never })).toThrow(RangeError);
  });
});

describe('validateHumidityExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(weatherJson.experiments[2])) as VariableExperiment;

  it('g5-weather 활동 3 매니페스트는 통과한다', () => {
    expect(validateHumidityExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'place');
    expect(validateHumidityExperiment(a).join()).toContain('"place"');
    const b = exp();
    b.variables.find((v) => v.key === 'dry')!.options.push({ value: 35, label: 'x' });
    b.variables.find((v) => v.key === 'diff')!.options.push({ value: 9, label: 'y' });
    b.variables.find((v) => v.key === 'place')!.options.push({ value: 'red', label: 'z' });
    expect(validateHumidityExperiment(b)).toHaveLength(3);
  });
});
