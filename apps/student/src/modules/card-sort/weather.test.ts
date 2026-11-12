import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateCardSortExperiment } from '@sci/cardsort';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import weatherJson from '../../../../../content/units/g5-weather/manifest.json';
import { UNITS } from '../../units';
import { chooseCriterion, check, createInitialState, observe, place } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { WEATHER_HEIGHT_MARK, WEATHER_ICON_KEYS, WEATHER_RESULT, WEATHER_RULER, WeatherIcon } from './WeatherIcons';

const manifest = parseManifest(weatherJson);
const exp = manifest.experiments[1] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const noop = () => {};

/** 사양 §1 표: 카드 -> [이름, surface, air, high]. */
const TABLE: Record<string, [string, string, string, string]> = {
  grassdrop: ['아침 풀잎에 맺힌 물방울', 'yes', 'no', 'no'],
  cupdrop: ['차가운 컵 겉에 맺힌 물방울', 'yes', 'no', 'no'],
  windowdrop: ['겨울 아침 창문 안쪽에 맺힌 물방울', 'yes', 'no', 'no'],
  riverhaze: ['새벽 강가를 덮은 뿌연 공기', 'no', 'yes', 'no'],
  valleyhaze: ['산골짜기에 낮게 깔린 뿌연 공기', 'no', 'yes', 'no'],
  whitecloud: ['하늘 높이 떠 있는 하얀 구름', 'no', 'yes', 'yes'],
  planecloud: ['비행기 창밖으로 보이는 구름', 'no', 'yes', 'yes'],
  darkcloud: ['비가 오기 전 하늘을 덮은 먹구름', 'no', 'yes', 'yes'],
};

const OBS: Record<string, [string, string, string]> = {
  grassdrop: ['풀잎 겉에 작은 물방울이 동그랗게 붙어 있어요.', '물방울은 풀잎에 붙어 있고, 둘레 공기는 맑아요.', '땅 가까이 풀잎 위에 있어요.'],
  cupdrop: ['컵 겉에 물방울이 붙어 있고, 손으로 만지면 손에 묻어요.', '물방울은 컵에 붙어 있고, 컵 둘레 공기는 맑아요.', '땅 가까이 책상 위에 놓인 컵에 있어요.'],
  windowdrop: ['창문 안쪽 유리에 작은 물방울이 줄지어 붙어 있어요.', '물방울은 유리에 붙어 있고, 방 안 공기는 맑아요.', '내 눈높이쯤 되는 창문 유리에 있어요.'],
  riverhaze: ['손을 대도 무엇이 붙어 있지는 않아요.', '강 위 공기가 뿌옇게 흐려 멀리가 잘 보이지 않아요.', '강물 바로 위, 땅 가까이에 깔려 있어요.'],
  valleyhaze: ['손을 휘저어도 붙잡히는 것이 없어요.', '골짜기 안 공기가 뿌옇게 흐려 앞이 흐릿하게 보여요.', '산 아래 골짜기 바닥, 땅 가까이에 깔려 있어요.'],
  whitecloud: ['어디에 붙어 있지 않아요.', '하늘에 하얗게 떠 있어요.', '고개를 들어야 보일 만큼 높은 하늘에 있어요.'],
  planecloud: ['창밖의 하얀 덩어리는 어디에도 붙어 있지 않아요.', '창밖 하늘에 하얀 덩어리가 둥실 떠 있어요.', '땅이 저 멀리 아래로 보일 만큼 높은 하늘에 있어요.'],
  darkcloud: ['하늘 한쪽에 걸려 있을 뿐 어디에도 붙어 있지 않아요.', '어두운 회색 덩어리가 하늘을 넓게 덮고 떠 있어요.', '건물과 산보다 훨씬 높은 하늘에 있어요.'],
};

/** 관찰 문장에 들어가면 안 되는 정답 이름(무리 이름처럼 쓰는 것). 카드 이름의 "구름"은 허용한다. */
const ANSWER_NAMES = ['이슬', '안개', '구름'];

