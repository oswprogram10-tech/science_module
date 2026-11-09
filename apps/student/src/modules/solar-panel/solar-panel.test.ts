import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { guardOutput } from '@sci/tutor';
import { simulateSolar, type SolarSample } from '@sci/engine-ssi';
import { GraphView } from '../../components/GraphView';
import { SensorBar } from '../../components/SensorBar';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { solarPanelModule } from './index';
import { BEAM_IDLE_NOTE, BEAM_NOTE, IDLE_NOTE, LIMITS_TEXT, LIMITS_TITLE, beamLayout, panelNote } from './initial';
import { PanelView } from './PanelView';
import { BeamView } from './BeamView';

const unit = UNITS.find((u) => u.id === 'g5-energy')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g5-energy가 없어요');
const experiment = unit.experiment;
type V = { tilt: number; weather: string; shade: string; frame: string };
const base: V = { tilt: 0, weather: 'sunny', shade: 'none', frame: 'black' };
const CONDITIONS: V[] = [0, 30, 60].flatMap((tilt) => ['sunny', 'cloudy'].flatMap((weather) => ['none', 'half'].flatMap((shade) => ['black', 'silver'].map((frame) => ({ tilt, weather, shade, frame })))));
const sim = (v: V) => simulateSolar(v as never);
const at = (v: V, t: number): SolarSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: SolarSample | null, ran = true, playhead = 0) =>
  renderToStaticMarkup(createElement(PanelView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead }));
