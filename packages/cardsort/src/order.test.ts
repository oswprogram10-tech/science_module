import { describe, expect, it } from 'vitest';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import strataJson from '../../../content/units/g5-strata/manifest.json';
import {
  allSlotsFilled,
  checkFollowUp,
  checkOrder,
  createOrder,
  followUpAllPlaced,
  followUpPlace,
  isOrderComplete,
  isOrderFinished,
  observe,
  orderPile,
  placeInSlot,
  removeFromSlot,
  validateCardSortExperiment,
  type OrderState,
} from './index';

const exp = parseManifest(strataJson).experiments[0] as CardSortExperiment;
const KEYS = exp.cards.map((c) => c.key);
const CORRECT = ['conglomerate', 'sandstone', 'mudstone', 'limestone', 'shale'];
const fresh = () => createOrder(KEYS, exp.initialOrder!);
const obs = (s: OrderState, features: string[], cards: string[] = KEYS) =>
  cards.reduce((cur, c) => features.reduce((x, f) => observe(x, exp, c, f), cur), s);
const fill = (s: OrderState, order: string[]) => order.reduce((cur, c, i) => placeInSlot(cur, c, i), s);
const done = (order = CORRECT) => checkOrder(fill(obs(fresh(), ['height']), order), exp);

describe('지층 카드 표 (사양 §1)', () => {
  const TABLE: Record<string, [string, number, string, string, string]> = {
    conglomerate: ['역암', 0.5, 'gravel', 'none', 'unknown'],
    sandstone: ['사암', 1.5, 'sand', 'clam', 'sea'],
    mudstone: ['이암', 2.5, 'mud', 'fern', 'land'],
    limestone: ['석회암', 3.5, 'fine', 'coral', 'sea'],
    shale: ['셰일', 4.5, 'mud', 'leaf', 'land'],
  };
  it('카드 5장의 이름·특징값이 사양과 같고 표 순서가 정답 순서다', () => {
    expect(KEYS).toEqual(CORRECT);
    for (const c of exp.cards) {
      const [label, height, grain, fossil, env] = TABLE[c.key]!;
      expect([c.label, c.icon], c.key).toEqual([label, c.key]);
      expect(c.features, c.key).toEqual({ height, grain, fossil, env });
    }
  });
  it('관찰 문장이 사양과 같다', () => {
    const OBS: Record<string, [string, string, string]> = {
      conglomerate: ['절벽 바닥에서 0.5 m 높이에서 채집했어요.', '둥근 자갈이 모래와 섞여 굳어 있어요.', '화석이 보이지 않아요.'],
      sandstone: ['절벽 바닥에서 1.5 m 높이에서 채집했어요.', '모래 알갱이가 굳어 있어요.', '조개 껍데기 모양의 화석이 있어요.'],
      mudstone: ['절벽 바닥에서 2.5 m 높이에서 채집했어요.', '아주 고운 진흙이 굳어 있어요.', '고사리 잎 모양의 화석이 있어요.'],
      limestone: ['절벽 바닥에서 3.5 m 높이에서 채집했어요.', '알갱이가 거의 보이지 않을 만큼 고와요.', '산호 모양의 화석이 있어요.'],
      shale: ['절벽 바닥에서 4.5 m 높이에서 채집했어요.', '고운 진흙이 얇은 판처럼 겹쳐 있어요.', '나뭇잎 모양의 화석이 있어요.'],
    };
    for (const c of exp.cards) expect(c.observations, c.key).toEqual({ height: OBS[c.key]![0], grain: OBS[c.key]![1], fossil: OBS[c.key]![2] });
  });
  it('처음 순서는 셰일, 사암, 역암, 석회암, 이암이고 정답과 다르다', () => {
    expect(exp.initialOrder).toEqual(['shale', 'sandstone', 'conglomerate', 'limestone', 'mudstone']);
    expect(exp.initialOrder).not.toEqual(CORRECT);
    expect(orderPile(fresh())).toEqual(exp.initialOrder);
  });
  it('validateCardSortExperiment를 통과한다', () => {
    expect(validateCardSortExperiment(exp)).toEqual([]);
  });
  it('매니페스트의 일관성 오류를 찾는다', () => {
    const clone = (): any => JSON.parse(JSON.stringify(exp));
    const a = clone();
    a.cards[1].features.height = 0.5; // 높이가 겹침
    expect(validateCardSortExperiment(a).join()).toContain('달라야');
    const b = clone();
    b.followUp.evidenceFeature = 'zzz';
    expect(validateCardSortExperiment(b).join()).toContain('zzz');
    const c = clone();
    c.cards[0].features.env = 'sky';
    expect(validateCardSortExperiment(c).join()).toContain('sky');
    const d = clone();
    delete d.cards[2].observations.fossil;
    expect(validateCardSortExperiment(d).join()).toContain('관찰 문장');
    const e = clone();
    e.cards[0].features.mystery = 'x';
    expect(validateCardSortExperiment(e).join()).toContain('mystery');
  });
});

