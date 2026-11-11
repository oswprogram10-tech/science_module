import { describe, expect, it } from 'vitest';
import type { VariableExperiment } from '@sci/schema';
import {
  PUSH_ACTIONS,
  PUSH_COLORS,
  PUSH_CONTACT_S,
  PUSH_DEFORM_END_S,
  PUSH_DISTANCE_CM,
  PUSH_MOVE_END_S,
  PUSH_OBJECTS,
  PUSH_STRENGTHS,
  PUSH_Y_MAX_CM,
  directionOf,
  interpolatePushPull,
  shapeOf,
  simulatePushPull,
  validatePushPullExperiment,
  type PushAction,
  type PushDirection,
  type PushObject,
  type PushPullParams,
  type PushShape,
  type PushStrength,
} from './pushPull';
import forceJson from '../../../../content/units/g3-force/manifest.json';

const p = (object: PushObject, action: PushAction, strength: PushStrength, color: 'red' | 'blue' = 'red'): PushPullParams => ({ object, action, strength, color });

// 사양 §1 표: [물체, 힘의 세기, 움직인 거리(cm)]
const DIST: [PushObject, PushStrength, number][] = [
  ['cart', 'weak', 30],
  ['cart', 'strong', 80],
  ['ball', 'weak', 20],
  ['ball', 'strong', 50],
  ['clay', 'weak', 2],
  ['clay', 'strong', 5],
];

describe('밀고 당기기 모델: 사양 표(물체 3 × 세기 2 × 밀기·당기기 × 색깔)', () => {
  for (const color of PUSH_COLORS) {
    for (const action of PUSH_ACTIONS) {
      for (const [object, strength, distance] of DIST) {
        const direction: PushDirection = action === 'push' ? 'away' : 'toward';
        const shape: PushShape = object !== 'clay' ? 'same' : action === 'push' ? 'flat' : 'long';
        it(`${color} ${object} ${action} ${strength}: ${distance} cm · ${direction} · ${shape}`, () => {
          expect(simulatePushPull(p(object, action, strength, color)).result).toEqual({ distance, direction, shape });
        });
      }
    }
  }

  it('거리는 밀기와 당기기가 같다', () => {
    for (const o of PUSH_OBJECTS) for (const s of PUSH_STRENGTHS) expect(simulatePushPull(p(o, 'push', s)).result.distance).toBe(simulatePushPull(p(o, 'pull', s)).result.distance);
    expect(PUSH_DISTANCE_CM.cart).toEqual({ weak: 30, strong: 80 });
  });

  it('방향: 밀기는 손에서 멀어지는 쪽, 당기기는 손 쪽으로', () => {
    expect(directionOf('push')).toBe('away');
    expect(directionOf('pull')).toBe('toward');
  });

  it('모양: 찰흙만 변한다(밀기 → 눌려 납작해짐, 당기기 → 길게 늘어남)', () => {
    expect(shapeOf('clay', 'push')).toBe('flat');
    expect(shapeOf('clay', 'pull')).toBe('long');
    for (const o of ['cart', 'ball'] as const) for (const a of PUSH_ACTIONS) expect(shapeOf(o, a)).toBe('same');
  });

  it('대조 변인: 물체 색깔은 결과와 모든 표본에 영향이 없다', () => {
    for (const o of PUSH_OBJECTS) for (const a of PUSH_ACTIONS) for (const s of PUSH_STRENGTHS) expect(simulatePushPull(p(o, a, s, 'red'))).toEqual(simulatePushPull(p(o, a, s, 'blue')));
  });

  it('결과의 거리는 정수이다', () => {
    for (const [o, s] of PUSH_OBJECTS.flatMap((o) => PUSH_STRENGTHS.map((s) => [o, s] as const))) expect(Number.isInteger(simulatePushPull(p(o, 'push', s)).result.distance)).toBe(true);
  });
});

