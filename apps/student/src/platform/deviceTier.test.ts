import { describe, expect, it } from 'vitest';
import { TIER_PARTICLE_SCALE, classifyDevice, scaleCount, tierFromUrl, type DeviceSignals } from './deviceTier';
import { counts } from '../modules/candle-jar/CandleMicroView';

const sig = (o: Partial<DeviceSignals> = {}): DeviceSignals => ({ webgpu: false, platform: 'web', reducedMotion: false, ...o });

describe('classifyDevice 경계값', () => {
  it('메모리 4 GB 이하 또는 코어 4개 이하면 C', () => {
    expect(classifyDevice(sig({ memoryGb: 4, cores: 8 })).tier).toBe('C');
    expect(classifyDevice(sig({ memoryGb: 8, cores: 4 })).tier).toBe('C');
    expect(classifyDevice(sig({ memoryGb: 2 })).tier).toBe('C');
    expect(classifyDevice(sig({ cores: 2 })).tier).toBe('C');
  });
  it('메모리 8 GB 이상이고 코어 8개 이상이면 A', () => {
    expect(classifyDevice(sig({ memoryGb: 8, cores: 8 })).tier).toBe('A');
    expect(classifyDevice(sig({ memoryGb: 16, cores: 12 })).tier).toBe('A');
  });
  it('그 밖은 B (5~7 GB, 코어 5~7개, 한쪽만 큰 경우)', () => {
    expect(classifyDevice(sig({ memoryGb: 6, cores: 8 })).tier).toBe('B');
    expect(classifyDevice(sig({ memoryGb: 8, cores: 6 })).tier).toBe('B');
    expect(classifyDevice(sig({ memoryGb: 4.5, cores: 5 })).tier).toBe('B');
    expect(classifyDevice(sig({ memoryGb: 8 })).tier).toBe('B');
  });
  it('신호가 없으면 B (iOS 웹뷰)', () => {
    expect(classifyDevice(sig({ platform: 'ios' })).tier).toBe('B');
    expect(classifyDevice(sig({ platform: 'ios', cores: 6 })).tier).toBe('B');
  });
  it('reducedMotion은 등급을 바꾸지 않고 이유에만 남는다', () => {
    const a = classifyDevice(sig({ memoryGb: 8, cores: 8 }));
    const b = classifyDevice(sig({ memoryGb: 8, cores: 8, reducedMotion: true }));
    expect(b.tier).toBe(a.tier);
    expect(a.reasons.some((r) => r.includes('움직임'))).toBe(false);
    expect(b.reasons.some((r) => r.includes('움직임'))).toBe(true);
  });
});

describe('URL ?tier', () => {
  it('A·B·C만 받는다', () => {
    expect(tierFromUrl('?tier=C')).toBe('C');
    expect(tierFromUrl('?dev=1&tier=A')).toBe('A');
    expect(tierFromUrl('?tier=D')).toBeNull();
    expect(tierFromUrl('')).toBeNull();
  });
});

describe('알갱이 배율', () => {
  it('등급별 배율 A 1, B 0.7, C 0.4', () => {
    expect(TIER_PARTICLE_SCALE).toEqual({ A: 1, B: 0.7, C: 0.4 });
  });
  it('상한에 배율을 곱하고 반올림한다(최소 1)', () => {
    expect(scaleCount(220, TIER_PARTICLE_SCALE.A)).toBe(220);
    expect(scaleCount(220, TIER_PARTICLE_SCALE.B)).toBe(154);
    expect(scaleCount(220, TIER_PARTICLE_SCALE.C)).toBe(88);
    expect(scaleCount(100, TIER_PARTICLE_SCALE.C)).toBe(40);
    expect(scaleCount(1, TIER_PARTICLE_SCALE.C)).toBe(1);
  });
  it('촛불 미시 화면: 등급 A는 기존 값 그대로, C는 전체와 산소 알갱이 수가 함께 준다', () => {
    expect(counts(21)).toEqual({ o2: 13, co2: 0, water: 0, other: 47, total: 60, o2Start: 13 });
    expect(counts(21, TIER_PARTICLE_SCALE.A)).toEqual(counts(21));
    const c = counts(21, TIER_PARTICLE_SCALE.C);
    expect(c.total).toBe(24);
    expect(c.o2 + c.other).toBe(c.total);
    expect(c.o2).toBeLessThan(13);
  });
});
