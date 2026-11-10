import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEOUL_ANNUAL_TEMPERATURE, SEOUL_MISSING_YEARS, periodMean, seoulDecadeMeans } from './seoulTemperature';

const CSV = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'content', 'data', 'kma-seoul-annual-temperature.csv');
const rows = readFileSync(CSV, 'utf8').trim().split(/\r?\n/).slice(1).map((l) => l.split(','));

describe('서울 연평균기온 자료', () => {
  it('CSV와 상수가 한 해씩 같다', () => {
    expect(rows[0]).toBeDefined();
    expect(SEOUL_ANNUAL_TEMPERATURE).toHaveLength(rows.length);
    rows.forEach((r, i) => {
      const d = SEOUL_ANNUAL_TEMPERATURE[i]!;
      expect(d.year).toBe(Number(r[0]));
      expect(d.meanC).toBe(r[2] === '' ? null : Number(r[2]));
    });
  });

  it('119개, 1907~2025, 값이 없는 해 5개', () => {
    expect(SEOUL_ANNUAL_TEMPERATURE).toHaveLength(119);
    expect(SEOUL_ANNUAL_TEMPERATURE[0]!.year).toBe(1907);
    expect(SEOUL_ANNUAL_TEMPERATURE.at(-1)!.year).toBe(2025);
    expect(SEOUL_MISSING_YEARS).toEqual([1907, 1950, 1951, 1952, 1953]);
  });

  it('30년 평균: 10.79 → 10.8, 13.09 → 13.1 (30개 해)', () => {
    const a = periodMean(1908, 1937);
    const b = periodMean(1996, 2025);
    expect([a.count, a.mean, a.shown]).toEqual([30, 10.79, '10.8']);
    expect([b.count, b.mean, b.shown]).toEqual([30, 13.09, '13.1']);
  });

  it('10년 평균 12개와 해 수', () => {
    const t = seoulDecadeMeans();
    expect(t.map((d) => `${d.from}~${d.to}`)).toEqual(['1908~1917', '1918~1927', '1928~1937', '1938~1947', '1948~1957', '1958~1967', '1968~1977', '1978~1987', '1988~1997', '1998~2007', '2008~2017', '2018~2025']);
    expect(t.map((d) => d.shown)).toEqual(['10.6', '10.9', '11.0', '10.9', '11.1', '11.8', '11.7', '11.8', '12.6', '13.0', '12.8', '13.7']);
    expect(t.map((d) => d.count)).toEqual([10, 10, 10, 10, 6, 10, 10, 10, 10, 10, 10, 8]);
  });

  it('반올림은 정수로 계산해 0.05는 올린다', () => {
    // 1948~1957 말고도, 값이 없는 구간은 null
    expect(periodMean(1950, 1953)).toMatchObject({ count: 0, mean: null, shown: null });
    expect(periodMean(1949, 1949).shown).toBe(String(SEOUL_ANNUAL_TEMPERATURE.find((d) => d.year === 1949)!.meanC!.toFixed(1)));
  });

  it('가장 낮은 해는 1947년 9.6, 가장 높은 해는 2024년 14.9', () => {
    const v = SEOUL_ANNUAL_TEMPERATURE.filter((d): d is { year: number; meanC: number } => d.meanC !== null);
    const lo = v.reduce((m, d) => (d.meanC < m.meanC ? d : m));
    const hi = v.reduce((m, d) => (d.meanC > m.meanC ? d : m));
    expect([lo.year, lo.meanC]).toEqual([1947, 9.6]);
    expect([hi.year, hi.meanC]).toEqual([2024, 14.9]);
  });
});
