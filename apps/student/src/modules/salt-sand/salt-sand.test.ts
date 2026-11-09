import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { simulateSeparation, type SeparationSample } from '@sci/engine-matter';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { saltSandModule } from './index';
import { separationNote, stageName, startSample } from './initial';
import { SaltSandMacroView, undissolvedCount } from './SaltSandMacroView';
import { SaltSandParticleView, dissolvedDotCount, lumpCount } from './SaltSandParticleView';

const unit = UNITS.find((u) => u.id === 'g5-mixture')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g5-mixture가 없어요');
const experiment = unit.experiment;
type V = { waterMl: number; filter: string; stirrer: string };
const base: V = { waterMl: 50, filter: 'paper', stirrer: 'glass' };
const sim = (v: V) => simulateSeparation(v as never);
const at = (v: V, t: number): SeparationSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: SeparationSample | null, ran = true) =>
  renderToStaticMarkup(createElement(SaltSandMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const micro = (v: V, snapshot: SeparationSample | null, ran = true, playhead = 0) =>
  renderToStaticMarkup(createElement(SaltSandParticleView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const activeStage = (html: string) => [...html.matchAll(/data-stage="(\w+)" data-active="true"/g)].map((m) => m[1]);

describe('레지스트리', () => {
  it('g5-mixture는 salt-sand 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(5);
    expect(unit.module).toBe(saltSandModule);
    expect(MODULES['salt-sand'].kind).toBe('salt-sand');
    expect(experiment.safety).toEqual(['heat']);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 4줄', () => {
    const cols = saltSandModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['얻은 소금(g)', '섞인 모래(g)']);
    const row = (waterMl: number, filter: string) => cols.map((c) => c.value(sim({ waterMl, filter, stirrer: 'glass' }).result));
    expect(row(20, 'paper')).toEqual(['6.5', '0.0']);
    expect(row(20, 'pour')).toEqual(['6.5', '1.5']);
    expect(row(50, 'paper')).toEqual(['9.0', '0.0']);
    expect(row(50, 'pour')).toEqual(['9.0', '1.5']);
  });

  it('센서: 가상 전자저울: 증발 접시(scale) 하나, 비커 100 g을 빼서 접시 위 가루의 무게를 보여 준다', () => {
    const specs = saltSandModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 전자저울: 증발 접시', 'scale', 'g']]);
    expect(specs[0]!.source + 100).toBe(0);
    const end = at(base, 20);
    expect(saltSandModule.sensors(end, base)[0]!.source + 100).toBeCloseTo(9, 10);
  });

  it('그래프 설정: 접시 위 가루 0~12 고정, x 0~20분, 표식 3·8분', () => {
    const g = saltSandModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series]).toEqual(['접시 위 가루(g)', undefined, [0, 3, 6, 9, 12], '시간(분)', [0, 4, 8, 12, 16, 20], undefined]);
    expect(g.markers).toEqual([{ t: 3, label: '거르기 시작' }, { t: 8, label: '가열 시작' }]);
    expect(saltSandModule.restPlayhead).toBe(20);
    expect(saltSandModule.metric.sampleKey).toBe('solidG');
    expect(saltSandModule.metric.resultKey).toBe('salt');
  });

  it('예측 비교는 얻은 소금(g): 20 → 50 mL는 늘어남, 거르기·젓는 도구는 변하지 않음', () => {
    const m = saltSandModule.metric;
    const salt = (v: V) => sim(v).result[m.resultKey as 'salt'];
    const th = m.sameThreshold(experiment);
    expect(observedOutcome(salt(base), salt({ ...base, waterMl: 20 }), th)).toBe('decrease');
    expect(observedOutcome(salt({ ...base, waterMl: 20 }), salt(base), th)).toBe('increase');
    expect(observedOutcome(salt(base), salt({ ...base, filter: 'pour' }), th)).toBe('same');
    expect(observedOutcome(salt(base), salt({ ...base, stirrer: 'wood' }), th)).toBe('same');
  });

  it('그래프 y 최댓값은 12 안이다', () => {
    for (const waterMl of [20, 50]) for (const filter of ['paper', 'pour']) {
      expect(Math.max(...sim({ waterMl, filter, stirrer: 'glass' }).samples.map((s) => s.solidG))).toBeLessThan(12);
    }
  });

  it('그래프가 그려지고 접시 위 가루 라벨과 표식 두 개가 있다', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: saltSandModule as never, experiment, trial: trialOf(base), prev: undefined, playhead: 20, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('접시 위 가루(g)');
    expect(html).toContain('거르기 시작');
    expect(html).toContain('가열 시작');
  });
});

