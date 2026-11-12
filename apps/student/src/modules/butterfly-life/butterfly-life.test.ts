import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { BL_DAYS, BL_TIMES, simulateButterflyLife, type ButterflyLifeSample } from '@sci/engine-life';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { butterflyLifeModule } from './index';
import { SHAPE_TEXT, lifeNote, rulerCm } from './initial';
import { ButterflyMacroView, CAGE, RULER, mmX } from './ButterflyMacroView';
import { ButterflyRecordView, recordPoints } from './ButterflyRecordView';

const unit = UNITS.find((u) => u.id === 'g3-lifecycle')!;
if (!unit.ok) throw new Error('g3-lifecycle가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g3-lifecycle 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { day: number; time: string };
const base: V = { day: 1, time: 'morning' };
const CONDITIONS: V[] = BL_DAYS.flatMap((day) => BL_TIMES.map((time) => ({ day, time })));
const sim = (v: V) => butterflyLifeModule.simulate(v, experiment) as ReturnType<typeof simulateButterflyLife>;
const last = (v: V): ButterflyLifeSample => sim(v).samples.at(-1)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, ran = true) => renderToStaticMarkup(createElement(ButterflyMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot: ran ? last(v) : null, values: v, playhead: 0 }));
const record = (trials: V[], snapshot: ButterflyLifeSample | null, activeIndex = trials.length - 1) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(ButterflyRecordView, { experiment, trial: list[activeIndex] as never, snapshot, values: trials[activeIndex] ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const STAGE_NAMES = /애벌레|번데기|어른벌레|유충|성충|탈바꿈/;

describe('레지스트리', () => {
  it('g3-lifecycle 활동 2는 butterfly-life 모듈로 로드되고 첫 활동(germination)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['생물의 한살이', 3, 'life', ['4과04-01', '4과04-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'germination', 'germination'], ['variable', 'butterfly-life', 'butterfly-life']]);
    expect(unit.module.kind).toBe('germination');
    expect(activity.module).toBe(butterflyLifeModule);
    expect(MODULES['butterfly-life'].kind).toBe('butterfly-life');
    expect(experiment.safety).toEqual([]);
    expect(butterflyLifeModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['배추흰나비의 한살이 관찰 기록', '배추흰나비는 알에서 어른벌레가 되기까지 어떻게 변할까?', '예측: 몸 길이는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['day', '관찰한 날', 1], ['time', '관찰한 때', 'morning']]);
    expect(experiment.variables[0]!.options.map((o) => o.label)).toEqual(['1일째', '3일째', '6일째', '9일째', '12일째', '15일째', '18일째', '21일째', '24일째', '28일째', '30일째']);
    expect(experiment.variables[1]!.options.map((o) => [o.value, o.label])).toEqual([['morning', '아침'], ['evening', '저녁']]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['length', '몸 길이', 'mm'], ['eat', '먹이를 먹나요', ''], ['move', '움직이나요', ''], ['wings', '날개', '']]);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표(몸 길이 정수, 범주 셋)와 관찰한 때 무영향, 단계 이름 없음', () => {
    const cols = butterflyLifeModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['몸 길이(mm)', '먹이를 먹나요', '움직이나요', '날개']);
    const row = (v: V) => cols.map((c) => c.value(sim(v).result));
    expect(row({ day: 1, time: 'morning' })).toEqual(['1', '먹지 않음', '거의 움직이지 않음', '없음']);
    expect(row({ day: 9, time: 'evening' })).toEqual(['10', '먹음', '기어 다님', '없음']);
    expect(row({ day: 15, time: 'morning' })).toEqual(['28', '먹음', '기어 다님', '없음']);
    expect(row({ day: 21, time: 'morning' })).toEqual(['22', '먹지 않음', '거의 움직이지 않음', '없음']);
    expect(row({ day: 30, time: 'evening' })).toEqual(['20', '먹음', '날아다님', '있음']);
    for (const v of CONDITIONS) {
      expect(row(v).join(' ')).not.toMatch(STAGE_NAMES);
      expect(row(v)).toEqual(row({ ...v, time: v.time === 'morning' ? 'evening' : 'morning' }));
    }
  });

  it('센서: 가상 자(distance) 하나, 관찰한 날에 닿은 뒤의 몸 길이를 mm로 보여 주고 실험 전·도착 전에는 0이다', () => {
    const specs = butterflyLifeModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 자: 몸 길이', 'distance', 'mm']]);
    expect(specs[0]!.source).toBe(0);
    // 거리 센서는 cm로 읽으므로 source는 cm이고, display로 10배 해 mm(소수 없이)로 보여 준다.
    expect([specs[0]!.decimals, specs[0]!.display]).toEqual([0, { scale: 10, unitLabel: 'mm' }]);
    const v = { day: 15, time: 'morning' };
    expect(butterflyLifeModule.sensors(last(v), v)[0]!.source).toBeCloseTo(2.8, 9);
    expect(rulerCm(sim(v).samples[3]!)).toBe(0);
  });

  it('그래프 설정: y 0~30 mm, x 0~30일, 선 대신 관찰한 날의 표식, 재생이 끝나면 끝에 둔다', () => {
    const g = butterflyLifeModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series]).toEqual(['몸 길이(mm)', undefined, [0, 10, 20, 30], '관찰한 날(일째)', [0, 5, 10, 15, 20, 25, 30], undefined]);
    expect(butterflyLifeModule.restPlayhead).toBeUndefined();
    expect(butterflyLifeModule.metric.sampleKey).toBe('length');
    expect(butterflyLifeModule.metric.resultKey).toBe('length');
    const markers = g.markers as (e: unknown, t: unknown) => { t: number; label: string }[];
    for (const v of CONDITIONS) {
      expect(markers(experiment, trialOf(v))).toEqual([{ t: v.day, label: `${v.day}일째 · ${sim(v).result.length} mm` }]);
      expect(Math.max(...sim(v).samples.map((s) => s.t))).toBeLessThanOrEqual(30);
    }
  });

  it('예측 비교는 몸 길이: 날이 지나 길어지면 늘어남, 관찰한 때는 변하지 않음 (기준 0.5 mm)', () => {
    const m = butterflyLifeModule.metric;
    const len = (v: V) => sim(v).result[m.resultKey as 'length'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(len({ day: 1, time: 'morning' }), len({ day: 9, time: 'morning' }), th)).toBe('increase');
    expect(observedOutcome(len({ day: 15, time: 'morning' }), len({ day: 18, time: 'morning' }), th)).toBe('decrease');
    expect(observedOutcome(len({ day: 1, time: 'morning' }), len({ day: 3, time: 'morning' }), th)).toBe('same');
    for (const v of CONDITIONS) expect(observedOutcome(len(v), len({ ...v, time: v.time === 'morning' ? 'evening' : 'morning' }), th)).toBe('same');
  });

  it('그래프가 그려지고 축 라벨과 눈금, 관찰한 날의 표식이 있다. 관찰하지 않은 날은 선을 그리지 않는다', () => {
    const v = { day: 12, time: 'morning' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: butterflyLifeModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 12, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('몸 길이(mm)');
    expect(html).toContain('관찰한 날(일째)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '10', '20', '30']);
    expect(count(html, 'graph-marker')).toBe(1);
    expect(html).toContain('12일째 · 20 mm');
    // 관찰한 날의 점 하나뿐이라 기울어진 선이 없다: 선의 두 점이 같은 자리다.
    const pts = html.match(/<polyline points="([^"]+)"/)![1]!.split(' ');
    expect(new Set(pts).size).toBe(1);
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 몸(알·벌레·껍데기·나비)을 그리지 않고 빈 사육 상자와 자만 있다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, false);
      expect(count(html, 'creature')).toBe(0);
      expect(html).toContain('data-ran="false"');
      expect(html).toContain('실험하면 사육 상자 속 모습이 나타나요.');
      expect(count(html, 'ruler')).toBe(1);
      expect(html).not.toContain('mm ·');
      for (const t of Object.values(SHAPE_TEXT)) expect(html).not.toContain(t);
    }
  });

  it('실행하면 그 날 표에 맞는 모습이 한 가지만 나타난다', () => {
    const shapes = BL_DAYS.map((day) => {
      const html = macro({ day, time: 'morning' });
      expect(count(html, 'creature')).toBe(1);
      return html.match(/data-testid="creature" data-shape="(\w+)"/)![1];
    });
    expect(shapes).toEqual(['egg', 'egg', 'small', 'larva', 'larva', 'big', 'shell', 'shell', 'shell', 'adult', 'adult']);
  });

  it('껍데기는 날이 갈수록 옅은 색이고, 몸 길이는 자의 눈금 폭과 같게 그린다', () => {
    const fills = [18, 21, 24].map((day) => macro({ day, time: 'morning' }).match(/data-shape="shell" data-fill="(#[0-9a-f]+)"/)![1]);
    expect(new Set(fills).size).toBe(3);
    // 28 mm 큰 벌레: 몸통 폭 = 28 mm × 눈금 폭
    const big = macro({ day: 15, time: 'morning' });
    expect(big).toContain(`width="${(28 * RULER.perMm).toString()}"`);
    expect(mmX(30)).toBeLessThan(RULER.right);
    expect(CAGE.y + CAGE.h).toBeGreaterThan(RULER.y + RULER.h);
  });

  it('아침과 저녁은 사육 상자 바탕색과 라벨만 다르고 몸 그림은 같다 (대조 변인)', () => {
    for (const day of BL_DAYS) {
      const a = macro({ day, time: 'morning' });
      const b = macro({ day, time: 'evening' });
      expect(a).not.toBe(b);
      const strip = (html: string) => html.replace(/data-time="\w+"/, '').replace(/data-fill="#(fef9c3|c7d2fe)"/, '').replace(/fill="#(fef9c3|c7d2fe)"/, '').replace(/aria-label="[^"]*"/g, '').replace(/(아침|저녁)/g, '');
      expect(strip(a)).toBe(strip(b));
    }
    expect(macro(base)).toContain('1일째 · 아침');
    expect(macro({ day: 30, time: 'evening' })).toContain('30일째 · 저녁');
  });

  it('단계 이름을 화면 글자와 접근성 이름에 쓰지 않는다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      for (const ran of [false, true]) expect(shownText(macro(v, ran)).join('\n')).not.toMatch(STAGE_NAMES);
      expect(shownText(record([v], last(v))).join('\n')).not.toMatch(STAGE_NAMES);
    }
  });

  it('문구: 실행 뒤 한 줄 요약과 교실 안내 한 줄(매니페스트 note)', () => {
    const v = { day: 28, time: 'morning' };
    expect(lifeNote(28, sim(v).result)).toBe('28일째 · 몸 길이 20 mm · 먹이: 먹음 · 움직임: 날아다님 · 날개: 있음');
    expect(macro(v)).toContain('28일째 · 몸 길이 20 mm · 먹이: 먹음 · 움직임: 날아다님 · 날개: 있음');
    // 교실 안내 한 줄은 눈으로 보기 그림이 아니라 매니페스트의 note(탐구 질문 아래)다.
    expect(experiment.note).toBe('교실에서 기르는 배추흰나비와 함께 보며 기록해요.');
    expect(macro(v, false)).not.toContain('교실에서 기르는');
    expect(macro(v)).not.toContain('교실에서 기르는');
    expect((unit.activities[0]!.experiment as { note?: string }).note).toBeUndefined();
  });

  it('SVG 글자는 모두 14 이상이고 안내 문구가 모든 조건에서 가드를 통과한다', () => {
    for (const v of CONDITIONS) {
      for (const html of [macro(v), record([v], last(v))]) {
        for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
        for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
      }
    }
  });
});

