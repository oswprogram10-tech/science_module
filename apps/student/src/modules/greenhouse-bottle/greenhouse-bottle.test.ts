import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { guardOutput } from '@sci/tutor';
import { simulateGreenhouse, type GreenhouseSample } from '@sci/engine-ssi';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { greenhouseBottleModule } from './index';
import { FLOW_IDLE_NOTE, FLOW_NOTE, HEAT_COUNT, IDLE_NOTE, IDLE_SAMPLE, LIMITS_TEXT, LIMITS_TITLE, bottleNote, returningCount, shownRise, shownTemp, signedRise } from './initial';
import { BottleView } from './BottleView';
import { HeatFlowView } from './HeatFlowView';
import { ClimateDataPanel, NARROW, WIDE, segments } from './ClimateDataPanel';
import * as I from './initial';

const unit = UNITS.find((u) => u.id === 'g4-climate')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g4-climate가 없어요');
const experiment = unit.experiment;
type V = { cover: string; air: string; cap: string };
const base: V = { cover: 'none', air: 'normal', cap: 'white' };
const CONDITIONS: V[] = ['none', 'film'].flatMap((cover) => ['normal', 'co2'].flatMap((air) => ['white', 'blue'].map((cap) => ({ cover, air, cap }))));
const sim = (v: V) => simulateGreenhouse(v as never);
const at = (v: V, t: number): GreenhouseSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: GreenhouseSample | null, ran = true) =>
  renderToStaticMarkup(createElement(BottleView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const flow = (v: V, snapshot: GreenhouseSample | null, ran = true) =>
  renderToStaticMarkup(createElement(HeatFlowView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const text = (html: string) => html.replace(/<[^>]*>/g, ' ');

describe('레지스트리', () => {
  it('g4-climate는 greenhouse-bottle 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(4);
    expect(unit.manifest.engine).toBe('ssi');
    expect(unit.module).toBe(greenhouseBottleModule);
    expect(MODULES['greenhouse-bottle'].kind).toBe('greenhouse-bottle');
    expect(experiment.safety).toEqual(['heat']);
    expect(experiment.safetyChecklist).toHaveLength(3);
  });

  it('안전 문구는 산 용액용이 아니라 전등·이산화 탄소에 맞다', () => {
    const m = experiment.safetyMessages!;
    for (const t of Object.values(m)) expect(t).not.toMatch(/산성|용액|알코올|증발|향/);
    expect(m.NO_GOGGLES).toContain('전등');
    expect(m.NO_GOGGLES).toContain('이산화 탄소');
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 오른 온도(+ 기호), 20분 뒤 온도', () => {
    const cols = greenhouseBottleModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['오른 온도(°C)', '20분 뒤 온도(°C)']);
    const row = (cover: string, air: string) => cols.map((c) => c.value(sim({ cover, air, cap: 'blue' }).result));
    expect(row('none', 'normal')).toEqual(['+5.8', '27.8']);
    expect(row('none', 'co2')).toEqual(['+7.2', '29.2']);
    expect(row('film', 'normal')).toEqual(['+9.6', '31.6']);
    expect(row('film', 'co2')).toEqual(['+11.1', '33.1']);
    expect(signedRise(0)).toBe('0.0');
  });

  it('센서: 가상 온도계: 병 속(temperature), 실행 전에는 22 °C', () => {
    const idle = greenhouseBottleModule.sensors(null, base);
    expect(idle.map((s) => [s.label, s.kind, s.unit, s.source])).toEqual([['가상 온도계: 병 속', 'temperature', '°C', 22]]);
    expect(greenhouseBottleModule.sensors(at({ ...base, cover: 'film', air: 'co2' }, 20), base)[0]!.source).toBeCloseTo(33.09, 2);
  });

  it('그래프 설정: y = 병 속 온도 20~35 고정(눈금 20·25·30·35), x 0~20분', () => {
    const g = greenhouseBottleModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series]).toEqual(['병 속 온도(°C)', 20, [20, 25, 30, 35], '시간(분)', [0, 5, 10, 15, 20], undefined]);
    expect(greenhouseBottleModule.restPlayhead).toBe(20);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['rise', '오른 온도', '°C'], ['temp', '20분 뒤 온도', '°C']]);
    const html = renderToStaticMarkup(createElement(GraphView, { module: greenhouseBottleModule as never, experiment, trial: trialOf({ ...base, cover: 'film', air: 'co2' }), prev: trialOf(base), playhead: 20, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    const yTicks = [...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(yTicks).toEqual(['20', '25', '30', '35']);
    expect(html).toContain('병 속 온도(°C)');
    expect(html).toContain('시간(분)');
  });

  it('예측 비교: rise, 0.2 °C 안이면 같음(뚜껑), 덮개는 늘어남', () => {
    const m = greenhouseBottleModule.metric;
    expect([m.sampleKey, m.resultKey]).toEqual(['temp', 'rise']);
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.2);
    const rise = (v: V) => sim(v).result.rise;
    expect(observedOutcome(rise(base), rise({ ...base, cover: 'film' }), th)).toBe('increase');
    expect(observedOutcome(rise(base), rise({ ...base, air: 'co2' }), th)).toBe('increase');
    expect(observedOutcome(rise(base), rise({ ...base, cap: 'blue' }), th)).toBe('same');
  });

  it('모듈은 샘플과 결과만 돌려준다', () => {
    const out = greenhouseBottleModule.simulate(base as never, experiment);
    expect(Object.keys(out).sort()).toEqual(['result', 'samples']);
    expect(out.samples).toHaveLength(201);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}분 · 병 속 {temp} °C (처음보다 +{rise} °C)"', () => {
    expect(bottleNote(at(base, 20))).toBe('20.0분 · 병 속 27.8 °C (처음보다 +5.8 °C)');
    expect(macro({ ...base, cover: 'film', air: 'co2' }, at({ ...base, cover: 'film', air: 'co2' }, 20))).toContain('20.0분 · 병 속 33.1 °C (처음보다 +11.1 °C)');
  });

  it('어느 시각에서도 보이는 온도 − 22 = 보이는 오른 온도', () => {
    for (const v of CONDITIONS) {
      for (const s of sim(v).samples) expect((Number(shownTemp(s)) - 22).toFixed(1)).toBe(shownRise(s));
      for (const k of [0.1, 0.33, 0.5, 0.77]) {
        const s = greenhouseBottleModule.interpolate(at(v, 3), at(v, 3.1), k);
        expect((Number(shownTemp(s)) - 22).toFixed(1)).toBe(shownRise(s));
      }
    }
  });

  it('실행 전에는 조건과 상관없이 같은 문구·온도(22.0)이고 결과를 드러내지 않는다', () => {
    const idle = macro(base, null, false);
    expect(idle).toContain(IDLE_NOTE);
    expect(idle).not.toContain('처음보다');
    expect(idle).toContain('22.0°C');
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 20), false);
      expect(html).toContain(IDLE_NOTE);
      expect(html).toContain('22.0°C');
      expect(html).not.toContain('처음보다');
    }
    expect(IDLE_SAMPLE.temp).toBe(22);
  });

  it('덮개를 씌울 때만 점선 테두리의 투명 막이 있다', () => {
    expect(count(macro(base, at(base, 20)), 'film')).toBe(0);
    const html = macro({ ...base, cover: 'film' }, at(base, 20));
    expect(count(html, 'film')).toBe(1);
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain('투명');
  });

  it('이산화 탄소면 "이산화 탄소 +" 이름표만 있고 점·연기는 그리지 않는다', () => {
    const none = macro(base, at(base, 20));
    expect(count(none, 'co2-label')).toBe(0);
    const html = macro({ ...base, air: 'co2' }, at(base, 20));
    expect(count(html, 'co2-label')).toBe(1);
    expect(html).toContain('이산화 탄소 +');
    expect(html).not.toMatch(/smoke|연기|<circle[^>]*data-testid="(co2|gas)/);
    // 병 속에는 온도계 점(작은 원 1개)뿐이다
    expect((html.match(/<circle/g) ?? []).length).toBe((macro(base, at(base, 20)).match(/<circle/g) ?? []).length);
    // 실행 전에도 같다
    expect(count(macro({ ...base, air: 'co2' }, null, false), 'co2-label')).toBe(1);
  });

  it('뚜껑 색이 바뀌어도 병 속 숫자는 같고 뚜껑 색만 다르다', () => {
    const w = macro(base, at(base, 20));
    const b = macro({ ...base, cap: 'blue' }, at(base, 20));
    expect(w).toContain('data-color="white"');
    expect(b).toContain('data-color="blue"');
    expect(w).toContain('흰색 뚜껑');
    expect(b).toContain('파란색 뚜껑');
    expect(w.replace(/white|blue|흰색|파란색|#ffffff|#374151|#2563eb|#1e3a8a/g, '')).toBe(b.replace(/white|blue|흰색|파란색|#ffffff|#374151|#2563eb|#1e3a8a/g, ''));
  });
});

describe('열이 드나드는 모습 보기', () => {
  const FILM_CO2: V = { ...base, cover: 'film', air: 'co2' };

  it('되돌아오는 개수는 trapped에 비례해 단조 증가한다: 3, 4, 5, 6 (모두 8개 중)', () => {
    const counts = [base, { ...base, air: 'co2' }, { ...base, cover: 'film' }, FILM_CO2].map((v) => returningCount(at(v, 20).trapped));
    expect(counts).toEqual([3, 4, 5, 6]);
    expect(HEAT_COUNT).toBe(8);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]!);
  });

  it('화살표: 들어오는 빛 4개, 나가려는 열 8개 중 일부만 되돌아오고 나머지는 빠져나간다', () => {
    for (const v of CONDITIONS) {
      const html = flow(v, at(v, 10));
      const back = returningCount(at(v, 10).trapped);
      expect(count(html, 'light-arrow')).toBe(4);
      expect(count(html, 'heat-back')).toBe(back);
      expect(count(html, 'heat-return')).toBe(back);
      expect(count(html, 'heat-escape')).toBe(HEAT_COUNT - back);
      expect(count(html, 'heat-escape')).toBeGreaterThan(0);
      expect(html).toContain(`data-returning="${back}"`);
    }
  });

  it('덮개를 씌우면 되돌아오는 열이 더 많다', () => {
    const film = { ...base, cover: 'film' };
    expect(count(flow(film, at(film, 5)), 'heat-return')).toBeGreaterThan(count(flow(base, at(base, 5)), 'heat-return'));
  });

  it('시행 뒤 라벨: 들어오는 빛, 빠져나가는 열, 되돌아오는 열 / 문구 / 모형의 한계', () => {
    const html = flow(base, at(base, 20));
    for (const l of ['들어오는 빛', '빠져나가는 열', '되돌아오는 열']) expect(html).toContain(`>${l}</text>`);
    expect(html).toContain(FLOW_NOTE);
    expect(FLOW_NOTE).toBe('공기층은 담요처럼 열이 빠져나가는 것을 늦춰요.');
    expect(html).toContain(`<summary>${LIMITS_TITLE}</summary>`);
    expect(html).toContain(LIMITS_TEXT);
    expect(LIMITS_TEXT).toBe('실제 지구는 병보다 훨씬 크고, 바다·구름·숲 같은 많은 것이 함께 영향을 줘요.');
  });

  it('첫 시행 전에는 열 화살표·그 이름표·결과 설명이 없다(들어오는 빛만)', () => {
    for (const v of CONDITIONS) {
      const html = flow(v, at(v, 20), false);
      for (const id of ['heat-arrows', 'heat-back', 'heat-escape', 'heat-return', 'heat-out']) expect(count(html, id), id).toBe(0);
      for (const l of ['빠져나가는 열', '되돌아오는 열']) expect(html).not.toContain(l);
      expect(html).not.toContain(FLOW_NOTE);
      expect(html).toContain(FLOW_IDLE_NOTE);
      expect(html).toContain('>들어오는 빛</text>');
      // 모형의 한계 글은 실행 전에도 언제나 있다
      expect(html).toContain(LIMITS_TEXT);
    }
    expect(flow(base, null, false)).toBe(flow(FILM_CO2, null, false).replace('덮개 씌움', '덮개 없음').replace('이산화 탄소를 더 넣은 공기', '보통 공기'));
  });

  it('같은 입력은 같은 그림이다', () => {
    expect(flow(base, at(base, 9))).toBe(flow(base, at(base, 9)));
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };
  it('눈으로 보기·열이 드나드는 모습·모형의 한계·문구는 금지 구절과 겹치지 않는다', () => {
    for (const v of CONDITIONS) {
      for (const html of [macro(v, at(v, 20)), macro(v, null, false), flow(v, at(v, 20)), flow(v, null, false)]) {
        const shown = text(html);
        expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
      }
    }
    for (const t of [FLOW_NOTE, FLOW_IDLE_NOTE, IDLE_NOTE, LIMITS_TITLE, LIMITS_TEXT, bottleNote(at(base, 20))]) expect(guardOutput(t, guard).ok, t).toBe(true);
  });
});