const beams = (v: V, ran = true) => renderToStaticMarkup(createElement(BeamView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot: null, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const text = (html: string) => html.replace(/<[^>]*>/g, ' ');

describe('레지스트리', () => {
  it('g5-energy는 solar-panel 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(5);
    expect(unit.manifest.engine).toBe('ssi');
    expect(unit.module).toBe(solarPanelModule);
    expect(MODULES['solar-panel'].kind).toBe('solar-panel');
    expect(experiment.safety).toEqual(['sun']);
    expect(experiment.safetyChecklist).toHaveLength(3);
  });

  it('안전 문구는 산 용액용이 아니라 야외 햇빛·프로펠러에 맞다', () => {
    const m = experiment.safetyMessages!;
    for (const t of Object.values(m)) expect(t).not.toMatch(/산성|용액|알코올|증발|향/);
    expect(m.NO_GOGGLES).toContain('태양');
    expect(m.NO_GLOVES).toContain('프로펠러');
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 만든 전기(mW), 1분 동안 돈 횟수(번)', () => {
    const cols = solarPanelModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['만든 전기(mW)', '1분 동안 돈 횟수(번)']);
    expect(cols.map((c) => c.value(sim(base).result))).toEqual(['433', '104']);
    expect(cols.map((c) => c.value(sim({ ...base, tilt: 30 }).result))).toEqual(['500', '120']);
  });

  it('센서: 가상 전력계(power, mW), 실행 전에는 0', () => {
    expect(solarPanelModule.sensors(null, base).map((s) => [s.label, s.kind, s.unit, s.source])).toEqual([['가상 전력계', 'power', 'mW', 0]]);
    expect(solarPanelModule.sensors(at({ ...base, tilt: 30 }, 10), base)[0]!.source).toBe(500);
    const html = renderToStaticMarkup(createElement(SensorBar, { specs: solarPanelModule.sensors(at(base, 10), base) }));
    expect(html).toContain('433 mW');
    expect(html).toContain('aria-label="전력"');
  });

  it('그래프 설정: y = 프로펠러가 돈 횟수 0~125 고정, 정수 눈금, x 0~60초', () => {
    const g = solarPanelModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.integerTicks, g.xLabel, g.xTicks, g.series]).toEqual(['프로펠러가 돈 횟수(번)', 0, [0, 25, 50, 75, 100, 125], true, '시간(초)', [0, 10, 20, 30, 40, 50, 60], undefined]);
    expect(solarPanelModule.restPlayhead).toBe(60);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['power', '만든 전기', 'mW'], ['turns', '1분 동안 프로펠러가 돈 횟수', '번']]);
    const html = renderToStaticMarkup(createElement(GraphView, { module: solarPanelModule as never, experiment, trial: trialOf({ ...base, tilt: 30 }), prev: trialOf(base), playhead: 60, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '25', '50', '75', '100', '125']);
    expect(html).toContain('프로펠러가 돈 횟수(번)');
    expect(html).toContain('시간(초)');
  });

  it('예측 비교: power, 1 mW 안이면 같음(테두리), 30°는 늘어남, 60°는 줄어듦', () => {
    const m = solarPanelModule.metric;
    expect([m.sampleKey, m.resultKey]).toEqual(['turns', 'power']);
    const th = m.sameThreshold(experiment);
    expect(th).toBe(1);
    const pw = (v: V) => sim(v).result.power;
    expect(observedOutcome(pw(base), pw({ ...base, tilt: 30 }), th)).toBe('increase');
    expect(observedOutcome(pw({ ...base, tilt: 30 }), pw({ ...base, tilt: 60 }), th)).toBe('decrease');
    expect(observedOutcome(pw(base), pw({ ...base, frame: 'silver' }), th)).toBe('same');
  });

  it('모듈은 샘플과 결과만 돌려준다', () => {
    const out = solarPanelModule.simulate(base as never, experiment);
    expect(Object.keys(out).sort()).toEqual(['result', 'samples']);
    expect(out.samples).toHaveLength(121);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}초 · 만든 전기 {power} mW · 돈 횟수 {turns}번"', () => {
    expect(panelNote(at(base, 60))).toBe('60.0초 · 만든 전기 433 mW · 돈 횟수 104번');
    expect(macro({ ...base, tilt: 30 }, at({ ...base, tilt: 30 }, 60))).toContain('60.0초 · 만든 전기 500 mW · 돈 횟수 120번');
    expect(panelNote(at(base, 0))).toBe('0.0초 · 만든 전기 433 mW · 돈 횟수 0번');
  });

  it('실행 전에는 조건과 상관없이 결과 숫자 없이 같은 문구이고 프로펠러는 멈춰 있다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 60), false);
      expect(html).toContain(IDLE_NOTE);
      expect(html).not.toContain('만든 전기 ');
      expect(html).toContain('data-running="false"');
    }
  });

  it('기울기만큼 패널이 기울고 치수 숫자가 보인다(태양 쪽을 향해 오른쪽이 올라간다)', () => {
    for (const tilt of [0, 30, 60]) {
      const html = macro({ ...base, tilt }, null, false);
      expect(html).toContain(`data-tilt="${tilt}"`);
      expect(html).toContain(`rotate(${-tilt})`);
      expect(html).toContain(`>${tilt}°<`);
      expect(count(html, 'tilt-arc')).toBe(tilt > 0 ? 1 : 0);
    }
  });

  it('흐린 날에만 구름, 그늘에만 나무와 그림자, 테두리 색은 패널 테두리에만 나타난다', () => {
    expect(count(macro(base, null, false), 'clouds')).toBe(0);
    expect(count(macro({ ...base, weather: 'cloudy' }, null, false), 'clouds')).toBe(1);
    expect(count(macro(base, null, false), 'tree')).toBe(0);
    const shaded = macro({ ...base, shade: 'half' }, null, false);
    expect(count(shaded, 'tree')).toBe(1);
    expect(count(shaded, 'shade')).toBe(1);
    expect(macro({ ...base, frame: 'silver' }, null, false)).toContain('data-frame="silver"');
    expect(macro(base, null, false)).toContain('data-testid="wire"');
    expect(macro(base, null, false)).toContain('data-testid="propeller"');
  });

  it('같은 입력은 같은 그림이다', () => {
    expect(macro(base, at(base, 9))).toBe(macro(base, at(base, 9)));
  });
});

