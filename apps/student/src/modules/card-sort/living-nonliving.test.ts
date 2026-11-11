import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateCardSortExperiment } from '@sci/cardsort';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import ecosystemJson from '../../../../../content/units/g4-ecosystem/manifest.json';
import { UNITS } from '../../units';
import { chooseCriterion, check, createInitialState, observe, place } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { ECO_RESULT, ECO_ICON_KEYS, EcoIcon } from './EcoIcons';

/** 생물과 환경 두 번째 활동 living-nonliving(생태계를 이루는 것 나누기) 시험. 사양 docs/specs/card-sort-batch-a.md §3. 첫 활동은 변인 실험(food-web)이다. */
const manifest = parseManifest(ecosystemJson);
const exp = manifest.experiments[1] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const noop = () => {};
const FEATURES = ['grow', 'food', 'move'];

/** 사양 §3 표: 카드 -> [이름, 아이콘, grow, food, move]. */
const TABLE: Record<string, [string, string, string, string, string]> = {
  sunlight: ["햇빛", "eco-sunlight", "no", "no", "no"],
  water: ["물", "eco-water", "no", "no", "no"],
  air: ["공기", "eco-air", "no", "no", "no"],
  soil: ["흙", "eco-soil", "no", "no", "no"],
  rock: ["돌", "eco-rock", "no", "no", "no"],
  rabbit: ["토끼", "eco-rabbit", "yes", "yes", "yes"],
  sparrow: ["참새", "eco-sparrow", "yes", "yes", "yes"],
  earthworm: ["지렁이", "eco-earthworm", "yes", "yes", "yes"],
  dandelion: ["민들레", "eco-dandelion", "yes", "yes", "no"],
  mushroom: ["버섯", "eco-mushroom", "yes", "yes", "no"],
};

const OBS: Record<string, [string, string, string]> = {
  sunlight: ["며칠 뒤 다시 보아도 크기나 수가 달라지지 않아요.", "먹거나 빨아들이는 것이 없어요.", "창으로 들어온 빛이 바닥에 비치지만, 스스로 갈 곳을 정해 움직이지는 않아요."],
  water: ["컵에 담아 며칠 두어도 스스로 늘어나지 않아요.", "먹거나 빨아들이는 것이 없어요.", "낮은 곳으로 흘러가지만, 스스로 갈 곳을 정해 움직이지는 않아요."],
  air: ["며칠이 지나도 스스로 커지거나 늘어나지 않아요.", "먹거나 빨아들이는 것이 없어요.", "바람이 불면 움직이지만, 스스로 갈 곳을 정하지는 않아요."],
  soil: ["며칠 뒤 다시 보아도 흙 알갱이의 수와 크기가 그대로예요.", "먹거나 빨아들이는 것이 없어요.", "누가 옮기지 않으면 그 자리에 그대로 있어요."],
  rock: ["며칠 뒤 다시 보아도 크기와 모양이 그대로예요.", "먹거나 빨아들이는 것이 없어요.", "누가 옮기지 않으면 그 자리에 그대로 있어요."],
  rabbit: ["몇 달 뒤 다시 보니 몸집이 더 커지고 새끼도 태어났어요.", "풀을 뜯어 먹고 물을 마셔요.", "깡충깡충 뛰어서 스스로 이곳저곳으로 옮겨 다녀요."],
  sparrow: ["며칠 뒤 다시 보니 둥지 속 새끼의 몸이 더 커졌어요.", "낟알과 작은 벌레를 쪼아 먹어요.", "날개를 펴고 날아서 스스로 이곳저곳으로 옮겨 다녀요."],
  earthworm: ["몇 주 뒤 다시 보니 몸이 더 길고 굵어졌어요.", "흙 속의 썩은 낙엽을 먹어요.", "몸을 늘였다 줄였다 하며 스스로 흙 속을 기어 다녀요."],
  dandelion: ["며칠 뒤 다시 보니 잎이 더 커지고 꽃대가 올라왔어요.", "뿌리로 흙 속의 물과 양분을 빨아들여요.", "늘 같은 자리에 뿌리를 내리고 있어요."],
  mushroom: ["하룻밤 사이에 갓이 더 커지고 둘레에 작은 버섯이 새로 났어요.", "쓰러진 나무에 붙어 그 속의 물기와 양분을 빨아들여요.", "쓰러진 나무에 붙은 채 늘 같은 자리에 있어요."],
};

