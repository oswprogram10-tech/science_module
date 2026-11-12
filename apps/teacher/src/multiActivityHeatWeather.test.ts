import { describe, expect, it } from 'vitest';
import { PROBE_KEY_PATTERN } from '@sci/classroom';
import { activityTitle, unitTitle } from './units';
import { TUTOR_CATALOG } from './tutorManifests';
import { addCandidates } from './tutorCatalog';
import { draftToEdits, hasInvalid, lineCheck, validateEdits, type Draft } from './tutorDraft';

// 활동이 넷인 열과 우리 생활(g5-heat)과 활동이 셋인 날씨와 우리 생활(g5-weather)이 교사 앱의 이름 표시와 튜터 질문 고치기에 맞게 나타나는지 본다.
const unit = (id: string) => TUTOR_CATALOG.find((u) => u.id === id)!;
const HEAT = ['insulated-cup', 'heat-contact', 'thermometer', 'heat-transfer'];
const HEAT_TITLES = ['물이 덜 식는 보온 컵 만들기', '온도가 다른 두 물이 닿으면', '온도계로 온도 재기', '열이 이동하는 모습 관찰하기'];
const WEATHER = ['land-sea-breeze', 'dew-fog-cloud', 'humidity'];

describe('교사 앱: 열과 우리 생활(활동 넷), 날씨와 우리 생활(활동 셋)', () => {
  it('모둠 카드의 활동 이름: 새 활동의 이름이 나오고, 모르는 id나 없는 id는 첫 활동 이름이다', () => {
    expect(unitTitle('g5-heat')).toBe('열과 우리 생활');
    expect(unitTitle('g5-weather')).toBe('날씨와 우리 생활');
    expect(activityTitle('g5-heat', 'thermometer')).toBe('온도계로 온도 재기');
    expect(activityTitle('g5-heat', 'heat-transfer')).toBe('열이 이동하는 모습 관찰하기');
    expect(activityTitle('g5-heat', 'heat-contact')).toBe('온도가 다른 두 물이 닿으면');
    expect(activityTitle('g5-weather', 'humidity')).toBe('건습구 습도계로 습도 구하기');
    expect(activityTitle('g5-heat', 'nope')).toBe(activityTitle('g5-heat', HEAT[0]));
    expect(activityTitle('g5-weather', undefined)).toBe(activityTitle('g5-weather', WEATHER[0]));
  });

  it('튜터 질문 고치기 카탈로그: g5-heat 활동 4개와 g5-weather 활동 3개가 순서대로 있고 새 활동마다 기본 질문과 변인이 있다', () => {
    const h = unit('g5-heat');
    expect(h.experiments.map((e) => [e.id, e.kind])).toEqual(HEAT.map((id) => [id, 'variable']));
    expect(h.experiments.map((e) => e.title)).toEqual([HEAT_TITLES[0], HEAT_TITLES[1], HEAT_TITLES[2], HEAT_TITLES[3]]);
    expect(h.experiments[2]!.ivs.map((v) => v.key)).toEqual(['hand', 'target', 'tool', 'eye']);
    expect(h.experiments[3]!.ivs.map((v) => v.key)).toEqual(['material', 'heatAt', 'stickerColor']);
    const w = unit('g5-weather');
    expect(w.experiments.map((e) => [e.id, e.kind])).toEqual([['land-sea-breeze', 'variable'], ['dew-fog-cloud', 'groups'], ['humidity', 'variable']]);
    expect(w.experiments[2]!.ivs.map((v) => v.key)).toEqual(['dry', 'diff', 'place']);
    for (const e of [h.experiments[2]!, h.experiments[3]!, w.experiments[2]!]) {
      expect(new Set(e.probes.map((p) => p.when))).toEqual(new Set(['before-run', 'first-trial', 'confounded', 'iv-unchanged', 'repeat', 'fair-test', 'prediction-mismatch']));
      expect(e.probes.filter((p) => p.when === 'fair-test' && p.iv).map((p) => p.iv).sort()).toEqual(e.ivs.map((v) => v.key).sort());
      expect(e.probes.every((p) => p.text.trim().endsWith('?'))).toBe(true);
      expect(e.placeholders.sort()).toEqual(['changed', 'iv']);
    }
  });

  it('활동마다 자기 금지 구절과 제한 용어로 검사한다(다른 활동 것을 섞지 않는다)', () => {
    const [cup, contact, thermo, transfer] = unit('g5-heat').experiments;
    const humidity = unit('g5-weather').experiments[2]!;
    // 열이 이동하는 모습: "전도"·"대류"(금지 구절이자 제한 용어)와 "구리가 더 빨리"에 걸리고, 다른 활동에서는 같은 문장이 그대로 쓰인다.
    expect(lineCheck(transfer!, '|before-run|', { text: '전도가 무엇인지 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(transfer!, '|before-run|', { text: '대류를 떠올리며 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(transfer!, '|before-run|', { text: '구리가 더 빨리 전해질지 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(cup!, '|before-run|', { text: '구리가 더 빨리 전해질지 예측해 볼까요?' })?.ok).toBe(true);
    // 온도계로 온도 재기: "눈높이를 맞춰야"와 제한 용어 "열평형"에 걸린다.
    expect(lineCheck(thermo!, '|before-run|', { text: '눈높이를 맞춰야 하는지 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(thermo!, '|before-run|', { text: '열평형을 떠올리며 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(contact!, '|before-run|', { text: '눈높이를 맞춰야 하는지 예측해 볼까요?' })?.ok).toBe(true);
    // 건습구 습도계: "벽 색은 관계없"과 제한 용어 "이슬점"에 걸린다.
    expect(lineCheck(humidity, '|before-run|', { text: '벽 색은 관계없다고 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(humidity, '|before-run|', { text: '이슬점을 떠올리며 예측해 볼까요?' })?.ok).toBe(false);
    expect(lineCheck(humidity, '|before-run|', { text: '〔바꾼 조건〕을(를) 바꾸면 습도가 달라질지 적어 볼까요?' })).toEqual({ ok: true, messages: [] });
    expect(lineCheck(transfer!, '|before-run|', { text: '〔바꾼 조건〕을(를) 바꾸면 걸리는 시간이 달라질지 적어 볼까요?' })).toEqual({ ok: true, messages: [] });
  });

  it('새 활동들을 한꺼번에 고쳐도 덧씌우기가 만들어지고 스키마를 통과하며, 질문 더하기 후보 키 형식도 맞는다', () => {
    const draft: Draft = {
      'g5-heat': Object.fromEntries(
        HEAT.map((id) => [id, { changed: { '|first-trial|': { text: '이번 결과를 기준으로 삼고 다음에는 무엇만 바꿔 볼까요?' }, '|repeat|': { off: true } }, added: [{ when: 'fair-test', iv: unit('g5-heat').experiments.find((e) => e.id === id)!.ivs[0]!.key, text: '〔바꾼 조건〕만 바꿨을 때 무엇이 달라졌나요?' }] }]),
      ),
      'g5-weather': {
        humidity: { changed: { '|first-trial|': { text: '이번 결과를 기준으로 삼고 다음에는 무엇만 바꿔 볼까요?' } }, added: [] },
      },
    };
    expect(hasInvalid(draft, TUTOR_CATALOG)).toBe(false);
    const edits = draftToEdits(draft, TUTOR_CATALOG);
    expect(Object.keys(edits.units['g5-heat']!)).toEqual(HEAT);
    expect(Object.keys(edits.units['g5-weather']!)).toEqual(['humidity']);
    expect(validateEdits(edits)).toEqual({ ok: true });
    for (const id of ['g5-heat', 'g5-weather']) for (const e of unit(id).experiments) for (const x of addCandidates(e, ['before-run', 'fair-test', 'repeat'], [])) expect(PROBE_KEY_PATTERN.test(x.key), `${e.id}: ${x.key}`).toBe(true);
  });
});
