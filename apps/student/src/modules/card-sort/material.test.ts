import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateCardSortExperiment } from '@sci/cardsort';
import { parseManifest, ManifestError, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import animalJson from '../../../../../content/units/g3-animal/manifest.json';
import plantJson from '../../../../../content/units/g3-plantlife/manifest.json';
import materialJson from '../../../../../content/units/g3-material/manifest.json';
import { UNITS } from '../../units';
import { chooseCriterion, check, createInitialState, observe, place } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { MATERIAL_ICON_KEYS, MATERIAL_RESULT, MaterialIcon } from './MaterialIcons';

const clone = (j: unknown) => JSON.parse(JSON.stringify(j));
const load = (j: unknown) => parseManifest(j).experiments[0] as CardSortExperiment;
const exp = load(materialJson);
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const ALL = exp.cards.map((c) => c.key);
const noop = () => {};

/** 사양 §1 표: 카드 -> [이름, 물질, hard, bends, absorbs]. */
const TABLE: Record<string, [string, string, string, string, string]> = {
  nail: ['쇠못', '금속', 'yes', 'no', 'no'],
  marble: ['유리구슬', '유리', 'yes', 'no', 'no'],
  woodblock: ['나무 블록', '나무', 'yes', 'no', 'yes'],
  ruler: ['플라스틱 자', '플라스틱', 'yes', 'yes', 'no'],
  rubberband: ['고무줄', '고무', 'no', 'yes', 'no'],
  paper: ['종이', '종이', 'no', 'yes', 'yes'],
  handkerchief: ['면 손수건', '섬유', 'no', 'yes', 'yes'],
  foil: ['알루미늄 포일', '금속', 'no', 'yes', 'no'],
};

const OBS: Record<string, [string, string, string]> = {
  nail: ['세게 눌러도 모양이 변하지 않아요.', '손으로 구부려도 휘어지지 않아요.', '물방울이 동그랗게 맺혀 있어요.'],
  marble: ['세게 눌러도 모양이 변하지 않아요.', '손으로 구부릴 수 없어요.', '물방울이 또르르 굴러떨어져요.'],
  woodblock: ['세게 눌러도 모양이 변하지 않아요.', '손으로 구부려도 휘어지지 않아요.', '물방울이 천천히 스며들어 그 자리 색이 진해져요.'],
  ruler: ['눌러도 모양이 그대로예요.', '양 끝을 잡고 구부리면 휘었다가 놓으면 돌아와요.', '물방울이 맺혀 있고 스며들지 않아요.'],
  rubberband: ['손가락으로 누르면 쉽게 눌려요.', '쉽게 휘어지고 늘어나요.', '물방울이 맺혀 있고 스며들지 않아요.'],
  paper: ['손으로 누르면 구겨져요.', '쉽게 휘어지고 접혀요.', '물방울이 금방 스며들어 젖어요.'],
  handkerchief: ['손으로 누르면 쉽게 모양이 변해요.', '쉽게 휘어지고 접혀요.', '물방울이 금방 스며들어 넓게 퍼져요.'],
  foil: ['손으로 누르면 쉽게 구겨져요.', '쉽게 휘어지고 구부린 모양 그대로 있어요.', '물방울이 맺혀 있고 스며들지 않아요.'],
};

describe('물체와 물질 매니페스트 (사양 §1, §2)', () => {
  it('단원 정보와 활동 정보', () => {
    const m = parseManifest(materialJson);
    expect([m.id, m.title, m.grade, m.engine, m.standards]).toEqual(['g3-material', '물체와 물질', 3, 'matter', ['4과02-01']]);
    expect(m.experiments).toHaveLength(1);
    expect([exp.id, exp.module, exp.layout]).toEqual(['material-sort', 'card-sort', 'groups']);
    expect(exp.title).toBe('물질의 성질에 따라 물체 분류하기');
    expect(exp.question).toBe('물체를 이루는 물질의 성질에 따라 물체를 어떻게 분류할 수 있을까?');
    expect(exp.limits).toEqual(['밀도', '탄성', '흡수율', '경도', '전성', '연성']);
    expect(exp.safetyChecklist).toEqual([]);
    expect(exp.safetyNotices ?? []).toEqual([]);
  });
  it('특징 3가지와 돋보기 버튼 문구', () => {
    expect(exp.features).toEqual([
      { key: 'hard', label: '단단함', action: '눌러 보기' },
      { key: 'bends', label: '휘어짐', action: '구부려 보기' },
      { key: 'absorbs', label: '물 흡수', action: '물 떨어뜨려 보기' },
    ]);
  });
  it('분류 기준 4가지', () => {
    expect(exp.criteria.map((c) => [c.key, c.label, c.feature, c.objective, c.groups.map((g) => g.label)])).toEqual([
      ['hard', '손으로 눌러도 모양이 그대로인가요?', 'hard', true, ['그대로이다', '모양이 변한다']],
      ['bends', '손으로 구부리면 휘어지나요?', 'bends', true, ['휘어진다', '휘어지지 않는다']],
      ['absorbs', '물을 떨어뜨리면 빨아들이나요?', 'absorbs', true, ['빨아들인다', '빨아들이지 않는다']],
      ['expensive', '값비싸 보이나요?', undefined, false, ['비싸 보인다', '싸 보인다']],
    ]);
  });
  it('카드 8장의 표(이름·물질·특징값)와 관찰 문장이 사양과 같다', () => {
    expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(TABLE));
    for (const c of exp.cards) {
      const [label, sub, hard, bends, absorbs] = TABLE[c.key]!;
      expect([c.label, c.sublabel, c.icon], c.key).toEqual([label, sub, c.key]);
      expect(c.features, c.key).toEqual({ hard, bends, absorbs });
      expect(c.observations, c.key).toEqual({ hard: OBS[c.key]![0], bends: OBS[c.key]![1], absorbs: OBS[c.key]![2] });
    }
  });
  it('플라스틱 자와 알루미늄 포일이 학습 장치로 작동한다', () => {
    const f = (k: string) => exp.cards.find((c) => c.key === k)!.features;
    // 단단한 것과 휘어지는 것이 같은 분류가 아니다.
    expect(exp.cards.filter((c) => c.features.hard === 'yes').map((c) => c.features.bends)).toContain('yes');
    expect(f('ruler')).toMatchObject({ hard: 'yes', bends: 'yes' });
    // 금속인데 단단하지 않은 카드가 있다.
    expect(exp.cards.filter((c) => c.sublabel === '금속').map((c) => c.features.hard).sort()).toEqual(['no', 'yes']);
    // 물질 이름이 같은 카드가 둘 이상 있는 것은 금속뿐이다(마무리 질문의 소재).
    expect(new Set(exp.cards.map((c) => c.sublabel)).size).toBe(7);
  });
  it('validateCardSortExperiment를 통과하고 레지스트리에 등록된다', () => {
    expect(validateCardSortExperiment(exp)).toEqual([]);
    const u = UNITS.find((x) => x.id === 'g3-material')!;
    expect(u.ok && u.activity).toBe('card-sort');
    if (u.ok && u.activity === 'card-sort') {
      expect(u.module.kind).toBe('card-sort');
      expect(u.experiment.layout).toBe('groups');
    }
  });
  it('probe가 모든 상황을 덮고 사양 문장과 같다', () => {
    const byWhen = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
    expect(Object.keys(byWhen).sort()).toEqual(
      ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
    );
    expect(byWhen['finished']).toBe('두 가지 성질로 나누어 보았어요. 같은 물질로 만든 물체인데 다른 무리에 들어간 것이 있나요?');
    expect(byWhen['check-inconsistent']).toBe('{card}을(를) 시험한 결과와 넣은 무리를 다시 비교해 볼까요?');
  });
  it('"물체", "물질", "성질"을 쓰고 제한 용어는 어디에도 쓰지 않는다', () => {
    const text = JSON.stringify({ ...exp, limits: [], tutor: { probes: exp.tutor.probes } });
    for (const w of ['물체', '물질', '성질']) expect(text).toContain(w);
    for (const w of exp.limits) expect(text, w).not.toContain(w);
  });
});

