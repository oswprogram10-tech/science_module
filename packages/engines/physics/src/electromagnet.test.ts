import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  headPoleOf,
  interpolateElectromagnet,
  simulateElectromagnet,
  validateElectromagnetExperiment,
  type BatteryKind,
  type ElectromagnetParams,
} from './electromagnet';
import electricityJson from '../../../../content/units/g6-electricity/manifest.json';

const mag = (turns: number, battery: BatteryKind, core: 'nail' | 'straw' = 'nail', direction: 'forward' | 'reverse' = 'forward'): ElectromagnetParams => ({
  turns,
  battery,
  core,
  direction,
});
const run = (p: ElectromagnetParams) => simulateElectromagnet(p);

// 사양 §2.3: [감은 횟수, 전지, 철못일 때 클립 수, 최고 온도, 뜨거움]
const TABLE: [number, BatteryKind, number, number, boolean][] = [
  [50, 'one', 9, 27.0, false],
  [50, 'series', 18, 48.0, true],
  [50, 'parallel', 9, 27.0, false],
  [100, 'one', 12, 24.7, false],
  [100, 'series', 25, 38.6, false],
  [100, 'parallel', 12, 24.7, false],
  [200, 'one', 15, 22.8, false],
  [200, 'series', 30, 31.2, false],
  [200, 'parallel', 15, 22.8, false],
];
// 빨대만: 100·200회 직렬은 1개, 나머지는 0개
const strawClips = (turns: number, battery: BatteryKind) => (battery === 'series' && turns >= 100 ? 1 : 0);

describe('전자석 모델: 사양 기준값 9칸(철못)', () => {
  for (const [turns, battery, clips, wireC, hot] of TABLE) {
    it(`${turns}회, ${battery}`, () => {
      const r = run(mag(turns, battery)).result;
      expect(r.clipsMax).toBe(clips);
      expect(r.wireMaxC).toBe(wireC);
      expect(r.hot).toBe(hot);
      expect(r.headPole).toBe('N');
    });
  }
});

describe('전자석 모델: 빨대 9칸', () => {
  for (const [turns, battery] of TABLE) {
    it(`${turns}회, ${battery}`, () => {
      const r = run(mag(turns, battery, 'straw')).result;
      expect(r.clipsMax).toBe(strawClips(turns, battery));
      // 온도는 속 재료와 상관없다.
      expect(r.wireMaxC).toBe(run(mag(turns, battery)).result.wireMaxC);
    });
  }
});

