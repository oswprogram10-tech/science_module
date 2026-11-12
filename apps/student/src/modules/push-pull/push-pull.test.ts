import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { PUSH_ACTIONS, PUSH_COLORS, PUSH_OBJECTS, PUSH_STRENGTHS, simulatePushPull, type PushPullSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { pushPullModule } from './index';
import { ACTION_TEXT, COLOR_TEXT, DIRECTION_TEXT, OBJECT_TEXT, SHAPE_TEXT, STRENGTH_TEXT, pushNote, startSample } from './initial';
import { CM, FILL, HALF_W, PULL_HAND_X, PushMacroView, START_X, W as MACRO_W, clayScale, objectX } from './PushMacroView';
import { PushTapeView, tapeX, W as TAPE_W } from './PushTapeView';

const unit = UNITS.find((u) => u.id === 'g3-force')!;
if (!unit.ok) throw new Error('g3-force가 없어요');
const activity = unit.activities[2]!;
if (activity.activity !== 'variable') throw new Error('g3-force 활동 3이 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { object: string; action: string; strength: string; color: string };
const base: V = { object: 'cart', action: 'push', strength: 'weak', color: 'red' };
const CONDITIONS: V[] = PUSH_OBJECTS.flatMap((object) => PUSH_ACTIONS.flatMap((action) => PUSH_STRENGTHS.flatMap((strength) => PUSH_COLORS.map((color) => ({ object, action, strength, color })))));
const sim = (v: V) => pushPullModule.simulate(v, experiment) as ReturnType<typeof simulatePushPull>;
const at = (v: V, t: number): PushPullSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: PushPullSample | null, ran = true) => renderToStaticMarkup(createElement(PushMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const tape = (v: V, snapshot: PushPullSample | null, ran = true) => renderToStaticMarkup(createElement(PushTapeView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.25, 0.5, 1, 1.4, 2];

describe('레지스트리', () => {
  it('g3-force 활동 3은 push-pull 모듈로 로드되고 앞 활동 둘은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['힘과 우리 생활', 3, 'physics', ['4과01-01', '4과01-02', '4과01-03', '4과01-04']]);
    expect(unit.activities.map((a) => a.experiment.id)).toEqual(['lever-balance', 'lever-lift', 'push-pull', 'spring-scale']);
    expect(unit.module.kind).toBe('lever-balance');
    expect(activity.module).toBe(pushPullModule);
    expect(MODULES['push-pull'].kind).toBe('push-pull');
    expect(experiment.safety).toEqual([]);
    expect(pushPullModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['밀고 당기면 생기는 변화', '물체를 밀거나 당기면 물체에 어떤 변화가 생길까?', '예측: 물체가 움직인 거리는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['object', '물체', 'cart'], ['action', '하는 일', 'push'], ['strength', '힘의 세기', 'weak'], ['color', '물체 색깔', 'red']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['cart', '장난감 수레'], ['ball', '고무공'], ['clay', '찰흙 덩어리']],
      [['push', '밀기'], ['pull', '당기기']],
      [['weak', '약하게'], ['strong', '세게']],
      [['red', '빨간색'], ['blue', '파란색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['distance', '움직인 거리', 'cm'], ['direction', '움직인 방향', ''], ['shape', '모양', '']]);
    expect(experiment.limits).toEqual(['뉴턴', '가속도', '관성', '마찰력']);
    expect(PUSH_OBJECTS.map((s) => OBJECT_TEXT[s])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(PUSH_ACTIONS.map((s) => ACTION_TEXT[s])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(PUSH_STRENGTHS.map((s) => STRENGTH_TEXT[s])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
    expect(PUSH_COLORS.map((s) => COLOR_TEXT[s])).toEqual(experiment.variables[3]!.options.map((o) => o.label));
  });

  it('예측 문구와 실행 전 probe는 예측 버튼(늘어난다·줄어든다·변하지 않는다)에 맞는 양, 움직인 거리를 묻는다', () => {
    expect(experiment.predictionPrompt).toContain('움직인 거리');
    const before = experiment.tutor.probes.find((p) => p.when === 'before-run')!;
    expect(before.text).toContain('움직인 거리');
  });
});

describe('결과 열(범주 포함)·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표(거리 + 방향·모양 범주)와 색깔 무영향', () => {
    const cols = pushPullModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['움직인 거리(cm)', '움직인 방향', '모양']);
    const row = (object: string, action: string, strength: string, color = 'red') => cols.map((c) => c.value(sim({ object, action, strength, color }).result));
    for (const color of ['red', 'blue']) {
      expect(row('cart', 'push', 'weak', color)).toEqual(['30', '손에서 멀어지는 쪽', '그대로']);
      expect(row('cart', 'pull', 'strong', color)).toEqual(['80', '손 쪽으로', '그대로']);
      expect(row('ball', 'push', 'strong', color)).toEqual(['50', '손에서 멀어지는 쪽', '그대로']);
      expect(row('clay', 'push', 'weak', color)).toEqual(['2', '손에서 멀어지는 쪽', '눌려 납작해짐']);
      expect(row('clay', 'pull', 'strong', color)).toEqual(['5', '손 쪽으로', '길게 늘어남']);
    }
    expect(Object.values(DIRECTION_TEXT)).toEqual(['손에서 멀어지는 쪽', '손 쪽으로']);
    expect(Object.values(SHAPE_TEXT)).toEqual(['그대로', '눌려 납작해짐', '길게 늘어남']);
  });

  it('센서: 가상 줄자(distance, cm) 하나, 실험 전에는 0, 끝에서는 움직인 거리', () => {
    const specs = pushPullModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 줄자: 출발점에서 떨어진 거리', 'distance', 'cm']]);
    expect(specs[0]!.source).toBe(0);
    const v = { ...base, strength: 'strong' };
    expect(pushPullModule.sensors(at(v, 2), v)[0]!.source).toBe(80);
  });

  it('그래프 설정: y 0~90 cm 고정(0, 30, 60, 90), x 0~2초(0, 1, 2), 선 하나, 재생이 끝나면 끝(2초)에 둔다', () => {
    const g = pushPullModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['출발점에서 떨어진 거리(cm)', undefined, [0, 30, 60, 90], '시간(초)', [0, 1, 2], undefined, undefined]);
    expect(pushPullModule.restPlayhead).toBeUndefined();
    expect(pushPullModule.metric.sampleKey).toBe('distanceCm');
    expect(pushPullModule.metric.resultKey).toBe('distance');
    for (const v of CONDITIONS) expect(Math.max(...sim(v).samples.map((s) => s.distanceCm))).toBeLessThanOrEqual(90);
  });

  it('예측 비교는 움직인 거리(cm): 세게 → 늘어남, 수레 → 찰흙은 줄어듦, 밀기 → 당기기와 색깔은 변하지 않음 (기준 0.5 cm)', () => {
    const m = pushPullModule.metric;
    const dist = (v: V) => sim(v).result[m.resultKey as 'distance'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(dist(base), dist({ ...base, strength: 'strong' }), th)).toBe('increase');
    expect(observedOutcome(dist(base), dist({ ...base, object: 'clay' }), th)).toBe('decrease');
    expect(observedOutcome(dist(base), dist({ ...base, action: 'pull' }), th)).toBe('same');
    for (const v of CONDITIONS) expect(observedOutcome(dist(v), dist({ ...v, color: v.color === 'red' ? 'blue' : 'red' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, strength: 'strong' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: pushPullModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('출발점에서 떨어진 거리(cm)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '30', '60', '90']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}초 · 출발점에서 {cm} cm"', () => {
    const v = { ...base, strength: 'strong' };
    expect(pushNote(at(v, 2))).toBe('2.0초 · 출발점에서 80 cm');
    expect(macro(v, at(v, 2))).toContain('2.0초 · 출발점에서 80 cm');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 물체는 출발점에, 모양은 그대로, 문구에 숫자가 없고 줄자에 거리 표시가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain(`data-x="${objectX(0).toFixed(1)}"`);
      expect(html).toContain('실험하면');
      expect(html).not.toContain('출발점에서');
      if (v.object === 'clay') expect(html).toContain('data-deform="0.00"');
      const t = tape(v, null, false);
      expect(t).not.toContain('tape-bracket');
      expect(t).not.toContain('tape-label');
      expect(t).toContain('실험하면');
    }
  });

  it('물체 위치는 출발점에서 거리만큼 가고, 모든 조건·시각에서 그림이 폭 안에 있다', () => {
    expect(objectX(10) - objectX(0)).toBeCloseTo(10 * CM, 9);
    for (const v of CONDITIONS) {
      const half = HALF_W[v.object as 'cart'];
      for (const s of sim(v).samples) {
        const sc = clayScale(v.object as 'cart', v.action as 'push', s.deform);
        expect(objectX(s.distanceCm) + half * sc.sx).toBeLessThanOrEqual(v.action === 'pull' ? PULL_HAND_X - 8 : MACRO_W - 4);
        expect(objectX(s.distanceCm) - half * sc.sx).toBeGreaterThanOrEqual(4);
      }
    }
    expect(START_X).toBe(40);
  });

  it('밀기에는 줄이 없고 손이 물체 왼쪽에 있으며, 당기기에는 줄이 있고 손이 오른쪽에 있다', () => {
    const push = macro(base, at(base, 2));
    expect(push).not.toContain('data-testid="string"');
    expect(push).toContain('data-action="push"');
    const pull = macro({ ...base, action: 'pull' }, at({ ...base, action: 'pull' }, 2));
    expect(pull).toContain('data-testid="string"');
    expect(pull).toContain('data-action="pull"');
    const handX = (html: string) => Number(/data-testid="hand" data-x="([\d.]+)"/.exec(html)![1]);
    expect(handX(push)).toBeLessThan(START_X);
    expect(handX(pull)).toBeGreaterThan(START_X + 80 * CM);
  });

  it('찰흙은 힘을 받으면 모양이 바뀐다: 밀면 납작(가로 ↑ 세로 ↓), 당기면 길게(가로 ↑ 세로 ↓ 더 길게), 다른 물체는 그대로다', () => {
    expect(clayScale('clay', 'push', 0)).toEqual({ sx: 1, sy: 1 });
    const flat = clayScale('clay', 'push', 1);
    const long = clayScale('clay', 'pull', 1);
    expect(flat.sx).toBeGreaterThan(1);
    expect(flat.sy).toBeLessThan(1);
    expect(long.sx).toBeGreaterThan(flat.sx);
    for (const o of ['cart', 'ball'] as const) for (const a of ['push', 'pull'] as const) expect(clayScale(o, a, 1)).toEqual({ sx: 1, sy: 1 });
    const clay = { ...base, object: 'clay', strength: 'strong' };
    expect(macro(clay, at(clay, 2))).toContain('data-deform="1.00"');
    expect(macro(clay, at(clay, 0))).toContain('data-deform="0.00"');
  });

  it('바닥의 자 눈금(0, 20, 40, 60, 80 cm)이 있다', () => {
    const html = macro(base, at(base, 0));
    expect(html).toContain('data-testid="floor-ruler"');
    const ruler = html.slice(html.indexOf('data-testid="floor-ruler"'));
    expect([...ruler.matchAll(/text-anchor="middle" font-size="14" fill="currentColor">(\d+)</g)].map((m) => m[1])).toEqual(['0', '20', '40', '60', '80']);
  });

  it('물체 색깔은 그림의 색만 바꾼다: 결과·움직임은 같다', () => {
    for (const v of CONDITIONS.filter((x) => x.color === 'red')) {
      const b = { ...v, color: 'blue' };
      expect(sim(b)).toEqual(sim(v));
      expect(macro(b, at(b, 2))).not.toBe(macro(v, at(v, 2)));
      expect(macro(v, at(v, 2))).toContain(FILL.red);
      expect(macro(b, at(b, 2))).toContain(FILL.blue);
    }
  });

  it('startSample은 t = 0, 출발점, 모양 그대로', () => {
    expect(startSample(base)).toEqual({ t: 0, distanceCm: 0, deform: 0 });
  });
});

describe('줄자로 재기', () => {
  it('거리 표시: 끝에서 움직인 거리, 눈금 0~90 cm', () => {
    const v = { ...base, strength: 'strong' };
    const html = tape(v, at(v, 2));
    expect(html).toContain('data-dist="80.00"');
    expect(html).toContain('80 cm');
    expect(tapeX(0)).toBe(10);
    expect(tapeX(90)).toBe(226);
    expect(tapeX(90)).toBeLessThanOrEqual(TAPE_W - 10);
    expect([...html.matchAll(/font-size="14" fill="currentColor">(\d+)</g)].map((m) => m[1])).toContain('90');
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(24가지) × 실행 전·여러 시각의 눈으로 보기·줄자 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [PushPullSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [PushPullSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), tape(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(1500);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열(범주 포함)·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const cols = pushPullModule.resultColumns(experiment);
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...cols.map((c) => c.label),
      ...Object.values(DIRECTION_TEXT),
      ...Object.values(SHAPE_TEXT),
      ...CONDITIONS.flatMap((v) => cols.map((c) => c.value(sim(v).result))),
      ...pushPullModule.sensors(null, base).map((s) => s.label),
      pushPullModule.graph.yLabel,
      pushPullModule.graph.xLabel!,
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
      '세게 밀수록 멀리 가요',
      '세게 밀수록 더 멀리 가요',
      '세게 밀면 멀리 가요',
      '세게 할수록 멀리 가요',
      '세게 하면 더 멀리 가요',
      '세게 당기면 더 멀리 와요',
      '힘이 클수록 멀리 가요',
      '힘이 클수록 더 멀리 가요',
      '힘이 셀수록 멀리 가요',
      '힘이 세면 멀리 가요',
      '밀면 멀어지고 당기면 가까워져요',
      '밀면 멀어져요',
      '밀면 손에서 멀어져요',
      '당기면 가까워져요',
      '당기면 손 쪽으로 와요',
      '당기면 내 쪽으로 와요',
      '찰흙은 모양이 변해요',
      '찰흙은 모양이 바뀌어요',
      '찰흙은 납작해져요',
      '힘을 주면 모양이 변해요',
      '힘을 주면 물체의 모양이 변해요',
      '힘을 받으면 모양이 바뀌어요',
      '힘은 모양과 움직임을 바꿔요',
      '색깔은 관계없어요',
      '색깔은 상관없습니다',
      '색깔은 영향이 없어요',
      '색깔과 관계없이 같아요',
      '색깔이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['힘의 세기만 바꾸었어요. 물체가 움직인 거리는 어떻게 달랐나요?', '밀 때와 당길 때 물체가 움직인 방향을 비교해 볼까요?', '물체 색깔만 바꾸었을 때 결과가 달라졌나요?', '결과표에서 모양을 찾아볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