describe('선택 필드 sublabel, action (스키마)', () => {
  it('없어도 통과하고 있으면 읽힌다', () => {
    for (const j of [animalJson, plantJson]) {
      const e = load(j);
      expect(e.cards.every((c) => c.sublabel === undefined)).toBe(true);
      expect(e.features.every((f) => f.action === undefined)).toBe(true);
    }
    expect(exp.cards.every((c) => typeof c.sublabel === 'string')).toBe(true);
  });
  it('빈 문자열이나 문자열이 아닌 값을 거부한다', () => {
    for (const mutate of [
      (m: any) => (m.experiments[0].cards[0].sublabel = ''),
      (m: any) => (m.experiments[0].cards[0].sublabel = 3),
      (m: any) => (m.experiments[0].features[0].action = ''),
      (m: any) => (m.experiments[0].features[0].action = ['눌러 보기']),
    ]) {
      const bad = clone(materialJson);
      mutate(bad);
      expect(() => parseManifest(bad)).toThrow(ManifestError);
    }
  });
  it('필드를 모두 지워도 통과한다', () => {
    const plain = clone(materialJson);
    for (const c of plain.experiments[0].cards) delete c.sublabel;
    for (const f of plain.experiments[0].features) delete f.action;
    expect(() => parseManifest(plain)).not.toThrow();
  });
});

