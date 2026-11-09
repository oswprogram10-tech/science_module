import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateCardSortExperiment } from '@sci/cardsort';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import mixtureJson from '../../../../../content/units/g5-mixture/manifest.json';
import { UNITS } from '../../units';
import { chooseCriterion, check, createInitialState, observe, place } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { MIXTURE_DISSOLVES, MIXTURE_ICON_KEYS, MIXTURE_RESULT, MIXTURE_SIZE_BARS, MixtureIcon } from './MixtureIcons';

const manifest = parseManifest(mixtureJson);
const exp = manifest.experiments[1] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const noop = () => {};

/** 사양 §나.1 표: 카드 -> [이름, size, magnet, dissolve]. */
const TABLE: Record<string, [string, string, string, string]> = {
  beanmillet: ['콩과 좁쌀', 'yes', 'no', 'no'],
  ricesand: ['쌀과 모래', 'yes', 'no', 'no'],
  ironsand: ['철 가루와 모래', 'no', 'yes', 'no'],
  ironglass: ['철 구슬과 유리 구슬', 'no', 'yes', 'no'],
  saltsand: ['소금과 모래', 'no', 'no', 'yes'],
  sugarbean: ['설탕과 콩', 'yes', 'no', 'yes'],
};

const OBS: Record<string, [string, string, string]> = {
  beanmillet: ['콩은 크고 좁쌀은 아주 작아요.', '자석을 대도 아무것도 붙지 않아요.', '물에 넣어도 콩과 좁쌀 모두 그대로 남아 있어요.'],
  ricesand: ['쌀알은 모래알보다 훨씬 커요.', '자석을 대도 아무것도 붙지 않아요.', '물에 넣어도 쌀과 모래 모두 그대로 남아 있어요.'],
  ironsand: ['두 가루의 알갱이 크기가 비슷해요.', '자석을 가까이 대면 검은 가루만 자석에 달라붙어요.', '물에 넣어도 두 가루 모두 바닥에 가라앉아요.'],
  ironglass: ['두 구슬의 크기가 같아요.', '자석을 대면 철 구슬만 끌려와요.', '물에 넣어도 두 구슬 모두 그대로예요.'],
  saltsand: ['소금 알갱이와 모래알의 크기가 비슷해요.', '자석을 대도 아무것도 붙지 않아요.', '물에 넣고 저으면 소금은 보이지 않게 되고 모래는 바닥에 남아요.'],
  sugarbean: ['콩은 크고 설탕 알갱이는 작아요.', '자석을 대도 아무것도 붙지 않아요.', '물에 넣고 저으면 설탕은 보이지 않게 되고 콩은 그대로 남아요.'],
};

