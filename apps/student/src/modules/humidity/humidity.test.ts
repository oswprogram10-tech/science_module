import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { HM_DIFFS, HM_DRYS, HM_PLACES, HM_TABLE, simulateHumidity, type HumiditySample } from '@sci/engine-earth';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { humidityModule } from './index';
import { PLACE_TEXT, humidityNote, startSample } from './initial';
import { HIT_FILL, HumidityMacroView, TABLE, mercuryTop } from './HumidityMacroView';
import { HumidityBarsView } from './HumidityBarsView';
import { WeekLog, readWeekLog } from './WeekLog';
import { barsHeight } from '../TrialBars';

const unit = UNITS.find((u) => u.id === 'g5-weather')!;
if (!unit.ok) throw new Error('g5-weather가 없어요');
const activity = unit.activities[2]!;
if (activity.activity !== 'variable') throw new Error('g5-weather 활동 3이 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { dry: number; diff: number; place: string };
const base: V = { dry: 20, diff: 0, place: 'white' };
const CONDITIONS: V[] = HM_DRYS.flatMap((dry) => HM_DIFFS.flatMap((diff) => HM_PLACES.map((place) => ({ dry, diff, place }))));
const sim = (v: V) => humidityModule.simulate(v, experiment) as ReturnType<typeof simulateHumidity>;
const at = (v: V, t: number): HumiditySample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: HumiditySample | null, ran = true) => renderToStaticMarkup(createElement(HumidityMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: V[], snapshot: HumiditySample | null) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(HumidityBarsView, { experiment, trial: list.at(-1) as never, snapshot, values: trials.at(-1) ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.5, 1, 1.5, 2];

describe('레지스트리', () => {
  it('g5-weather 활동 3은 humidity 모듈로 로드되고 앞의 두 활동은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['날씨와 우리 생활', 5, 'earth', ['6과06-01', '6과06-02', '6과06-03']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'land-sea-breeze', 'land-sea-breeze'], ['card-sort', 'dew-fog-cloud', 'card-sort'], ['variable', 'humidity', 'humidity']]);
    expect(unit.module.kind).toBe('land-sea-breeze');
    expect(activity.module).toBe(humidityModule);
    expect(MODULES.humidity.kind).toBe('humidity');
    expect(experiment.safety).toEqual([]);
    expect(humidityModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['건습구 습도계로 습도 구하기', '날씨를 나타내려면 무엇을 재어야 할까?', '예측: 습도는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['dry', '건구 온도', 20], ['diff', '건구와 습구의 온도 차', 0], ['place', '습도계를 둔 곳 벽 색', 'white']]);
    expect(experiment.variables[2]!.options.map((o) => [o.value, o.label])).toEqual([['white', '흰 벽'], ['gray', '회색 벽']]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['rh', '습도', '%'], ['wet', '습구 온도', '°C']]);
    expect(HM_PLACES.map((b) => PLACE_TEXT[b])).toEqual(['흰 벽', '회색 벽']);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 습도표 값(정수)과 습구 온도, 벽 색 무영향', () => {
    const cols = humidityModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['습도(%)', '습구 온도(°C)']);
    const row = (dry: number, diff: number, place = 'white') => cols.map((c) => c.value(sim({ dry, diff, place }).result));
    for (const place of HM_PLACES) {
      expect(row(20, 0, place)).toEqual(['100', '20']);
      expect(row(20, 3, place)).toEqual(['72', '17']);
      expect(row(10, 6, place)).toEqual(['27', '4']);
      expect(row(30, 5, place)).toEqual(['65', '25']);
    }
  });

  it('센서: 가상 습도계(humidity) 하나, 습도(%)를 보여 주고 실험 전에는 0이다', () => {
    const specs = humidityModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 습도계: 습도', 'humidity', '%']]);
    expect(specs[0]!.source).toBe(0);
    const v = { ...base, diff: 3 };
    expect(humidityModule.sensors(at(v, 2), v)[0]!.source).toBeCloseTo(72, 9);
  });

  it('그래프 설정: y 0~100 % 고정, x 0~2초, 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = humidityModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['습도(%)', undefined, [0, 20, 40, 60, 80, 100], '시간(초)', [0, 1, 2], undefined, undefined]);
    expect(humidityModule.restPlayhead).toBeUndefined();
    expect([humidityModule.metric.sampleKey, humidityModule.metric.resultKey]).toEqual(['rh', 'rh']);
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.rh))).toBeLessThanOrEqual(100);
      expect(s.at(-1)!.t).toBe(2);
    }
  });

  it('예측 비교는 습도(%): 온도 차를 늘리면 줄어듦, 벽 색은 변하지 않음 (기준 0.5 %)', () => {
    const m = humidityModule.metric;
    const rh = (v: V) => sim(v).result[m.resultKey as 'rh'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    expect(observedOutcome(rh(base), rh({ ...base, diff: 3 }), th)).toBe('decrease');
    expect(observedOutcome(rh({ ...base, diff: 3 }), rh(base), th)).toBe('increase');
    for (const v of CONDITIONS) expect(observedOutcome(rh(v), rh({ ...v, place: v.place === 'white' ? 'gray' : 'white' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, diff: 3 };
    const html = renderToStaticMarkup(createElement(GraphView, { module: humidityModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('습도(%)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '20', '40', '60', '80', '100']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('실행 전에는 습구 온도 글자와 습도표의 강조 칸·습도 글자를 그리지 않는다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html).toContain('data-hit="false"');
      expect(html).not.toContain('data-hit="true"');
      expect(count(html, 'rh-text')).toBe(0);
      expect(html).not.toContain(HIT_FILL);
      expect(html).toContain('? °C');
      expect(html).toContain('실험하면 습구 온도가 내려가요.');
      // 두 온도계는 모두 건구 온도를 가리킨다.
      expect(html).toContain(`data-wet="${v.dry.toFixed(2)}"`);
    }
  });

  it('습도표는 5행 × 7열 35칸이고 값이 HM_TABLE과 같으며 실행 전에도 보인다', () => {
    const html = macro(base, null, false);
    expect(count(html, 'table-cell')).toBe(35);
    const cells = [...html.matchAll(/data-testid="table-cell" data-dry="(\d+)" data-diff="(\d+)" data-value="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    expect(cells).toHaveLength(35);
    for (const [dry, diff, value] of cells) expect(value).toBe(HM_TABLE[dry as 10][diff!]);
    expect(TABLE.colW * 7 + TABLE.x0).toBeLessThanOrEqual(240);
  });

  it('실행하면 두 값이 만나는 칸 하나만 강조한다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 2));
      const hits = [...html.matchAll(/data-testid="table-cell" data-dry="(\d+)" data-diff="(\d+)" data-value="(\d+)" data-hit="true"/g)];
      expect(hits, `${v.dry}/${v.diff}`).toHaveLength(1);
      expect([Number(hits[0]![1]), Number(hits[0]![2]), Number(hits[0]![3])]).toEqual([v.dry, v.diff, sim(v).result.rh]);
      expect(html).toContain(HIT_FILL);
      expect(html).toContain(`습도 ${sim(v).result.rh} %`);
    }
  });

  it('실행하면 습구 온도계가 내려간다(수은 기둥이 건구보다 짧다), 온도 차 0이면 같다', () => {
    const v = { ...base, diff: 4 };
    const first = macro(v, at(v, 0));
    const last = macro(v, at(v, 2));
    expect(first).toContain('data-wet="20.00"');
    expect(last).toContain('data-wet="16.00"');
    expect(last).toContain('16 °C');
    expect(mercuryTop(16)).toBeGreaterThan(mercuryTop(20));
    expect(macro(base, at(base, 2))).toContain('data-wet="20.00"');
  });

  it('벽 색: 흰 벽/회색 벽 바탕이 바뀌고, 대조 변인이라 나머지 그림은 같다', () => {
    expect(macro({ ...base, place: 'gray' }, null, false)).toContain('data-fill="#9ca3af"');
    expect(macro(base, null, false)).toContain('data-fill="#ffffff"');
    for (const v of CONDITIONS) {
      const other = { ...v, place: v.place === 'white' ? 'gray' : 'white' };
      const strip = (html: string) => html.replace(/data-place="\w+"/, '').replace(/data-fill="[^"]+"/, '').replace(/(<rect data-testid="wall"[^>]*?) fill="#(?:ffffff|9ca3af)"/, '$1').replace(/aria-label="[^"]*"/g, '').replace(/(흰|회색) 벽/g, '');
      expect(strip(macro(v, at(v, 2)))).toBe(strip(macro(other, at(other, 2))));
    }
  });

  it('문구: 눈으로 보기 아래 문구와 조건 라벨', () => {
    const v = { ...base, dry: 25, diff: 4 };
    expect(humidityNote(at(v, 2))).toBe('2.0초 · 습구 온도 21.0 °C · 습도 68.0 %');
    expect(macro(v, at(v, 2))).toContain('2.0초 · 습구 온도 21.0 °C · 습도 68.0 %');
    const html = macro(v, null, false);
    expect(html).toContain('건구 온도 25 °C');
    expect(html).toContain('온도 차 4 °C · 흰 벽');
    expect(html).toContain('습도표(%)');
    expect(startSample(v)).toEqual({ t: 0, dryC: 25, wetC: 25, rh: 0 });
  });

  it('SVG 글자는 모두 14 이상이고 모든 조건에서 안내 문구가 가드를 통과한다(실행 전·후)', () => {
    for (const v of CONDITIONS) {
      for (const html of [macro(v, null, false), macro(v, at(v, 2))]) {
        for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
        for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
      }
    }
    for (const v of CONDITIONS.slice(0, 6)) for (const t of TIMES) expect(macro(v, at(v, t))).not.toContain('NaN');
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 안내 글자, 시행마다 막대가 생기고 값이 결과의 습도(%)이다', () => {
    const empty = renderToStaticMarkup(createElement(HumidityBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'humidity-bar')).toBe(0);
    expect(empty).toContain('실험하면 시행마다 막대가 생겨요.');
    const trials = [base, { ...base, diff: 3 }, { ...base, dry: 10, diff: 6 }];
    const html = bars(trials, at(trials[2]!, 2));
    expect(count(html, 'humidity-bar')).toBe(3);
    expect([...html.matchAll(/data-testid="humidity-bar" data-trial="(\d+)" data-value="(\d+)"/g)].map((m) => Number(m[2]))).toEqual([100, 72, 27]);
    expect(html).toContain('시행 번호');
    expect(html).toContain('습도(%)');
    expect(barsHeight(50, 100) * 2).toBeCloseTo(barsHeight(100, 100), 9);
  });
});

describe('결과표 아래 일주일 날씨 기록(ResultsExtra)', () => {
  it('모듈에 ResultsExtra가 있고 manifest의 예시 자료를 7일 표로 보여 준다', () => {
    expect(humidityModule.ResultsExtra).toBe(WeekLog);
    const html = renderToStaticMarkup(createElement(WeekLog, { experiment, values: base }));
    expect(html).toContain('일주일 날씨 기록(예시 자료)');
    expect(count(html, 'week-log')).toBe(1);
    for (const h of ['기온(°C)', '습도(%)', '바람', '구름 양(10칸 중)', '강수량(mm)']) expect(html).toContain(h);
    expect(html.match(/<tr>/g)).toHaveLength(8);
    expect(html.match(/scope="row"/g)).toHaveLength(7);
    for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
  });

  it('자료가 없거나 모양이 틀리면 아무것도 그리지 않고, 값을 바꾸면 표가 따라 바뀐다(교실 실측값으로 교체)', () => {
    const none = { ...experiment, params: undefined };
    expect(readWeekLog(none)).toBeNull();
    expect(renderToStaticMarkup(createElement(WeekLog, { experiment: none, values: base }))).toBe('');
    expect(readWeekLog({ ...experiment, params: { weekLog: { title: 'x', note: 'y', columns: ['a', 'b'], rows: [['1']] } } })).toBeNull();
    const log = readWeekLog(experiment)!;
    const edited = { ...experiment, params: { weekLog: { ...log, rows: [['월', '1', '2', '3', '4', '5'], ...log.rows.slice(1)] } } };
    expect(renderToStaticMarkup(createElement(WeekLog, { experiment: edited, values: base }))).toContain('<th scope="row">월</th><td>1</td><td>2</td>');
  });
});
