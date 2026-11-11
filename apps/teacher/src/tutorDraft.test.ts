import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_TUTOR_EDITS, PROBE_KEY_PATTERN, UNIT_ID_PATTERN, tutorEditsSchema, type TutorEdits } from '@sci/classroom';
import { addCandidates, buildCatalog, type CatalogUnit } from './tutorCatalog';
import {
  draftFromEdits,
  draftToEdits,
  exportFileName,
  exportJson,
  hasInvalid,
  importEdits,
  lineCheck,
  validateEdits,
  type Draft,
} from './tutorDraft';
import { TutorEditsStore, TUTOR_EDITS_KEY, loadTutorEdits, saveTutorEdits } from './tutorEditsStore';

const dir = join(__dirname, '../../../content/units');
const CATALOG: CatalogUnit[] = buildCatalog(readdirSync(dir).map((u) => JSON.parse(readFileSync(join(dir, u, 'manifest.json'), 'utf8'))));
const unit = (id: string) => CATALOG.find((u) => u.id === id)!;
const MOTION = unit('g6-motion').experiments[0]!;
const HEIGHT_KEY = '|before-run|';

describe('카탈로그', () => {
  it('학년 순으로 모든 단원과 활동이 있다', () => {
    expect(CATALOG.length).toBe(readdirSync(dir).length);
    const grades = CATALOG.map((u) => u.grade);
    expect(grades).toEqual([...grades].sort((a, b) => a - b));
    expect(MOTION).toMatchObject({ id: 'ramp-cart', kind: 'variable' });
    expect(MOTION.placeholders.sort()).toEqual(['changed', 'iv']);
    expect(MOTION.ivs.map((v) => v.key)).toEqual(['heightCm', 'floor', 'load']);
  });
  it('모든 단원·활동 id와 질문 키가 덧씌우기 스키마의 형식에 맞는다(저장할 수 없는 질문이 없다)', () => {
    for (const u of CATALOG) {
      expect(UNIT_ID_PATTERN.test(u.id), u.id).toBe(true);
      for (const e of u.experiments) {
        expect(UNIT_ID_PATTERN.test(e.id), e.id).toBe(true);
        const keys = e.probes.map((p) => p.key);
        expect(new Set(keys).size, `${e.id}: (task, when, iv)가 겹침`).toBe(keys.length);
        for (const k of keys) expect(PROBE_KEY_PATTERN.test(k), `${e.id}: ${k}`).toBe(true);
        for (const iv of e.ivs) expect(/^[A-Za-z0-9-]{1,40}$/.test(iv.key), iv.key).toBe(true);
      }
    }
  });
  it('fair-test의 iv는 그 활동의 변인이다', () => {
    for (const u of CATALOG) for (const e of u.experiments) for (const p of e.probes) if (p.iv) expect(e.ivs.map((v) => v.key), `${e.id}: ${p.iv}`).toContain(p.iv);
  });
  it('관찰 활동의 질문은 과제마다 있고 키에 과제 id가 들어간다', () => {
    const obs = CATALOG.flatMap((u) => u.experiments).find((e) => e.kind === 'observation')!;
    expect(obs.tasks.length).toBeGreaterThan(0);
    expect(obs.probes.every((p) => p.task && p.key.startsWith(`${p.task}|`))).toBe(true);
    expect(obs.placeholders).toEqual([]);
  });
  it('질문 더하기 후보: 켜진 기본 질문이 없는 상황만, fair-test는 iv마다', () => {
    const c = addCandidates(MOTION, ['before-run', 'first-trial', 'fair-test'], []);
    expect(c.map((x) => x.key)).toContain('|fair-test|floor'); // 기본에 없는 iv
    expect(c.map((x) => x.key)).not.toContain('|before-run|');
    expect(c.map((x) => x.key)).not.toContain('|fair-test|');
    const after = addCandidates(MOTION, ['fair-test'], [{ when: 'fair-test', iv: 'floor' }]);
    expect(after.map((x) => x.key)).not.toContain('|fair-test|floor');
    // 모든 활동의 모든 후보가 스키마의 키 형식에 맞는다.
    for (const u of CATALOG) for (const e of u.experiments) for (const x of addCandidates(e, ['before-run', 'fair-test', 'repeat', 'finished', 'record-match', 'stage-1'], [])) expect(PROBE_KEY_PATTERN.test(x.key)).toBe(true);
  });
});

