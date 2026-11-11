import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateCardSortExperiment } from '@sci/cardsort';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import plantlifeJson from '../../../../../content/units/g3-plantlife/manifest.json';
import { UNITS } from '../../units';
import { chooseCriterion, check, createInitialState, observe, place } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { PLANT_HABITAT_RESULT, PLANT_HABITAT_ICON_KEYS, PlantHabitatIcon } from './PlantHabitatIcons';

/** 식물의 생활 두 번째 활동 plant-habitat(사는 곳과 식물의 생김새) 시험. 사양 docs/specs/card-sort-batch-a.md §2. 첫 활동은 트리(tree) 배치이고 이 활동은 무리 나누기(groups)이다. */
const manifest = parseManifest(plantlifeJson);
const exp = manifest.experiments[1] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const noop = () => {};
const FEATURES = ['place', 'float', 'needle'];

/** 사양 §2 표: 카드 -> [이름, 아이콘, place, float, needle]. */
const TABLE: Record<string, [string, string, string, string, string]> = {
  waterhyacinth: ["부레옥잠", "pl-hyacinth", "water", "yes", "no"],
  duckweed: ["개구리밥", "pl-duckweed", "water", "yes", "no"],
  hydrilla: ["검정말", "pl-hydrilla", "water", "no", "no"],
  lotus: ["연꽃", "pl-lotus", "water", "no", "no"],
  cactus: ["선인장", "pl-cactus", "land", "no", "yes"],
  pine: ["소나무", "pl-pine", "land", "no", "yes"],
  dandelion: ["민들레", "pl-dandelion", "land", "no", "no"],
  foxtail: ["강아지풀", "pl-foxtail", "land", "no", "no"],
};

const OBS: Record<string, [string, string, string]> = {
  waterhyacinth: ["연못 물 위에서 자라요.", "물 위에 떠 있고, 잎자루를 자르면 스펀지처럼 구멍이 많아요.", "잎이 둥글고 넓적해요."],
  duckweed: ["논이나 연못의 물 위에서 자라요.", "작고 둥근 잎이 물 위에 떠 있고, 뿌리는 물속으로 늘어져 있어요.", "잎이 작고 둥글며 끝이 뾰족하지 않아요."],
  hydrilla: ["연못 물속에서 자라요.", "줄기와 잎이 모두 물속에 잠겨 있어요.", "잎이 작고 가늘지만 끝이 뾰족하지 않고 부드러워요."],
  lotus: ["연못 바닥 흙에 뿌리를 내려요.", "잎이 물 위로 솟아 있고, 뿌리는 바닥에 붙어 있어요.", "잎이 둥글고 아주 커요."],
  cactus: ["햇볕이 센 메마른 모래땅에서 자라요.", "물 위가 아니라 땅 위에 서 있어요.", "줄기에 가늘고 뾰족한 가시가 가득 나 있어요."],
  pine: ["산의 흙에서 자라요.", "땅에 뿌리를 내리고 우뚝 서 있어요.", "잎이 바늘처럼 가늘고 길며 끝이 뾰족해요."],
  dandelion: ["길가 흙에서 자라요.", "땅에 뿌리를 내리고 있어요.", "잎이 땅 가까이에 둘러 펼쳐져 있고 끝이 뭉툭해요."],
  foxtail: ["들판 흙에서 자라요.", "땅에 뿌리를 내리고 서 있어요.", "잎이 길고 납작한 띠 모양이며 부드러워요."],
};

/** 관찰 문장에 들어가면 안 되는 말(정답 이름·판정 말·설명 말). */
const NOT_IN_OBSERVATION = ['적응', '덕분', '때문에', '공기주머니', '통기', '증산', '기공', '예쁜'];

/** 그림이 살펴본 특징에 따라 그리는 표시: 특징 key -> [그림 class, data 속성, 값(카드의 그림 key)]. */
const MARKS: Record<string, [string, string, (icon: string) => string]> = {
  place: ['ph-place', 'data-place', icon => PLANT_HABITAT_RESULT[icon]!.place],
  float: ['ph-float', 'data-floating', icon => String(PLANT_HABITAT_RESULT[icon]!.float)],
  needle: ['ph-needle', 'data-pointed', icon => String(PLANT_HABITAT_RESULT[icon]!.needle)],
};