describe('createOrder / placeInSlot / removeFromSlot', () => {
  it('처음에는 칸이 모두 비어 있고 더미가 initialOrder 순서이다', () => {
    const s = fresh();
    expect(s.slots).toEqual([null, null, null, null, null]);
    expect(allSlotsFilled(s)).toBe(false);
    expect(s.checked).toBeNull();
    expect(s.followUp).toEqual({ placement: {}, checked: null });
  });
  it('칸에 놓으면 더미에서 빠지고, 다른 칸으로 옮기면 원래 칸이 빈다', () => {
    let s = placeInSlot(fresh(), 'shale', 2);
    expect(s.slots).toEqual([null, null, 'shale', null, null]);
    expect(orderPile(s)).toEqual(['sandstone', 'conglomerate', 'limestone', 'mudstone']);
    s = placeInSlot(s, 'shale', 0);
    expect(s.slots).toEqual(['shale', null, null, null, null]);
  });
  it('대상 칸에 카드가 있으면 두 카드를 맞바꾼다', () => {
    let s = fill(fresh(), CORRECT);
    s = placeInSlot(s, 'sandstone', 2);
    expect(s.slots).toEqual(['conglomerate', 'mudstone', 'sandstone', 'limestone', 'shale']);
  });
  it('더미의 카드를 찬 칸에 놓으면 있던 카드가 더미로 돌아간다', () => {
    let s = placeInSlot(fresh(), 'shale', 0);
    s = placeInSlot(s, 'sandstone', 0);
    expect(s.slots[0]).toBe('sandstone');
    expect(orderPile(s)).toContain('shale');
  });
  it('모르는 카드·칸이거나 같은 칸이면 같은 상태를 돌려준다', () => {
    const s = placeInSlot(fresh(), 'shale', 0);
    expect(placeInSlot(s, 'shale', 0)).toBe(s);
    expect(placeInSlot(s, 'granite', 1)).toBe(s);
    expect(placeInSlot(s, 'shale', 5)).toBe(s);
    expect(placeInSlot(s, 'shale', -1)).toBe(s);
    expect(placeInSlot(s, 'shale', 1.5)).toBe(s);
  });
  it('빼면 칸이 비고 더미로 돌아가며, 칸에 없으면 그대로이다', () => {
    const s = placeInSlot(fresh(), 'shale', 3);
    const r = removeFromSlot(s, 'shale');
    expect(r.slots).toEqual([null, null, null, null, null]);
    expect(orderPile(r)).toContain('shale');
    expect(removeFromSlot(r, 'shale')).toBe(r);
    expect(removeFromSlot(s, 3).slots[3]).toBeNull();
  });
  it('칸이 바뀌면 순서와 followUp 확인 결과가 비워진다', () => {
    let s = done();
    expect(s.checked?.kind).toBe('check-complete');
    s = placeInSlot(s, 'shale', 0);
    expect(s.checked).toBeNull();
    expect(s.followUp.checked).toBeNull();
  });
});

