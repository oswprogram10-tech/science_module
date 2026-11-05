import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Trial } from '@sci/runtime';
import { UNITS } from '../units';
import { GraphView } from './GraphView';
import type { AnyModule } from '../modules/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTrial = Trial<any, any>;

const variableUnits = UNITS.flatMap((u) => (u.ok && u.activity === 'variable' ? [u] : []));

/** 모든 변인 선택지의 조합. */
function combos(unit: (typeof variableUnits)[number]): Record<string, string | number>[] {
  return unit.experiment.variables.reduce<Record<string, string | number>[]>(
    (acc, v) => acc.flatMap((c) => v.options.map((o) => ({ ...c, [v.key]: o.value }))),
    [{}],
  );
}

function trialOf(unit: (typeof variableUnits)[number], values: Record<string, string | number>): AnyTrial {
  const { samples, result } = unit.module.simulate(values, unit.experiment);
  return {
    id: 't1',
    index: 1,
    values,
    ivKey: null,
    prediction: null,
    samples,
    result,
    analysis: { kind: 'first-trial', changed: [] },
  } as AnyTrial;
}

const render = (unit: (typeof variableUnits)[number], mod: AnyModule, trial: AnyTrial | undefined) =>
  renderToStaticMarkup(
    createElement(GraphView, {
      module: mod,
      experiment: unit.experiment,
      trial,
      prev: undefined,
      playhead: 0,
      playing: false,
      onPlayhead: () => {},
      describedBy: 'results-table',
    }),
  );

describe('GraphView', () => {
  const existing = variableUnits.filter((u) => u.module.kind !== 'electromagnet' && u.module.kind !== 'magma-cooling' && u.module.kind !== 'sun-angle' && u.module.kind !== 'germination' && u.module.kind !== 'transpiration' && u.module.kind !== 'food-web' && u.module.kind !== 'mold-growth' && u.module.kind !== 'exercise-body' && u.module.kind !== 'lever-balance' && u.module.kind !== 'string-sound' && u.module.kind !== 'magnet-distance' && u.module.kind !== 'ramp-cart');

  it('기존 단원은 모든 조건에서 최댓값이 처음 값 또는 마지막 값이다 (y축 범위를 모든 표본의 최댓값으로 잡아도 달라지지 않는다)', () => {
    expect(existing.length).toBeGreaterThanOrEqual(5);
    for (const unit of existing) {
      const key = String(unit.module.metric.sampleKey);
      for (const values of combos(unit)) {
        const s = unit.module.simulate(values, unit.experiment).samples as Record<string, number>[];
        const all = Math.max(...s.map((p) => p[key]!));
        expect(all, `${unit.id} ${JSON.stringify(values)}`).toBe(Math.max(s[0]![key]!, s[s.length - 1]![key]!));
      }
    }
  });

  it('markers가 없는 기존 단원은 표식 없이 그려지고, markers를 더해도 표식 그룹 말고는 같다', () => {
    for (const unit of existing) {
      const trial = trialOf(unit, combos(unit)[0]!);
      const plain = render(unit, unit.module, trial);
      expect(plain).not.toContain('graph-marker');
      const withMarkers: AnyModule = {
        ...unit.module,
        graph: { ...unit.module.graph, markers: () => [{ t: 1, label: '표식' }] },
      };
      const marked = render(unit, withMarkers, trial);
      expect(marked).toContain('graph-marker');
      expect(marked.replace(/<g data-testid="graph-marker">.*?<\/g>/g, '')).toBe(plain);
    }
  });

  it('시행이 없으면 markers가 있어도 표식을 그리지 않는다', () => {
    const unit = variableUnits.find((u) => u.module.kind === 'electromagnet')!;
    expect(render(unit, unit.module, undefined)).not.toContain('graph-marker');
  });

  it('전자석 그래프는 2초와 14초에 켜짐·꺼짐 표식이 있고, 올랐다가 내려오는 곡선이 y축 안에 들어온다', () => {
    const unit = variableUnits.find((u) => u.module.kind === 'electromagnet')!;
    const html = render(unit, unit.module, trialOf(unit, { turns: 200, battery: 'series', core: 'nail', direction: 'forward' }));
    const groups = html.match(/<g data-testid="graph-marker">.*?<\/g>/g) ?? [];
    expect(groups).toHaveLength(2);
    expect(groups[0]).toContain('켜짐');
    expect(groups[1]).toContain('꺼짐');
    // 최대 30개: y축 눈금이 30 이상까지 있다 (처음·마지막 값은 0이다)
    expect(html).toMatch(/>(30|35)</);
    // 꺼짐 표식이 켜짐 표식보다 오른쪽
    const xs = groups.map((g) => Number(/x1="([\d.]+)"/.exec(g)![1]));
    expect(xs[1]!).toBeGreaterThan(xs[0]!);
  });
});