describe('사는 곳과 식물의 생김새 두 번째 활동 매니페스트 (사양 §0, §2)', () => {
  it('첫 활동은 그대로이고 두 번째 활동이 뒤에 붙는다', () => {
    expect(manifest.experiments.map((e) => e.id)).toEqual(['leaf-tree', 'plant-habitat']);
    expect(manifest.experiments[0]!.module).toBe('card-sort');
    expect([manifest.id, manifest.title, manifest.grade, manifest.engine, manifest.standards]).toEqual(['g3-plantlife', '식물의 생활', 3, 'life', ['4과03-01', '4과03-02']]);
  });
  it('활동 정보', () => {
    expect([exp.id, exp.module, exp.layout]).toEqual(['plant-habitat', 'card-sort', 'groups']);
    expect(exp.title).toBe("사는 곳과 식물의 생김새");
    expect(exp.question).toBe("사는 곳이 다른 식물들은 생김새가 어떻게 다를까?");
    expect(exp.limits).toEqual(["증산 작용", "기공", "통기 조직"]);
    expect(exp.safetyChecklist).toEqual([]);
    expect(exp.safetyNotices ?? []).toEqual([]);
  });
  it('특징 3가지와 돋보기 버튼 문구', () => {
    expect(exp.features.map((f) => [f.key, f.label, f.action])).toEqual([["place", "자라는 곳", undefined], ["float", "물 위", undefined], ["needle", "잎 모양", undefined]]);
  });
  it('분류 기준(4가지)과 무리 이름', () => {
    expect(exp.criteria.map((c) => [c.key, c.label, c.feature, c.objective, c.groups.map((g) => [g.value, g.label])])).toEqual([["place", "어디에서 자라나요?", "place", true, [["water", "물에서 자란다"], ["land", "땅에서 자란다"]]], ["float", "물 위에 떠 있나요?", "float", true, [["yes", "떠 있다"], ["no", "떠 있지 않다"]]], ["needle", "잎이 가시나 바늘처럼 가늘고 뾰족한가요?", "needle", true, [["yes", "그렇다"], ["no", "그렇지 않다"]]], ["pretty", "예쁜가요?", undefined, false, [["pretty", "예쁘다"], ["plain", "예쁘지 않다"]]]]);
  });
  it('카드 8장의 표(이름·특징값)와 관찰 문장이 사양과 같다', () => {
    expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(TABLE));
    for (const c of exp.cards) {
      const [label, icon, ...vals] = TABLE[c.key]!;
      expect([c.label, c.icon, c.sublabel], c.key).toEqual([label, icon, undefined]);
      expect(c.features, c.key).toEqual(Object.fromEntries(FEATURES.map((f, i) => [f, vals[i]])));
      expect(c.observations, c.key).toEqual(Object.fromEntries(FEATURES.map((f, i) => [f, OBS[c.key]![i]])));
    }
  });
  it('특징 표의 개수: 물에서 자람 4 · 땅에서 자람 4, 물 위에 떠 있음 2, 가시·바늘 잎 2', () => {
    expect(exp.cards.filter((c) => c.features.place === 'water').map((c) => c.key)).toEqual(['waterhyacinth', 'duckweed', 'hydrilla', 'lotus']);
    expect(exp.cards.filter((c) => c.features.place === 'land').map((c) => c.key)).toEqual(['cactus', 'pine', 'dandelion', 'foxtail']);
    expect(exp.cards.filter((c) => c.features.float === 'yes').map((c) => c.key)).toEqual(['waterhyacinth', 'duckweed']);
    expect(exp.cards.filter((c) => c.features.needle === 'yes').map((c) => c.key)).toEqual(['cactus', 'pine']);
    // 물 위에 떠 있는 식물은 모두 물에서 자란다.
    expect(exp.cards.filter((c) => c.features.float === 'yes' && c.features.place !== 'water')).toEqual([]);
  });
  it('첫 활동(잎 트리)의 카드와 그림은 바뀌지 않고 이 활동은 따로 둔다', () => {
    const first = manifest.experiments[0] as CardSortExperiment;
    expect(first.layout).toBe('tree');
    expect(first.cards.map((c) => c.key)).toEqual(['maple', 'chrysanthemum', 'cherry', 'camellia', 'persimmon', 'lilac', 'iris', 'lily']);
    expect(exp.cards.map((c) => c.key).filter((k) => first.cards.some((f) => f.key === k))).toEqual([]);
  });
  it('관찰 문장은 보이는 사실만 쓰고 정답 이름·판정 말·설명 말을 쓰지 않는다', () => {
    for (const c of exp.cards) {
      for (const o of Object.values(c.observations)) {
        for (const w of NOT_IN_OBSERVATION) expect(o, `${c.key}: ${o}`).not.toContain(w);
        for (const w of ['정답', '틀렸', '맞았', '잘했어', '오답']) expect(o, `${c.key}: ${o}`).not.toContain(w);
        expect(guardOutput(o, guard).ok, o).toBe(true);
      }
      expect(guardOutput(c.label, guard).ok, c.label).toBe(true);
    }
  });
  it('validateCardSortExperiment를 통과하고 레지스트리에서 두 번째 활동으로 등록된다', () => {
    expect(validateCardSortExperiment(exp)).toEqual([]);
    const u = UNITS.find((x) => x.id === 'g3-plantlife')!;
    expect(u.ok && u.activities.map((a) => a.activity)).toEqual(['card-sort', 'card-sort']);
    // 최상위 값은 첫 활동이다.
    expect(u.ok && u.activity).toBe('card-sort');
    if (u.ok) {
      const second = u.activities[1]!;
      expect(second.activity === 'card-sort' && second.module.kind).toBe('card-sort');
      expect(second.experiment.id).toBe('plant-habitat');
    }
  });
  it('probe가 모든 상황을 덮고 finished 문장이 사양과 같다', () => {
    const byWhen = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
    expect(Object.keys(byWhen).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
    );
    expect(byWhen['finished']).toBe("물 위에 떠 사는 식물은 몸의 어느 부분 덕분에 떠 있을 수 있을까요? 관찰 기록에서 찾아볼까요?");
    expect(byWhen['check-complete']).toContain('다른 기준으로도 나누어 볼까요?');
    for (const t of Object.values(byWhen)) expect(t, t).toMatch(/[?？]/);
  });
  it('화면에 나오는 모든 문장에 제한 용어와 금지 구절이 없다', () => {
    const text = JSON.stringify({ ...exp, limits: [], tutor: { probes: exp.tutor.probes } });
    expect(guardOutput(text, guard)).toEqual({ ok: true, hits: [] });
    for (const c of exp.cards) for (const o of Object.values(c.observations)) expect(guardOutput(o, guard).ok, o).toBe(true);
    for (const c of exp.cards) expect(guardOutput(c.label, guard).ok, c.label).toBe(true);
  });
});

