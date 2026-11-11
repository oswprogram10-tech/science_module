import { describe, expect, it } from 'vitest';
import type { ClassificationExperiment, VariableExperiment } from '@sci/schema';
import {
  CABBAGE_BOUNDS,
  MIX_BEAKERS,
  MIX_COLOR_LABEL,
  MIX_DIRECTIONS,
  MIX_DROPS,
  MIX_INDICATORS,
  MIX_SCALE,
  PHENOL_BOUND,
  addedMlOf,
  colorAtDrops,
  colorOf,
  insideValueOf,
  interpolateAcidBaseMix,
  simulateAcidBaseMix,
  slotOf,
  validateAcidBaseMixExperiment,
  volumeMlOf,
  type AcidBaseMixParams,
  type MixColor,
  type MixDirection,
  type MixIndicator,
} from './acidBaseMix';
import acidBaseJson from '../../../../content/units/g6-acid-base/manifest.json';

const p = (drops: number, direction: MixDirection = 'acid', indicator: MixIndicator = 'cabbage', beaker = 50): AcidBaseMixParams => ({ drops, direction, indicator, beaker });
const colorsOf = (direction: MixDirection, indicator: MixIndicator) => MIX_DROPS.map((d) => simulateAcidBaseMix(p(d, direction, indicator)).result.color);

