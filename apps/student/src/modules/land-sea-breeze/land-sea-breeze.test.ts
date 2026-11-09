import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { simulateBreeze, type BreezeSample } from '@sci/engine-earth';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { landSeaBreezeModule } from './index';
import { breezeNote, signedC } from './initial';
import { BreezeMacroView, lampBottomY, smokeLean } from './BreezeMacroView';
import { ARROW_COUNT, BreezeAirView, loopPoint, warmSide } from './BreezeAirView';

const unit = UNITS.find((u) => u.id === 'g5-weather')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g5-weather가 없어요');
const experiment = unit.experiment;
type V = { phase: string; lampCm: number; bowl: string };
const base: V = { phase: 'day', lampCm: 20, bowl: 'plastic' };
const night: V = { ...base, phase: 'night' };
const sim = (v: V) => simulateBreeze(v as never);
const at = (v: V, t: number): BreezeSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: BreezeSample | null, ran = true) =>
  renderToStaticMarkup(createElement(BreezeMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const air = (v: V, snapshot: BreezeSample | null, ran = true, playhead = 0) =>
  renderToStaticMarkup(createElement(BreezeAirView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const attr = (html: string, id: string, name: string) => new RegExp(`data-testid="${id}"[^>]*? ${name}="([^"]*)"`).exec(html)?.[1];
const arrowXs = (html: string) => [...html.matchAll(/data-testid="air-arrow" data-x="([^"]*)" data-y="([^"]*)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

describe('레지스트리', () => {
  it('g5-weather는 land-sea-breeze 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(5);
    expect(unit.module).toBe(landSeaBreezeModule);
    expect(MODULES['land-sea-breeze'].kind).toBe('land-sea-breeze');
    expect(experiment.safety).toEqual(['heat', 'fire']);
    expect(experiment.safetyChecklist).toHaveLength(3);
  });

  it('안전 문구는 산 용액용이 아니라 전등·향에 맞다', () => {
    const m = experiment.safetyMessages!;
    for (const text of Object.values(m)) expect(text).not.toMatch(/산성|용액|알코올|증발/);
    expect(m.NO_GOGGLES).toContain('향과 전등');
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 4줄 (온도 차는 + 기호, 바람 방향은 글자)', () => {
    const cols = landSeaBreezeModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['모래 온도(°C)', '물 온도(°C)', '온도 차(°C)', '바람 방향']);
    const row = (phase: string, lampCm: number) => cols.map((c) => c.value(sim({ phase, lampCm, bowl: 'glass' }).result));
    expect(row('day', 20)).toEqual(['34.7', '26.3', '+8.4', '바다 → 육지']);
    expect(row('day', 40)).toEqual(['23.7', '21.6', '+2.1', '바다 → 육지']);
    expect(row('night', 20)).toEqual(['21.2', '23.8', '−2.6', '육지 → 바다']);
    expect(row('night', 40)).toEqual(['20.3', '21.0', '−0.7', '육지 → 바다']);
    expect(signedC(0)).toBe('0.0');
  });

  it('온도 차 열은 모래 열 − 물 열과 같다', () => {
    const cols = landSeaBreezeModule.resultColumns(experiment);
    for (const phase of ['day', 'night']) for (const lampCm of [20, 40]) {
      const [sand, water, diff] = cols.slice(0, 3).map((c) => c.value(sim({ phase, lampCm, bowl: 'plastic' }).result));
      expect(Number(diff!.replace('−', '-'))).toBeCloseTo(Number(sand) - Number(water), 9);
    }
  });

  it('센서: 가상 온도계 두 개(모래·물), 실행 전에는 둘 다 20 °C라 어느 쪽이 따뜻한지 드러나지 않는다', () => {
    const idle = landSeaBreezeModule.sensors(null, night);
    expect(idle.map((s) => [s.label, s.kind, s.unit, s.ariaLabel, s.source])).toEqual([
      ['가상 온도계: 모래', 'temperature', '°C', '모래 온도', 20],
      ['가상 온도계: 물', 'temperature', '°C', '물 온도', 20],
    ]);
    expect(new Set(idle.map((s) => s.id)).size).toBe(2);
    const run = landSeaBreezeModule.sensors(at(base, 10), base);
    expect(run[0]!.source).toBeCloseTo(34.687, 2);
    expect(run[1]!.source).toBeCloseTo(26.295, 2);
  });

  it('그래프 설정: 두 선(모래 실선·물 점선), y 15~40 고정, x 0~10분, 표식 없음', () => {
    const g = landSeaBreezeModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks]).toEqual(['온도(°C)', 15, [15, 20, 25, 30, 35, 40], '시간(분)', [0, 2, 4, 6, 8, 10]]);
    expect(g.series!.map((x) => [x.key, x.label, x.dash])).toEqual([['sand', '모래 온도(°C)', undefined], ['water', '물 온도(°C)', '7 4']]);
    expect(g.series![0]!.color).not.toBe(g.series![1]!.color);
    expect(g.markers).toBeUndefined();
    expect(landSeaBreezeModule.restPlayhead).toBe(10);
    expect(landSeaBreezeModule.metric.resultKey).toBe('diff');
  });

  it('예측 비교는 온도 차: 40 cm는 줄어듦, 밤은 줄어듦, 그릇은 변하지 않음', () => {
    const m = landSeaBreezeModule.metric;
    const diff = (v: V) => sim(v).result[m.resultKey as 'diff'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.2);
    expect(observedOutcome(diff(base), diff({ ...base, lampCm: 40 }), th)).toBe('decrease');
    expect(observedOutcome(diff(base), diff(night), th)).toBe('decrease');
    expect(observedOutcome(diff(night), diff(base), th)).toBe('increase');
    expect(observedOutcome(diff(base), diff({ ...base, bowl: 'glass' }), th)).toBe('same');
  });

  it('그래프 y 범위 15~40 안에 모든 표본이 들어온다', () => {
    for (const phase of ['day', 'night']) for (const lampCm of [20, 40]) {
      for (const s of sim({ phase, lampCm, bowl: 'plastic' }).samples) {
        expect(s.sand).toBeGreaterThanOrEqual(15);
        expect(s.sand).toBeLessThanOrEqual(40);
        expect(s.water).toBeGreaterThanOrEqual(15);
        expect(s.water).toBeLessThanOrEqual(40);
      }
    }
  });

  it('그래프가 그려지고 두 선(점선 포함)·범례·표식 없음', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: landSeaBreezeModule as never, experiment, trial: trialOf(base), prev: trialOf(night), playhead: 10, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('온도(°C)');
    expect(count(html, 'graph-series')).toBe(2);
    expect(html).toContain('stroke-dasharray="7 4"');
    expect(count(html, 'graph-legend-item')).toBe(2);
    expect(count(html, 'graph-marker')).toBe(0);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}분 · 모래 {sand} °C · 물 {water} °C · 바람: {방향}"', () => {
    expect(breezeNote(at(base, 10))).toBe('10.0분 · 모래 34.7 °C · 물 26.3 °C · 바람: 바다 → 육지');
    expect(macro(base, at(base, 10))).toContain('10.0분 · 모래 34.7 °C · 물 26.3 °C · 바람: 바다 → 육지');
    expect(breezeNote(at(night, 10))).toBe('10.0분 · 모래 21.2 °C · 물 23.8 °C · 바람: 육지 → 바다');
    expect(breezeNote(at({ ...night, lampCm: 40 }, 0))).toContain('바람: 바다 → 육지');
    expect(breezeNote({ t: 0, sand: 20, water: 20, diff: 0 })).toContain('바람: 거의 없음');
  });

  it('낮에는 전등이 켜져 빛이 퍼지고 "낮" 라벨, 밤에는 꺼지고 어두운 배경과 "밤" 라벨', () => {
    const day = macro(base, at(base, 10));
    expect(attr(day, 'bulb', 'data-on')).toBe('true');
    expect(count(day, 'light-cone')).toBe(1);
    expect(count(day, 'stars')).toBe(0);
    expect(day).toContain('>낮</text>');
    expect(day).not.toContain('>밤</text>');
    const nightHtml = macro(night, at(night, 5));
    expect(attr(nightHtml, 'bulb', 'data-on')).toBe('false');
    expect(count(nightHtml, 'light-cone')).toBe(0);
    expect(nightHtml.match(/>밤<\/text>/g)).toHaveLength(1);
    expect(attr(nightHtml, 'box', 'data-phase')).toBe('night');
    expect(/data-testid="box"[^>]*fill="(#[0-9a-f]+)"/.exec(nightHtml)![1]).not.toBe(/data-testid="box"[^>]*fill="(#[0-9a-f]+)"/.exec(day)![1]);
  });

  it('전등 거리 치수와 전등 높이: 40 cm가 20 cm보다 높이 걸린다', () => {
    expect(attr(macro(base, null, false), 'lamp-distance', 'data-cm')).toBe('20');
    expect(macro({ ...base, lampCm: 40 }, null, false)).toContain('>40 cm</text>');
    expect(lampBottomY(40)).toBeLessThan(lampBottomY(20));
  });

  it('온도계 막대와 숫자: 오른쪽·왼쪽 각각, 15~40 °C 비율', () => {
    const html = macro(base, at(base, 10));
    expect(html).toMatch(/data-testid="sand-temp"[^>]*>34\.7 °C</);
    expect(html).toMatch(/data-testid="water-temp"[^>]*>26\.3 °C</);
    expect(Number(attr(html, 'sand-bar', 'data-h'))).toBeGreaterThan(Number(attr(html, 'water-bar', 'data-h')));
    expect(Number(attr(html, 'sand-bar', 'data-h'))).toBeCloseTo((94 * (34.687 - 15)) / 25, 0);
  });

  it('향 연기는 wind 부호 방향으로 기울고(바다 → 육지면 왼쪽 육지 쪽), 세기는 |wind|에 비례한다', () => {
    expect(smokeLean(1)).toBeLessThan(0);
    expect(smokeLean(-1)).toBeGreaterThan(0);
    expect(smokeLean(0.5)).toBeCloseTo(smokeLean(1) / 2, 10);
    expect(smokeLean(0)).toBe(0);
    const d = macro(base, at(base, 10));
    expect(attr(d, 'smoke', 'data-lean')).toBe('left');
    expect(Number(attr(d, 'smoke', 'data-dx'))).toBeLessThan(0);
    const n = macro(night, at(night, 10));
    expect(attr(n, 'smoke', 'data-lean')).toBe('right');
    expect(Number(attr(n, 'smoke', 'data-dx'))).toBeGreaterThan(0);
    // 낮 40 cm(온도 차 2.1)은 20 cm(8.4)보다 덜 기운다
    const weak = macro({ ...base, lampCm: 40 }, at({ ...base, lampCm: 40 }, 10));
    expect(Math.abs(Number(attr(weak, 'smoke', 'data-dx')))).toBeLessThan(Math.abs(Number(attr(d, 'smoke', 'data-dx'))));
    // 처음(t = 0, 온도 차 0)은 곧게 오른다
    expect(attr(macro(base, at(base, 0)), 'smoke', 'data-lean')).toBe('none');
    expect(Number(attr(macro(base, at(base, 0)), 'smoke', 'data-dx'))).toBe(0);
  });

  it('실행 전에는 어느 쪽이 따뜻한지 드러내지 않는다: 낮·밤 모두 같은 온도·곧은 연기·"?" 숫자', () => {
    for (const v of [base, night, { ...base, lampCm: 40 }]) {
      const html = macro(v, null, false);
      expect(html).toContain('? °C');
      expect(html).not.toContain('34.7');
      expect(attr(html, 'smoke', 'data-lean')).toBe('none');
      expect(attr(html, 'sand-bar', 'data-h')).toBe(attr(html, 'water-bar', 'data-h'));
      expect(html).toContain('실험하면');
      expect(html).not.toContain('바람:');
    }
  });

  it('시행이 있어도 스냅샷이 없으면 처음 상태(주변 온도)로 그린다', () => {
    expect(attr(macro(night, null, true), 'smoke', 'data-lean')).toBe('none');
  });
});