describe('관찰 기록 그래프', () => {
  it('시행이 없으면 안내 글자, 관찰한 날마다 점이 하나씩 생기고 값이 결과의 몸 길이이며 날 순서로 이어진다', () => {
    const empty = renderToStaticMarkup(createElement(ButterflyRecordView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'life-dot')).toBe(0);
    expect(empty).toContain('실험하면 관찰한 날의 점이 찍혀요.');
    const trials: V[] = [{ day: 15, time: 'morning' }, { day: 3, time: 'morning' }, { day: 21, time: 'evening' }];
    const html = record(trials, last(trials[2]!));
    expect(count(html, 'life-dot')).toBe(3);
    expect([...html.matchAll(/data-testid="life-dot" data-day="(\d+)" data-value="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])])).toEqual([[3, 1], [15, 28], [21, 22]]);
    expect(count(html, 'life-line')).toBe(1);
    expect(html).toContain('관찰한 날(일째)');
    expect(html).toContain('몸 길이(mm)');
  });

  it('관찰하지 않은 날은 그리지 않는다: 점은 시행의 날에만 있고, 같은 날은 점 하나로 모은다', () => {
    const trials: V[] = [{ day: 6, time: 'morning' }, { day: 6, time: 'evening' }, { day: 28, time: 'morning' }];
    const pts = recordPoints(trials.map(trialOf) as never, undefined, null);
    expect(pts.map((p) => [p.day, p.length])).toEqual([[6, 3], [28, 20]]);
    const single = record([{ day: 9, time: 'morning' }], last({ day: 9, time: 'morning' }));
    expect(count(single, 'life-line')).toBe(0);
  });

  it('지금 재생 중인 시행은 관찰한 날에 닿은 뒤에만 점을 찍는다', () => {
    const v = { day: 12, time: 'morning' };
    const early = sim(v).samples[5]!;
    expect(count(record([v], early), 'life-dot')).toBe(0);
    expect(count(record([v], last(v)), 'life-dot')).toBe(1);
  });
});
