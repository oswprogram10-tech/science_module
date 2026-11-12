import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  MC_CELL_UM,
  MC_FOCUS,
  MC_LABELS,
  MC_POWERS,
  MC_SAMPLES,
  MC_SEEN,
  MC_STAINS,
  interpolateMicroscope,
  microscopeSeenOf,
  microscopeSizeOf,
  simulateMicroscope,
  validateMicroscopeExperiment,
  type McFocus,
  type McLabel,
  type McPower,
  type McSample,
  type McStain,
  type MicroscopeParams,
} from './microscope';
import plantJson from '../../../../content/units/g6-plant/manifest.json';

const p = (power: McPower, focus: McFocus, stain: McStain, sample: McSample, slideLabel: McLabel = 'yellow'): MicroscopeParams => ({ power, focus, stain, sample, slideLabel });

describe('현미경으로 세포 관찰하기 모델: 칸 길이 = 실제 길이 × 배율(정수), 초점이 맞지 않으면 NaN', () => {
  // 사양 §3 표 고정: 양파 칸 0.25 mm 길이(40배 10, 100배 25, 400배 100), 입안 칸 0.06 mm(40배 2, 100배 6, 400배 24)
  const SIZES: [McSample, McPower, number][] = [['onion', 40, 10], ['onion', 100, 25], ['onion', 400, 100], ['cheek', 40, 2], ['cheek', 100, 6], ['cheek', 400, 24]];
  for (const [sample, power, size] of SIZES) {
    it(`${sample} ${power}배, 초점을 맞추면 칸 길이 ${size} mm(염색·이름표 색과 상관없음)`, () => {
      for (const stain of MC_STAINS) for (const label of MC_LABELS) expect(simulateMicroscope(p(power, 'on', stain, sample, label)).result.size).toBe(size);
    });
  }

  it('초점을 맞추지 않으면 모든 조건에서 칸 길이가 NaN이고 흐릿함이다', () => {
    for (const power of MC_POWERS) for (const stain of MC_STAINS) for (const sample of MC_SAMPLES) for (const label of MC_LABELS) {
      const { result, samples } = simulateMicroscope(p(power, 'off', stain, sample, label));
      expect(result.size).toBeNaN();
      expect(result.seen).toBe('흐릿함');
      expect(samples.every((s) => Number.isNaN(s.size) && s.sharp === 0)).toBe(true);
    }
  });

  it('보인 것: 맞춤·염색 안 함 투명한 칸들, 맞춤·염색함 40배 색이 든 칸들, 100·400배 칸마다 진한 점이 있음', () => {
    for (const sample of MC_SAMPLES) {
      for (const power of MC_POWERS) {
        expect(simulateMicroscope(p(power, 'on', 'none', sample)).result.seen).toBe('투명한 칸들');
        expect(simulateMicroscope(p(power, 'on', 'iodine', sample)).result.seen).toBe(power === 40 ? '색이 든 칸들' : '칸마다 진한 점이 있음');
      }
    }
    expect(Object.values(MC_SEEN)).toEqual(['흐릿함', '투명한 칸들', '색이 든 칸들', '칸마다 진한 점이 있음']);
  });

  it('받침 유리 이름표 색은 모든 조건에서 결과와 표본을 바꾸지 않는다 (대조 변인, NaN은 NaN끼리 같다)', () => {
    for (const power of MC_POWERS) for (const focus of MC_FOCUS) for (const stain of MC_STAINS) for (const sample of MC_SAMPLES) {
      expect(simulateMicroscope(p(power, focus, stain, sample, 'green'))).toEqual(simulateMicroscope(p(power, focus, stain, sample, 'yellow')));
    }
  });

  it('칸 길이는 정수이고 100 이하이며, 배율이 클수록 같은 재료의 칸 길이가 커진다(모델 표)', () => {
    for (const sample of MC_SAMPLES) {
      const sizes = MC_POWERS.map((power) => microscopeSizeOf({ power, focus: 'on', sample }));
      sizes.forEach((s) => {
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeLessThanOrEqual(100);
      });
      expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    }
    // 양파 칸이 입안 칸보다 길다(같은 배율).
    for (const power of MC_POWERS) expect(microscopeSizeOf({ power, focus: 'on', sample: 'onion' })).toBeGreaterThan(microscopeSizeOf({ power, focus: 'on', sample: 'cheek' }));
    expect(MC_CELL_UM).toEqual({ onion: 250, cheek: 60 });
    expect(microscopeSeenOf({ power: 100, focus: 'on', stain: 'iodine' })).toBe('칸마다 진한 점이 있음');
  });

  it('0~2초 0.05초 간격 41개: 초점을 맞추면 칸 길이가 0에서 시작해 1.2초 안에 결과에 이르고 그 뒤 멈춰 있다', () => {
    for (const [sample, power, size] of SIZES) {
      const { samples } = simulateMicroscope(p(power, 'on', 'none', sample));
      expect(samples).toHaveLength(41);
      expect(samples[0]).toEqual({ t: 0, size: 0, sharp: 0 });
      expect(samples.at(-1)!.t).toBe(2);
      expect(samples.at(-1)!.size).toBeCloseTo(size, 9);
      expect(samples.at(-1)!.sharp).toBe(1);
      for (const s of samples.filter((x) => x.t >= 1.2)) expect(s.size).toBeCloseTo(size, 9);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.size - samples[i - 1]!.size).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('선형 보간(NaN은 NaN으로 남는다)과 범위 밖 입력 거부', () => {
    const on = simulateMicroscope(p(400, 'on', 'none', 'onion')).samples;
    const m = interpolateMicroscope(on[4]!, on[5]!, 0.5);
    expect(m.t).toBeCloseTo(0.225, 9);
    expect(m.size).toBeCloseTo((on[4]!.size + on[5]!.size) / 2, 9);
    const off = simulateMicroscope(p(400, 'off', 'none', 'onion')).samples;
    expect(interpolateMicroscope(off[4]!, off[5]!, 0.5).size).toBeNaN();
    expect(() => simulateMicroscope({ ...p(40, 'on', 'none', 'onion'), power: 200 as never })).toThrow(RangeError);
    expect(() => simulateMicroscope({ ...p(40, 'on', 'none', 'onion'), focus: 'half' as never })).toThrow(RangeError);
    expect(() => simulateMicroscope({ ...p(40, 'on', 'none', 'onion'), stain: 'red' as never })).toThrow(RangeError);
    expect(() => simulateMicroscope({ ...p(40, 'on', 'none', 'onion'), sample: 'leaf' as never })).toThrow(RangeError);
    expect(() => simulateMicroscope({ ...p(40, 'on', 'none', 'onion'), slideLabel: 'blue' as never })).toThrow(RangeError);
  });
});

describe('validateMicroscopeExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(plantJson.experiments[1])) as VariableExperiment;

  it('g6-plant 활동 2 매니페스트는 통과한다', () => {
    expect(validateMicroscopeExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'slideLabel');
    expect(validateMicroscopeExperiment(a).join()).toContain('"slideLabel"');
    const b = exp();
    b.variables.find((v) => v.key === 'power')!.options.push({ value: 200, label: 'x' });
    b.variables.find((v) => v.key === 'focus')!.options.push({ value: 'half', label: 'y' });
    expect(validateMicroscopeExperiment(b)).toHaveLength(2);
  });
});