describe('g3-animal과 g3-plantlife는 화면이 그대로다', () => {
  /**
   * 선택 필드를 더하기 전의 코드로 만든 마크업(카드 버튼 둘과 돋보기 둘)의 SHA-256.
   * 두 단원 모두 sublabel과 action이 없으므로 한 글자도 달라지면 안 된다.
   */
  const BASELINE: Record<string, string> = {
    'animal-sort': 'f5bfba53b1a042ede90050bfa5b1bd00f68c97d3338ad7f320d663d69200f4a3',
    'leaf-tree': '79b3f55bf9d44758fd86ec076b74eb05752014a6bf76a9aef93378b88a688867',
  };
  for (const j of [animalJson, plantJson]) {
    const e = load(j);
    it(`${e.id}: 카드 버튼과 돋보기 마크업이 같다`, () => {
      const c = e.cards[0]!;
      const html = renderToStaticMarkup(
        createElement('div', null,
          createElement(Magnifier, { exp: e, sel: null, observed: [], onObserve: noop }),
          createElement(Magnifier, { exp: e, sel: c, observed: [e.features[0]!.key], onObserve: noop }),
          createElement(CardButton, { label: c.label, icon: c.icon, count: 1, total: e.features.length, selected: false, onClick: noop }),
          createElement(CardButton, { label: c.label, icon: c.icon, count: 0, total: e.features.length, selected: true, small: true, onClick: noop }),
        ),
      );
      expect(createHash('sha256').update(html).digest('hex')).toBe(BASELINE[e.id]);
      expect(html).not.toContain('sort-card-sub');
      expect(html).not.toContain('has-sub');
      expect(html).not.toContain('mat-');
      for (const f of e.features) expect(html).toContain(`${f.label} 살펴보기`);
    });
  }
  it('물체와 물질에서는 action 문구와 "이름 · 물질"이 나온다', () => {
    const c = exp.cards.find((x) => x.key === 'foil')!;
    const html = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: [], onObserve: noop }));
    for (const a of ['눌러 보기', '구부려 보기', '물 떨어뜨려 보기']) expect(html).toContain(a);
    expect(html).not.toContain('살펴보기</button>');
    expect(html).toContain('알루미늄 포일 · 금속');
    const btn = renderToStaticMarkup(createElement(CardButton, { label: c.label, sublabel: c.sublabel, icon: c.icon, count: 0, total: 3, selected: false, onClick: noop }));
    expect(btn).toContain('<span class="sort-card-sub">금속</span>');
  });
});

