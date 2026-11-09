import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateBody, type BodySample } from '@sci/engine-life';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { exerciseBodyModule } from './index';
import { BodyMacroView, sweatCount } from './BodyMacroView';
import { BodyMicroView, DOT_COUNT, beatsPerSec, dotPoint, heartScale, lungScale } from './BodyMicroView';
import { bodyNote, clockText, friendPulse, phaseAt } from './initial';

const unit = UNITS.find((u) => u.id === 'g5-body')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g5-body가 없어요');
const experiment = unit.experiment;
const base = { kind: 'walk', minutes: 1, wrist: 'left' };
const sim = (v: typeof base) => simulateBody(v as never);
const at = (v: typeof base, t: number): BodySample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;

const macro = (values: typeof base, snapshot: BodySample | null) =>
  renderToStaticMarkup(createElement(BodyMacroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const micro = (values: typeof base, snapshot: BodySample | null) =>
  renderToStaticMarkup(createElement(BodyMicroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

describe('레지스트리', () => {
  it('g5-body는 exercise-body 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(5);
    expect(unit.module).toBe(exerciseBodyModule);
    expect(MODULES['exercise-body'].kind).toBe('exercise-body');
    expect(experiment.safety).toEqual(['exercise']);
    expect(experiment.safetyChecklist).toHaveLength(3);
  });
});

describe('결과 열·센서·그래프', () => {
  it('결과 열: 사양 기준값 여섯 줄', () => {
    const cols = exerciseBodyModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['운동 직후 맥박(회/분)', '운동 직후 호흡(회/분)', '돌아오는 데 걸린 시간(분)']);
    const row = (kind: string, minutes: number) => cols.map((c) => c.value(sim({ ...base, kind, minutes }).result));
    expect(row('sit', 1)).toEqual(['85', '20', '0.0']);
    expect(row('sit', 3)).toEqual(['85', '20', '0.0']);
    expect(row('walk', 1)).toEqual(['111', '28', '2.5']);
    expect(row('walk', 3)).toEqual(['115', '29', '2.7']);
    expect(row('run', 1)).toEqual(['158', '42', '4.0']);
    expect(row('run', 3)).toEqual(['170', '45', '4.2']);
  });

  it('센서: 가상 맥박계(pulse)는 지금 시각의 가상 친구 맥박, 시행 전에는 쉴 때 값', () => {
    const [none] = exerciseBodyModule.sensors(null, base);
    expect([none!.kind, none!.unit, none!.label, none!.source]).toEqual(['pulse', '회/분', '가상 맥박계', 85]);
    const [now] = exerciseBodyModule.sensors(at(base, 2), base);
    expect(Math.round(now!.source)).toBe(111);
  });

  it('그래프 설정과 예측 비교 기준', () => {
    const g = exerciseBodyModule.graph;
    expect([g.yLabel, g.yMin, g.xLabel, g.xTicks, g.yTicks]).toEqual(['회/분', 0, '시간(분)', [0, 2, 4, 6, 8, 10], [0, 30, 60, 90, 120, 150, 180]]);
    expect(g.series?.map((s) => [s.key, s.dash])).toEqual([['pulse', undefined], ['breath', '7 4']]);
    expect(exerciseBodyModule.metric).toMatchObject({ sampleKey: 'pulse', resultKey: 'pulseEnd' });
    expect(exerciseBodyModule.metric.sameThreshold(experiment)).toBe(2);
    const markers = g.markers as (e: unknown, t: unknown) => { t: number; label: string }[];
    const trial = (minutes: number) => ({ values: { ...base, minutes } });
    expect(markers(experiment, trial(1))).toEqual([{ t: 1, label: '운동 시작' }, { t: 2, label: '운동 끝' }]);
    expect(markers(experiment, trial(3))).toEqual([{ t: 1, label: '운동 시작' }, { t: 4, label: '운동 끝' }]);
  });

  it('restPlayhead는 함수이고 운동이 끝난 순간을 돌려준다', () => {
    const f = exerciseBodyModule.restPlayhead as (e: unknown, t: unknown) => number;
    expect(f(experiment, { values: { ...base, minutes: 1 } })).toBe(2);
    expect(f(experiment, { values: { ...base, minutes: 3 } })).toBe(4);
  });

  it('가상 친구의 같은 시점 값: 운동 전·직후·3분 뒤', () => {
    expect(friendPulse(base, experiment)).toEqual({ before: 85, after: 111, later: Math.round(at(base, 5).pulse) });
    expect(friendPulse({ ...base, kind: 'run', minutes: 3 }, experiment).after).toBe(170);
    expect(friendPulse({ ...base, kind: 'sit' }, experiment)).toEqual({ before: 85, after: 85, later: 85 });
    // 3분 뒤는 운동이 끝난 3분 뒤라서 쉴 때 값보다 높지만 직후보다 낮다.
    const w = friendPulse(base, experiment);
    expect(w.later!).toBeGreaterThan(85);
    expect(w.later!).toBeLessThan(w.after!);
  });
});

describe('눈으로 보기', () => {
  it('시간 글자: 분:초', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(2)).toBe('2:00');
    expect(clockText(1.5)).toBe('1:30');
    expect(clockText(10)).toBe('10:00');
  });

  it('아래 문구와 단계: 운동이 끝난 2:00에는 맥박 111, 호흡 28', () => {
    expect(bodyNote(at(base, 2))).toBe('2:00 · 맥박 111회/분 · 호흡 28회/분');
    expect(macro(base, at(base, 2))).toContain('2:00 · 맥박 111회/분 · 호흡 28회/분');
    expect(macro(base, null)).toContain('0:00 · 맥박 85회/분 · 호흡 20회/분');
    expect(phaseAt(0.5, base, experiment)).toBe('rest');
    expect(phaseAt(1, base, experiment)).toBe('rest');
    expect(phaseAt(1.5, base, experiment)).toBe('exercise');
    expect(phaseAt(2, base, experiment)).toBe('after');
    expect(phaseAt(7, base, experiment)).toBe('after');
  });

  it('상태 띠: 쉬는 중 / 운동 중 / 운동 후 쉬는 중 (앉아 있기는 늘 쉬는 중)', () => {
    expect(macro(base, at(base, 0.5))).toContain('>쉬는 중<');
    expect(macro(base, at(base, 1.5))).toContain('>운동 중<');
    expect(macro(base, at(base, 3))).toContain('>운동 후 쉬는 중<');
    const sit = { ...base, kind: 'sit' };
    expect(macro(sit, at(sit, 1.5))).toContain('>쉬는 중<');
    expect(macro(sit, at(sit, 3))).toContain('>쉬는 중<');
  });

  it('가상 친구 라벨과 운동 종류에 따른 자세, 땀방울은 운동 중에만', () => {
    for (const kind of ['sit', 'walk', 'run']) {
      const v = { ...base, kind };
      expect(macro(v, null)).toContain('>가상 친구<');
      expect(macro(v, null)).toContain(`data-pose="${kind}"`);
    }
    expect(count(macro(base, at(base, 0.5)), 'sweat')).toBe(0);
    expect(count(macro(base, at(base, 1.5)), 'sweat')).toBe(sweatCount(0.35));
    expect(count(macro(base, at(base, 3)), 'sweat')).toBe(0);
    const run = { ...base, kind: 'run' };
    expect(count(macro(run, at(run, 1.5)), 'sweat')).toBeGreaterThan(count(macro(base, at(base, 1.5)), 'sweat'));
    expect(sweatCount(0)).toBe(0);
    const sit = { ...base, kind: 'sit' };
    expect(count(macro(sit, at(sit, 1.5)), 'sweat')).toBe(0);
  });

  it('맥박을 재는 손목은 표시와 글자로 보이고, 왼손과 오른손은 반대쪽 팔이다', () => {
    const left = macro(base, null);
    const right = macro({ ...base, wrist: 'right' }, null);
    expect(left).toContain('왼손 손목');
    expect(right).toContain('오른손 손목');
    expect(left).toContain('data-wrist="left"');
    expect(right).toContain('data-wrist="right"');
    const cx = (h: string) => Number(/data-testid="pulse-wrist"[^>]*><circle cx="([\d.]+)"/.exec(h)![1]);
    expect(cx(left)).toBeGreaterThan(120);
    expect(cx(right)).toBeLessThan(120);
  });
});

