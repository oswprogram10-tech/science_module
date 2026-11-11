import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateCardSortExperiment } from '@sci/cardsort';
import { parseManifest, type CardSortExperiment } from '@sci/schema';
import { FALLBACK_PROBE, guardOutput, renderAndGuard } from '@sci/tutor';
import { UNITS } from '../../units';
import { chooseCriterion, check, createInitialState, observe, place } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier } from './SortParts';
import { ANIMAL_ICON_KEYS } from './AnimalIcons';
import { ECO_ICON_KEYS } from './EcoIcons';
import { GRAIN_ICON_KEYS } from './GrainIcons';
import { HABITAT_ICON_KEYS } from './HabitatIcons';
import { LEAF_ICON_KEYS } from './LeafIcons';
import { MATERIAL_ICON_KEYS } from './MaterialIcons';
import { MATTER_ICON_KEYS } from './MatterShapeIcons';
import { MIXTURE_ICON_KEYS } from './MixtureIcons';
import { PLANT_HABITAT_ICON_KEYS } from './PlantHabitatIcons';
import { PROPERTY_ICON_KEYS } from './PropertyChangeIcons';
import { STRATA_ICON_KEYS } from './StrataIcons';
import { VOLCANO_ICON_KEYS } from './VolcanoIcons';
import { WATER_AROUND_ICON_KEYS } from './WaterAroundIcons';
import { WEATHER_ICON_KEYS } from './WeatherIcons';

/** 사양 docs/specs/card-sort-batch-c.md의 카드 분류 활동 네 개가 함께 쓰는 시험 묶음. 활동마다 표(이름·그림·특징값)와 문장, 그림 표시를 넘긴다. */
export interface BatchCCfg {
  /** 단원 매니페스트 원문. */
  json: unknown;
  unit: { id: string; title: string; grade: number; engine: string; standards: string[] };
  /** 단원의 활동 id 순서(새 활동이 마지막). */
  expIds: string[];
  exp: { id: string; title: string; question: string; limits: string[] };
  /** 특징 [key, 머리말, 돋보기 버튼 문구]. */
  features: Array<[string, string, string]>;
  /** 분류 기준 [key, 질문, 특징 key(주관이면 undefined), objective, [무리 value, 무리 이름][]]. */
  criteria: Array<[string, string, string | undefined, boolean, Array<[string, string]>]>;
  /** 카드 key -> [이름, 그림 key, ...특징값(features 순서)]. */
  table: Record<string, string[]>;
  /** 카드 key -> 관찰 문장(features 순서). */
  obs: Record<string, string[]>;
  /** 관찰 문장·카드 이름·화면 문구에 들어가면 안 되는 말(정답 무리 이름·설명 말). */
  notInObservation: string[];
  finished: string;
  /** 사양의 금지 구절(그대로 들어 있어야 한다). */
  requiredForbidden: string[];
  /** 활용형·띄어쓰기를 바꾼 정답 누설 문장(모두 걸려야 한다). */
  leaks: string[];
  /** 사실 진술이라 걸리면 안 되는 문장. */
  innocents: string[];
  /** 틀리게 넣어 볼 카드와 그 기준. */
  wrong: { card: string; criterion: string; group: string; sentence: string };
  /** 그림 모듈. */
  icon: {
    keys: string[];
    result: Record<string, Record<string, unknown>>;
    Component: ComponentType<{ icon: string; size?: number; shown?: string[] }>;
    /** 특징 key -> [결과 그림 class, data 속성, 카드의 그림 key -> 속성 값]. */
    marks: Record<string, [string, string, (icon: string) => string]>;
  };
}

const noop = () => {};
const ALL_ICON_KEY_SETS = () => [
  MATERIAL_ICON_KEYS, ANIMAL_ICON_KEYS, LEAF_ICON_KEYS, STRATA_ICON_KEYS, MIXTURE_ICON_KEYS, WEATHER_ICON_KEYS,
  HABITAT_ICON_KEYS, PLANT_HABITAT_ICON_KEYS, ECO_ICON_KEYS, GRAIN_ICON_KEYS,
  MATTER_ICON_KEYS, WATER_AROUND_ICON_KEYS, VOLCANO_ICON_KEYS, PROPERTY_ICON_KEYS,
];

