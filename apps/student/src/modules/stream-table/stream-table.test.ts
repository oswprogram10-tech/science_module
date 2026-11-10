import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { simulateStream, type StreamSample } from '@sci/engine-earth';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { streamTableModule } from './index';
import { streamNote, startSample } from './initial';
import { StreamMacroView, fanHeight, fanWidth, grooveDepth } from './StreamMacroView';
import { BIG_COUNT, SMALL_COUNT, StreamGrainView } from './StreamGrainView';

const land = UNITS.find((u) => u.id === 'g4-land')!;
const unit = land.ok ? land.activities[1] : undefined;
if (!land.ok || !unit || unit.activity !== 'variable') throw new Error('g4-land의 두 번째 활동(stream-table)이 없어요');
const experiment = unit.experiment;
type V = { slope: string; waterL: number; vessel: string };
const base: V = { slope: 'gentle', waterL: 1, vessel: 'cup' };
const sim = (v: V) => simulateStream(v as never);
const at = (v: V, t: number): StreamSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: StreamSample | null, ran = true) =>
  renderToStaticMarkup(createElement(StreamMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const micro = (v: V, snapshot: StreamSample | null, ran = true, playhead = 0) =>
  renderToStaticMarkup(createElement(StreamGrainView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const attr = (html: string, id: string, name: string) => new RegExp(`data-testid="${id}"[^>]*? ${name}="([^"]*)"`).exec(html)?.[1];

describe('레지스트리', () => {
  it('g4-land의 두 번째 활동은 stream-table 모듈로 로드된다', () => {
    expect(land.ok && land.manifest.grade).toBe(4);
    expect(land.ok && land.activities.map((a) => a.experiment.id)).toEqual(['magma-cooling', 'stream-table']);
    expect(unit.module).toBe(streamTableModule);
    expect(MODULES['stream-table'].kind).toBe('stream-table');
    expect(experiment.safety).toEqual([]);
    expect(experiment.safetyChecklist).toBeUndefined();
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 4줄', () => {
    const cols = streamTableModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['깎인 흙(g)', '쌓인 흙(g)']);
    const row = (slope: string, waterL: number) => cols.map((c) => c.value(sim({ slope, waterL, vessel: 'cup' }).result));
    expect(row('gentle', 1)).toEqual(['20', '16']);
    expect(row('gentle', 2)).toEqual(['40', '32']);
    expect(row('steep', 1)).toEqual(['50', '40']);
    expect(row('steep', 2)).toEqual(['100', '80']);
  });

  it('센서: 가상 전자저울: 쌓인 흙(scale) 하나, 받침 100 g을 빼서 쌓인 흙의 무게를 보여 준다', () => {
    const specs = streamTableModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 전자저울: 쌓인 흙', 'scale', 'g']]);
    expect(specs[0]!.source + 100).toBe(0);
    expect(streamTableModule.sensors(at(base, 60), base)[0]!.source + 100).toBeCloseTo(16, 10);
  });

  it('그래프 설정: 두 선(깎인 흙 실선·쌓인 흙 점선), y 0~100 고정, x 0~60초, 함수형 표식 "붓기 끝"', () => {
    const g = streamTableModule.graph;
    expect([g.yLabel, g.yTicks, g.xLabel, g.xTicks]).toEqual(['흙의 양(g)', [0, 20, 40, 60, 80, 100], '시간(초)', [0, 10, 20, 30, 40, 50, 60]]);
    expect(g.series!.map((x) => [x.key, x.label, x.dash])).toEqual([['eroded', '깎인 흙(g)', undefined], ['deposited', '쌓인 흙(g)', '7 4']]);
    expect(typeof g.markers).toBe('function');
    const markers = g.markers as (e: unknown, t: unknown) => { t: number; label: string }[];
    expect(markers(experiment, trialOf(base))).toEqual([{ t: 20, label: '붓기 끝' }]);
    expect(markers(experiment, trialOf({ ...base, waterL: 2 }))).toEqual([{ t: 40, label: '붓기 끝' }]);
    expect(streamTableModule.restPlayhead).toBe(60);
    expect(streamTableModule.metric.sampleKey).toBe('eroded');
    expect(streamTableModule.metric.resultKey).toBe('eroded');
  });

  it('예측 비교는 깎인 흙(g): 가파르게·2 L는 늘어남, 그릇은 변하지 않음', () => {
    const m = streamTableModule.metric;
    const eroded = (v: V) => sim(v).result[m.resultKey as 'eroded'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(eroded(base), eroded({ ...base, slope: 'steep' }), th)).toBe('increase');
    expect(observedOutcome(eroded(base), eroded({ ...base, waterL: 2 }), th)).toBe('increase');
    expect(observedOutcome(eroded({ ...base, waterL: 2 }), eroded(base), th)).toBe('decrease');
    expect(observedOutcome(eroded(base), eroded({ ...base, vessel: 'bottle' }), th)).toBe('same');
  });

  it('그래프 y 최댓값은 100 안이다', () => {
    for (const slope of ['gentle', 'steep']) for (const waterL of [1, 2]) {
      expect(Math.max(...sim({ slope, waterL, vessel: 'cup' }).samples.map((s) => s.eroded))).toBeLessThanOrEqual(100);
    }
  });

  it('그래프가 그려지고 두 선·표식·범례가 있다', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: streamTableModule as never, experiment, trial: trialOf(base), prev: undefined, playhead: 60, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('흙의 양(g)');
    expect(html).toContain('붓기 끝');
    expect(count(html, 'graph-series')).toBe(2);
    expect(html).toContain('stroke-dasharray="7 4"');
    expect(count(html, 'graph-legend-item')).toBe(2);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}초 · 깎인 흙 {E} g · 쌓인 흙 {D} g"', () => {
    expect(streamNote(at(base, 60))).toBe('60.0초 · 깎인 흙 20 g · 쌓인 흙 16 g');
    expect(macro(base, at(base, 60))).toContain('60.0초 · 깎인 흙 20 g · 쌓인 흙 16 g');
    expect(streamNote(at({ slope: 'steep', waterL: 2, vessel: 'cup' }, 60))).toBe('60.0초 · 깎인 흙 100 g · 쌓인 흙 80 g');
  });

  it('라벨 "깎인 곳", "쌓인 곳"이 한 번씩 있다 (실행 전후 모두)', () => {
    for (const html of [macro(base, null, false), macro(base, at(base, 60))]) {
      for (const label of ['깎인 곳', '쌓인 곳']) expect(html.match(new RegExp(`>${label}</text>`, 'g')), label).toHaveLength(1);
    }
  });

  it('실행 전에는 결과를 드러내지 않는다: 골 0, 흙 더미 없음, 물·그릇·물받이 물 없음, 안내 문구', () => {
    for (const v of [base, { ...base, slope: 'steep', waterL: 2 }]) {
      const html = macro(v, null, false);
      expect(attr(html, 'groove', 'data-depth')).toBe('0.0');
      expect(count(html, 'deposit-fan')).toBe(0);
      expect(count(html, 'water-stream')).toBe(0);
      expect(count(html, 'vessel')).toBe(0);
      expect(count(html, 'tray-water')).toBe(0);
      expect(html).toContain('실험하면');
      expect(html).not.toContain('깎인 흙');
    }
  });

  it('골은 깎인 흙에 비례해 깊어지고, 흙 더미는 쌓인 흙에 따라 커진다', () => {
    expect(grooveDepth(0)).toBe(0);
    expect(grooveDepth(50)).toBeCloseTo(grooveDepth(100) / 2, 10);
    expect(fanWidth(80)).toBeGreaterThan(fanWidth(16));
    expect(fanHeight(80)).toBeGreaterThan(fanHeight(16));
    const gentle = macro(base, at(base, 60));
    const steepV = { ...base, slope: 'steep', waterL: 2 };
    const steep = macro(steepV, at(steepV, 60));
    expect(Number(attr(steep, 'groove', 'data-depth'))).toBeGreaterThan(Number(attr(gentle, 'groove', 'data-depth')));
    expect(Number(attr(steep, 'deposit-fan', 'data-width'))).toBeGreaterThan(Number(attr(gentle, 'deposit-fan', 'data-width')));
    expect(Number(attr(steep, 'deposit-fan', 'data-height'))).toBeGreaterThan(Number(attr(gentle, 'deposit-fan', 'data-height')));
    // 붓는 동안 쌓이는 것은 2초 늦게 시작한다
    expect(count(macro(base, at(base, 1)), 'deposit-fan')).toBe(0);
    expect(count(macro(base, at(base, 10)), 'deposit-fan')).toBe(1);
  });

  it('물줄기와 그릇 아이콘은 붓는 동안에만 보인다 (붓기가 끝나면 물만 잠깐 남고, 다 흐르면 사라진다)', () => {
    const during = macro(base, at(base, 10));
    expect(count(during, 'water-stream')).toBe(1);
    expect(count(during, 'vessel')).toBe(1);
    const tail = macro(base, at(base, 21));
    expect(count(tail, 'water-stream')).toBe(1);
    expect(count(tail, 'vessel')).toBe(0);
    const end = macro(base, at(base, 60));
    expect(count(end, 'water-stream')).toBe(0);
    expect(count(end, 'vessel')).toBe(0);
  });

  it('그릇 아이콘은 컵·페트병에 따라 다르고, 그릇 말고는 그림이 같다', () => {
    expect(attr(macro(base, at(base, 10)), 'vessel', 'data-kind')).toBe('cup');
    const bottle = { ...base, vessel: 'bottle' };
    expect(attr(macro(bottle, at(bottle, 10)), 'vessel', 'data-kind')).toBe('bottle');
    const strip = (h: string) => h.replace(/<g data-testid="vessel".*?<\/g>/, '');
    expect(strip(macro(bottle, at(bottle, 10)))).toBe(strip(macro(base, at(base, 10))));
  });

  it('물받이 물은 부은 물의 양을 따라 늘어난다', () => {
    expect(count(macro(base, at(base, 0)), 'tray-water')).toBe(0);
    expect(count(macro(base, at(base, 10)), 'tray-water')).toBe(1);
    expect(count(macro(base, at(base, 60)), 'tray-mud')).toBe(1);
  });

  it('startSample은 t = 0', () => {
    expect(startSample(base, experiment).t).toBe(0);
  });
});

describe('흙 알갱이 보기', () => {
  it('라벨 "물", "흙 알갱이"가 한 번씩 있고 아래 문구가 있다', () => {
    for (const ran of [false, true]) {
      const html = micro(base, ran ? at(base, 60) : null, ran);
      for (const label of ['물', '흙 알갱이']) expect(html.match(new RegExp(`>${label}</text>`, 'g')), label).toHaveLength(1);
      expect(html).toContain('흐르는 물은 흙 알갱이를 함께 옮겨요.');
    }
  });

  it('작은 알갱이와 큰 알갱이가 함께 있고, 실행 전에는 가만히 있으며 물이 없다', () => {
    const html = micro(base, null, false);
    expect(count(html, 'small-grain')).toBe(SMALL_COUNT);
    expect(count(html, 'big-grain')).toBe(BIG_COUNT);
    expect(count(html, 'grain-water')).toBe(0);
    expect(html).toContain('data-running="false"');
    expect(html).toContain('data-state="idle"');
  });

  it('붓는 동안 움직이고 물이 있으며, 붓기가 끝난 뒤에는 멈춰서 쌓인다', () => {
    const moving = micro(base, at(base, 10), true, 10);
    expect(moving).toContain('data-running="true"');
    expect(count(moving, 'grain-water')).toBe(1);
    const stopped = micro(base, at(base, 30), true, 30);
    expect(stopped).toContain('data-running="false"');
    expect(stopped).toContain('data-state="settled"');
    expect(count(stopped, 'grain-water')).toBe(0);
    // 끝에 닿으면 위치가 고정이다
    expect(micro(base, at(base, 60), true, 60)).toBe(micro(base, at(base, 60), true, 60));
  });

  it('가파른 언덕의 물이 완만한 언덕보다 깊다 (흐름이 세다)', () => {
    const depthOf = (v: V) => {
      const html = micro(v, at(v, 10), true, 10);
      const pts = /data-testid="grain-water" points="([^"]+)"/.exec(html)![1]!.split(' ').map((p) => p.split(',').map(Number));
      return pts[0]![1]! - pts[1]![1]!;
    };
    expect(depthOf({ ...base, slope: 'steep' })).toBeGreaterThan(depthOf(base));
  });
});
