import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { ST_BLOCKS, ST_CLOCKS, ST_MEDIUMS, simulateSoundTransmit, type SoundTransmitSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { soundTransmitModule } from './index';
import { BLOCK_TEXT, CLOCK_TEXT, MEDIUM_TEXT, soundNote, startSample } from './initial';
import { DIAL, SoundMacroView, needleEnd } from './SoundMacroView';
import { SoundBarsView } from './SoundBarsView';

const unit = UNITS.find((u) => u.id === 'g3-sound')!;
if (!unit.ok) throw new Error('g3-sound가 없어요');
const activity = unit.activities[2]!;
if (activity.activity !== 'variable') throw new Error('g3-sound 활동 3이 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { medium: string; block: string; clockColor: string };
const base: V = { medium: 'air', block: 'none', clockColor: 'red' };
const CONDITIONS: V[] = ST_MEDIUMS.flatMap((medium) => ST_BLOCKS.flatMap((block) => ST_CLOCKS.map((clockColor) => ({ medium, block, clockColor }))));
const sim = (v: V) => soundTransmitModule.simulate(v, experiment) as ReturnType<typeof simulateSoundTransmit>;
const at = (v: V, t: number): SoundTransmitSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
let seq = 0;
const trialOf = (v: V) => ({ id: `t${++seq}`, index: seq, samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: SoundTransmitSample | null, ran = true) => renderToStaticMarkup(createElement(SoundMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const bars = (trials: V[], snapshot: SoundTransmitSample | null) => {
  const list = trials.map(trialOf) as { id: string }[];
  return renderToStaticMarkup(createElement(SoundBarsView, { experiment, trial: list.at(-1) as never, snapshot, values: trials.at(-1) ?? base, playhead: 0, trials: list as never }));
};
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const TIMES = [0, 0.5, 1, 1.5, 2];

describe('레지스트리', () => {
  it('g3-sound 활동 3은 sound-transmit 모듈로 로드되고 앞의 두 활동은 그대로다', () => {
    expect(unit.manifest.standards).toEqual(['4과07-01', '4과07-02', '4과07-03']);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'string-sound', 'string-sound'], ['variable', 'sound-vibration', 'sound-vibration'], ['variable', 'sound-transmit', 'sound-transmit']]);
    expect(unit.module.kind).toBe('string-sound');
    expect(activity.module).toBe(soundTransmitModule);
    expect(MODULES['sound-transmit'].kind).toBe('sound-transmit');
    expect(experiment.safety).toEqual([]);
    expect(soundTransmitModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['소리가 전달되는 물질과 소음 줄이기', '소리는 무엇을 통해 전달되고, 어떻게 하면 소리를 줄일 수 있을까?', '예측: 소음계 눈금은?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['medium', '소리를 전하는 것', 'air'], ['block', '소리 나는 물체를 감싼 것', 'none'], ['clockColor', '알람 시계 색깔', 'red']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['air', '공기'], ['water', '물'], ['wood', '책상 나무'], ['string', '실 전화기의 실']],
      [['none', '없음'], ['box', '종이 상자'], ['sponge', '스펀지'], ['cotton', '솜']],
      [['red', '빨간색'], ['blue', '파란색']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['level', '소음계 눈금', '눈금'], ['heard', '귀에 들리나요', '']]);
    expect(ST_MEDIUMS.map((m) => MEDIUM_TEXT[m])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(ST_BLOCKS.map((m) => BLOCK_TEXT[m])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(ST_CLOCKS.map((m) => CLOCK_TEXT[m])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 소음계 눈금(정수)과 귀에 들리나요(범주), 시계 색깔 무영향', () => {
    const cols = soundTransmitModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['소음계 눈금', '귀에 들리나요']);
    const row = (medium: string, block: string, clockColor = 'red') => cols.map((c) => c.value(sim({ medium, block, clockColor }).result));
    for (const clock of ['red', 'blue']) {
      expect(row('air', 'none', clock)).toEqual(['5', '잘 들림']);
      expect(row('water', 'none', clock)).toEqual(['7', '잘 들림']);
      expect(row('wood', 'none', clock)).toEqual(['8', '잘 들림']);
      expect(row('string', 'none', clock)).toEqual(['7', '잘 들림']);
      expect(row('air', 'cotton', clock)).toEqual(['2', '거의 들리지 않음']);
      expect(row('wood', 'box', clock)).toEqual(['7', '잘 들림']);
      expect(row('air', 'sponge', clock)).toEqual(['3', '작게 들림']);
    }
  });

  it('센서: 가상 소음계(sound, 눈금) 하나, 실험 전에는 0이다', () => {
    const specs = soundTransmitModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 소음계', 'sound', '눈금']]);
    expect(specs[0]!.source).toBe(0);
    const v = { ...base, medium: 'wood' };
    expect(soundTransmitModule.sensors(at(v, 2), v)[0]!.source).toBeCloseTo(8, 9);
  });

  it('그래프 설정: y 0~10 눈금 고정, x 0~2초, 선 하나, 재생이 끝나면 끝에 둔다', () => {
    const g = soundTransmitModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['소음계 눈금', undefined, [0, 2, 4, 6, 8, 10], '시간(초)', [0, 1, 2], undefined, undefined]);
    expect(soundTransmitModule.restPlayhead).toBeUndefined();
    expect(soundTransmitModule.metric.sampleKey).toBe('level');
    expect(soundTransmitModule.metric.resultKey).toBe('level');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.level))).toBeLessThanOrEqual(10);
      expect(s.at(-1)!.t).toBe(2);
    }
  });

  it('예측 비교는 소음계 눈금: 물·나무·실은 공기보다 늘어남, 감싸면 줄어듦, 시계 색깔은 변하지 않음 (기준 0.5눈금)', () => {
    const m = soundTransmitModule.metric;
    const level = (v: V) => sim(v).result[m.resultKey as 'level'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    for (const medium of ['water', 'wood', 'string']) expect(observedOutcome(level(base), level({ ...base, medium }), th)).toBe('increase');
    for (const block of ['box', 'sponge', 'cotton']) expect(observedOutcome(level(base), level({ ...base, block }), th)).toBe('decrease');
    expect(observedOutcome(level({ ...base, block: 'box' }), level({ ...base, block: 'sponge' }), th)).toBe('decrease');
    for (const v of CONDITIONS) expect(observedOutcome(level(v), level({ ...v, clockColor: v.clockColor === 'red' ? 'blue' : 'red' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, medium: 'wood' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: soundTransmitModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 2, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('소음계 눈금');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '2', '4', '6', '8', '10']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('바늘 끝: 눈금 0은 왼쪽 끝, 5는 위, 10은 오른쪽 끝', () => {
    const r = DIAL.r - 4;
    expect(needleEnd(0).x).toBeCloseTo(DIAL.cx - r, 9);
    expect(needleEnd(0).y).toBeCloseTo(DIAL.cy, 9);
    expect(needleEnd(5).x).toBeCloseTo(DIAL.cx, 9);
    expect(needleEnd(5).y).toBeCloseTo(DIAL.cy - r, 9);
    expect(needleEnd(10).x).toBeCloseTo(DIAL.cx + r, 9);
    expect(needleEnd(99).x).toBeCloseTo(needleEnd(10).x, 9);
  });

  it('실행 전에는 바늘이 0에 있고 결과 글자가 없다 — 모든 조건', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(html).toContain('data-testid="meter-needle" data-level="0.00"');
      expect(html).toContain('실험하면 소음계 바늘이 움직여요.');
      expect(shownText(html).some((t) => t.includes('귀에 들'))).toBe(false);
    }
  });

  it('실행하면 소음계 바늘이 움직인다: 시각이 지날수록 눈금이 늘고 결과에서 멈춘다', () => {
    const v = { ...base, medium: 'wood' };
    const levels = TIMES.map((t) => Number(/data-testid="meter-needle" data-level="([\d.]+)"/.exec(macro(v, at(v, t)))![1]));
    expect(levels[0]).toBe(0);
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    expect(levels.at(-1)).toBe(8);
  });

  it('전하는 것·감싼 것·시계 색깔이 그림에 나타난다 (공기는 빈 공간, 물은 수조, 책상은 나무판, 실은 종이컵 둘)', () => {
    for (const m of ST_MEDIUMS) expect(macro({ ...base, medium: m }, null, false)).toContain(`data-medium="${m}"`);
    expect(count(macro(base, null, false), 'wrap')).toBe(0);
    for (const b of ['box', 'sponge', 'cotton']) {
      const html = macro({ ...base, block: b }, null, false);
      expect(count(html, 'wrap')).toBe(1);
      expect(html).toContain(`data-block="${b}"`);
    }
    expect(macro({ ...base, clockColor: 'blue' }, null, false)).toContain('data-color="blue"');
    expect((macro({ ...base, medium: 'string' }, null, false).match(/<polygon/g) ?? []).length).toBe(2);
    const html = macro({ medium: 'string', block: 'sponge', clockColor: 'blue' }, null, false);
    expect(html).toContain('전하는 것: 실 전화기의 실');
    expect(html).toContain('감싼 것: 스펀지');
    expect(html).toContain('알람 시계: 파란색');
  });

  it('소리 물결 그림을 그리지 않는다 — 모든 조건, 모든 시각', () => {
    for (const v of CONDITIONS) {
      for (const t of TIMES) {
        const html = macro(v, at(v, t));
        expect(html).not.toMatch(/wave|물결|<polyline|marker-end|<marker/i);
        expect(html).not.toContain(' q'); // 물결 곡선 경로(q 명령) 없음
      }
    }
  });

  it('문구와 가드', () => {
    const v = { ...base, medium: 'wood' };
    expect(soundNote(at(v, 2), sim(v).result)).toBe('2.0초 · 소음계 8.0눈금 · 귀에 잘 들림');
    expect(macro(v, at(v, 2))).toContain('2.0초 · 소음계 8.0눈금 · 귀에 잘 들림');
    for (const c of CONDITIONS) {
      const html = macro(c, at(c, 2));
      for (const m of html.matchAll(/fontSize="(\d+)"|font-size="(\d+)"/g)) expect(Number(m[1] ?? m[2])).toBeGreaterThanOrEqual(14);
      for (const t of shownText(html)) expect(guardOutput(t, { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits }).ok, t).toBe(true);
    }
  });

  it('대조 변인: 시계 색깔만 다르면 그림이 시계 색 외에는 같다', () => {
    for (const v of CONDITIONS) {
      const other = { ...v, clockColor: v.clockColor === 'red' ? 'blue' : 'red' };
      const strip = (html: string) => html.replace(/data-clock="\w+"/, '').replace(/data-color="\w+"/, '').replace(/fill="#(ef4444|3b82f6)"/, '').replace(/aria-label="[^"]*"/g, '').replace(/(빨간|파란)색/g, '');
      expect(strip(macro(v, at(v, 2)))).toBe(strip(macro(other, at(other, 2))));
    }
  });

  it('시작 샘플은 0이다', () => {
    for (const v of CONDITIONS) expect(startSample(v)).toEqual({ t: 0, level: 0 });
  });
});

describe('시행별 막대 그래프', () => {
  it('시행이 없으면 안내 글자, 시행마다 막대가 생기고 값이 결과의 소음계 눈금이다', () => {
    const empty = renderToStaticMarkup(createElement(SoundBarsView, { experiment, trial: undefined, snapshot: null, values: base, playhead: 0, trials: [] }));
    expect(count(empty, 'sound-bar')).toBe(0);
    expect(empty).toContain('실험하면 시행마다 막대가 생겨요.');
    const trials = [base, { ...base, medium: 'wood' }, { ...base, block: 'cotton' }];
    const html = bars(trials, at(trials[2]!, 2));
    expect([...html.matchAll(/data-testid="sound-bar" data-trial="\d+" data-value="(\d+)"/g)].map((m) => Number(m[1]))).toEqual([5, 8, 2]);
    expect(html).toContain('시행 번호');
    expect(html).toContain('소음계 눈금');
  });
});