describe('빛이 닿는 모습 보기', () => {
  it('줄기 6개, 닿는 수와 간격은 cos(inc)를 반영한다(0° 5개·간격 20.8, 30° 6개·간격 18.0)', () => {
    for (const v of CONDITIONS) expect(count(beams(v), 'beam')).toBe(6);
    const l0 = beamLayout(0, 'none');
    const l30 = beamLayout(30, 'none');
    expect(l30.spacing).toBeCloseTo(18, 9);
    expect(l0.spacing).toBeCloseTo(18 / Math.cos(Math.PI / 6), 9);
    expect(l0.spacing).toBeGreaterThan(l30.spacing);
    expect(beamLayout(60, 'none')).toEqual(l0);
    expect(l30.beams.filter((b) => b.state === 'hit')).toHaveLength(6);
    expect(l0.beams.filter((b) => b.state === 'hit')).toHaveLength(5);
    expect(beams({ ...base, tilt: 30 })).toContain('data-spacing="18.0"');
    expect(beams(base)).toContain('data-spacing="20.8"');
    expect(beams(base)).toContain('data-hit="5"');
  });

  it('그늘이면 절반(3개)의 줄기가 막힌다', () => {
    for (const tilt of [0, 30, 60]) {
      const html = beams({ ...base, tilt, shade: 'half' });
      expect(html).toContain('data-blocked="3"');
      expect(count(html, 'canopy')).toBe(1);
      expect((html.match(/data-state="blocked"/g) ?? []).length).toBe(3);
    }
    expect(beams({ ...base, tilt: 30 })).toContain('data-blocked="0"');
    expect(count(beams(base), 'canopy')).toBe(0);
  });

  it('라벨, 문구, 모형의 한계 글', () => {
    const html = beams(base);
    expect(html).toContain('>햇빛</text>');
    expect(html).toContain('>패널</text>');
    expect(html).toContain(BEAM_NOTE);
    expect(BEAM_NOTE).toBe('같은 넓이에 닿는 빛줄기가 많을수록 전기를 많이 만들어요.');
    expect(html).toContain(`<summary>${LIMITS_TITLE}</summary>`);
    expect(html).toContain(LIMITS_TEXT);
    expect(LIMITS_TEXT).toBe('실제 패널은 일부만 가려져도 더 많이 줄 수 있어요. 태양 높이는 계절과 시각에 따라 달라져요.');
  });

  it('첫 시행 전에는 조건과 상관없이 같은 줄기(패널에 닿지 않음)와 안내만 있고 결과 문구·막힘·간격이 없다', () => {
    for (const v of CONDITIONS) {
      const html = beams(v, false);
      expect(count(html, 'beam-idle')).toBe(6);
      for (const id of ['beams', 'beam', 'hit-dot', 'canopy', 'shade-section']) expect(count(html, id), id).toBe(0);
      expect(html).not.toContain(BEAM_NOTE);
      expect(html).toContain(BEAM_IDLE_NOTE);
      expect(html).not.toContain('data-spacing');
      expect(html).toContain(LIMITS_TEXT);
    }
    const strip = (h: string) => h.replace(/<g data-testid="panel-section"[\s\S]*?<\/g>/, '').replace(/ aria-label="[^"]*"/g, '').replace(/<text data-testid="label-panel"[^>]*>/, '');
    expect(strip(beams({ ...base, tilt: 30, weather: 'cloudy', shade: 'half' }, false)).replace(/<line[^>]*stroke-width="3"[^>]*>/g, '').length).toBe(strip(beams(base, false)).replace(/<line[^>]*stroke-width="3"[^>]*>/g, '').length);
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };
  it('눈으로 보기·빛이 닿는 모습·한계 글·문구는 금지 구절과 겹치지 않는다', () => {
    for (const v of CONDITIONS) {
      for (const html of [macro(v, at(v, 60)), macro(v, null, false), beams(v), beams(v, false)]) {
        const shown = text(html);
        expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
      }
    }
    for (const t of [BEAM_NOTE, BEAM_IDLE_NOTE, IDLE_NOTE, LIMITS_TITLE, LIMITS_TEXT, panelNote(at(base, 60))]) expect(guardOutput(t, guard).ok, t).toBe(true);
  });
});
