import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { LN_BOXES, LN_FLASHLIGHTS, LN_OBJECTS, simulateLightNeeded, type LightNeededSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { lightNeededModule } from './index';
import { BOX_TEXT, FLASHLIGHT_TEXT, OBJECT_TEXT, lightNote, startSample } from './initial';
import { BOX, HOLE_Y, LightMacroView, WINDOW } from './LightMacroView';
import { LightBarsView } from './LightBarsView';
import { BARS_MAX, barsHeight, trialBarsOf } from '../TrialBars';

const unit = UNITS.find((u) => u.id === 'g5-light')!;
if (!unit.ok) throw new Error('g5-light가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g5-light 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { flashlight: string; object: string; boxColor: string };
const base: V = { flashlight: 'off', object: 'doll', boxColor: 'black' };
const CONDITIONS: V[] = LN_FLASHLIGHTS.flatMap((flashlight) => LN_OBJECTS.flatMap((object) => LN_BOXES.map((boxColor) => ({ flashlight, object, boxColor }))));
const sim = (v: V) => lightNeededModule.simulate(v, experiment) as ReturnType<typeof simulateLightNeeded>;
const at = (v: V, t: number): LightNeededSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: LightNeededSample | null, ran = true) => renderToStaticMarkup(createElement(LightMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: V[], snapshot: LightNeededSample | null, activeIndex = trials.length - 1) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(LightBarsView, { experiment, trial: list[activeIndex] as never, snapshot, values: trials[activeIndex] ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.5, 1, 1.5, 2];

describe('레지스트리', () => {
  it('g5-light 활동 2는 light-needed 모듈로 로드되고 첫 활동(convex-lens)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['빛의 성질', 5, 'physics', ['6과02-01', '6과02-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'convex-lens', 'convex-lens'], ['variable', 'light-needed', 'light-needed']]);
    expect(unit.module.kind).toBe('convex-lens');
    expect(activity.module).toBe(lightNeededModule);
    expect(MODULES['light-needed'].kind).toBe('light-needed');
    expect(experiment.safety).toEqual([]);
    expect(lightNeededModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['물체를 보려면 빛이 필요할까', '깜깜한 상자 안의 물체를 보려면 무엇이 필요할까?', '예측: 상자 안 밝기 눈금은?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['flashlight', '상자 안 손전등', 'off'], ['object', '상자 안 물체', 'doll'], ['boxColor', '상자 겉 색깔', 'black']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['off', '끔'], ['on', '켬']],
      [['doll', '인형'], ['bulb', '켜진 작은 전구']],
      [['black', '검은색'], ['white', '흰색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['brightness', '상자 안 밝기', '눈금'], ['visible', '구멍으로 본 물체', '']]);
    expect(LN_BOXES.map((b) => BOX_TEXT[b])).toEqual(['검은 상자', '흰 상자']);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값(밝기 정수, 구멍으로 본 물체 범주)과 상자 겉 색깔 무영향', () => {
    const cols = lightNeededModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['상자 안 밝기(눈금)', '구멍으로 본 물체']);
    const row = (flashlight: string, object: string, boxColor = 'black') => cols.map((c) => c.value(sim({ flashlight, object, boxColor }).result));
    for (const box of ['black', 'white']) {
      expect(row('off', 'doll', box)).toEqual(['0', '보이지 않음']);
      expect(row('on', 'doll', box)).toEqual(['8', '보임']);
      expect(row('off', 'bulb', box)).toEqual(['3', '보임']);
      expect(row('on', 'bulb', box)).toEqual(['9', '보임']);
    }
  });

  it('센서: 가상 조도계(light) 하나, 상자 안 밝기 눈금 × 10(%)을 보여 주고 실험 전에는 0이다', () => {
    const specs = lightNeededModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind])).toEqual([['가상 조도계: 상자 안 밝기', 'light']]);
    expect(specs[0]!.source).toBe(0);
    const v = { ...base, flashlight: 'on' };
    expect(lightNeededModule.sensors(at(v, 2), v)[0]!.source).toBeCloseTo(80, 9);
  });

  it('그래프 설정: y 0~10 눈금 고정, x 0~2초, 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = lightNeededModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['상자 안 밝기(눈금)', undefined, [0, 2, 4, 6, 8, 10], '시간(초)', [0, 1, 2], undefined, undefined]);
    expect(lightNeededModule.restPlayhead).toBeUndefined();
    expect(lightNeededModule.metric.sampleKey).toBe('level');
    expect(lightNeededModule.metric.resultKey).toBe('brightness');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.level))).toBeLessThanOrEqual(10);
      expect(s.at(-1)!.t).toBe(2);
    }
  });

  it('예측 비교는 밝기 눈금: 손전등을 켜면 늘어남, 상자 겉 색깔은 변하지 않음 (기준 0.5눈금)', () => {
    const m = lightNeededModule.metric;
    const level = (v: V) => sim(v).result[m.resultKey as 'brightness'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(level(base), level({ ...base, flashlight: 'on' }), th)).toBe('increase');
    expect(observedOutcome(level({ ...base, flashlight: 'on' }), level(base), th)).toBe('decrease');
    expect(observedOutcome(level(base), level({ ...base, object: 'bulb' }), th)).toBe('increase');
    for (const v of CONDITIONS) expect(observedOutcome(level(v), level({ ...v, boxColor: v.boxColor === 'black' ? 'white' : 'black' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, flashlight: 'on' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: lightNeededModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('상자 안 밝기(눈금)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '2', '4', '6', '8', '10']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 구멍으로 본 장면(검은 원·물체 그림)과 결과 글자를 그리지 않는다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html).toContain('data-state="empty"');
      expect(count(html, 'peek-object')).toBe(0);
      expect(count(html, 'peek-text')).toBe(0);
      expect(html).not.toContain('보이지 않음');
      expect(shownText(html).some((t) => t.includes('구멍으로 본 물체:'))).toBe(false);
      expect(html).toContain('실험하면 구멍으로 본 장면이 둥근 창에 나타나요.');
    }
  });

  it('실행하면 깜깜하면 검은 원, 보이면 물체 그림이 둥근 창에 나타난다', () => {
    const hidden = macro(base, at(base, 2));
    expect(hidden).toContain('data-state="dark"');
    expect(count(hidden, 'peek-object')).toBe(0);
    expect(hidden).toContain('보이지 않음');
    const on = { ...base, flashlight: 'on' };
    const shown = macro(on, at(on, 2));
    expect(shown).toContain('data-state="object"');
    expect(count(shown, 'peek-object')).toBe(1);
    expect(shown).toContain('data-object="doll"');
    const bulb = macro({ ...base, object: 'bulb' }, at({ ...base, object: 'bulb' }, 2));
    expect(bulb).toContain('data-state="object"');
    expect(bulb).toContain('data-object="bulb"');
  });

  it('빛의 길 화살표·광선을 그리지 않는다 (정답 노출 금지) — 모든 조건, 모든 시각', () => {
    for (const v of CONDITIONS) {
      for (const t of TIMES) {
        const html = macro(v, at(v, t));
        expect(html).not.toMatch(/marker-end|<marker|arrow|ray|beam/i);
        expect(html).not.toContain('→');
        // 화살표가 될 만한 폴리라인·꺾은선이 없다
        expect(html).not.toContain('<polyline');
      }
    }
  });

  it('문구와 조건 라벨, 겉 색깔이 바뀌어도 안쪽은 검은색이다', () => {
    const on = { ...base, flashlight: 'on', object: 'bulb' };
    expect(lightNote(at(on, 2), sim(on).result)).toBe('2.0초 · 상자 안 밝기 9.0눈금 · 구멍으로 본 물체: 보임');
    expect(macro(on, at(on, 2))).toContain('2.0초 · 상자 안 밝기 9.0눈금 · 구멍으로 본 물체: 보임');
    const html = macro({ ...base, boxColor: 'white' }, null, false);
    expect(html).toContain('인형 · 손전등 끔');
    expect(html).toContain('흰 상자');
    expect(html).toContain('안쪽은 검은색');
    expect(html).toContain('data-fill="#f8fafc"');
    expect(macro(base, null, false)).toContain('data-fill="#1f2937"');
    expect(OBJECT_TEXT.bulb).toBe('켜진 작은 전구');
    expect(FLASHLIGHT_TEXT.on).toBe('손전등 켬');
    expect(BOX.w).toBeGreaterThan(0);
    expect([WINDOW.cx + WINDOW.r, HOLE_Y]).toEqual([220, 103]);
  });

  it('대조 변인: 상자 겉 색깔만 다르면 그림의 결과 부분(창, 밝기 글자)이 같다', () => {
    for (const v of CONDITIONS) {
      const other = { ...v, boxColor: v.boxColor === 'black' ? 'white' : 'black' };
      const strip = (html: string) => html.replace(/data-box="\w+"/, '').replace(/data-fill="[^"]+"/, '').replace(/fill="#(1f2937|f8fafc)"/, '').replace(/aria-label="[^"]*"/g, '').replace(/(검은|흰) 상자/g, '');
      expect(strip(macro(v, at(v, 2)))).toBe(strip(macro(other, at(other, 2))));
    }
  });

  it('SVG 글자는 모두 14 이상이고 안내 문구가 모든 조건에서 가드를 통과한다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 2));
      for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
      for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
    }
  });

  it('시작 샘플은 깜깜하다', () => {
    for (const v of CONDITIONS) expect(startSample(v)).toEqual({ t: 0, level: 0, seen: 0 });
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 안내 글자, 시행마다 막대가 생기고 값이 결과의 밝기 눈금이다', () => {
    const empty = renderToStaticMarkup(createElement(LightBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'light-bar')).toBe(0);
    expect(empty).toContain('실험하면 시행마다 막대가 생겨요.');
    const trials = [base, { ...base, flashlight: 'on' }, { ...base, object: 'bulb' }];
    const html = bars(trials, at(trials[2]!, 2));
    expect(count(html, 'light-bar')).toBe(3);
    expect([...html.matchAll(/data-testid="light-bar" data-trial="(\d+)" data-value="(\d+)"/g)].map((m) => [Number(m[1]) > 0, Number(m[2])])).toEqual([[true, 0], [true, 8], [true, 3]]);
    expect(html).toContain('시행 번호');
    expect(html).toContain('상자 안 밝기(눈금)');
  });

  it('막대는 최근 8개까지만 그리고, 높이는 0~10 눈금에 비례한다', () => {
    const list = Array.from({ length: 10 }, (_, i) => trialOf(CONDITIONS[i % CONDITIONS.length]!)) as never[];
    expect(trialBarsOf(list, undefined, 0, (r) => (r as { brightness: number }).brightness)).toHaveLength(BARS_MAX);
    expect(barsHeight(0)).toBe(0);
    expect(barsHeight(5) * 2).toBeCloseTo(barsHeight(10), 9);
    expect(barsHeight(99)).toBe(barsHeight(10));
  });
});
