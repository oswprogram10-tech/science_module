import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { MC_FOCUS, MC_LABELS, MC_POWERS, MC_SAMPLES, MC_STAINS, type MicroscopeSample } from '@sci/engine-life';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { microscopeCellsModule } from './index';
import { MICROSCOPE_NOTE_EMPTY, microscopeNote, sizeText, startSample } from './initial';
import { MicroscopeMacroView, PX_PER_MM, cellLengthPx } from './MicroscopeMacroView';
import { MicroscopeBarsView } from './MicroscopeBarsView';
import { BARS_MAX, barsHeight, trialBarsOf } from '../TrialBars';

const unit = UNITS.find((u) => u.id === 'g6-plant')!;
if (!unit.ok) throw new Error('g6-plant가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g6-plant 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { power: number; focus: string; stain: string; sample: string; slideLabel: string };
const base: V = { power: 40, focus: 'off', stain: 'none', sample: 'onion', slideLabel: 'yellow' };
const sharp: V = { ...base, focus: 'on' };
const CONDITIONS: V[] = MC_POWERS.flatMap((power) => MC_FOCUS.flatMap((focus) => MC_STAINS.flatMap((stain) => MC_SAMPLES.flatMap((sample) => MC_LABELS.map((slideLabel) => ({ power, focus, stain, sample, slideLabel }))))));
const sim = (v: V) => microscopeCellsModule.simulate(v, experiment);
const at = (v: V, t: number): MicroscopeSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: MicroscopeSample | null, ran = true) => renderToStaticMarkup(createElement(MicroscopeMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: V[], snapshot: MicroscopeSample | null) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(MicroscopeBarsView, { experiment, trial: list.at(-1) as never, snapshot, values: trials.at(-1) ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.5, 1, 1.5, 2];

describe('레지스트리', () => {
  it('g6-plant 활동 2는 microscope-cells 모듈로 로드되고 첫 활동(transpiration)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['식물의 구조와 기능', 6, 'life', ['6과11-01', '6과11-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'transpiration', 'transpiration'], ['variable', 'microscope-cells', 'microscope-cells']]);
    expect(unit.module.kind).toBe('transpiration');
    expect(activity.module).toBe(microscopeCellsModule);
    expect(MODULES['microscope-cells'].kind).toBe('microscope-cells');
    expect(experiment.safety).toEqual([]);
    expect(microscopeCellsModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구, 안내 한 줄과 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt, experiment.note]).toEqual(['현미경으로 세포 관찰하기', '양파 껍질을 현미경으로 보면 무엇이 보일까?', '예측: 화면에서 본 칸 하나의 크기는?', '실제 현미경으로 보기 전에 연습해 보세요.']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['power', '배율', 40], ['focus', '초점', 'off'], ['stain', '염색', 'none'], ['sample', '관찰 재료', 'onion'], ['slideLabel', '받침 유리 이름표 색', 'yellow']]);
    expect(experiment.variables.map((v) => v.options.map((o) => o.label))).toEqual([['40배', '100배', '400배'], ['맞추지 않음', '맞춤'], ['하지 않음', '아이오딘 용액으로 함'], ['양파 표피', '입안 안쪽 표피'], ['노란색', '초록색']]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['size', '화면에서 본 칸 하나의 길이', 'mm'], ['seen', '보인 것', '']]);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 칸 길이(정수 mm, 초점이 맞지 않으면 "—")와 보인 것(범주)', () => {
    const cols = microscopeCellsModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['화면에서 본 칸 하나의 길이(mm)', '보인 것']);
    const row = (v: V) => cols.map((c) => c.value(sim(v).result));
    expect(row(base)).toEqual(['—', '흐릿함']);
    expect(row(sharp)).toEqual(['10', '투명한 칸들']);
    expect(row({ ...sharp, power: 400 })).toEqual(['100', '투명한 칸들']);
    expect(row({ ...sharp, sample: 'cheek', power: 400 })).toEqual(['24', '투명한 칸들']);
    expect(row({ ...sharp, stain: 'iodine' })).toEqual(['10', '색이 든 칸들']);
    expect(row({ ...sharp, stain: 'iodine', power: 100 })).toEqual(['25', '칸마다 진한 점이 있음']);
    expect(sizeText(Number.NaN)).toBe('—');
    expect(sizeText(24)).toBe('24');
  });

  it('센서: 가상 눈금자(distance), 시야의 칸 길이를 mm로 보여 주고 칸이 보이지 않거나 실험 전에는 0이다', () => {
    const specs = microscopeCellsModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit, s.display, s.decimals])).toEqual([['가상 눈금자: 시야의 칸 길이', 'distance', 'mm', { scale: 10, unitLabel: 'mm' }, 0]]);
    expect(specs[0]!.source).toBe(0);
    expect(microscopeCellsModule.sensors(at(base, 2), base)[0]!.source).toBe(0);
    expect(microscopeCellsModule.sensors(at({ ...sharp, power: 400 }, 2), sharp)[0]!.source).toBeCloseTo(10, 9);
  });

  it('그래프 설정: y 0~110 고정, x 0~2초, 선 하나, 칸이 보이지 않으면 안내 글자', () => {
    const g = microscopeCellsModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers, g.emptyText]).toEqual(['화면에서 본 칸 하나의 길이(mm)', undefined, [0, 55, 110], '시간(초)', [0, 1, 2], undefined, undefined, '초점이 맞지 않아 칸이 보이지 않아요']);
    expect(microscopeCellsModule.restPlayhead).toBeUndefined();
    expect([microscopeCellsModule.metric.sampleKey, microscopeCellsModule.metric.resultKey]).toEqual(['size', 'size']);
    for (const v of CONDITIONS.filter((c) => c.focus === 'on')) expect(Math.max(...sim(v).samples.map((x) => x.size))).toBeLessThanOrEqual(110);
  });

  it('예측 비교는 칸 길이(기준 0.5 mm, 보이지 않으면 0): 배율을 높이면 늘어남, 초점을 맞추면 늘어남, 이름표 색은 변하지 않음', () => {
    const th = microscopeCellsModule.metric.sampleKey && microscopeCellsModule.metric.sameThreshold(experiment);
    expect(th).toBe(0.5);
    const size = (v: V) => sim(v).result.size;
    expect(observedOutcome(size(sharp), size({ ...sharp, power: 100 }), th)).toBe('increase');
    expect(observedOutcome(size({ ...sharp, power: 100 }), size(sharp), th)).toBe('decrease');
    expect(observedOutcome(size(base), size(sharp), th)).toBe('increase');
    expect(observedOutcome(size(sharp), size(base), th)).toBe('decrease');
    expect(observedOutcome(size(base), size({ ...base, power: 400 }), th)).toBe('same');
    expect(observedOutcome(size(sharp), size({ ...sharp, stain: 'iodine' }), th)).toBe('same');
    for (const v of CONDITIONS) expect(observedOutcome(size(v), size({ ...v, slideLabel: v.slideLabel === 'yellow' ? 'green' : 'yellow' }), th)).toBe('same');
    // 입안 칸이 양파 칸보다 짧다.
    expect(observedOutcome(size(sharp), size({ ...sharp, sample: 'cheek' }), th)).toBe('decrease');
  });

  it('그래프: 초점을 맞춘 시행은 선 하나와 y축 0, 55, 110, 맞추지 않은 시행은 선 없이 안내 글자만 쓴다', () => {
    const render = (v: V) => renderToStaticMarkup(createElement(GraphView, { module: microscopeCellsModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    const html = render({ ...sharp, power: 400 });
    expect(html).toContain('화면에서 본 칸 하나의 길이(mm)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '55', '110']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
    expect(html).not.toContain('graph-empty');
    const empty = render(base);
    expect(empty).not.toContain('<polyline');
    expect(empty).toContain('data-testid="graph-empty"');
    expect(empty).toContain('초점이 맞지 않아 칸이 보이지 않아요');
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 시야를 비운다(점선 둥근 틀만): 칸 무늬·결과 글자가 없다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html).toContain('data-state="empty"');
      expect(count(html, 'field-cells')).toBe(0);
      expect(html).not.toContain('url(#mc-cells)');
      expect(html).toContain(MICROSCOPE_NOTE_EMPTY);
      expect(shownText(html).some((t) => t.includes('보인 것:'))).toBe(false);
      // 현미경 옆모습은 실행 전에도 보인다.
      expect(count(html, 'microscope')).toBe(1);
      expect(html).toContain(`data-power="${v.power}"`);
    }
  });

  it('실행하면 시야에 칸 무늬가 나타나고, 초점이 맞지 않으면 흐림 필터가 걸린다', () => {
    const blurred = macro(base, at(base, 2));
    expect(blurred).toContain('data-state="seen"');
    expect(count(blurred, 'field-cells')).toBe(1);
    expect(blurred).toContain('filter="url(#mc-blur)"');
    expect(blurred).toContain('data-sharp="0.00"');
    const focused = macro(sharp, at(sharp, 2));
    expect(focused).toContain('data-sharp="1.00"');
    expect(focused).not.toContain('filter="url(#mc-blur)"');
    // 초점을 맞추는 중에는 점점 또렷해진다(흐림 정도가 줄어든다).
    const blur = (html: string) => Number(/feGaussianBlur stdDeviation="([\d.]+)"/.exec(html)![1]);
    expect(blur(macro(sharp, at(sharp, 0.5)))).toBeLessThan(blur(macro(sharp, at(sharp, 0))));
  });

  it('양파는 길쭉한 벽돌 모양, 입안은 둥글고 불규칙한 칸이 흩어진 무늬이고 배율이 클수록 칸이 크게 그려진다', () => {
    expect(macro(sharp, at(sharp, 2))).toContain('data-sample="onion"');
    const onion = macro(sharp, at(sharp, 2));
    const cheek = macro({ ...sharp, sample: 'cheek' }, at({ ...sharp, sample: 'cheek' }, 2));
    expect(onion).toMatch(/<pattern id="mc-cells"[^>]*><rect[^>]*><\/rect><g[^>]*><line/);
    expect(cheek).toMatch(/<pattern id="mc-cells"[^>]*><g><circle/);
    expect(cellLengthPx('onion', 100)).toBeGreaterThan(cellLengthPx('onion', 40));
    expect(cellLengthPx('onion', 400)).toBeGreaterThan(cellLengthPx('onion', 100));
    expect(cellLengthPx('onion', 100)).toBeGreaterThan(cellLengthPx('cheek', 100));
    expect(cellLengthPx('onion', 400)).toBeCloseTo(100 * PX_PER_MM, 9);
    const width = (html: string) => Number(/<pattern id="mc-cells"[^>]*width="([\d.]+)"/.exec(html)![1]);
    expect(width(macro({ ...sharp, power: 400 }, at({ ...sharp, power: 400 }, 2)))).toBeGreaterThan(width(macro({ ...sharp, power: 100 }, at({ ...sharp, power: 100 }, 2))));
  });

  it('염색하면 칸 경계와 점이 진해진다: 100·400배에서만 진한 점(circle)이 있다', () => {
    const dots = (v: V) => (macro(v, at(v, 2)).match(/<circle/g) ?? []).length;
    const plain = dots(sharp);
    expect(dots({ ...sharp, stain: 'iodine' })).toBe(plain); // 40배: 색만 든다(점 없음)
    expect(dots({ ...sharp, stain: 'iodine', power: 100 })).toBeGreaterThan(dots({ ...sharp, power: 100 }));
    expect(dots({ ...sharp, stain: 'iodine', power: 400, sample: 'cheek' })).toBeGreaterThan(dots({ ...sharp, power: 400, sample: 'cheek' }));
    const stained = macro({ ...sharp, stain: 'iodine' }, at({ ...sharp, stain: 'iodine' }, 2));
    expect(stained).toContain('stroke="#92400e"');
    expect(macro(sharp, at(sharp, 2))).not.toContain('stroke="#92400e"');
  });

  it('초점을 맞추면 경통이 내려오고, 받침 유리 이름표 색이 그림에 나타난다', () => {
    expect(macro(base, null, false)).toContain('data-focus="off"');
    expect(macro(base, null, false)).toContain('translate(0 -10)');
    expect(macro(sharp, null, false)).toContain('data-focus="on"');
    expect(macro(sharp, null, false)).toContain('translate(0 0)');
    expect(macro(base, null, false)).toContain('data-color="yellow"');
    expect(macro({ ...base, slideLabel: 'green' }, null, false)).toContain('data-color="green"');
    expect(count(macro(base, null, false), 'coarse-knob')).toBe(1);
  });

  it('그림 안에 글자가 없다(<text> 없음) — 모든 조건', () => {
    for (const v of CONDITIONS) expect(macro(v, at(v, 2))).not.toMatch(/<text/);
  });

  it('안내 문구가 모든 조건에서 가드를 통과하고 NaN·null 글자가 없다', () => {
    const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };
    for (const v of CONDITIONS) for (const t of TIMES) {
      for (const text of shownText(macro(v, at(v, t)))) {
        expect(guardOutput(text, guard).ok, text).toBe(true);
        expect(text).not.toMatch(/NaN|null|undefined/);
      }
    }
  });

  it('문구: 칸이 보이지 않으면 길이를 "—"로 쓴다', () => {
    expect(microscopeNote(at(base, 2), sim(base).result)).toBe('2.0초 · 칸 하나의 길이 —mm · 보인 것: 흐릿함');
    expect(microscopeNote(at({ ...sharp, power: 100 }, 2), sim({ ...sharp, power: 100 }).result)).toBe('2.0초 · 칸 하나의 길이 25.0mm · 보인 것: 투명한 칸들');
  });

  it('시작 샘플은 칸 길이 0(초점을 맞추면)이거나 값 없음이다', () => {
    for (const v of CONDITIONS) {
      const s = startSample(v);
      expect(s.t).toBe(0);
      expect(s.sharp).toBe(0);
      if (v.focus === 'on') expect(s.size).toBe(0);
      else expect(s.size).toBeNaN();
    }
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 안내 글자, 시행마다 막대가 생기고 칸이 보이지 않은 시행은 막대 없이 "—"이다', () => {
    const empty = renderToStaticMarkup(createElement(MicroscopeBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'cell-bar')).toBe(0);
    expect(empty).toContain('실험하면 시행마다 막대가 생겨요.');
    const trials = [base, sharp, { ...sharp, power: 400 }];
    const html = bars(trials, at(trials[2]!, 2));
    expect(count(html, 'cell-bar')).toBe(3);
    expect([...html.matchAll(/data-testid="cell-bar" data-trial="(\d+)" data-value="(\w+)"/g)].map((m) => m[2])).toEqual(['none', '10', '100']);
    // 막대(rect)는 값이 있는 시행만 그린다(바깥 틀 rect 하나 + 막대 둘).
    expect((html.match(/<rect/g) ?? []).length).toBe(3);
    expect(html).toContain('시행 번호');
    expect(html).toContain('칸 하나의 길이(mm)');
    expect(html).toMatch(/\d+번 값 없음, \d+번 10mm, \d+번 100mm/);
    expect(html).not.toMatch(/NaN/);
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1]);
    for (const t of ['0', '50', '100', '—', '10']) expect(texts).toContain(t);
  });

  it('높이는 0~110 mm에 비례하고 값이 없으면 0이며, 막대는 최근 8개까지만 그린다', () => {
    expect(barsHeight(0, 110)).toBe(0);
    expect(barsHeight(55, 110) * 2).toBeCloseTo(barsHeight(110, 110), 9);
    expect(barsHeight(999, 110)).toBe(barsHeight(110, 110));
    expect(barsHeight(Number.NaN, 110)).toBe(0);
    const list = Array.from({ length: 10 }, (_, i) => trialOf(CONDITIONS[i % CONDITIONS.length]!)) as never[];
    expect(trialBarsOf(list, undefined, 0, (r) => (r as { size: number }).size)).toHaveLength(BARS_MAX);
  });

  it('SVG 글자는 모두 14 이상이다', () => {
    const html = bars([base, sharp], at(sharp, 2));
    for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
  });
});