describe('사는 곳과 식물의 생김새 그림', () => {
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(PlantHabitatIcon, { icon, size: 140, shown }));
  const markClasses = Object.values(MARKS).map(([cls]) => cls);
  it('카드마다 그림이 있고 결과 표가 매니페스트와 같다', () => {
    expect(exp.cards.map((c) => c.icon)).toEqual(['pl-hyacinth', 'pl-duckweed', 'pl-hydrilla', 'pl-lotus', 'pl-cactus', 'pl-pine', 'pl-dandelion', 'pl-foxtail']);
    expect(PLANT_HABITAT_ICON_KEYS).toEqual(exp.cards.map((c) => c.icon));
    for (const c of exp.cards) {
      expect(PLANT_HABITAT_ICON_KEYS, c.icon).toContain(c.icon);
      const r = PLANT_HABITAT_RESULT[c.icon]! as Record<string, unknown>;
      for (const f of FEATURES) {
        const want = c.features[f]!;
        const got = r[f];
        expect(typeof got === 'boolean' ? (got ? 'yes' : 'no') : got, `${c.key} ${f}`).toBe(want);
      }
    }
  });
  it('그림 key가 다른 카드 그림과 겹치지 않는다', async () => {
    const { MATERIAL_ICON_KEYS } = await import('./MaterialIcons');
    const { ANIMAL_ICON_KEYS } = await import('./AnimalIcons');
    const { LEAF_ICON_KEYS } = await import('./LeafIcons');
    const { STRATA_ICON_KEYS } = await import('./StrataIcons');
    const { MIXTURE_ICON_KEYS } = await import('./MixtureIcons');
    const { WEATHER_ICON_KEYS } = await import('./WeatherIcons');
    const { HABITAT_ICON_KEYS } = await import('./HabitatIcons');
    const { PLANT_HABITAT_ICON_KEYS } = await import('./PlantHabitatIcons');
    const { ECO_ICON_KEYS } = await import('./EcoIcons');
    const { GRAIN_ICON_KEYS } = await import('./GrainIcons');
    const mine = PLANT_HABITAT_ICON_KEYS;
    const others = [MATERIAL_ICON_KEYS, ANIMAL_ICON_KEYS, LEAF_ICON_KEYS, STRATA_ICON_KEYS, MIXTURE_ICON_KEYS, WEATHER_ICON_KEYS, HABITAT_ICON_KEYS, PLANT_HABITAT_ICON_KEYS, ECO_ICON_KEYS, GRAIN_ICON_KEYS].filter((k) => k !== mine);
    expect(others).toHaveLength(9);
    for (const k of mine) for (const other of others) expect(other, k).not.toContain(k);
  });
  it('관찰 전의 기본 그림에는 결과 그림이 없고 글자가 없다', () => {
    for (const c of exp.cards) {
      for (const shown of [undefined, []]) {
        const html = svg(c.icon, shown);
        for (const cls of markClasses) expect(html, `${c.key} ${cls}`).not.toContain(cls);
        expect(html).not.toMatch(/data-(habitat|fins|fur|place|floating|pointed|grows|needs|moves|grain|smooth|pebble)=/);
        expect(html).not.toContain('#e06a00');
        expect(html).not.toContain('<text');
        expect(html).toContain('aria-hidden="true"');
      }
    }
  });
  it('살펴본 특징의 결과 그림만 나타나고 특징값과 일치한다', () => {
    for (const c of exp.cards) {
      for (const f of FEATURES) {
        const [cls, attr, value] = MARKS[f]!;
        const html = svg(c.icon, [f]);
        expect(html, `${c.key} ${f}`).toContain(cls);
        expect(html, `${c.key} ${f} 값`).toContain(`${attr}="${value(c.icon)}"`);
        for (const other of markClasses.filter((x) => x !== cls)) expect(html, `${c.key} ${f}: ${other}`).not.toContain(other);
      }
      const all = svg(c.icon, FEATURES);
      for (const [cls] of Object.values(MARKS)) expect(all).toContain(cls);
      expect(markClasses.map((cls) => all.indexOf(cls))).toEqual([...markClasses.map((cls) => all.indexOf(cls))].sort((a, b) => a - b));
      // 모르는 특징 이름은 아무것도 더하지 않는다.
      const none = svg(c.icon, ['nope']);
      for (const cls of markClasses) expect(none).not.toContain(cls);
      expect(all).not.toContain('<text');
    }
  });
  it('가운데 칸: 떠 있는 카드는 동그라미가 물결선 위(y < 9)에, 아닌 카드는 아래(y > 9)에 있다', () => {
    for (const c of exp.cards) {
      const html = svg(c.icon, ['float']);
      const cy = Number(/ph-float[\s\S]*?<circle cx="32" cy="([0-9.]+)"/.exec(html)?.[1]);
      expect(cy < 9, `${c.key} 동그라미 높이`).toBe(PLANT_HABITAT_RESULT[c.icon]!.float);
    }
  });
  it('돋보기에는 이 카드에서 살펴본 특징의 결과만 그려지고, 카드 버튼에는 겹쳐지지 않는다', () => {
    const c = exp.cards[0]!;
    const before = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: [], onObserve: noop }));
    for (const cls of markClasses) expect(before).not.toContain(cls);
    for (const f of exp.features) expect(before).toContain(f.action ?? `${f.label} 살펴보기`);
    const first = FEATURES[0]!;
    const after = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: [first], onObserve: noop }));
    expect(after).toContain(MARKS[first]![0]);
    for (const other of markClasses.filter((x) => x !== MARKS[first]![0])) expect(after).not.toContain(other);
    expect(after).toContain(c.observations[first]!);
    for (const f of FEATURES.slice(1)) expect(after).not.toContain(c.observations[f]!);
    const btn = renderToStaticMarkup(createElement(CardButton, { label: c.label, icon: c.icon, count: 3, total: 3, selected: false, onClick: noop }));
    for (const cls of markClasses) expect(btn).not.toContain(cls);
  });
});