describe('전자석 모델: 성질', () => {
  it('병렬과 1개는 모든 감은 횟수와 속 재료에서 결과와 샘플이 같다', () => {
    for (const turns of [50, 100, 200, 10, 500]) {
      for (const core of ['nail', 'straw'] as const) {
        expect(run(mag(turns, 'parallel', core))).toEqual(run(mag(turns, 'one', core)));
      }
    }
  });

  it('방향만 바꾸면 clipsMax와 wireMaxC가 같고 headPole만 반대다', () => {
    for (const [turns, battery] of TABLE) {
      for (const core of ['nail', 'straw'] as const) {
        const a = run(mag(turns, battery, core, 'forward'));
        const b = run(mag(turns, battery, core, 'reverse'));
        expect(b.result.clipsMax).toBe(a.result.clipsMax);
        expect(b.result.wireMaxC).toBe(a.result.wireMaxC);
        expect(a.result.headPole).toBe('N');
        expect(b.result.headPole).toBe('S');
        expect(b.samples).toEqual(a.samples);
      }
    }
    expect(headPoleOf('forward')).toBe('N');
    expect(headPoleOf('reverse')).toBe('S');
  });

  it('onS 이전과 offS 이후 샘플은 clips 0, on 0, flow 0이고, 켜진 동안은 on 1이다', () => {
    for (const [turns, battery] of TABLE) {
      const { samples } = run(mag(turns, battery));
      for (const s of samples) {
        if (s.t < 2 || s.t >= 14) expect(s, `t=${s.t}`).toMatchObject({ clips: 0, on: 0, flow: 0 });
        else expect(s.on, `t=${s.t}`).toBe(1);
      }
      expect(samples.some((s) => s.t >= 14)).toBe(true);
    }
  });

  it('끊기는 순간을 놓치지 않도록 offS 직전과 직후에 표본이 있다', () => {
    const { samples } = run(mag(100, 'one'));
    const before = samples.filter((s) => s.t < 14).at(-1)!;
    expect(14 - before.t).toBeLessThan(0.01);
    expect(before.on).toBe(1);
    expect(before.clips).toBeGreaterThan(11.99);
    expect(samples.find((s) => s.t === 14)).toMatchObject({ clips: 0, on: 0 });
    // 시각은 오름차순이고 중복이 없다.
    for (let i = 1; i < samples.length; i++) expect(samples[i]!.t).toBeGreaterThan(samples[i - 1]!.t);
    // 표본 간격이 offS에 맞지 않아도 직전·직후 표본이 들어간다.
    const odd = simulateElectromagnet(mag(100, 'one'), { sampleEvery: 0.3 });
    expect(odd.samples.filter((s) => s.t < 14).at(-1)!.t).toBeGreaterThan(13.99);
    expect(odd.samples.find((s) => s.t >= 14)!.t).toBe(14);
    expect(odd.result.wireMaxC).toBe(24.7);
  });

  it('켜진 동안 clips는 단조 증가하고, 끈 뒤 wireC는 단조 감소한다', () => {
    for (const [turns, battery] of TABLE) {
      const { samples } = run(mag(turns, battery));
      const onSamples = samples.filter((s) => s.on === 1);
      for (let i = 1; i < onSamples.length; i++) {
        expect(onSamples[i]!.clips).toBeGreaterThanOrEqual(onSamples[i - 1]!.clips); // 거의 다 붙은 뒤에는 부동소수점 오차 안에서 같다
        expect(onSamples[i]!.wireC).toBeGreaterThan(onSamples[i - 1]!.wireC);
      }
      const after = samples.filter((s) => s.t >= 14);
      for (let i = 1; i < after.length; i++) expect(after[i]!.wireC).toBeLessThan(after[i - 1]!.wireC);
      expect(after[0]!.wireC).toBeGreaterThan(20);
      expect(samples.every((s) => s.wireC >= 20)).toBe(true);
    }
  });

  it('clips는 clipsMax를 넘지 않고 flow는 켜져 있을 때만 I다', () => {
    const { samples, result } = run(mag(100, 'one'));
    expect(Math.max(...samples.map((s) => s.clips))).toBeLessThanOrEqual(result.clipsMax);
    expect(samples.find((s) => s.on === 1)!.flow).toBeCloseTo(1.0, 9);
    expect(run(mag(100, 'series')).samples.find((s) => s.on === 1)!.flow).toBeCloseTo(2.0, 9);
  });

  it('같은 입력은 같은 출력이다 (난수 없음)', () => {
    expect(run(mag(100, 'series', 'straw', 'reverse'))).toEqual(run(mag(100, 'series', 'straw', 'reverse')));
  });

  it('범위를 벗어난 입력은 RangeError', () => {
    expect(() => run(mag(9, 'one'))).toThrow(RangeError);
    expect(() => run(mag(501, 'one'))).toThrow(RangeError);
    expect(() => run({ ...mag(100, 'one'), battery: 'x' as 'one' })).toThrow(RangeError);
    expect(() => run({ ...mag(100, 'one'), core: 'x' as 'nail' })).toThrow(RangeError);
    expect(() => run({ ...mag(100, 'one'), direction: 'x' as 'forward' })).toThrow(RangeError);
  });

  it('보간은 두 샘플 사이를 선형으로 잇는다', () => {
    const m = interpolateElectromagnet(
      { t: 0, clips: 0, wireC: 20, flow: 0, on: 0 },
      { t: 10, clips: 8, wireC: 40, flow: 2, on: 1 },
      0.25,
    );
    expect(m).toEqual({ t: 2.5, clips: 2, wireC: 25, flow: 0.5, on: 0.25 });
  });
});

describe('전자석 매니페스트 검증', () => {
  const exp = (electricityJson as unknown as { experiments: VariableExperiment[] }).experiments[0]!;
  const clone = (): VariableExperiment => JSON.parse(JSON.stringify(exp));

  it('g6-electricity 매니페스트는 통과한다', () => {
    expect(validateElectromagnetExperiment(exp)).toEqual([]);
  });

  it('변인이 없으면 오류', () => {
    const e = clone();
    e.variables = e.variables.filter((v) => v.key !== 'direction');
    expect(validateElectromagnetExperiment(e)).toEqual(['변인 "direction"이(가) 없습니다.']);
  });

  it('허용 범위를 벗어난 값은 오류', () => {
    const e = clone();
    e.variables.find((v) => v.key === 'turns')!.options.push({ value: 5, label: '5회' });
    e.variables.find((v) => v.key === 'battery')!.options.push({ value: 'three', label: '3개' });
    e.variables.find((v) => v.key === 'core')!.options.push({ value: 'wood', label: '나무' });
    e.variables.find((v) => v.key === 'direction')!.options.push({ value: 'up', label: '위' });
    expect(validateElectromagnetExperiment(e)).toHaveLength(4);
  });
});
