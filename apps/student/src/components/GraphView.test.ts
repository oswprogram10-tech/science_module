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
  const existing = variableUnits.filter((u) => u.module.kind !== 'electromagnet' && u.module.kind !== 'magma-cooling');

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
