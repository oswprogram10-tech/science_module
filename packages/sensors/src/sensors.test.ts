import { describe, expect, it } from 'vitest';
import { simulateDissolution } from '@sci/engine-matter';
import { MockGasDriver, MockPressureDriver, MockScaleDriver, MockTemperatureDriver, mulberry32 } from './index';

describe('mulberry32', () => {
  it('같은 시드면 같은 수열', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('MockTemperatureDriver', () => {
  it('±0.2 °C 안, 소수 첫째 자리, 시드 재현', () => {
    const a = new MockTemperatureDriver(() => 40, 7);
    const b = new MockTemperatureDriver(() => 40, 7);
    const ra = Array.from({ length: 50 }, () => a.read().value);
    const rb = Array.from({ length: 50 }, () => b.read().value);
    expect(ra).toEqual(rb);
    for (const v of ra) {
      expect(Math.abs(v - 40)).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(Math.round(v * 10) / 10).toBe(v);
    }
    expect(a.read().unit).toBe('°C');
  });
});

describe('MockScaleDriver', () => {
  it('시드 재현성', () => {
    const mk = () => new MockScaleDriver(() => 50 + 2, 3);
    const a = mk();
    const b = mk();
    expect(Array.from({ length: 20 }, () => a.read().value)).toEqual(
      Array.from({ length: 20 }, () => b.read().value),
    );
  });

  it('용질이 녹는 동안(addedG가 같은 구간) 저울 값은 변하지 않는다', () => {
    const waterMl = 100;
    const { samples } = simulateDissolution({ solute: 'sugar', waterMl, waterTempC: 20, stir: 1 });
    let i = 0;
    const scale = new MockScaleDriver(() => waterMl + samples[i]!.addedG, 11);
    // 첫 숟가락이 녹는 구간: addedG가 그대로인 연속 샘플
    const window: number[] = [];
    for (i = 0; i < samples.length && samples[i]!.addedG === samples[0]!.addedG; i++) {
      window.push(scale.read().value);
    }
    expect(window.length).toBeGreaterThan(3);
    expect(samples[window.length - 1]!.dissolvedG).toBeGreaterThan(samples[0]!.dissolvedG);
    for (const v of window) {
      expect(Math.abs(v - (100 + waterMl + samples[0]!.addedG))).toBeLessThanOrEqual(0.011);
    }
    expect(Math.max(...window) - Math.min(...window)).toBeLessThanOrEqual(0.021);
  });

  it('숟가락을 더 넣으면 addedG만큼 무거워진다', () => {
    const { samples } = simulateDissolution({ solute: 'sugar', waterMl: 100, waterTempC: 20, stir: 2 });
    const last = samples[samples.length - 1]!;
    expect(last.addedG).toBeGreaterThan(samples[0]!.addedG);
  });

  it('connect/subscribe/disconnect', async () => {
    const d = new MockTemperatureDriver(() => 20, 1, 5);
    const got: number[] = [];
    const off = d.subscribe((r) => got.push(r.value));
    await d.connect();
    await new Promise((r) => setTimeout(r, 40));
    await d.disconnect();
    off();
    const n = got.length;
    expect(n).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(got.length).toBe(n);
  });
});

describe('MockPressureDriver', () => {
  it('±0.1 kPa 안, 소수 첫째 자리, 시드 재현, 단위 kPa', () => {
    const a = new MockPressureDriver(() => 126.6, 9);
    const b = new MockPressureDriver(() => 126.6, 9);
    const ra = Array.from({ length: 50 }, () => a.read().value);
    const rb = Array.from({ length: 50 }, () => b.read().value);
    expect(ra).toEqual(rb);
    for (const v of ra) {
      expect(Math.abs(v - 126.6)).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(Math.round(v * 10) / 10).toBe(v);
    }
    expect(a.kind).toBe('pressure');
    expect(a.read().unit).toBe('kPa');
  });
  it('원천값이 바뀌면 읽는 값도 따라간다', () => {
    let src = 101.3;
    const d = new MockPressureDriver(() => src, 1);
    expect(Math.abs(d.read().value - 101.3)).toBeLessThanOrEqual(0.1 + 1e-9);
    src = 202.6;
    expect(Math.abs(d.read().value - 202.6)).toBeLessThanOrEqual(0.1 + 1e-9);
  });
});

describe('MockGasDriver', () => {
  it('산소·이산화 탄소: 단위 %, 소수 첫째 자리, ±0.05 잡음, 시드 재현', () => {
    for (const kind of ['oxygen', 'carbonDioxide'] as const) {
      const a = new MockGasDriver(kind, () => 20.5, 9);
      const b = new MockGasDriver(kind, () => 20.5, 9);
      const ra = Array.from({ length: 50 }, () => a.read().value);
      expect(ra).toEqual(Array.from({ length: 50 }, () => b.read().value));
      for (const v of ra) {
        expect(Math.abs(v - 20.5)).toBeLessThanOrEqual(0.1 + 1e-9); // 잡음 ±0.05를 소수 첫째 자리로 반올림
        expect(Math.round(v * 10) / 10).toBe(v);
      }
      expect(a.read().unit).toBe('%');
      expect(a.kind).toBe(kind);
    }
    expect(new MockGasDriver('oxygen', () => 21, 1).id).not.toBe(new MockGasDriver('carbonDioxide', () => 21, 1).id);
  });
});
