import { describe, expect, it } from 'vitest';
import { buildStatement, MemoryRecorder } from './index';

describe('xapi', () => {
  it('문장 형태', () => {
    const s = buildStatement({
      actorId: 'anon-1',
      verb: 'experimented',
      objectId: 'https://sci-bridge.local/activities/g5-solution/dissolve-amount',
      result: { extensions: { dissolvedG: 3.8 } },
    });
    expect(s.actor.account).toEqual({ homePage: 'https://sci-bridge.local', name: 'anon-1' });
    expect(s.verb.id).toBe('https://sci-bridge.local/verbs/experimented');
    expect(s.object.objectType).toBe('Activity');
    expect(s.result).toBeDefined();
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('MemoryRecorder', () => {
    const r = new MemoryRecorder();
    r.record(buildStatement({ actorId: 'a', verb: 'predicted', objectId: 'x' }));
    expect(r.pending).toHaveLength(1);
    expect(r.flush()).toHaveLength(1);
    expect(r.flush()).toHaveLength(0);
  });
});
