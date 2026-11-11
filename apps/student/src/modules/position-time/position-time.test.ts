import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { PT_OBJECTS, PT_SPEED_MS, PT_WATCH_S, PT_WEATHER, flashPositions, simulatePositionTime, type PositionTimeSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { positionTimeModule } from './index';
import { OBJECT_TEXT, RULER_MAX, WEATHER_TEXT, rulerTicks } from './initial';
import { H as MACRO_H, PositionMacroView, W as MACRO_W, X0, X1, xOf } from './PositionMacroView';
import { MAX_ROWS, PositionLogView, logRows } from './PositionLogView';

const unit = UNITS.find((u) => u.id === 'g6-motion')!;
if (!unit.ok) throw new Error('g6-motion이 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g6-motion 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { object: string; watchS: number; weather: string };
const base: V = { object: 'bike', watchS: 5, weather: 'sunny' };
const CONDITIONS: V[] = PT_OBJECTS.flatMap((object) => PT_WATCH_S.flatMap((watchS) => PT_WEATHER.map((weather) => ({ object, watchS, weather }))));
const sim = (v: V) => positionTimeModule.simulate(v, experiment) as ReturnType<typeof simulatePositionTime>;
const timesOf = (v: V) => [0, 0.5, 1, 2.5, 5, 7.5, 10].filter((t) => t <= v.watchS);
const at = (v: V, t: number): PositionTimeSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: PositionTimeSample | null, ran = true) => renderToStaticMarkup(createElement(PositionMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const log = (v: V, snapshot: PositionTimeSample | null, ran = true) => renderToStaticMarkup(createElement(PositionLogView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);

describe('레지스트리', () => {
  it('g6-motion 활동 2는 position-time 모듈로 로드되고 첫 활동(ramp-cart)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['물체의 운동', 6, 'physics', ['6과10-01', '6과10-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'ramp-cart', 'ramp-cart'], ['variable', 'position-time', 'position-time']]);
    expect(unit.module.kind).toBe('ramp-cart');
    expect(activity.module).toBe(positionTimeModule);
    expect(MODULES['position-time'].kind).toBe('position-time');
    expect(experiment.safety).toEqual([]);
    expect(positionTimeModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['시간에 따른 위치 변화', '어떤 물체가 운동했는지 어떻게 알 수 있을까?', '예측: 관찰하는 동안 물체가 움직인 거리는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['object', '보는 물체', 'bike'], ['watchS', '관찰 시간', 5], ['weather', '날씨', 'sunny']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['bike', '자전거'], ['walker', '걷는 사람'], ['snail', '달팽이'], ['tree', '나무']],
      [[5, '5초'], [10, '10초']],
      [['sunny', '맑음'], ['cloudy', '흐림']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['distM', '움직인 거리', 'm'], ['endM', '나중 위치', 'm']]);
    expect(experiment.limits).toEqual(['속도', '가속도', '변위', '등속', '벡터']);
    expect(PT_OBJECTS.map((o) => OBJECT_TEXT[o])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(PT_WEATHER.map((o) => WEATHER_TEXT[o])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표(5초: 자전거 20.00, 사람 6.00, 달팽이 0.05, 나무 0.00)의 움직인 거리와 나중 위치(소수 둘째 자리), 날씨 무영향', () => {
    const cols = positionTimeModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['움직인 거리(m)', '나중 위치(m)']);
    const row = (object: string, watchS = 5, weather = 'sunny') => cols.map((c) => c.value(sim({ object, watchS, weather }).result));
    for (const weather of ['sunny', 'cloudy']) {
      expect(row('bike', 5, weather)).toEqual(['20.00', '20.00']);
      expect(row('walker', 5, weather)).toEqual(['6.00', '6.00']);
      expect(row('snail', 5, weather)).toEqual(['0.05', '0.05']);
      expect(row('tree', 5, weather)).toEqual(['0.00', '0.00']);
      expect(row('bike', 10, weather)).toEqual(['40.00', '40.00']);
      expect(row('snail', 10, weather)).toEqual(['0.10', '0.10']);
    }
  });

  it('센서는 없다(거리 센서의 눈금은 소수 첫째 자리라 달팽이의 0.05 m를 읽을 수 없다)', () => {
    expect(positionTimeModule.sensors(null, base)).toEqual([]);
    expect(positionTimeModule.sensors(at(base, 1), base)).toEqual([]);
  });

  it('그래프 설정: x 0~10초, y 0~40 m 고정, 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = positionTimeModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['위치(m)', undefined, [0, 10, 20, 30, 40], '시간(초)', [0, 2, 4, 6, 8, 10], undefined, undefined]);
    expect(positionTimeModule.restPlayhead).toBeUndefined();
    expect(positionTimeModule.metric.sampleKey).toBe('posM');
    expect(positionTimeModule.metric.resultKey).toBe('distM');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.posM))).toBeLessThanOrEqual(40);
      expect(Math.min(...s.map((x) => x.posM))).toBeGreaterThanOrEqual(0);
      expect(s.at(-1)!.t).toBe(v.watchS);
    }
  });

  it('예측 비교는 움직인 거리: 자전거→사람은 줄어듦, 5초→10초는 늘어남, 날씨는 변하지 않음, 달팽이↔나무(0.05 m)도 서로 다름', () => {
    const m = positionTimeModule.metric;
    const dist = (v: V) => sim(v).result[m.resultKey as 'distM'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.005);
    expect(observedOutcome(dist(base), dist({ ...base, object: 'walker' }), th)).toBe('decrease');
    expect(observedOutcome(dist({ ...base, object: 'walker' }), dist({ ...base, object: 'walker', watchS: 10 }), th)).toBe('increase');
    expect(observedOutcome(dist({ ...base, object: 'snail' }), dist({ ...base, object: 'tree' }), th)).toBe('decrease');
    expect(observedOutcome(dist({ ...base, object: 'tree' }), dist({ ...base, object: 'snail' }), th)).toBe('increase');
    for (const v of CONDITIONS) expect(observedOutcome(dist(v), dist({ ...v, weather: v.weather === 'sunny' ? 'cloudy' : 'sunny' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, watchS: 10 };
    const html = renderToStaticMarkup(createElement(GraphView, { module: positionTimeModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 10, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('위치');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '10', '20', '30', '40']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 조건과 상관없이 결과를 그리지 않는다: 출발 위치(0.00 m)에 서 있고 1초 간격 겹침 그림이 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html, JSON.stringify(v)).toContain('data-ran="no"');
      expect(html).toContain('data-pos="0.00"');
      expect(html).toContain('data-ghosts="0"');
      expect(count(html, 'flash')).toBe(0);
      expect(html).toContain('실험하면 위치가 나타나요');
      expect(html).not.toMatch(/지금 위치 \d/);
    }
  });

  it('실행한 뒤 지금 위치와 1초 간격으로 겹쳐 그린 그림 수가 모델과 같다', () => {
    for (const v of CONDITIONS) {
      for (const t of timesOf(v)) {
        const s = at(v, t);
        const html = macro(v, s);
        expect(html, JSON.stringify([v, t])).toContain(`data-pos="${s.posM.toFixed(2)}"`);
        expect(html).toContain(`지금 위치 ${s.posM.toFixed(2)} m`);
        // 겹침 그림: 지금보다 앞선 1초 간격 자리 가운데 서로 1 그림 단위 넘게 떨어진 것
        const ghosts = Number(html.match(/data-ghosts="(\d+)"/)![1]);
        expect(count(html, 'flash')).toBe(ghosts);
        const xs = flashPositions(v.object as 'bike', v.watchS).filter((f) => f.t < t - 1e-9).map((f) => xOf(v.object as 'bike', f.posM));
        const xNow = xOf(v.object as 'bike', s.posM);
        const distinct = xs.reduce<number[]>((acc, x) => (Math.abs(x - (acc.at(-1) ?? xNow)) >= 1 && Math.abs(x - xNow) >= 1 ? [...acc, x] : acc), []);
        expect(ghosts).toBe(distinct.length);
      }
    }
    // 자전거 5초: 0~4초의 다섯 자리가 겹쳐 그려지고, 나무는 움직이지 않아 겹침이 없다
    expect(count(macro(base, at(base, 5)), 'flash')).toBe(5);
    expect(count(macro({ ...base, object: 'tree' }, at({ ...base, object: 'tree' }, 5)), 'flash')).toBe(0);
  });

  it('물체 위치는 눈금자 안이고 눈금자 끝(자전거 40, 걷는 사람 12, 달팽이 0.1, 나무 1 m)과 눈금 글자가 맞다', () => {
    expect(RULER_MAX).toEqual({ bike: 40, walker: 12, snail: 0.1, tree: 1 });
    // 10초 동안 가는 거리가 눈금자 끝과 같다
    for (const o of ['bike', 'walker', 'snail'] as const) expect(PT_SPEED_MS[o] * 10).toBeCloseTo(RULER_MAX[o], 9);
    expect(rulerTicks('bike')).toEqual([0, 20, 40]);
    expect(rulerTicks('snail')).toEqual([0, 0.05, 0.1]);
    for (const v of CONDITIONS) {
      const x = xOf(v.object as 'bike', sim(v).result.endM);
      expect(x).toBeGreaterThanOrEqual(X0);
      expect(x).toBeLessThanOrEqual(X1);
      expect(X0 - 16).toBeGreaterThanOrEqual(0);
      expect(X1 + 16).toBeLessThanOrEqual(MACRO_W);
    }
    expect(MACRO_H).toBeGreaterThan(200);
    const html = macro(base, null, false);
    expect([...html.matchAll(/data-testid="ruler-tick"[^>]*>(.*?)<\/text>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ''))).toEqual(['0', '20', '40m']);
  });

  it('조건 라벨: 보는 물체·날씨·관찰 시간 글자와 날씨 그림(맑음 해, 흐림 구름)', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, v.watchS));
      expect(html).toContain(`보는 물체: ${OBJECT_TEXT[v.object as 'bike']}`);
      expect(html).toContain(`날씨: ${WEATHER_TEXT[v.weather as 'sunny']}`);
      expect(html).toContain(`관찰 시간 ${v.watchS}초`);
      expect(html).toContain(`data-weather="${v.weather}"`);
    }
  });

  it('날씨는 위치·글자(날씨 줄 빼고)·겹침 그림을 바꾸지 않는다 (대조 변인)', () => {
    const strip = (h: string) => shownText(h).filter((t) => !t.startsWith('날씨') && !t.includes('날씨 '));
    for (const v of CONDITIONS) {
      const other = { ...v, weather: v.weather === 'sunny' ? 'cloudy' : 'sunny' };
      for (const t of timesOf(v)) {
        expect(strip(macro(v, at(v, t)))).toEqual(strip(macro(other, at(other, t))));
        expect(count(macro(v, at(v, t)), 'flash')).toBe(count(macro(other, at(other, t)), 'flash'));
      }
    }
  });
});