describe('눈으로 보기', () => {
  it('단계 세 칸이 있고 지금 단계만 강조된다', () => {
    expect(count(macro(base, null, false), 'stage-panel')).toBe(3);
    expect(activeStage(macro(base, null, false))).toEqual(['dissolve']);
    expect(activeStage(macro(base, at(base, 2)))).toEqual(['dissolve']);
    expect(activeStage(macro(base, at(base, 5)))).toEqual(['filter']);
    expect(activeStage(macro(base, at(base, 12)))).toEqual(['evaporate']);
    // 강조되지 않은 칸도 내용이 그려진다
    expect(count(macro(base, at(base, 12)), 'stage-art')).toBe(3);
  });

  it('문구: "{t}분 · {단계 이름} · 접시 위 가루 {solidG} g"', () => {
    expect(macro(base, at(base, 12))).toContain(separationNote(at(base, 12), 'paper'));
    expect(separationNote(at(base, 20), 'paper')).toBe('20.0분 · 증발시키기 · 접시 위 가루 9.0 g');
    expect(stageName('filter', 'pour')).toBe('따르기');
    expect(stageName('filter', 'paper')).toBe('거르기');
    expect(stageName('dissolve', 'paper')).toBe('녹이기');
  });

  it('실행 전에는 결과(문구의 숫자)를 보여 주지 않고, 20·50 mL 모두 녹지 않은 소금이 10개로 같다', () => {
    const a = macro({ ...base, waterMl: 20 }, null, false);
    const b = macro(base, null, false);
    expect(a).not.toContain('접시 위 가루');
    expect(a).toContain('실험하면');
    expect(count(a, 'salt-undissolved-1')).toBe(10);
    expect(count(b, 'salt-undissolved-1')).toBe(10);
    expect(count(a, 'dish-salt')).toBe(0);
    expect(count(a, 'dish-sand')).toBe(0);
  });

  it('20 mL는 3분 뒤에도 녹지 않은 소금이 3개 보이고, 50 mL는 하나도 없다', () => {
    expect(undissolvedCount(at({ ...base, waterMl: 20 }, 3).dissolvedG)).toBe(3);
    expect(count(macro({ ...base, waterMl: 20 }, at({ ...base, waterMl: 20 }, 3)), 'salt-undissolved-1')).toBe(3);
    expect(count(macro(base, at(base, 3)), 'salt-undissolved-1')).toBe(0);
    expect(count(macro(base, at(base, 3)), 'sand-1')).toBe(10);
  });

  it('물 눈금: 물이 많을수록 비커 물이 높다', () => {
    const h = (v: V) => Number(/height="([\d.]+)" fill="#bfe0f5" fill-opacity="0.85" data-testid="beaker-water"/.exec(macro(v, null, false))![1]);
    expect(h(base)).toBeGreaterThan(h({ ...base, waterMl: 20 }));
  });

  it('따를 때는 모래가 받는 비커로 넘어오고, 거름종이이면 넘어오지 않는다', () => {
    const pour = { ...base, filter: 'pour' };
    expect(count(macro(pour, at(pour, 8)), 'sand-crossed')).toBe(2);
    expect(count(macro(pour, at(pour, 8)), 'pour-beaker')).toBe(1);
    expect(count(macro(pour, at(pour, 8)), 'funnel')).toBe(0);
    expect(count(macro(base, at(base, 8)), 'sand-crossed')).toBe(0);
    expect(count(macro(base, at(base, 8)), 'funnel')).toBe(1);
    expect(count(macro(pour, at(pour, 20)), 'dish-sand')).toBe(3);
    expect(count(macro(base, at(base, 20)), 'dish-sand')).toBe(0);
  });

  it('증발: 가열 중에 불꽃이 있고 물이 줄며 소금 가루가 쌓인다', () => {
    expect(count(macro(base, at(base, 10)), 'flame')).toBe(1);
    expect(count(macro(base, at(base, 5)), 'flame')).toBe(0);
    expect(count(macro(base, at(base, 20)), 'flame')).toBe(0);
    expect(count(macro(base, at(base, 20)), 'dish-water')).toBe(0);
    expect(count(macro(base, at(base, 20)), 'dish-salt')).toBe(20);
    expect(count(macro(base, at(base, 8)), 'dish-water')).toBe(1);
  });

  it('startSample은 t = 0', () => {
    expect(startSample(base, experiment).t).toBe(0);
  });
});