describe('몸속 기관 보기', () => {
  it('라벨 세 개와 설명 문구, 숫자', () => {
    const html = micro(base, at(base, 2));
    for (const label of ['심장', '폐', '혈관']) expect(html).toContain(`>${label}<`);
    expect(html).toContain('심장은 혈액을 온몸으로 보내고, 폐는 숨을 쉬어 공기를 들이마셔요.');
    expect(html).toContain('맥박 111회/분 · 호흡 28회/분');
    expect(count(html, 'blood-dot')).toBe(DOT_COUNT);
  });

  it('움직임이 멈춘 처음 모습(위상 0)은 크기가 1이다. 박동·들숨에서는 커진다', () => {
    expect(heartScale(0)).toBe(1);
    expect(lungScale(0)).toBe(1);
    expect(heartScale(0.25)).toBeGreaterThan(1);
    expect(lungScale(0.5)).toBeGreaterThan(1);
    for (let p = 0; p < 1; p += 0.05) {
      expect(heartScale(p)).toBeGreaterThanOrEqual(1);
      expect(lungScale(p)).toBeGreaterThanOrEqual(1);
    }
  });

  it('혈관 점의 속도는 맥박에 비례한다 (달리기가 앉아 있기보다 빠르다)', () => {
    expect(beatsPerSec(120) / beatsPerSec(60)).toBe(2);
    expect(beatsPerSec(170)).toBeGreaterThan(beatsPerSec(85));
    // 점들은 고리 위에 있다
    const [x0, y0] = dotPoint(0, 0);
    expect(x0).toBeGreaterThan(120);
    expect(y0).toBeCloseTo(178, 6);
  });
});