describe('날씨와 우리 생활 두 번째 활동 매니페스트 (사양 §0, §1)', () => {
  it('첫 활동(해륙풍)은 그대로이고 두 번째 활동이 뒤에 붙는다(세 번째 활동 건습구 습도계가 그 뒤에 더해졌다)', () => {
    expect(manifest.experiments.map((e) => e.id)).toEqual(['land-sea-breeze', 'dew-fog-cloud', 'humidity']);
    expect(manifest.experiments[0]!.module).toBe('land-sea-breeze');
    expect([manifest.id, manifest.title, manifest.grade, manifest.engine, manifest.standards]).toEqual(['g5-weather', '날씨와 우리 생활', 5, 'earth', ['6과06-01', '6과06-02', '6과06-03']]);
  });
  it('활동 정보', () => {
    expect([exp.id, exp.module, exp.layout]).toEqual(['dew-fog-cloud', 'card-sort', 'groups']);
    expect(exp.title).toBe('이슬·안개·구름 비교하기');
    expect(exp.question).toBe('이슬, 안개, 구름은 어떤 점이 같고 어떤 점이 다를까?');
    expect(exp.limits).toEqual(['응결핵', '포화', '이슬점', '상대 습도', '단열 팽창']);
    expect(exp.safetyChecklist).toEqual([]);
    expect(exp.safetyNotices ?? []).toEqual([]);
  });
  it('특징 3가지와 돋보기 버튼 문구', () => {
    expect(exp.features.map((f) => [f.key, f.label, f.action])).toEqual([
      ['surface', '물체 겉', '가까이에서 만져 보기'],
      ['air', '공기 중', '주변 공기 살펴보기'],
      ['high', '떠 있는 높이', '어디쯤 있는지 올려다보기'],
    ]);
  });
  it('분류 기준 4가지(주관 기준 하나)', () => {
    expect(exp.criteria.map((c) => [c.key, c.label, c.feature, c.objective, c.groups.map((g) => [g.value, g.label])])).toEqual([
      ['surface', '물체의 겉에 붙어 있나요?', 'surface', true, [['yes', '붙어 있다'], ['no', '붙어 있지 않다']]],
      ['air', '공기 중에 떠 있나요?', 'air', true, [['yes', '떠 있다'], ['no', '떠 있지 않다']]],
      ['high', '땅에서 먼 높은 하늘에 있나요?', 'high', true, [['yes', '높은 하늘에 있다'], ['no', '땅 가까이에 있다']]],
      ['beauty', '보기에 아름다운가요?', undefined, false, [['pretty', '아름답다'], ['plain', '아름답지 않다']]],
    ]);
  });
  it('카드 8장의 표(이름·특징값)와 관찰 문장이 사양과 같다', () => {
    expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(TABLE));
    for (const c of exp.cards) {
      const [label, surface, air, high] = TABLE[c.key]!;
      expect([c.label, c.sublabel], c.key).toEqual([label, undefined]);
      expect(c.features, c.key).toEqual({ surface, air, high });
      expect(c.observations, c.key).toEqual({ surface: OBS[c.key]![0], air: OBS[c.key]![1], high: OBS[c.key]![2] });
    }
  });
  it('물체 겉에 붙은 카드 3장, 높은 하늘의 카드 3장, 공기 중에 뜬 카드 5장', () => {
    expect(exp.cards.filter((c) => c.features.surface === 'yes').map((c) => c.key)).toEqual(['grassdrop', 'cupdrop', 'windowdrop']);
    expect(exp.cards.filter((c) => c.features.air === 'yes').map((c) => c.key)).toEqual(['riverhaze', 'valleyhaze', 'whitecloud', 'planecloud', 'darkcloud']);
    expect(exp.cards.filter((c) => c.features.high === 'yes').map((c) => c.key)).toEqual(['whitecloud', 'planecloud', 'darkcloud']);
    // 물체 겉에 붙어 있으면서 공기 중에 떠 있는 카드는 없다.
    expect(exp.cards.filter((c) => c.features.surface === 'yes' && c.features.air === 'yes')).toEqual([]);
  });
  it('관찰 문장은 보이는 사실만 쓰고 정답 이름(이슬·안개·구름)을 쓰지 않는다', () => {
    for (const c of exp.cards) for (const o of Object.values(c.observations)) for (const w of ANSWER_NAMES) expect(o, `${c.key}: ${o}`).not.toContain(w);
    // 카드 이름의 "구름"은 그대로 둔다.
    expect(exp.cards.filter((c) => c.label.includes('구름')).map((c) => c.key)).toEqual(['whitecloud', 'planecloud', 'darkcloud']);
  });
  it('validateCardSortExperiment를 통과하고 레지스트리에서 두 번째 활동으로 등록된다', () => {
    expect(validateCardSortExperiment(exp)).toEqual([]);
    const u = UNITS.find((x) => x.id === 'g5-weather')!;
    expect(u.ok && u.activities.map((a) => a.activity)).toEqual(['variable', 'card-sort', 'variable']);
    // 최상위 값은 첫 활동이다.
    expect(u.ok && u.activity).toBe('variable');
    if (u.ok) {
      const second = u.activities[1]!;
      expect(second.activity === 'card-sort' && second.module.kind).toBe('card-sort');
      expect(second.experiment.id).toBe('dew-fog-cloud');
    }
  });
  it('probe가 모든 상황을 덮고 finished 문장이 사양과 같다', () => {
    const byWhen = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
    expect(Object.keys(byWhen).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
    );
    expect(byWhen['finished']).toBe('어디에 생기는지에 따라 나누어 보았어요. 그러면 이슬, 안개, 구름은 어떤 점이 같을까요? 셋 다 무엇으로 이루어져 있을지 생각해 볼까요?');
    for (const t of Object.values(byWhen)) expect(t, t).toMatch(/[?？]/);
  });
  it('화면에 나오는 모든 문장에 제한 용어와 금지 구절이 없다', () => {
    const text = JSON.stringify({ ...exp, limits: [], tutor: { probes: exp.tutor.probes } });
    expect(guardOutput(text, guard)).toEqual({ ok: true, hits: [] });
    for (const c of exp.cards) for (const o of Object.values(c.observations)) expect(guardOutput(o, guard).ok, o).toBe(true);
    for (const c of exp.cards) expect(guardOutput(c.label, guard).ok, c.label).toBe(true);
    for (const w of ['이슬', '안개', '구름']) expect(text).toContain(w);
  });
});

