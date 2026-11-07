import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { simulatePhase, type PhaseSample } from '@sci/engine-matter';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { freezeMeltModule } from './index';
import { particleCount, phaseNote, signedMl } from './initial';
import { BATH_TOP, BOT, FreezeMacroView, PX_PER_ML, levelY } from './FreezeMacroView';
import { GAP_ICE, GAP_LIQUID, ParticleView, R, iceCount, iceSlot, layoutParticles, liquidSlot } from './ParticleView';

const unit = UNITS.find((u) => u.id === 'g4-water-state')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g4-water-state가 없어요');
const experiment = unit.experiment;
type V = { process: string; startMl: number; tube: string };
const base: V = { process: 'freeze', startMl: 10, tube: 'glass' };
const sim = (v: V) => simulatePhase(v as never);
const at = (v: V, t: number): PhaseSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const last = (v: V): PhaseSample => sim(v).samples.at(-1)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: PhaseSample | null, ran = true) =>
  renderToStaticMarkup(createElement(FreezeMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const micro = (v: V, snapshot: PhaseSample | null, ran = true, playhead = 0) =>
  renderToStaticMarkup(createElement(ParticleView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const attr = (html: string, id: string, name: string) => new RegExp(`data-testid="${id}"[^>]*data-${name}="([^"]*)"`).exec(html)?.[1];

describe('레지스트리', () => {
  it('g4-water-state는 freeze-melt 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(4);
    expect(unit.module).toBe(freezeMeltModule);
    expect(MODULES['freeze-melt'].kind).toBe('freeze-melt');
    expect(experiment.safety).toEqual(['cold']);
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 4줄, 부호 있는 부피 변화와 무게 글자', () => {
    const cols = freezeMeltModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['부피 변화(mL)', '나중 부피(mL)', '무게(처음 → 나중)']);
    const row = (process: string, startMl: number) => cols.map((c) => c.value(sim({ process, startMl, tube: 'glass' }).result));
    expect(row('freeze', 10)).toEqual(['+0.9', '10.9', '10.0 g → 10.0 g']);
    expect(row('freeze', 20)).toEqual(['+1.8', '21.8', '20.0 g → 20.0 g']);
    expect(row('melt', 10)).toEqual(['−0.9', '10.0', '10.0 g → 10.0 g']);
    expect(row('melt', 20)).toEqual(['−1.8', '20.0', '20.0 g → 20.0 g']);
    expect(signedMl(0)).toBe('0.0');
  });

  it('무게 열은 처음 양에 따라 달라서 시행마다 같지 않을 수 있다(과정·시험관만 바꾸면 같다)', () => {
    const w = freezeMeltModule.resultColumns(experiment)[2]!;
    expect(w.value(sim(base).result)).not.toBe(w.value(sim({ ...base, startMl: 20 }).result));
    expect(w.value(sim(base).result)).toBe(w.value(sim({ ...base, process: 'melt' }).result));
    expect(w.value(sim(base).result)).toBe(w.value(sim({ ...base, tube: 'plastic' }).result));
  });

  it('센서: 가상 온도계(temperature)와 가상 전자저울(scale) 두 개, 저울은 비커 100 g을 빼서 시험관 속 물의 무게를 보여 준다', () => {
    const specs = freezeMeltModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 온도계', 'temperature', '°C'], ['가상 전자저울', 'scale', 'g']]);
    expect(specs[0]!.source).toBe(20);
    expect(specs[1]!.source).toBe(10 - 100);
    expect(freezeMeltModule.sensors(null, { ...base, process: 'melt' })[0]!.source).toBe(-8);
    const s = at(base, 9);
    const [t, m] = freezeMeltModule.sensors(s, base);
    expect(t!.source).toBe(0);
    expect(m!.source + 100).toBe(10);
    expect(new Set(specs.map((x) => x.id)).size).toBe(2);
  });

  it('그래프 설정: y −2~2 고정, x 0~30분, 함수형 표식 두 개(과정·처음 양에 따라 다르다)', () => {
    const g = freezeMeltModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series]).toEqual(['부피 변화(mL)', -2, [-2, -1, 0, 1, 2], '시간(분)', [0, 5, 10, 15, 20, 25, 30], undefined]);
    expect(freezeMeltModule.restPlayhead).toBe(30);
    const markers = g.markers as (e: unknown, t: unknown) => { t: number; label: string }[];
    const m = (v: V) => markers(experiment, trialOf(v)).map((x) => [x.t, x.label]);
    expect(m(base)).toEqual([[4, '얼기 시작'], [14, '다 얼었어요']]);
    expect(m({ ...base, startMl: 20 })).toEqual([[6, '얼기 시작'], [26, '다 얼었어요']]);
    expect(m({ ...base, process: 'melt' })).toEqual([[4, '녹기 시작'], [14, '다 녹았어요']]);
    expect(m({ ...base, process: 'melt', startMl: 20, tube: 'plastic' })).toEqual([[6, '녹기 시작'], [26, '다 녹았어요']]);
  });

  it('그래프 그림: 음수 눈금(−2·−1)과 0선이 있고 라벨이 겹치지 않는다', () => {
    const html = (v: V) =>
      renderToStaticMarkup(createElement(GraphView, { module: freezeMeltModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 0, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    for (const v of [base, { ...base, startMl: 20 }, { ...base, process: 'melt' }, { ...base, process: 'melt', startMl: 20 }]) {
      const h = html(v);
      expect([...h.matchAll(/<text x="47" y="[\d.]+" text-anchor="end">([^<]+)</g)].map((m) => m[1])).toEqual(['−2', '−1', '0', '1', '2']);
      expect(h).toContain('zero-line');
      expect(count(h, 'graph-marker')).toBe(2);
      // 두 라벨의 글자 줄(y)이 같으면 가로로 겹치지 않아야 한다(글자 폭은 한글 13, 공백 4 어림)
      const labels = [...h.matchAll(/<text x="([\d.]+)" y="([\d.]+)"( text-anchor="end")? font-size="13" fill="currentColor">([^<]+)<\/text>/g)].map((m) => {
        const w = [...m[4]!].reduce((a, ch) => a + (ch === ' ' ? 4 : 13), 0);
        const x = Number(m[1]);
        return { y: m[2], l: m[3] ? x - w : x, r: m[3] ? x : x + w };
      });
      expect(labels).toHaveLength(2);
      if (labels[0]!.y === labels[1]!.y) expect(labels[0]!.r).toBeLessThanOrEqual(labels[1]!.l);
      // 라벨은 그림 틀 안
      for (const l of labels) {
        expect(l.l).toBeGreaterThanOrEqual(54);
        expect(l.r).toBeLessThanOrEqual(308);
      }
    }
  });

  it('예측 비교는 dV, 기준 0.05: 얼리기→녹이기는 줄었다, 10→20 얼리기는 늘었다, 시험관만 바꾸면 변하지 않았다', () => {
    const m = freezeMeltModule.metric;
    expect([m.sampleKey, m.resultKey, m.sameThreshold(experiment)]).toEqual(['dV', 'dV', 0.05]);
    const f = (v: V) => sim(v).result[m.resultKey] as number;
    expect(observedOutcome(f(base), f({ ...base, process: 'melt' }), 0.05)).toBe('decrease');
    expect(observedOutcome(f(base), f({ ...base, startMl: 20 }), 0.05)).toBe('increase');
    expect(observedOutcome(f(base), f({ ...base, tube: 'plastic' }), 0.05)).toBe('same');
  });

  it('보간: 두 샘플 사이를 선형으로 잇는다', () => {
    const a = at(base, 9);
    const b = at(base, 9.1);
    expect(freezeMeltModule.interpolate(a, b, 0.5).dV).toBeCloseTo((a.dV + b.dV) / 2, 12);
  });
});

describe('눈으로 보기', () => {
  it('아래 문구: "{t}분 · 부피 {volume} mL · 무게 {massG} g · {tempC} °C"', () => {
    expect(phaseNote(at(base, 9))).toBe('9.0분 · 부피 10.4 mL · 무게 10.0 g · 0.0 °C');
    expect(phaseNote(at(base, 0))).toBe('0.0분 · 부피 10.0 mL · 무게 10.0 g · 20.0 °C');
    expect(phaseNote(at({ ...base, process: 'melt' }, 30))).toContain('분 · 부피 10.0 mL · 무게 10.0 g · ');
    expect(macro(base, at(base, 9))).toContain('9.0분 · 부피 10.4 mL · 무게 10.0 g · 0.0 °C');
    expect(phaseNote({ t: 0, volume: 10, massG: 10, tempC: -8 })).toContain('−8.0 °C');
  });

  it('실험 전에는 결과(변한 높이·시간 문구)를 보여 주지 않고, 처음 높이 선과 지금 높이 선이 같은 자리에 있다', () => {
    const html = macro(base, null, false);
    expect(html).not.toMatch(/분 · 부피/);
    expect(attr(html, 'start-band', 'y')).toBe(attr(html, 'now-line', 'y'));
    expect(html).toContain('>10.0 g<');
    expect(html).toContain('data-frozen="0.000"');
    // 녹이기는 시험관 속이 모두 얼음으로 시작한다
    expect(macro({ ...base, process: 'melt' }, null, false)).toContain('data-frozen="1.000"');
  });

  it('얼리기: 지금 높이가 처음 높이보다 위로 올라가고 차이는 dV × 5.5, 녹이기: 아래로 내려간다', () => {
    const f = macro(base, last(base));
    expect(Number(attr(f, 'start-band', 'y')) - Number(attr(f, 'now-line', 'y'))).toBeCloseTo(0.9 * PX_PER_ML, 0);
    const f20 = macro({ ...base, startMl: 20 }, last({ ...base, startMl: 20 }));
    expect(Number(attr(f20, 'start-band', 'y')) - Number(attr(f20, 'now-line', 'y'))).toBeCloseTo(1.8 * PX_PER_ML, 0);
    const mv = { ...base, process: 'melt' };
    const m = macro(mv, last(mv));
    expect(Number(attr(m, 'now-line', 'y')) - Number(attr(m, 'start-band', 'y'))).toBeCloseTo(0.9 * PX_PER_ML, 0);
  });

  it('시험관 속 얼음 높이는 얼린 몫에 따라 아래부터 차오르고, 끝에는 물이 없다(얼리기) 또는 얼음이 없다(녹이기)', () => {
    expect(count(macro(base, at(base, 0)), 'tube-ice')).toBe(0);
    const mid = macro(base, at(base, 9));
    expect(count(mid, 'tube-ice')).toBe(1);
    expect(count(mid, 'tube-water')).toBe(1);
    const end = macro(base, last(base));
    expect(count(end, 'tube-ice')).toBe(1);
    expect(count(end, 'tube-water')).toBe(0);
    const mv = { ...base, process: 'melt' };
    expect(count(macro(mv, last(mv)), 'tube-ice')).toBe(0);
    expect(count(macro(mv, last(mv)), 'tube-water')).toBe(1);
  });

  it('시험관 속 물은 언제나 비커 물 수면 아래에 있고 시험관 바닥 위에 있다', () => {
    for (const startMl of [10, 20]) {
      for (const process of ['freeze', 'melt']) {
        for (const s of sim({ process, startMl, tube: 'glass' }).samples) {
          expect(levelY(s.volume)).toBeGreaterThan(BATH_TOP);
          expect(levelY(s.volume)).toBeLessThan(BOT);
        }
      }
    }
  });

  it('얼리기는 소금 얼음물(얼음 조각), 녹이기는 따뜻한 물이며 이름이 보인다', () => {
    const f = macro(base, last(base));
    expect(f).toContain('data-kind="cold"');
    expect(f).toContain('>소금 얼음물<');
    expect(count(f, 'bath-ice')).toBeGreaterThan(0);
    const m = macro({ ...base, process: 'melt' }, null, false);
    expect(m).toContain('data-kind="warm"');
    expect(m).toContain('>따뜻한 물<');
    expect(count(m, 'bath-ice')).toBe(0);
  });

  it('전자저울 숫자는 처음 양(g)이고 모든 샘플에서 같다', () => {
    for (const v of [base, { ...base, startMl: 20 }, { ...base, process: 'melt' }]) {
      for (const t of [0, 9, 30]) expect(macro(v, at(v, t))).toContain(`>${v.startMl.toFixed(1)} g<`);
    }
  });

  it('시험관 종류는 이름과 모양(data-tube)으로 구분되고, 결과 숫자는 같다', () => {
    expect(macro(base, last(base))).toContain('>유리 시험관<');
    expect(macro({ ...base, tube: 'plastic' }, last(base))).toContain('>플라스틱 시험관<');
    expect(macro({ ...base, tube: 'plastic' }, last(base))).toContain('data-tube="plastic"');
  });
});

describe('알갱이 보기', () => {
  it('알갱이 수는 10 mL는 18개, 20 mL는 24개이고, 시행 중에는 언제나 같다', () => {
    expect([particleCount(10), particleCount(20)]).toEqual([18, 24]);
    for (const v of [base, { ...base, startMl: 20 }, { ...base, process: 'melt' }]) {
      const n = particleCount(v.startMl);
      for (const t of [0, 4, 9, 14, 20, 30]) {
        const html = micro(v, at(v, t));
        expect(html).toContain(`알갱이 수 ${n}개`);
        expect(count(html, 'particle')).toBe(n);
        expect(attr(html, 'particles', 'count')).toBe(String(n));
      }
      expect(micro(v, null, false)).toContain(`알갱이 수 ${n}개`);
    }
  });

  it('라벨과 설명 문구: 실험 뒤에만 설명이 나타난다', () => {
    const before = micro(base, null, false);
    expect(before).toContain('>물(액체)<');
    expect(before).toContain('>얼음(고체)<');
    expect(before).not.toContain('알갱이 수는 같고');
    expect(micro(base, last(base))).toContain('얼음이 될 때 알갱이 수는 같고, 알갱이 사이가 조금 넓어져요.');
  });

  it('얼린 몫만큼 얼음 배치로 섞인다: 얼리기 처음 0개 → 끝 모두, 녹이기 처음 모두 → 끝 0개', () => {
    expect(attr(micro(base, at(base, 0)), 'particles', 'ice')).toBe('0');
    expect(attr(micro(base, at(base, 9)), 'particles', 'ice')).toBe('9');
    expect(attr(micro(base, last(base)), 'particles', 'ice')).toBe('18');
    const mv = { ...base, process: 'melt' };
    expect(attr(micro(mv, null, false), 'particles', 'ice')).toBe('18');
    expect(attr(micro(mv, at(mv, 9)), 'particles', 'ice')).toBe('9');
    expect(attr(micro(mv, last(mv)), 'particles', 'ice')).toBe('0');
    expect(iceCount(0.5, 24)).toBe(12);
  });

  it('얼음은 일정한 육각 무늬(이웃 간격이 모두 같다)이고 액체보다 간격이 조금 넓다, 액체는 불규칙하다', () => {
    for (const n of [18, 24]) {
      const ice = Array.from({ length: n }, (_, i) => iceSlot(i));
      const liq = Array.from({ length: n }, (_, i) => liquidSlot(i));
      const nearest = (pts: { x: number; y: number }[]) => pts.map((p, i) => Math.min(...pts.filter((_, j) => j !== i).map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
      // 얼음: 모든 알갱이의 가장 가까운 이웃 거리가 GAP_ICE
      for (const d of nearest(ice)) expect(d).toBeCloseTo(GAP_ICE, 6);
      // 액체: 거리가 제각각이고 평균은 얼음보다 작다
      const dl = nearest(liq);
      expect(Math.max(...dl) - Math.min(...dl)).toBeGreaterThan(2);
      expect(dl.reduce((a, b) => a + b, 0) / n).toBeLessThan(GAP_ICE);
      expect(GAP_LIQUID).toBeLessThan(GAP_ICE);
      // 어떤 알갱이도 겹치지 않는다
      for (const pts of [ice, liq]) for (const d of nearest(pts)) expect(d).toBeGreaterThan(2 * R);
    }
  });

  it('섞인 배치에서도 알갱이끼리 겹치지 않고 모두 틀 안에 있다', () => {
    for (const n of [18, 24]) {
      for (let k = 0; k <= n; k++) {
        for (const phase of [0, 0.25, 0.6]) {
          const pts = layoutParticles(n, k / n, phase);
          expect(pts).toHaveLength(n);
          pts.forEach((p, i) => {
            expect(p.x).toBeGreaterThan(8 + R);
            expect(p.x).toBeLessThan(232 - R);
            expect(p.y).toBeGreaterThan(34 + R);
            expect(p.y).toBeLessThan(192 - R);
            for (let j = i + 1; j < n; j++) expect(Math.hypot(p.x - pts[j]!.x, p.y - pts[j]!.y), `n=${n} k=${k} ${i}-${j}`).toBeGreaterThan(2 * R);
          });
        }
      }
    }
  });

  it('움직임은 실험 중에만, 얼음은 움직이지 않는다: 렌더링은 위상 0(정지)에서 같은 배치', () => {
    // 정적 렌더링(서버)에서는 재생 중이 아니거나 움직임 줄이기 상태와 같이 멈춘 배치를 그린다
    expect(attr(micro(base, at(base, 9), true, 9), 'particles', 'running')).toBe('true');
    expect(attr(micro(base, last(base), true, 30), 'particles', 'running')).toBe('false');
    expect(attr(micro(base, null, false, 0), 'particles', 'running')).toBe('false');
    const a = micro(base, at(base, 9), true, 30);
    const still = layoutParticles(18, at(base, 9).frozen, 0);
    expect(a).toContain(`cx="${still[0]!.x.toFixed(1)}"`);
    const ice = layoutParticles(18, 0.5, 0.3).filter((p) => p.ice);
    expect(ice.map((p) => [p.x, p.y])).toEqual(layoutParticles(18, 0.5, 0.8).filter((p) => p.ice).map((p) => [p.x, p.y]));
    const liquid = layoutParticles(18, 0.5, 0.3).filter((p) => !p.ice);
    expect(liquid.map((p) => [p.x, p.y])).not.toEqual(layoutParticles(18, 0.5, 0.8).filter((p) => !p.ice).map((p) => [p.x, p.y]));
  });

  it('SVG 글자는 모두 14 이상이다', () => {
    for (const html of [micro(base, last(base)), macro(base, last(base))]) {
      const sizes = [...html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
      expect(sizes.length).toBeGreaterThan(0);
      for (const s of sizes) expect(s).toBeGreaterThanOrEqual(14);
    }
  });
});
