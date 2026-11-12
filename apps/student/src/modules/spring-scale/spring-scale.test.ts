import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { SPRING_COLORS, SPRING_OBJECTS, SPRING_WEIGHTS, simulateSpringScale, type SpringScaleSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { springScaleModule } from './index';
import { COLOR_FILL, COLOR_TEXT, OBJECT_TEXT, springNote, startSample } from './initial';
import { DISC, H as MACRO_H, OBJ, PER_CM, SpringMacroView, TRAY, W as MACRO_W, ZERO_Y, bottomY } from './SpringMacroView';
import { READING_MAX_G, SpringBarsView, barLength } from './SpringBarsView';

const unit = UNITS.find((u) => u.id === 'g3-force')!;
if (!unit.ok) throw new Error('g3-force가 없어요');
const activity = unit.activities[3]!;
if (activity.activity !== 'variable') throw new Error('g3-force 활동 4가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { weights: number; object: string; springColor: string };
const base: V = { weights: 0, object: 'none', springColor: 'yellow' };
const CONDITIONS: V[] = SPRING_WEIGHTS.flatMap((weights) => SPRING_OBJECTS.flatMap((object) => SPRING_COLORS.map((springColor) => ({ weights, object, springColor }))));
const sim = (v: V) => springScaleModule.simulate(v, experiment) as ReturnType<typeof simulateSpringScale>;
const at = (v: V, t: number): SpringScaleSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: SpringScaleSample | null, ran = true) => renderToStaticMarkup(createElement(SpringMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (v: V, snapshot: SpringScaleSample | null, ran = true) => renderToStaticMarkup(createElement(SpringBarsView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.4, 0.8, 1.2, 1.6, 2];

describe('레지스트리', () => {
  it('g3-force 활동 4는 spring-scale 모듈로 로드되고 앞 활동 셋은 그대로다', () => {
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([
      ['variable', 'lever-balance', 'lever-balance'],
      ['variable', 'lever-lift', 'lever-lift'],
      ['variable', 'push-pull', 'push-pull'],
      ['variable', 'spring-scale', 'spring-scale'],
    ]);
    expect(activity.module).toBe(springScaleModule);
    expect(MODULES['spring-scale'].kind).toBe('spring-scale');
    expect(experiment.safety).toEqual([]);
    expect(springScaleModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['용수철저울로 무게 비교하기', '무게가 비슷한 물체들의 무게를 어떻게 정확히 비교할 수 있을까?', '예측: 용수철이 늘어난 길이는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['weights', '건 추의 개수', 0], ['object', '함께 건 물체', 'none'], ['springColor', '용수철 색깔', 'yellow']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [[0, '0개'], [1, '1개'], [2, '2개'], [3, '3개'], [4, '4개'], [5, '5개']],
      [['none', '없음'], ['case', '필통'], ['scissors', '가위'], ['glue', '풀'], ['pencils', '색연필 묶음']],
      [['yellow', '노란색'], ['green', '초록색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['stretch', '용수철이 늘어난 길이', 'cm'], ['reading', '저울 눈금', 'g']]);
    expect(experiment.limits).toEqual(['뉴턴', '탄성', '훅의 법칙', '질량']);
    expect(SPRING_OBJECTS.map((s) => OBJECT_TEXT[s])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(SPRING_COLORS.map((s) => COLOR_TEXT[s])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
  });

  it('예측 문구와 실행 전 probe는 예측 버튼에 맞는 양, 용수철이 늘어난 길이를 묻는다', () => {
    expect(experiment.predictionPrompt).toContain('늘어난 길이');
    expect(experiment.tutor.probes.find((p) => p.when === 'before-run')!.text).toContain('늘어난 길이');
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 늘어난 길이(소수 첫째 자리 cm)와 저울 눈금(정수 g), 용수철 색깔 무영향', () => {
    const cols = springScaleModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['늘어난 길이(cm)', '저울 눈금(g)']);
    const row = (weights: number, object: string, springColor = 'yellow') => cols.map((c) => c.value(sim({ weights, object, springColor }).result));
    for (const color of ['yellow', 'green']) {
      expect(row(0, 'none', color)).toEqual(['0.0', '0']);
      expect(row(1, 'none', color)).toEqual(['2.0', '50']);
      expect(row(5, 'none', color)).toEqual(['10.0', '250']);
      expect(row(0, 'scissors', color)).toEqual(['2.8', '70']);
      expect(row(0, 'glue', color)).toEqual(['2.4', '60']);
      expect(row(0, 'pencils', color)).toEqual(['3.6', '90']);
      expect(row(0, 'case', color)).toEqual(['6.0', '150']);
      expect(row(5, 'case', color)).toEqual(['16.0', '400']);
    }
  });

  it('센서: 가상 저울(scale, g, 정수 표시) 하나, 실험 전에는 0, 끝에서는 눈금', () => {
    const specs = springScaleModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit, s.decimals])).toEqual([['가상 저울: 저울 눈금', 'scale', 'g', 0]]);
    expect(specs[0]!.source).toBe(-100);
    const v = { weights: 2, object: 'glue', springColor: 'yellow' };
    expect(springScaleModule.sensors(at(v, 2), v)[0]!.source).toBe(160 - 100);
  });

  it('그래프 설정: y 0~18 cm 고정(0, 3, …, 18), x 0~2초(0, 1, 2), 선 하나, 재생이 끝나면 끝(2초)에 둔다', () => {
    const g = springScaleModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['늘어난 길이(cm)', undefined, [0, 3, 6, 9, 12, 15, 18], '시간(초)', [0, 1, 2], undefined, undefined]);
    expect(springScaleModule.restPlayhead).toBeUndefined();
    expect(springScaleModule.metric.sampleKey).toBe('stretchCm');
    expect(springScaleModule.metric.resultKey).toBe('stretch');
    for (const v of CONDITIONS) expect(Math.max(...sim(v).samples.map((s) => s.stretchCm))).toBeLessThanOrEqual(18);
  });

  it('예측 비교는 늘어난 길이(cm): 추를 더 걸면 늘어남, 풀 → 가위는 늘어남(0.4 cm), 용수철 색깔은 변하지 않음 (기준 0.05 cm)', () => {
    const m = springScaleModule.metric;
    const stretch = (v: V) => sim(v).result[m.resultKey as 'stretch'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.05);
    expect(observedOutcome(stretch(base), stretch({ ...base, weights: 1 }), th)).toBe('increase');
    expect(observedOutcome(stretch({ ...base, weights: 3 }), stretch({ ...base, weights: 1 }), th)).toBe('decrease');
    expect(observedOutcome(stretch({ ...base, object: 'glue' }), stretch({ ...base, object: 'scissors' }), th)).toBe('increase');
    for (const v of CONDITIONS) expect(observedOutcome(stretch(v), stretch({ ...v, springColor: v.springColor === 'yellow' ? 'green' : 'yellow' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { weights: 5, object: 'case', springColor: 'yellow' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: springScaleModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('늘어난 길이(cm)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '3', '6', '9', '12', '15', '18']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}초 · 용수철이 {cm} cm 늘어남"', () => {
    const v = { weights: 2, object: 'none', springColor: 'yellow' };
    expect(springNote(at(v, 2))).toBe('2.0초 · 용수철이 4.0 cm 늘어남');
    expect(macro(v, at(v, 2))).toContain('2.0초 · 용수철이 4.0 cm 늘어남');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 용수철은 늘어나지 않았고, 추와 물체는 받침에 있으며, 문구에 숫자가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain('data-stretch="0.00"');
      expect(html).toContain('data-hung="no"');
      expect(html).toContain('실험하면');
      expect(html).not.toContain('늘어남');
      expect(count(html, 'weight-disc')).toBe(v.weights);
      expect(count(html, 'obj-box')).toBe(v.object === 'none' ? 0 : 1);
      const b = bars(v, null, false);
      expect(b).toContain('data-value="0.0"');
      expect(b).toContain('실험하면');
    }
  });

  it('실행하면 추와 물체가 걸리고 용수철이 늘어난 만큼 아래 끝이 내려간다', () => {
    for (const v of [{ weights: 3, object: 'case', springColor: 'yellow' }, { weights: 0, object: 'glue', springColor: 'green' }]) {
      const html = macro(v, at(v, 2));
      expect(html).toContain('data-hung="yes"');
      expect(html).toContain(`data-stretch="${sim(v).result.stretch.toFixed(2)}"`);
    }
    expect(bottomY(0)).toBe(ZERO_Y);
    expect(bottomY(10) - bottomY(0)).toBeCloseTo(10 * PER_CM, 9);
  });

  it('추 개수만큼 원판이 있고, 가위와 풀은 같은 크기의 상자라 눈으로 무게를 알 수 없다', () => {
    for (const w of SPRING_WEIGHTS) expect(count(macro({ ...base, weights: w }, at({ ...base, weights: w }, 2)), 'weight-disc')).toBe(w);
    const size = (object: string) => {
      const v = { ...base, object };
      const html = macro(v, at(v, 2));
      const box = /<g data-testid="obj-icon" data-object="\w+"><rect x="0" y="0" width="(\d+)" height="(\d+)"/.exec(html)!;
      return [box[1], box[2]];
    };
    expect(size('scissors')).toEqual(size('glue'));
    expect(size('scissors')).toEqual([String(OBJ.w), String(OBJ.h)]);
    for (const o of ['case', 'pencils']) expect(size(o)).toEqual(size('glue'));
  });

  it('모든 조건·시각에서 그림이 폭과 높이 안에 있다 (흔들릴 때 가장 아래까지)', () => {
    for (const v of CONDITIONS) {
      for (const s of sim(v).samples) {
        const stack = v.weights * (DISC.h + DISC.gap);
        const bottom = bottomY(s.stretchCm) + 10 + stack + (stack > 0 ? 4 : 0) + (v.object === 'none' ? 0 : OBJ.h);
        expect(bottom, JSON.stringify(v)).toBeLessThanOrEqual(MACRO_H - 4);
      }
    }
    expect(TRAY.objectX + OBJ.w / 2).toBeLessThanOrEqual(MACRO_W - 4);
    expect(TRAY.weightsX + DISC.w / 2).toBeLessThan(TRAY.objectX - OBJ.w / 2);
  });

  it('용수철 색깔은 그림의 색만 바꾼다: 결과·움직임은 같다', () => {
    for (const v of CONDITIONS.filter((x) => x.springColor === 'yellow')) {
      const g = { ...v, springColor: 'green' };
      expect(sim(g)).toEqual(sim(v));
      expect(macro(g, at(g, 2))).not.toBe(macro(v, at(v, 2)));
      expect(macro(v, at(v, 2))).toContain(COLOR_FILL.yellow);
      expect(macro(g, at(g, 2))).toContain(COLOR_FILL.green);
    }
  });

  it('startSample은 t = 0, 늘어나지 않음', () => {
    expect(startSample({ ...base, weights: 5 })).toEqual({ t: 0, stretchCm: 0, readingG: 0 });
  });
});

describe('눈금과 길이 보기', () => {
  it('막대: 실행 전에는 비어 있고, 끝에서는 결과만큼 채워진다 (눈금 0~400 g, 길이 0~18 cm)', () => {
    const v = { weights: 2, object: 'glue', springColor: 'yellow' };
    const html = bars(v, at(v, 2));
    expect(html).toContain('data-value="160.0"');
    expect(html).toContain('data-value="6.40"');
    expect(html).toContain('저울 눈금 160 g · 늘어난 길이 6.4 cm');
    expect(barLength(160, READING_MAX_G)).toBeCloseTo(88, 9);
    expect(barLength(500, READING_MAX_G)).toBe(220);
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(60가지) × 실행 전·여러 시각의 눈으로 보기·눈금과 길이 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [SpringScaleSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [SpringScaleSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), bars(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(3000);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const cols = springScaleModule.resultColumns(experiment);
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...cols.map((c) => c.label),
      ...CONDITIONS.flatMap((v) => cols.map((c) => c.value(sim(v).result))),
      ...springScaleModule.sensors(null, base).map((s) => s.label),
      springScaleModule.graph.yLabel,
      springScaleModule.graph.xLabel!,
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
      '추가 늘면 늘어난 길이도 늘어요',
      '추를 하나 더 걸 때마다 2 cm씩 늘어나요',
      '추를 하나 더 걸면 2 cm 늘어요',
      '추 한 개에 2 cm예요',
      '추 하나마다 2 cm씩이에요',
      '50 g마다 2 cm 늘어요',
      '50g마다 2cm예요',
      '무거울수록 많이 늘어나요',
      '무거울수록 더 길게 늘어나요',
      '무게가 클수록 많이 늘어나요',
      '무게가 클수록 길게 늘어나요',
      '가위가 풀보다 무거워요',
      '가위가 풀보다 더 무거워요',
      '풀이 가위보다 가벼워요',
      '필통이 가장 무거워요',
      '필통이 제일 무거워요',
      '용수철 색은 관계없어요',
      '용수철 색깔은 관계없어요',
      '용수철 색깔은 상관없습니다',
      '색깔은 상관없어요',
      '색깔은 영향이 없어요',
      '색깔이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['추를 하나 더 걸 때마다 늘어난 길이는 어떻게 변했나요?', '눈으로 보기에 비슷했던 두 물체를 저울로 재 보니 어떤가요?', '용수철 색깔만 바꾸었을 때 결과가 달라졌나요?', '저울 눈금이 같으면 두 물체의 무게에 대해 무엇을 말할 수 있을까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