describe('산성 용액과 염기성 용액 섞기 모델: 사양 기준값', () => {
  it('사양 표(염산에 넣기, 붉은 양배추): 0방울 빨간색(붉은색), 10 → 붉은색(p = 1.5), 20 → 보라색(7), 30 → 노란색(p = 12.3), 40 → 노란색(12.5)', () => {
    expect(colorsOf('acid', 'cabbage')).toEqual(['cabRed', 'cabRed', 'cabPurple', 'cabYellow', 'cabYellow']);
    expect(MIX_DROPS.map((d) => Math.round(insideValueOf(d, 'acid') * 10) / 10)).toEqual([1, 1.5, 7, 12.3, 12.5]);
  });

  it('염산에 넣기, 페놀프탈레인: 20방울까지 색 변화 없음, 30방울부터 붉은색', () => {
    expect(colorsOf('acid', 'phenol')).toEqual(['clear', 'clear', 'clear', 'magenta', 'magenta']);
  });

  it('수산화 나트륨 용액에 넣기: 붉은 양배추는 노란색 → 노란색 → 보라색 → 붉은색 → 붉은색, 페놀프탈레인은 붉은색 → 붉은색 → 색 변화 없음 …', () => {
    expect(colorsOf('base', 'cabbage')).toEqual(['cabYellow', 'cabYellow', 'cabPurple', 'cabRed', 'cabRed']);
    expect(colorsOf('base', 'phenol')).toEqual(['magenta', 'magenta', 'clear', 'clear', 'clear']);
    expect(MIX_DROPS.map((d) => Math.round(insideValueOf(d, 'base') * 10) / 10)).toEqual([13, 12.5, 7, 1.7, 1.5]);
  });

  it('두 용액이 같은 양(20방울 = 10 mL, 1.0 mmol)이면 내부 값은 정확히 7이다 (두 방향 모두, 소수 오차 없음)', () => {
    expect(insideValueOf(20, 'acid')).toBe(7);
    expect(insideValueOf(20, 'base')).toBe(7);
  });

  it('부피 = 10 + 0.5 × 방울 수, 넣은 양 = 0.5 × 방울 수(소수 첫째 자리)', () => {
    expect(MIX_DROPS.map(volumeMlOf)).toEqual([10, 15, 20, 25, 30]);
    expect(MIX_DROPS.map(addedMlOf)).toEqual([0, 5, 10, 15, 20]);
    for (const d of MIX_DROPS) expect(simulateAcidBaseMix(p(d)).result.addedMl).toBe(d * 0.5);
  });

  it('색 띠 칸 번호(1부터): 붉은 양배추 6칸, 페놀프탈레인 2칸', () => {
    expect(MIX_SCALE.cabbage.map((c) => slotOf(c, 'cabbage'))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(MIX_SCALE.phenol.map((c) => slotOf(c, 'phenol'))).toEqual([1, 2]);
    expect(simulateAcidBaseMix(p(30)).result).toEqual({ color: 'cabYellow', addedMl: 15, slot: 6 });
    expect(simulateAcidBaseMix(p(20)).result).toEqual({ color: 'cabPurple', addedMl: 10, slot: 3 });
    expect(simulateAcidBaseMix(p(0, 'acid', 'phenol')).result).toEqual({ color: 'clear', addedMl: 0, slot: 1 });
  });

  it('색 이름은 첫 활동(지시약으로 여러 가지 용액 분류하기) 매니페스트의 colors 이름과 같다', () => {
    const first = acidBaseJson.experiments[0] as unknown as ClassificationExperiment;
    for (const c of Object.keys(MIX_COLOR_LABEL) as MixColor[]) expect(MIX_COLOR_LABEL[c], c).toBe(first.colors[c]!.label);
  });

  it('내부 값→색 경계는 첫 활동 매니페스트의 지시약 경계와 같다', () => {
    const first = acidBaseJson.experiments[0] as unknown as ClassificationExperiment;
    const cab = first.indicators.find((i) => i.key === 'cabbage')!;
    expect(cab.colors.slice(0, -1).map((c) => c.max)).toEqual([...CABBAGE_BOUNDS]);
    expect(first.indicators.find((i) => i.key === 'phenol')!.colors[0]!.max).toBe(PHENOL_BOUND);
    for (const c of MIX_SCALE.cabbage) expect(cab.colors.map((x) => x.color)).toContain(c);
  });

  it('사양의 경계(빨강 < 3, 분홍 < 6, 보라 < 8, 푸른 < 10, 초록 < 12)와 이 단원 경계(2.5, 6, 8, 10.5, 12)는 도달할 수 있는 모든 값(40가지 조건)에서 같은 색을 낸다', () => {
    const specColor = (v: number): MixColor => (v < 3 ? 'cabRed' : v < 6 ? 'cabPink' : v < 8 ? 'cabPurple' : v < 10 ? 'cabBlue' : v < 12 ? 'cabGreen' : 'cabYellow');
    for (const direction of MIX_DIRECTIONS) for (const d of MIX_DROPS) expect(colorOf(insideValueOf(d, direction), 'cabbage'), `${direction} ${d}`).toBe(specColor(insideValueOf(d, direction)));
  });

  it('색 경계: 지시약 색은 내부 값 순서로 바뀐다', () => {
    expect([2.4, 2.5, 5.9, 6, 7.9, 8, 10.4, 10.5, 11.9, 12].map((v) => colorOf(v, 'cabbage'))).toEqual(['cabRed', 'cabPink', 'cabPink', 'cabPurple', 'cabPurple', 'cabBlue', 'cabBlue', 'cabGreen', 'cabGreen', 'cabYellow']);
    expect([8.1, 8.2, 8.3].map((v) => colorOf(v, 'phenol'))).toEqual(['clear', 'magenta', 'magenta']);
  });

  it('비커 크기는 모든 조건(40가지)에서 결과와 표본을 바꾸지 않는다 (대조 변인)', () => {
    for (const direction of MIX_DIRECTIONS) for (const indicator of MIX_INDICATORS) for (const d of MIX_DROPS) expect(simulateAcidBaseMix(p(d, direction, indicator, 100))).toEqual(simulateAcidBaseMix(p(d, direction, indicator, 50)));
    expect(MIX_BEAKERS).toEqual([50, 100]);
  });

  it('두 방향은 방울 수를 바꿔 가며 서로 거울이다: 같은 방울 수에서 색이 한쪽 끝에서 반대쪽 끝으로 간다', () => {
    expect(colorAtDrops(0, 'acid', 'cabbage')).toBe('cabRed');
    expect(colorAtDrops(0, 'base', 'cabbage')).toBe('cabYellow');
    expect(colorAtDrops(40, 'acid', 'cabbage')).toBe('cabYellow');
    expect(colorAtDrops(40, 'base', 'cabbage')).toBe('cabRed');
  });
});

describe('산성 용액과 염기성 용액 섞기 모델: 표본', () => {
  it('0~3초 0.1초 간격 31개이고, 방울 수는 0에서 시작해 끝에 고른 방울 수에 이르며 줄지 않는다', () => {
    for (const direction of MIX_DIRECTIONS) for (const indicator of MIX_INDICATORS) for (const d of MIX_DROPS) {
      const { samples, result } = simulateAcidBaseMix(p(d, direction, indicator));
      expect(samples).toHaveLength(31);
      expect(samples[0]!.drops).toBe(0);
      expect(samples.at(-1)).toEqual({ t: 3, drops: d, slot: result.slot });
      expect(samples[0]!.slot).toBe(slotOf(colorAtDrops(0, direction, indicator), indicator));
      for (let i = 1; i < samples.length; i++) {
        expect(Number.isInteger(samples[i]!.drops)).toBe(true);
        expect(samples[i]!.drops).toBeGreaterThanOrEqual(samples[i - 1]!.drops);
      }
    }
  });

  it('선형 보간', () => {
    const { samples } = simulateAcidBaseMix(p(40));
    const m = interpolateAcidBaseMix(samples[10]!, samples[11]!, 0.5);
    expect(m.t).toBeCloseTo(1.05, 9);
    expect(m.drops).toBeCloseTo((samples[10]!.drops + samples[11]!.drops) / 2, 9);
  });

  it('범위 밖 입력은 거부한다', () => {
    expect(() => simulateAcidBaseMix(p(15))).toThrow(RangeError);
    expect(() => simulateAcidBaseMix(p(50))).toThrow(RangeError);
    expect(() => simulateAcidBaseMix({ ...p(0), direction: 'both' as never })).toThrow(RangeError);
    expect(() => simulateAcidBaseMix({ ...p(0), indicator: 'litmus' as never })).toThrow(RangeError);
    expect(() => simulateAcidBaseMix(p(0, 'acid', 'cabbage', 70))).toThrow(RangeError);
  });
});

describe('validateAcidBaseMixExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(acidBaseJson.experiments[1])) as VariableExperiment;

  it('g6-acid-base 활동 2 매니페스트는 통과한다', () => {
    expect(validateAcidBaseMixExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'beaker');
    expect(validateAcidBaseMixExperiment(a).join()).toContain('"beaker"');
    const b = exp();
    b.variables.find((v) => v.key === 'drops')!.options.push({ value: 5, label: 'x' });
    b.variables.find((v) => v.key === 'direction')!.options.push({ value: 'both', label: 'y' });
    b.variables.find((v) => v.key === 'indicator')!.options.push({ value: 'litmus', label: 'z' });
    b.variables.find((v) => v.key === 'beaker')!.options.push({ value: 70, label: 'w' });
    expect(validateAcidBaseMixExperiment(b)).toHaveLength(4);
  });
});