describe('튜터 전수 가드', () => {
  it('모든 probe × 모든 카드 × 모든 기준 라벨이 가드를 통과하고 폴백이 아니다', () => {
    for (const probe of exp.tutor.probes) {
      for (const card of exp.cards) {
        for (const crit of exp.criteria) {
          const out = renderAndGuard(probe.when, { card: card.label, criterion: crit.label }, exp.tutor.probes, guard);
          const where = `${probe.when}/${card.label}/${crit.label}: ${out}`;
          expect(out, where).not.toBe(FALLBACK_PROBE);
          expect(guardOutput(out, guard).ok, where).toBe(true);
          expect(out, where).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)|\(을\)/);
        }
      }
    }
  });
  it('카드 이름을 여럿 이은 문장이 들어가도 걸리지 않는다', () => {
    for (const probe of exp.tutor.probes) {
      const out = renderAndGuard(probe.when, { card: exp.cards.map((c) => c.label).join(', '), criterion: exp.criteria[0]!.label }, exp.tutor.probes, guard);
      expect(out, probe.when).not.toBe(FALLBACK_PROBE);
    }
  });
  it('사양의 금지 구절이 모두 들어 있고 실제로 가드에 걸린다', () => {
    for (const phrase of ["공기주머니 덕분에 떠", "공기가 들어 있어서 떠", "공기 때문에 떠", "가시는 물을 아끼", "가시 잎으로 물이 덜", "물에 사는 식물은 떠", "환경에 적응"]) expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
    const leaks = ["공기주머니 덕분에 떠요.", "공기주머니가 있어서 떠 있어요.", "공기주머니 때문에 뜰 수 있어요.", "공기가 들어 있어서 떠요.", "공기가 들어 있어서 물 위에 떠 있어요.", "공기 때문에 떠요.", "공기 덕분에 떠 있어요.", "가시는 물을 아껴요.", "가시는 물을 아끼는 모양이에요.", "가시 잎으로 물이 덜 날아가요.", "가시 잎은 물을 아껴요.", "바늘잎은 물을 아껴요.", "물에 사는 식물은 떠 있어요.", "물에 사는 식물은 모두 떠요.", "물에 사는 식물은 다 떠요.", "물에서 자라는 식물은 떠요.", "환경에 적응했어요.", "환경에 적응한 모습이에요.", "사는 곳에 적응했어요.", "사는 곳에 적응해서 그래요.", "예쁜가는 분류 기준이 될 수 없어요.", "예쁜지는 분류 기준이 아니에요.", "예쁜가는 기준이 될 수 없어요.", "공 기 주 머 니 덕 분 에 떠 요!", "가시는,물을  아껴요.", "증산 작용이 일어나요.", "기공이 열려요.", "통기 조직이 있어요."];
    for (const t of leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
  });
  it('제한 용어가 들어간 문장은 걸린다', () => {
    for (const w of exp.limits) expect(guardOutput(`이 카드는 ${w}와 관계가 있어요.`, guard).ok, w).toBe(false);
  });
  it('관찰 문장처럼 보이는 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
    for (const t of [...exp.cards.map((c) => Object.values(c.observations)[0]!), ...["개구리밥 카드를 관찰한 결과와 넣은 무리를 다시 비교해 볼까요?", "연꽃은 아직 관찰해 보지 않았어요.", "물 위에 떠 있는지 살펴볼까요?", "잎의 모양이 비슷한 카드끼리 모아 볼까요?", "선인장 줄기에 가늘고 뾰족한 가시가 가득 나 있어요."]]) {
      expect(guardOutput(t, guard).ok, t).toBe(true);
    }
  });
});