describe('정수 눈금(integerTicks)', () => {
  it('전자석 빨대 실험처럼 값이 작아도 y축 눈금에 소수가 없다', () => {
    const unit = variableUnits.find((u) => u.id === 'g6-electricity')!;
    const values = { turns: 200, battery: 'series', core: 'straw', direction: 'forward' };
    const html = render(unit, unit.module, trialOf(unit, values));
    const ticks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]!);
    expect(ticks.length).toBeGreaterThan(1);
    for (const t of ticks) expect(t).toMatch(/^\d+$/);
  });
});

describe('markers: 시행에서 계산하는 함수 형태', () => {
  const land = () => variableUnits.find((u) => u.id === 'g4-land')!;
  const markerXs = (html: string) =>
    (html.match(/<g data-testid="graph-marker">.*?<\/g>/g) ?? []).map((g) => Number(/x1="([\d.]+)"/.exec(g)![1]));
  const withValues = (values: Record<string, string | number>) => render(land(), land().module, trialOf(land(), values));
  const base = { place: 'room', grams: 5, dish: 'glass', color: 'white' };

  it('땅의 변화는 시행의 조건에 따라 표식 위치가 다르다 (같은 시행이 아니면 시각이 다르다)', () => {
    const room = markerXs(withValues(base));
    const warm = markerXs(withValues({ ...base, place: 'warm' }));
    expect(room).toHaveLength(2);
    expect(warm).toHaveLength(2);
    expect(room[1]!).toBeGreaterThan(room[0]!);
    expect(warm[1]!).toBeGreaterThan(warm[0]!);
    expect(warm).not.toEqual(room);
  });

  it('색깔만 바꾸면 표식도 그대로다', () => {
    expect(withValues({ ...base, color: 'black' })).toBe(withValues(base));
  });

  it('첫 라벨이 다음 표식 선을 가로지르게 되면 선의 왼쪽에 쓰고, 전자석처럼 멀면 둘 다 오른쪽 같은 줄이다', () => {
    const rows = (html: string) =>
      [...html.matchAll(/<g data-testid="graph-marker">.*?<text x="[\d.]+" y="([\d.]+)"/g)].map((m) => Number(m[1]));
    const closeHtml = withValues({ ...base, place: 'ice', dish: 'aluminum' });
    const groups = closeHtml.match(/<g data-testid="graph-marker">.*?<\/g>/g)!;
    expect(groups[0]).toContain('text-anchor="end"');
    expect(groups[1]).not.toContain('text-anchor');
    const el = variableUnits.find((u) => u.module.kind === 'electromagnet')!;
    const far = rows(render(el, el.module, trialOf(el, { turns: 100, battery: 'one', core: 'nail', direction: 'forward' })));
    expect(far).toHaveLength(2);
    expect(far[1]!).toBe(far[0]!);
  });

  it("labelSide: 'left'이면 자리가 넉넉해도 라벨을 선의 왼쪽에 쓰고, 없으면 지금처럼 오른쪽에 쓴다", () => {
    const unit = land();
    const mk = (labelSide?: 'left'): AnyModule => ({ ...unit.module, graph: { ...unit.module.graph, markers: [{ t: 1, label: '표식', labelSide }] } });
    const trial = trialOf(unit, base);
    expect(render(unit, mk('left'), trial)).toMatch(/<text x="[\d.]+" y="[\d.]+" text-anchor="end"[^>]*>표식</);
    const plain = render(unit, mk(), trial);
    expect(plain).not.toMatch(/text-anchor="end"[^>]*>표식</);
    expect(plain).toBe(render(unit, { ...unit.module, graph: { ...unit.module.graph, markers: [{ t: 1, label: '표식' }] } }, trial));
  });

  it('고정 배열도 지원한다', () => {
    const unit = land();
    const fixed: AnyModule = { ...unit.module, graph: { ...unit.module.graph, markers: [{ t: 5, label: '고정 표식' }] } };
    const html = render(unit, fixed, trialOf(unit, base));
    expect(html).toContain('고정 표식');
    expect(markerXs(html)).toHaveLength(1);
  });

  it('함수는 실험과 시행을 받는다', () => {
    const unit = land();
    let seen: unknown[] = [];
    const spy: AnyModule = {
      ...unit.module,
      graph: {
        ...unit.module.graph,
        markers: (exp: unknown, trial: unknown) => {
          seen = [exp, trial];
          return [];
        },
      },
    };
    const trial = trialOf(unit, base);
    render(unit, spy, trial);
    expect(seen[0]).toBe(unit.experiment);
    expect(seen[1]).toBe(trial);
  });
});

