import { describe, expect, it } from 'vitest';
import { PROBE_KEY_PATTERN } from '@sci/classroom';
import { activityTitle, unitTitle } from './units';
import { TUTOR_CATALOG } from './tutorManifests';
import { addCandidates } from './tutorCatalog';
import { draftToEdits, hasInvalid, lineCheck, validateEdits, type Draft } from './tutorDraft';

// 활동이 넷인 힘과 우리 생활(g3-force)과 활동이 둘인 여러 가지 기체(g4-gases)가 교사 앱의 이름 표시와 튜터 질문 고치기에 맞게 나타나는지 본다.
const unit = (id: string) => TUTOR_CATALOG.find((u) => u.id === id)!;
const FORCE = ['lever-balance', 'lever-lift', 'push-pull', 'spring-scale'];
const FORCE_TITLES = ['막대의 수평 잡기', '지레와 빗면으로 들어 올리기', '밀고 당기면 생기는 변화', '용수철저울로 무게 비교하기'];

describe('교사 앱: 활동이 넷인 단원', () => {
  it('모둠 카드의 활동 이름: 활동 네 개가 모두 나오고, 모르는 id나 없는 id는 첫 활동 이름이다', () => {
    expect(unitTitle('g3-force')).toBe('힘과 우리 생활');
    FORCE.forEach((id, i) => expect(activityTitle('g3-force', id), id).toBe(FORCE_TITLES[i]));
    expect(activityTitle('g3-force', undefined)).toBe(FORCE_TITLES[0]);
    expect(activityTitle('g3-force', 'nope')).toBe(FORCE_TITLES[0]);
    // 활동이 둘인 여러 가지 기체도 이제 활동 이름이 나온다. 활동이 하나인 단원은 나오지 않는다.
    expect(activityTitle('g4-gases', 'syringe-volume')).toBe('주사기 속 기체의 부피 변화 알아보기');
    expect(activityTitle('g4-gases', 'gas-weight')).toBe('공기를 넣은 페트병의 무게');
    expect(activityTitle('g6-electricity', 'electromagnet')).toBeNull();
  });

  it('튜터 질문 고치기 카탈로그: g3-force 활동 4개가 순서대로 있고 활동마다 기본 질문과 변인이 있다', () => {
    const f = unit('g3-force');
    expect(f.experiments.map((e) => [e.id, e.title, e.kind])).toEqual(FORCE.map((id, i) => [id, FORCE_TITLES[i], 'variable']));
    expect(f.experiments.map((e) => e.ivs.map((v) => v.key))).toEqual([
      ['count', 'distance', 'shape'],
      ['tool', 'armCm', 'color'],
      ['object', 'action', 'strength', 'color'],
      ['weights', 'object', 'springColor'],
    ]);
    for (const e of f.experiments) {
      // 기본 질문: 상황 7가지 + 변인마다 fair-test 하나
      expect(new Set(e.probes.map((p) => p.when))).toEqual(new Set(['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch']));
      expect(e.probes.filter((p) => p.when === 'fair-test' && p.iv).map((p) => p.iv)).toEqual(e.ivs.map((v) => v.key).sort((a, b) => (e.probes.findIndex((p) => p.iv === a) - e.probes.findIndex((p) => p.iv === b))));
      expect(e.probes.every((p) => p.text.trim().endsWith('?'))).toBe(true);
      expect(e.placeholders.sort()).toEqual(['changed', 'iv']);
    }
    const g = unit('g4-gases');
    expect(g.experiments.map((e) => [e.id, e.kind])).toEqual([['syringe-volume', 'variable'], ['gas-weight', 'variable']]);
  });

  it('활동마다 자기 금지 구절과 제한 용어로 검사한다(다른 활동 것을 섞지 않는다)', () => {
    const [balance, lift, push, spring] = unit('g3-force').experiments;
    const gas = unit('g4-gases').experiments[1]!;
    // 밀고 당기기: 제한 용어 "관성"과 금지 구절 "세게 밀수록 멀리"에 걸리고, 다른 활동에서는 걸리지 않는다.
    expect(lineCheck(push!, '|before-run|', { text: '관성을 생각하며 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(push!, '|before-run|', { text: '세게 밀수록 멀리 가는지 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(balance!, '|before-run|', { text: '세게 밀수록 멀리 가는지 예측해 볼까요?' })?.ok).toBe(true);
    // 용수철저울: "훅의 법칙"과 "가위가 풀보다 무거"에 걸린다.
    expect(lineCheck(spring!, '|before-run|', { text: '훅의 법칙으로 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(spring!, '|before-run|', { text: '가위가 풀보다 무거운지 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(lift!, '|before-run|', { text: '가위가 풀보다 무거운지 예측해 볼까요?' })?.ok).toBe(true);
    // 공기를 넣은 페트병: "압력"과 "공기도 무게가"에 걸린다.
    expect(lineCheck(gas, '|before-run|', { text: '압력을 생각하며 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(gas, '|before-run|', { text: '공기도 무게가 있는지 예측해 볼까요?' })?.ok).toBe(false);
    // 질문형이고 금지 구절이 없는 질문은 통과한다.
    expect(lineCheck(push!, '|before-run|', { text: '〔바꾼 조건〕을(를) 바꾸면 물체가 움직인 거리가 달라질지 적어 볼까요?' })).toEqual({ ok: true, messages: [] });
    expect(lineCheck(gas, '|before-run|', { text: '〔바꾼 조건〕을(를) 바꾸면 저울 숫자가 달라질지 적어 볼까요?' })).toEqual({ ok: true, messages: [] });
  });

  it('네 활동을 한꺼번에 고쳐도 덧씌우기가 만들어지고 스키마를 통과하며, 질문 더하기 후보 키 형식도 맞는다', () => {
    const draft: Draft = {
      'g3-force': Object.fromEntries(
        FORCE.map((id) => [id, { changed: { '|first-trial|': { text: '이번 결과를 기준으로 삼고 다음에는 무엇만 바꿔 볼까요?' }, '|repeat|': { off: true } }, added: [{ when: 'fair-test', iv: unit('g3-force').experiments.find((e) => e.id === id)!.ivs[0]!.key, text: '〔바꾼 조건〕만 바꿨을 때 무엇이 달라졌나요?' }] }]),
      ),
    };
    expect(hasInvalid(draft, TUTOR_CATALOG)).toBe(false);
    const edits = draftToEdits(draft, TUTOR_CATALOG);
    expect(Object.keys(edits.units['g3-force']!)).toEqual(FORCE);
    expect(validateEdits(edits)).toEqual({ ok: true });
    for (const e of unit('g3-force').experiments) for (const x of addCandidates(e, ['before-run', 'fair-test', 'repeat'], [])) expect(PROBE_KEY_PATTERN.test(x.key), `${e.id}: ${x.key}`).toBe(true);
  });
});
