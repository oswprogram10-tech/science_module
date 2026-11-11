import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  MIN_FORCE,
  POLE_COVERS,
  POLE_FACINGS,
  POLE_GAPS,
  POLE_SIZES,
  forceOf,
  interpolateMagnetPoles,
  isSamePole,
  motionOf,
  simulateMagnetPoles,
  validateMagnetPolesExperiment,
  type MagnetPolesParams,
  type PoleFacing,
  type PoleMotion,
  type PoleSize,
} from './magnetPoles';
import magnetJson from '../../../../content/units/g4-magnet/manifest.json';

const p = (facing: PoleFacing, gapCm: number, size: PoleSize, cover: 'color' | 'gray' = 'color'): MagnetPolesParams => ({ facing, gapCm, size, cover });

// 사양 §3 표 고정: [마주 보는 극, 크기, 거리, 움직임, 움직인 거리]
const TABLE: [PoleFacing, PoleSize, number, PoleMotion, number][] = [
  ['NN', 'small', 1, 'repel', 4.0],
  ['NN', 'small', 2, 'repel', 1.0],
  ['NN', 'small', 4, 'none', 0.0],
  ['NN', 'large', 1, 'repel', 6.0],
  ['NN', 'large', 2, 'repel', 2.0],
  ['NN', 'large', 4, 'repel', 0.5],
  ['SS', 'small', 1, 'repel', 4.0],
  ['SS', 'small', 2, 'repel', 1.0],
  ['SS', 'small', 4, 'none', 0.0],
  ['SS', 'large', 1, 'repel', 6.0],
  ['SS', 'large', 2, 'repel', 2.0],
  ['SS', 'large', 4, 'repel', 0.5],
  ['NS', 'small', 1, 'attract', 1.0],
  ['NS', 'small', 2, 'attract', 2.0],
  ['NS', 'small', 4, 'none', 0.0],
  ['NS', 'large', 1, 'attract', 1.0],
  ['NS', 'large', 2, 'attract', 2.0],
  ['NS', 'large', 4, 'attract', 4.0],
];

describe('자석과 자석 사이 모델: 사양 기준값 18칸 × 색칠 두 가지', () => {
  for (const cover of POLE_COVERS) {
    for (const [facing, size, gap, motion, move] of TABLE) {
      it(`${cover} ${facing} ${size} ${gap} cm: ${motion} ${move}`, () => {
        expect(simulateMagnetPoles(p(facing, gap, size, cover)).result).toEqual({ motion, moveCm: move });
      });
    }
  }

  it('사양 표: 작은 자석 같은 극 1·2·4 cm → 4.0·1.0·움직이지 않음 0.0, 큰 자석 같은 극 → 6.0·2.0·0.5, 작은 자석 다른 극 4 cm → 움직이지 않음', () => {
    const r = (facing: PoleFacing, gap: number, size: PoleSize) => simulateMagnetPoles(p(facing, gap, size)).result;
    expect([1, 2, 4].map((g) => r('NN', g, 'small'))).toEqual([{ motion: 'repel', moveCm: 4 }, { motion: 'repel', moveCm: 1 }, { motion: 'none', moveCm: 0 }]);
    expect([1, 2, 4].map((g) => r('SS', g, 'large'))).toEqual([{ motion: 'repel', moveCm: 6 }, { motion: 'repel', moveCm: 2 }, { motion: 'repel', moveCm: 0.5 }]);
    expect(r('NS', 4, 'small')).toEqual({ motion: 'none', moveCm: 0 });
  });

  it('색칠은 모든 조건(36가지)에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const facing of POLE_FACINGS) for (const gap of POLE_GAPS) for (const size of POLE_SIZES) expect(simulateMagnetPoles(p(facing, gap, size, 'gray'))).toEqual(simulateMagnetPoles(p(facing, gap, size, 'color')));
  });

  it('N극–N극과 S극–S극은 같은 결과다 (같은 극)', () => {
    for (const gap of POLE_GAPS) for (const size of POLE_SIZES) expect(simulateMagnetPoles(p('NN', gap, size))).toEqual(simulateMagnetPoles(p('SS', gap, size)));
    expect([isSamePole('NN'), isSamePole('SS'), isSamePole('NS')]).toEqual([true, true, false]);
  });

  it('경계: 힘 F = s / gap², F가 0.1보다 작을 때만 움직이지 않는다 (1/16 = 0.0625 < 0.1, 2/16 = 0.125 ≥ 0.1)', () => {
    expect(forceOf('small', 1)).toBe(1);
    expect(forceOf('small', 2)).toBe(0.25);
    expect(forceOf('small', 4)).toBe(0.0625);
    expect(forceOf('large', 4)).toBe(0.125);
    expect(MIN_FORCE).toBe(0.1);
    expect(motionOf({ facing: 'NN', gapCm: 4, size: 'small' }).motion).toBe('none');
    expect(motionOf({ facing: 'NN', gapCm: 4, size: 'large' }).motion).toBe('repel');
    // 큰 자석 1 cm는 4F = 8이지만 6 cm에서 멈춘다.
    expect(4 * forceOf('large', 1)).toBe(8);
    expect(motionOf({ facing: 'SS', gapCm: 1, size: 'large' }).moveCm).toBe(6);
  });

  it('범주 결과: 같은 극이면 밀려남(또는 움직이지 않음), 다른 극이면 다가와 붙음(또는 움직이지 않음), 나머지 움직임은 없다', () => {
    for (const [facing, , , motion] of TABLE) {
      expect(['attract', 'repel', 'none']).toContain(motion);
      if (facing === 'NS') expect(motion).not.toBe('repel');
      else expect(motion).not.toBe('attract');
    }
  });
});

