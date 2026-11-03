import { describe, expect, it } from 'vitest';
import { buildStatement, EXT_BASE, ext, MemoryRecorder, toExtensions } from './index';

describe('xapi', () => {
  it('문장 형태', () => {
    const s = buildStatement({
      actorId: 'anon-1',
      verb: 'experimented',
      objectId: 'https://sci-bridge.local/activities/g5-solution/dissolve-amount',
      result: { extensions: toExtensions({ dissolvedG: 3.8 }) },
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

  describe('result 검증', () => {
    const base = { actorId: 'a', verb: 'v', objectId: 'x' };
    it('ext / toExtensions', () => {
      expect(ext('trial')).toBe(`${EXT_BASE}trial`);
      expect(toExtensions({ a: 1, b: null })).toEqual({ [`${EXT_BASE}a`]: 1, [`${EXT_BASE}b`]: null });
    });
    it('올바른 result는 통과', () => {
      const s = buildStatement({
        ...base,
        result: { response: 'increase', extensions: toExtensions({ iv: 'stir' }) },
      });
      expect(s.result).toBeDefined();
    });
    it('허용되지 않는 최상위 키', () => {
      expect(() => buildStatement({ ...base, result: { foo: 1 } })).toThrow(TypeError);
    });
    it('response는 문자열', () => {
      expect(() => buildStatement({ ...base, result: { response: null } })).toThrow(TypeError);
      expect(() => buildStatement({ ...base, result: { response: 3 } })).toThrow(TypeError);
    });
    it('extensions 키는 IRI', () => {
      expect(() => buildStatement({ ...base, result: { extensions: { dissolvedG: 1 } } })).toThrow(TypeError);
      expect(() => buildStatement({ ...base, result: { extensions: { 'a b://x': 1 } } })).toThrow(TypeError);
    });
  });
});
