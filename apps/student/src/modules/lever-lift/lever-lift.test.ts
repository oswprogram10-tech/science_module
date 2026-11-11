import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { LIFT_ARMS, LIFT_COLORS, LIFT_TOOLS, simulateLeverLift, type LeverLiftSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { leverLiftModule } from './index';
import { ARM_TEXT, COLOR_TEXT, TOOL_TEXT, armLine, liftNote, startSample } from './initial';
import { GROUND_Y, LiftMacroView, W as MACRO_W, leverAngle, leverPoint, rampBase, rampPoint } from './LiftMacroView';
import { LiftBarsView, barLength } from './LiftBarsView';

const unit = UNITS.find((u) => u.id === 'g3-force')!;
if (!unit.ok) throw new Error('g3-force가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g3-force 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { tool: string; armCm: string; color: string };
const base: V = { tool: 'none', armCm: 'short', color: 'red' };
const CONDITIONS: V[] = LIFT_TOOLS.flatMap((tool) => LIFT_ARMS.flatMap((armCm) => LIFT_COLORS.map((color) => ({ tool, armCm, color }))));
const sim = (v: V) => leverLiftModule.simulate(v, experiment) as ReturnType<typeof simulateLeverLift>;
const at = (v: V, t: number): LeverLiftSample => sim(v).samples.find((s) => s.t === t)!;
const end = (v: V): LeverLiftSample => sim(v).samples.at(-1)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: LeverLiftSample | null, ran = true) => renderToStaticMarkup(createElement(LiftMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (v: V, snapshot: LeverLiftSample | null, ran = true) => renderToStaticMarkup(createElement(LiftBarsView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
/** 화면에 보이는 글자: 태그 밖의 글과 aria-label 값 */
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
/** 한 시행에서 눈에 보이는 시각들: 처음, 중간, 끝 */
const frames = (v: V): LeverLiftSample[] => {
  const pull = sim(v).result.pullCm;
  return [0, Math.floor(pull / 2), pull].map((t) => at(v, t));
};

describe('레지스트리', () => {
  it('g3-force 활동 2는 lever-lift 모듈로 로드되고 첫 활동(lever-balance)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['힘과 우리 생활', 3, 'physics', ['4과01-02', '4과01-04']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'lever-balance', 'lever-balance'], ['variable', 'lever-lift', 'lever-lift']]);
    expect(unit.module.kind).toBe('lever-balance');
    expect(activity.module).toBe(leverLiftModule);
    expect(MODULES['lever-lift'].kind).toBe('lever-lift');
    expect(experiment.safety).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['지레와 빗면으로 들어 올리기', '도구를 쓰면 물체를 들어 올리는 힘이 어떻게 달라질까?', '예측: 용수철저울의 눈금은?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['tool', '쓰는 도구', 'none'], ['armCm', '힘을 주는 쪽 길이', 'short'], ['color', '물체 색깔', 'red']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['none', '도구 없이'], ['lever', '지레'], ['ramp', '빗면']],
      [['short', '짧게'], ['mid', '중간'], ['long', '길게']],
      [['red', '빨간 상자'], ['blue', '파란 상자']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['force', '용수철저울 눈금', 'g'], ['pullCm', '손으로 당긴 거리', 'cm']]);
    expect(experiment.limits).toEqual(['일의 원리', '에너지', '돌림힘', '모멘트', '마찰력', '뉴턴']);
    // 화면 글자 표는 매니페스트의 선택지 이름과 같다.
    expect(LIFT_TOOLS.map((t) => TOOL_TEXT[t])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(LIFT_ARMS.map((a) => ARM_TEXT[a])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(LIFT_COLORS.map((c) => COLOR_TEXT[c])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
  });

  it('모듈 검증은 매니페스트를 통과한다', () => {
    expect(leverLiftModule.validate(experiment)).toEqual([]);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 9줄(정수 g, 정수 cm)과 물체 색깔 무영향', () => {
    const cols = leverLiftModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['저울 눈금(g)', '손으로 당긴 거리(cm)']);
    const row = (tool: string, armCm: string, color = 'red') => cols.map((c) => c.value(sim({ tool, armCm, color }).result));
    for (const color of ['red', 'blue']) {
      expect(row('none', 'short', color)).toEqual(['200', '20']);
      expect(row('none', 'long', color)).toEqual(['200', '20']);
      expect(row('lever', 'short', color)).toEqual(['200', '20']);
      expect(row('lever', 'mid', color)).toEqual(['100', '40']);
      expect(row('lever', 'long', color)).toEqual(['67', '60']);
      expect(row('ramp', 'short', color)).toEqual(['110', '40']);
      expect(row('ramp', 'mid', color)).toEqual(['55', '80']);
      expect(row('ramp', 'long', color)).toEqual(['37', '120']);
    }
  });

  it('센서: 가상 용수철저울(scale, g) 하나, 받침 100 g을 빼서 저울 눈금을 보여 준다', () => {
    const specs = leverLiftModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 용수철저울: 저울 눈금', 'scale', 'g']]);
    expect(specs[0]!.source + 100).toBe(0);
    const ramp = { ...base, tool: 'ramp', armCm: 'mid' };
    expect(leverLiftModule.sensors(at(ramp, 40), ramp)[0]!.source + 100).toBe(55);
  });

  it('그래프 설정: y 0~250 고정(50 간격), x 0~120 cm(30 간격), 선 하나, 가로선이 당긴 거리까지 이어진다', () => {
    const g = leverLiftModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['저울 눈금(g)', undefined, [0, 50, 100, 150, 200, 250], '손으로 당긴 거리(cm)', [0, 30, 60, 90, 120], undefined, undefined]);
    expect(leverLiftModule.restPlayhead).toBeUndefined();
    expect(leverLiftModule.metric.sampleKey).toBe('force');
    expect(leverLiftModule.metric.resultKey).toBe('force');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(new Set(s.map((x) => x.force)).size, JSON.stringify(v)).toBe(1);
      expect(s.at(-1)!.t).toBe(sim(v).result.pullCm);
      expect(s.at(-1)!.t).toBeLessThanOrEqual(120);
    }
  });

  it('예측 비교는 저울 눈금(g): 도구 없이 → 지레(짧게는 같음, 중간은 줄어듦), 빗면 중간은 줄어듦, 색깔은 변하지 않음 (기준 5 g)', () => {
    const m = leverLiftModule.metric;
    const force = (v: V) => sim(v).result[m.resultKey as 'force'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(5);
    expect(observedOutcome(force(base), force({ ...base, tool: 'lever' }), th)).toBe('same');
    expect(observedOutcome(force(base), force({ ...base, tool: 'lever', armCm: 'mid' }), th)).toBe('decrease');
    expect(observedOutcome(force({ ...base, tool: 'ramp', armCm: 'short' }), force({ ...base, tool: 'ramp', armCm: 'mid' }), th)).toBe('decrease');
    expect(observedOutcome(force({ ...base, tool: 'ramp', armCm: 'mid' }), force({ ...base, tool: 'ramp', armCm: 'short' }), th)).toBe('increase');
    expect(observedOutcome(force({ ...base, tool: 'ramp', armCm: 'mid' }), force({ ...base, tool: 'lever', armCm: 'mid' }), th)).toBe('increase');
    for (const tool of LIFT_TOOLS) for (const armCm of LIFT_ARMS) expect(observedOutcome(force({ tool, armCm, color: 'red' }), force({ tool, armCm, color: 'blue' }), th)).toBe('same');
    // 도구 없이는 길이를 바꿔도 변하지 않는다
    expect(observedOutcome(force(base), force({ ...base, armCm: 'long' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다 (눈금 0~250, 0~120)', () => {
    const v = { tool: 'ramp', armCm: 'long', color: 'red' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: leverLiftModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 120, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('저울 눈금(g)');
    expect(html).toContain('손으로 당긴 거리(cm)');
    const yTicks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(yTicks).toEqual(['0', '50', '100', '150', '200', '250']);
    const xTicks = [...html.matchAll(/<text x="([\d.]+)" y="(\d+)" text-anchor="middle">([\d.]+)<\/text>/g)].filter((m) => Number(m[2]) > 200).map((m) => m[3]);
    expect(xTicks).toEqual(['0', '30', '60', '90', '120']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('문구: "손으로 {n} cm 당김 · 저울 눈금 {g} g"', () => {
    expect(liftNote(at({ ...base, tool: 'lever', armCm: 'long' }, 30))).toBe('손으로 30 cm 당김 · 저울 눈금 67 g');
    expect(liftNote(at({ ...base, tool: 'ramp', armCm: 'long' }, 120))).toBe('손으로 120 cm 당김 · 저울 눈금 37 g');
    expect(macro({ ...base, tool: 'lever', armCm: 'long' }, at({ ...base, tool: 'lever', armCm: 'long' }, 60))).toContain('손으로 60 cm 당김 · 저울 눈금 67 g');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 저울 눈금 "?", 물체는 바닥(당김 0), 문구에 숫자가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain('저울 눈금: ?');
      expect(html).toContain('data-lift="0.00"');
      expect(html).toContain('실험하면');
      expect(html).not.toContain('당김');
      expect(count(html, 'load-box')).toBe(1);
      expect(count(html, 'spring-scale')).toBe(1);
      expect(count(html, 'hand')).toBe(1);
      // 저울 눈금 숫자가 그림 속 글자에 없다
      expect(html).not.toMatch(/저울 눈금: \d/);
      expect(bars(v, null, false)).toContain('data-value="0.0"');
      expect(bars(v, null, false)).toContain('실험하면');
    }
  });

  it('실행한 뒤 끝에서는 저울 눈금(g)이 그림에 쓰이고, 물체는 20 cm 올라와 있다', () => {
    for (const v of CONDITIONS) {
      const e = end(v);
      const html = macro(v, e);
      expect(html, JSON.stringify(v)).toContain(`저울 눈금: ${sim(v).result.force} g`);
      expect(html).toContain('data-lift="20.00"');
    }
  });

  it('도구마다 그림이 다르다: 지레는 받침점·막대, 빗면은 빗면, 도구 없이는 둘 다 없다', () => {
    for (const armCm of LIFT_ARMS) {
      const none = macro({ ...base, armCm }, at({ ...base, armCm }, 10));
      expect([count(none, 'fulcrum'), count(none, 'lever-bar'), count(none, 'ramp-surface')]).toEqual([0, 0, 0]);
      expect(none).toContain('data-tool="none"');
      const lever = macro({ ...base, tool: 'lever', armCm }, at({ ...base, tool: 'lever', armCm }, 10));
      expect([count(lever, 'fulcrum'), count(lever, 'lever-bar'), count(lever, 'ramp-surface')]).toEqual([1, 1, 0]);
      const ramp = macro({ ...base, tool: 'ramp', armCm }, at({ ...base, tool: 'ramp', armCm }, 10));
      expect([count(ramp, 'fulcrum'), count(ramp, 'lever-bar'), count(ramp, 'ramp-surface')]).toEqual([0, 0, 1]);
    }
  });

  it('힘을 주는 쪽 길이: 지레는 20·40·60 cm, 빗면은 40·80·120 cm로 그림 글자와 길이가 바뀐다', () => {
    expect(['short', 'mid', 'long'].map((a) => armLine('lever', a as never))).toEqual(['받침점에서 손까지 20 cm', '받침점에서 손까지 40 cm', '받침점에서 손까지 60 cm']);
    expect(['short', 'mid', 'long'].map((a) => armLine('ramp', a as never))).toEqual(['빗면 길이 40 cm', '빗면 길이 80 cm', '빗면 길이 120 cm']);
    expect(armLine('none', 'long')).toBe('손으로 곧바로 들어 올려요');
    expect([40, 80, 120].map(rampBase)).toEqual([56, 112, 168]);
    for (const [arm, cm] of [['short', 20], ['mid', 40], ['long', 60]] as const) {
      const v = { ...base, tool: 'lever', armCm: arm };
      expect(macro(v, at(v, 0))).toContain(`data-arm-cm="${cm}"`);
      expect(macro(v, at(v, 0))).toContain(`받침점에서 손까지 ${cm} cm`);
    }
    // 같은 도구에서 길이가 길수록 지레의 손 쪽이 받침점에서 멀다
    expect(leverPoint(40, 0).x - leverPoint(0, 0).x).toBeLessThan(leverPoint(120, 0).x - leverPoint(0, 0).x);
  });

  it('지레: 처음에는 물체 쪽이 내려가 있고 다 당기면 수평이다. 모든 지점이 그림 안(받침점 오른쪽 끝 200 이하)에 있다', () => {
    expect(leverAngle(0)).toBe(-20);
    expect(leverAngle(1)).toBe(0);
    expect(leverAngle(0.5)).toBe(-10);
    for (const arm of [20, 40, 60]) {
      for (const k of [0, 0.5, 1]) {
        const p = leverPoint(arm * 2, leverAngle(k));
        expect(p.x).toBeLessThanOrEqual(MACRO_W);
        expect(p.y).toBeLessThan(GROUND_Y);
        expect(p.y).toBeGreaterThan(60);
      }
    }
    for (const k of [0, 1]) expect(leverPoint(-40, leverAngle(k)).y).toBeLessThan(GROUND_Y);
  });

  it('빗면: 빗면 위 점은 밑변 안(왼쪽 아래에서 오른쪽 위)에 있다', () => {
    for (const cm of [40, 80, 120]) {
      const a = rampPoint(cm, 0);
      const b = rampPoint(cm, 1);
      expect(a.y).toBe(GROUND_Y);
      expect(b.y).toBe(GROUND_Y - 36);
      expect(b.x - a.x).toBe(rampBase(cm));
      expect(b.x).toBeLessThanOrEqual(MACRO_W - 30);
    }
  });

  it('물체 색깔 그림만 바뀐다: 상자 색 속성이 다르고 결과 글자는 같다', () => {
    for (const tool of LIFT_TOOLS) {
      const a = { ...base, tool, armCm: 'mid', color: 'red' };
      const b = { ...a, color: 'blue' };
      const ha = macro(a, end(a));
      const hb = macro(b, end(b));
      expect(ha).toContain('data-color="red"');
      expect(hb).toContain('data-color="blue"');
      expect(ha.replaceAll('red', 'x').replaceAll('#f87171', 'c').replaceAll('#991b1b', 's').replaceAll('빨간', '').replaceAll('파란', '')).toBe(hb.replaceAll('blue', 'x').replaceAll('#60a5fa', 'c').replaceAll('#1e40af', 's').replaceAll('빨간', '').replaceAll('파란', ''));
    }
  });

  it('startSample은 t = 0', () => {
    expect(startSample(base).t).toBe(0);
    expect(startSample({ ...base, tool: 'ramp', armCm: 'long' }).liftCm).toBe(0);
  });
});

describe('힘과 거리 보기', () => {
  it('두 막대: 저울 눈금(0~250)과 손으로 당긴 거리(0~120)가 실행 뒤 끝에서 채워진다', () => {
    const v = { tool: 'ramp', armCm: 'mid', color: 'red' };
    const html = bars(v, end(v));
    expect(html).toContain('data-value="55.0"');
    expect(html).toContain('data-value="80.0"');
    expect(barLength(55, 250)).toBeCloseTo(48.4, 5);
    expect(barLength(80, 120)).toBeCloseTo(146.67, 1);
    expect(barLength(500, 250)).toBe(220);
    expect(barLength(-5, 250)).toBe(0);
    expect(html).toContain('저울 눈금 55 g · 손으로 80 cm 당김');
  });

  it('지레를 쓰면 저울 막대는 짧아지고 당긴 거리 막대는 길어진다(길게, 도구 없이와 견줌)', () => {
    const none = { ...base };
    const lever = { tool: 'lever', armCm: 'long', color: 'red' };
    const len = (html: string, id: string) => Number(new RegExp(`data-testid="${id}" data-value="[\\d.]+" x="10" y="\\d+" width="([\\d.]+)"`).exec(html)![1]);
    expect(len(bars(lever, end(lever)), 'force-bar')).toBeLessThan(len(bars(none, end(none)), 'force-bar'));
    expect(len(bars(lever, end(lever)), 'pull-bar')).toBeGreaterThan(len(bars(none, end(none)), 'pull-bar'));
  });

  it('범례: 저울 눈금(g), 손으로 당긴 거리(cm)가 한 번씩 있다', () => {
    for (const ran of [false, true]) {
      const html = bars(base, ran ? end(base) : null, ran);
      for (const label of ['저울 눈금(g)', '손으로 당긴 거리(cm)']) expect(html.match(new RegExp(`>${label.replace(/[()]/g, '\\$&')}</text>`, 'g')), label).toHaveLength(1);
    }
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(18가지) × 실행 전·처음·중간·끝의 눈으로 보기·힘과 거리 보기 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [LeverLiftSample | null, boolean][] = [[null, false], ...frames(v).map((s) => [s, true] as [LeverLiftSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), bars(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(500);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...leverLiftModule.resultColumns(experiment).map((c) => c.label),
      ...leverLiftModule.sensors(null, base).map((s) => s.label),
      leverLiftModule.graph.yLabel,
      leverLiftModule.graph.xLabel!,
      ...CONDITIONS.flatMap((v) => [armLine(v.tool as never, v.armCm as never)]),
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
      '받침점에서 멀수록 힘이 적게 들어요',
      '받침점에서 멀수록 힘이 적습니다',
      '받침점에서 멀면 힘이 적게 들어요',
      '받침점에서 멀수록 힘이 작아요',
      '받침점에서 멀수록 눈금이 작아져요',
      '받침점에서 멀수록 쉬워요',
      '빗면이 길수록 힘이 작아요',
      '빗면이 길수록 눈금이 작아져요',
      '빗면이 길수록 쉬워요',
      '지레를 쓰면 힘이 작아요',
      '빗면을 쓰면 힘이 작아요',
      '도구를 쓰면 힘이 작아요',
      '받침점에서 멀어질수록 힘이 줄어요',
      '손이 받침점에서 멀수록 쉬워요',
      '손이 받침점에서 멀수록 눈금이 작아요',
      '빗면이 길수록 힘이 적게 들어요',
      '빗면이 길수록 힘이 적답니다',
      '빗면이 길면 힘이 적게 들어요',
      '빗면이 완만할수록 쉬워요',
      '빗면이 완만하면 눈금이 작아요',
      '지레를 쓰면 힘이 덜 들어요',
      '지레를 쓰면 힘이 덜 듭니다',
      '지레를 쓰면 힘이 적게 들어요',
      '빗면을 쓰면 힘이 덜 들어요',
      '빗면을 쓰면 힘이 적게 들어요',
      '도구를 쓰면 힘이 덜 들어요',
      '힘은 적게 드는 대신 더 많이 당겨야 해요',
      '힘은 적게 드는 대신 더 많이 당긴답니다',
      '힘이 적게 드는 대신 거리가 늘어요',
      '색깔은 관계없어요',
      '색깔은 관계없답니다',
      '색깔은 상관없어요',
      '색깔은 상관없습니다',
      '색깔은 영향이 없어요',
      '색깔은 결과에 영향을 주지 않아요',
      '색깔과 관계없이 같아요',
      '색깔이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    // 규칙에 걸리지 않는 질문은 막지 않는다 (오검출 없음)
    for (const ok of ['쓰는 도구만 바꾸었을 때 저울 눈금은 어떻게 달라졌나요?', '손으로 당긴 거리를 견주어 볼까요?', '물체 색깔만 바꾸었을 때 결과가 달라졌나요?', '지레와 빗면을 견주어 볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