describe('피드백 전수 가드', () => {
  const truth = (card: string, f: string) => exp.cards.find((c) => c.key === card)!.features[f] as string;
  it('모든 확인 결과의 피드백이 가드를 통과한다', () => {
    const results: Array<ReturnType<typeof check>['checked']> = [];
    for (const crit of exp.criteria) {
      const f = crit.feature;
      for (const bad of [undefined, ...ALL]) {
        for (const observedAll of [true, false]) {
          let s = chooseCriterion(createInitialState(), exp, crit.key);
          if (f && observedAll) s = ALL.reduce((cur, c) => observe(cur, exp, c, f), s);
          const groups = crit.groups.map((g) => g.value);
          s = ALL.reduce((cur, c) => place(cur, exp, c, f ? (c === bad ? groups.find((g) => g !== truth(c, f))! : truth(c, f)) : groups[0]!), s);
          results.push(check(s, exp).checked);
        }
      }
    }
    const synthetic = (['unobserved', 'inconsistent'] as const).flatMap((status) =>
      [...ALL.map((c) => [c]), ALL].map((set) => ({
        kind: status === 'unobserved' ? ('check-unobserved' as const) : ('check-inconsistent' as const),
        items: set.map((card) => ({ card, status })),
      })),
    );
    for (const c of [...results, ...synthetic, null]) {
      const text = cardSortFeedback(exp, c);
      expect(guardOutput(text, guard).ok, text).toBe(true);
      expect(text).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)/);
    }
  });
  it('개구리밥을 틀린 무리에 넣으면 그 카드만 다시 비교하라고 한다', () => {
    let s = chooseCriterion(createInitialState(), exp, 'float');
    s = ALL.reduce((cur, c) => observe(cur, exp, c, 'float'), s);
    s = ALL.reduce((cur, c) => place(cur, exp, c, c === 'duckweed' ? 'no' : truth(c, 'float')), s);
    expect(cardSortFeedback(exp, check(s, exp).checked)).toBe('개구리밥은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  });
});
