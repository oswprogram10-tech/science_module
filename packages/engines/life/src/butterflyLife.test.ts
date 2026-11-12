import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  BL_DAYS,
  BL_TABLE,
  BL_TIMES,
  interpolateButterflyLife,
  shapeOfDay,
  simulateButterflyLife,
  validateButterflyLifeExperiment,
  type BlEat,
  type BlMove,
  type BlTime,
  type BlWings,
} from './butterflyLife';
import lifecycleJson from '../../../../content/units/g3-lifecycle/manifest.json';

const p = (day: number, time: BlTime = 'morning') => ({ day, time });

// 사양 §4 표 고정: [날, 길이, 먹이, 움직임, 날개]
const TABLE: [number, number, BlEat, BlMove, BlWings][] = [
  [1, 1, 'noeat', 'still', 'no'],
  [3, 1, 'noeat', 'still', 'no'],
  [6, 3, 'eat', 'crawl', 'no'],
  [9, 10, 'eat', 'crawl', 'no'],
  [12, 20, 'eat', 'crawl', 'no'],
  [15, 28, 'eat', 'crawl', 'no'],
  [18, 22, 'noeat', 'still', 'no'],
  [21, 22, 'noeat', 'still', 'no'],
  [24, 22, 'noeat', 'still', 'no'],
  [28, 20, 'eat', 'fly', 'yes'],
  [30, 20, 'eat', 'fly', 'yes'],
];

describe('배추흰나비 한살이 모델: 사양 표(관찰한 때 두 가지 각각)', () => {
  it('관찰할 수 있는 날은 사양의 11일이다', () => {
    expect([...BL_DAYS]).toEqual([1, 3, 6, 9, 12, 15, 18, 21, 24, 28, 30]);
    expect(TABLE.map((r) => r[0])).toEqual([...BL_DAYS]);
  });

  for (const time of BL_TIMES) {
    for (const [day, length, eat, move, wings] of TABLE) {
      it(`${time} ${day}일째: ${length} mm, ${eat}, ${move}, ${wings}`, () => {
        expect(simulateButterflyLife(p(day, time)).result).toEqual({ length, eat, move, wings });
      });
    }
  }

  it('관찰한 때(아침·저녁)는 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const day of BL_DAYS) expect(simulateButterflyLife(p(day, 'evening'))).toEqual(simulateButterflyLife(p(day, 'morning')));
  });

  it('길이는 정수이고 알일 때 1, 큰 애벌레일 때 가장 길며 껍데기 모습은 먹지 않는다', () => {
    for (const day of BL_DAYS) expect(Number.isInteger(BL_TABLE[day]!.length)).toBe(true);
    expect(Math.max(...BL_DAYS.map((d) => BL_TABLE[d]!.length))).toBe(28);
    expect(BL_TABLE[15]!.length).toBe(28);
    for (const d of [18, 21, 24]) expect(shapeOfDay(d)).toBe('shell');
    expect(BL_DAYS.filter((d) => BL_TABLE[d]!.eat === 'noeat')).toEqual([1, 3, 18, 21, 24]);
  });

  it('그림 모양은 날에 따라 알, 작은 것, 중간 것, 큰 것, 껍데기, 날개 편 것이다', () => {
    expect(BL_DAYS.map(shapeOfDay)).toEqual(['egg', 'egg', 'small', 'larva', 'larva', 'big', 'shell', 'shell', 'shell', 'adult', 'adult']);
  });
});

describe('배추흰나비 한살이 모델: 표본', () => {
  it('t = 0~관찰한 날 하루마다 하나이고, 몸 길이는 관찰한 날에만 값이 있다(나머지는 NaN)', () => {
    for (const day of BL_DAYS) {
      const { samples, result } = simulateButterflyLife(p(day));
      expect(samples).toHaveLength(day + 1);
      expect(samples.map((s) => s.t)).toEqual(Array.from({ length: day + 1 }, (_, i) => i));
      expect(samples.filter((s) => Number.isFinite(s.length))).toEqual([{ t: day, length: result.length }]);
      expect(samples.at(-1)!.length).toBe(result.length);
      expect(samples.at(-1)!.t).toBeLessThanOrEqual(30);
    }
  });

  it('보간: 두 값이 모두 있을 때만 선형이고, 아니면 도착한 날에서야 값이 생긴다', () => {
    const a = { t: 4, length: 10 };
    const b = { t: 5, length: 20 };
    expect(interpolateButterflyLife(a, b, 0.5)).toEqual({ t: 4.5, length: 15 });
    const gap = { t: 3, length: NaN };
    expect(Number.isNaN(interpolateButterflyLife(gap, a, 0.5).length)).toBe(true);
    expect(interpolateButterflyLife(gap, a, 1).length).toBe(10);
    expect(interpolateButterflyLife(gap, gap, 0.5).t).toBe(3);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateButterflyLife(p(2))).toThrow(RangeError);
    expect(() => simulateButterflyLife(p(0))).toThrow(RangeError);
    expect(() => simulateButterflyLife({ day: 1, time: 'noon' as never })).toThrow(RangeError);
    expect(() => simulateButterflyLife({ day: '1' as never, time: 'morning' })).toThrow(RangeError);
  });
});

describe('validateButterflyLifeExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(lifecycleJson.experiments[1])) as VariableExperiment;

  it('g3-lifecycle 활동 2 매니페스트는 통과한다', () => {
    expect(validateButterflyLifeExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'time');
    expect(validateButterflyLifeExperiment(a).join()).toContain('"time"');
    const b = exp();
    b.variables.find((v) => v.key === 'day')!.options.push({ value: 2, label: 'x' });
    b.variables.find((v) => v.key === 'time')!.options.push({ value: 'noon', label: 'y' });
    expect(validateButterflyLifeExperiment(b)).toHaveLength(2);
  });
});
