import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  TH_EYES,
  TH_FEELS,
  TH_HANDS,
  TH_TARGETS,
  TH_TOOLS,
  feelOf,
  interpolateThermometer,
  readingOf,
  simulateThermometer,
  validateThermometerExperiment,
  type ThEye,
  type ThFeel,
  type ThHand,
  type ThTarget,
  type ThTool,
  type ThermometerParams,
} from './thermometer';
import heatJson from '../../../../content/units/g5-heat/manifest.json';

const p = (hand: ThHand, target: ThTarget, tool: ThTool, eye: ThEye = 'level'): ThermometerParams => ({ hand, target, tool, eye });

describe('온도계로 온도 재기 모델: 눈금', () => {
  it('실제 온도: 미지근한 물 25, 철봉 22, 나무 판 22 (알코올 온도계를 같은 높이에서, 또는 적외선)', () => {
    for (const [target, c] of [['water', 25], ['rod', 22], ['wood', 22]] as const) {
      expect(simulateThermometer(p('none', target, 'alcohol', 'level')).result.reading).toBe(c);
      for (const eye of TH_EYES) expect(simulateThermometer(p('none', target, 'ir', eye)).result.reading, `${target} ${eye}`).toBe(c);
    }
  });

  it('알코올 온도계는 위에서 읽으면 +1, 아래에서 읽으면 −1이다', () => {
    expect(simulateThermometer(p('none', 'water', 'alcohol', 'above')).result.reading).toBe(26);
    expect(simulateThermometer(p('none', 'water', 'alcohol', 'below')).result.reading).toBe(24);
    expect(simulateThermometer(p('none', 'rod', 'alcohol', 'above')).result.reading).toBe(23);
    expect(simulateThermometer(p('none', 'wood', 'alcohol', 'below')).result.reading).toBe(21);
    expect(readingOf({ target: 'water', tool: 'alcohol', eye: 'above' })).toBe(26);
  });

  it('눈높이는 적외선 온도계에 영향이 없고, 손을 넣었던 물은 눈금에 영향이 없다', () => {
    for (const hand of TH_HANDS) for (const target of TH_TARGETS) {
      for (const eye of TH_EYES) expect(simulateThermometer(p(hand, target, 'ir', eye)).result.reading).toBe(simulateThermometer(p(hand, target, 'ir', 'level')).result.reading);
      for (const tool of TH_TOOLS) expect(simulateThermometer(p(hand, target, tool)).result.reading).toBe(simulateThermometer(p('none', target, tool)).result.reading);
    }
  });
});

describe('온도계로 온도 재기 모델: 손 느낌', () => {
  const FEEL: [ThHand, ThTarget, ThFeel][] = [
    ['none', 'water', 'lukewarm'],
    ['none', 'rod', 'cold'],
    ['none', 'wood', 'lukewarm'],
    ['cold', 'water', 'warm'],
    ['cold', 'rod', 'lukewarm'],
    ['cold', 'wood', 'warm'],
    ['warm', 'water', 'cold'],
    ['warm', 'rod', 'cold'],
    ['warm', 'wood', 'cold'],
  ];
  for (const [hand, target, feel] of FEEL) {
    it(`손 ${hand}, ${target}: ${feel}`, () => {
      expect(feelOf({ hand, target })).toBe(feel);
      for (const tool of TH_TOOLS) for (const eye of TH_EYES) expect(simulateThermometer(p(hand, target, tool, eye)).result.feel).toBe(feel);
    });
  }

  it('철봉과 나무 판은 온도가 같아도 손 느낌이 다르다(차갑게 / 미지근하게)', () => {
    expect(simulateThermometer(p('none', 'rod', 'ir')).result.reading).toBe(simulateThermometer(p('none', 'wood', 'ir')).result.reading);
    expect(feelOf({ hand: 'none', target: 'rod' })).not.toBe(feelOf({ hand: 'none', target: 'wood' }));
    expect(TH_FEELS).toEqual(['cold', 'lukewarm', 'warm']);
  });
});

describe('온도계로 온도 재기 모델: 표본', () => {
  it('0~2초 0.05초 간격 41개이고, 눈금은 20 °C에서 시작해 1.5초 안에 읽은 값에 이르며 손 느낌은 처음엔 없다', () => {
    const { samples, result } = simulateThermometer(p('none', 'water', 'alcohol', 'above'));
    expect(samples).toHaveLength(41);
    expect(samples[0]).toEqual({ t: 0, level: 20, trueC: 20, felt: 0 });
    expect(samples.at(-1)).toEqual({ t: 2, level: 26, trueC: 25, felt: 1 });
    expect(result.reading).toBe(26);
    for (const s of samples.filter((x) => x.t >= 1.5)) expect([s.level, s.trueC, s.felt]).toEqual([26, 25, 1]);
    for (let i = 1; i < samples.length; i++) expect(samples[i]!.level).toBeGreaterThanOrEqual(samples[i - 1]!.level - 1e-9);
  });

  it('센서가 보는 실제 온도(trueC)에는 눈높이가 영향이 없다', () => {
    for (const eye of TH_EYES) expect(simulateThermometer(p('none', 'rod', 'alcohol', eye)).samples.map((s) => s.trueC)).toEqual(simulateThermometer(p('none', 'rod', 'alcohol')).samples.map((s) => s.trueC));
  });

  it('선형 보간과 범위 밖 입력 거부', () => {
    const { samples } = simulateThermometer(p('none', 'water', 'ir'));
    const m = interpolateThermometer(samples[4]!, samples[5]!, 0.5);
    expect(m.level).toBeCloseTo((samples[4]!.level + samples[5]!.level) / 2, 9);
    expect(m.felt).toBeCloseTo((samples[4]!.felt + samples[5]!.felt) / 2, 9);
    expect(() => simulateThermometer({ ...p('none', 'water', 'ir'), hand: 'hot' as never })).toThrow(RangeError);
    expect(() => simulateThermometer({ ...p('none', 'water', 'ir'), target: 'iron' as never })).toThrow(RangeError);
    expect(() => simulateThermometer({ ...p('none', 'water', 'ir'), tool: 'digital' as never })).toThrow(RangeError);
    expect(() => simulateThermometer({ ...p('none', 'water', 'ir'), eye: 'side' as never })).toThrow(RangeError);
  });
});

describe('validateThermometerExperiment', () => {
  const exp = () => JSON.parse(JSON.stringify(heatJson.experiments[2])) as VariableExperiment;

  it('g5-heat 활동 3 매니페스트는 통과한다', () => {
    expect(validateThermometerExperiment(exp())).toEqual([]);
  });

  it('변인이 없거나 값이 모델 밖이면 오류를 돌려준다', () => {
    const a = exp();
    a.variables = a.variables.filter((v) => v.key !== 'eye');
    expect(validateThermometerExperiment(a).join()).toContain('"eye"');
    const b = exp();
    b.variables.find((v) => v.key === 'hand')!.options.push({ value: 'hot', label: 'x' });
    b.variables.find((v) => v.key === 'target')!.options.push({ value: 'iron', label: 'y' });
    b.variables.find((v) => v.key === 'tool')!.options.push({ value: 'digital', label: 'z' });
    b.variables.find((v) => v.key === 'eye')!.options.push({ value: 'side', label: 'w' });
    expect(validateThermometerExperiment(b)).toHaveLength(4);
  });
});