describe('x축 라벨·눈금(xLabel, xTicks, xTickFormat)', () => {
  const existing = variableUnits.filter((u) => u.module.kind !== 'sun-angle' && u.module.kind !== 'germination' && u.module.kind !== 'transpiration' && u.module.kind !== 'food-web' && u.module.kind !== 'mold-growth' && u.module.kind !== 'exercise-body' && u.module.kind !== 'lever-balance' && u.module.kind !== 'string-sound' && u.module.kind !== 'magnet-distance' && u.module.kind !== 'ramp-cart');
  const seasons = () => variableUnits.find((u) => u.id === 'g6-seasons')!;
  const base = { season: 'summer', tiltDeg: 23.44, stickCm: 10 };

  it('기존 단원은 x축 라벨이 "시간(초)"이고, 새 필드를 쓰지 않으며, 기본 라벨을 명시해도 똑같이 그려진다', () => {
    expect(existing.length).toBeGreaterThanOrEqual(7);
    for (const unit of existing) {
      expect(unit.module.graph.xLabel).toBeUndefined();
      expect(unit.module.graph.xTicks).toBeUndefined();
      expect(unit.module.graph.xTickFormat).toBeUndefined();
      const trial = trialOf(unit, combos(unit)[0]!);
      const plain = render(unit, unit.module, trial);
      expect(plain).toContain('>시간(초)<');
      expect(plain).toContain('초, ');
      const explicit: AnyModule = { ...unit.module, graph: { ...unit.module.graph, xLabel: '시간(초)' } };
      expect(render(unit, explicit, trial)).toBe(plain);
    }
  });

  it('xTickFormat만 항등 함수로 줘도 자동 눈금의 글자가 같다 (소수 자릿수가 없는 단원)', () => {
    const unit = variableUnits.find((u) => u.id === 'g4-land')!;
    const trial = trialOf(unit, { place: 'room', grams: 5, dish: 'glass', color: 'white' });
    const plain = render(unit, unit.module, trial);
    const fmt: AnyModule = { ...unit.module, graph: { ...unit.module.graph, xTickFormat: (t: number) => t.toFixed(0) } };
    expect(render(unit, fmt, trial)).toBe(plain);
  });

  it('계절의 변화 그래프는 "시각(시)" 라벨, 0·6·12·18·24 눈금, 12시 "남중" 표식이 있다', () => {
    const unit = seasons();
    const html = render(unit, unit.module, trialOf(unit, base));
    expect(html).toContain('>시각(시)<');
    expect(html).not.toContain('>시간(초)<');
    const xTicks = [...html.matchAll(/<text x="([\d.]+)" y="(\d+)" text-anchor="middle">(\d+)<\/text>/g)].filter((m) => Number(m[2]) > 200);
    expect(xTicks.map((m) => m[3])).toEqual(['0', '6', '12', '18', '24']);
    const groups = html.match(/<g data-testid="graph-marker">.*?<\/g>/g) ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]).toContain('남중');
    // 12시 표식은 x축의 정중앙(눈금 0과 24의 한가운데)에 있다
    const x1 = Number(/x1="([\d.]+)"/.exec(groups[0]!)![1]);
    expect(x1).toBeCloseTo((44 + (320 - 12)) / 2, 1);
    expect(html).toContain('태양 고도(°)');
  });

  it('계절의 변화 그래프 슬라이더의 읽기 값은 시 단위다', () => {
    const unit = seasons();
    const html = render(unit, unit.module, trialOf(unit, base));
    expect(html).toMatch(/aria-valuetext="0시, 태양 고도 0 °"/);
  });
});