describe('혼합물의 분리 두 번째 활동 매니페스트 (사양 §나)', () => {
  it('첫 활동(소금과 모래)은 그대로이고 두 번째 활동이 뒤에 붙는다', () => {
    expect(manifest.experiments.map((e) => e.id)).toEqual(['salt-sand', 'separation-methods']);
    expect(manifest.experiments[0]!.module).toBe('salt-sand');
    expect([manifest.id, manifest.title, manifest.grade, manifest.standards]).toEqual(['g5-mixture', '혼합물의 분리', 5, ['6과05-03']]);
  });
  it('활동 정보', () => {
    expect([exp.id, exp.module, exp.layout]).toEqual(['separation-methods', 'card-sort', 'groups']);
    expect(exp.title).toBe('혼합물의 성질에 따라 분리 방법 고르기');
    expect(exp.question).toBe('혼합물을 이루는 물질의 성질이 다르면 어떻게 분리할 수 있을까?');
    expect(exp.limits).toEqual(['밀도', '자성', '용해도', '여과', '증류', '크로마토그래피']);
    expect(exp.safetyChecklist).toEqual([]);
    expect(exp.safetyNotices ?? []).toEqual([]);
  });
  it('특징 3가지와 돋보기 버튼 문구', () => {
    expect(exp.features.map((f) => f.action)).toEqual(['크기 비교하기', '자석 대 보기', '물에 넣어 보기']);
    expect(exp.features.map((f) => f.key)).toEqual(['size', 'magnet', 'dissolve']);
  });
  it('분류 기준 4가지(주관 기준 하나)', () => {
    expect(exp.criteria.map((c) => [c.key, c.label, c.feature, c.objective, c.groups.map((g) => g.label)])).toEqual([
      ['size', '두 가지의 알갱이 크기가 다른가요?', 'size', true, ['다르다', '비슷하다']],
      ['magnet', '한 가지가 자석에 붙나요?', 'magnet', true, ['붙는다', '붙지 않는다']],
      ['dissolve', '한 가지만 물에 녹나요?', 'dissolve', true, ['녹는다', '녹지 않는다']],
      ['clean', '보기에 깨끗한가요?', undefined, false, ['깨끗해 보인다', '지저분해 보인다']],
    ]);
  });
  it('카드 6장의 표(이름·특징값)와 관찰 문장이 사양과 같다', () => {
    expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(TABLE));
    for (const c of exp.cards) {
      const [label, size, magnet, dissolve] = TABLE[c.key]!;
      expect([c.label, c.sublabel], c.key).toEqual([label, undefined]);
      expect(c.features, c.key).toEqual({ size, magnet, dissolve });
      expect(c.observations, c.key).toEqual({ size: OBS[c.key]![0], magnet: OBS[c.key]![1], dissolve: OBS[c.key]![2] });
    }
  });
  it('설탕과 콩은 체와 물 두 방법이 모두 가능한 카드다(크기도 다르고 한 가지는 녹는다)', () => {
    const f = exp.cards.find((c) => c.key === 'sugarbean')!.features;
    expect(f).toMatchObject({ size: 'yes', dissolve: 'yes' });
    expect(exp.cards.filter((c) => c.features.size === 'yes' && c.features.dissolve === 'yes').map((c) => c.key)).toEqual(['sugarbean']);
    // 자석에 붙는 혼합물은 철 가루와 모래, 철 구슬과 유리 구슬뿐이다.
    expect(exp.cards.filter((c) => c.features.magnet === 'yes').map((c) => c.key)).toEqual(['ironsand', 'ironglass']);
  });
  it('validateCardSortExperiment를 통과하고 레지스트리에서 두 번째 활동으로 등록된다', () => {
    expect(validateCardSortExperiment(exp)).toEqual([]);
    const u = UNITS.find((x) => x.id === 'g5-mixture')!;
    expect(u.ok && u.activities.map((a) => a.activity)).toEqual(['variable', 'card-sort']);
    // 최상위 값은 첫 활동이다.
    expect(u.ok && u.activity).toBe('variable');
    if (u.ok) {
      const second = u.activities[1]!;
      expect(second.activity === 'card-sort' && second.module.kind).toBe('card-sort');
      expect(second.experiment.id).toBe('separation-methods');
    }
  });
  it('probe가 모든 상황을 덮고 finished 문장이 사양과 같다', () => {
    const byWhen = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
    expect(Object.keys(byWhen).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
    );
    expect(byWhen['finished']).toBe('성질에 따라 나누어 보았어요. 그러면 각 무리의 혼합물은 어떤 도구로 분리할 수 있을까요? 두 가지 방법이 다 될 것 같은 혼합물도 있나요?');
    for (const t of Object.values(byWhen)) expect(t, t).toMatch(/[?？]/);
  });
  it('화면에 나오는 모든 문장에 제한 용어와 금지 구절이 없다', () => {
    const text = JSON.stringify({ ...exp, limits: [], tutor: { probes: exp.tutor.probes } });
    expect(guardOutput(text, guard)).toEqual({ ok: true, hits: [] });
    for (const c of exp.cards) for (const o of Object.values(c.observations)) expect(guardOutput(o, guard).ok, o).toBe(true);
    for (const w of ['혼합물', '성질']) expect(text).toContain(w);
  });
});

