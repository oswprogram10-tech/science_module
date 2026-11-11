import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { MIX_BEAKERS, MIX_DIRECTIONS, MIX_DROPS, MIX_INDICATORS, MIX_SCALE, simulateAcidBaseMix, type AcidBaseMixSample } from '@sci/engine-matter';
import type { ClassificationExperiment } from '@sci/schema';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { acidBaseMixModule } from './index';
import { ADDED_TEXT, COLOR_HEX, DIRECTION_TEXT, FIRST_TEXT, INDICATOR_TEXT, colorFor, colorName, scaleText } from './initial';
import { BEAKER, MixMacroView, PLAIN_FILL, levelFraction } from './MixMacroView';
import { AXIS, MAX_ROWS, MixStripView, dropX, rowsOf } from './MixStripView';

const unit = UNITS.find((u) => u.id === 'g6-acid-base')!;
if (!unit.ok) throw new Error('g6-acid-base가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g6-acid-base 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
const firstExp = unit.activities[0]!.experiment as unknown as ClassificationExperiment;
type V = { drops: number; direction: string; indicator: string; beaker: number };
const base: V = { drops: 0, direction: 'acid', indicator: 'cabbage', beaker: 50 };
const CONDITIONS: V[] = MIX_DROPS.flatMap((drops) => MIX_DIRECTIONS.flatMap((direction) => MIX_INDICATORS.flatMap((indicator) => MIX_BEAKERS.map((beaker) => ({ drops, direction, indicator, beaker })))));
const sim = (v: V) => acidBaseMixModule.simulate(v, experiment) as ReturnType<typeof simulateAcidBaseMix>;
const at = (v: V, t: number): AcidBaseMixSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: AcidBaseMixSample | null, ran = true) => renderToStaticMarkup(createElement(MixMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const strip = (trials: V[], snapshot: AcidBaseMixSample | null, activeIndex = trials.length - 1) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(MixStripView, { experiment, trial: list[activeIndex] as never, snapshot, values: trials[activeIndex] ?? base, playhead: 0, trials: list as never }));
};
const emptyStrip = (v: V = base) => renderToStaticMarkup(createElement(MixStripView, { experiment, trial: undefined, snapshot: null, values: v, playhead: 0, trials: [] }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.5, 1, 2, 3];

describe('레지스트리', () => {
  it('g6-acid-base 활동 2는 acid-base-mix 모듈로 로드되고 첫 활동(indicator-classify, 분류 활동)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['산과 염기', 6, 'matter', ['6과09-01', '6과09-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['classify', 'indicator-classify', 'indicator-classify'], ['variable', 'acid-base-mix', 'acid-base-mix']]);
    expect(unit.activity).toBe('classify');
    expect(activity.module).toBe(acidBaseMixModule);
    expect(MODULES['acid-base-mix'].kind).toBe('acid-base-mix');
    expect(experiment.safety).toEqual(['goggles', 'gloves', 'corrosive']);
    expect(acidBaseMixModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['산성 용액과 염기성 용액 섞기', '산성 용액에 염기성 용액을 조금씩 넣으면 용액의 성질은 어떻게 변할까?', '예측: 색 띠에서 지시약 색의 자리는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['drops', '넣은 방울 수', 0], ['direction', '넣는 방향', 'acid'], ['indicator', '지시약', 'cabbage'], ['beaker', '비커 크기', 50]]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [[0, '0방울'], [10, '10방울'], [20, '20방울'], [30, '30방울'], [40, '40방울']],
      [['acid', '묽은 염산 10 mL에 묽은 수산화 나트륨 용액을 넣음'], ['base', '묽은 수산화 나트륨 용액 10 mL에 묽은 염산을 넣음']],
      [['cabbage', '붉은 양배추 지시약'], ['phenol', '페놀프탈레인 용액']],
      [[50, '50 mL'], [100, '100 mL']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['color', '지시약 색', ''], ['addedMl', '넣은 양', 'mL'], ['slot', '색 띠에서의 자리', '칸']]);
    expect(experiment.limits).toEqual(['pH', '수소 이온', '수산화 이온', '몰', '중화열', '염']);
    expect(MIX_DIRECTIONS.map((d) => DIRECTION_TEXT[d])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(MIX_INDICATORS.map((d) => INDICATOR_TEXT[d])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
  });

  it('안전: 보안경·장갑 점검표와 경고 문구는 첫 활동(지시약으로 여러 가지 용액 분류하기)과 같다', () => {
    expect(experiment.safetyChecklist).toEqual(firstExp.safetyChecklist);
    expect(experiment.safetyChecklist).toHaveLength(3);
    expect(experiment.safety).toEqual(firstExp.safety);
  });

  it('색 이름과 색(hex)은 첫 활동 매니페스트의 colors와 같다 (이름 체계 일치)', () => {
    const keys = Object.keys(COLOR_HEX) as (keyof typeof COLOR_HEX)[];
    expect(keys).toHaveLength(8);
    for (const k of keys) {
      expect(colorName(k), k).toBe(firstExp.colors[k]!.label);
      expect(COLOR_HEX[k], k).toBe(firstExp.colors[k]!.hex);
    }
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표(염산에 넣기, 붉은 양배추)의 지시약 색 이름과 넣은 양(소수 첫째 자리), 색 띠 자리, 비커 크기 무영향', () => {
    const cols = acidBaseMixModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['지시약 색', '넣은 양(mL)', '색 띠에서의 자리(칸)']);
    const row = (drops: number, direction = 'acid', indicator = 'cabbage', beaker = 50) => cols.map((c) => c.value(sim({ drops, direction, indicator, beaker }).result));
    for (const beaker of [50, 100]) {
      expect(row(0, 'acid', 'cabbage', beaker)).toEqual(['붉은색', '0.0', '1']);
      expect(row(10, 'acid', 'cabbage', beaker)).toEqual(['붉은색', '5.0', '1']);
      expect(row(20, 'acid', 'cabbage', beaker)).toEqual(['보라색', '10.0', '3']);
      expect(row(30, 'acid', 'cabbage', beaker)).toEqual(['노란색', '15.0', '6']);
      expect(row(40, 'acid', 'cabbage', beaker)).toEqual(['노란색', '20.0', '6']);
      expect(row(20, 'acid', 'phenol', beaker)).toEqual(['색 변화 없음', '10.0', '1']);
      expect(row(30, 'acid', 'phenol', beaker)).toEqual(['붉은색', '15.0', '2']);
      expect(row(0, 'base', 'cabbage', beaker)).toEqual(['노란색', '0.0', '6']);
    }
  });

  it('센서는 없다(색은 눈으로 본다)', () => {
    expect(acidBaseMixModule.sensors(null, base)).toEqual([]);
    expect(acidBaseMixModule.sensors(at(base, 1), base)).toEqual([]);
  });

  it('그래프 설정: y 0~6칸(정수 눈금), x 0~3초, 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = acidBaseMixModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['색 띠에서의 자리(칸)', undefined, [0, 1, 2, 3, 4, 5, 6], '시간(초)', [0, 1, 2, 3], undefined, undefined]);
    expect(acidBaseMixModule.restPlayhead).toBeUndefined();
    expect(acidBaseMixModule.metric.sampleKey).toBe('slot');
    expect(acidBaseMixModule.metric.resultKey).toBe('slot');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.slot))).toBeLessThanOrEqual(6);
      expect(Math.min(...s.map((x) => x.slot))).toBeGreaterThanOrEqual(1);
      expect(s.at(-1)!.t).toBe(3);
    }
  });

  it('예측 비교는 색 띠에서의 자리(칸): 방울을 늘리면 염기성 쪽 칸으로 늘어남, 방향을 바꾸면 줄어듦, 비커 크기는 변하지 않음 (기준 0.5)', () => {
    const m = acidBaseMixModule.metric;
    const slot = (v: V) => sim(v).result[m.resultKey as 'slot'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(slot(base), slot({ ...base, drops: 20 }), th)).toBe('increase');
    expect(observedOutcome(slot({ ...base, drops: 20 }), slot({ ...base, drops: 30 }), th)).toBe('increase');
    expect(observedOutcome(slot({ ...base, drops: 30 }), slot({ ...base, drops: 30, direction: 'base' }), th)).toBe('decrease');
    expect(observedOutcome(slot(base), slot({ ...base, drops: 10 }), th)).toBe('same');
    for (const v of CONDITIONS) expect(observedOutcome(slot(v), slot({ ...v, beaker: v.beaker === 50 ? 100 : 50 }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, drops: 30 };
    const html = renderToStaticMarkup(createElement(GraphView, { module: acidBaseMixModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 3, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('색 띠에서의 자리(칸)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 0방울, 용액에 색이 없고, 지시약 색 글자는 "실험하면 나타나요"', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain('data-color="none"');
      expect(html).toContain('data-drops="0"');
      expect(html).toContain(`data-fill="${PLAIN_FILL}"`);
      expect(html).toContain('지시약 색: 실험하면 나타나요');
      expect(count(html, 'drop')).toBe(0);
      for (const c of Object.values(COLOR_HEX)) if (c !== PLAIN_FILL) expect(html).not.toContain(`data-fill="${c}"`);
    }
  });

  it('실행한 뒤 색은 그 순간 방울 수의 지시약 색이고 색 이름을 글자로 함께 쓴다 (색각 접근성)', () => {
    for (const v of CONDITIONS) {
      for (const t of TIMES) {
        const s = at(v, t);
        const d = Math.round(s.drops);
        const c = colorFor(d, v.direction as 'acid', v.indicator as 'cabbage');
        const html = macro(v, s);
        expect(html, JSON.stringify([v, t])).toContain(`data-color="${c}"`);
        expect(html).toContain(`data-fill="${COLOR_HEX[c]}"`);
        expect(html).toContain(`지시약 색: ${colorName(c)}`);
        expect(html).toContain(`넣은 방울 수 ${d}방울 · ${(d * 0.5).toFixed(1)} mL`);
      }
      // 끝 시각의 색은 결과와 같다
      expect(macro(v, at(v, 3))).toContain(`지시약 색: ${colorName(sim(v).result.color)}`);
    }
  });

  it('조건 라벨과 그림: 지시약·처음 용액·넣는 용액, 비커 크기(100 mL가 더 넓고 높다), 방울이 들어갈수록 용액 높이가 는다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 3));
      expect(html).toContain(INDICATOR_TEXT[v.indicator as 'cabbage']);
      expect(html).toContain(`처음: ${FIRST_TEXT[v.direction as 'acid']}`);
      expect(html).toContain(`넣는 용액: ${ADDED_TEXT[v.direction as 'acid']}`);
      expect(html).toContain(`data-beaker="${v.beaker}"`);
    }
    expect(BEAKER[100]!.x1 - BEAKER[100]!.x0).toBeGreaterThan(BEAKER[50]!.x1 - BEAKER[50]!.x0);
    expect(BEAKER[100]!.top).toBeLessThan(BEAKER[50]!.top);
    for (const beaker of [50, 100]) {
      expect(levelFraction(40, beaker)).toBeGreaterThan(levelFraction(0, beaker));
      expect(levelFraction(40, beaker)).toBeLessThanOrEqual(1);
    }
    expect(macro({ ...base, drops: 40 }, at({ ...base, drops: 40 }, 3))).toContain('data-testid="drop"');
  });

  it('비커 크기는 용액 색·글자를 바꾸지 않는다 (대조 변인)', () => {
    for (const v of CONDITIONS) {
      const other = { ...v, beaker: v.beaker === 50 ? 100 : 50 };
      const color = (h: string) => shownText(h).filter((t) => t.startsWith('지시약 색:'));
      expect(color(macro(v, at(v, 3)))).toEqual(color(macro(other, at(other, 3))));
      expect(color(macro(v, at(v, 3)))).toHaveLength(1);
    }
  });
});

describe('색 띠 기록', () => {
  it('시행이 없으면 칸이 없고 안내만 있다', () => {
    const html = emptyStrip();
    expect(count(html, 'strip-row')).toBe(0);
    expect(html).toContain('실험하면 시행마다 색 칸이 찍혀요');
    const noProp = renderToStaticMarkup(createElement(MixStripView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0 }));
    expect(count(noProp, 'strip-row')).toBe(0);
  });

  it('시행마다 한 줄: 방울 수 자리에 그 색의 칸을 찍고 색 이름을 글자로 쓴다', () => {
    const list: V[] = [{ ...base, drops: 10 }, { ...base, drops: 20 }, { ...base, drops: 30 }, { ...base, drops: 40, indicator: 'phenol' }];
    const html = strip(list, at(list[3]!, 3));
    const rows = [...html.matchAll(/data-testid="strip-row" data-trial="(\d+)" data-drops="(\d+)" data-color="(\w+)"/g)].map((m) => [Number(m[2]), m[3]]);
    expect(rows).toEqual([[10, 'cabRed'], [20, 'cabPurple'], [30, 'cabYellow'], [40, 'magenta']]);
    expect(count(html, 'strip-cell')).toBe(4);
    const names = [...html.matchAll(/data-testid="strip-name"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(names).toEqual(['붉은색', '보라색', '노란색', '붉은색']);
    // 색은 첫 활동의 hex 그대로
    for (const c of ['cabRed', 'cabPurple', 'cabYellow', 'magenta'] as const) expect(html).toContain(`fill="${COLOR_HEX[c]}"`);
    // 방울 수 축 글자와 시행 번호 글자
    for (const t of ['넣은 방울 수', '0', '10', '20', '30', '40']) expect(shownText(html)).toContain(t);
    for (const m of html.matchAll(/data-testid="strip-row" data-trial="(\d+)"/g)) expect(html).toContain(`${m[1]}회`);
  });

  it('칸의 가로 자리는 방울 수에 비례하고 그림 틀 안에 있다', () => {
    expect(dropX(0)).toBe(AXIS.x0);
    expect(dropX(40)).toBe(AXIS.x1);
    expect(dropX(20)).toBeCloseTo((AXIS.x0 + AXIS.x1) / 2, 9);
    for (const d of MIX_DROPS) {
      expect(dropX(d) - 13).toBeGreaterThanOrEqual(0);
      expect(dropX(d) + 13).toBeLessThanOrEqual(240);
    }
  });

  it('실행 중인 시행의 칸은 그 순간 방울 수와 색으로 찍히고, 끝난 시행은 결과로 찍힌다', () => {
    const list: V[] = [{ ...base, drops: 40 }, { ...base, drops: 40 }];
    const mid = rowsOf(list.map(trialOf) as never, undefined, null);
    expect(mid.map((r) => r.drops)).toEqual([40, 40]);
    const trials = list.map(trialOf) as { id: string }[];
    const rows = rowsOf(trials as never, trials[1]!.id, at(list[1]!, 0.5));
    expect(rows[0]).toMatchObject({ drops: 40, color: 'cabYellow', active: false });
    expect(rows[1]!.drops).toBe(Math.round(at(list[1]!, 0.5).drops));
    expect(rows[1]!.drops).toBeLessThan(40);
    expect(rows[1]!.active).toBe(true);
  });

  it(`가장 최근 ${MAX_ROWS}번만 보여 준다`, () => {
    const list: V[] = Array.from({ length: 8 }, (_, i) => ({ ...base, drops: [0, 10, 20, 30, 40][i % 5]! }));
    expect(count(strip(list, at(list.at(-1)!, 3)), 'strip-row')).toBe(MAX_ROWS);
  });

  it('지시약 색 띠 설명: 칸 번호와 색 이름(붉은 양배추 6칸, 페놀프탈레인 2칸)', () => {
    expect(scaleText('cabbage')).toBe('1 붉은색 → 2 연한 붉은색 → 3 보라색 → 4 푸른색 → 5 초록색 → 6 노란색');
    expect(scaleText('phenol')).toBe('1 색 변화 없음 → 2 붉은색');
    expect(MIX_SCALE.cabbage).toHaveLength(6);
    expect(emptyStrip({ ...base, indicator: 'phenol' })).toContain('1 색 변화 없음 → 2 붉은색');
    expect(emptyStrip()).toContain('붉은 양배추 색 띠: 1 붉은색');
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };
  // 화면에는 사양대로 "묽은 염산"이 나오므로, 한계 용어 "염"은 글자 그대로 검사하지 않고 나머지 한계 용어와 금지 구절만 검사한다.
  const screenGuard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits.filter((l) => l !== '염') };

  it('모든 조건(40가지) × 실행 전·여러 시각의 눈으로 보기·색 띠 기록 글자는 금지 구절·한계 용어(염 제외)와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [AcidBaseMixSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [AcidBaseMixSample, boolean])];
      for (const [snap, ran] of list) {
        const htmls = [macro(v, snap, ran), ran ? strip([base, v], snap) : emptyStrip(v)];
        for (const html of htmls) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, screenGuard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(3000);
  });

  it('지시약 색 이름·변인·결과 열·그래프 라벨은 금지 구절·한계 용어(염 제외)와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...acidBaseMixModule.resultColumns(experiment).map((c) => c.label),
      acidBaseMixModule.graph.yLabel,
      acidBaseMixModule.graph.xLabel!,
      ...Object.values(COLOR_HEX).map((_, i) => colorName(Object.keys(COLOR_HEX)[i] as 'cabRed')),
      scaleText('cabbage'),
      scaleText('phenol'),
    ];
    for (const t of shown) expect(guardOutput(t, screenGuard).ok, t).toBe(true);
  });

  it('질문(probe) 문장은 모두 질문형이고, 모든 probe × 모든 변인 이름 치환으로도 (염 포함) 가드를 통과한다', () => {
    const labels = experiment.variables.map((v) => v.label);
    for (const probe of experiment.tutor.probes) {
      expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
      for (const f of experiment.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
      for (const l of experiment.limits) expect(probe.text, probe.text).not.toContain(l);
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
      '중화가 일어나요',
      '중화되었어요',
      '중성이 되었어요',
      '중성이 돼요',
      '중성으로 바뀌어요',
      '산성이 약해져요',
      '산성이 약해집니다',
      '산성이 점점 약해져요',
      '산성이 줄어들어요',
      '산성이 사라져요',
      '산성이 없어져요',
      '염기성이 약해져요',
      '염기성이 점점 약해져요',
      '염기성으로 변해요',
      '염기성이 강해져요',
      '산성으로 변해요',
      '산성이 강해져요',
      '비커 크기는 관계없어요',
      '비커 크기는 상관없습니다',
      '비커 크기는 영향이 없어요',
      '비커 크기와 관계없이 같아요',
      '비커 크기가 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['넣은 방울 수만 바꾸었을 때 지시약 색은 어떻게 달라졌나요?', '비커 크기만 바꾸었을 때 지시약 색은 달라졌나요?', '색 띠 기록에서 칸의 자리를 견주어 볼까요?', '지시약만 바꾸었을 때 색 이름은 어땠나요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
