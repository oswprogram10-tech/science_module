import { describe, expect, it } from 'vitest';
import { formatTick, niceScale, yAxis } from './axis';

describe('niceScale', () => {
  it('눈금 값이 겹치지 않고 오름차순이다', () => {
    for (const m of [0.3, 1, 1.05, 5.7, 17.9, 28.7, 79.7, 360, 2875]) {
      const s = niceScale(m);
      const labels = s.ticks.map((t) => formatTick(t, s.decimals));
      expect(new Set(labels).size).toBe(labels.length);
      expect(s.max).toBeGreaterThanOrEqual(m);
      expect(s.ticks[0]).toBe(0);
      expect(s.ticks.length).toBeGreaterThanOrEqual(2);
      expect(s.ticks.length).toBeLessThanOrEqual(7);
    }
  });
  it('1·2·5 간격을 쓴다', () => {
    expect(niceScale(79.7).ticks).toEqual([0, 20, 40, 60, 80]);
    expect(niceScale(28.7).ticks).toEqual([0, 10, 20, 30]);
    expect(niceScale(0.3).decimals).toBe(1);
  });
  it('0이나 잘못된 값이면 0~1 축', () => {
    expect(niceScale(0).max).toBeGreaterThan(0);
    expect(niceScale(NaN).max).toBeGreaterThan(0);
  });
});

describe('yAxis (yMin)', () => {
  it('yMin이 0이면 niceScale(최댓값 × 1.05)와 같은 눈금', () => {
    for (const m of [0.3, 17.9, 28.7, 79.7, 360]) {
      const a = yAxis(m);
      const n = niceScale(m * 1.05);
      expect(a.ticks).toEqual(n.ticks);
      expect(a.max).toBe(n.max);
      expect(a.min).toBe(0);
    }
  });
  it('yMin부터 시작하는 눈금: 산소 비율 14~21 %', () => {
    const a = yAxis(21, 14);
    expect(a.ticks[0]).toBe(14);
    expect(a.ticks).toEqual([14, 16, 18, 20, 22]);
    expect(a.max).toBeGreaterThanOrEqual(21);
    expect(a.min).toBe(14);
  });
  it('데이터가 yMin 이하여도 깨지지 않는다', () => {
    const a = yAxis(10, 14);
    expect(a.ticks[0]).toBe(14);
    expect(a.max).toBeGreaterThan(14);
  });
});