describe('물체 그림', () => {
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(MaterialIcon, { icon, size: 140, shown }));
  it('카드마다 그림이 있고 결과 표가 매니페스트와 같다', () => {
    expect(exp.cards.map((c) => c.icon)).toEqual(['nail', 'marble', 'woodblock', 'ruler', 'rubberband', 'paper', 'handkerchief', 'foil']);
    for (const c of exp.cards) {
      expect(MATERIAL_ICON_KEYS, c.icon).toContain(c.icon);
      const r = MATERIAL_RESULT[c.icon]!;
      expect([r.hard, r.bends, r.absorbs], c.key).toEqual([c.features.hard === 'yes', c.features.bends === 'yes', c.features.absorbs === 'yes']);
    }
  });
  it('관찰 전의 기본 그림에는 결과 그림이 없고 모든 카드가 같은 구조다', () => {
    for (const c of exp.cards) {
      for (const shown of [undefined, []]) {
        const html = svg(c.icon, shown);
        expect(html, c.key).not.toMatch(/mat-(result|press|bend|bead|stain)|clip|rotate|scale/);
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toContain('<text');
      }
    }
  });
  it('시험한 특징의 결과 그림만 나타난다', () => {
    for (const c of exp.cards) {
      const r = MATERIAL_RESULT[c.icon]!;
      expect(svg(c.icon, ['bends'])).toContain('mat-bend');
      expect(svg(c.icon, ['bends'])).not.toMatch(/mat-(press|bead|stain)/);
      expect(svg(c.icon, ['hard'])).toContain('mat-press');
      expect(svg(c.icon, ['hard'])).not.toMatch(/mat-(bend|bead|stain)/);
      expect(svg(c.icon, ['absorbs'])).toContain(r.absorbs ? 'mat-stain' : 'mat-bead');
      expect(svg(c.icon, ['absorbs'])).not.toMatch(/mat-(press|bend)/);
      expect(svg(c.icon, ['hard']).includes('scale'), `${c.key} 납작해짐`).toBe(!r.hard);
      expect(svg(c.icon, ['bends']).includes('rotate'), `${c.key} 휘어짐`).toBe(r.bends);
      expect(svg(c.icon, ['hard', 'bends', 'absorbs'])).toContain('mat-');
    }
  });
  it('돋보기에는 이 카드에서 시험한 특징의 결과만 그려진다', () => {
    const c = exp.cards.find((x) => x.key === 'woodblock')!;
    const before = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: [], onObserve: noop }));
    expect(before).not.toContain('mat-');
    const after = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: ['absorbs'], onObserve: noop }));
    expect(after).toContain('mat-stain');
    expect(after).not.toContain('mat-press');
    // 카드 버튼(작은 그림)에는 결과가 겹쳐지지 않는다.
    const btn = renderToStaticMarkup(createElement(CardButton, { label: c.label, sublabel: c.sublabel, icon: c.icon, count: 3, total: 3, selected: false, onClick: noop }));
    expect(btn).not.toContain('mat-');
  });
});

