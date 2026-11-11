import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { GAS_CAPS, GAS_LABELS, GAS_PUMPS, simulateGasWeight, type GasWeightSample } from '@sci/engine-matter';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { gasWeightModule } from './index';
import { CAP_TEXT, FIRM_TEXT, LABEL_FILL, LABEL_TEXT, gasNote, startSample } from './initial';
import { GasMacroView, PRESS_DEPTH, bulge, pressPhase } from './GasMacroView';
import { GasGaugeView, GAUGE, gaugeX } from './GasGaugeView';

const unit = UNITS.find((u) => u.id === 'g4-gases')!;
if (!unit.ok) throw new Error('g4-gases가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g4-gases 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { pumps: number; cap: string; label: string };
const base: V = { pumps: 0, cap: 'closed', label: 'red' };
const CONDITIONS: V[] = GAS_PUMPS.flatMap((pumps) => GAS_CAPS.flatMap((cap) => GAS_LABELS.map((label) => ({ pumps, cap, label }))));
const sim = (v: V) => gasWeightModule.simulate(v, experiment) as ReturnType<typeof simulateGasWeight>;
const at = (v: V, t: number): GasWeightSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: GasWeightSample | null, ran = true) => renderToStaticMarkup(createElement(GasMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const gauge = (v: V, snapshot: GasWeightSample | null, ran = true) => renderToStaticMarkup(createElement(GasGaugeView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 5.5, 20, 33.3, 60];

describe('레지스트리', () => {
  it('g4-gases 활동 2는 gas-weight 모듈로 로드되고 첫 활동(주사기 속 기체의 부피)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['여러 가지 기체', 4, 'matter', ['4과15-01', '4과15-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'syringe-volume', 'gas-syringe'], ['variable', 'gas-weight', 'gas-weight']]);
    expect(unit.module.kind).toBe('gas-syringe');
    expect(activity.module).toBe(gasWeightModule);
    expect(MODULES['gas-weight'].kind).toBe('gas-weight');
    expect(experiment.safety).toEqual([]);
    expect(gasWeightModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['공기를 넣은 페트병의 무게', '공기를 더 넣으면 무게가 어떻게 달라질까?', '예측: 페트병의 무게는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['pumps', '공기 주입 마개를 누른 횟수', 0], ['cap', '마개', 'closed'], ['label', '페트병 띠지 색깔', 'red']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [[0, '0번'], [20, '20번'], [40, '40번'], [60, '60번']],
      [['closed', '닫아 둠'], ['open', '열어서 공기를 뺌']],
      [['red', '빨간색'], ['blue', '파란색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['weight', '전자저울 무게', 'g'], ['firm', '손으로 눌렀을 때', '']]);
    expect(experiment.limits).toEqual(['기압', '밀도', '분자', '압력']);
    expect(GAS_CAPS.map((s) => CAP_TEXT[s])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(GAS_LABELS.map((s) => LABEL_TEXT[s])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
  });

  it('예측 문구와 실행 전 probe는 예측 버튼에 맞는 양, 페트병의 무게를 묻는다', () => {
    expect(experiment.predictionPrompt).toContain('무게');
    expect(experiment.tutor.probes.find((p) => p.when === 'before-run')!.text).toContain('페트병의 무게');
  });
});

describe('결과 열(범주 포함)·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표(소수 첫째 자리 g + 단단함 범주)와 띠지 색깔 무영향', () => {
    const cols = gasWeightModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['전자저울 무게(g)', '손으로 눌렀을 때']);
    const row = (pumps: number, cap: string, label = 'red') => cols.map((c) => c.value(sim({ pumps, cap, label }).result));
    for (const label of ['red', 'blue']) {
      expect(row(0, 'closed', label)).toEqual(['45.3', '말랑함']);
      expect(row(20, 'closed', label)).toEqual(['45.8', '조금 단단함']);
      expect(row(40, 'closed', label)).toEqual(['46.3', '단단함']);
      expect(row(60, 'closed', label)).toEqual(['46.8', '아주 단단함']);
      for (const n of [0, 20, 40, 60]) expect(row(n, 'open', label)).toEqual(['45.3', '말랑함']);
    }
    expect(Object.values(FIRM_TEXT)).toEqual(['말랑함', '조금 단단함', '단단함', '아주 단단함']);
  });

  it('센서: 가상 전자저울(scale, g, 소수 첫째 자리) 하나, 실험 전에는 0, 끝에서는 무게', () => {
    const specs = gasWeightModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit, s.decimals])).toEqual([['가상 전자저울: 페트병', 'scale', 'g', 1]]);
    expect(specs[0]!.source).toBe(-100);
    const v = { ...base, pumps: 40 };
    expect(gasWeightModule.sensors(at(v, 60), v)[0]!.source).toBeCloseTo(46.3 - 100, 9);
  });

  it('그래프 설정: y 45.0~47.0 g 고정(45, 45.5, …, 47), x 누른 횟수 0~60번(0, 20, 40, 60), 선 하나, 재생이 끝나면 끝(60번)에 둔다', () => {
    const g = gasWeightModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['전자저울 무게(g)', 45, [45, 45.5, 46, 46.5, 47], '누른 횟수(번)', [0, 20, 40, 60], undefined, undefined]);
    expect(gasWeightModule.restPlayhead).toBeUndefined();
    expect(gasWeightModule.metric.sampleKey).toBe('weight');
    expect(gasWeightModule.metric.resultKey).toBe('weight');
    for (const v of CONDITIONS) for (const s of sim(v).samples) {
      expect(s.weight).toBeGreaterThanOrEqual(45);
      expect(s.weight).toBeLessThanOrEqual(47);
    }
  });

  it('예측 비교는 전자저울 무게(g): 더 누르면 늘어남(0.5 g), 마개를 열면 줄어듦, 띠지 색깔은 변하지 않음 (기준 0.05 g)', () => {
    const m = gasWeightModule.metric;
    const w = (v: V) => sim(v).result[m.resultKey as 'weight'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.05);
    expect(observedOutcome(w(base), w({ ...base, pumps: 20 }), th)).toBe('increase');
    expect(observedOutcome(w({ ...base, pumps: 60 }), w({ ...base, pumps: 40 }), th)).toBe('decrease');
    expect(observedOutcome(w({ ...base, pumps: 40 }), w({ ...base, pumps: 40, cap: 'open' }), th)).toBe('decrease');
    // 0번이면 마개를 열어도 같다
    expect(observedOutcome(w(base), w({ ...base, cap: 'open' }), th)).toBe('same');
    for (const v of CONDITIONS) expect(observedOutcome(w(v), w({ ...v, label: v.label === 'red' ? 'blue' : 'red' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, pumps: 60 };
    const html = renderToStaticMarkup(createElement(GraphView, { module: gasWeightModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 60, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('전자저울 무게(g)');
    expect(html).toContain('누른 횟수(번)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['45', '45.5', '46', '46.5', '47']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{횟수}번 누름 · 저울 {g} g"', () => {
    const v = { ...base, pumps: 20 };
    expect(gasNote(at(v, 60))).toBe('20번 누름 · 저울 45.8 g');
    expect(macro(v, at(v, 60))).toContain('20번 누름 · 저울 45.8 g');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 병은 말랑한 처음 모양, 저울 숫자 "—", 쉿 표시와 손 누름 없음, 문구에 숫자가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain('data-taut="0.000"');
      expect(html).toContain('data-pressed="0.00"');
      expect(html).toContain('— g');
      expect(html).toContain('실험하면');
      expect(count(html, 'vent-marks')).toBe(0);
      expect(html).toContain('data-testid="press-hand" data-depth="0.00"');
      expect(html).not.toContain('45.3 g');
      const g = gauge(v, null, false);
      expect(g).not.toContain('gauge-marker');
      expect(g).not.toContain('gauge-label');
    }
  });

  it('실행하면 저울 숫자가 바뀌고, 닫아 둔 병은 누른 횟수만큼 팽팽해진다', () => {
    const v = { ...base, pumps: 60 };
    expect(macro(v, at(v, 0))).toContain('45.3 g');
    expect(macro(v, at(v, 60))).toContain('46.8 g');
    expect(macro(v, at(v, 60))).toContain('data-taut="1.000"');
    expect(macro(v, at(v, 0))).toContain('data-taut="0.000"');
    expect(bulge(0)).toBeLessThan(0);
    expect(bulge(1)).toBeGreaterThan(0);
    expect(bulge(0.5)).toBeGreaterThan(bulge(0));
  });

  it('마개를 열면 쉿 표시(곡선 세 줄, 글자 없음)가 실행하는 동안에만 나오고 병은 처음 모양 그대로다', () => {
    const v = { pumps: 60, cap: 'open', label: 'red' };
    const html = macro(v, at(v, 30));
    expect(count(html, 'vent-marks')).toBe(1);
    expect((/data-testid="vent-marks"[^>]*>(.*?)<\/g>/.exec(html)![1]!.match(/<path/g) ?? [])).toHaveLength(3);
    expect(/data-testid="vent-marks"[^>]*>(.*?)<\/g>/.exec(html)![1]).not.toMatch(/<text/);
    expect(html).toContain('data-taut="0.000"');
    expect(html).toContain('45.3 g');
    expect(html).toContain('data-open="yes"');
    expect(count(macro({ ...v, cap: 'closed' }, at({ ...v, cap: 'closed' }, 30)), 'vent-marks')).toBe(0);
  });

  it('손이 누르는 모양: 누르는 중에만 눌리고, 다 누른 뒤와 0번이면 위에 있다', () => {
    expect(pressPhase(0.5, 20)).toBeCloseTo(1, 9);
    expect(pressPhase(3, 20)).toBeCloseTo(0, 9);
    expect(pressPhase(20, 20)).toBe(0);
    expect(pressPhase(30, 20)).toBe(0);
    expect(pressPhase(5, 0)).toBe(0);
    const v = { ...base, pumps: 20 };
    expect(macro(v, { ...at(v, 10), t: 10.5, pressed: 10.5 })).toContain(`data-testid="press-hand" data-depth="${PRESS_DEPTH.toFixed(2)}"`);
    expect(macro(v, at(v, 60))).toContain('data-testid="press-hand" data-depth="0.00"');
  });

  it('띠지 색깔은 그림의 색만 바꾼다: 결과·움직임은 같다', () => {
    for (const v of CONDITIONS.filter((x) => x.label === 'red')) {
      const b = { ...v, label: 'blue' };
      expect(sim(b)).toEqual(sim(v));
      expect(macro(b, at(b, 60))).not.toBe(macro(v, at(v, 60)));
      expect(macro(v, at(v, 60))).toContain(`fill="${LABEL_FILL.red}"`);
      expect(macro(b, at(b, 60))).toContain(`fill="${LABEL_FILL.blue}"`);
    }
  });

  it('병 몸통이 저울 판 위에 있다', () => {
    const html = macro(base, at(base, 0));
    expect(count(html, 'bottle-body')).toBe(1);
    expect(count(html, 'bottle-label')).toBe(1);
  });

  it('startSample은 t = 0, 누르지 않음, 처음 무게, 말랑함', () => {
    expect(startSample({ ...base, pumps: 60 })).toEqual({ t: 0, pressed: 0, weight: 45.3, taut: 0 });
  });
});

describe('저울 숫자 크게 보기', () => {
  it('45.0~47.0 g 눈금에 표시: 실행 후 현재 무게에 표식이 있고 눈금 글자는 45.0, 46.0, 47.0', () => {
    const v = { ...base, pumps: 40 };
    const html = gauge(v, at(v, 60));
    expect(html).toContain('data-weight="46.300"');
    expect(html).toContain('46.3 g');
    expect([...html.matchAll(/font-size="14" fill="currentColor">(4\d\.\d)</g)].map((m) => m[1])).toEqual(['45.0', '46.0', '47.0']);
    expect(gaugeX(45)).toBe(GAUGE.x);
    expect(gaugeX(47)).toBe(GAUGE.x + GAUGE.w);
    expect(gaugeX(46.3) - gaugeX(45.8)).toBeCloseTo(0.5 * 96, 9);
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(16가지) × 실행 전·여러 시각의 눈으로 보기·저울 숫자 크게 보기 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [GasWeightSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [{ ...at(v, Math.floor(t)), t, pressed: Math.min(t, v.pumps) }, true] as [GasWeightSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), gauge(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(900);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열(범주 포함)·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const cols = gasWeightModule.resultColumns(experiment);
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...cols.map((c) => c.label),
      ...Object.values(FIRM_TEXT),
      ...CONDITIONS.flatMap((v) => cols.map((c) => c.value(sim(v).result))),
      ...gasWeightModule.sensors(null, base).map((s) => s.label),
      gasWeightModule.graph.yLabel,
      gasWeightModule.graph.xLabel!,
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
      '공기도 무게가 있어요',
      '공기는 무게가 있어요',
      '공기에도 무게가 있어요',
      '기체도 무게가 있어요',
      '기체는 무게가 있어요',
      '기체에는 무게가 있어요',
      '공기를 넣을수록 무거워져요',
      '공기를 넣으면 더 무거워요',
      '많이 누를수록 무거워져요',
      '누를수록 무거워요',
      '누를수록 무게가 늘어요',
      '누르면 무게가 늘어요',
      '공기를 빼면 가벼워져요',
      '공기가 빠지면 가벼워요',
      '마개를 열면 가벼워져요',
      '마개를 열면 무게가 줄어요',
      '띠지 색깔은 관계없어요',
      '띠지 색은 관계없어요',
      '띠지 색은 상관없습니다',
      '색깔은 영향이 없어요',
      '색깔이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['누른 횟수만 바꾸었어요. 저울 숫자는 어떻게 달라졌나요?', '마개를 열었을 때 병의 무게와 단단한 정도는 각각 어떻게 되었나요?', '띠지 색깔만 바꾸었을 때 결과가 달라졌나요?', '저울 숫자의 소수점 아래 자리까지 견주어 볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
