import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { HT_COLORS, HT_MATERIALS, HT_SPOTS, simulateHeatTransfer, stickersOf, type HeatTransferSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { heatTransferModule } from './index';
import { COLOR_TEXT, MATERIAL_TEXT, SPOT_TEXT, startSample, transferNote } from './initial';
import { BEAKER, CHANGED_FILL, HeatTransferMacroView, STICKER_FILL, dyePaths, partialPath } from './HeatTransferMacroView';
import { HeatTransferBarsView } from './HeatTransferBarsView';

const unit = UNITS.find((u) => u.id === 'g5-heat')!;
if (!unit.ok) throw new Error('g5-heat가 없어요');
const activity = unit.activities[3]!;
if (activity.activity !== 'variable') throw new Error('g5-heat 활동 4가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { material: string; heatAt: string; stickerColor: string };
const base: V = { material: 'copper', heatAt: 'edge', stickerColor: 'pink' };
const CONDITIONS: V[] = HT_MATERIALS.flatMap((material) => HT_SPOTS.flatMap((heatAt) => HT_COLORS.map((stickerColor) => ({ material, heatAt, stickerColor }))));
const sim = (v: V) => heatTransferModule.simulate(v, experiment) as ReturnType<typeof simulateHeatTransfer>;
const at = (v: V, t: number): HeatTransferSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: HeatTransferSample | null, ran = true) => renderToStaticMarkup(createElement(HeatTransferMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: V[], snapshot: HeatTransferSample | null) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(HeatTransferBarsView, { experiment, trial: list.at(-1) as never, snapshot, values: trials.at(-1) ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
/** 색이 바뀐 붙임딱지의 순서 번호들(가까운 순서) */
const changedOrders = (html: string) => [...html.matchAll(/data-testid="sticker" data-order="(\d+)" data-changed="true"/g)].map((m) => Number(m[1]));

describe('레지스트리', () => {
  it('g5-heat 활동 4는 heat-transfer 모듈로 로드되고 활동 1~3은 그대로다', () => {
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'insulated-cup', 'insulated-cup'], ['variable', 'heat-contact', 'heat-contact'], ['variable', 'thermometer', 'thermometer'], ['variable', 'heat-transfer', 'heat-transfer']]);
    expect(unit.manifest.standards).toEqual(['6과07-01', '6과07-02', '6과07-03', '6과07-04']);
    expect(activity.module).toBe(heatTransferModule);
    expect(MODULES['heat-transfer'].kind).toBe('heat-transfer');
    expect(experiment.safety).toEqual([]);
    expect(heatTransferModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['열이 이동하는 모습 관찰하기', '열은 고체와 액체에서 각각 어떻게 이동할까?', '예측: 가장 먼 곳까지 열이 전해진 시간은?']);
    expect(experiment.variables.map((v) => [v.key, v.default])).toEqual([['material', 'copper'], ['heatAt', 'edge'], ['stickerColor', 'pink']]);
    expect(experiment.variables.map((v) => v.label)).toEqual(['데우는 것', '데우는 곳', '열 붙임딱지 색(물은 색소 색)']);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['copper', '구리판'], ['iron', '철판'], ['water', '비커 속 물']],
      [['edge', '가장자리'], ['center', '가운데']],
      [['pink', '분홍색'], ['blue', '파란색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['time', '가장 먼 곳까지 열이 전해진 시간', '초'], ['path', '열이 퍼진 모습', '']]);
    expect(HT_MATERIALS.map((m) => MATERIAL_TEXT[m])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(HT_COLORS.map((c) => COLOR_TEXT[c])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
    expect(SPOT_TEXT.water.edge).toBe('비커 바닥 가장자리');
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 표의 시간(초)과 열이 퍼진 모습(범주), 붙임딱지 색 무영향', () => {
    const cols = heatTransferModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['가장 먼 곳까지 걸린 시간(초)', '열이 퍼진 모습']);
    const row = (material: string, heatAt: string, stickerColor = 'pink') => cols.map((c) => c.value(sim({ material, heatAt, stickerColor }).result));
    for (const color of HT_COLORS) {
      expect(row('copper', 'edge', color)).toEqual(['40', '데운 곳 둘레부터 둥글게 번짐']);
      expect(row('copper', 'center', color)).toEqual(['25', '데운 곳 둘레부터 둥글게 번짐']);
      expect(row('iron', 'edge', color)).toEqual(['120', '데운 곳 둘레부터 둥글게 번짐']);
      expect(row('iron', 'center', color)).toEqual(['75', '데운 곳 둘레부터 둥글게 번짐']);
      expect(row('water', 'edge', color)).toEqual(['60', '데운 곳 위로 올라가 위에서 옆으로 퍼진 뒤 내려옴']);
      expect(row('water', 'center', color)).toEqual(['45', '데운 곳 위로 올라가 위에서 옆으로 퍼진 뒤 내려옴']);
    }
  });

  it('센서: 가상 초시계(time) 하나, 걸린 시간에서 멈추고 실험 전에는 0이다', () => {
    const specs = heatTransferModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 초시계', 'time', '초']]);
    expect(specs[0]!.source).toBe(0);
    expect(heatTransferModule.sensors(at(base, 20), base)[0]!.source).toBe(20);
    expect(heatTransferModule.sensors(at(base, 130), base)[0]!.source).toBe(40);
  });

  it('그래프 설정: y 0~100 %, x 0~130초(눈금 0, 65, 130), 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = heatTransferModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['색이 바뀐 비율(%)', undefined, [0, 25, 50, 75, 100], '시간(초)', [0, 65, 130], undefined, undefined]);
    expect(heatTransferModule.restPlayhead).toBeUndefined();
    expect([heatTransferModule.metric.sampleKey, heatTransferModule.metric.resultKey]).toEqual(['pct', 'time']);
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.pct))).toBeLessThanOrEqual(100);
      expect(s.at(-1)!.t).toBe(130);
    }
  });

  it('예측 비교는 가장 먼 곳까지 걸린 시간(초): 가운데를 데우면 줄어들고, 붙임딱지 색은 변하지 않음', () => {
    const m = heatTransferModule.metric;
    const time = (v: V) => sim(v).result[m.resultKey as 'time'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(time(base), time({ ...base, heatAt: 'center' }), th)).toBe('decrease');
    expect(observedOutcome(time(base), time({ ...base, material: 'iron' }), th)).toBe('increase');
    for (const v of CONDITIONS) expect(observedOutcome(time(v), time({ ...v, stickerColor: v.stickerColor === 'pink' ? 'blue' : 'pink' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: heatTransferModule as never, experiment, trial: trialOf(base), prev: undefined, playhead: 130, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('색이 바뀐 비율(%)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '25', '50', '75', '100']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기: 판(구리판·철판)', () => {
  it('실행 전에는 색이 바뀐 붙임딱지가 하나도 없다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html).not.toContain('data-changed="true"');
      expect(html).not.toContain(CHANGED_FILL);
      expect(html).not.toContain('열이 퍼진 모습:');
      expect(html).toContain('실험하면 열이 퍼지는 모습이 나타나요.');
      expect(count(html, 'dye-band')).toBe(0);
      if (v.material !== 'water') expect(count(html, 'sticker')).toBe(49);
    }
  });

  it('붙임딱지는 데운 곳에서 가까운 것부터 색이 바뀐다: 시간이 지날수록 바뀐 딱지가 가까운 순서대로 늘어난다', () => {
    for (const v of CONDITIONS.filter((c) => c.material !== 'water')) {
      const time = sim(v).result.time;
      let prevCount = 0;
      for (const t of [1, time * 0.25, time * 0.5, time * 0.75, time]) {
        const snap = sim(v).samples.find((s) => s.t >= t) ?? at(v, 130);
        const changed = changedOrders(macro(v, { ...snap, t }));
        // 바뀐 딱지는 항상 "가까운 순서" 번호 0부터 연달아 있다(앞쪽 순서부터).
        expect(changed).toEqual(Array.from({ length: changed.length }, (_, i) => i));
        expect(changed.length).toBeGreaterThanOrEqual(prevCount);
        prevCount = changed.length;
      }
      expect(changedOrders(macro(v, at(v, time)))).toHaveLength(49);
      expect(changedOrders(macro(v, at(v, time - 1)))).toHaveLength(changedCountBefore(v, time - 1));
      expect(changedOrders(macro(v, at(v, 0)))).toHaveLength(0);
    }
  });

  it('붙임딱지 색은 분홍·파란 두 가지, 바뀐 딱지는 같은 색(흰색)으로 바뀐다', () => {
    expect(macro({ ...base, stickerColor: 'pink' }, null, false)).toContain(`fill="${STICKER_FILL.pink}"`);
    expect(macro({ ...base, stickerColor: 'blue' }, null, false)).toContain(`fill="${STICKER_FILL.blue}"`);
    const html = macro(base, at(base, 130));
    expect(html).toContain(`fill="${CHANGED_FILL}"`);
    expect(html).not.toContain(STICKER_FILL.pink);
    expect(count(macro(base, null, false), 'candle')).toBe(1);
  });

  it('촛불 표시 위치: 가장자리는 판 왼쪽 변 가운데, 가운데는 한가운데(데우는 곳 아래)', () => {
    const cx = (v: V) => Number(/data-testid="candle" cx="([\d.]+)" cy="([\d.]+)"/.exec(macro(v, null, false))![1]);
    expect(cx({ ...base, heatAt: 'edge' })).toBeLessThan(cx({ ...base, heatAt: 'center' }));
    expect(stickersOf('edge')[0]!.col).toBe(0);
  });

  it('대조 변인: 붙임딱지 색만 다르면 색이 바뀌는 순서와 때가 같다', () => {
    for (const v of CONDITIONS.filter((c) => c.material !== 'water')) {
      const other = { ...v, stickerColor: v.stickerColor === 'pink' ? 'blue' : 'pink' };
      for (const t of [10, 30]) {
        const s = sim(v).samples.find((x) => x.t === t)!;
        expect(changedOrders(macro(v, s))).toEqual(changedOrders(macro(other, s)));
      }
    }
  });
});

describe('눈으로 보기: 비커 속 물', () => {
  const water = (heatAt: string, stickerColor = 'pink'): V => ({ material: 'water', heatAt, stickerColor });

  it('실행 전에는 색소 알갱이만 있고 색소 띠(길)가 없다', () => {
    for (const heatAt of HT_SPOTS) {
      const html = macro(water(heatAt), null, false);
      expect(count(html, 'dye-grain')).toBe(1);
      expect(count(html, 'dye-band')).toBe(0);
      expect(count(html, 'sticker')).toBe(0);
    }
  });

  it('실행하면 색소 띠가 데운 곳 위로 올라가 수면을 따라 퍼지고 반대쪽으로 내려온다: 시간에 따라 길어진다', () => {
    const v = water('edge');
    const len = (t: number) => {
      const html = macro(v, at(v, t));
      const pts = /data-testid="dye-band" data-branch="0" points="([^"]*)"/.exec(html)![1]!.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
      return pts;
    };
    const early = len(15);
    const mid = len(45);
    const end = len(60);
    // 처음에는 바닥에서 위로(같은 x에서 y가 줄어듦)
    expect(early.at(-1)![0]).toBe(early[0]![0]);
    expect(early.at(-1)![1]).toBeLessThan(early[0]![1]);
    // 중간에는 수면을 따라 옆으로 간다(마지막 점의 x가 처음보다 크다)
    expect(mid.at(-1)![0]).toBeGreaterThan(mid[0]![0]);
    // 끝에는 반대쪽 바닥까지 내려온다
    expect(end.at(-1)![0]).toBeGreaterThan(end[0]![0]);
    expect(end.at(-1)![1]).toBeCloseTo(BEAKER.bottom - 8, 0);
    expect(end.length).toBe(4);
  });

  it('가운데를 데우면 색소 띠가 두 갈래로 나뉜다', () => {
    expect(count(macro(water('center'), at(water('center'), 45)), 'dye-band')).toBe(2);
    expect(count(macro(water('edge'), at(water('edge'), 60)), 'dye-band')).toBe(1);
    expect(dyePaths('center')).toHaveLength(2);
    expect(dyePaths('edge')).toHaveLength(1);
  });

  it('partialPath: 길이의 비율만큼 처음부터 자른다', () => {
    const pts: [number, number][] = [[0, 0], [0, -10], [20, -10]];
    expect(partialPath(pts, 0)).toEqual([[0, 0], [0, 0]]);
    expect(partialPath(pts, 1)).toEqual(pts);
    expect(partialPath(pts, 0.5)).toEqual([[0, 0], [0, -10], [5, -10]]);
  });
});

/** 데운 곳에서 t초에 색이 바뀐 붙임딱지 수 (표본의 pct로 계산한 값) */
function changedCountBefore(v: V, t: number): number {
  return Math.round((at(v, t).pct / 100) * 49);
}

describe('문구와 가드', () => {
  it('문구와 조건 라벨, 센서·결과 글자에 "전도"와 "대류"가 없다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      for (const html of [macro(v, null, false), macro(v, at(v, 130))]) {
        const text = shownText(html).join('\n');
        expect(text).not.toContain('전도');
        expect(text).not.toContain('대류');
        expect(text).not.toContain('복사');
      }
    }
    expect(transferNote(at(base, 130), sim(base).result, false)).toBe('130초 · 색이 바뀐 붙임딱지 100 % · 열이 퍼진 모습: 데운 곳 둘레부터 둥글게 번짐');
    expect(transferNote(at({ ...base, material: 'water' }, 30), sim({ ...base, material: 'water' }).result, true)).toBe('30초 · 색소가 퍼진 50 % · 열이 퍼진 모습: 데운 곳 위로 올라가 위에서 옆으로 퍼진 뒤 내려옴');
    expect(startSample(base)).toEqual({ t: 0, pct: 0, front: 0 });
  });

  it('SVG 글자는 모두 14 이상이고 모든 조건에서 안내 문구가 가드를 통과한다(실행 전·후)', () => {
    for (const v of CONDITIONS) {
      for (const html of [macro(v, null, false), macro(v, at(v, 130))]) {
        for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
        for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
        expect(html).not.toContain('NaN');
      }
    }
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 안내 글자, 시행마다 막대가 생기고 값이 결과의 시간(초)이다', () => {
    const empty = renderToStaticMarkup(createElement(HeatTransferBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'transfer-bar')).toBe(0);
    expect(empty).toContain('실험하면 시행마다 막대가 생겨요.');
    const trials = [base, { ...base, heatAt: 'center' }, { ...base, material: 'iron' }];
    const html = bars(trials, at(trials[2]!, 130));
    expect(count(html, 'transfer-bar')).toBe(3);
    expect([...html.matchAll(/data-testid="transfer-bar" data-trial="(\d+)" data-value="(\d+)"/g)].map((m) => Number(m[2]))).toEqual([40, 25, 120]);
    expect(html).toContain('시행 번호');
    expect(html).toContain('걸린 시간(초)');
  });

  it('재생 중인 시행의 막대는 초시계처럼 걸린 시간까지만 자란다', () => {
    const list = [trialOf(base)] as { id: string }[];
    const val = (t: number) => Number(/data-testid="transfer-bar" data-trial="\d+" data-value="(\d+)"/.exec(renderToStaticMarkup(createElement(HeatTransferBarsView, { experiment, trial: list[0] as never, snapshot: at(base, t), values: base, playhead: 0, trials: list as never })))![1]);
    expect(val(0)).toBe(0);
    expect(val(20)).toBe(20);
    expect(val(130)).toBe(40);
  });
});