describe('위치 기록표', () => {
  it('시행이 없으면 기록이 없고 안내만 있다', () => {
    const html = log(base, null, false);
    expect(count(html, 'log-row')).toBe(0);
    expect(html).toContain('실험하면 1초마다 위치가 기록돼요');
    expect(logRows('bike', 5, null)).toEqual([]);
  });

  it('1초마다 한 줄씩, 지금 시각까지만 적고 끝에는 결과의 나중 위치와 같다', () => {
    for (const v of CONDITIONS) {
      for (const t of timesOf(v)) {
        const html = log(v, at(v, t));
        const rows = [...html.matchAll(/data-testid="log-row" data-t="([\d.]+)" data-pos="([\d.]+)"/g)].map((m) => [Number(m[1]), m[2]]);
        const expected = flashPositions(v.object as 'bike', v.watchS).filter((f) => f.t <= t + 1e-9).map((f) => [f.t, f.posM.toFixed(2)]);
        expect(rows, JSON.stringify([v, t])).toEqual(expected);
      }
      const end = logRows(v.object as 'bike', v.watchS, { t: v.watchS });
      expect(end.at(-1)!.t).toBe(v.watchS);
      expect(end.at(-1)!.posM.toFixed(2)).toBe(sim(v).result.endM.toFixed(2));
      expect(end.length).toBeLessThanOrEqual(MAX_ROWS);
    }
    expect(logRows('walker', 5, { t: 3 }).map((r) => r.posM)).toEqual([0, 1.2, 2.4, 3.6]);
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(16가지) × 실행 전·여러 시각의 눈으로 보기·위치 기록표 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [PositionTimeSample | null, boolean][] = [[null, false], ...timesOf(v).map((t) => [at(v, t), true] as [PositionTimeSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), log(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(800);
  });

  it('변인·결과 열·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...positionTimeModule.resultColumns(experiment).map((c) => c.label),
      positionTimeModule.graph.yLabel,
      positionTimeModule.graph.xLabel!,
    ];
    for (const t of shown) expect(guardOutput(t, guard).ok, t).toBe(true);
  });

  it('질문(probe) 문장은 모두 질문형이고, 모든 probe × 모든 변인 이름 치환으로도 가드를 통과한다', () => {
    const labels = experiment.variables.map((v) => v.label);
    for (const probe of experiment.tutor.probes) {
      expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
      for (const f of experiment.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
      for (const l of experiment.limits) expect(probe.text, probe.text).not.toContain(l);
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
      '위치가 변하면 운동이에요',
      '위치가 변하면 운동한 거예요',
      '위치가 바뀌면 운동해요',
      '위치가 변하지 않으면 운동하지 않아요',
      '위치가 바뀌지 않으면 운동하지 않은 거예요',
      '나무는 운동하지 않아요',
      '나무는 운동하지 않습니다',
      '달팽이도 운동해요',
      '달팽이도 운동한 거예요',
      '날씨는 관계없어요',
      '날씨는 상관없습니다',
      '날씨는 영향이 없어요',
      '날씨와 관계없이 같아요',
      '날씨가 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['보는 물체만 바꾸었을 때 움직인 거리는 어떻게 달라졌나요?', '날씨만 바꾸었을 때 움직인 거리는 달라졌나요?', '그래프에서 시간에 따른 위치의 변화도 견주어 볼까요?', '1초마다 겹쳐 그린 그림에서 위치를 짚어 볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