describe('표본: 0~2초, 0.05초 간격', () => {
  const sim = simulatePushPull(p('cart', 'push', 'strong'));
  it('41개 표본이고 시각이 0에서 2까지 0.05씩 늘어난다', () => {
    expect(sim.samples).toHaveLength(41);
    expect(sim.samples[0]!.t).toBe(0);
    expect(sim.samples.at(-1)!.t).toBe(2);
    expect(sim.samples.every((s, i) => i === 0 || Math.abs(s.t - sim.samples[i - 1]!.t - 0.05) < 1e-9)).toBe(true);
  });
  it('처음 거리는 0이고, 손이 닿기 전에는 움직이지 않으며, 1.4초부터는 결과 거리에 멈춘다', () => {
    expect(sim.samples[0]!.distanceCm).toBe(0);
    for (const s of sim.samples.filter((x) => x.t <= PUSH_CONTACT_S)) expect(s.distanceCm).toBe(0);
    for (const s of sim.samples.filter((x) => x.t >= PUSH_MOVE_END_S - 1e-9)) expect(s.distanceCm).toBe(80);
  });
  it('거리는 줄어들지 않고 늘기만 하며 세로축(0~90 cm)을 넘지 않는다', () => {
    for (const o of PUSH_OBJECTS) {
      for (const s of PUSH_STRENGTHS) {
        const list = simulatePushPull(p(o, 'push', s)).samples;
        for (let i = 1; i < list.length; i++) expect(list[i]!.distanceCm).toBeGreaterThanOrEqual(list[i - 1]!.distanceCm);
        expect(Math.max(...list.map((x) => x.distanceCm))).toBeLessThanOrEqual(PUSH_Y_MAX_CM);
      }
    }
  });
  it('모양 변화(deform)는 찰흙만 0에서 1까지 바뀌고 0.55초에 끝난다', () => {
    expect(sim.samples.every((s) => s.deform === 0)).toBe(true);
    const clay = simulatePushPull(p('clay', 'push', 'weak')).samples;
    expect(clay[0]!.deform).toBe(0);
    expect(clay.at(-1)!.deform).toBe(1);
    for (const s of clay.filter((x) => x.t >= PUSH_DEFORM_END_S - 1e-9)) expect(s.deform).toBe(1);
  });
  it('난수가 없어 같은 조건은 같은 표본이다', () => {
    expect(simulatePushPull(p('ball', 'pull', 'weak'))).toEqual(simulatePushPull(p('ball', 'pull', 'weak')));
  });
});

describe('보간·검사', () => {
  it('두 표본 사이를 선형으로 보간한다', () => {
    const a = { t: 0, distanceCm: 10, deform: 0 };
    const b = { t: 1, distanceCm: 20, deform: 1 };
    expect(interpolatePushPull(a, b, 0.5)).toEqual({ t: 0.5, distanceCm: 15, deform: 0.5 });
  });
  it('모델 밖의 값은 RangeError', () => {
    expect(() => simulatePushPull({ ...p('cart', 'push', 'weak'), object: 'x' as never })).toThrow(RangeError);
    expect(() => simulatePushPull({ ...p('cart', 'push', 'weak'), action: 'x' as never })).toThrow(RangeError);
    expect(() => simulatePushPull({ ...p('cart', 'push', 'weak'), strength: 'x' as never })).toThrow(RangeError);
    expect(() => simulatePushPull({ ...p('cart', 'push', 'weak'), color: 'x' as never })).toThrow(RangeError);
  });
  it('매니페스트 검사: 저장소의 활동 3은 통과하고, 없는 변인·모르는 값은 잡는다', () => {
    const exp = (forceJson.experiments as unknown as VariableExperiment[]).find((e) => e.id === 'push-pull')!;
    expect(validatePushPullExperiment(exp)).toEqual([]);
    expect(validatePushPullExperiment({ ...exp, variables: exp.variables.filter((v) => v.key !== 'action') })).toHaveLength(1);
    const bad = structuredClone(exp);
    bad.variables[0]!.options[0]!.value = 'sled';
    expect(validatePushPullExperiment(bad).join()).toContain('sled');
  });
});
