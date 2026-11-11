import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateCardSortExperiment } from '@sci/cardsort';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import strataJson from '../../../../../content/units/g5-strata/manifest.json';
import { UNITS } from '../../units';
import { chooseCriterion, check, createInitialState, observe, place } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { GRAIN_RESULT, GRAIN_ICON_KEYS, GrainIcon } from './GrainIcons';

/** 지층과 화석 두 번째 활동 rock-grain(퇴적암을 알갱이 크기로 나누기) 시험. 사양 docs/specs/card-sort-batch-a.md §4. 첫 활동은 순서(order) 배치이고 이 활동은 무리 나누기(groups)이다. */
const manifest = parseManifest(strataJson);
const exp = manifest.experiments[1] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const noop = () => {};
const FEATURES = ['grain', 'smooth', 'pebble'];

/** 사양 §4 표: 카드 -> [이름, 아이콘, grain, smooth, pebble]. */
const TABLE: Record<string, [string, string, string, string, string]> = {
  rockA: ["회색 암석 가", "rg-a", "fine", "yes", "no"],
  rockB: ["검은 암석 나", "rg-b", "fine", "yes", "no"],
  rockC: ["붉은 암석 다", "rg-c", "fine", "yes", "no"],
  rockD: ["누런 암석 라", "rg-d", "sand", "no", "no"],
  rockE: ["회색 암석 마", "rg-e", "sand", "no", "no"],
  rockF: ["붉은 암석 바", "rg-f", "sand", "no", "no"],
  rockG: ["얼룩 암석 사", "rg-g", "gravel", "no", "yes"],
  rockH: ["회색 암석 아", "rg-h", "gravel", "no", "yes"],
};

const OBS: Record<string, [string, string, string]> = {
  rockA: ["돋보기로 보아도 알갱이가 잘 보이지 않아요.", "문지르면 매끄럽고 손에 고운 가루가 묻어요.", "표면이 고르고 박힌 조각이 없어요."],
  rockB: ["돋보기로 보아도 알갱이가 거의 보이지 않고 검게 번들거려요.", "문지르면 매끄럽고 손가락에 검은 가루가 묻어요.", "표면이 곱고 박힌 조각이 보이지 않아요."],
  rockC: ["돋보기로 보아도 알갱이가 잘 보이지 않고 붉은 흙빛이에요.", "문지르면 매끄럽고 붉은 가루가 손에 묻어요.", "표면이 고르고 박힌 조각이 없어요."],
  rockD: ["돋보기로 보면 모래알만 한 알갱이가 빽빽이 붙어 있어요.", "문지르면 까끌까끌하고 알갱이가 조금 떨어져요.", "표면에 박힌 둥근 조각은 보이지 않아요."],
  rockE: ["돋보기로 보면 모래알만 한 회색 알갱이들이 보여요.", "문지르면 까끌까끌해요.", "알갱이 크기가 모두 비슷하고 박힌 조각이 없어요."],
  rockF: ["돋보기로 보면 모래알만 한 붉은 알갱이들이 보여요.", "문지르면 까끌까끌하고 알갱이가 손에 걸려요.", "표면에 박힌 둥근 조각이 보이지 않아요."],
  rockG: ["콩알보다 큰 둥근 돌 조각 사이를 모래알이 채우고 있어요.", "문지르면 울퉁불퉁하고 까끌까끌해요.", "둥근 돌 조각 여러 개가 박혀 있어요."],
  rockH: ["콩알보다 큰 회색 둥근 돌 조각들이 모래알 사이에 붙어 있어요.", "문지르면 울퉁불퉁하고 까끌까끌해요.", "둥근 돌 조각이 여러 개 박혀 있어요."],
};

/** 관찰 문장에 들어가면 안 되는 말(정답 이름·판정 말·설명 말). */
const NOT_IN_OBSERVATION = ['이암', '사암', '역암', '셰일', '석회암', '진흙', '자갈', '쇄설', '입도'];

/** 그림이 살펴본 특징에 따라 그리는 표시: 특징 key -> [그림 class, data 속성, 값(카드의 그림 key)]. */
const MARKS: Record<string, [string, string, (icon: string) => string]> = {
  grain: ['rg-grain', 'data-grain', icon => GRAIN_RESULT[icon]!.grain],
  smooth: ['rg-smooth', 'data-smooth', icon => String(GRAIN_RESULT[icon]!.smooth)],
  pebble: ['rg-pebble', 'data-pebble', icon => String(GRAIN_RESULT[icon]!.pebble)],
};

