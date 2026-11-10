import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import strataJson from '../../../../../content/units/g5-strata/manifest.json';
import { UNITS } from '../../units';
import {
  checkFollowUp,
  checkOrder,
  createInitialOrderState,
  followUpPlace,
  observe,
  orderTutorSituation,
  placeInSlot,
  removeFromSlot,
  select,
  type OrderLabState,
} from './orderStore';
import { followUpFeedback, orderFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { STRATA_ICON_KEYS, StrataIcon } from './StrataIcons';
import { OrderSortLab, ORDER_EARLIEST, ORDER_FINISHED_TEXT, ORDER_LATEST } from './OrderSortLab';

const exp = parseManifest(strataJson).experiments[0] as CardSortExperiment;
const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
const KEYS = exp.cards.map((c) => c.key);
const noop = () => {};
const label = (k: string) => exp.cards.find((c) => c.key === k)!.label;

const NOTICE = '이 절벽의 지층은 쌓인 뒤에 뒤집히지 않았어요.';
const BACKGROUND = '조개·산호는 물속, 특히 바다에서 살아요. 고사리·나뭇잎은 땅에서 자라요.';

/** 모든 카드의 특징을 관찰하고 정답 순서로 놓은 상태. */
function ordered(features: string[] = ['height']): OrderLabState {
  let s = createInitialOrderState(exp);
  for (const c of KEYS) for (const f of features) s = observe(s, exp, c, f);
  KEYS.forEach((c, i) => (s = placeInSlot(s, c, i)));
  return s;
}

describe('지층과 화석 매니페스트 (사양 §1, §4)', () => {
  it('단원 정보와 활동 정보', () => {
    const m = parseManifest(strataJson);
    expect([m.id, m.title, m.grade, m.engine, m.standards]).toEqual(['g5-strata', '지층과 화석', 5, 'earth', ['6과01-01', '6과01-03']]);
    expect([exp.id, exp.module, exp.layout]).toEqual(['strata-order', 'card-sort', 'order']);
    expect(exp.title).toBe('지층이 쌓인 순서와 과거 환경 알아보기');
    expect(exp.question).toBe('지층이 쌓인 순서와 그때의 환경을 어떻게 알 수 있을까?');
    expect(exp.limits).toEqual(['부정합', '지층 대비', '습곡', '단층', '표준 화석', '시상 화석', '누중의 법칙']);
    expect(exp.notice).toBe(NOTICE);
    expect(exp.background).toEqual({ title: '배경 지식', text: BACKGROUND });
  });
  it('특징 3가지와 돋보기 버튼 문구', () => {
    expect(exp.features).toEqual([
      { key: 'height', label: '채집 높이', action: '높이 확인하기' },
      { key: 'grain', label: '알갱이', action: '알갱이 살펴보기' },
      { key: 'fossil', label: '화석', action: '화석 살펴보기' },
    ]);
  });
  it('orderBy, followUp', () => {
    expect(exp.orderBy).toEqual({ feature: 'height', direction: 'ascending' });
    expect(exp.followUp).toEqual({
      key: 'env',
      label: '이 층이 쌓일 때 그곳은 어떤 곳이었을까요?',
      feature: 'env',
      evidenceFeature: 'fossil',
      objective: true,
      groups: [
        { value: 'sea', label: '바다' },
        { value: 'land', label: '육지' },
        { value: 'unknown', label: '화석이 없어 알 수 없음' },
      ],
    });
  });
  it('레지스트리에 order 배치 카드 분류로 등록된다', () => {
    const u = UNITS.find((x) => x.id === 'g5-strata')!;
    expect(u.ok && u.activity).toBe('card-sort');
    if (u.ok && u.activity === 'card-sort') expect(u.experiment.layout).toBe('order');
  });
  it('probe가 사양 문장과 같다', () => {
    const by = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
    expect(by['pick-card']).toBe('어떤 표본부터 살펴볼까요?');
    expect(by['before-observe']).toBe('{card}을(를) 칸에 놓기 전에 채집한 높이를 확인해 볼까요?');
    expect(by['sorting']).toBe('{card}은(는) 어느 칸에 놓을까요? 높이와 쌓이는 차례를 함께 생각해 볼까요?');
    expect(by['order-check-unplaced']).toBe('아직 칸에 놓지 않은 표본이 있어요.');
    expect(by['order-check-unobserved']).toBe('{card}은(는) 아직 채집 높이를 확인하지 않았어요.');
    expect(by['order-check-inconsistent']).toBe('{card}의 채집 높이와 놓은 차례를 다시 비교해 볼까요? 흙이 쌓일 때 어느 쪽부터 쌓일까요?');
    expect(by['order-check-complete']).toBe('높이와 차례가 잘 맞아요. 이번에는 화석을 보고 그때 그곳이 어떤 곳이었을지 생각해 볼까요?');
    expect(by['finished']).toBe('쌓인 차례와 환경을 함께 보면, 이곳의 환경은 시간이 지나며 어떻게 바뀌었을까요?');
    // followUp 단계는 groups when을 쓴다.
    for (const w of ['check-unplaced', 'check-unobserved', 'check-inconsistent']) expect(by[w], w).toBeTruthy();
    expect(by['check-unobserved']).toContain('화석');
    expect(by['check-inconsistent']).toContain('화석');
  });
  it('제한 용어는 어디에도 쓰지 않는다', () => {
    const text = JSON.stringify({ ...exp, limits: [], tutor: { probes: exp.tutor.probes } });
    for (const w of exp.limits) expect(text, w).not.toContain(w);
  });
});

describe('암석 그림: 화석 모양은 관찰 전에 그리지 않는다', () => {
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(StrataIcon, { icon, size: 140, shown }));
  it('카드마다 그림이 있다', () => {
    expect(exp.cards.map((c) => c.icon)).toEqual(['conglomerate', 'sandstone', 'mudstone', 'limestone', 'shale']);
    for (const c of exp.cards) expect(STRATA_ICON_KEYS).toContain(c.icon);
  });
  it('화석을 살펴보기 전에는 화석 모양이 없고 글자도 없다', () => {
    for (const c of exp.cards) {
      for (const shown of [undefined, [], ['height'], ['grain'], ['height', 'grain']]) {
        const html = svg(c.icon, shown);
        expect(html, c.key).not.toContain('fossil');
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toContain('<text');
        expect(html).not.toMatch(/\d\.\d\s*m/);
      }
    }
  });
  it('화석을 살펴보면 화석이 있는 표본에만 화석 모양이 나타난다', () => {
    for (const c of exp.cards) {
      const html = svg(c.icon, ['fossil']);
      expect(html.includes('data-testid="fossil-shape"'), c.key).toBe(c.features.fossil !== 'none');
    }
  });
  it('화석 모양은 표본마다 다르고, 속성에 값이 들어 있지 않다', () => {
    const shapes = exp.cards.filter((c) => c.features.fossil !== 'none').map((c) => svg(c.icon, ['fossil']));
    expect(new Set(shapes).size).toBe(4);
    for (const html of shapes) {
      expect(html).not.toMatch(/(clam|fern|coral|leaf|sea|land|unknown|gravel)/);
      expect(html).not.toMatch(/ data-(?!testid)/);
    }
  });
  it('돋보기는 고른 표본에서 살펴본 특징만 그린다. 카드 버튼에는 화석이 겹치지 않는다', () => {
    const c = exp.cards.find((x) => x.key === 'sandstone')!;
    const before = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: ['height'], onObserve: noop }));
    expect(before).not.toContain('fossil-shape');
    expect(before).toContain(c.observations.height as string);
    expect(before).not.toContain(c.observations.fossil as string);
    expect(before).not.toContain(c.observations.grain as string);
    const after = renderToStaticMarkup(createElement(Magnifier, { exp, sel: c, observed: ['fossil'], onObserve: noop }));
    expect(after).toContain('fossil-shape');
    expect(after).toContain(c.observations.fossil as string);
    const btn = renderToStaticMarkup(createElement(CardButton, { label: c.label, icon: c.icon, count: 3, total: 3, selected: false, onClick: noop }));
    expect(btn).not.toContain('fossil');
  });
});