describe('튜터 전수 가드 (사양 §2)', () => {
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
  it('카드 이름 대신 물질 이름이나 "이름 · 물질"이 들어가도 걸리지 않는다', () => {
    for (const probe of exp.tutor.probes) {
      for (const card of exp.cards) {
        for (const name of [card.sublabel!, `${card.label} · ${card.sublabel}`, exp.cards.map((c) => c.label).join(', ')]) {
          const out = renderAndGuard(probe.when, { card: name, criterion: exp.criteria[0]!.label }, exp.tutor.probes, guard);
          expect(out, `${probe.when}/${name}`).not.toBe(FALLBACK_PROBE);
        }
      }
    }
  });
  it('"같은 물질로 만든 물체인데"가 금지 구절에 걸리지 않는다', () => {
    const text = '두 가지 성질로 나누어 보았어요. 같은 물질로 만든 물체인데 다른 무리에 들어간 것이 있나요?';
    expect(guardOutput(text, guard)).toEqual({ ok: true, hits: [] });
    expect(renderAndGuard('finished', { card: '쇠못', criterion: '손으로 구부리면 휘어지나요?' }, exp.tutor.probes, guard)).toBe(text);
  });
  it('사양의 금지 구절 6개가 모두 들어 있고 실제로 가드에 걸린다', () => {
    for (const phrase of ['금속은 단단', '플라스틱 자는 단단하면서 휘어', '알루미늄 포일은 단단하지 않', '종이와 손수건은 물을 빨아들', '나무 블록은 물을 빨아들', '값비싸 보이는가는 분류 기준이 될 수 없']) {
      expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
    }
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
    const leaks = [
      '금속은 단단해요.', '금속은 단단하지.', '금속은 단단한 물질이에요.', '금속은 모두 단단해요.', '금속은 다 단단하답니다.', '금속이 단단하니까요.', '금속은 딱딱해요.',
      '플라스틱 자는 단단하면서 휘어져요.', '플라스틱 자는 단단하면서도 휘어집니다.', '플라스틱 자는 단단하고 휘어지죠.', '플라스틱 자는 단단하지만 휘어져요.', '플라스틱 자는 휘어지면서 단단해요.', '플라스틱 자는 휘어지고 단단해요.',
      '알루미늄 포일은 단단하지 않아요.', '알루미늄 포일은 단단하지 않죠.', '알루미늄 포일은 딱딱하지 않아요.', '알루미늄 포일은 무르죠.', '알루미늄 포일은 단단해요.',
      '종이와 손수건은 물을 빨아들여요.', '종이와 손수건은 물을 빨아들이죠.', '종이와 손수건은 물을 흡수해요.', '종이와 손수건은 물에 젖어요.', '종이와 면 손수건은 물을 빨아들여요.', '손수건과 종이는 물을 빨아들여요.',
      '종이는 물을 빨아들여요.', '손수건은 물을 빨아들여요.', '종이는 물을 흡수해요.', '손수건은 물을 흡수해요.',
      '나무 블록은 물을 빨아들여요.', '나무 블록은 물을 빨아들이죠.', '나무 블록은 물을 흡수해요.', '나무 블록이 물을 빨아들여요.', '나무 블록은 물에 스며들어요.', '나무 블록은 물이 스며들어요.', '나무는 물을 빨아들여요.',
      '값비싸 보이는가는 분류 기준이 될 수 없어요.', '값비싸 보이는가는 분류 기준이 아니에요.', '값비싸 보이는가는 기준이 될 수 없어요.', '값비싸 보이는지는 분류 기준이 될 수 없어요.', '값비싸 보이는 것은 분류 기준이 될 수 없어요.',
      '금속 은 단 단 해!', '나무  블록은,물을 빨아들여.',
    ];
    for (const t of leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
  });
  it('관찰 문장처럼 보이는 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
    for (const t of ['쇠못에 물방울이 동그랗게 맺혀 있어요.', '손으로 구부려도 휘어지지 않아요.', '같은 물질로 만든 물체인데 다른 무리에 들어간 것이 있나요?', '알루미늄 포일은 아직 시험해 보지 않았어요.', '나무 블록을 시험한 결과를 다시 비교해 볼까요?']) {
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
  it('알루미늄 포일을 "그대로이다"에 넣으면 포일만 다시 비교하라고 한다', () => {
    let s = chooseCriterion(createInitialState(), exp, 'hard');
    s = ALL.reduce((cur, c) => observe(cur, exp, c, 'hard'), s);
    s = ALL.reduce((cur, c) => place(cur, exp, c, c === 'foil' ? 'yes' : truth(c, 'hard')), s);
    const fb = cardSortFeedback(exp, check(s, exp).checked);
    expect(fb).toBe('알루미늄 포일은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?');
  });
});