describe('알갱이 보기', () => {
  it('네 라벨이 한 번씩 있다', () => {
    for (const ran of [false, true]) {
      const html = micro(base, ran ? at(base, 20) : null, ran);
      for (const label of ['녹은 소금', '녹지 않은 소금', '모래', '거름종이']) {
        expect(html.match(new RegExp(`>${label}</text>`, 'g')), label).toHaveLength(1);
      }
    }
  });

  it('따르기 시행이면 아래 그림은 거름종이 대신 윗물을 따르는 그림이고 거름종이 라벨·설명이 없다', () => {
    const pour = { ...base, filter: 'pour' };
    const html = micro(pour, at(pour, 20));
    expect(count(html, 'pour-diagram')).toBe(1);
    expect(count(html, 'paper')).toBe(0);
    expect(count(html, 'blocked-sand')).toBe(0);
    expect(count(html, 'poured-dot')).toBe(3);
    expect(count(html, 'poured-sand')).toBe(2);
    expect(html).not.toContain('거름종이');
    expect(html).toContain('윗물을 따르면 가라앉지 않은 모래 알갱이도 함께 넘어갈 수 있어요.');
    expect(html).not.toContain('거름종이 구멍을 지나가요');
    for (const label of ['녹은 소금', '녹지 않은 소금', '모래', '윗물만 따르기']) {
      expect(html.match(new RegExp(`>${label}</text>`, 'g')), label).toHaveLength(1);
    }
  });

  it('거름종이 시행이면 거름종이 그림과 라벨을 유지하고, 따르기 그림은 없다', () => {
    const html = micro(base, at(base, 20));
    expect(count(html, 'pour-diagram')).toBe(0);
    expect(count(html, 'paper')).toBe(1);
    expect(html).not.toContain('윗물만 따르기');
    expect(html).toContain('거름종이 구멍을 지나가요');
  });

  it('실행 전에는 따르기로 골라도 중립 그림(거름종이 구멍만, 알갱이 없음)이다', () => {
    const html = micro({ ...base, filter: 'pour' }, null, false);
    expect(count(html, 'pour-diagram')).toBe(0);
    expect(count(html, 'paper')).toBe(1);
    expect(count(html, 'poured-sand')).toBe(0);
  });

  it('실행 전에는 거름종이 구멍 그림에 알갱이를 그리지 않고 설명 문장도 쓰지 않는다', () => {
    const html = micro(base, null, false);
    expect(count(html, 'paper-particles')).toBe(0);
    expect(html).not.toContain('거름종이 구멍을 지나가요');
    expect(count(html, 'dissolved-dot')).toBe(0);
    expect(count(html, 'lump')).toBe(7);
    expect(count(html, 'sand-piece')).toBe(4);
  });

  it('실행 뒤에는 모래가 걸리고 녹은 소금이 지나가며 설명 문장이 보인다', () => {
    const html = micro(base, at(base, 20));
    expect(html).toContain('녹은 소금 알갱이는 아주 작아서 거름종이 구멍을 지나가요.');
    expect(count(html, 'blocked-sand')).toBe(3);
    expect(count(html, 'passing-dot')).toBe(3);
  });

  it('녹은 소금 알갱이 수와 녹지 않은 덩어리 수는 녹은 양에 따른다 (50 mL 20개·0개, 20 mL 14개·2개)', () => {
    expect(count(micro(base, at(base, 20)), 'dissolved-dot')).toBe(dissolvedDotCount(10));
    expect(dissolvedDotCount(10)).toBe(20);
    expect(lumpCount(10)).toBe(0);
    const v20 = { ...base, waterMl: 20 };
    expect(count(micro(v20, at(v20, 20)), 'dissolved-dot')).toBe(14);
    expect(count(micro(v20, at(v20, 20)), 'lump')).toBe(2);
  });

  it('움직이지 않는 상태(플레이헤드가 끝)에서는 data-running이 false이고 위치가 고정이다', () => {
    const a = micro(base, at(base, 20), true, 20);
    expect(a).toContain('data-running="false"');
    expect(a).toBe(micro(base, at(base, 20), true, 20));
  });
});