describe('카드 분류 두 번째 활동 넷(1차 묶음)이 교사 앱 튜터 질문 편집에 자동으로 나타난다', () => {
  // [단원, 첫 활동 id와 종류, 새 활동 id]. 첫 활동의 종류가 서로 달라(무리·트리·변인·순서) 활동이 여럿인 단원의 처리가 새로 시험된다.
  const CASES: Array<[string, [string, string], string]> = [
    ['g3-animal', ['animal-sort', 'groups'], 'animal-habitat'],
    ['g3-plantlife', ['leaf-tree', 'tree'], 'plant-habitat'],
    ['g4-ecosystem', ['food-web', 'variable'], 'living-nonliving'],
    ['g5-strata', ['strata-order', 'order'], 'rock-grain'],
  ];
  for (const [id, [firstId, firstKind], newId] of CASES) {
    it(`${id}: 활동 ${firstId}(${firstKind})와 ${newId}(groups)가 카탈로그에 있고 새 활동의 기본 질문 10개가 보인다`, () => {
      const u = unit(id);
      expect(u.experiments.map((e) => [e.id, e.kind])).toEqual([[firstId, firstKind], [newId, 'groups']]);
      const e = u.experiments[1]!;
      expect(e.probes.map((p) => p.when).sort()).toEqual(
        ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
      );
      // 새 활동의 금지 구절과 제한 용어가 이 활동 것이다(첫 활동 것을 섞어 쓰지 않는다).
      expect(e.forbiddenAnswers.length).toBeGreaterThan(0);
      expect(e.limits.length).toBeGreaterThan(0);
      expect(e.forbiddenAnswers).not.toEqual(u.experiments[0]!.forbiddenAnswers);
      // 이미 켜진 기본 질문이 모두 있으니 질문 더하기 후보는 카드 분류 상황 가운데 없는 것뿐이다.
      for (const x of addCandidates(e, ['choose-criterion', 'pick-card', 'before-observe', 'sorting', 'check-subjective', 'check-unplaced', 'check-unobserved', 'check-inconsistent', 'check-complete', 'finished'], [])) {
        expect(PROBE_KEY_PATTERN.test(x.key), x.key).toBe(true);
      }
    });
  }
  it('g5-strata 활동 2의 질문 고치기는 활동 2의 금지 구절(이암·사암·역암)에 걸리고, 첫 활동은 그대로 쓸 수 있다', () => {
    const [first, second] = unit('g5-strata').experiments;
    expect(lineCheck(second!, '|pick-card|', { text: '이암 카드부터 살펴볼까요?' })?.ok).toBe(false);
    expect(lineCheck(first!, '|pick-card|', { text: '이암 카드부터 살펴볼까요?' })?.ok).toBe(true);
    expect(lineCheck(second!, '|pick-card|', { text: '어떤 암석 카드부터 살펴볼까요?' })).toEqual({ ok: true, messages: [] });
  });
  it('g4-ecosystem 활동 2의 질문 고치기는 "생물 요소"에 걸린다', () => {
    const second = unit('g4-ecosystem').experiments[1]!;
    expect(lineCheck(second, '|finished|', { text: '이 카드는 생물 요소일까요?' })?.ok).toBe(false);
    expect(lineCheck(second, '|finished|', { text: '이 카드들은 어떤 점이 같고 다를까요?' })).toEqual({ ok: true, messages: [] });
  });
});

