import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { LS_DOTS, LS_GLOBES, LS_ROUNDS, simulateLandSeaDots, type LandSeaDotsSample } from '@sci/engine-earth';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { landSeaDotsModule } from './index';
import { GLOBE, MAP, globeLandPath, mapLandPath, projectGlobe } from './geo';
import { GLOBE_FILL, GLOBE_TEXT, ROUND_TEXT, counterPct, dotsNote, shownCount } from './initial';
import { LandSeaMacroView } from './LandSeaMacroView';
import { LandSeaMapView } from './LandSeaMapView';

const unit = UNITS.find((u) => u.id === 'g3-earth-sea')!;
if (!unit.ok) throw new Error('g3-earth-sea가 없어요');
const activity = unit.activities[2]!;
if (activity.activity !== 'variable') throw new Error('g3-earth-sea 활동 3이 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { dots: number; round: number; globeColor: string };
const base: V = { dots: 10, round: 1, globeColor: 'red' };
const CONDITIONS: V[] = LS_DOTS.flatMap((dots) => LS_ROUNDS.flatMap((round) => LS_GLOBES.map((globeColor) => ({ dots, round, globeColor }))));
const sim = (v: V) => landSeaDotsModule.simulate(v, experiment) as ReturnType<typeof simulateLandSeaDots>;
const last = (v: V): LandSeaDotsSample => sim(v).samples.at(-1)!;
const at = (v: V, n: number): LandSeaDotsSample => sim(v).samples[n]!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const props = (v: V, snapshot: LandSeaDotsSample | null, ran = true) => ({ experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 });
const globe = (v: V, snapshot: LandSeaDotsSample | null, ran = true) => renderToStaticMarkup(createElement(LandSeaMacroView, props(v, snapshot, ran)));
const flat = (v: V, snapshot: LandSeaDotsSample | null, ran = true) => renderToStaticMarkup(createElement(LandSeaMapView, props(v, snapshot, ran)));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);