describe('checkOrder (사양 §2)', () => {
  it('정답 순서이면 complete이다', () => {
    const s = done();
    expect(s.checked).toEqual({ kind: 'check-complete', items: KEYS.map((card) => ({ card, status: 'ok' })) });
    expect(isOrderComplete(s)).toBe(true);
  });
  it('칸이 빈 카드가 있으면 unplaced이다', () => {
    const s = checkOrder(obs(placeInSlot(placeInSlot(fresh(), 'conglomerate', 0), 'sandstone', 1), ['height']), exp);
    expect(s.checked!.kind).toBe('check-unplaced');
    expect(s.checked!.items.filter((i) => i.status === 'unplaced').map((i) => i.card)).toEqual(['mudstone', 'limestone', 'shale']);
  });
  it('사암과 이암을 맞바꾸면 두 카드가 inconsistent이다', () => {
    const swapped = [...CORRECT];
    [swapped[1], swapped[2]] = [swapped[2]!, swapped[1]!];
    const s = done(swapped);
    expect(s.checked!.kind).toBe('check-inconsistent');
    expect(s.checked!.items.filter((i) => i.status === 'inconsistent').map((i) => i.card)).toEqual(['sandstone', 'mudstone']);
    expect(s.checked!.items.filter((i) => i.status === 'ok')).toHaveLength(3);
  });
  it('고치면 complete이다', () => {
    const swapped = [...CORRECT];
    [swapped[1], swapped[2]] = [swapped[2]!, swapped[1]!];
    let s = done(swapped);
    s = checkOrder(placeInSlot(s, 'sandstone', 1), exp);
    expect(s.checked!.kind).toBe('check-complete');
  });
  it('첫 카드와 마지막 카드를 맞바꾸면 어긋난 이웃 쌍의 카드를 모두 고른다', () => {
    const order = ['shale', 'sandstone', 'mudstone', 'limestone', 'conglomerate'];
    const s = done(order);
    expect(s.checked!.kind).toBe('check-inconsistent');
    expect(s.checked!.items.filter((i) => i.status === 'inconsistent').map((i) => i.card)).toEqual(['conglomerate', 'sandstone', 'limestone', 'shale']);
  });
  it('처음 더미 순서 그대로 놓으면 inconsistent이다(정답과 다르다)', () => {
    const s = done([...exp.initialOrder!]);
    expect(s.checked!.kind).toBe('check-inconsistent');
  });
  it('높이를 하나 관찰하지 않으면 unobserved가 우선한다(틀린 순서여도)', () => {
    let s = fill(obs(fresh(), ['height'], ['conglomerate', 'sandstone', 'mudstone', 'limestone']), ['shale', 'sandstone', 'mudstone', 'limestone', 'conglomerate']);
    s = checkOrder(s, exp);
    expect(s.checked!.kind).toBe('check-unobserved');
    expect(s.checked!.items.filter((i) => i.status === 'unobserved').map((i) => i.card)).toEqual(['shale']);
    // 다른 특징을 관찰했더라도 높이가 아니면 소용없다.
    const other = checkOrder(fill(obs(fresh(), ['grain', 'fossil']), CORRECT), exp);
    expect(other.checked!.kind).toBe('check-unobserved');
  });
  it('unplaced가 unobserved보다 먼저이다', () => {
    const s = checkOrder(placeInSlot(fresh(), 'shale', 0), exp);
    expect(s.checked!.kind).toBe('check-unplaced');
  });
  it('내림차순이면 반대 순서가 맞다', () => {
    const rev: CardSortExperiment = { ...exp, orderBy: { feature: 'height', direction: 'descending' } };
    const s = checkOrder(fill(obs(fresh(), ['height']), [...CORRECT].reverse()), rev);
    expect(s.checked!.kind).toBe('check-complete');
    expect(checkOrder(fill(obs(fresh(), ['height']), CORRECT), rev).checked!.kind).toBe('check-inconsistent');
  });
  it('확인 결과에 정답 칸 번호나 높이 값이 들어 있지 않다', () => {
    const s = done([...exp.initialOrder!]);
    expect(Object.keys(s.checked!)).toEqual(['kind', 'items']);
    expect(JSON.stringify(s.checked)).not.toMatch(/\d/);
  });
});