describe('변인 실험 활동 추가(빛의 성질 활동 2, 소리의 성질 활동 3)가 교사 앱 튜터 질문 편집에 자동으로 나타난다', () => {
  it('g3-sound: 활동 셋(string-sound, sound-vibration, sound-transmit)이 모두 카탈로그에 있고 활동마다 자기 금지 구절·변인·질문이 있다', () => {
    const u = unit('g3-sound');
    expect(u.experiments.map((e) => [e.id, e.kind])).toEqual([['string-sound', 'variable'], ['sound-vibration', 'variable'], ['sound-transmit', 'variable']]);
    const third = u.experiments[2]!;
    expect(third.ivs.map((v) => v.key)).toEqual(['medium', 'block', 'clockColor']);
    expect(third.ivs.map((v) => v.label)).toEqual(['소리를 전하는 것', '소리 나는 물체를 감싼 것', '알람 시계 색깔']);
    expect(third.placeholders.sort()).toEqual(['changed', 'iv']);
    expect(third.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['medium', 'block', 'clockColor']);
    expect(third.limits).toEqual(['데시벨', '진동수', '파동', '매질']);
    expect(third.forbiddenAnswers).toContain('솜이 가장 잘 막');
    for (const other of u.experiments.slice(0, 2)) {
      expect(third.forbiddenAnswers).not.toEqual(other.forbiddenAnswers);
      expect(other.forbiddenAnswers).not.toContain('솜이 가장 잘 막');
    }
    // 질문 키는 세 활동 모두 덧씌우기 스키마의 형식에 맞고 활동 안에서 겹치지 않는다.
    for (const e of u.experiments) {
      const keys = e.probes.map((p) => p.key);
      expect(new Set(keys).size, e.id).toBe(keys.length);
      for (const k of keys) expect(PROBE_KEY_PATTERN.test(k), k).toBe(true);
    }
    // 활동 3의 질문 고치기는 활동 3의 금지 구절에 걸리고, 활동 2에서는 같은 문장이 그대로 쓰인다.
    expect(lineCheck(third, '|prediction-mismatch|', { text: '솜이 가장 잘 막는다고 말해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(u.experiments[1]!, '|prediction-mismatch|', { text: '솜이 가장 잘 막는다고 말해 볼까요?' })?.ok).toBe(true);
    expect(lineCheck(third, '|prediction-mismatch|', { text: '교실의 소음을 줄이려면 무엇을 해 볼까요?' })).toEqual({ ok: true, messages: [] });
  });
  it('g5-light: 활동 둘(convex-lens, light-needed)이 카탈로그에 있고 활동 2의 질문 고치기는 활동 2의 금지 구절에 걸린다', () => {
    const u = unit('g5-light');
    expect(u.experiments.map((e) => [e.id, e.kind])).toEqual([['convex-lens', 'variable'], ['light-needed', 'variable']]);
    const second = u.experiments[1]!;
    expect(second.ivs.map((v) => v.key)).toEqual(['flashlight', 'object', 'boxColor']);
    expect(second.probes.filter((p) => p.iv).map((p) => p.iv)).toEqual(['flashlight', 'object', 'boxColor']);
    expect(lineCheck(second, '|prediction-mismatch|', { text: '반사된 빛이 눈으로 들어오는지 살펴볼까요?' })?.ok).toBe(false);
    expect(lineCheck(u.experiments[0]!, '|prediction-mismatch|', { text: '반사된 빛이 눈으로 들어오는지 살펴볼까요?' })?.ok).toBe(true);
  });
});

describe('초안 <-> 덧씌우기', () => {
  it('저장하면 자리표시가 {…}로 돌아가고, 다시 읽으면 〔…〕로 보인다', () => {
    const draft: Draft = { 'g6-motion': { 'ramp-cart': { changed: { [HEIGHT_KEY]: { text: '〔바꾼 조건〕을(를) 바꾸면 무엇이 달라질지 먼저 적어 볼까요?' }, '|repeat|': { off: true } }, added: [] } } };
    const edits = draftToEdits(draft, CATALOG);
    expect(edits).toEqual({
      v: 1,
      units: { 'g6-motion': { 'ramp-cart': { changed: { [HEIGHT_KEY]: { text: '{iv}을(를) 바꾸면 무엇이 달라질지 먼저 적어 볼까요?' }, '|repeat|': { off: true } }, added: [] } } },
    });
    expect(tutorEditsSchema.safeParse(edits).success).toBe(true);
    expect(draftFromEdits(edits)).toEqual(draft);
  });
  it('기본과 같은 글·검사를 통과하지 못한 글·없는 질문은 저장하지 않는다', () => {
    const base = MOTION.probes.find((p) => p.key === HEIGHT_KEY)!;
    const draft: Draft = {
      'g6-motion': {
        'ramp-cart': {
          changed: {
            [HEIGHT_KEY]: { text: base.text.replace('{iv}', '〔바꾼 조건〕') }, // 기본과 같음
            '|first-trial|': { text: '높이가 높을수록 빨라질까요?' }, // 금지 구절
            '|nope|': { off: true }, // 없는 질문
          },
          added: [{ when: 'repeat', text: '' }],
        },
      },
    };
    expect(draftToEdits(draft, CATALOG)).toEqual(EMPTY_TUTOR_EDITS);
    expect(hasInvalid(draft, CATALOG)).toBe(true);
    expect(hasInvalid({}, CATALOG)).toBe(false);
  });
  it('끈 줄은 글이 검사를 통과할 때만 글을 함께 둔다', () => {
    const draft: Draft = { 'g6-motion': { 'ramp-cart': { changed: { '|repeat|': { off: true, text: '높을수록 빨라요?' } }, added: [] } } };
    expect(draftToEdits(draft, CATALOG).units['g6-motion']!['ramp-cart']!.changed['|repeat|']).toEqual({ off: true });
    expect(hasInvalid(draft, CATALOG)).toBe(false); // 끈 줄은 검사하지 않는다
  });
  it('더한 질문은 검사를 통과해야 저장되고, 이 활동의 자리표시만 쓸 수 있다', () => {
    const ok: Draft = { 'g6-motion': { 'ramp-cart': { changed: {}, added: [{ when: 'fair-test', iv: 'floor', text: '〔바꾼 조건〕만 바꿨을 때 무엇이 달라졌나요?' }] } } };
    expect(draftToEdits(ok, CATALOG).units['g6-motion']!['ramp-cart']!.added).toEqual([{ when: 'fair-test', iv: 'floor', text: '{iv}만 바꿨을 때 무엇이 달라졌나요?' }]);
    const card = unit('g3-animal').experiments[0]!;
    const bad: Draft = { 'g3-animal': { [card.id]: { changed: {}, added: [{ when: 'sorting', text: '〔바꾼 조건〕은 무엇인가요?' }] } } };
    expect(hasInvalid(bad, CATALOG)).toBe(true);
    expect(draftToEdits(bad, CATALOG)).toEqual(EMPTY_TUTOR_EDITS);
  });
  it('lineCheck: 기본 그대로·끈 줄은 검사하지 않고, 고친 줄은 검사 결과를 돌려준다', () => {
    expect(lineCheck(MOTION, HEIGHT_KEY, {})).toBeNull();
    expect(lineCheck(MOTION, HEIGHT_KEY, { off: true, text: 'x' })).toBeNull();
    expect(lineCheck(MOTION, HEIGHT_KEY, { text: '출발 높이를 바꾸면 무엇이 달라질지 먼저 적어 볼까요?' })).toEqual({ ok: true, messages: [] });
    expect(lineCheck(MOTION, HEIGHT_KEY, { text: '높을수록 빨라요?' })?.messages).toEqual(['정답이나 학년에 맞지 않는 말이 들어 있어요: ‘높을수록 빨라’']);
  });
  it('validateEdits: 규격에 맞는지(크기 포함)', () => {
    expect(validateEdits(EMPTY_TUTOR_EDITS).ok).toBe(true);
    const big: TutorEdits = { v: 1, units: Object.fromEntries(Array.from({ length: 4 }, (_, u) => [`u${u}`, Object.fromEntries(Array.from({ length: 4 }, (_, e) => [`e${e}`, { changed: {}, added: Array.from({ length: 20 }, (_, i) => ({ when: `w${i}`, text: '가'.repeat(60) })) }]))])) };
    expect(validateEdits(big)).toMatchObject({ ok: false, message: expect.stringContaining('너무 많아서') });
  });
});

describe('파일로 내보내기·불러오기', () => {
  const edits: TutorEdits = {
    v: 1,
    units: { 'g6-motion': { 'ramp-cart': { changed: { [HEIGHT_KEY]: { text: '출발 높이를 바꾸면 무엇이 달라질지 먼저 적어 볼까요?' }, '|repeat|': { off: true } }, added: [{ when: 'fair-test', iv: 'floor', text: '{iv}만 바꿨을 때 무엇이 달라졌나요?' }] } } },
  };
  it('내보낸 파일을 그대로 불러오면 같은 덧씌우기가 된다', () => {
    const r = importEdits(exportJson(edits), CATALOG);
    expect(r.error).toBeUndefined();
    expect(r.rejected).toEqual([]);
    expect(r.accepted).toBe(3);
    expect(draftToEdits(r.draft, CATALOG)).toEqual(edits);
  });
  it('파일 이름은 튜터질문-YYYYMMDD.json', () => {
    expect(exportFileName(new Date(2026, 10, 3))).toBe('튜터질문-20261103.json');
  });
  it('통과한 줄만 넣고 넣지 못한 줄과 이유를 알려 준다', () => {
    const raw = JSON.stringify({
      v: 1,
      units: {
        'g6-motion': {
          'ramp-cart': {
            changed: {
              [HEIGHT_KEY]: { text: '출발 높이를 바꾸면 무엇이 달라질지 먼저 적어 볼까요?' }, // 통과
              '|first-trial|': { text: '높이가 높을수록 빨라질까요?' }, // 금지 구절
              '|nope|': { off: true }, // 없는 질문
              '|repeat|': { off: 'yes' }, // 형식
            },
            added: [
              { when: 'repeat', text: '이미 질문이 있는 상황인가요?' },
              { when: 'finished', text: '다 마쳤나요?' }, // 변인 실험에는 없는 상황
              { task: 't', when: 'fair-test', text: '과제는 관찰 활동에만 있나요?' },
              { when: 'fair-test', iv: 'floor', text: '〔카드 이름〕만 바꿨나요?' }, // 쓸 수 없는 칸
              { when: 'fair-test', iv: 'floor', text: '바닥만 바꿨을 때 무엇이 달라졌나요?' }, // 통과
            ],
          },
          ghost: { changed: { '|a|': { off: true } }, added: [] }, // 없는 활동
        },
        'no-unit': { x: { changed: {}, added: [{ when: 'a', text: 'b?' }] } }, // 없는 단원
      },
    });
    const r = importEdits(raw, CATALOG);
    expect(r.accepted).toBe(2);
    const reasons = Object.fromEntries(r.rejected.map((x) => [x.reason, x.count]));
    expect(reasons['검사를 통과하지 못했어요: 정답이나 학년에 맞지 않는 말이 들어 있어요: ‘높을수록 빨라’']).toBe(1);
    expect(reasons['검사를 통과하지 못했어요: 쓸 수 없는 칸이에요: 〔카드 이름〕']).toBe(1);
    expect(reasons['이 앱에 없는 질문이에요']).toBe(1);
    expect(reasons['형식이 맞지 않는 줄']).toBe(1);
    expect(reasons['그 상황에는 이미 질문이 있어요']).toBe(1);
    expect(reasons['이 활동에서 더할 수 없는 상황이에요']).toBe(2);
    expect(reasons['이 앱에 없는 단원이나 활동이에요']).toBe(2);
    expect(draftToEdits(r.draft, CATALOG)).toEqual({
      v: 1,
      units: { 'g6-motion': { 'ramp-cart': { changed: { [HEIGHT_KEY]: { text: '출발 높이를 바꾸면 무엇이 달라질지 먼저 적어 볼까요?' } }, added: [{ when: 'fair-test', iv: 'floor', text: '바닥만 바꿨을 때 무엇이 달라졌나요?' }] } } },
    });
  });
  it('파일 형식이 아니면 오류 문장', () => {
    expect(importEdits('not json', CATALOG).error).toContain('읽을 수 없어요');
    expect(importEdits('{"v":2,"units":{}}', CATALOG).error).toContain('튜터 질문 파일이 아니에요');
    expect(importEdits('[]', CATALOG).error).toContain('튜터 질문 파일이 아니에요');
    expect(importEdits('{"v":1,"units":{}}', CATALOG)).toMatchObject({ accepted: 0, rejected: [], draft: {} });
  });
});

describe('브라우저 저장소(sci-bridge.tutor-edits.v1)', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  const edits: TutorEdits = { v: 1, units: { 'g6-motion': { 'ramp-cart': { changed: { '|repeat|': { off: true } }, added: [] } } } };
  it('저장하고 읽는다', () => {
    const s = mem();
    expect(TUTOR_EDITS_KEY).toBe('sci-bridge.tutor-edits.v1');
    expect(loadTutorEdits(s)).toEqual(EMPTY_TUTOR_EDITS);
    expect(saveTutorEdits(edits, s)).toBe(true);
    expect(loadTutorEdits(s)).toEqual(edits);
  });
  it('깨졌거나 규격에 맞지 않으면 빈 덧씌우기, 저장소가 막혀도 던지지 않는다', () => {
    const s = mem();
    s.m.set(TUTOR_EDITS_KEY, '{oops');
    expect(loadTutorEdits(s)).toEqual(EMPTY_TUTOR_EDITS);
    s.m.set(TUTOR_EDITS_KEY, JSON.stringify({ v: 1, units: { 'Bad Id': {} } }));
    expect(loadTutorEdits(s)).toEqual(EMPTY_TUTOR_EDITS);
    expect(loadTutorEdits(null)).toEqual(EMPTY_TUTOR_EDITS);
    expect(saveTutorEdits(edits, null)).toBe(false);
    expect(saveTutorEdits(edits, { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(loadTutorEdits({ getItem: () => { throw new Error('blocked'); } })).toEqual(EMPTY_TUTOR_EDITS);
  });
  it('TutorEditsStore: 저장하면 구독자에게 알리고, 저장소에 쓰지 못해도 값은 바뀐다', () => {
    const writes: TutorEdits[] = [];
    const store = new TutorEditsStore(EMPTY_TUTOR_EDITS, (e) => (writes.push(e), false));
    let n = 0;
    store.subscribe(() => n++);
    expect(store.set(edits)).toBe(false);
    expect(store.get()).toBe(edits);
    expect(n).toBe(1);
    expect(writes).toEqual([edits]);
  });
});