describe('퇴적암을 알갱이 크기로 나누기 두 번째 활동 매니페스트 (사양 §0, §4)', () => {
  it('첫 활동은 그대로이고 두 번째 활동이 뒤에 붙는다', () => {
    expect(manifest.experiments.map((e) => e.id)).toEqual(['strata-order', 'rock-grain']);
    expect(manifest.experiments[0]!.module).toBe('card-sort');
    expect([manifest.id, manifest.title, manifest.grade, manifest.engine, manifest.standards]).toEqual(['g5-strata', '지층과 화석', 5, 'earth', ['6과01-01', '6과01-02', '6과01-03']]);
  });
  it('활동 정보', () => {
    expect([exp.id, exp.module, exp.layout]).toEqual(['rock-grain', 'card-sort', 'groups']);
    expect(exp.title).toBe("퇴적암을 알갱이 크기로 나누기");
    expect(exp.question).toBe("퇴적암을 알갱이의 크기에 따라 어떻게 나눌 수 있을까?");
    expect(exp.limits).toEqual(["쇄설성", "셰일", "입도"]);
    expect(exp.safetyChecklist).toEqual([]);
    expect(exp.safetyNotices ?? []).toEqual([]);
  });
  it('특징 3가지와 돋보기 버튼 문구', () => {
    expect(exp.features.map((f) => [f.key, f.label, f.action])).toEqual([["grain", "알갱이 크기", undefined], ["smooth", "문지른 느낌", undefined], ["pebble", "박힌 조각", undefined]]);
  });
  it('분류 기준(4가지)과 무리 이름', () => {
    expect(exp.criteria.map((c) => [c.key, c.label, c.feature, c.objective, c.groups.map((g) => [g.value, g.label])])).toEqual([["grain", "알갱이는 얼마나 큰가요?", "grain", true, [["fine", "너무 작아 잘 보이지 않는다"], ["sand", "모래알만 하다"], ["gravel", "콩알보다 크다"]]], ["smooth", "손으로 문지르면 매끄러운가요?", "smooth", true, [["yes", "매끄럽다"], ["no", "까끌까끌하다"]]], ["pebble", "둥근 돌 조각이 박혀 있나요?", "pebble", true, [["yes", "박혀 있다"], ["no", "박혀 있지 않다"]]], ["color", "색이 마음에 드나요?", undefined, false, [["like", "마음에 든다"], ["dislike", "마음에 들지 않는다"]]]]);
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
  it('알갱이 표: 고운 3 · 모래알 3 · 콩알보다 큼 2, 매끄러운 카드는 고운 카드뿐, 박힌 조각은 큰 알갱이 카드뿐', () => {
    expect(exp.cards.filter((c) => c.features.grain === 'fine').map((c) => c.label)).toEqual(['회색 암석 가', '검은 암석 나', '붉은 암석 다']);
    expect(exp.cards.filter((c) => c.features.grain === 'sand').map((c) => c.label)).toEqual(['누런 암석 라', '회색 암석 마', '붉은 암석 바']);
    expect(exp.cards.filter((c) => c.features.grain === 'gravel').map((c) => c.label)).toEqual(['얼룩 암석 사', '회색 암석 아']);
    expect(exp.cards.filter((c) => c.features.smooth === 'yes').every((c) => c.features.grain === 'fine')).toBe(true);
    expect(exp.cards.filter((c) => c.features.pebble === 'yes').every((c) => c.features.grain === 'gravel')).toBe(true);
    expect(exp.criteria.find((c) => c.key === 'grain')!.groups).toHaveLength(3);
  });
  it('카드 이름과 화면 문구에는 암석 이름(이암·사암·역암)이 없다', () => {
    const text = JSON.stringify({ ...exp, limits: [], tutor: { probes: exp.tutor.probes } });
    for (const w of ['이암', '사암', '역암', '셰일', '석회암']) expect(text, w).not.toContain(w);
  });
  it('첫 활동(순서 놓기)의 카드 이름에는 역암·사암·이암·셰일이 나오고, 그 활동의 금지 구절은 바이트 그대로라서 이 활동의 금지 구절만 더했다', () => {
    const first = manifest.experiments[0] as CardSortExperiment;
    expect(first.layout).toBe('order');
    for (const name of ['역암', '사암', '이암', '셰일']) expect(first.cards.map((c) => c.label), name).toContain(name);
    // 첫 활동의 가드는 암석 이름을 금지하지 않는다. 이름이 카드로 나오기 때문이다.
    for (const name of ['이암', '사암', '역암']) expect(first.tutor.forbiddenAnswers.some((p) => p === name), name).toBe(false);
    for (const name of ['이암', '사암', '역암']) expect(exp.tutor.forbiddenAnswers, name).toContain(name);
    // 가드는 활동별이다: 첫 활동 카드 이름은 첫 활동 가드를 통과한다.
    const firstGuard = { forbiddenAnswers: first.tutor.forbiddenAnswers, limits: first.limits };
    for (const c of first.cards) expect(guardOutput(c.label, firstGuard).ok, c.label).toBe(true);
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
    const u = UNITS.find((x) => x.id === 'g5-strata')!;
    expect(u.ok && u.activities.map((a) => a.activity)).toEqual(['card-sort', 'card-sort']);
    // 최상위 값은 첫 활동이다.
    expect(u.ok && u.activity).toBe('card-sort');
    if (u.ok) {
      const second = u.activities[1]!;
      expect(second.activity === 'card-sort' && second.module.kind).toBe('card-sort');
      expect(second.experiment.id).toBe('rock-grain');
    }
  });
  it('probe가 모든 상황을 덮고 finished 문장이 사양과 같다', () => {
    const byWhen = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
    expect(Object.keys(byWhen).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
    );
    expect(byWhen['finished']).toBe("알갱이가 아주 작은 암석은 무엇이 쌓여 만들어졌을까요? 모래알만 한 알갱이로 된 암석과 견주어 볼까요?");
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

describe('퇴적암을 알갱이 크기로 나누기 그림', () => {
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(GrainIcon, { icon, size: 140, shown }));
  const markClasses = Object.values(MARKS).map(([cls]) => cls);
  it('카드마다 그림이 있고 결과 표가 매니페스트와 같다', () => {
    expect(exp.cards.map((c) => c.icon)).toEqual(['rg-a', 'rg-b', 'rg-c', 'rg-d', 'rg-e', 'rg-f', 'rg-g', 'rg-h']);
    expect(GRAIN_ICON_KEYS).toEqual(exp.cards.map((c) => c.icon));
    for (const c of exp.cards) {
      expect(GRAIN_ICON_KEYS, c.icon).toContain(c.icon);
      const r = GRAIN_RESULT[c.icon]! as Record<string, unknown>;
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
    const mine = GRAIN_ICON_KEYS;
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
  it('확대 원 안의 알갱이: 고운 알갱이는 아주 작은 점, 모래알은 중간 점, 콩알보다 큰 알갱이는 큰 동그라미 둘', () => {
    for (const c of exp.cards) {
      const html = svg(c.icon, ['grain']);
      const size = GRAIN_RESULT[c.icon]!.grain;
      const n = (html.split('rg-grain')[1] ?? '').match(/<circle/g)?.length ?? 0;
      expect(n, `${c.key} 원 안의 모양 수`).toBe(size === 'fine' ? 26 : size === 'sand' ? 8 : 3);
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
    for (const phrase of ["이암", "사암", "역암", "진흙이 쌓", "모래가 쌓", "자갈이 쌓"]) expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
    const leaks = ["이암이에요.", "이암이라고 해요.", "사암이에요.", "사암은 모래로 만들어졌어요.", "역암이에요.", "이것은 역암이에요.", "이 암석은 이 암 이에요.", "진흙이 쌓여 만들어졌어요.", "진흙이 쌓인 암석이에요.", "진흙이 쌓였어요.", "진흙이 굳어서 만들어졌어요.", "진흙으로 만들어졌어요.", "모래가 쌓여 만들어졌어요.", "모래가 쌓인 암석이에요.", "모래가 굳어서 생겼어요.", "모래로 만들어졌어요.", "자갈이 쌓여 만들어졌어요.", "자갈이 쌓인 암석이에요.", "자갈이 굳어서 생겼어요.", "자갈로 만들어졌어요.", "알갱이가 작은 암석은 진흙이에요.", "알갱이가 큰 암석은 자갈이에요.", "색이 마음에 드나는 분류 기준이 될 수 없어요.", "색이 마음에 드는지는 분류 기준이 아니에요.", "마음에 드는 것은 분류 기준이 아니에요.", "쇄설성 암석이에요.", "셰일이에요.", "입도가 달라요.", "이 암 이 에 요!", "진흙이,쌓여  만들어졌어요."];
    for (const t of leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
  });
  it('제한 용어가 들어간 문장은 걸린다', () => {
    for (const w of exp.limits) expect(guardOutput(`이 카드는 ${w}와 관계가 있어요.`, guard).ok, w).toBe(false);
  });
  it('관찰 문장처럼 보이는 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
    for (const t of [...exp.cards.map((c) => Object.values(c.observations)[0]!), ...["회색 암석 가를 관찰한 결과와 넣은 무리를 다시 비교해 볼까요?", "붉은 암석 다는 아직 관찰해 보지 않았어요.", "돋보기로 알갱이를 살펴볼까요?", "알갱이 크기가 비슷한 카드끼리 모아 볼까요?", "얼룩 암석 사에는 둥근 돌 조각 여러 개가 박혀 있어요."]]) {
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
  it('회색 암석 가을 틀린 무리에 넣으면 그 카드만 다시 비교하라고 한다', () => {
    let s = chooseCriterion(createInitialState(), exp, 'grain');
    s = ALL.reduce((cur, c) => observe(cur, exp, c, 'grain'), s);
    s = ALL.reduce((cur, c) => place(cur, exp, c, c === 'rockA' ? 'sand' : truth(c, 'grain')), s);
    expect(cardSortFeedback(exp, check(s, exp).checked)).toBe('회색 암석 가는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  });
});
