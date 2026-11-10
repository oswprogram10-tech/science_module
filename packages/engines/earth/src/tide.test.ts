import { describe, expect, it } from 'vitest';
import { parseManifest, type ObservationExperiment } from '@sci/schema';
import { answerFor, validateSkyObservation } from './astro';
import {
  MUDFLAT_M,
  ROCK_M,
  TIDE_AMPLITUDE_M,
  TIDE_HIGH_AT_H,
  TIDE_PERIOD_H,
  lowTideExposed,
  lowestTideM,
  mudflatExposed,
  rocksSubmerged,
  tideHeight,
  tideHighsPerDay,
  tideRising,
} from './tide';
import earthSeaJson from '../../../../content/units/g3-earth-sea/manifest.json';

const hm = (h: number, m: number) => h + m / 60;
const round1 = (x: number) => Math.round(x * 10) / 10;

describe('밀물과 썰물 모델 상수', () => {
  it('주기 12시간 25분, 진폭 3.5 m, 가장 높은 때 2시, 갯벌 높이 −1.5 m, 바위 1.5 m', () => {
    expect(TIDE_PERIOD_H).toBeCloseTo(hm(12, 25), 2);
    expect([TIDE_AMPLITUDE_M, TIDE_HIGH_AT_H, MUDFLAT_M, ROCK_M]).toEqual([3.5, 2, -1.5, 1.5]);
  });
});

describe('기준값 표(g3-earth-sea-tide-ext.md §1, 소수 첫째 자리)', () => {
  // [시각, 높이, 오르는 중인가, 갯벌이 드러났나]
  const table: [string, number, number | null, boolean, boolean][] = [
    ['2:00', hm(2, 0), 3.5, false, false],
    ['5:00', hm(5, 0), 0.2, false, false],
    ['8:00', hm(8, 0), -3.5, false, true],
    ['11:00', hm(11, 0), -0.6, true, false],
    ['14:25', hm(14, 25), 3.5, false, false],
    ['20:38', hm(20, 38), -3.5, false, true],
  ];
  for (const [label, t, h, rising, exposed] of table) {
    it(`${label}: 높이 ${h} m, ${rising ? '오름' : '내림'}${exposed ? ', 갯벌이 드러남' : ''}`, () => {
      expect(round1(tideHeight(t))).toBe(h);
      // 가장 높은·낮은 때(2:00, 14:25, 20:38)는 막 내려가거나 오르기 시작하는 것으로 본다. 표에서 오름·내림을 정하는 때만 검사한다.
      if (label === '5:00' || label === '8:00' || label === '11:00') expect(tideRising(t)).toBe(rising);
      expect(mudflatExposed(t)).toBe(exposed);
    });
  }

  it('가장 높은 때는 2:00과 14:25, 가장 낮은 때는 8:13과 20:38이다', () => {
    expect(tideHeight(2)).toBeCloseTo(3.5, 10);
    expect(tideHeight(2 + TIDE_PERIOD_H)).toBeCloseTo(3.5, 10);
    expect(tideHeight(2 + TIDE_PERIOD_H / 2)).toBeCloseTo(-3.5, 10);
    expect(tideHeight(2 + (3 * TIDE_PERIOD_H) / 2)).toBeCloseTo(-3.5, 10);
    expect(2 + TIDE_PERIOD_H / 2).toBeCloseTo(hm(8, 13), 1);
    expect(2 + TIDE_PERIOD_H).toBeCloseTo(hm(14, 25), 1);
  });

  it('높이 차이는 약 7 m이고, 하루 중 가장 낮은 높이는 −3.5 m이다', () => {
    expect(round1(lowestTideM())).toBe(-3.5);
    expect(tideHeight(2) - tideHeight(2 + TIDE_PERIOD_H / 2)).toBeCloseTo(7, 10);
  });
});

describe('오르내림, 갯벌, 바위', () => {
  it('가장 높은 때(2:00)에서 가장 낮은 때(8:13)까지 내리고, 8:13에서 14:25까지 오른다', () => {
    for (let t = 2.25; t < 8; t += 0.25) expect(tideRising(t), `${t}시`).toBe(false);
    for (let t = 8.5; t < 14.25; t += 0.25) expect(tideRising(t), `${t}시`).toBe(true);
    for (let t = 14.75; t < 20.5; t += 0.25) expect(tideRising(t), `${t}시`).toBe(false);
    for (let t = 0; t < 1.9; t += 0.25) expect(tideRising(t), `${t}시`).toBe(true);
  });

  it('갯벌은 높이가 −1.5 m보다 낮을 때만 드러나고, 바위는 1.5 m보다 높을 때 잠긴다', () => {
    for (let t = 0; t <= 24; t += 0.5) {
      expect(mudflatExposed(t), `${t}시 갯벌`).toBe(tideHeight(t) < -1.5);
      expect(rocksSubmerged(t), `${t}시 바위`).toBe(tideHeight(t) > 1.5);
    }
    expect(mudflatExposed(8)).toBe(true);
    expect(mudflatExposed(2)).toBe(false);
    expect(rocksSubmerged(2)).toBe(true);
    expect(rocksSubmerged(8)).toBe(false);
  });
});

describe('정답 규칙', () => {
  it('tide-highs-per-day는 하루에 높이가 극대인 횟수 "2"를 돌려준다', () => {
    expect(tideHighsPerDay()).toBe(2);
    expect(answerFor('tide-highs-per-day')).toBe('2');
  });

  it('low-tide-exposed는 가장 낮은 때 드러나는 것 "mudflat"을 돌려준다', () => {
    expect(lowTideExposed()).toBe('mudflat');
    expect(answerFor('low-tide-exposed')).toBe('mudflat');
  });

  it('활동 2 매니페스트의 두 과제는 검사기를 통과하고, 모델 결과가 선택지 안에 있다', () => {
    const o = parseManifest(earthSeaJson).experiments[1] as ObservationExperiment;
    expect(validateSkyObservation(o)).toEqual([]);
    expect(o.tasks.map((t) => answerFor(t.answer))).toEqual(['2', 'mudflat']);
  });

  it('선택지에 없는 결과를 내는 과제는 검사기가 잡는다', () => {
    const o = structuredClone(parseManifest(earthSeaJson).experiments[1]) as ObservationExperiment;
    o.tasks[0]!.options = o.tasks[0]!.options.filter((x) => x.value !== '2');
    expect(validateSkyObservation(o).join()).toContain('모델 결과 "2"');
  });
});
