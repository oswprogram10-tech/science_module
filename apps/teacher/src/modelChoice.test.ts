import { describe, expect, it } from 'vitest';
import { TUTOR_MODELS } from '@sci/tutor';
import data from './modelCompare.data.json';
import {
  EMPTY_CHOICE,
  ModelChoiceStore,
  answerOrder,
  filterSamples,
  loadChoice,
  parseChoice,
  saveChoice,
  tallyVotes,
  ALL_SAMPLES,
  MODEL_CHOICE_KEY,
  type CompareData,
} from './modelChoice';
import { UNIT_TITLES } from './units';

const compare = data as unknown as CompareData;

describe('모델 선택 저장', () => {
  it('모르는 모델과 깨진 평가는 버린다', () => {
    expect(parseChoice(null)).toEqual(EMPTY_CHOICE);
    expect(parseChoice({ model: 'gpt-9', votes: { a: 'qwen3-1.7b', b: 'x', c: 'same', ['z'.repeat(81)]: 'same' } })).toEqual({
      model: null,
      votes: { a: 'qwen3-1.7b', c: 'same' },
    });
    expect(parseChoice({ model: 'hcx-seed-1.5b' }).model).toBe('hcx-seed-1.5b');
  });

  it('저장하고 다시 읽는다. 저장소가 막혀도 화면에는 적용된다', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(saveChoice({ model: 'qwen3-1.7b', votes: { s1: 'same' } }, storage)).toBe(true);
    expect(mem.has(MODEL_CHOICE_KEY)).toBe(true);
    expect(loadChoice(storage)).toEqual({ model: 'qwen3-1.7b', votes: { s1: 'same' } });
    expect(loadChoice({ getItem: () => '{깨짐' })).toEqual(EMPTY_CHOICE);

    const store = new ModelChoiceStore(EMPTY_CHOICE, () => false);
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.set({ model: 'hcx-seed-1.5b', votes: {} })).toBe(false);
    expect(store.get().model).toBe('hcx-seed-1.5b');
    expect(calls).toBe(1);
  });

  it('A·B 자리는 문항마다 정해져 있고 두 쪽 모두 나온다', () => {
    const models = ['hcx-seed-1.5b', 'qwen3-1.7b'];
    expect(answerOrder('x-1', models)).toEqual(answerOrder('x-1', models));
    const firsts = new Set(compare.samples.map((s) => answerOrder(s.id, models)[0]));
    expect(firsts).toEqual(new Set(models));
  });

  it('평가를 세고 거른다', () => {
    const ids = new Set(['a', 'b', 'c']);
    expect(tallyVotes({ a: 'qwen3-1.7b', b: 'same', c: 'qwen3-1.7b', gone: 'same' }, ids)).toEqual({ byModel: { 'qwen3-1.7b': 2 }, same: 1, total: 3 });
    const flagged = filterSamples(compare.samples, { ...ALL_SAMPLES, flaggedOnly: true }, {});
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.every((s) => Object.values(s.answers).some((a) => a.flags.length > 0))).toBe(true);
    const first = compare.samples[0]!;
    expect(filterSamples(compare.samples, { ...ALL_SAMPLES, unvotedOnly: true }, { [first.id]: 'same' })).not.toContainEqual(first);
    expect(filterSamples(compare.samples, { ...ALL_SAMPLES, kind: 'redteam' }, {}).every((s) => s.kind === 'redteam' && s.category)).toBe(true);
  });
});

describe('비교 자료(modelCompare.data.json)', () => {
  it('목록의 두 모델 답이 모든 문항에 있고, 단원 이름이 있다', () => {
    expect([...compare.models].sort()).toEqual(TUTOR_MODELS.map((m) => m.id).sort());
    for (const id of compare.models) {
      const st = compare.stats[id]!;
      expect(st.total).toBeGreaterThan(0);
      expect(st.n_val + st.n_red).toBe(st.total);
    }
    const ids = new Set<string>();
    for (const s of compare.samples) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      expect(UNIT_TITLES[s.unitId], s.unitId).toBeTruthy();
      for (const m of compare.models) expect(s.answers[m]?.text, `${s.id} ${m}`).toBeTruthy();
      if (s.kind === 'val') expect(s.reference, s.id).toMatch(/\?/);
    }
  });

  it('학생 대화 데이터가 아니라 견본에서 나온 문항이다', () => {
    // 견본 id 형식: <단원>-sft-0001(검증) 또는 <단원>-redteam-0001(레드팀)
    for (const s of compare.samples) expect(s.id).toMatch(new RegExp(`^${s.unitId}-(sft|redteam)-\\d{4}$`));
  });
});
