import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { analyzeTrial, canRun, observedOutcome } from '@sci/gateway';
import { createRuntime } from '@sci/runtime';
import { BL_ENDS, BL_SWITCHES, BL_WIRES, BS_CELLS, type BulbSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { batterySeriesModule } from '../battery-series';
import { bulbLightModule } from './index';
import { BULB_NOTE_EMPTY, bulbNote, startSample } from './initial';
import { BatterySeriesMacroView, BulbLightMacroView } from './BulbMacroView';
import { BulbBarsView } from './BulbBarsView';
import { BX, GLASS, THREAD, TIP_Y, glowRadius, wirePoints } from './BulbCircuit';
import { BARS_MAX, trialBarsOf } from '../TrialBars';

const unit = UNITS.find((u) => u.id === 'g6-electricity')!;
if (!unit.ok) throw new Error('g6-electricity가 없어요');
const bulbActivity = unit.activities[1]!;
const batteryActivity = unit.activities[2]!;
if (bulbActivity.activity !== 'variable' || batteryActivity.activity !== 'variable') throw new Error('g6-electricity 활동 2·3이 변인 실험이 아니에요');
const bulbExp = bulbActivity.experiment;
const batteryExp = batteryActivity.experiment;

type B = { plusEnd: string; minusEnd: string; switch: string; wireColor: string };
const base: B = { plusEnd: 'none', minusEnd: 'none', switch: 'open', wireColor: 'red' };
const lit: B = { plusEnd: 'tip', minusEnd: 'side', switch: 'closed', wireColor: 'red' };
const CONDITIONS: B[] = BL_ENDS.flatMap((plusEnd) => BL_ENDS.flatMap((minusEnd) => BL_SWITCHES.flatMap((sw) => BL_WIRES.map((wireColor) => ({ plusEnd, minusEnd, switch: sw, wireColor })))));
type C = { cells: string; wireColor: string };
const CELL_CONDITIONS: C[] = BS_CELLS.flatMap((cells) => BL_WIRES.map((wireColor) => ({ cells, wireColor })));

const sim = (v: B) => bulbLightModule.simulate(v, bulbExp);
const simC = (v: C) => batterySeriesModule.simulate(v, batteryExp);
const at = (samples: BulbSample[], t: number) => samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: B) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const trialOfC = (v: C) => ({ id: `t${++seq}`, index: seq, samples: simC(v).samples, result: simC(v).result, values: v }) as never;
const macro = (v: B, snapshot: BulbSample | null, ran = true) => renderToStaticMarkup(createElement(BulbLightMacroView, { experiment: bulbExp, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const macroC = (v: C, snapshot: BulbSample | null, ran = true) => renderToStaticMarkup(createElement(BatterySeriesMacroView, { experiment: batteryExp, trial: ran ? trialOfC(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: B[], snapshot: BulbSample | null) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(BulbBarsView, { experiment: bulbExp, trial: list.at(-1) as never, snapshot, values: trials.at(-1) ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const guardOf = (e: { tutor: { forbiddenAnswers: string[] }; limits: string[] }) => ({ forbiddenAnswers: e.tutor.forbiddenAnswers, limits: e.limits });
const TIMES = [0, 0.5, 1, 1.5, 2];

describe('레지스트리', () => {
  it('g6-electricity 활동 2·3은 bulb-light·battery-series 모듈로 로드되고 첫 활동(electromagnet)은 그대로다', () => {
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'electromagnet', 'electromagnet'], ['variable', 'bulb-light', 'bulb-light'], ['variable', 'battery-series', 'battery-series']]);
    expect(unit.module.kind).toBe('electromagnet');
    expect(bulbActivity.module).toBe(bulbLightModule);
    expect(batteryActivity.module).toBe(batterySeriesModule);
    expect(MODULES['bulb-light'].kind).toBe('bulb-light');
    expect(MODULES['battery-series'].kind).toBe('battery-series');
    expect(bulbExp.safety).toEqual([]);
    expect(batteryExp.safety).toEqual([]);
    expect(bulbLightModule.validate(bulbExp)).toEqual([]);
    expect(batterySeriesModule.validate(batteryExp)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([bulbExp.title, bulbExp.question, bulbExp.predictionPrompt]).toEqual(['전구에 불 켜기', '전지, 전구, 전선을 어떻게 연결하면 불이 켜질까?', '예측: 전구의 밝기 눈금은?']);
    expect(bulbExp.variables.map((v) => [v.key, v.label])).toEqual([['plusEnd', '전지 (+)극 쪽 전선을 댄 곳'], ['minusEnd', '전지 (−)극 쪽 전선을 댄 곳'], ['switch', '스위치'], ['wireColor', '전선 색깔']]);
    expect(bulbExp.variables.map((v) => v.options.map((o) => o.label))).toEqual([['전구 꼭지', '전구 옆면 쇠붙이', '대지 않음'], ['전구 꼭지', '전구 옆면 쇠붙이', '대지 않음'], ['열림', '닫힘'], ['빨간색', '검은색']]);
    expect([batteryExp.title, batteryExp.question, batteryExp.predictionPrompt]).toEqual(['전지 한 개와 두 개 직렬연결 비교하기', '전지를 한 개 연결할 때와 두 개 직렬로 연결할 때 전구는 어떻게 다를까?', '예측: 전구의 밝기 눈금은?']);
    expect(batteryExp.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([[['one', '전지 1개'], ['two', '전지 2개를 한 줄로'], ['reversed', '2개 중 하나를 반대로']], [['red', '빨간색'], ['black', '검은색']]]);
  });
});

describe('실행 게이트: 전구에 불 켜기만 바꿀 조건을 고르지 않아도 된다', () => {
  it('bulb-light는 예측만 고르면 실행할 수 있고, 바꿀 조건 안내 문구가 나오지 않는다', () => {
    expect(bulbExp.gateway.requireSingleIV).toBe(false);
    expect(canRun({ ivKey: null, prediction: null }, bulbExp.gateway)).toEqual({ ok: false, reasons: ['예측을 먼저 골라 주세요.'] });
    expect(canRun({ ivKey: null, prediction: 'same' }, bulbExp.gateway)).toEqual({ ok: true, reasons: [] });
    // 전지 직렬연결 비교는 한 번에 하나만 바꾸기를 그대로 요구한다.
    expect(batteryExp.gateway.requireSingleIV).toBe(true);
    expect(canRun({ ivKey: null, prediction: 'same' }, batteryExp.gateway).reasons).toEqual(['바꿀 조건(조작변인)을 하나 골라 주세요.']);
  });

  it('바꿀 조건 없이 이어서 실행하면 하나만 바꾼 시행도 "함께 바꿈(confounded)"으로 분류되고 값은 그대로 계산된다', () => {
    const labels = Object.fromEntries(bulbExp.variables.map((v) => [v.key, v.label]));
    const rt = createRuntime({ defaults: base });
    rt.setPrediction('same');
    rt.run((v) => bulbLightModule.simulate(v, bulbExp), (prev, cur) => analyzeTrial(prev, cur, labels));
    rt.tick(1e9);
    rt.setValue('switch', 'closed');
    rt.setPrediction('same');
    const t = rt.run((v) => bulbLightModule.simulate(v, bulbExp), (prev, cur) => analyzeTrial(prev, cur, labels));
    expect(t?.analysis).toEqual({ kind: 'confounded', changed: ['switch'] });
    expect(t?.ivKey).toBeNull();
    expect(t?.result).toEqual({ brightness: 0, lit: '켜지지 않음' });
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 전구의 밝기(정수 눈금)와 전구(범주), 사양 기준값과 전선 색깔 무영향', () => {
    const cols = bulbLightModule.resultColumns(bulbExp);
    expect(cols.map((c) => c.label)).toEqual(['전구의 밝기(눈금)', '전구']);
    for (const wire of BL_WIRES) {
      expect(cols.map((c) => c.value(sim({ ...lit, wireColor: wire }).result))).toEqual(['6', '켜짐']);
      expect(cols.map((c) => c.value(sim({ ...lit, plusEnd: 'side', minusEnd: 'tip', wireColor: wire }).result))).toEqual(['6', '켜짐']);
      expect(cols.map((c) => c.value(sim({ ...lit, switch: 'open', wireColor: wire }).result))).toEqual(['0', '켜지지 않음']);
      expect(cols.map((c) => c.value(sim({ ...lit, minusEnd: 'tip', wireColor: wire }).result))).toEqual(['0', '켜지지 않음']);
    }
    const cells = batterySeriesModule.resultColumns(batteryExp);
    expect(CELL_CONDITIONS.map((v) => cells.map((c) => c.value(simC(v).result)))).toEqual([['4', '켜짐'], ['4', '켜짐'], ['9', '켜짐'], ['9', '켜짐'], ['0', '켜지지 않음'], ['0', '켜지지 않음']]);
  });

  it('센서: 가상 조도계(light) 하나, 눈금 × 10(%)을 읽어 눈금으로 보여 주고 실험 전에는 0이다', () => {
    const specs = bulbLightModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit, s.display])).toEqual([['가상 조도계: 전구의 밝기', 'light', '눈금', { scale: 0.1, unitLabel: '눈금' }]]);
    expect(specs[0]!.source).toBe(0);
    expect(bulbLightModule.sensors(at(sim(lit).samples, 2), lit)[0]!.source).toBeCloseTo(60, 9);
    expect(batterySeriesModule.sensors(at(simC({ cells: 'two', wireColor: 'red' }).samples, 2), { cells: 'two', wireColor: 'red' })[0]!.source).toBeCloseTo(90, 9);
  });

  it('그래프 설정: y 0~10 눈금 고정, x 0~2초, 선 하나, 두 활동이 같다', () => {
    for (const m of [bulbLightModule, batterySeriesModule]) {
      const g = m.graph;
      expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers, g.emptyText]).toEqual(['전구의 밝기(눈금)', undefined, [0, 2, 4, 6, 8, 10], '시간(초)', [0, 1, 2], undefined, undefined, undefined]);
      expect(m.restPlayhead).toBeUndefined();
      expect([m.metric.sampleKey, m.metric.resultKey]).toEqual(['level', 'brightness']);
    }
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.level))).toBeLessThanOrEqual(10);
      expect(s.at(-1)!.t).toBe(2);
    }
  });

  it('예측 비교는 밝기 눈금(기준 0.5눈금): 스위치를 닫으면 늘어남, 전선 색깔은 변하지 않음, 전지를 두 개로 하면 늘어남', () => {
    const th = bulbLightModule.metric.sameThreshold(bulbExp);
    expect(th).toBe(0.5);
    const level = (v: B) => sim(v).result.brightness;
    expect(observedOutcome(level({ ...lit, switch: 'open' }), level(lit), th)).toBe('increase');
    expect(observedOutcome(level(lit), level({ ...lit, switch: 'open' }), th)).toBe('decrease');
    for (const v of CONDITIONS) expect(observedOutcome(level(v), level({ ...v, wireColor: v.wireColor === 'red' ? 'black' : 'red' }), th)).toBe('same');
    const lvC = (cells: string) => simC({ cells, wireColor: 'red' }).result.brightness;
    expect(observedOutcome(lvC('one'), lvC('two'), th)).toBe('increase');
    expect(observedOutcome(lvC('two'), lvC('reversed'), th)).toBe('decrease');
    expect(observedOutcome(lvC('one'), lvC('reversed'), th)).toBe('decrease');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: bulbLightModule as never, experiment: bulbExp, trial: trialOf(lit), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('전구의 밝기(눈금)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '2', '4', '6', '8', '10']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기: 전구에 불 켜기', () => {
  it('실행 전에는 모든 조건에서 연결 모양은 보이고 불빛(밝은 유리·불빛 둘레)과 결과 글자는 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(count(html, 'bulb-glow')).toBe(0);
      expect(html).toContain('data-lit="false"');
      expect(html).toContain(`data-plus="${v.plusEnd}"`);
      expect(html).toContain(`data-minus="${v.minusEnd}"`);
      expect(html).toContain(`data-switch="${v.switch}"`);
      expect(html).toContain(BULB_NOTE_EMPTY);
      expect(shownText(html).some((t) => t.includes('전구: 켜'))).toBe(false);
    }
  });

  it('실행하면 켜지는 연결에서만 유리가 노랗게 켜지고 불빛 둘레가 생긴다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const r = sim(v);
      const html = macro(v, at(r.samples, 2));
      expect(html, JSON.stringify(v)).toContain(`data-lit="${r.result.lit === '켜짐'}"`);
      expect(count(html, 'bulb-glow')).toBe(1);
      expect(html).toContain(bulbNote(at(r.samples, 2), r.result));
    }
  });

  it('불빛 둘레의 크기는 밝기 눈금을 따른다', () => {
    expect(glowRadius(0)).toBe(GLASS.r + 2);
    expect(glowRadius(6)).toBeGreaterThan(glowRadius(0));
    expect(glowRadius(10)).toBeGreaterThan(glowRadius(6));
    expect(glowRadius(99)).toBe(glowRadius(10));
    const dim = macroC({ cells: 'one', wireColor: 'red' }, at(simC({ cells: 'one', wireColor: 'red' }).samples, 2));
    const bright = macroC({ cells: 'two', wireColor: 'red' }, at(simC({ cells: 'two', wireColor: 'red' }).samples, 2));
    const r = (html: string) => Number(/data-testid="bulb-glow"[^>]*r="([\d.]+)"/.exec(html)![1]);
    expect(r(bright)).toBeGreaterThan(r(dim));
  });

  it('선택에 따라 전선 끝이 닿은 자리가 바뀐다: 꼭지는 아래, 옆면은 옆, 대지 않음은 전구에 닿기 전에 멈춘다', () => {
    const tip = wirePoints('plus', 'tip', 180);
    expect(tip.at(-1)).toEqual([BX + 4, TIP_Y]);
    const sidePlus = wirePoints('plus', 'side', 180);
    expect(sidePlus.at(-1)![0]).toBe(BX + THREAD.w / 2 + 1);
    const sideMinus = wirePoints('minus', 'side', 60);
    expect(sideMinus.at(-1)![0]).toBe(BX - THREAD.w / 2 - 1);
    const none = wirePoints('minus', 'none', 60);
    expect(none).toHaveLength(1);
    expect(none[0]![0]).toBe(60);
    // 스위치: 열림이면 손잡이가 올라가 있고 닫힘이면 곧게 이어진다.
    expect(macro({ ...base, switch: 'open' }, null, false)).toContain('data-state="open"');
    expect(macro({ ...base, switch: 'closed' }, null, false)).toContain('data-state="closed"');
  });

  it('회로도 기호·글자 없이 그림만 쓴다: SVG 안에 <text>가 없다 — 모든 조건', () => {
    for (const v of CONDITIONS) expect(macro(v, at(sim(v).samples, 2))).not.toMatch(/<text/);
    for (const v of CELL_CONDITIONS) expect(macroC(v, at(simC(v).samples, 2))).not.toMatch(/<text/);
  });

  it('대조 변인: 전선 색깔만 다르면 그림의 결과 부분(전구, 불빛, 문구)이 같다', () => {
    for (const v of CONDITIONS) {
      const other = { ...v, wireColor: v.wireColor === 'red' ? 'black' : 'red' };
      const strip = (html: string) => html.replace(/data-wire="\w+"/, '').replace(/aria-label="[^"]*"/g, '').replace(/(stroke|fill)="#(c62828|111827)"/g, '');
      expect(strip(macro(v, at(sim(v).samples, 2)))).toBe(strip(macro(other, at(sim(other).samples, 2))));
    }
  });

  it('안내 문구와 접근성 이름이 모든 조건에서 두 활동의 가드를 통과한다', () => {
    for (const v of CONDITIONS) for (const t of TIMES) for (const text of shownText(macro(v, at(sim(v).samples, t)))) expect(guardOutput(text, guardOf(bulbExp)).ok, text).toBe(true);
    for (const v of CELL_CONDITIONS) for (const t of TIMES) for (const text of shownText(macroC(v, at(simC(v).samples, t)))) expect(guardOutput(text, guardOf(batteryExp)).ok, text).toBe(true);
  });

  it('시작 샘플은 불이 꺼져 있다', () => {
    for (const v of CONDITIONS) expect(startSample(v)).toEqual({ t: 0, level: 0 });
  });
});