describe('순서 놓기 화면 마크업 (정답을 드러내지 않는다)', () => {
  const html = renderToStaticMarkup(createElement(OrderSortLab, { unitId: 'g5-strata', title: '지층과 화석', experiment: exp }));
  it('안내 문구와 배경 지식 카드가 처음부터 보인다', () => {
    expect(html).toContain(NOTICE);
    expect(html).toContain(BACKGROUND);
    expect(html).toContain('배경 지식');
  });
  it('"먼저 쌓임"은 맨 아래 칸(1번째), "나중에 쌓임"은 맨 위 칸(5번째)에 붙는다', () => {
    const lis = html.split('<li class="order-slot').slice(1);
    expect(lis).toHaveLength(5);
    expect(lis[0]).toContain(ORDER_EARLIEST);
    expect(lis[4]).toContain(ORDER_LATEST);
    for (const li of lis.slice(1, 4)) expect(li).not.toMatch(/먼저 쌓임|나중에 쌓임/);
    expect(html.split(ORDER_EARLIEST)).toHaveLength(2);
    expect(html.split(ORDER_LATEST)).toHaveLength(2);
  });
  it('칸 버튼 이름이 "{n}번째로 쌓인 층에 놓기"이다', () => {
    for (let n = 1; n <= 5; n++) expect(html).toContain(`${n}번째로 쌓인 층에 놓기`);
  });
  it('더미 순서는 셰일, 사암, 역암, 석회암, 이암이다', () => {
    const names = [...html.matchAll(/sort-card-name">([^<]+)</g)].map((m) => m[1]);
    expect(names).toEqual(['셰일', '사암', '역암', '석회암', '이암']);
  });
  it('관찰 문장, 높이 숫자, 특징값, 화석 모양이 DOM에 없고 data 속성도 없다', () => {
    for (const c of exp.cards) for (const o of Object.values(c.observations)) expect(html).not.toContain(o);
    expect(html).not.toMatch(/\d(\.\d)?\s*m\b/);
    expect(html).not.toContain('fossil');
    expect(html).not.toMatch(/ data-/);
    for (const v of ['gravel', 'clam', 'fern', 'coral', 'unknown']) expect(html).not.toContain(v);
    // 정답 칸 번호를 카드에 붙이지 않는다.
    expect(html).not.toMatch(/data-slot|data-order|data-correct/);
  });
  it('followUp 칸은 순서를 맞추기 전에는 그려지지 않는다', () => {
    expect(html).not.toContain('aria-label="그때의 환경"');
    expect(html).not.toContain(exp.followUp!.label);
    expect(html).not.toContain('환경 확인하기');
    expect(html).toContain('쌓인 차례 확인하기');
    expect(html).not.toContain(ORDER_FINISHED_TEXT);
  });
});

describe('순서 놓기 저장소', () => {
  it('고른 카드는 놓으면 풀리고, 모르는 카드는 무시한다', () => {
    let s = select(createInitialOrderState(exp), exp, 'shale');
    expect(s.selected).toBe('shale');
    expect(select(s, exp, 'granite')).toBe(s);
    s = placeInSlot(s, 'shale', 0);
    expect(s.selected).toBeNull();
    expect(removeFromSlot(s, 'shale').slots[0]).toBeNull();
  });
  it('모든 칸을 채우기 전에는 확인할 수 없다', () => {
    const s = createInitialOrderState(exp);
    expect(checkOrder(s, exp)).toBe(s);
    expect(checkOrder(placeInSlot(s, 'shale', 0), exp).checked).toBeNull();
  });
  it('followUp 확인은 모두 넣어야 하고 순서를 맞춘 뒤에만 열린다', () => {
    const s = ordered(['height', 'fossil']);
    expect(followUpPlace(s, exp, 'sandstone', 'sea')).toBe(s);
    const c = checkOrder(s, exp);
    expect(c.checked!.kind).toBe('check-complete');
    expect(checkFollowUp(c, exp)).toBe(c);
    const p = followUpPlace(c, exp, 'sandstone', 'sea');
    expect(p.selected).toBeNull();
    expect(checkFollowUp(p, exp)).toBe(p);
  });
  it('튜터 상황: 처음 -> 카드 고름 -> 높이 관찰 -> 확인 결과 -> 순서 완료 -> followUp -> 완료', () => {
    let s = createInitialOrderState(exp);
    expect(orderTutorSituation(s, exp).when).toBe('pick-card');
    s = select(s, exp, 'sandstone');
    expect(orderTutorSituation(s, exp)).toMatchObject({ when: 'before-observe', card: '사암' });
    s = observe(s, exp, 'sandstone', 'grain');
    expect(orderTutorSituation(s, exp).when).toBe('before-observe');
    s = observe(s, exp, 'sandstone', 'height');
    expect(orderTutorSituation(s, exp).when).toBe('sorting');
    // 높이를 보지 않고 다섯 칸을 채운 뒤 확인
    let u = createInitialOrderState(exp);
    KEYS.forEach((c, i) => (u = placeInSlot(u, c, i)));
    u = checkOrder(u, exp);
    expect(orderTutorSituation(u, exp)).toMatchObject({ when: 'order-check-unobserved', card: '역암' });
    // 사암·이암을 바꾼 순서
    let v = ordered();
    v = checkOrder(placeInSlot(v, 'sandstone', 2), exp);
    expect(orderTutorSituation(v, exp)).toMatchObject({ when: 'order-check-inconsistent', card: '사암' });
    // 바르게 고치면 followUp으로 넘어가기
    v = checkOrder(placeInSlot(v, 'sandstone', 1), exp);
    expect(orderTutorSituation(v, exp).when).toBe('order-check-complete');
    // followUp
    v = select(v, exp, 'sandstone');
    expect(orderTutorSituation(v, exp).when).toBe('order-check-complete');
    for (const c of KEYS) v = followUpPlace(v, exp, c, String(exp.cards.find((x) => x.key === c)!.features.env));
    v = checkFollowUp(v, exp);
    expect(orderTutorSituation(v, exp)).toMatchObject({ when: 'check-unobserved', card: '역암' });
    for (const c of KEYS) v = observe(v, exp, c, 'fossil');
    v = checkFollowUp(v, exp);
    expect(orderTutorSituation(v, exp).when).toBe('finished');
  });
});

describe('튜터 전수 가드 (사양 §4)', () => {
  const extraNames = () => [
    ...exp.cards.map((c) => c.label),
    exp.cards.map((c) => c.label).join(', '),
    ...exp.cards.flatMap((c) => exp.cards.map((d) => `${c.label}, ${d.label}`)),
  ];
  it('모든 probe × 모든 치환 조합이 가드를 통과하고 폴백이 아니다', () => {
    for (const probe of exp.tutor.probes) {
      for (const name of extraNames()) {
        for (const criterion of ['', exp.followUp!.label, ...exp.followUp!.groups.map((g) => g.label)]) {
          const out = renderAndGuard(probe.when, { card: name, criterion }, exp.tutor.probes, guard);
          const where = `${probe.when}/${name}/${criterion}: ${out}`;
          expect(out, where).not.toBe(FALLBACK_PROBE);
          expect(guardOutput(out, guard).ok, where).toBe(true);
          expect(out, where).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)|\(을\)/);
        }
      }
    }
  });
  it('안내 문구, 배경 지식 카드, 제목, 질문, 단원 이름도 가드를 통과한다', () => {
    for (const t of [exp.notice!, exp.background!.title, exp.background!.text, exp.title, exp.question, exp.followUp!.label, ...exp.followUp!.groups.map((g) => g.label), ...exp.features.flatMap((f) => [f.label, f.action ?? ''])]) {
      expect(guardOutput(t, guard), t).toEqual({ ok: true, hits: [] });
    }
    for (const c of exp.cards) for (const o of Object.values(c.observations)) expect(guardOutput(o, guard).ok, o).toBe(true);
  });
  it('사양의 금지 구절 7개가 모두 들어 있고 실제로 가드에 걸린다', () => {
    for (const phrase of ['아래에 있는 층이 먼저 쌓', '역암이 가장 먼저', '셰일이 가장 나중', '사암은 바다', '이암은 육지', '석회암은 바다', '조개 화석이 있으니 바다']) {
      expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
    }
    for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
  });
  it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
    const leaks = [
      '아래층이 먼저 쌓였어요.', '아래 층이 먼저 쌓여요.', '아래에 있는 층이 먼저 쌓였지요.', '아래에 있을수록 먼저 쌓여요.', '아래쪽 층이 먼저 쌓였어요.', '아래층부터 쌓였어요.', '밑에 있는 층이 먼저 쌓였어요.',
      '위에 있는 층이 나중에 쌓였어요.', '위층이 나중에 쌓여요.',
      '역암이 제일 먼저 쌓였어요.', '역암이 가장 먼저 쌓였어요.', '역암이 맨 먼저예요.', '역암이 첫 번째예요.', '역암이 가장 아래예요.', '역암부터 쌓였어요.',
      '셰일이 제일 나중이에요.', '셰일이 가장 나중에 쌓였어요.', '셰일이 맨 나중이에요.', '셰일이 마지막이에요.', '셰일이 가장 위에 있어요.',
      '사암은 바다에서 쌓였어요.', '사암은 바다예요.', '사암이 바다였어요.', '이암은 육지에서 쌓였어요.', '이암은 육지예요.', '이암이 육지였어요.',
      '석회암은 바다에서 쌓였어요.', '석회암은 바다예요.', '석회암은 바닷속에서 만들어졌어요.',
      '바다에서 쌓였어요.', '여기는 바다에서 쌓였을 거예요.', '육지에서 쌓였어요.',
      '조개 화석이 있으니 바다예요.', '조개 화석이 있으니까 바다예요.', '조개 화석이 있으면 바다예요.', '조개 화석이 있어서 바다예요.', '조개 화석은 바다를 뜻해요.',
      '산호 화석이 있으니까 바다예요.', '산호 화석이 있으면 바다예요.', '고사리 화석이 있으니 육지예요.', '고사리 화석이 있으니까 육지예요.', '나뭇잎 화석이 있으니까 육지예요.', '나뭇잎 화석이 있으면 육지예요.',
      '역암은 화석이 없어서 알 수 없어요.', '바다에서 육지로 바뀌었어요.',
      '아래에 있는   층이 먼저,쌓!', '조개 화석이 있으니까, 바다!',
    ];
    for (const t of leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
  });
  it('관찰 문장이나 배경 지식 같은 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
    for (const t of [
      '조개 껍데기 모양의 화석이 있어요.', '절벽 바닥에서 1.5 m 높이에서 채집했어요.', '화석이 보이지 않아요.',
      '사암의 화석을 살펴봤어요.', '사암은 알갱이가 모래 크기예요.', '셰일은 얇은 판처럼 겹쳐 있어요.', '역암에는 둥근 자갈이 있어요.',
      '흙이 쌓일 때 어느 쪽부터 쌓일까요?', '이 층이 쌓일 때 그곳은 어떤 곳이었을까요?',
    ]) {
      expect(guardOutput(t, guard).ok, t).toBe(true);
    }
  });
});