describe('자석과 자석 사이 모델: 표본', () => {
  it('0~2초 0.05초 간격 41개이고, 처음 거리에서 시작해 1.5초 안에 끝 거리에 이르며 그 뒤 멈춰 있다', () => {
    for (const [facing, size, gap, motion, move] of TABLE) {
      const { samples } = simulateMagnetPoles(p(facing, gap, size));
      expect(samples).toHaveLength(41);
      expect(samples[0]).toEqual({ t: 0, gapCm: gap });
      expect(samples.at(-1)!.t).toBe(2);
      const end = motion === 'attract' ? 0 : motion === 'repel' ? gap + move : gap;
      expect(samples.at(-1)!.gapCm).toBeCloseTo(end, 9);
      for (const s of samples.filter((x) => x.t >= 1.5)) expect(s.gapCm).toBeCloseTo(end, 9);
      // 단조: 다가오면 줄고, 밀려나면 늘고, 안 움직이면 그대로
      for (let i = 1; i < samples.length; i++) {
        const d = samples[i]!.gapCm - samples[i - 1]!.gapCm;
        if (motion === 'attract') expect(d).toBeLessThanOrEqual(1e-9);
        else if (motion === 'repel') expect(d).toBeGreaterThanOrEqual(-1e-9);
        else expect(d).toBe(0);
      }
    }
  });

  it('두 자석 사이 거리는 0 이상 10 cm 이하다 (그래프 고정 범위, 큰 자석 1 cm 밀려남이 가장 멀리 7 cm)', () => {
    let max = 0;
    for (const [facing, size, gap] of TABLE) {
      const g = simulateMagnetPoles(p(facing, gap, size)).samples.map((s) => s.gapCm);
      expect(Math.min(...g)).toBeGreaterThanOrEqual(0);
      max = Math.max(max, ...g);
    }
    expect(max).toBe(7);
  });

  it('선형 보간', () => {
    const { samples } = simulateMagnetPoles(p('NN', 1, 'small'));
    const m = interpolateMagnetPoles(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(0.225, 9);
    expect(m.gapCm).toBeCloseTo((samples[4]!.gapCm + samples[5]!.gapCm) / 2, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateMagnetPoles({ ...p('NS', 1, 'small'), facing: 'EW' as never })).toThrow(RangeError);
    expect(() => simulateMagnetPoles(p('NS', 3, 'small'))).toThrow(RangeError);
    expect(() => simulateMagnetPoles(p('NS', 0, 'small'))).toThrow(RangeError);
    expect(() => simulateMagnetPoles({ ...p('NS', 1, 'small'), size: 'huge' as never })).toThrow(RangeError);
    expect(() => simulateMagnetPoles({ ...p('NS', 1, 'small'), cover: 'blue' as never })).toThrow(RangeError);
  });
});

describe('validateMagnetPolesExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(magnetJson.experiments[1])) as VariableExperiment;

  it('g4-magnet 활동 2 매니페스트는 통과한다', () => {
    expect(validateMagnetPolesExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'cover');
    expect(validateMagnetPolesExperiment(a).join()).toContain('"cover"');
    const b = exp();
    b.variables.find((v) => v.key === 'facing')!.options.push({ value: 'EW', label: 'x' });
    b.variables.find((v) => v.key === 'gapCm')!.options.push({ value: 3, label: 'y' });
    b.variables.find((v) => v.key === 'size')!.options.push({ value: 'huge', label: 'z' });
    b.variables.find((v) => v.key === 'cover')!.options.push({ value: 'blue', label: 'w' });
    expect(validateMagnetPolesExperiment(b)).toHaveLength(4);
  });
});