export function defineBatchCSuite(cfg: BatchCCfg) {
  const manifest = parseManifest(cfg.json);
  const exp = manifest.experiments[manifest.experiments.length - 1] as CardSortExperiment;
  const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
  const ALL = exp.cards.map((c) => c.key);
  const FEATURES = cfg.features.map((f) => f[0]);
  const screenText = () => JSON.stringify({ ...exp, limits: [], tutor: { probes: exp.tutor.probes } });
  const { Component: Icon, marks: MARKS } = cfg.icon;
  const markClasses = Object.values(MARKS).map(([cls]) => cls);
  const svg = (icon: string, shown?: string[]) => renderToStaticMarkup(createElement(Icon, { icon, size: 140, shown }));

  describe(`${cfg.exp.title} 활동 매니페스트 (사양 §0, ${cfg.exp.id})`, () => {
    it('기존 활동은 그대로이고 새 활동이 맨 뒤에 붙는다', () => {
      expect(manifest.experiments.map((e) => e.id)).toEqual(cfg.expIds);
      expect([manifest.id, manifest.title, manifest.grade, manifest.engine, manifest.standards]).toEqual([cfg.unit.id, cfg.unit.title, cfg.unit.grade, cfg.unit.engine, cfg.unit.standards]);
    });
    it('활동 정보', () => {
      expect([exp.id, exp.module, exp.layout]).toEqual([cfg.exp.id, 'card-sort', 'groups']);
      expect(exp.title).toBe(cfg.exp.title);
      expect(exp.question).toBe(cfg.exp.question);
      expect(exp.limits).toEqual(cfg.exp.limits);
      expect(exp.safetyChecklist).toEqual([]);
      expect(exp.safetyNotices ?? []).toEqual([]);
    });
    it('특징과 돋보기 버튼 문구', () => {
      expect(exp.features.map((f) => [f.key, f.label, f.action])).toEqual(cfg.features);
    });
    it('분류 기준과 무리 이름(마지막이 주관 기준이고 특징이 없다)', () => {
      expect(exp.criteria.map((c) => [c.key, c.label, c.feature, c.objective, c.groups.map((g) => [g.value, g.label])])).toEqual(cfg.criteria);
      expect(exp.criteria.filter((c) => c.objective)).toHaveLength(cfg.features.length);
    });
    it(`카드 ${Object.keys(cfg.table).length}장의 표(이름·그림·특징값)와 관찰 문장이 사양과 같다`, () => {
      expect(exp.cards.map((c) => c.key)).toEqual(Object.keys(cfg.table));
      for (const c of exp.cards) {
        const [label, icon, ...vals] = cfg.table[c.key]!;
        expect([c.label, c.icon, c.sublabel], c.key).toEqual([label, icon, undefined]);
        expect(c.features, c.key).toEqual(Object.fromEntries(FEATURES.map((f, i) => [f, vals[i]])));
        expect(c.observations, c.key).toEqual(Object.fromEntries(FEATURES.map((f, i) => [f, cfg.obs[c.key]![i]])));
      }
    });
    it('카드 이름·관찰 문장·화면 문구에 정답 무리 이름과 설명 말이 없다', () => {
      for (const w of cfg.notInObservation) {
        expect(screenText(), w).not.toContain(w);
        for (const c of exp.cards) for (const o of Object.values(c.observations)) expect(o, `${c.key}: ${o}`).not.toContain(w);
      }
      for (const c of exp.cards) {
        for (const o of Object.values(c.observations)) {
          for (const w of ['정답', '틀렸', '맞았', '잘했어', '오답']) expect(o, `${c.key}: ${o}`).not.toContain(w);
          expect(guardOutput(o, guard).ok, o).toBe(true);
        }
        expect(guardOutput(c.label, guard).ok, c.label).toBe(true);
      }
    });
    it('validateCardSortExperiment를 통과하고 레지스트리에서 마지막 활동으로 등록된다', () => {
      expect(validateCardSortExperiment(exp)).toEqual([]);
      const u = UNITS.find((x) => x.id === cfg.unit.id)!;
      expect(u.ok && u.activities.map((a) => a.experiment.id)).toEqual(cfg.expIds);
      expect(u.ok && u.activities.length).toBe(cfg.expIds.length);
      if (u.ok) {
        const last = u.activities[u.activities.length - 1]!;
        expect(last.activity === 'card-sort' && last.module.kind).toBe('card-sort');
        expect(last.experiment.id).toBe(cfg.exp.id);
        // 최상위 값은 첫 활동이다.
        expect(u.experiment.id).toBe(cfg.expIds[0]);
      }
    });
    it('probe가 모든 상황을 덮고 finished 문장이 사양과 같다', () => {
      const byWhen = Object.fromEntries(exp.tutor.probes.map((p) => [p.when, p.text]));
      expect(Object.keys(byWhen).sort()).toEqual(
        ['before-observe', 'check-complete', 'check-inconsistent', 'check-subjective', 'check-unobserved', 'check-unplaced', 'choose-criterion', 'finished', 'pick-card', 'sorting'],
      );
      expect(byWhen['finished']).toBe(cfg.finished);
      expect(byWhen['check-complete']).toContain('다른 기준으로도 나누어 볼까요?');
      for (const t of Object.values(byWhen)) expect(t, t).toMatch(/[?？]/);
    });
    it('화면에 나오는 모든 문장에 제한 용어와 금지 구절이 없다', () => {
      expect(guardOutput(screenText(), guard)).toEqual({ ok: true, hits: [] });
    });
  });

  describe(`${cfg.exp.title} 그림`, () => {
    it('카드마다 그림이 있고 결과 표가 매니페스트와 같다', () => {
      expect(exp.cards.map((c) => c.icon)).toEqual(cfg.icon.keys);
      for (const c of exp.cards) {
        const r = cfg.icon.result[c.icon]!;
        for (const f of FEATURES) {
          const got = r[f];
          expect(typeof got === 'boolean' ? (got ? 'yes' : 'no') : got, `${c.key} ${f}`).toBe(c.features[f]);
        }
      }
    });
    it('그림 key가 다른 카드 그림과 겹치지 않는다', () => {
      const mine = cfg.icon.keys;
      const others = ALL_ICON_KEY_SETS().filter((k) => k !== mine);
      expect(others).toHaveLength(ALL_ICON_KEY_SETS().length - 1);
      for (const k of mine) for (const other of others) expect(other, k).not.toContain(k);
    });
    it('관찰 전의 기본 그림에는 결과 그림이 없고 글자가 없다', () => {
      for (const c of exp.cards) {
        for (const shown of [undefined, []]) {
          const html = svg(c.icon, shown);
          for (const cls of markClasses) expect(html, `${c.key} ${cls}`).not.toContain(cls);
          for (const [, attr] of Object.values(MARKS)) expect(html).not.toContain(`${attr}=`);
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
        for (const cls of markClasses) expect(all).toContain(cls);
        // 칸 순서(왼쪽부터)는 특징 순서와 같다.
        const pos = markClasses.map((cls) => all.indexOf(cls));
        expect(pos).toEqual([...pos].sort((a, b) => a - b));
        const none = svg(c.icon, ['nope']);
        for (const cls of markClasses) expect(none).not.toContain(cls);
        expect(all).not.toContain('<text');
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
      const btn = renderToStaticMarkup(createElement(CardButton, { label: c.label, icon: c.icon, count: FEATURES.length, total: FEATURES.length, selected: false, onClick: noop }));
      for (const cls of markClasses) expect(btn).not.toContain(cls);
      expect(btn).toContain(`관찰 ${FEATURES.length}/${FEATURES.length}`);
    });
  });

  describe(`${cfg.exp.title} 튜터 전수 가드`, () => {
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
      for (const phrase of cfg.requiredForbidden) expect(exp.tutor.forbiddenAnswers, phrase).toContain(phrase);
      for (const phrase of exp.tutor.forbiddenAnswers) expect(guardOutput(phrase, guard).ok, phrase).toBe(false);
    });
    it('활용형·조사·띄어쓰기를 바꾼 정답 누설 문장도 걸린다', () => {
      for (const t of cfg.leaks) expect(guardOutput(t, guard).ok, t).toBe(false);
    });
    it('제한 용어가 들어간 문장은 걸린다', () => {
      for (const w of exp.limits) expect(guardOutput(`이 카드는 ${w}와 관계가 있어요.`, guard).ok, w).toBe(false);
    });
    it('관찰 문장처럼 보이는 사실 진술은 걸리지 않는다(가드가 과하게 넓지 않다)', () => {
      for (const t of [...exp.cards.map((c) => Object.values(c.observations)[0]!), ...cfg.innocents]) {
        expect(guardOutput(t, guard).ok, t).toBe(true);
      }
    });
  });

  describe(`${cfg.exp.title} 피드백 전수 가드`, () => {
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
    it(`${cfg.wrong.card}을(를) 틀린 무리에 넣으면 그 카드만 다시 비교하라고 한다`, () => {
      const crit = exp.criteria.find((c) => c.key === cfg.wrong.criterion)!;
      const f = crit.feature!;
      let s = chooseCriterion(createInitialState(), exp, crit.key);
      s = ALL.reduce((cur, c) => observe(cur, exp, c, f), s);
      const wrongValue = crit.groups.find((g) => g.label === cfg.wrong.group)!.value;
      s = ALL.reduce((cur, c) => place(cur, exp, c, c === cfg.wrong.card ? wrongValue : truth(c, f)), s);
      expect(cardSortFeedback(exp, check(s, exp).checked)).toBe(cfg.wrong.sentence);
    });
  });
}