describe('공기의 움직임 보기', () => {
  it('실행 전에는 라벨·화살표·바탕색이 없고 안내 문구만 있다 (어느 쪽이 따뜻한지 드러나지 않는다)', () => {
    for (const v of [base, night]) {
      const html = air(v, null, false);
      expect(count(html, 'air-loop')).toBe(0);
      expect(count(html, 'air-arrow')).toBe(0);
      expect(count(html, 'air-tint')).toBe(0);
      for (const l of ['따뜻한 쪽', '차가운 쪽', '바닥 근처 바람']) expect(html).not.toContain(l);
      expect(html).not.toContain('땅 가까이에서는');
      expect(html).toContain('실험하면');
    }
  });

  it('낮이면 육지(왼쪽)가 따뜻한 쪽, 밤이면 바다(오른쪽)가 따뜻한 쪽으로 라벨이 붙는다', () => {
    const day = air(base, at(base, 10));
    expect(attr(day, 'air-loop', 'data-warm')).toBe('left');
    const xOf = (html: string, id: string) => Number(new RegExp(`data-testid="${id}" x="([^"]*)"`).exec(html)![1]);
    expect(xOf(day, 'label-warm')).toBeLessThan(xOf(day, 'label-cool'));
    const nightHtml = air(night, at(night, 10));
    expect(attr(nightHtml, 'air-loop', 'data-warm')).toBe('right');
    expect(xOf(nightHtml, 'label-warm')).toBeGreaterThan(xOf(nightHtml, 'label-cool'));
    for (const html of [day, nightHtml]) {
      for (const l of ['따뜻한 쪽', '차가운 쪽', '바닥 근처 바람']) expect(html.match(new RegExp(`>${l}</text>`, 'g')), l).toHaveLength(1);
      expect(html).toContain('땅 가까이에서는 공기가 차가운 쪽에서 따뜻한 쪽으로 옮겨 가요.');
      expect(count(html, 'air-arrow')).toBe(ARROW_COUNT);
    }
  });

  it('밤 시행이라도 t = 0에는 낮이 끝난 상태라 육지가 따뜻한 쪽이고, 끝에는 바다가 따뜻한 쪽이다', () => {
    expect(attr(air(night, at(night, 0)), 'air-loop', 'data-warm')).toBe('left');
    expect(attr(air(night, at(night, 10)), 'air-loop', 'data-warm')).toBe('right');
    expect(warmSide(0)).toBeNull();
    expect(warmSide(0.04)).toBeNull();
    expect(warmSide(0.1)).toBe('left');
    expect(warmSide(-0.1)).toBe('right');
  });

  it('온도 차가 0인 순간(낮의 처음)에는 화살표와 라벨이 없다', () => {
    const html = air(base, at(base, 0));
    expect(count(html, 'air-loop')).toBe(0);
    expect(html).toContain('두 쪽의 온도가 같아서');
  });

  it('고리: 따뜻한 쪽 위로 올라가고, 위쪽은 차가운 쪽으로, 바닥 근처는 차가운 쪽에서 따뜻한 쪽으로 흐른다', () => {
    // 따뜻한 쪽이 왼쪽: u = 0.1 은 왼쪽 기둥(위로), 아래쪽 줄은 오른쪽 → 왼쪽(180도)
    const up = loopPoint(0.1, 'left');
    expect(up.angle).toBe(-90);
    const top = loopPoint(0.35, 'left');
    expect(top.angle).toBe(0);
    const down = loopPoint(0.6, 'left');
    expect(down.angle).toBe(90);
    expect(down.x).toBeGreaterThan(up.x);
    const floor = loopPoint(0.9, 'left');
    expect(floor.angle).toBe(180);
    expect(floor.y).toBeGreaterThan(top.y);
    // 따뜻한 쪽이 오른쪽이면 좌우가 뒤집힌다
    const r = loopPoint(0.9, 'right');
    expect(r.angle).toBe(0);
    expect(r.x).toBeCloseTo(240 - floor.x, 10);
    expect(loopPoint(0.1, 'right').angle).toBe(-90);
    expect(loopPoint(0.1, 'right').x).toBeGreaterThan(120);
  });

  it('연기 기울기와 바닥 근처 화살표가 가리키는 쪽이 같다 (낮: 왼쪽 육지 쪽, 밤: 오른쪽 바다 쪽)', () => {
    for (const [v, t, expectedSign] of [[base, 10, -1], [night, 10, 1], [night, 0, -1]] as const) {
      const lean = Math.sign(Number(attr(macro(v, at(v, t)), 'smoke', 'data-dx')));
      const warm = attr(air(v, at(v, t)), 'air-loop', 'data-warm');
      // 바닥 근처 흐름은 따뜻한 쪽으로 향하고, 연기도 따뜻한 쪽으로 기운다
      expect(lean).toBe(expectedSign);
      expect(lean).toBe(warm === 'left' ? -1 : 1);
    }
  });

  it('화살표는 위상이 같으면 같은 자리이고(재생 끝에서 고정), 움직임 줄이기가 아니어도 끝에서는 멈춘다', () => {
    const a = air(base, at(base, 10), true, 10);
    expect(attr(a, 'air-loop', 'data-running')).toBe('false');
    expect(a).toBe(air(base, at(base, 10), true, 10));
    expect(arrowXs(a)).toHaveLength(ARROW_COUNT);
  });

  it('속도 표시는 |wind|에 비례한다', () => {
    const fast = attr(air(base, at(base, 10)), 'air-loop', 'data-speed');
    const slow = attr(air({ ...base, lampCm: 40 }, at({ ...base, lampCm: 40 }, 10)), 'air-loop', 'data-speed');
    expect(Number(fast)).toBeGreaterThan(Number(slow));
    expect(Number(fast)).toBeCloseTo(1, 5);
  });
});