describe('피드백 전수 가드', () => {
  const statuses = ['unplaced', 'unobserved', 'inconsistent'] as const;
  const sets = [...KEYS.map((c) => [c]), KEYS];
  it('모든 순서 확인 결과의 피드백이 가드를 통과한다', () => {
    const checks = [
      null,
      ...statuses.flatMap((status) =>
        sets.map((set) => ({
          kind: (status === 'unplaced' ? 'check-unplaced' : status === 'unobserved' ? 'check-unobserved' : 'check-inconsistent') as 'check-unplaced',
          items: set.map((card) => ({ card, status })),
        })),
      ),
      { kind: 'check-complete' as const, items: KEYS.map((card) => ({ card, status: 'ok' as const })) },
    ];
    for (const c of checks) {
      for (const text of [orderFeedback(exp, c), followUpFeedback(exp, c)]) {
        expect(guardOutput(text, guard).ok, text).toBe(true);
        expect(text).not.toMatch(/[{}]|\(를\)|\(는\)|\(가\)/);
      }
    }
  });
  it('사암과 이암을 바꿔 놓으면 두 카드 이름이 피드백에 있고 튜터는 한 카드만 말한다', () => {
    let s = ordered();
    s = checkOrder(placeInSlot(s, 'sandstone', 2), exp);
    expect(orderFeedback(exp, s.checked)).toBe('사암, 이암은 이웃한 칸의 표본과 채집한 높이를 견주어 보면 차례가 맞지 않아요.');
    const tutor = renderAndGuard('order-check-inconsistent', { card: orderTutorSituation(s, exp).card, criterion: '' }, exp.tutor.probes, guard);
    expect(tutor).toBe('사암의 채집 높이와 놓은 차례를 다시 비교해 볼까요? 흙이 쌓일 때 어느 쪽부터 쌓일까요?');
  });
  it('피드백은 튜터 문장과 같은 문장이 아니다(화면에서 같은 글이 두 번 보이지 않는다)', () => {
    const tutorTexts = new Set(exp.tutor.probes.map((p) => p.text));
    for (const status of statuses) {
      for (const set of sets) {
        const kind = status === 'unplaced' ? 'check-unplaced' : status === 'unobserved' ? 'check-unobserved' : 'check-inconsistent';
        const c = { kind, items: set.map((card) => ({ card, status })) } as never;
        for (const text of [orderFeedback(exp, c), followUpFeedback(exp, c)]) {
          for (const t of tutorTexts) expect(t.includes(text) || text.includes(t), `${text} / ${t}`).toBe(false);
        }
      }
    }
  });
  it('이름 조사(은/는)가 맞다', () => {
    const c = { kind: 'check-unobserved' as const, items: [{ card: 'mudstone', status: 'unobserved' as const }] };
    expect(label('mudstone')).toBe('이암');
    expect(followUpFeedback(exp, c)).toBe('이암은 화석을 아직 살펴보지 않았어요.');
  });
});
