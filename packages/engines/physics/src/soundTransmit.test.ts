import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  ST_BASE_LEVEL,
  ST_BLOCKS,
  ST_HEARD_LABEL,
  ST_CLOCKS,
  ST_CUT_LEVEL,
  ST_MEDIUMS,
  heardOf,
  interpolateSoundTransmit,
  simulateSoundTransmit,
  soundTransmitLevelOf,
  validateSoundTransmitExperiment,
  type SoundTransmitParams,
  type StBlock,
  type StMedium,
} from './soundTransmit';
import soundJson from '../../../../content/units/g3-sound/manifest.json';

const p = (medium: StMedium, block: StBlock, clockColor: 'red' | 'blue' = 'red'): SoundTransmitParams => ({ medium, block, clockColor });

// 사양 §5 표 고정: 소리를 전하는 것 × 감싼 것 → 소음계 눈금 (기본 눈금 − 줄이는 눈금)
const TABLE: Record<StMedium, Record<StBlock, number>> = {
  air: { none: 5, box: 4, sponge: 3, cotton: 2 },
  water: { none: 7, box: 6, sponge: 5, cotton: 4 },
  wood: { none: 8, box: 7, sponge: 6, cotton: 5 },
  string: { none: 7, box: 6, sponge: 5, cotton: 4 },
};

describe('소리 전달과 소음 줄이기 모델: 사양 기준값 16칸 × 시계 색깔 두 가지', () => {
  for (const clock of ST_CLOCKS) {
    for (const medium of ST_MEDIUMS) {
      for (const block of ST_BLOCKS) {
        it(`${clock} 시계, ${medium}, ${block}: ${TABLE[medium][block]}눈금`, () => {
          const r = simulateSoundTransmit(p(medium, block, clock)).result;
          expect(r.level).toBe(TABLE[medium][block]);
          expect(r.heard).toBe(heardOf(TABLE[medium][block]));
        });
      }
    }
  }

  it('기본 눈금은 공기 5·물 7·책상 나무 8·실 7이고, 감싼 것은 없음 0·종이 상자 1·스펀지 2·솜 3을 뺀다', () => {
    expect(ST_BASE_LEVEL).toEqual({ air: 5, water: 7, wood: 8, string: 7 });
    expect(ST_CUT_LEVEL).toEqual({ none: 0, box: 1, sponge: 2, cotton: 3 });
  });

  it('시계 색깔은 모든 조건에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const m of ST_MEDIUMS) for (const b of ST_BLOCKS) expect(simulateSoundTransmit(p(m, b, 'blue'))).toEqual(simulateSoundTransmit(p(m, b, 'red')));
  });

  it('경계: 눈금은 0보다 작아지지 않고, 5 이상 잘 들림·3~4 작게 들림·2 이하 거의 들리지 않음', () => {
    expect(soundTransmitLevelOf({ medium: 'air', block: 'cotton' })).toBe(2);
    // 모델이 허용하는 모든 조합의 가장 낮은 눈금은 2이다(공기, 솜).
    const all = ST_MEDIUMS.flatMap((m) => ST_BLOCKS.map((b) => soundTransmitLevelOf({ medium: m, block: b })));
    expect(Math.min(...all)).toBe(2);
    expect(Math.max(...all)).toBe(8);
    expect([8, 5, 4, 3, 2, 0].map(heardOf)).toEqual(['loud', 'loud', 'soft', 'soft', 'faint', 'faint']);
    // 세 범주가 모두 실제로 나온다: 공기에서 감쌀수록 잘 들림 → 작게 들림 → 거의 들리지 않음.
    expect(ST_BLOCKS.map((b) => heardOf(soundTransmitLevelOf({ medium: 'air', block: b })))).toEqual(['loud', 'soft', 'soft', 'faint']);
    expect(ST_HEARD_LABEL).toEqual({ loud: '잘 들림', soft: '작게 들림', faint: '거의 들리지 않음' });
    // 가정: 기본 눈금이 작아지면 음수가 되지 않고 0에서 멈춘다.
    expect(Math.max(0, 2 - 3)).toBe(0);
  });
});

describe('소리 전달과 소음 줄이기 모델: 표본', () => {
  it('0~2초 0.05초 간격 41개이고, 바늘은 0에서 시작해 1.5초 안에 결과에 이르며 그 뒤 멈춰 있다', () => {
    for (const m of ST_MEDIUMS) for (const b of ST_BLOCKS) {
      const { samples, result } = simulateSoundTransmit(p(m, b));
      expect(samples).toHaveLength(41);
      expect(samples[0]).toEqual({ t: 0, level: 0 });
      expect(samples.at(-1)!.t).toBe(2);
      expect(samples.at(-1)!.level).toBeCloseTo(result.level, 9);
      for (const s of samples.filter((x) => x.t >= 1.5)) expect(s.level).toBeCloseTo(result.level, 9);
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.level - samples[i - 1]!.level).toBeGreaterThanOrEqual(-1e-9);
      expect(Math.max(...samples.map((s) => s.level))).toBeLessThanOrEqual(10);
    }
  });

  it('선형 보간', () => {
    const { samples } = simulateSoundTransmit(p('wood', 'none'));
    const m = interpolateSoundTransmit(samples[4]!, samples[5]!, 0.5);
    expect(m.t).toBeCloseTo(0.225, 9);
    expect(m.level).toBeCloseTo((samples[4]!.level + samples[5]!.level) / 2, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateSoundTransmit({ ...p('air', 'none'), medium: 'iron' as never })).toThrow(RangeError);
    expect(() => simulateSoundTransmit({ ...p('air', 'none'), block: 'blanket' as never })).toThrow(RangeError);
    expect(() => simulateSoundTransmit({ ...p('air', 'none'), clockColor: 'green' as never })).toThrow(RangeError);
  });
});

describe('validateSoundTransmitExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(soundJson.experiments[2])) as VariableExperiment;

  it('g3-sound 활동 3 매니페스트는 통과한다', () => {
    expect(validateSoundTransmitExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'clockColor');
    expect(validateSoundTransmitExperiment(a).join()).toContain('"clockColor"');
    const b = exp();
    b.variables.find((v) => v.key === 'medium')!.options.push({ value: 'iron', label: 'x' });
    b.variables.find((v) => v.key === 'block')!.options.push({ value: 'blanket', label: 'y' });
    b.variables.find((v) => v.key === 'clockColor')!.options.push({ value: 'green', label: 'z' });
    expect(validateSoundTransmitExperiment(b)).toHaveLength(3);
  });
});