describe('followUp (사양 §2)', () => {
  const group = (card: string) => String(exp.cards.find((c) => c.key === card)!.features.env);
  const placeAll = (s: OrderState, over: Record<string, string> = {}) =>
    KEYS.reduce((cur, c) => followUpPlace(cur, exp, c, over[c] ?? group(c)), s);

  it('순서 complete 전에는 막힌다', () => {
    const s = obs(fresh(), ['height', 'fossil']);
    expect(followUpPlace(s, exp, 'sandstone', 'sea')).toBe(s);
    expect(checkFollowUp(s, exp)).toBe(s);
    const wrong = done([...exp.initialOrder!]);
    expect(followUpPlace(wrong, exp, 'sandstone', 'sea')).toBe(wrong);
    expect(checkFollowUp(wrong, exp)).toBe(wrong);
  });
  it('순서를 맞추면 열린다', () => {
    const s = obs(done(), ['fossil']);
    const p = followUpPlace(s, exp, 'sandstone', 'sea');
    expect(p.followUp.placement).toEqual({ sandstone: 'sea' });
    expect(p.followUp.checked).toBeNull();
  });
  it('모르는 카드·무리는 무시하고 null이면 뺀다', () => {
    const s = obs(done(), ['fossil']);
    expect(followUpPlace(s, exp, 'granite', 'sea')).toBe(s);
    expect(followUpPlace(s, exp, 'sandstone', 'sky')).toBe(s);
    const p = followUpPlace(s, exp, 'sandstone', 'sea');
    expect(followUpPlace(p, exp, 'sandstone', 'sea')).toBe(p);
    expect(followUpPlace(p, exp, 'sandstone', null).followUp.placement.sandstone).toBeNull();
  });
  it('근거 특징은 fossil이다: 화석을 관찰하지 않으면 모두 맞게 넣어도 unobserved이다', () => {
    expect(exp.followUp!.evidenceFeature).toBe('fossil');
    const s = checkFollowUp(placeAll(done()), exp);
    expect(s.followUp.checked!.kind).toBe('check-unobserved');
    expect(s.followUp.checked!.items.every((i) => i.status === 'unobserved')).toBe(true);
    // 환경(env)이 아니라 화석을 관찰해야 한다. 알갱이를 관찰해도 소용없다.
    const grain = checkFollowUp(placeAll(obs(done(), ['grain'])), exp);
    expect(grain.followUp.checked!.kind).toBe('check-unobserved');
    const part = checkFollowUp(placeAll(obs(done(), ['fossil'], ['sandstone', 'mudstone'])), exp);
    expect(part.followUp.checked!.items.filter((i) => i.status === 'unobserved').map((i) => i.card)).toEqual(['conglomerate', 'limestone', 'shale']);
  });
  it('unobserved가 inconsistent보다 우선한다', () => {
    const s = checkFollowUp(placeAll(done(), { sandstone: 'land' }), exp);
    expect(s.followUp.checked!.kind).toBe('check-unobserved');
  });
  it('넣지 않은 카드가 있으면 unplaced이다', () => {
    const s = checkFollowUp(followUpPlace(obs(done(), ['fossil']), exp, 'sandstone', 'sea'), exp);
    expect(s.followUp.checked!.kind).toBe('check-unplaced');
    expect(followUpAllPlaced(s, exp)).toBe(false);
  });
  it('관찰과 다른 무리에 넣으면 그 카드가 inconsistent이다', () => {
    const s = checkFollowUp(placeAll(obs(done(), ['fossil']), { sandstone: 'land', conglomerate: 'sea' }), exp);
    expect(s.followUp.checked!.kind).toBe('check-inconsistent');
    expect(s.followUp.checked!.items.filter((i) => i.status === 'inconsistent').map((i) => i.card)).toEqual(['conglomerate', 'sandstone']);
  });
  it('모두 맞게 넣으면 complete이고 완료이다', () => {
    const base = placeAll(obs(done(), ['fossil']));
    expect(followUpAllPlaced(base, exp)).toBe(true);
    expect(isOrderFinished(base, exp)).toBe(false);
    const s = checkFollowUp(base, exp);
    expect(s.followUp.checked!.kind).toBe('check-complete');
    expect(isOrderFinished(s, exp)).toBe(true);
  });
  it('순서만 맞추면 완료가 아니다. followUp이 없는 활동은 순서만으로 완료이다', () => {
    expect(isOrderFinished(done(), exp)).toBe(false);
    expect(isOrderFinished(fresh(), exp)).toBe(false);
    const { followUp: _omit, ...rest } = exp;
    expect(isOrderFinished(done(), rest as CardSortExperiment)).toBe(true);
  });
  it('순서를 다시 바꾸면 followUp 확인이 사라져 완료가 풀린다', () => {
    let s = checkFollowUp(placeAll(obs(done(), ['fossil'])), exp);
    expect(isOrderFinished(s, exp)).toBe(true);
    s = placeInSlot(s, 'shale', 0);
    expect(isOrderFinished(s, exp)).toBe(false);
  });
});
