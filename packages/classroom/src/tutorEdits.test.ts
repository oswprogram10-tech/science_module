import { describe, expect, it } from 'vitest';
import { MAX_TUTOR_EDITS_BYTES, countTutorEdits, tutorEditsSchema, type TutorEdits } from './tutorEdits';

const ok = (changed: Record<string, unknown> = {}, added: unknown[] = []) => ({ v: 1, units: { 'g6-motion': { 'ramp-cart': { changed, added } } } });
const parses = (v: unknown) => tutorEditsSchema.safeParse(v).success;

describe('tutorEditsSchema', () => {
  it('정상: 고치기·끄기·더하기', () => {
    expect(parses(ok({ '|before-run|': { text: '무엇이 달라질까요?' }, '|repeat|': { off: true } }, [{ when: 'fair-test', iv: 'heightCm', text: '높이만 바꿨어요?' }]))).toBe(true);
    expect(parses({ v: 1, units: {} })).toBe(true);
  });
  it('버전은 1만', () => {
    expect(parses({ v: 2, units: {} })).toBe(false);
    expect(parses({ units: {} })).toBe(false);
  });
  it('unitId·experimentId는 소문자·숫자·하이픈 1~40자', () => {
    expect(parses({ v: 1, units: { 'G6-motion': {} } })).toBe(false);
    expect(parses({ v: 1, units: { '': {} } })).toBe(false);
    expect(parses({ v: 1, units: { ['a'.repeat(41)]: {} } })).toBe(false);
    expect(parses({ v: 1, units: { ['a'.repeat(40)]: {} } })).toBe(true);
    expect(parses({ v: 1, units: { u: { 'Ramp Cart': { changed: {}, added: [] } } } })).toBe(false);
  });
  it('probeKey 형식: task|when|iv', () => {
    expect(parses(ok({ '|before-run|': { off: true } }))).toBe(true);
    expect(parses(ok({ 'task-1|record-match|': { off: true } }))).toBe(true);
    expect(parses(ok({ '|fair-test|tiltDeg': { off: true } }))).toBe(true); // iv는 대문자 허용
    expect(parses(ok({ 'before-run': { off: true } }))).toBe(false);
    expect(parses(ok({ '||': { off: true } }))).toBe(false); // when은 1자 이상
    expect(parses(ok({ '|Before-Run|': { off: true } }))).toBe(false); // when은 소문자
    expect(parses(ok({ '|a|b|c': { off: true } }))).toBe(false);
    expect(parses(ok({ ['x'.repeat(41) + '|a|']: { off: true } }))).toBe(false);
  });
  it('text는 1~200자, off는 true만, 모르는 필드는 거부', () => {
    expect(parses(ok({ '|a|': { text: '' } }))).toBe(false);
    expect(parses(ok({ '|a|': { text: 'x'.repeat(200) } }))).toBe(true);
    expect(parses(ok({ '|a|': { text: 'x'.repeat(201) } }))).toBe(false);
    expect(parses(ok({ '|a|': { off: false } }))).toBe(false);
    expect(parses(ok({ '|a|': { text: 'x', extra: 1 } }))).toBe(false);
  });
  it('added는 20개까지', () => {
    const one = { when: 'repeat', text: '다시 해 보니 어때요?' };
    expect(parses(ok({}, Array.from({ length: 20 }, () => one)))).toBe(true);
    expect(parses(ok({}, Array.from({ length: 21 }, () => one)))).toBe(false);
    expect(parses(ok({}, [{ when: '', text: 'x' }]))).toBe(false);
    expect(parses(ok({}, [{ when: 'repeat', text: '' }]))).toBe(false);
  });
  it('직렬화 크기는 48 KB까지', () => {
    const mk = (units: number): TutorEdits => ({
      v: 1,
      units: Object.fromEntries(
        Array.from({ length: units }, (_, u) => [`u${u}`, Object.fromEntries(Array.from({ length: 4 }, (_, e) => [`e${e}`, { changed: {}, added: Array.from({ length: 20 }, (_, i) => ({ when: `w${i}`, text: '가'.repeat(60) })) }]))]),
      ),
    });
    // 한글 한 글자는 3바이트: 60자 x 20 x 4 = 14.4 KB 남짓이 한 단원
    expect(JSON.stringify(mk(2)).length).toBeLessThan(MAX_TUTOR_EDITS_BYTES);
    expect(parses(mk(2))).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(mk(4))).length).toBeGreaterThan(MAX_TUTOR_EDITS_BYTES);
    expect(parses(mk(4))).toBe(false);
  });
});

describe('countTutorEdits', () => {
  it('고친·끈·더한 질문을 센다', () => {
    const e = tutorEditsSchema.parse(ok({ '|a|': { text: 'x' }, '|b|': { off: true }, '|c|': { text: 'y' } }, [{ when: 'repeat', text: 'z' }]));
    expect(countTutorEdits(e)).toEqual({ changed: 2, off: 1, added: 1 });
    expect(countTutorEdits(null)).toEqual({ changed: 0, off: 0, added: 0 });
  });
});
