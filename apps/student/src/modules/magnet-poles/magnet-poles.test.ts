import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { POLE_COVERS, POLE_FACINGS, POLE_GAPS, POLE_SIZES, simulateMagnetPoles, type MagnetPolesSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { magnetPolesModule } from './index';
import { COVER_TEXT, FACING_TEXT, MOTION_TEXT, SIZE_TEXT, polesNote, startSample } from './initial';
import { CM, LEFT_X, MAG_H, MAG_W, POLE_FILL, PolesMacroView, TABLE_Y, W as MACRO_W, halves, needleDir, rightX } from './PolesMacroView';
import { PolesRulerView, rulerX } from './PolesRulerView';

const unit = UNITS.find((u) => u.id === 'g4-magnet')!;
if (!unit.ok) throw new Error('g4-magnet이 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g4-magnet 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { facing: string; gapCm: number; size: string; cover: string };
const base: V = { facing: 'NS', gapCm: 1, size: 'small', cover: 'color' };
const CONDITIONS: V[] = POLE_FACINGS.flatMap((facing) => POLE_GAPS.flatMap((gapCm) => POLE_SIZES.flatMap((size) => POLE_COVERS.map((cover) => ({ facing, gapCm, size, cover })))));
const sim = (v: V) => magnetPolesModule.simulate(v, experiment) as ReturnType<typeof simulateMagnetPoles>;
const at = (v: V, t: number): MagnetPolesSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: MagnetPolesSample | null, ran = true) => renderToStaticMarkup(createElement(PolesMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const ruler = (v: V, snapshot: MagnetPolesSample | null, ran = true) => renderToStaticMarkup(createElement(PolesRulerView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.5, 1, 1.5, 2];

describe('레지스트리', () => {
  it('g4-magnet 활동 2는 magnet-poles 모듈로 로드되고 첫 활동(magnet-distance)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['자석의 이용', 4, 'physics', ['4과09-01', '4과09-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'magnet-distance', 'magnet-distance'], ['variable', 'magnet-poles', 'magnet-poles']]);
    expect(unit.module.kind).toBe('magnet-distance');
    expect(activity.module).toBe(magnetPolesModule);
    expect(MODULES['magnet-poles'].kind).toBe('magnet-poles');
    expect(experiment.safety).toEqual([]);
    expect(magnetPolesModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['자석과 자석 사이', '자석과 자석을 가까이 하면 어떤 일이 생길까?', '예측: 오른쪽 자석은 어느 쪽으로 움직일까?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['facing', '마주 보는 극', 'NS'], ['gapCm', '두 자석 사이 거리', 1], ['size', '자석 크기', 'small'], ['cover', '자석 겉 색칠', 'color']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['NN', 'N극–N극'], ['NS', 'N극–S극'], ['SS', 'S극–S극']],
      [[1, '1 cm'], [2, '2 cm'], [4, '4 cm']],
      [['small', '작은 자석'], ['large', '큰 자석']],
      [['color', '빨강·파랑'], ['gray', '회색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['motion', '오른쪽 자석의 움직임', ''], ['moveCm', '움직인 거리', 'cm']]);
    expect(experiment.limits).toEqual(['자기장', '자기력선', '테슬라', '인력', '척력']);
    expect(POLE_FACINGS.map((s) => FACING_TEXT[s])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(POLE_SIZES.map((s) => SIZE_TEXT[s])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
    expect(POLE_COVERS.map((s) => COVER_TEXT[s])).toEqual(experiment.variables[3]!.options.map((o) => o.label));
  });
});

describe('결과 열(범주 포함)·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표(범주 + 소수 첫째 자리 cm)와 색칠 무영향', () => {
    const cols = magnetPolesModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['오른쪽 자석의 움직임', '움직인 거리(cm)']);
    const row = (facing: string, gapCm: number, size: string, cover = 'color') => cols.map((c) => c.value(sim({ facing, gapCm, size, cover }).result));
    for (const cover of ['color', 'gray']) {
      expect(row('NN', 1, 'small', cover)).toEqual(['밀려남', '4.0']);
      expect(row('NN', 2, 'small', cover)).toEqual(['밀려남', '1.0']);
      expect(row('NN', 4, 'small', cover)).toEqual(['움직이지 않음', '0.0']);
      expect(row('SS', 1, 'large', cover)).toEqual(['밀려남', '6.0']);
      expect(row('SS', 2, 'large', cover)).toEqual(['밀려남', '2.0']);
      expect(row('SS', 4, 'large', cover)).toEqual(['밀려남', '0.5']);
      expect(row('NS', 1, 'small', cover)).toEqual(['다가와 붙음', '1.0']);
      expect(row('NS', 4, 'small', cover)).toEqual(['움직이지 않음', '0.0']);
      expect(row('NS', 4, 'large', cover)).toEqual(['다가와 붙음', '4.0']);
    }
    expect(Object.values(MOTION_TEXT)).toEqual(['다가와 붙음', '밀려남', '움직이지 않음']);
  });

  it('센서: 가상 거리 센서(distance, cm) 하나, 실험 전에는 고른 처음 거리, 실행 중에는 두 자석 사이 거리', () => {
    const specs = magnetPolesModule.sensors(null, { ...base, gapCm: 2 });
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 거리 센서: 두 자석 사이', 'distance', 'cm']]);
    expect(specs[0]!.source).toBe(2);
    const v = { ...base, facing: 'NN', size: 'large' };
    expect(magnetPolesModule.sensors(at(v, 2), v)[0]!.source).toBe(7);
  });

  it('그래프 설정: y 0~10 cm 고정(0, 2, 4, 6, 8, 10), x 0~2초(0, 1, 2), 선 하나, 재생이 끝나면 끝(2초)에 둔다', () => {
    const g = magnetPolesModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['두 자석 사이 거리(cm)', undefined, [0, 2, 4, 6, 8, 10], '시간(초)', [0, 1, 2], undefined, undefined]);
    expect(magnetPolesModule.restPlayhead).toBeUndefined();
    expect(magnetPolesModule.metric.sampleKey).toBe('gapCm');
    expect(magnetPolesModule.metric.resultKey).toBe('moveCm');
    for (const v of CONDITIONS) expect(Math.max(...sim(v).samples.map((s) => s.gapCm))).toBeLessThanOrEqual(10);
  });

  it('예측 비교는 움직인 거리(cm): 다른 극 → 같은 극은 늘어남, 큰 자석은 늘어남, 거리 4 cm는 줄어듦, 색칠은 변하지 않음 (기준 0.05 cm)', () => {
    const m = magnetPolesModule.metric;
    const move = (v: V) => sim(v).result[m.resultKey as 'moveCm'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.05);
    expect(observedOutcome(move(base), move({ ...base, facing: 'NN' }), th)).toBe('increase');
    expect(observedOutcome(move({ ...base, facing: 'NN' }), move({ ...base, facing: 'NN', size: 'large' }), th)).toBe('increase');
    expect(observedOutcome(move({ ...base, facing: 'NN' }), move({ ...base, facing: 'NN', gapCm: 4 }), th)).toBe('decrease');
    for (const v of CONDITIONS) expect(observedOutcome(move(v), move({ ...v, cover: v.cover === 'color' ? 'gray' : 'color' }), th)).toBe('same');
    // N극–N극과 S극–S극은 변하지 않는다
    expect(observedOutcome(move({ ...base, facing: 'NN' }), move({ ...base, facing: 'SS' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, facing: 'NN', size: 'large' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: magnetPolesModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('두 자석 사이 거리(cm)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '2', '4', '6', '8', '10']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}초 · 두 자석 사이 {cm} cm"', () => {
    const v = { ...base, facing: 'NN' };
    expect(polesNote(at(v, 2))).toBe('2.0초 · 두 자석 사이 5.0 cm');
    expect(polesNote(at(base, 2))).toBe('2.0초 · 두 자석 사이 0.0 cm');
    expect(macro(v, at(v, 2))).toContain('2.0초 · 두 자석 사이 5.0 cm');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 오른쪽 자석은 처음 거리에, 문구에 숫자가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain(`data-gap="${v.gapCm.toFixed(2)}"`);
      expect(html).toContain(`data-x="${rightX(v.gapCm).toFixed(1)}"`);
      expect(html).toContain('실험하면');
      expect(html).not.toContain('두 자석 사이 ');
      expect(count(html, 'magnet')).toBe(2);
      expect(count(html, 'compass')).toBe(2);
      expect(ruler(v, null, false)).toContain('처음 두 자석 사이는');
    }
  });

  it('극 글자 N/S와 색을 함께 쓴다: 마주 보는 극에 따라 네 글자가 맞고, 색칠이 회색이면 두 극이 같은 회색이 된다', () => {
    expect(halves('NN')).toEqual({ left: ['S', 'N'], right: ['N', 'S'] });
    expect(halves('NS')).toEqual({ left: ['S', 'N'], right: ['S', 'N'] });
    expect(halves('SS')).toEqual({ left: ['N', 'S'], right: ['S', 'N'] });
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 0));
      const letters = [...html.matchAll(/data-testid="pole-letter">([NS])</g)].map((m) => m[1]);
      const h = halves(v.facing as never);
      expect(letters, JSON.stringify(v)).toEqual([...h.left, ...h.right]);
      const fills = [...html.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="30" height="\d+" fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
      expect(fills).toEqual([...h.left, ...h.right].map((p) => POLE_FILL[v.cover as 'color'][p]));
      if (v.cover === 'gray') expect(new Set(fills).size).toBe(1);
      else expect(new Set(fills).size).toBe(2);
    }
  });

  it('마주 보는 두 극이 가운데 있다: 왼쪽 자석의 오른쪽 절반과 오른쪽 자석의 왼쪽 절반이 마주 본다', () => {
    expect(halves('NS').left[1]).toBe('N');
    expect(halves('NS').right[0]).toBe('S');
    for (const f of POLE_FACINGS) {
      const h = halves(f);
      expect(`${h.left[1]}${h.right[0]}`).toBe(f);
      expect(h.left[0]).not.toBe(h.left[1]);
      expect(h.right[0]).not.toBe(h.right[1]);
    }
  });

  it('나침반 바늘의 빨간 쪽은 자석의 S극 절반을 가리킨다', () => {
    expect(needleDir(['S', 'N'])).toBe(-1);
    expect(needleDir(['N', 'S'])).toBe(1);
    const html = macro({ ...base, facing: 'NS' }, at(base, 0));
    // N극–S극: 왼쪽 자석은 [S, N] → 왼쪽, 오른쪽 자석은 [S, N] → 왼쪽
    expect([...html.matchAll(/data-red-dir="(-?1)"/g)].map((m) => m[1])).toEqual(['-1', '-1']);
    const nn = macro({ ...base, facing: 'NN' }, at(base, 0));
    expect([...nn.matchAll(/data-red-dir="(-?1)"/g)].map((m) => m[1])).toEqual(['-1', '1']);
    const ss = macro({ ...base, facing: 'SS' }, at(base, 0));
    expect([...ss.matchAll(/data-red-dir="(-?1)"/g)].map((m) => m[1])).toEqual(['1', '-1']);
  });

  it('오른쪽 자석 위치: 끝에서 다가와 붙으면 왼쪽 자석에 닿고(간격 0), 밀려나면 처음보다 멀어지고, 움직이지 않으면 그대로다', () => {
    const attract = { ...base, facing: 'NS' };
    expect(macro(attract, at(attract, 2))).toContain(`data-x="${rightX(0).toFixed(1)}"`);
    expect(rightX(0)).toBe(LEFT_X + MAG_W);
    const repel = { ...base, facing: 'NN' };
    expect(macro(repel, at(repel, 2))).toContain(`data-x="${rightX(5).toFixed(1)}"`);
    const still = { ...base, facing: 'NN', gapCm: 4 };
    expect(macro(still, at(still, 2))).toContain(`data-x="${rightX(4).toFixed(1)}"`);
    expect(rightX(2) - rightX(1)).toBe(CM);
  });

  it('모든 조건·시각에서 그림이 폭 안에 있다: 오른쪽 자석 오른쪽 끝 ≤ 폭 − 10, 자석은 탁자 위', () => {
    for (const v of CONDITIONS) {
      for (const s of sim(v).samples) {
        expect(rightX(s.gapCm) + MAG_W).toBeLessThanOrEqual(MACRO_W - 10);
        expect(rightX(s.gapCm)).toBeGreaterThanOrEqual(LEFT_X + MAG_W - 1e-9);
      }
    }
    expect(TABLE_Y - MAG_H.large).toBeGreaterThan(60);
  });

  it('색칠 그림만 바뀐다: 결과·움직임은 같다 (회색이면 극 색이 같아짐)', () => {
    for (const v of CONDITIONS.filter((x) => x.cover === 'color')) {
      const g = { ...v, cover: 'gray' };
      expect(sim(g)).toEqual(sim(v));
      expect(macro(g, at(g, 2))).not.toBe(macro(v, at(v, 2)));
    }
  });

  it('startSample은 t = 0, 처음 거리', () => {
    expect(startSample({ ...base, gapCm: 4 })).toEqual({ t: 0, gapCm: 4 });
  });
});

describe('거리 재기', () => {
  it('자 위에 두 자석 사이 거리 표시: 실행 전 처음 거리, 끝에서는 끝 거리', () => {
    const v = { ...base, facing: 'NN', size: 'large' };
    expect(ruler(v, null, false)).toContain('data-gap="1.00"');
    expect(ruler(v, at(v, 2))).toContain('data-gap="7.00"');
    expect(ruler(v, at(v, 2))).toContain('7.0 cm');
    expect(rulerX(0)).toBe(10);
    expect(rulerX(10)).toBe(230);
    const html = ruler(base, at(base, 2));
    expect(html).toContain('data-gap="0.00"');
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(36가지) × 실행 전·여러 시각의 눈으로 보기·거리 재기 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [MagnetPolesSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [MagnetPolesSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), ruler(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(2000);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열(범주 포함)·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...magnetPolesModule.resultColumns(experiment).map((c) => c.label),
      ...Object.values(MOTION_TEXT),
      ...CONDITIONS.flatMap((v) => magnetPolesModule.resultColumns(experiment).map((c) => c.value(sim(v).result))),
      ...magnetPolesModule.sensors(null, base).map((s) => s.label),
      magnetPolesModule.graph.yLabel,
      magnetPolesModule.graph.xLabel!,
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
      '같은 극끼리 밀어요',
      '같은 극끼리 밀어내요',
      '같은 극끼리 밀려요',
      '같은 극끼리는 밀어요',
      '같은 극끼리는 밀어냅니다',
      '같은 극끼리는 밀려나요',
      '같은 극은 서로 밀어요',
      '같은 극이면 밀려요',
      '같은 극을 마주 대면 밀려요',
      '같은 극끼리 미는 힘이 생겨요',
      '같은 극끼리는 서로 밀어요',
      '같은 극끼리 서로 밀어내요',
      '같은 극은 서로 미는 힘이 있어요',
      '다른 극끼리 끌어요',
      '다른 극끼리 끌어당겨요',
      '다른 극끼리는 끌어요',
      '다른 극끼리는 끌어당깁니다',
      '다른 극은 서로 끌어요',
      '다른 극이면 끌려요',
      '다른 극을 마주 대면 끌려요',
      '다른 극끼리 끄는 힘이 생겨요',
      '다른 극은 서로 끄는 힘이 있어요',
      '다른 극끼리 당겨요',
      '다른 극끼리 서로 끌어당겨요',
      '다른 극끼리는 서로 끌려요',
      '다른 극끼리는 서로 당겨요',
      '다른 극은 서로 당기는 힘이 있어요',
      '가까울수록 세게 밀어요',
      '가까울수록 세게 당겨요',
      '가까울수록 힘이 세져요',
      '가까우면 세게 작용해요',
      '가까울수록 힘이 강해요',
      '가까워질수록 힘이 세요',
      '가까울수록 강해요',
      '가까울수록 커져요',
      '멀수록 힘이 작아요',
      '멀어질수록 힘이 줄어요',
      '멀수록 약해요',
      '멀수록 약해집니다',
      '멀어질수록 약해져요',
      '색칠은 관계없어요',
      '색칠은 상관없습니다',
      '색칠은 영향이 없어요',
      '색칠과 관계없이 같아요',
      '색칠이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['마주 보는 극만 바꾸었을 때 오른쪽 자석은 어느 쪽으로 움직였나요?', '자석 크기만 바꾸었어요. 움직인 거리는 어떻게 달라졌나요?', '자석 겉 색칠만 바꾸었을 때 결과가 달라졌나요?', '나침반 바늘이 가리키는 쪽을 살펴볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