describe('진짜 기온 자료 패널', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };
  const html = renderToStaticMarkup(createElement(ClimateDataPanel));
  const shown = text(html.replace(/aria-label="([^"]*)"/g, '> $1 <'));

  it('모듈의 ResultsExtra이고 접힌 details로 시작한다', () => {
    expect(greenhouseBottleModule.ResultsExtra).toBe(ClimateDataPanel);
    expect(html).toMatch(/<details class="climate-data" data-testid="climate-data">/);
    expect(html).not.toMatch(/<details[^>]* open/);
  });

  it('화면 글(안내·질문·주의·출처·라벨·aria-label·표)이 금지 구절·학년 밖 용어에 걸리지 않는다', () => {
    expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
    for (const t of [I.CLIMATE_DATA_TITLE, I.CLIMATE_DATA_INTRO, I.CLIMATE_DATA_QUESTION, I.CLIMATE_DATA_CAUTION, I.CLIMATE_DATA_SOURCE, I.CLIMATE_DATA_NO_DATA, I.climateDataFirstLabel('10.8'), I.climateDataLastLabel('13.1'), I.climateDataAria('10.8', '13.1'), I.CLIMATE_DATA_TABLE_CAPTION, ...I.CLIMATE_DATA_TABLE_HEADS]) {
      expect(guardOutput(t, guard).ok, t).toBe(true);
    }
    expect(shown).not.toMatch(/때문에 (올|높)/);
  });

  it('문구: 사양 그대로, 평균 10.8·13.1', () => {
    expect(html).toContain('aria-label="서울의 해마다 평균 기온, 1908년부터 2025년까지. 처음 30년 평균 10.8도, 최근 30년 평균 13.1도."');
    expect(shown).toContain('처음 30년 평균 10.8 °C');
    expect(shown).toContain('최근 30년 평균 13.1 °C');
    expect(shown).toContain('자료 없음(1950~1953)');
    expect(html).toContain('기상청이 서울에서 잰 해마다의 평균 기온이에요. 오래전과 요즘을 비교해 볼까요?');
    expect(html).toContain(I.CLIMATE_DATA_SOURCE);
  });

  it('선은 1950~1953에서 끊긴다(구간 둘, 그 해의 점 없음)', () => {
    const segs = segments();
    expect(segs.map((s) => [s[0]!.year, s.at(-1)!.year])).toEqual([[1908, 1949], [1954, 2025]]);
    expect((html.match(/data-testid="climate-segment"/g) ?? []).length).toBe(2);
    expect((html.match(/data-testid="climate-dot"/g) ?? []).length).toBe(114);
    for (const y of [1907, 1950, 1951, 1952, 1953]) expect(html).not.toContain(`data-year="${y}"`);
  });

  it('표: 12줄, 첫 줄·끝 줄, 6해·8해에만 자료 해 수', () => {
    const rows = [...html.matchAll(/<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((m) => `${m[1]} / ${m[2]}`);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toBe('1908~1917 / 10.6');
    expect(rows[4]).toBe('1948~1957 / 11.1 (자료 6해)');
    expect(rows[11]).toBe('2018~2025 / 13.7 (자료 8해)');
    expect(rows.filter((r) => r.includes('자료')).length).toBe(2);
  });

  it('넓은 배치와 좁은 배치가 있고 글자 크기는 15 이하로 폭 안에 든다', () => {
    expect([WIDE.W, WIDE.H, NARROW.W, NARROW.H]).toEqual([640, 300, 340, 320]);
    expect(WIDE.font).toBeGreaterThanOrEqual(14);
    expect(NARROW.font).toBeGreaterThanOrEqual(14);
  });
});
