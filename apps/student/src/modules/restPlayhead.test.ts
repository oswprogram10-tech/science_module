import { describe, expect, it } from 'vitest';
import type { Trial } from '@sci/runtime';
import { UNITS } from '../units';
import { restPlayheadOf } from './restPlayhead';
import type { AnyModule } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTrial = Trial<any, any>;
// 단원의 첫 활동만이 아니라 모든 활동을 본다(예: 땅의 변화의 두 번째 활동인 흐르는 물 실험).
const variableUnits = UNITS.flatMap((u) =>
  // 첫 활동은 단원 id 그대로, 두 번째부터는 '단원/활동' id로 구분한다(예: g4-land/stream-table).
  u.ok
    ? u.activities.flatMap((a, i) =>
        a.activity === 'variable' ? [{ ...u, id: i === 0 ? u.id : `${u.id}/${a.experiment.id}`, activity: a.activity, experiment: a.experiment, module: a.module }] : [],
      )
    : [],
);
const trialOf = (values: Record<string, string | number>): AnyTrial => ({ id: 't', index: 1, values, ivKey: null, prediction: null, samples: [], result: {}, analysis: { kind: 'first-trial', changed: [] } }) as AnyTrial;

describe('restPlayhead: 숫자 또는 (실험, 시행) => 숫자', () => {
  it('기존 단원은 숫자(또는 없음) 그대로이고 같은 값을 돌려준다 (함수형은 우리 몸 단원뿐)', () => {
    for (const unit of variableUnits) {
      const r = unit.module.restPlayhead;
      if (unit.id === 'g5-body') {
        expect(typeof r).toBe('function');
        continue;
      }
      expect(r === undefined || typeof r === 'number', unit.id).toBe(true);
      expect(restPlayheadOf(unit.module, unit.experiment, trialOf({})), unit.id).toBe(r);
    }
    const nums = Object.fromEntries(variableUnits.filter((u) => typeof u.module.restPlayhead === 'number').map((u) => [u.id, u.module.restPlayhead]));
    expect(nums).toMatchObject({ 'g3-lifecycle': 7, 'g4-ecosystem': 60, 'g6-plant': 48, 'g4-microbe': 7, 'g3-force': 1, 'g3-sound': 20, 'g4-magnet': 6, 'g6-motion': 1.2, 'g4-water-state': 30, 'g5-mixture': 20, 'g4-land/stream-table': 60, 'g5-weather': 10, 'g3-health': 20, 'g4-climate': 20, 'g5-energy': 60 });
  });

  it('우리 몸은 시행의 운동 시간에 따라 운동이 끝난 순간(쉬는 1분 + 운동 시간)이다', () => {
    const unit = variableUnits.find((u) => u.id === 'g5-body')!;
    const at = (minutes: number) => restPlayheadOf(unit.module, unit.experiment, trialOf({ kind: 'walk', minutes, wrist: 'left' }));
    expect(at(1)).toBe(2);
    expect(at(3)).toBe(4);
  });

  it('함수는 실험과 시행을 그대로 받는다', () => {
    let seen: unknown[] = [];
    const mod = { restPlayhead: (e: unknown, t: unknown) => ((seen = [e, t]), 5) } as unknown as AnyModule;
    const unit = variableUnits[0]!;
    const trial = trialOf({});
    expect(restPlayheadOf(mod, unit.experiment, trial)).toBe(5);
    expect(seen[0]).toBe(unit.experiment);
    expect(seen[1]).toBe(trial);
  });
});
