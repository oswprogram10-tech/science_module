import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { HEAT_COLDS, HEAT_CUPS, HEAT_HOTS, HEAT_LABELS, simulateHeatContact, type HeatContactSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { thermalColor } from '../insulated-cup/CupThermalView';
import { heatContactModule } from './index';
import { CUP_TEXT, LABEL_TEXT, heatNote, sameMinText, startSample } from './initial';
import { HeatMacroView, INNER_WATER_TOP, mercuryTop, outerWaterTop } from './HeatMacroView';
import { HeatThermalView } from './HeatThermalView';

const unit = UNITS.find((u) => u.id === 'g5-heat')!;
if (!unit.ok) throw new Error('g5-heat가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g5-heat 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { hotC: number; coldMl: number; cup: string; label: string };
const base: V = { hotC: 60, coldMl: 100, cup: 'metal', label: 'yellow' };
const CONDITIONS: V[] = HEAT_HOTS.flatMap((hotC) => HEAT_COLDS.flatMap((coldMl) => HEAT_CUPS.flatMap((cup) => HEAT_LABELS.map((label) => ({ hotC, coldMl, cup, label })))));
const sim = (v: V) => heatContactModule.simulate(v, experiment) as ReturnType<typeof simulateHeatContact>;
const at = (v: V, t: number): HeatContactSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: HeatContactSample | null, ran = true) => renderToStaticMarkup(createElement(HeatMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const thermal = (v: V, snapshot: HeatContactSample | null, ran = true) => renderToStaticMarkup(createElement(HeatThermalView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 1, 5, 10, 20];

describe('레지스트리', () => {
  it('g5-heat 활동 2는 heat-contact 모듈로 로드되고 첫 활동(insulated-cup)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['열과 우리 생활', 5, 'physics', ['6과07-02', '6과07-04']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'insulated-cup', 'insulated-cup'], ['variable', 'heat-contact', 'heat-contact']]);
    expect(unit.module.kind).toBe('insulated-cup');
    expect(activity.module).toBe(heatContactModule);
    expect(MODULES['heat-contact'].kind).toBe('heat-contact');
    expect(experiment.safety).toEqual(['hot-water']);
    expect(heatContactModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['온도가 다른 두 물이 닿으면', '온도가 다른 두 물체가 닿아 있으면 온도가 어떻게 변할까?', '예측: 10분 뒤 안쪽 컵 물의 온도는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['hotC', '안쪽 컵 물의 처음 온도', 60], ['coldMl', '바깥 비커 찬물의 양', 100], ['cup', '안쪽 컵 재료', 'metal'], ['label', '컵에 붙인 이름표 색', 'yellow']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [[50, '50 °C'], [60, '60 °C'], [70, '70 °C']],
      [[100, '100 mL'], [300, '300 mL']],
      [['metal', '얇은 금속 컵'], ['plastic', '플라스틱 컵']],
      [['yellow', '노랑'], ['green', '초록']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['inner10', '10분 뒤 안쪽 물 온도', '°C'], ['outer10', '10분 뒤 바깥 물 온도', '°C'], ['sameMin', '두 온도 차가 1 °C 안이 된 때', '분']]);
    expect(experiment.limits).toEqual(['열평형', '비열', '열량', '칼로리', '전도']);
    expect(HEAT_CUPS.map((s) => CUP_TEXT[s])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
    expect(HEAT_LABELS.map((s) => LABEL_TEXT[s])).toEqual(experiment.variables[3]!.options.map((o) => o.label));
  });

  it('안전: 뜨거운 물 점검표는 첫 활동(보온 컵)의 것과 같고 점검표·경고 문구가 있다', () => {
    const first = unit.activities[0]!.experiment as typeof experiment;
    expect(experiment.safetyChecklist).toEqual(first.safetyChecklist);
    expect(experiment.safetyChecklist).toHaveLength(3);
    expect(experiment.safetyMessages).toEqual(first.safetyMessages);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 식의 기준값(정수 °C, 정수 분)과 이름표 색 무영향', () => {
    const cols = heatContactModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['10분 뒤 안쪽 물 온도(°C)', '10분 뒤 바깥 물 온도(°C)', '두 온도 차가 1 °C 안이 된 때(분)']);
    const row = (hotC: number, coldMl: number, cup: string, label = 'yellow') => cols.map((c) => c.value(sim({ hotC, coldMl, cup, label }).result));
    for (const label of ['yellow', 'green']) {
      expect(row(60, 100, 'metal', label)).toEqual(['40', '40', '4']);
      expect(row(60, 100, 'plastic', label)).toEqual(['40', '40', '10']);
      expect(row(60, 300, 'metal', label)).toEqual(['30', '30', '5']);
      expect(row(60, 300, 'plastic', label)).toEqual(['32', '29', '14']);
      expect(row(70, 300, 'plastic', label)).toEqual(['35', '32', '15']);
    }
    expect(sameMinText({ sameMin: null })).toBe('20분 넘음');
    expect(sameMinText({ sameMin: 4 })).toBe('4');
  });

  it('센서: 가상 온도계 둘(안쪽 컵 물, 바깥 비커 물), 실행 전에는 처음 온도(고른 처음 온도, 20 °C)를 보여 준다', () => {
    const specs = heatContactModule.sensors(null, { ...base, hotC: 70 });
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 온도 센서 1: 안쪽 컵 물', 'temperature', '°C'], ['가상 온도 센서 2: 바깥 비커 물', 'temperature', '°C']]);
    expect(specs.map((s) => s.source)).toEqual([70, 20]);
    expect(specs.map((s) => s.ariaLabel)).toEqual(['온도 센서 1, 안쪽 컵 물', '온도 센서 2, 바깥 비커 물']);
    const m = heatContactModule.sensors(at(base, 10), base);
    expect(m[0]!.source).toBeCloseTo(40, 3);
    expect(m[1]!.source).toBeCloseTo(40, 3);
  });

  it('그래프 설정: y 0~80 °C 고정, x 0~20분(0, 5, 10, 15, 20), 선 둘(안쪽·바깥), 재생이 끝나면 10분에 둔다', () => {
    const g = heatContactModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.markers]).toEqual(['온도(°C)', undefined, [0, 20, 40, 60, 80], '시간(분)', [0, 5, 10, 15, 20], undefined]);
    expect(g.series!.map((s) => [s.key, s.label])).toEqual([['innerC', '안쪽 물(°C)'], ['outerC', '바깥 물(°C)']]);
    expect(heatContactModule.restPlayhead).toBe(10);
    expect(heatContactModule.metric.sampleKey).toBe('innerC');
    expect(heatContactModule.metric.resultKey).toBe('inner10');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.innerC))).toBeLessThanOrEqual(80);
      expect(Math.min(...s.map((x) => x.outerC))).toBeGreaterThanOrEqual(0);
      expect(s.at(-1)!.t).toBe(20);
    }
  });

  it('예측 비교는 10분 뒤 안쪽 물 온도(정수 °C): 처음 온도를 올리면 늘어남, 찬물을 늘리면 줄어듦, 이름표 색은 변하지 않음 (기준 0.5)', () => {
    const m = heatContactModule.metric;
    const inner = (v: V) => sim(v).result[m.resultKey as 'inner10'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(inner(base), inner({ ...base, hotC: 70 }), th)).toBe('increase');
    expect(observedOutcome(inner({ ...base, hotC: 70 }), inner(base), th)).toBe('decrease');
    expect(observedOutcome(inner(base), inner({ ...base, coldMl: 300 }), th)).toBe('decrease');
    for (const v of CONDITIONS) expect(observedOutcome(inner(v), inner({ ...v, label: v.label === 'yellow' ? 'green' : 'yellow' }), th)).toBe('same');
    // 100 mL에서는 금속·플라스틱 모두 10분 뒤 같은 40 °C라서 컵 재료만 바꾸면 변하지 않는다.
    expect(observedOutcome(inner(base), inner({ ...base, cup: 'plastic' }), th)).toBe('same');
    // 300 mL에서는 플라스틱이 더 느리게 식어(안쪽 32 > 30) 늘어난다.
    expect(observedOutcome(inner({ ...base, coldMl: 300 }), inner({ ...base, coldMl: 300, cup: 'plastic' }), th)).toBe('increase');
  });

  it('그래프가 그려지고 선 둘과 범례, y축·x축 라벨과 눈금이 있다', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: heatContactModule as never, experiment, trial: trialOf(base), prev: undefined, playhead: 10, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('온도(°C)');
    expect(html).toContain('시간(분)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '20', '40', '60', '80']);
    expect(html.match(/data-testid="graph-series"/g)).toHaveLength(2);
    expect(html).toContain('안쪽 물(°C)');
    expect(html).toContain('바깥 물(°C)');
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}분 · 안쪽 {°C} · 바깥 {°C}", 온도계 값과 같다', () => {
    expect(heatNote(at(base, 10))).toBe('10.0분 · 안쪽 40.0 °C · 바깥 40.0 °C');
    expect(heatNote(at(base, 0))).toBe('0.0분 · 안쪽 60.0 °C · 바깥 20.0 °C');
    const html = macro(base, at(base, 1));
    expect(html).toContain(heatNote(at(base, 1)));
    expect(html).toContain(`${at(base, 1).innerC.toFixed(1)} °C`);
    expect(html).toContain(`${at(base, 1).outerC.toFixed(1)} °C`);
    expect(count(html, 'thermo-inner')).toBe(1);
    expect(count(html, 'thermo-outer')).toBe(1);
  });

  it('실행 전에는 결과 그림이 없다: 처음 온도(t = 0)만 보이고, 10분 뒤 값·결과 문구가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain(`data-inner="${v.hotC.toFixed(2)}"`);
      expect(html).toContain('data-outer="20.00"');
      expect(html).toContain('실험하면');
      expect(html).not.toContain('분 · 안쪽');
      const r = sim(v).result;
      expect(html).not.toContain(`${r.inner10}.0 °C`);
    }
    expect(startSample({ ...base, hotC: 70 })).toMatchObject({ t: 0, innerC: 70, outerC: 20 });
  });

  it('조건 라벨과 그림: 컵 재료(금속은 두껍고 회색), 이름표 색, 찬물의 양(300 mL는 물이 더 높다)', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 5));
      expect(html).toContain(`안쪽 컵: ${v.hotC} °C 물 100 mL`);
      expect(html).toContain(`${CUP_TEXT[v.cup as 'metal']} · ${LABEL_TEXT[v.label as 'yellow']} 이름표`);
      expect(html).toContain(`바깥: 20 °C 찬물 ${v.coldMl} mL`);
      expect(html).toContain(`data-material="${v.cup}"`);
      expect(html).toContain(`data-testid="cup-tag" data-color="${v.label}"`);
    }
    expect(macro({ ...base, cup: 'metal' }, null, false)).toContain('stroke="#64748b"');
    expect(macro({ ...base, cup: 'plastic' }, null, false)).not.toContain('stroke="#64748b"');
    expect(macro({ ...base, label: 'yellow' }, null, false)).toContain('fill="#facc15"');
    expect(macro({ ...base, label: 'green' }, null, false)).toContain('fill="#22c55e"');
    expect(outerWaterTop(300)).toBeLessThan(outerWaterTop(100));
    expect(INNER_WATER_TOP).toBeLessThan(outerWaterTop(100));
  });

  it('온도계: 온도가 높을수록 수은 기둥이 위에 있다 (안쪽·바깥)', () => {
    for (const k of ['inner', 'outer'] as const) {
      expect(mercuryTop(k, 70)).toBeLessThan(mercuryTop(k, 40));
      expect(mercuryTop(k, 40)).toBeLessThan(mercuryTop(k, 20));
      expect(mercuryTop(k, 99)).toBe(mercuryTop(k, 80));
      expect(mercuryTop(k, -5)).toBe(mercuryTop(k, 0));
    }
  });

  it('이름표 색은 그림 색만 바꾼다: 같은 시각의 온도 표시가 같다', () => {
    for (const v of CONDITIONS) {
      const w = { ...v, label: 'green' };
      const y = { ...v, label: 'yellow' };
      expect(shownText(macro(w, at(w, 5))).filter((t) => /°C$/.test(t) && !t.startsWith('안쪽 컵') && !t.startsWith('바깥:') && !t.startsWith('비커')))
        .toEqual(shownText(macro(y, at(y, 5))).filter((t) => /°C$/.test(t) && !t.startsWith('안쪽 컵') && !t.startsWith('바깥:') && !t.startsWith('비커')));
    }
  });
});