describe('여러 선(graph.series)과 y축 눈금(graph.yTicks)', () => {
  const foodWeb = () => variableUnits.find((u) => u.id === 'g4-ecosystem')!;
  const base = { rabbits0: 10, foxes0: 2, rain: 'normal', furColor: 'white' };
  // series로 여러 선을 그리는 단원: 먹이 관계(세 선)와 우리 몸(맥박·호흡 두 선)
  const SERIES_UNITS = ['g4-ecosystem', 'g5-body'];
  const others = variableUnits.filter((u) => !SERIES_UNITS.includes(u.id));
  // yTicks로 축을 고정한 단원. 이 단원들은 'series: undefined는 그림을 바꾸지 않는다' 비교에서 yTicks를 남긴다.
  const FIXED_Y = ['g4-ecosystem', 'g4-microbe', 'g5-body', 'g3-force', 'g3-sound', 'g4-magnet', 'g6-motion'];

  it('series를 쓰는 모듈은 먹이 관계와 우리 몸뿐이고, yTicks는 먹이 관계·곰팡이·우리 몸·막대 수평 잡기·줄 소리·자석·수레만 쓴다', () => {
    expect(variableUnits.filter((u) => u.module.graph.series !== undefined).map((u) => u.id)).toEqual(SERIES_UNITS);
    expect(variableUnits.filter((u) => u.module.graph.yTicks !== undefined).map((u) => u.id).sort()).toEqual([...FIXED_Y].sort());
  });

  it('곰팡이 그래프는 냉장고(거의 0%)에서도 y축을 0~100%로 고정한다', () => {
    const unit = variableUnits.find((u) => u.id === 'g4-microbe')!;
    const html = render(unit, unit.module, trialOf(unit, combos(unit)[0]!));
    const yTicks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(yTicks).toEqual(['0', '20', '40', '60', '80', '100']);
  });

  it('막대 수평 잡기 그래프는 y축을 0~20 cm로 고정하고 x축 눈금을 소수 한 자리로 쓴다 (왼쪽 끝 20 cm여도 축이 변하지 않는다)', () => {
    const unit = variableUnits.find((u) => u.id === 'g3-force')!;
    for (const values of combos(unit)) {
      const html = render(unit, unit.module, trialOf(unit, values));
      const yTicks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
      expect(yTicks, JSON.stringify(values)).toEqual(['0', '5', '10', '15', '20']);
      const xTicks = [...html.matchAll(/<text x="([\d.]+)" y="(\d+)" text-anchor="middle">([\d.]+)<\/text>/g)].filter((m) => Number(m[2]) > 200).map((m) => m[3]);
      expect(xTicks).toEqual(['0.0', '0.2', '0.4', '0.6', '0.8', '1.0']);
      expect(html).toContain('시간(초, 느린 화면)');
      expect(html).toContain('오른쪽 끝 높이(cm)');
      expect(html).not.toContain('graph-marker');
    }
  });

  it('줄 소리 그래프는 y축 −1~1(눈금 −1·−0.5·0·0.5·1)을 고정하고, 0에 가로선을 긋고, 세기에 따라 축이 변하지 않는다', () => {
    const unit = variableUnits.find((u) => u.id === 'g3-sound')!;
    for (const values of combos(unit)) {
      const html = render(unit, unit.module, trialOf(unit, values));
      const yTicks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
      expect(yTicks, JSON.stringify(values)).toEqual(['−1', '−0.5', '0', '0.5', '1']);
      const xTicks = [...html.matchAll(/<text x="([\d.]+)" y="(\d+)" text-anchor="middle">([\d.]+)<\/text>/g)].filter((m) => Number(m[2]) > 200).map((m) => m[3]);
      expect(xTicks).toEqual(['0', '5', '10', '15', '20']);
      expect(html).toContain('시간(1000분의 1초)');
      expect(html).toContain('줄의 떨림');
      // 0 가로선: y = 가운데(−1이 아래, 1이 위이므로 눈금 0의 y와 같다)
      const zero = /<line data-testid="zero-line" x1="44" x2="308" y1="([\d.]+)" y2="([\d.]+)"/.exec(html)!;
      expect(zero[1]).toBe(zero[2]);
      expect(Number(zero[1])).toBeCloseTo((14 + 202) / 2, 6);
      // 파형의 점은 모두 틀 안(y 14~202)에 있고, 꼭짓점이 위·아래에 모두 있다
      const pts = [...(/<polyline points="([^"]+)" fill="none" stroke="#1f6fb5"/.exec(html)![1]!.matchAll(/([\d.]+),([\d.]+)/g))].map((m) => Number(m[2]));
      expect(Math.min(...pts)).toBeGreaterThanOrEqual(14 - 1e-6);
      expect(Math.max(...pts)).toBeLessThanOrEqual(202 + 1e-6);
      const A = values.strength === 'strong' ? 1 : 0.4;
      expect(Math.min(...pts)).toBeLessThan(108 - 94 * A * 0.9);
      expect(Math.max(...pts)).toBeGreaterThan(108 + 94 * A * 0.9);
      // 점 개수는 MAX_POINTS(160) 이하로 줄여 그린다
      expect(pts.length).toBeLessThanOrEqual(161);
    }
  });

  it('y가 음수인 축 지원은 줄 소리뿐이다: 다른 단원의 그림에는 0 가로선과 유니코드 빼기 기호가 없다', () => {
    for (const unit of variableUnits) {
      if (unit.id === 'g3-sound') continue;
      const html = render(unit, unit.module, trialOf(unit, combos(unit)[0]!));
      expect(html, unit.id).not.toContain('zero-line');
      expect(html, unit.id).not.toContain('−');
    }
    // 실험 전(시행 없음)에는 줄 소리도 틀과 안내만 그린다
    const sound = variableUnits.find((u) => u.id === 'g3-sound')!;
    const empty = render(sound, sound.module, undefined);
    expect(empty).not.toContain('zero-line');
  });

  it('정수가 아닌 고정 눈금은 소수 한 자리로, 정수 눈금은 지금처럼 소수 없이 쓴다', () => {
    const sound = variableUnits.find((u) => u.id === 'g3-sound')!;
    const mixed: AnyModule = { ...sound.module, graph: { ...sound.module.graph, yMin: 0, yTicks: [0, 1, 2] } };
    const html = render(sound, mixed, trialOf(sound, combos(sound)[0]!));
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '1', '2']);
  });

  it('series가 없는 단원은 선 하나만 그리고 범례가 없다', () => {
    expect(others.length).toBeGreaterThanOrEqual(10);
    for (const unit of others) {
      const html = render(unit, unit.module, trialOf(unit, combos(unit)[0]!));
      expect(html).not.toContain('graph-series');
      expect(html).not.toContain('graph-legend');
      expect(html.match(/<polyline/g)).toHaveLength(1);
      expect(html).toContain('stroke="#1f6fb5"');
    }
  });

  it('series와 yTicks를 빼면 먹이 관계도 선 하나(풀)로 그려지고, 다른 단원의 series: undefined는 그림을 바꾸지 않는다', () => {
    for (const unit of others) {
      const trial = trialOf(unit, combos(unit)[0]!);
      const plain = render(unit, unit.module, trial);
      const yTicks = FIXED_Y.includes(unit.id) ? unit.module.graph.yTicks : undefined;
      const explicit: AnyModule = { ...unit.module, graph: { ...unit.module.graph, series: undefined, yTicks } };
      expect(render(unit, explicit, trial)).toBe(plain);
    }
    const unit = foodWeb();
    const single: AnyModule = { ...unit.module, graph: { ...unit.module.graph, series: undefined } };
    const html = render(unit, single, trialOf(unit, base));
    expect(html.match(/<polyline/g)).toHaveLength(1);
    expect(html).not.toContain('graph-legend');
  });

  it('우리 몸 그래프는 맥박(실선)·호흡(점선) 두 선과 범례, y축 0~180(회/분), x축 "시간(분)" 0~10, 운동 시작·끝 표식을 그린다', () => {
    const unit = variableUnits.find((u) => u.id === 'g5-body')!;
    const html = render(unit, unit.module, trialOf(unit, { kind: 'walk', minutes: 1, wrist: 'left' }));
    const tags = html.match(/<polyline data-testid="graph-series"[^>]*>/g) ?? [];
    const lines = tags.map((t) => [/data-series="(\w+)"/.exec(t)![1], /stroke-dasharray="([\d ]+)"/.exec(t)?.[1]]);
    expect(lines).toEqual([['pulse', undefined], ['breath', '7 4']]);
    const items = html.match(/<li data-testid="graph-legend-item">.*?<\/li>/g) ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('맥박(회/분)');
    expect(items[1]).toContain('호흡(회/분)');
    const yTicks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(yTicks).toContain('180');
    expect(yTicks).toContain('0');
    expect(html).toContain('시간(분)');
    expect(html).toContain('회/분');
    const markers = html.match(/<g data-testid="graph-marker">.*?<\/g>/g) ?? [];
    expect(markers).toHaveLength(2);
    expect(markers[0]).toContain('운동 시작');
    expect(markers[1]).toContain('운동 끝');
    // 운동 시간이 길면 "운동 끝" 표식이 더 오른쪽이다.
    const xs = (v: Record<string, string | number>) =>
      (render(unit, unit.module, trialOf(unit, v)).match(/<g data-testid="graph-marker">.*?<\/g>/g) ?? []).map((g) => Number(/x1="([\d.]+)"/.exec(g)![1]));
    expect(xs({ kind: 'walk', minutes: 3, wrist: 'left' })[1]!).toBeGreaterThan(xs({ kind: 'walk', minutes: 1, wrist: 'left' })[1]!);
  });

  it('먹이 관계 그래프는 풀·토끼·여우 세 선을 서로 다른 색과 선 모양으로 그린다', () => {
    const unit = foodWeb();
    const html = render(unit, unit.module, trialOf(unit, base));
    const tags = html.match(/<polyline data-testid="graph-series"[^>]*>/g) ?? [];
    const lines = tags.map((t) => [/data-series="(\w+)"/.exec(t)![1], /stroke="(#\w+)"/.exec(t)![1], /stroke-dasharray="([\d ]+)"/.exec(t)?.[1]]);
    expect(lines.map((m) => m[0])).toEqual(['grassPct', 'rabbits', 'foxes']);
    expect(new Set(lines.map((m) => m[1])).size).toBe(3);
    expect(lines.map((m) => m[2])).toEqual([undefined, '7 4', '2 4']);
    expect(html.match(/<polyline/g)).toHaveLength(3);
  });

  it('범례는 글자·선 모양·색을 함께 보여 준다', () => {
    const unit = foodWeb();
    const html = render(unit, unit.module, trialOf(unit, base));
    const items = html.match(/<li data-testid="graph-legend-item">.*?<\/li>/g) ?? [];
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('풀의 양(%)');
    expect(items[1]).toContain('토끼 수(마리)');
    expect(items[2]).toContain('여우 수(마리)');
    expect(items[0]).not.toContain('stroke-dasharray');
    expect(items[1]).toContain('stroke-dasharray="7 4"');
    expect(items[2]).toContain('stroke-dasharray="2 4"');
    for (const [i, c] of ['#16a34a', '#d97706', '#9333ea'].entries()) expect(items[i]).toContain(`stroke="${c}"`);
    // 시행이 없으면 범례도 없다
    expect(render(unit, unit.module, undefined)).not.toContain('graph-legend');
  });

  it('y축은 0~100(눈금 20 간격) 하나이고 라벨은 "수(마리) / 풀의 양(%)", x축은 "날짜(일)" 0~60이다', () => {
    const unit = foodWeb();
    const html = render(unit, unit.module, trialOf(unit, base));
    const yTicks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(yTicks).toEqual(['0', '20', '40', '60', '80', '100']);
    expect(html).toContain('>수(마리) / 풀의 양(%)<');
    expect(html).toContain('>날짜(일)<');
    const xTicks = [...html.matchAll(/<text x="([\d.]+)" y="(\d+)" text-anchor="middle">(\d+)<\/text>/g)].filter((m) => Number(m[2]) > 200);
    expect(xTicks.map((m) => m[3])).toEqual(['0', '10', '20', '30', '40', '50', '60']);
  });

  it('앞 시행은 풀(metric) 한 줄만 흐리게 겹친다', () => {
    const unit = foodWeb();
    const html = renderToStaticMarkup(
      createElement(GraphView, {
        module: unit.module,
        experiment: unit.experiment,
        trial: trialOf(unit, base),
        prev: trialOf(unit, { ...base, foxes0: 0 }),
        playhead: 0,
        playing: false,
        onPlayhead: () => {},
        describedBy: 'results-table',
      }),
    );
    expect(html.match(/<polyline/g)).toHaveLength(4);
    expect(html.match(/opacity="0.6"/g)).toHaveLength(1);
    expect(html).toContain('앞 시행(풀의 양(%))');
  });

  it('슬라이더의 읽기 값은 세 값을 모두 말한다', () => {
    const unit = foodWeb();
    const html = render(unit, unit.module, trialOf(unit, base));
    expect(html).toMatch(/aria-valuetext="0일, 풀의 양\(%\) 80, 토끼 수\(마리\) 10, 여우 수\(마리\) 2"/);
  });
});
