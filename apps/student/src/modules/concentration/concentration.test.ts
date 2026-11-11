import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { CONC_CUPS, CONC_SPOONS, CONC_SUGARS, CONC_WATERS, simulateConcentration, type ConcentrationSample } from '@sci/engine-matter';
import { GraphView } from '../../components/GraphView';
import { BEAKER_G } from '@sci/sensors';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { concentrationModule } from './index';
import { CUP_TEXT, SUGAR_TEXT, concNote, mixLine, startSample } from './initial';
import { BEAKER, ConcMacroView, TOMATO_R, liquidBox, liquidFill, tomatoY } from './ConcMacroView';
import { ConcBarsView, MAX_BARS, PLOT, barHeight, barsOf } from './ConcBarsView';

const unit = UNITS.find((u) => u.id === 'g5-solution')!;
if (!unit.ok) throw new Error('g5-solution이 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g5-solution 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { spoons: number; waterMl: number; sugar: string; cup: string };
const base: V = { spoons: 1, waterMl: 100, sugar: 'brown', cup: 'low' };
const CONDITIONS: V[] = CONC_SPOONS.flatMap((spoons) => CONC_WATERS.flatMap((waterMl) => CONC_SUGARS.flatMap((sugar) => CONC_CUPS.map((cup) => ({ spoons, waterMl, sugar, cup })))));
const sim = (v: V) => concentrationModule.simulate(v, experiment) as ReturnType<typeof simulateConcentration>;
const at = (v: V, t: number): ConcentrationSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: ConcentrationSample | null, ran = true) => renderToStaticMarkup(createElement(ConcMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: V[], snapshot: ConcentrationSample | null, activeIndex = trials.length - 1) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(ConcBarsView, { experiment, trial: list[activeIndex] as never, snapshot, values: trials[activeIndex] ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const tomatoCy = (html: string) => Number(/<circle cx="[\d.]+" cy="([\d.]+)" r="9"/.exec(html)![1]);
const TIMES = [0, 0.5, 1, 2, 3];

describe('레지스트리', () => {
  it('g5-solution 활동 2는 concentration 모듈로 로드되고 첫 활동(dissolve-amount)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['용해와 용액', 5, 'matter', ['6과03-01', '6과03-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'dissolve-amount', 'dissolution'], ['variable', 'concentration', 'concentration']]);
    expect(unit.module.kind).toBe('dissolution');
    expect(activity.module).toBe(concentrationModule);
    expect(MODULES.concentration.kind).toBe('concentration');
    expect(experiment.safety).toEqual(['taste']);
    expect(concentrationModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['용액의 진하기 비교하기', '녹인 설탕의 양이 다르면 용액의 진하기를 어떻게 비교할 수 있을까?', '예측: 방울토마토가 뜬 높이는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['spoons', '넣은 설탕', 1], ['waterMl', '물의 양', 100], ['sugar', '설탕 종류', 'brown'], ['cup', '비커 모양', 'low']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [[1, '1숟가락'], [3, '3숟가락'], [5, '5숟가락']],
      [[50, '50 mL'], [100, '100 mL']],
      [['brown', '황설탕'], ['white', '흰 설탕']],
      [['low', '낮은 비커'], ['high', '높은 비커']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['float', '방울토마토가 뜬 높이', '눈금'], ['mass20', '20 mL의 무게', 'g'], ['color', '색의 진하기', '눈금']]);
    expect(experiment.limits).toEqual(['농도', '퍼센트', '밀도', '용해도', '포화', '부력']);
    expect(CONC_SUGARS.map((s) => SUGAR_TEXT[s])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
    expect(CONC_CUPS.map((s) => CUP_TEXT[s])).toEqual(experiment.variables[3]!.options.map((o) => o.label));
  });

  it('안전 상시 안내: "실험한 용액은 맛보지 않아요." 문구가 있고, 안전 경고 문구(음식)에도 들어 있다', () => {
    expect(experiment.safetyMessages?.FOOD).toContain('실험한 용액은 맛보지 않아요');
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값(뜬 높이 정수, 무게 소수 첫째 자리, 색 정수)과 비커 모양 무영향', () => {
    const cols = concentrationModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['방울토마토가 뜬 높이(눈금)', '20 mL의 무게(g)', '색의 진하기(눈금)']);
    const row = (spoons: number, waterMl: number, sugar = 'brown', cup = 'low') => cols.map((c) => c.value(sim({ spoons, waterMl, sugar, cup }).result));
    for (const cup of ['low', 'high']) {
      expect(row(1, 100, 'brown', cup)).toEqual(['0', '20.4', '2']);
      expect(row(3, 100, 'brown', cup)).toEqual(['4', '21.0', '5']);
      expect(row(5, 100, 'brown', cup)).toEqual(['9', '21.5', '8']);
      expect(row(1, 50, 'brown', cup)).toEqual(['1', '20.7', '4']);
      expect(row(3, 50, 'white', cup)).toEqual(['10', '21.8', '0']);
      expect(row(5, 50, 'white', cup)).toEqual(['10', '22.5', '0']);
    }
  });

  it('센서: 가상 전자저울(scale, g) 하나, 20 mL의 무게를 보여 주고(받침 100 g은 뺀 값) 실행 전에는 빈 저울(0 g)이다', () => {
    const specs = concentrationModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 전자저울: 20 mL의 무게', 'scale', 'g']]);
    expect(specs[0]!.source + BEAKER_G).toBe(0);
    const v = { ...base, spoons: 3 };
    expect(concentrationModule.sensors(at(v, 1), v)[0]!.source + BEAKER_G).toBe(21);
  });

  it('그래프 설정: y 0~10 눈금 고정(0, 2, …, 10), x 0~3초(0, 1, 2, 3), 선 하나, 재생이 끝나면 끝에 둔다(restPlayhead 없음)', () => {
    const g = concentrationModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['방울토마토 높이(눈금)', undefined, [0, 2, 4, 6, 8, 10], '시간(초)', [0, 1, 2, 3], undefined, undefined]);
    expect(concentrationModule.restPlayhead).toBeUndefined();
    expect(concentrationModule.metric.sampleKey).toBe('floatH');
    expect(concentrationModule.metric.resultKey).toBe('float');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.floatH))).toBeLessThanOrEqual(10);
      expect(s.at(-1)!.t).toBe(3);
    }
  });

  it('예측 비교는 뜬 높이(눈금): 설탕을 늘리면 늘어남, 물을 늘리면 줄어듦, 설탕 종류·비커 모양은 변하지 않음 (기준 0.5눈금)', () => {
    const m = concentrationModule.metric;
    const float = (v: V) => sim(v).result[m.resultKey as 'float'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(float(base), float({ ...base, spoons: 3 }), th)).toBe('increase');
    expect(observedOutcome(float({ ...base, spoons: 3 }), float({ ...base, spoons: 5 }), th)).toBe('increase');
    expect(observedOutcome(float({ ...base, spoons: 3 }), float(base), th)).toBe('decrease');
    expect(observedOutcome(float({ ...base, spoons: 3 }), float({ ...base, spoons: 3, waterMl: 50 }), th)).toBe('increase');
    expect(observedOutcome(float({ ...base, spoons: 5, waterMl: 50 }), float({ ...base, spoons: 5 }), th)).toBe('decrease');
    for (const v of CONDITIONS) {
      expect(observedOutcome(float(v), float({ ...v, sugar: v.sugar === 'brown' ? 'white' : 'brown' }), th)).toBe('same');
      expect(observedOutcome(float(v), float({ ...v, cup: v.cup === 'low' ? 'high' : 'low' }), th)).toBe('same');
    }
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, spoons: 5 };
    const html = renderToStaticMarkup(createElement(GraphView, { module: concentrationModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 3, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('방울토마토 높이(눈금)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '2', '4', '6', '8', '10']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}초 · 방울토마토 높이 {눈금}눈금 · 색의 진하기 {n}눈금"과 조건 라벨(설탕 종류·숟가락·물의 양, 비커 모양)', () => {
    const v = { ...base, spoons: 5 };
    expect(concNote(at(v, 2), 8)).toBe('2.0초 · 방울토마토 높이 9.0눈금 · 색의 진하기 8눈금');
    expect(macro(v, at(v, 2))).toContain('2.0초 · 방울토마토 높이 9.0눈금 · 색의 진하기 8눈금');
    expect(mixLine({ sugar: 'brown', spoons: 5, waterMl: 100 })).toBe('황설탕 5숟가락 · 물 100 mL');
    expect(mixLine({ sugar: 'white', spoons: 1, waterMl: 50 })).toBe('흰 설탕 1숟가락 · 물 50 mL');
    const html = macro({ ...base, sugar: 'white', cup: 'high' }, null, false);
    expect(html).toContain('흰 설탕 1숟가락 · 물 100 mL');
    expect(html).toContain('높은 비커');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 방울토마토는 바닥, 용액에 색이 없고, 문구에 숫자 결과가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      const { bottom } = liquidBox(v.cup as 'low', v.waterMl);
      expect(html, JSON.stringify(v)).toContain('data-float="0.00"');
      expect(tomatoCy(html)).toBeCloseTo(bottom - TOMATO_R - 1, 1);
      expect(html).toContain(`data-fill="${liquidFill(0)}"`);
      expect(html).toContain('실험하면');
      expect(html).not.toContain('방울토마토 높이');
      expect(html).not.toContain('색의 진하기');
      expect(count(html, 'tomato')).toBe(1);
    }
    expect(startSample(base)).toMatchObject({ t: 0, floatH: 0 });
  });

  it('방울토마토는 뜬 높이만큼 올라간다: 눈금 0은 바닥, 눈금 10은 물 윗면 가까이, 눈금이 클수록 위(y가 작음)', () => {
    for (const v of CONDITIONS) {
      const r = sim(v).result;
      const html = macro(v, at(v, 3));
      expect(tomatoCy(html), JSON.stringify(v)).toBeCloseTo(tomatoY(v.cup as 'low', v.waterMl, r.float), 1);
      expect(html).toContain(`data-float="${r.float.toFixed(2)}"`);
      const box = liquidBox(v.cup as 'low', v.waterMl);
      expect(tomatoCy(html) - TOMATO_R).toBeGreaterThanOrEqual(box.top - 1e-6);
      expect(tomatoCy(html) + TOMATO_R).toBeLessThanOrEqual(box.bottom + 1e-6);
    }
    expect(tomatoY('low', 100, 10)).toBeLessThan(tomatoY('low', 100, 4));
    expect(tomatoY('low', 100, 4)).toBeLessThan(tomatoY('low', 100, 0));
    // 그림 위쪽 글자 줄(y 40)보다 아래에 그린다
    for (const cup of CONC_CUPS) expect(tomatoY(cup, 100, 10) - TOMATO_R).toBeGreaterThan(44);
  });

  it('용액 색: 황설탕은 색의 진하기에 따라 진해지고(같은 진하기면 같은 색), 흰 설탕은 실행 뒤에도 색이 없다', () => {
    const fillOf = (v: V) => /data-testid="liquid" data-fill="([^"]+)"/.exec(macro(v, at(v, 3)))![1]!;
    expect(fillOf({ ...base, sugar: 'white', spoons: 5 })).toBe(liquidFill(0));
    expect(fillOf({ ...base, sugar: 'brown', spoons: 5 })).toBe(liquidFill(8));
    expect(fillOf({ ...base, sugar: 'brown', spoons: 5 })).not.toBe(fillOf({ ...base, sugar: 'brown', spoons: 1 }));
    // 색 진하기 눈금 0, 5, 10의 R 값이 점점 작아진다(밝은 하늘색 → 갈색)
    const r = (c: number) => Number(/rgb\((\d+),/.exec(liquidFill(c))![1]);
    expect(r(0)).toBeGreaterThan(r(5));
    expect(r(5)).toBeGreaterThan(r(10));
  });

  it('비커 모양: 낮은 비커는 넓고 낮고, 높은 비커는 좁고 높다. 물의 양(50·100 mL)은 같은 비커에서 물 높이를 바꾼다', () => {
    expect(BEAKER.low.x1 - BEAKER.low.x0).toBeGreaterThan(BEAKER.high.x1 - BEAKER.high.x0);
    expect(BEAKER.low.top).toBeGreaterThan(BEAKER.high.top);
    for (const cup of CONC_CUPS) expect(liquidBox(cup, 100).h).toBeGreaterThan(liquidBox(cup, 50).h);
    expect(macro({ ...base, cup: 'high' }, null, false)).toContain('data-cup="high"');
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 막대가 없고 안내만 있다', () => {
    const html = renderToStaticMarkup(createElement(ConcBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(html, 'conc-bar')).toBe(0);
    expect(html).toContain('실험하면 시행마다 막대가 생겨요');
    const noProp = renderToStaticMarkup(createElement(ConcBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0 }));
    expect(count(noProp, 'conc-bar')).toBe(0);
  });

  it('시행마다 막대 하나: 끝난 시행은 결과의 뜬 높이, 보이는 시행은 지금 순간의 값(실행 중에는 자란다)', () => {
    const list: V[] = [{ ...base, spoons: 1 }, { ...base, spoons: 3 }, { ...base, spoons: 5 }];
    const done = bars(list, at(list[2]!, 3));
    expect([...done.matchAll(/data-testid="conc-bar" data-trial="(\d+)" data-value="(\d+)"/g)].map((m) => [Number(m[1]) - Number(/data-trial="(\d+)"/.exec(done)![1]) + 1, Number(m[2])])).toEqual([[1, 0], [2, 4], [3, 9]]);
    // 실행 중: 마지막 시행의 막대는 그 순간 높이
    const mid = bars(list, at(list[2]!, 0.5));
    const values = [...mid.matchAll(/data-testid="conc-bar" data-trial="\d+" data-value="(\d+)"/g)].map((m) => Number(m[1]));
    expect(values.slice(0, 2)).toEqual([0, 4]);
    expect(values[2]).toBeLessThan(9);
    expect(values[2]).toBe(Math.round(at(list[2]!, 0.5).floatH));
    // 막대 위·아래 글자: 값과 시행 번호
    expect(done).toContain('시행 번호');
    expect(done).toContain('뜬 높이(눈금)');
  });

  it('막대 높이는 눈금 0~10에 비례하고 틀 안에 있다', () => {
    expect(barHeight(0)).toBe(0);
    expect(barHeight(10)).toBe(PLOT.bottom - PLOT.top);
    expect(barHeight(5)).toBeCloseTo((PLOT.bottom - PLOT.top) / 2, 9);
    expect(barHeight(99)).toBe(PLOT.bottom - PLOT.top);
    expect(barHeight(-3)).toBe(0);
  });

  it(`가장 최근 ${MAX_BARS}번만 보여 준다`, () => {
    const list: V[] = Array.from({ length: 11 }, (_, i) => ({ ...base, spoons: [1, 3, 5][i % 3]! }));
    const html = bars(list, at(list.at(-1)!, 3));
    expect(count(html, 'conc-bar')).toBe(MAX_BARS);
    const trials = list.map(trialOf) as never[];
    expect(barsOf(trials, undefined, 0)).toHaveLength(MAX_BARS);
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(24가지) × 실행 전·여러 시각의 눈으로 보기·막대 그래프 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [ConcentrationSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [ConcentrationSample, boolean])];
      for (const [snap, ran] of list) {
        const html = [macro(v, snap, ran), ran ? bars([base, v], snap) : renderToStaticMarkup(createElement(ConcBarsView, { experiment, trial: undefined, snapshot: null, values: v, playhead: 0, trials: [] }))];
        for (const h of html) {
          for (const shown of shownText(h)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(1500);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...concentrationModule.resultColumns(experiment).map((c) => c.label),
      ...concentrationModule.sensors(null, base).map((s) => s.label),
      concentrationModule.graph.yLabel,
      concentrationModule.graph.xLabel!,
      ...CONDITIONS.map((v) => mixLine(v as never)),
    ];
    for (const t of shown) expect(guardOutput(t, guard).ok, t).toBe(true);
  });

  it('질문(probe) 문장은 모두 질문형이고, 모든 probe × 모든 변인 이름 치환으로도 가드를 통과한다', () => {
    const labels = experiment.variables.map((v) => v.label);
    for (const probe of experiment.tutor.probes) {
      expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
      for (const f of experiment.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
      for (const iv of labels) {
        for (const changed of [...labels.map((l) => [l]), labels]) {
          const text = probe.text.replaceAll('{iv}', iv).replaceAll('{changed}', changed.join(', '));
          expect(guardOutput(text, guard).ok, text).toBe(true);
        }
      }
    }
  });

  it('금지 구절은 활용형까지 막는다 (규칙 위반 응답은 모두 걸린다)', () => {
    for (const answer of [
      '설탕을 많이 넣을수록 진해요',
      '설탕을 많이 넣을수록 진하답니다',
      '설탕을 많이 넣으면 진해져요',
      '설탕을 더 넣을수록 진해요',
      '설탕을 더 넣으면 진해집니다',
      '설탕이 많을수록 진해요',
      '설탕이 많으면 진합니다',
      '설탕이 많이 녹을수록 진해요',
      '물이 많을수록 연해요',
      '물이 많으면 연해집니다',
      '물을 많이 넣을수록 연해져요',
      '물을 많이 넣으면 연해요',
      '물이 적을수록 진해요',
      '물이 적으면 진해집니다',
      '진할수록 방울토마토가 높이 떠요',
      '진할수록 방울토마토가 높이 올라가요',
      '진할수록 높이 떠요',
      '진할수록 더 높이 뜹니다',
      '진하면 방울토마토가 높이 떠요',
      '진하면 높이 떠요',
      '진한 용액일수록 높이 떠요',
      '흰 설탕은 색으로 비교할 수 없어요',
      '흰 설탕은 색으로 비교하기 어려워요',
      '흰 설탕으로는 색을 비교할 수 없어요',
      '비커 모양은 관계없어요',
      '비커 모양은 상관없습니다',
      '비커 모양은 영향이 없어요',
      '비커 모양과 관계없이 같아요',
      '비커 모양이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['넣은 설탕만 바꾸었을 때 방울토마토가 뜬 높이는 어떻게 달라졌나요?', '설탕 종류만 바꾸었을 때 용액의 색은 어땠나요?', '비커 모양만 바꾸었을 때 결과가 달라졌나요?', '시행별 막대를 견주어 볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