describe('열화상으로 보기', () => {
  it('두 물의 색은 열화상 색(20 °C 파랑 → 40 °C 노랑 → 60 °C 빨강)이고 숫자 온도 글자가 함께 있다', () => {
    for (const v of CONDITIONS) {
      for (const t of TIMES) {
        const s = at(v, t);
        const html = thermal(v, s);
        expect(html).toContain(`data-testid="thermal-inner" data-color="${thermalColor(s.innerC)}"`);
        expect(html).toContain(`data-testid="thermal-outer" data-color="${thermalColor(s.outerC)}"`);
        expect(html).toContain(`안쪽 컵 물 ${s.innerC.toFixed(1)} °C`);
        expect(html).toContain(`바깥 비커 물 ${s.outerC.toFixed(1)} °C`);
      }
    }
    expect(thermalColor(20)).not.toBe(thermalColor(60));
    // 실행 전에는 처음 온도(안쪽 60 °C, 바깥 20 °C)
    const html = thermal(base, null, false);
    expect(html).toContain('안쪽 컵 물 60.0 °C');
    expect(html).toContain('바깥 비커 물 20.0 °C');
    expect(html).toContain('계산으로 그린 열화상 그림이에요');
  });

  it('색 막대 범례에 20·40·60 눈금과 °C 단위가 있다', () => {
    const html = thermal(base, at(base, 0));
    for (const t of ['20', '40', '60', '°C']) expect(shownText(html)).toContain(t);
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(24가지) × 실행 전·여러 시각의 눈으로 보기·열화상 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [HeatContactSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [HeatContactSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), thermal(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(2000);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...heatContactModule.resultColumns(experiment).map((c) => c.label),
      ...heatContactModule.sensors(null, base).map((s) => s.label),
      heatContactModule.graph.yLabel,
      heatContactModule.graph.xLabel!,
      ...heatContactModule.graph.series!.map((s) => s.label),
      '20분 넘음',
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
      '열이 이동해요',
      '열이 이동합니다',
      '열이 옮겨 가요',
      '열이 옮겨 갑니다',
      '열이 전달돼요',
      '열이 전달됩니다',
      '열이 전해져요',
      '열이 흘러가요',
      '열이 빠져나가요',
      '따뜻한 쪽에서 차가운 쪽으로 가요',
      '따뜻한 물에서 찬물로 가요',
      '뜨거운 쪽에서 차가운 쪽으로 가요',
      '뜨거운 물에서 찬물로 가요',
      '두 온도가 같아질 때까지 변해요',
      '두 온도가 같아요',
      '온도가 같아져요',
      '온도가 같아집니다',
      '온도가 같아질 거예요',
      '찬물이 많을수록 더 낮아져요',
      '찬물이 많으면 더 낮아요',
      '찬물이 많을수록 온도가 더 낮아요',
      '찬물이 많을수록 덜 올라가요',
      '이름표 색은 관계없어요',
      '이름표 색은 상관없습니다',
      '이름표 색은 영향이 없어요',
      '이름표 색과 관계없이 같아요',
      '이름표 색이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['안쪽 컵 재료만 바꾸었을 때 두 물의 온도는 어떻게 달라졌나요?', '바깥 찬물의 양만 바꾸었을 때 결과가 달라졌나요?', '열화상 화면의 색 변화를 살펴볼까요?', '이름표 색만 바꾸었을 때 결과가 달라졌나요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