describe('레지스트리', () => {
  it('g3-earth-sea 활동 3은 land-sea-dots 모듈로 로드되고 앞의 두 활동은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['지구와 바다', 3, 'earth', ['4과06-01', '4과06-02', '4과06-03']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id])).toEqual([['variable', 'sea-water'], ['observe', 'tide'], ['variable', 'land-sea-dots']]);
    expect(unit.module.kind).toBe('sea-water');
    expect(activity.module).toBe(landSeaDotsModule);
    expect(MODULES['land-sea-dots'].kind).toBe('land-sea-dots');
    expect(experiment.safety).toEqual([]);
    expect(landSeaDotsModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['육지와 바다의 넓이 비교하기', '지구의 겉은 육지와 바다 가운데 어느 쪽이 더 넓을까?', '예측: 바다에 떨어진 점의 비율은?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['dots', '찍은 점의 수', 10], ['round', '점 찍기 차례', 1], ['globeColor', '지구본 받침 색', 'red']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [[10, '10개'], [50, '50개'], [100, '100개'], [500, '500개']],
      [[1, '첫째'], [2, '둘째'], [3, '셋째']],
      [['red', '빨간색'], ['blue', '파란색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['seaPct', '바다에 떨어진 점의 비율', '%'], ['sea', '바다에 떨어진 점', '개'], ['land', '육지에 떨어진 점', '개']]);
    expect(ROUND_TEXT).toEqual({ 1: '첫째', 2: '둘째', 3: '셋째' });
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 바다 비율(정수 %)과 바다·육지 점 수, 받침 색 무영향', () => {
    const cols = landSeaDotsModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['바다에 떨어진 점의 비율(%)', '바다에 떨어진 점(개)', '육지에 떨어진 점(개)']);
    const row = (v: V) => cols.map((c) => c.value(sim(v).result));
    for (const v of CONDITIONS) {
      const r = sim(v).result;
      expect(row(v)).toEqual([String(r.seaPct), String(r.sea), String(r.land)]);
      expect(row(v)).toEqual(row({ ...v, globeColor: v.globeColor === 'red' ? 'blue' : 'red' }));
      expect(r.sea + r.land).toBe(v.dots);
    }
  });

  it('센서: 가상 계수기(바다 점 비율 %)는 지금까지의 비율이고 점이 없으면 0이다', () => {
    const specs = landSeaDotsModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.ariaLabel, s.unit, s.kind])).toEqual([['가상 계수기: 바다 점 비율', '바다 점 비율', '%', 'humidity']]);
    expect(specs[0]!.source).toBe(0);
    const v = { dots: 500, round: 3, globeColor: 'red' };
    expect(landSeaDotsModule.sensors(last(v), v)[0]!.source).toBeCloseTo(sim(v).result.sea / 5, 6);
    expect(counterPct(at(v, 0))).toBe(0);
  });

  it('그래프 설정: y 0~100 %, x는 찍은 점 순서(자동 눈금), 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = landSeaDotsModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['지금까지 바다 비율(%)', undefined, [0, 20, 40, 60, 80, 100], '찍은 점 순서(번째)', undefined, undefined, undefined]);
    expect(landSeaDotsModule.restPlayhead).toBeUndefined();
    expect(landSeaDotsModule.metric.sampleKey).toBe('seaPct');
    expect(landSeaDotsModule.metric.resultKey).toBe('seaPct');
  });

  it('예측 비교는 바다 비율(1 %p 기준): 같은 조건·받침 색만 다르면 변하지 않음, 점 수·차례가 바뀌면 달라질 수 있다', () => {
    const m = landSeaDotsModule.metric;
    const pct = (v: V) => sim(v).result[m.resultKey as 'seaPct'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(1);
    for (const v of CONDITIONS) expect(observedOutcome(pct(v), pct({ ...v, globeColor: v.globeColor === 'red' ? 'blue' : 'red' }), th)).toBe('same');
    expect(observedOutcome(pct({ dots: 10, round: 1, globeColor: 'red' }), pct({ dots: 10, round: 3, globeColor: 'red' }), th)).toBe('decrease');
    expect(observedOutcome(pct({ dots: 10, round: 3, globeColor: 'red' }), pct({ dots: 10, round: 1, globeColor: 'red' }), th)).toBe('increase');
  });

  it('그래프가 그려지고 축 라벨과 눈금이 있다', () => {
    const v = { dots: 100, round: 1, globeColor: 'red' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: landSeaDotsModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 100, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('지금까지 바다 비율(%)');
    expect(html).toContain('찍은 점 순서(번째)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '20', '40', '60', '80', '100']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기(지구본)와 평면 지도', () => {
  it('실행 전에는 점이 하나도 없다 — 모든 조건, 지구본과 평면 지도', () => {
    for (const v of CONDITIONS) {
      const a = globe(v, null, false);
      const b = flat(v, null, false);
      expect(count(a, 'globe-dot')).toBe(0);
      expect(count(b, 'map-dot')).toBe(0);
      expect(a).toContain('data-shown="0"');
      expect(a).toContain('실험하면 점이 하나씩 찍혀요.');
      expect(b).toContain('실험하면 점이 하나씩 찍혀요.');
      expect(shownText(a).some((t) => t.includes('바다 비율'))).toBe(false);
    }
  });

  it('실행하면 점이 찍힌 수만큼 평면 지도에 나타나고, 바다 점은 원·육지 점은 세모이다', () => {
    for (const v of [base, { dots: 100, round: 2, globeColor: 'blue' }, { dots: 500, round: 3, globeColor: 'red' }]) {
      const html = flat(v, last(v));
      const r = sim(v).result;
      expect(count(html, 'map-dot')).toBe(v.dots);
      expect((html.match(/data-kind="sea"/g) ?? []).length).toBe(r.sea);
      expect((html.match(/data-kind="land"/g) ?? []).length).toBe(r.land);
      expect(html).toContain(`<circle data-testid="map-dot" data-kind="sea"`);
      if (r.land > 0) expect(html).toContain(`<polygon data-testid="map-dot" data-kind="land"`);
    }
  });

  it('재생 중에는 지금까지 찍은 점만 보인다(점 순서 t)', () => {
    const v = { dots: 100, round: 1, globeColor: 'red' };
    for (const n of [1, 10, 37, 100]) {
      const html = flat(v, at(v, n));
      expect(count(html, 'map-dot')).toBe(n);
      expect(shownCount(true, at(v, n), 100)).toBe(n);
      expect(html).toContain(`${n}개 찍음`);
    }
    expect(count(flat(v, at(v, 0)), 'map-dot')).toBe(0);
    expect(shownCount(true, null, 100)).toBe(100);
    expect(shownCount(false, null, 100)).toBe(0);
  });

  it('지구본에는 보이는 반구의 점만 나타나고 가장자리 안에 있다', () => {
    const v = { dots: 500, round: 1, globeColor: 'red' };
    const html = globe(v, last(v));
    const n = count(html, 'globe-dot');
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(400);
    for (const m of html.matchAll(/data-testid="globe-dot" data-kind="sea" cx="([\d.]+)" cy="([\d.]+)"/g)) {
      expect(Math.hypot(Number(m[1]) - GLOBE.cx, Number(m[2]) - GLOBE.cy)).toBeLessThanOrEqual(GLOBE.r + 0.5);
    }
  });

  it('정사도법: 중심은 그림 중심, 반대편은 보이지 않는다', () => {
    const c = projectGlobe(GLOBE.lat0, GLOBE.lon0);
    expect([c.x, c.y, c.visible]).toEqual([GLOBE.cx, GLOBE.cy, true]);
    expect(projectGlobe(-GLOBE.lat0, GLOBE.lon0 + 180).visible).toBe(false);
    expect(globeLandPath().startsWith('M')).toBe(true);
    expect(mapLandPath().startsWith('M')).toBe(true);
    expect(MAP.w / MAP.h).toBe(2);
  });

  it('받침 색만 바꾸면 받침 색과 라벨만 다르고 나머지 그림은 같다 (대조 변인)', () => {
    for (const v of CONDITIONS.filter((c) => c.globeColor === 'red')) {
      const other = { ...v, globeColor: 'blue' };
      const strip = (html: string) => html.replace(/data-fill="#[0-9a-f]+"/g, '').replace(new RegExp(`fill="${GLOBE_FILL.red}"|fill="${GLOBE_FILL.blue}"`, 'g'), '').replace(/aria-label="[^"]*"/g, '').replace(/(빨간색|파란색)/g, '');
      const a = globe(v, last(v));
      const b = globe(other, last(other));
      expect(a).not.toBe(b);
      expect(strip(a)).toBe(strip(b));
      expect(flat(v, last(v))).toBe(flat(other, last(other)));
    }
    expect(globe(base, null, false)).toContain(`지구본 받침 색: ${GLOBE_TEXT.red}`);
  });

  it('문구: 찍은 점 수와 바다·육지 점, 바다 비율', () => {
    expect(dotsNote(0, 0)).toBe('0개 찍음 · 바다 0개(원) · 육지 0개(세모)');
    expect(dotsNote(10, 7)).toBe('10개 찍음 · 바다 7개(원) · 육지 3개(세모) · 바다 비율 70 %');
  });

  it('SVG 글자는 모두 14 이상이고 안내 문구가 모든 조건에서 가드를 통과한다', () => {
    for (const v of CONDITIONS) {
      for (const html of [globe(v, last(v)), flat(v, last(v))]) {
        for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
        for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
      }
    }
  });
});