describe('혼합물 그림', () => {
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(MixtureIcon, { icon, size: 140, shown }));
  const widths = (html: string) => ({
    a: Number(/mix-size-a" data-length="([\d.]+)"/.exec(html)?.[1]),
    b: Number(/mix-size-b" data-length="([\d.]+)"/.exec(html)?.[1]),
  });
  it('카드마다 그림이 있고 결과 표가 매니페스트와 같다', () => {
    expect(exp.cards.map((c) => c.icon)).toEqual(['mix-bean-millet', 'mix-rice-sand', 'mix-iron-sand', 'mix-iron-glass', 'mix-salt-sand', 'mix-sugar-bean']);
    for (const c of exp.cards) {
      expect(MIXTURE_ICON_KEYS, c.icon).toContain(c.icon);
      const r = MIXTURE_RESULT[c.icon]!;
      expect([r.size, r.magnet, r.dissolve], c.key).toEqual([c.features.size === 'yes', c.features.magnet === 'yes', c.features.dissolve === 'yes']);
      // 크기 비교선의 길이가 다른 카드가 size yes이고, 녹는 재료가 있는 카드가 dissolve yes이다.
      const [a, b] = MIXTURE_SIZE_BARS[c.icon]!;
      expect(a !== b, `${c.key} 크기 비교선`).toBe(r.size);
      expect(MIXTURE_DISSOLVES[c.icon] !== null, `${c.key} 녹는 재료`).toBe(r.dissolve);
    }
  });
  it('그림 key가 다른 카드 그림과 겹치지 않는다', async () => {
    const { MATERIAL_ICON_KEYS } = await import('./MaterialIcons');
    const { ANIMAL_ICON_KEYS } = await import('./AnimalIcons');
    const { LEAF_ICON_KEYS } = await import('./LeafIcons');
    const { STRATA_ICON_KEYS } = await import('./StrataIcons');
    for (const k of MIXTURE_ICON_KEYS) for (const other of [MATERIAL_ICON_KEYS, ANIMAL_ICON_KEYS, LEAF_ICON_KEYS, STRATA_ICON_KEYS]) expect(other, k).not.toContain(k);
  });
  it('관찰 전의 기본 그림에는 결과 그림이 없고 글자가 없다', () => {
    for (const c of exp.cards) {
      for (const shown of [undefined, []]) {
        const html = svg(c.icon, shown);
        expect(html, c.key).not.toContain('mix-');
        expect(html).not.toContain('<text');
        expect(html).toContain('aria-hidden="true"');
      }
    }
  });
  it('시험한 특징의 결과 그림만 나타난다', () => {
    for (const c of exp.cards) {
      const r = MIXTURE_RESULT[c.icon]!;
      const size = svg(c.icon, ['size']);
      expect(size).toContain('mix-size');
      expect(size).not.toMatch(/mix-(magnet|stuck|beaker|gone|settle)/);
      const w = widths(size);
      expect(w.a !== w.b, `${c.key} 크기 비교선 길이`).toBe(r.size);
      const magnet = svg(c.icon, ['magnet']);
      expect(magnet).toContain('mix-magnet');
      expect(magnet).not.toMatch(/mix-(size|beaker|gone|settle)/);
      expect(magnet.includes('mix-stuck'), `${c.key} 달라붙음`).toBe(r.magnet);
      const water = svg(c.icon, ['dissolve']);
      expect(water).toContain('mix-beaker');
      expect(water).not.toMatch(/mix-(size|magnet|stuck)/);
      expect(water.includes('mix-gone'), `${c.key} 녹아 사라짐`).toBe(r.dissolve);
      expect(water.includes('mix-settle'), `${c.key} 가라앉음`).toBe(!r.dissolve);
      expect(svg(c.icon, ['size', 'magnet', 'dissolve'])).toMatch(/mix-size[\s\S]*mix-magnet|mix-beaker/);
    }
  });
  it('돋보기에는 이 카드에서 시험한 특징의 결과만 그려진다', () => {
    const c = exp.cards.find((x) => x.key === 'ironglass')!;
    const before = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: [], onObserve: noop }));
    expect(before).not.toContain('mix-');
    for (const a of ['크기 비교하기', '자석 대 보기', '물에 넣어 보기']) expect(before).toContain(a);
    const after = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: ['magnet'], onObserve: noop }));
    expect(after).toContain('mix-stuck');
    expect(after).not.toMatch(/mix-(size|beaker)/);
    // 카드 버튼(작은 그림)에는 결과가 겹쳐지지 않는다.
    const btn = renderToStaticMarkup(createElement(CardButton, { label: c.label, icon: c.icon, count: 3, total: 3, selected: false, onClick: noop }));
    expect(btn).not.toContain('mix-');
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
  it('사양의 금지 구절 8개가 모두 들어 있고 실제로 가드에 걸린다', () => {
    for (const phrase of ['철 가루는 자석에 붙', '자석으로 철 가루를 분리', '체로 콩과 좁쌀을', '소금은 물에 녹', '크기가 다르면 체', '녹으면 물에 녹여 거르', '설탕과 콩은 두 가지 방법', '깨끗해 보이는가는 분류 기준이 될 수 없']) {
      expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
    }
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
    const leaks = [
      '철 가루는 자석에 붙어요.', '철 가루는 자석에 붙는다.', '철 가루는 자석에 붙습니다.', '철 가루는 자석에 붙지요.', '철 가루가 자석에 붙어요.', '철 가루는 자석에 달라붙어요.', '철 가루는 자석에 끌려와요.',
      '철 구슬은 자석에 붙어요.', '철은 자석에 붙어요.', '철이 자석에 붙으니까요.',
      '자석으로 철 가루를 분리해요.', '자석으로 철 가루를 분리할 수 있어요.', '자석으로 철 가루를 분리합니다.', '자석으로 철 가루를 골라낼 수 있어요.', '자석을 이용해 철 가루를 분리해요.', '자석으로 철 구슬을 분리해요.',
      '체로 콩과 좁쌀을 분리해요.', '체로 콩과 좁쌀을 걸러요.', '체로 쌀과 모래를 걸러 낼 수 있어요.', '콩과 좁쌀은 체로 분리해요.', '쌀과 모래는 체로 걸러요.',
      '소금은 물에 녹아요.', '소금은 물에 녹는다.', '소금은 물에 녹습니다.', '소금이 물에 녹아요.', '설탕은 물에 녹아요.', '설탕이 물에 녹는답니다.',
      '크기가 다르면 체를 써요.', '크기가 다르면 체로 걸러요.', '크기가 다른 혼합물은 체를 쓰면 돼요.', '크기가 다른 것은 체로 거르면 돼요.',
      '녹으면 물에 녹여 걸러요.', '물에 녹여 거르면 돼요.', '물에 녹인 뒤 거르면 돼요.', '물에 녹여서 걸러 내요.', '물에 녹인 뒤 걸러 내요.',
      '설탕과 콩은 두 가지 방법이 다 돼요.', '설탕과 콩은 두 방법 모두 가능해요.', '설탕과 콩은 체와 물 둘 다 쓸 수 있어요.', '설탕과 콩은 둘 다 돼요.',
      '깨끗해 보이는가는 분류 기준이 될 수 없어요.', '깨끗해 보이는가는 분류 기준이 아니에요.', '깨끗해 보이는가는 기준이 될 수 없어요.', '깨끗해 보이는지는 분류 기준이 될 수 없어요.', '깨끗해 보이는 것은 분류 기준이 될 수 없어요.',
      '철 가루 는 자 석 에 붙 어 요!', '체로  콩과,좁쌀을 거르세요.',
    ];
    for (const t of leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
  });
  it('제한 용어가 들어간 문장은 걸린다', () => {
    for (const w of exp.limits) expect(guardOutput(`이 혼합물은 ${w}가 달라요.`, guard).ok, w).toBe(false);
  });
  it('관찰 문장처럼 보이는 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
    for (const t of ['자석을 가까이 대면 검은 가루만 자석에 달라붙어요.', '자석을 대면 철 구슬만 끌려와요.', '물에 넣고 저으면 소금은 보이지 않게 되고 모래는 바닥에 남아요.', '설탕과 콩은 아직 시험해 보지 않았어요.', '철 가루와 모래를 시험한 결과를 다시 비교해 볼까요?']) {
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
  it('철 구슬과 유리 구슬을 "붙지 않는다"에 넣으면 그 카드만 다시 비교하라고 한다', () => {
    let s = chooseCriterion(createInitialState(), exp, 'magnet');
    s = ALL.reduce((cur, c) => observe(cur, exp, c, 'magnet'), s);
    s = ALL.reduce((cur, c) => place(cur, exp, c, c === 'ironglass' ? 'no' : truth(c, 'magnet')), s);
    expect(cardSortFeedback(exp, check(s, exp).checked)).toBe('철 구슬과 유리 구슬은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  });
});