/** 관찰 문장에 들어가면 안 되는 말(정답 이름·판정 말·설명 말). */
const NOT_IN_OBSERVATION = ['생물', '비생물', '살아 있', '살아있', '생명', '생산자', '소비자', '분해자', '광합성', '요소'];

/** 그림이 살펴본 특징에 따라 그리는 표시: 특징 key -> [그림 class, data 속성, 값(카드의 그림 key)]. */
const MARKS: Record<string, [string, string, (icon: string) => string]> = {
  grow: ['eco-grow', 'data-grows', icon => String(ECO_RESULT[icon]!.grow)],
  food: ['eco-food', 'data-needs', icon => String(ECO_RESULT[icon]!.food)],
  move: ['eco-move', 'data-moves', icon => String(ECO_RESULT[icon]!.move)],
};

describe('생태계를 이루는 것 나누기 두 번째 활동 매니페스트 (사양 §0, §3)', () => {
  it('첫 활동은 그대로이고 두 번째 활동이 뒤에 붙는다', () => {
    expect(manifest.experiments.map((e) => e.id)).toEqual(['food-web', 'living-nonliving']);
    expect(manifest.experiments[0]!.module).toBe('food-web');
    expect([manifest.id, manifest.title, manifest.grade, manifest.engine, manifest.standards]).toEqual(['g4-ecosystem', '생물과 환경', 4, 'life', ['4과14-01', '4과14-02']]);
  });
  it('활동 정보', () => {
    expect([exp.id, exp.module, exp.layout]).toEqual(['living-nonliving', 'card-sort', 'groups']);
    expect(exp.title).toBe("생태계를 이루는 것 나누기");
    expect(exp.question).toBe("생태계를 이루는 것들을 어떻게 나눌 수 있을까?");
    expect(exp.limits).toEqual(["생산자", "소비자", "분해자", "광합성"]);
    expect(exp.safetyChecklist).toEqual([]);
    expect(exp.safetyNotices ?? []).toEqual([]);
  });
  it('특징 3가지와 돋보기 버튼 문구', () => {
    expect(exp.features.map((f) => [f.key, f.label, f.action])).toEqual([["grow", "자람", undefined], ["food", "양분", undefined], ["move", "움직임", undefined]]);
  });
  it('분류 기준(3가지)과 무리 이름', () => {
    expect(exp.criteria.map((c) => [c.key, c.label, c.feature, c.objective, c.groups.map((g) => [g.value, g.label])])).toEqual([["grow", "시간이 지나면 자라거나 수가 늘어나나요?", "grow", true, [["yes", "그렇다"], ["no", "그렇지 않다"]]], ["food", "살아가려면 양분이 필요한가요?", "food", true, [["yes", "필요하다"], ["no", "필요하지 않다"]]], ["move", "스스로 자리를 옮겨 다니나요?", "move", true, [["yes", "옮겨 다닌다"], ["no", "옮겨 다니지 않는다"]]]]);
  });
  it('카드 10장의 표(이름·특징값)와 관찰 문장이 사양과 같다', () => {
    expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(TABLE));
    for (const c of exp.cards) {
      const [label, icon, ...vals] = TABLE[c.key]!;
      expect([c.label, c.icon, c.sublabel], c.key).toEqual([label, icon, undefined]);
      expect(c.features, c.key).toEqual(Object.fromEntries(FEATURES.map((f, i) => [f, vals[i]])));
      expect(c.observations, c.key).toEqual(Object.fromEntries(FEATURES.map((f, i) => [f, OBS[c.key]![i]])));
    }
  });
  it('특징 표의 개수: 자람 5 · 양분 5 · 움직임 3, 움직임 없이 자라는 카드는 민들레와 버섯', () => {
    expect(exp.cards).toHaveLength(10);
    expect(exp.cards.filter((c) => c.features.grow === 'yes').map((c) => c.key)).toEqual(['rabbit', 'sparrow', 'earthworm', 'dandelion', 'mushroom']);
    expect(exp.cards.filter((c) => c.features.food === 'yes').map((c) => c.key)).toEqual(['rabbit', 'sparrow', 'earthworm', 'dandelion', 'mushroom']);
    expect(exp.cards.filter((c) => c.features.move === 'yes').map((c) => c.key)).toEqual(['rabbit', 'sparrow', 'earthworm']);
    expect(exp.cards.filter((c) => c.features.grow === 'no').map((c) => c.label)).toEqual(['햇빛', '물', '공기', '흙', '돌']);
    // 의도: 움직임 기준으로 나누면 살아 있는 것도 두 무리로 갈린다. 객관 기준 셋이 있고 주관 기준은 없다.
    expect(exp.criteria.filter((c) => c.objective)).toHaveLength(3);
    expect(exp.criteria.filter((c) => !c.objective)).toHaveLength(0);
  });
  it('물·공기의 움직임 문장은 "스스로 정하지 않는다"는 보이는 사실만 쓴다', () => {
    expect(exp.cards.find((c) => c.key === 'water')!.observations.move).toBe('낮은 곳으로 흘러가지만, 스스로 갈 곳을 정해 움직이지는 않아요.');
    expect(exp.cards.find((c) => c.key === 'air')!.observations.move).toBe('바람이 불면 움직이지만, 스스로 갈 곳을 정하지는 않아요.');
  });
  it('먹이 그물 활동(food-web)은 생산자·소비자·분해자·광합성을 쓰지 않아서 limits와 금지 구절에 그대로 둔다', () => {
    const first = JSON.stringify(manifest.experiments[0]);
    for (const w of ['생산자', '소비자', '분해자', '광합성']) {
      expect(first, w).not.toContain(w);
      expect(exp.limits, w).toContain(w);
    }
    // 첫 활동(변인 실험)의 금지 구절은 바이트 그대로다.
    expect((manifest.experiments[0] as unknown as { tutor: { forbiddenAnswers: string[] } }).tutor.forbiddenAnswers).toEqual(['여우가 없으면 토끼가 늘어', '토끼가 풀을 다 먹어', '생태계 평형이 깨졌기 때문', '비가 많이 오면 풀이 잘 자라', '털 색은 관계없']);
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
    const u = UNITS.find((x) => x.id === 'g4-ecosystem')!;
    expect(u.ok && u.activities.map((a) => a.activity)).toEqual(['variable', 'card-sort']);
    // 최상위 값은 첫 활동이다.
    expect(u.ok && u.activity).toBe('variable');
    if (u.ok) {
      const second = u.activities[1]!;
      expect(second.activity === 'card-sort' && second.module.kind).toBe('card-sort');
      expect(second.experiment.id).toBe('living-nonliving');
    }
  });
  it('probe가 모든 상황을 덮고 finished 문장이 사양과 같다', () => {
    const byWhen = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
    expect(Object.keys(byWhen).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
    );
    expect(byWhen['finished']).toBe("햇빛이나 물이 없어지면, 자라고 양분이 필요한 무리에는 어떤 일이 생길까요?");
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

describe('생태계를 이루는 것 나누기 그림', () => {
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(EcoIcon, { icon, size: 140, shown }));
  const markClasses = Object.values(MARKS).map(([cls]) => cls);
  it('카드마다 그림이 있고 결과 표가 매니페스트와 같다', () => {
    expect(exp.cards.map((c) => c.icon)).toEqual(['eco-sunlight', 'eco-water', 'eco-air', 'eco-soil', 'eco-rock', 'eco-rabbit', 'eco-sparrow', 'eco-earthworm', 'eco-dandelion', 'eco-mushroom']);
    expect(ECO_ICON_KEYS).toEqual(exp.cards.map((c) => c.icon));
    for (const c of exp.cards) {
      expect(ECO_ICON_KEYS, c.icon).toContain(c.icon);
      const r = ECO_RESULT[c.icon]! as Record<string, unknown>;
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
    const mine = ECO_ICON_KEYS;
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
  it('왼쪽 칸: 자란 카드는 큰 동그라미(r 5)가, 아닌 카드는 같은 크기 동그라미 둘이 있다', () => {
    for (const c of exp.cards) {
      const html = svg(c.icon, ['grow']);
      expect(html.includes('r="5"'), `${c.key} 큰 동그라미`).toBe(ECO_RESULT[c.icon]!.grow);
    }
  });
  it('돋보기에는 이 카드에서 살펴본 특징의 결과만 그려지고, 카드 버튼에는 겹쳐지지 않는다', () => {
    const c = exp.cards[9]!;
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
    for (const phrase of ["생물 요소", "비생물 요소", "움직이지 않아도 생물", "식물도 생물", "버섯은 생물", "버섯도 생물"]) expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
    const leaks = ["생물 요소예요.", "비생물 요소예요.", "생물 요소와 비생물 요소로 나눠요.", "비생물 요소는 움직이지 않아요.", "생물적 요소예요.", "비생물적 요소예요.", "움직이지 않아도 생물이에요.", "움직이지 않아도 살아 있어요.", "움직이지 않는 것도 생물이에요.", "움직이지 않는 식물도 생물이에요.", "식물도 생물이에요.", "식물도 살아 있는 생물이에요.", "식물은 생물이에요.", "식물은 살아 있어요.", "민들레도 생물이에요.", "버섯은 생물이에요.", "버섯도 생물이에요.", "버섯은 살아 있어요.", "버섯도 살아 있는 것이에요.", "움직이는 것이 생물이에요.", "자라는 것은 생물이에요.", "양분이 필요한 것이 생물이에요.", "돌은 생물이 아니에요.", "햇빛은 생물이 아니에요.", "생 물 요 소 예 요!", "비생물,요소예요.", "버섯은  생물이에요.", "생산자예요.", "소비자와 분해자가 있어요.", "광합성을 해요."];
    for (const t of leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
  });
  it('제한 용어가 들어간 문장은 걸린다', () => {
    for (const w of exp.limits) expect(guardOutput(`이 카드는 ${w}와 관계가 있어요.`, guard).ok, w).toBe(false);
  });
  it('관찰 문장처럼 보이는 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
    for (const t of [...exp.cards.map((c) => Object.values(c.observations)[0]!), ...["버섯 카드를 관찰한 결과와 넣은 무리를 다시 비교해 볼까요?", "돌은 아직 관찰해 보지 않았어요.", "스스로 자리를 옮겨 다니는지 살펴볼까요?", "자라는 카드끼리 모아 볼까요?", "민들레는 늘 같은 자리에 뿌리를 내리고 있어요.", "토끼는 풀을 뜯어 먹고 물을 마셔요."]]) {
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
  it('버섯을 틀린 무리에 넣으면 그 카드만 다시 비교하라고 한다', () => {
    let s = chooseCriterion(createInitialState(), exp, 'move');
    s = ALL.reduce((cur, c) => observe(cur, exp, c, 'move'), s);
    s = ALL.reduce((cur, c) => place(cur, exp, c, c === 'mushroom' ? 'yes' : truth(c, 'move')), s);
    expect(cardSortFeedback(exp, check(s, exp).checked)).toBe('버섯은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  });
});