describe('눈으로 보기: 전지 직렬연결 비교', () => {
  it('전지 끼우개에 전지가 한 줄로 놓이고, 반대로 넣은 전지는 극 방향이 뒤집힌다', () => {
    const one = macroC({ cells: 'one', wireColor: 'red' }, null, false);
    const two = macroC({ cells: 'two', wireColor: 'red' }, null, false);
    const rev = macroC({ cells: 'reversed', wireColor: 'red' }, null, false);
    expect(count(one, 'cell')).toBe(1);
    expect(count(two, 'cell')).toBe(2);
    expect(count(rev, 'cell')).toBe(2);
    expect([...two.matchAll(/data-plus-side="(\w+)"/g)].map((m) => m[1])).toEqual(['right', 'right']);
    expect([...rev.matchAll(/data-plus-side="(\w+)"/g)].map((m) => m[1])).toEqual(['right', 'left']);
    // 전구·전선·스위치는 고정: 꼭지와 옆면에 닿고 스위치는 닫혀 있다.
    for (const html of [one, two, rev]) {
      expect(html).toContain('data-plus="tip"');
      expect(html).toContain('data-minus="side"');
      expect(html).toContain('data-switch="closed"');
      expect(html).toContain('data-lit="false"');
      expect(count(html, 'bulb-glow')).toBe(0);
    }
  });

  it('실행하면 켜짐·꺼짐과 불빛 크기가 결과를 따르고, 반대로 넣으면 불빛 둘레가 가장 작다', () => {
    const run = (cells: string) => macroC({ cells, wireColor: 'black' }, at(simC({ cells, wireColor: 'black' }).samples, 2));
    expect(run('one')).toContain('data-lit="true"');
    expect(run('two')).toContain('data-lit="true"');
    expect(run('reversed')).toContain('data-lit="false"');
    expect(run('reversed')).toContain('전구: 켜지지 않음');
    expect(run('two')).toContain('전구의 밝기 9.0눈금');
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 안내 글자, 시행마다 막대가 생기고 값이 결과의 밝기 눈금이다', () => {
    const empty = renderToStaticMarkup(createElement(BulbBarsView, { experiment: bulbExp, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'bulb-bar')).toBe(0);
    expect(empty).toContain('실험하면 시행마다 막대가 생겨요.');
    const trials = [base, lit, { ...lit, switch: 'open' }];
    const html = bars(trials, at(sim(trials[2]!).samples, 2));
    expect(count(html, 'bulb-bar')).toBe(3);
    expect([...html.matchAll(/data-testid="bulb-bar" data-trial="(\d+)" data-value="(\d+)"/g)].map((m) => [Number(m[1]) > 0, Number(m[2])])).toEqual([[true, 0], [true, 6], [true, 0]]);
    expect(html).toContain('시행 번호');
    expect(html).toContain('전구의 밝기(눈금)');
  });

  it('막대는 최근 8개까지만 그린다', () => {
    const list = Array.from({ length: 10 }, (_, i) => trialOf(CONDITIONS[i % CONDITIONS.length]!)) as never[];
    expect(trialBarsOf(list, undefined, 0, (r) => (r as { brightness: number }).brightness)).toHaveLength(BARS_MAX);
  });

  it('SVG 글자는 모두 14 이상이다', () => {
    const html = bars([base, lit], at(sim(lit).samples, 2));
    for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
  });
});
