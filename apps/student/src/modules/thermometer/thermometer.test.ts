import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { TH_EYES, TH_HANDS, TH_TARGETS, TH_TOOLS, simulateThermometer, type ThermometerSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { thermometerModule } from './index';
import { EYE_TEXT, HAND_TEXT, TARGET_TEXT, TOOL_TEXT, startSample, thermometerNote } from './initial';
import { ThermometerMacroView, columnTop, eyeY } from './ThermometerMacroView';
import { ThermometerBarsView } from './ThermometerBarsView';

const unit = UNITS.find((u) => u.id === 'g5-heat')!;
if (!unit.ok) throw new Error('g5-heat가 없어요');
const activity = unit.activities[2]!;
if (activity.activity !== 'variable') throw new Error('g5-heat 활동 3이 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { hand: string; target: string; tool: string; eye: string };
const base: V = { hand: 'none', target: 'water', tool: 'alcohol', eye: 'level' };
const CONDITIONS: V[] = TH_HANDS.flatMap((hand) => TH_TARGETS.flatMap((target) => TH_TOOLS.flatMap((tool) => TH_EYES.map((eye) => ({ hand, target, tool, eye })))));
const sim = (v: V) => thermometerModule.simulate(v, experiment) as ReturnType<typeof simulateThermometer>;
const at = (v: V, t: number): ThermometerSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: ThermometerSample | null, ran = true) => renderToStaticMarkup(createElement(ThermometerMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: V[], snapshot: ThermometerSample | null) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(ThermometerBarsView, { experiment, trial: list.at(-1) as never, snapshot, values: trials.at(-1) ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const eyeYOf = (html: string) => Number(/data-testid="eye" data-eye="\w+" data-y="([\d.]+)"/.exec(html)![1]);

describe('레지스트리', () => {
  it('g5-heat 활동 3은 thermometer 모듈로 로드되고 앞의 두 활동은 그대로다', () => {
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'insulated-cup', 'insulated-cup'], ['variable', 'heat-contact', 'heat-contact'], ['variable', 'thermometer', 'thermometer'], ['variable', 'heat-transfer', 'heat-transfer']]);
    expect(unit.module.kind).toBe('insulated-cup');
    expect(activity.module).toBe(thermometerModule);
    expect(MODULES.thermometer.kind).toBe('thermometer');
    expect(experiment.safety).toEqual([]);
    expect(thermometerModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['온도계로 온도 재기', '손으로 느끼는 따뜻함과 온도계로 잰 온도는 같을까?', '예측: 온도계 눈금은?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['hand', '먼저 손을 넣었던 물', 'none'], ['target', '재는 것', 'water'], ['tool', '온도계', 'alcohol'], ['eye', '눈금을 읽은 눈높이', 'level']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['none', '넣지 않음'], ['cold', '찬물(10 °C)'], ['warm', '따뜻한 물(40 °C)']],
      [['water', '미지근한 물'], ['rod', '같은 방의 철봉'], ['wood', '같은 방의 나무 판']],
      [['alcohol', '알코올 온도계'], ['ir', '적외선 온도계']],
      [['above', '위에서'], ['level', '액체 끝과 같은 높이'], ['below', '아래에서']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['reading', '온도계 눈금', '°C'], ['feel', '손 느낌', '']]);
    // 화면 글자 표는 매니페스트 선택지 이름과 같다.
    expect(TH_HANDS.map((h) => HAND_TEXT[h])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(TH_TARGETS.map((h) => TARGET_TEXT[h])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(TH_TOOLS.map((h) => TOOL_TEXT[h])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
    expect(TH_EYES.map((h) => EYE_TEXT[h])).toEqual(experiment.variables[3]!.options.map((o) => o.label));
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 온도계 눈금(정수)과 손 느낌(범주)', () => {
    const cols = thermometerModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['온도계 눈금(°C)', '손 느낌']);
    const row = (v: V) => cols.map((c) => c.value(sim(v).result));
    expect(row(base)).toEqual(['25', '미지근하게 느껴짐']);
    expect(row({ ...base, target: 'rod' })).toEqual(['22', '차갑게 느껴짐']);
    expect(row({ ...base, target: 'wood' })).toEqual(['22', '미지근하게 느껴짐']);
    expect(row({ ...base, hand: 'cold' })).toEqual(['25', '따뜻하게 느껴짐']);
    expect(row({ ...base, hand: 'warm' })).toEqual(['25', '차갑게 느껴짐']);
    expect(row({ ...base, eye: 'above' })).toEqual(['26', '미지근하게 느껴짐']);
    expect(row({ ...base, eye: 'below' })).toEqual(['24', '미지근하게 느껴짐']);
    expect(row({ ...base, tool: 'ir', eye: 'below' })).toEqual(['25', '미지근하게 느껴짐']);
  });

  it('센서: 가상 온도계(temperature) 하나, 재는 것의 실제 온도를 정수로 보여 주고 실험 전에는 20 °C이다', () => {
    const specs = thermometerModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit, s.decimals])).toEqual([['가상 온도계', 'temperature', '°C', 0]]);
    expect(specs[0]!.source).toBe(20);
    // 눈높이는 센서값에 영향이 없다.
    for (const eye of TH_EYES) expect(thermometerModule.sensors(at({ ...base, eye }, 2), { ...base, eye })[0]!.source).toBeCloseTo(25, 9);
  });

  it('그래프 설정: y 0~40 °C 고정, x 0~2초, 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = thermometerModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['온도계 눈금(°C)', undefined, [0, 10, 20, 30, 40], '시간(초)', [0, 1, 2], undefined, undefined]);
    expect(thermometerModule.restPlayhead).toBeUndefined();
    expect([thermometerModule.metric.sampleKey, thermometerModule.metric.resultKey]).toEqual(['level', 'reading']);
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.level))).toBeLessThanOrEqual(40);
      expect(s.at(-1)!.t).toBe(2);
    }
  });

  it('예측 비교는 온도계 눈금(°C): 눈높이는 알코올 온도계에서만 바뀌고(위에서 +1), 손 느낌은 눈금을 바꾸지 않음', () => {
    const m = thermometerModule.metric;
    const reading = (v: V) => sim(v).result[m.resultKey as 'reading'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(reading(base), reading({ ...base, eye: 'above' }), th)).toBe('increase');
    expect(observedOutcome(reading(base), reading({ ...base, eye: 'below' }), th)).toBe('decrease');
    expect(observedOutcome(reading(base), reading({ ...base, target: 'rod' }), th)).toBe('decrease');
    expect(observedOutcome(reading(base), reading({ ...base, hand: 'cold' }), th)).toBe('same');
    expect(observedOutcome(reading({ ...base, tool: 'ir' }), reading({ ...base, tool: 'ir', eye: 'above' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: thermometerModule as never, experiment, trial: trialOf(base), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('온도계 눈금(°C)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '10', '20', '30', '40']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 손 느낌 얼굴과 읽은 값 문구를 그리지 않는다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(count(html, 'feel-face')).toBe(0);
      expect(html).not.toContain('느껴짐');
      expect(html).not.toContain('손 느낌:');
      expect(html).toContain('실험하면 온도계 눈금과 손 느낌이 나타나요.');
      if (v.tool === 'ir') expect(html).toContain('>--<');
      expect(html).toContain('data-level="20.00"');
    }
  });

  it('실행하면 손 느낌 얼굴(글자 없음)이 손 위에 나타나고 표정이 느낌과 맞다', () => {
    const feelOf = (v: V) => /data-testid="feel-face" data-feel="(\w+)"/.exec(macro(v, at(v, 2)))![1];
    expect(feelOf(base)).toBe('lukewarm');
    expect(feelOf({ ...base, target: 'rod' })).toBe('cold');
    expect(feelOf({ ...base, hand: 'cold' })).toBe('warm');
    expect(feelOf({ ...base, hand: 'warm', target: 'wood' })).toBe('cold');
    const html = macro(base, at(base, 2));
    expect(count(html, 'feel-face')).toBe(1);
    // 얼굴 안에는 글자가 없다.
    expect(/<g data-testid="feel-face"[^>]*>(?:(?!<\/g>).)*<text/.test(html)).toBe(false);
  });

  it('눈높이는 알코올 온도계에서만 그린다: 눈이 기둥 끝보다 위·같은 높이·아래에 있고, 적외선 온도계에는 눈이 없다', () => {
    for (const target of TH_TARGETS) {
      const top = (eye: string) => eyeYOf(macro({ ...base, target, eye }, at({ ...base, target, eye }, 2)));
      const col = columnTop(sim({ ...base, target }).samples.at(-1)!.level);
      expect(top('level')).toBeCloseTo(col, 0);
      expect(top('above')).toBeLessThan(top('level'));
      expect(top('below')).toBeGreaterThan(top('level'));
    }
    const ir = macro({ ...base, tool: 'ir' }, at({ ...base, tool: 'ir' }, 2));
    expect(count(ir, 'eye')).toBe(0);
    expect(count(ir, 'alcohol-thermo')).toBe(0);
    expect(count(ir, 'ir-thermo')).toBe(1);
    expect(ir).toContain('25 °C');
    expect(eyeY('above', 25)).toBeLessThan(eyeY('level', 25));
    expect(count(macro(base, null, false), 'ir-thermo')).toBe(0);
  });

  it('알코올 기둥의 높이는 읽은 값(눈높이 +1/−1)이 아니라 눈금 값을 따른다: 위에서 읽으면 더 높은 눈금으로 그린다', () => {
    expect(columnTop(26)).toBeLessThan(columnTop(25));
    expect(columnTop(24)).toBeGreaterThan(columnTop(25));
    expect(macro({ ...base, eye: 'above' }, at({ ...base, eye: 'above' }, 2))).toContain('data-level="26.00"');
    expect(macro({ ...base, eye: 'below' }, at({ ...base, eye: 'below' }, 2))).toContain('data-level="24.00"');
  });

  it('먼저 넣었던 물이 있으면 작은 컵 그림이 보이고, 문구와 조건 라벨이 나온다', () => {
    expect(count(macro({ ...base, hand: 'cold' }, null, false), 'prior-cup')).toBe(1);
    expect(count(macro(base, null, false), 'prior-cup')).toBe(0);
    const v = { ...base, hand: 'warm', target: 'rod' };
    expect(thermometerNote(at(v, 2), sim(v).result)).toBe('2.0초 · 온도계 눈금 22.0 °C · 손 느낌: 차갑게 느껴짐');
    expect(macro(v, at(v, 2))).toContain('2.0초 · 온도계 눈금 22.0 °C · 손 느낌: 차갑게 느껴짐');
    const html = macro(v, null, false);
    expect(html).toContain('같은 방의 철봉');
    expect(html).toContain('먼저 넣은 물: 따뜻한 물(40 °C)');
    expect(html).toContain('알코올 온도계 · 눈높이 같은 높이');
    expect(macro({ ...base, tool: 'ir' }, null, false)).toContain('적외선 온도계 · 숫자 화면');
    expect(startSample(v)).toEqual({ t: 0, level: 20, trueC: 20, felt: 0 });
  });

  it('SVG 글자는 모두 14 이상이고 모든 조건에서 안내 문구가 가드를 통과한다(실행 전·후)', () => {
    for (const v of CONDITIONS) {
      for (const html of [macro(v, null, false), macro(v, at(v, 2))]) {
        for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
        for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
        expect(html).not.toContain('NaN');
      }
    }
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 안내 글자, 시행마다 막대가 생기고 값이 결과의 온도계 눈금(°C)이다', () => {
    const empty = renderToStaticMarkup(createElement(ThermometerBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'thermo-bar')).toBe(0);
    expect(empty).toContain('실험하면 시행마다 막대가 생겨요.');
    const trials = [base, { ...base, target: 'rod' }, { ...base, eye: 'above' }];
    const html = bars(trials, at(trials[2]!, 2));
    expect(count(html, 'thermo-bar')).toBe(3);
    expect([...html.matchAll(/data-testid="thermo-bar" data-trial="(\d+)" data-value="(\d+)"/g)].map((m) => Number(m[2]))).toEqual([25, 22, 26]);
    expect(html).toContain('시행 번호');
    expect(html).toContain('온도계 눈금(°C)');
    for (const tick of ['0', '10', '20', '30', '40']) expect(html).toContain(`>${tick}<`);
  });
});