describe('이슬·안개·구름 그림', () => {
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(WeatherIcon, { icon, size: 140, shown }));
  it('카드마다 그림이 있고 결과 표가 매니페스트와 같다', () => {
    expect(exp.cards.map((c) => c.icon)).toEqual(['wx-grass-drops', 'wx-cup-drops', 'wx-window-drops', 'wx-river-haze', 'wx-valley-haze', 'wx-white-cloud', 'wx-plane-cloud', 'wx-dark-cloud']);
    expect(WEATHER_ICON_KEYS).toEqual(exp.cards.map((c) => c.icon));
    for (const c of exp.cards) {
      expect(WEATHER_ICON_KEYS, c.icon).toContain(c.icon);
      const r = WEATHER_RESULT[c.icon]!;
      expect([r.surface, r.air, r.high], c.key).toEqual([c.features.surface === 'yes', c.features.air === 'yes', c.features.high === 'yes']);
      // 높이 표시가 눈금자의 위쪽 절반에 있는 카드가 high yes이다.
      const y = WEATHER_HEIGHT_MARK[c.icon]!;
      expect(y >= WEATHER_RULER.top && y <= WEATHER_RULER.bottom, `${c.key} 눈금 안`).toBe(true);
      expect(y < WEATHER_RULER.mid, `${c.key} 높이 표시`).toBe(r.high);
    }
  });
  it('그림 key가 다른 카드 그림과 겹치지 않는다', async () => {
    const { MATERIAL_ICON_KEYS } = await import('./MaterialIcons');
    const { ANIMAL_ICON_KEYS } = await import('./AnimalIcons');
    const { LEAF_ICON_KEYS } = await import('./LeafIcons');
    const { STRATA_ICON_KEYS } = await import('./StrataIcons');
    const { MIXTURE_ICON_KEYS } = await import('./MixtureIcons');
    for (const k of WEATHER_ICON_KEYS) for (const other of [MATERIAL_ICON_KEYS, ANIMAL_ICON_KEYS, LEAF_ICON_KEYS, STRATA_ICON_KEYS, MIXTURE_ICON_KEYS]) expect(other, k).not.toContain(k);
  });
  it('관찰 전의 기본 그림에는 결과 그림이 없고 글자가 없다', () => {
    for (const c of exp.cards) {
      for (const shown of [undefined, []]) {
        const html = svg(c.icon, shown);
        expect(html, c.key).not.toContain('wx-result');
        expect(html).not.toMatch(/data-(attached|floating|mark-y)/);
        expect(html).not.toContain('#e06a00');
        expect(html).not.toContain('<text');
        expect(html).toContain('aria-hidden="true"');
      }
    }
  });
  it('살펴본 특징의 결과 그림만 나타나고 특징값과 일치한다', () => {
    for (const c of exp.cards) {
      const r = WEATHER_RESULT[c.icon]!;
      const surface = svg(c.icon, ['surface']);
      expect(surface).toContain('wx-surface');
      expect(surface).not.toMatch(/wx-(air|high|floating)/);
      expect(surface, `${c.key} 붙어 있음`).toContain(`data-attached="${r.surface}"`);
      const air = svg(c.icon, ['air']);
      expect(air).toContain('wx-air');
      expect(air).not.toMatch(/wx-(surface|high)/);
      expect(air, `${c.key} 떠 있음`).toContain(`data-floating="${r.air}"`);
      expect(air.includes('wx-floating'), `${c.key} 떠 있는 알갱이`).toBe(r.air);
      const high = svg(c.icon, ['high']);
      expect(high).toContain('wx-high');
      expect(high).not.toMatch(/wx-(surface|air|floating)/);
      expect(high, `${c.key} 높이 표시`).toContain(`data-mark-y="${WEATHER_HEIGHT_MARK[c.icon]}"`);
      const all = svg(c.icon, ['surface', 'air', 'high']);
      expect(all).toMatch(/wx-surface[\s\S]*wx-air[\s\S]*wx-high/);
      // 모르는 특징 이름은 아무것도 더하지 않는다.
      expect(svg(c.icon, ['nope'])).not.toContain('wx-result');
    }
  });
  it('돋보기에는 이 카드에서 살펴본 특징의 결과만 그려진다', () => {
    const c = exp.cards.find((x) => x.key === 'riverhaze')!;
    const before = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: [], onObserve: noop }));
    expect(before).not.toContain('wx-result');
    for (const a of ['가까이에서 만져 보기', '주변 공기 살펴보기', '어디쯤 있는지 올려다보기']) expect(before).toContain(a);
    const after = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: ['air'], onObserve: noop }));
    expect(after).toContain('wx-floating');
    expect(after).not.toMatch(/wx-(surface|high)/);
    // 카드 버튼(작은 그림)에는 결과가 겹쳐지지 않는다.
    const btn = renderToStaticMarkup(createElement(CardButton, { label: c.label, icon: c.icon, count: 3, total: 3, selected: false, onClick: noop }));
    expect(btn).not.toContain('wx-result');
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
    for (const phrase of [
      '모두 물방울', '셋 다 물방울', '모두 작은 물방울',
      '수증기가 응결', '수증기가 엉겨', '수증기가 물방울로 변',
      '이슬은 물체 표면', '이슬은 물체에 맺히', '이슬은 물체 겉에',
      '안개는 땅 가까이', '안개는 지표 가까이', '안개는 지면 가까이',
      '구름은 높은 하늘', '구름은 하늘 높이',
      '아름다운가는 분류 기준이 될 수 없',
    ]) {
      expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
    }
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
    const leaks = [
      '셋 다 물방울이에요.', '셋 다 물방울로 이루어져 있어요.', '모두 물방울이에요.', '모두 물방울입니다.', '모두 작은 물방울이에요.', '셋 모두 작은 물방울이에요.', '세 가지 모두 물방울이에요.', '전부 물방울이에요.',
      '모두 작은 물방울로 이루어져 있어요.', '셋 다 같은 물방울이에요.',
      '수증기가 응결해요.', '수증기가 응결되어요.', '수증기가 응결돼서 생겨요.', '수증기가 엉겨 붙어요.', '수증기가 엉겨서 생겨요.', '수증기가 물방울로 변해요.', '수증기가 물방울로 변한 거예요.',
      '수증기는 응결해서 물방울이 돼요.', '수증기는 물방울로 변합니다.', '수증기가 식으면 물방울이 돼요.', '수증기가 물방울이 돼요.',
      '이슬은 물체 표면에 생겨요.', '이슬은 물체에 맺히는 거예요.', '이슬은 물체 겉에 맺혀요.', '이슬은 물체의 표면에 생겨요.', '이슬이 물체 표면에 맺혀요.', '이슬이 물체에 맺혀요.', '이슬이 물체 겉에 붙어요.', '이슬은 풀잎에 맺혀요.',
      '안개는 땅 가까이에 깔려요.', '안개는 지표 가까이에 있어요.', '안개는 지면 가까이에 생겨요.', '안개가 땅 가까이에 깔려요.', '안개는 낮게 깔려요.', '안개는 공기 중에 떠 있어요.', '안개는 땅 위에 있어요.',
      '구름은 높은 하늘에 있어요.', '구름은 하늘 높이 떠 있어요.', '구름이 높은 하늘에 떠 있어요.', '구름이 하늘 높이 있어요.', '구름은 높은 곳에 있어요.', '구름은 땅에서 멀리 있어요.',
      '아름다운가는 분류 기준이 될 수 없어요.', '아름다운가는 분류 기준이 아니에요.', '아름다운가는 기준이 될 수 없어요.', '아름다운지는 분류 기준이 될 수 없어요.', '아름다운 것은 분류 기준이 될 수 없어요.', '아름다움은 분류 기준이 아니에요.',
      '셋 다 물 방 울 이 에 요!', '이슬은,물체  표면에 생겨요.',
    ];
    for (const t of leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
  });
  it('제한 용어가 들어간 문장은 걸린다', () => {
    for (const w of exp.limits) expect(guardOutput(`이 카드는 ${w}와 관계가 있어요.`, guard).ok, w).toBe(false);
  });
  it('관찰 문장처럼 보이는 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
    for (const t of [
      '풀잎 겉에 작은 물방울이 동그랗게 붙어 있어요.', '강 위 공기가 뿌옇게 흐려 멀리가 잘 보이지 않아요.', '고개를 들어야 보일 만큼 높은 하늘에 있어요.',
      '하늘 높이 떠 있는 하얀 구름은 아직 관찰해 보지 않았어요.', '비행기 창밖으로 보이는 구름을 관찰한 결과를 다시 비교해 볼까요?',
      '이슬, 안개, 구름은 어떤 점이 같고 어떤 점이 다를까요?', '아침 풀잎에 맺힌 물방울, 차가운 컵 겉에 맺힌 물방울은 아직 관찰해 보지 않았어요.',
    ]) {
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
  it('새벽 강가를 "붙어 있다"에 넣으면 그 카드만 다시 비교하라고 한다', () => {
    let s = chooseCriterion(createInitialState(), exp, 'surface');
    s = ALL.reduce((cur, c) => observe(cur, exp, c, 'surface'), s);
    s = ALL.reduce((cur, c) => place(cur, exp, c, c === 'riverhaze' ? 'yes' : truth(c, 'surface')), s);
    expect(cardSortFeedback(exp, check(s, exp).checked)).toBe('새벽 강가를 덮은 뿌연 공기는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  });
});
