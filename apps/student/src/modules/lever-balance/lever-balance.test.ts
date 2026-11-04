import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateLever, type LeverSample } from '@sci/engine-physics';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { leverBalanceModule } from './index';
import { sideOfAngle } from './initial';
import { LeverMacroView, barPoint, leverNote } from './LeverMacroView';
import { LeverTurnView, TURN_UNIT, compareText } from './LeverTurnView';

const unit = UNITS.find((u) => u.id === 'g3-force')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g3-force가 없어요');
const experiment = unit.experiment;
const base = { count: 2, distance: 4, shape: 'cylinder' };
const sim = (v: typeof base) => simulateLever(v as never);
const last = (v: typeof base): LeverSample => sim(v).samples.at(-1)!;

const macro = (values: typeof base, snapshot: LeverSample | null) =>
  renderToStaticMarkup(createElement(LeverMacroView, { experiment, trial: undefined, snapshot, values, playhead: 0 }));
// 실험 뒤: trial이 있으면 두 막대를 보여 준다. 화면은 trial의 내용을 읽지 않으므로 빈 객체로 대신한다.
const turn = (values: typeof base, snapshot: LeverSample | null, ran = true) =>
  renderToStaticMarkup(createElement(LeverTurnView, { experiment, trial: ran ? ({} as never) : undefined, snapshot, values, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;

describe('레지스트리', () => {
  it('g3-force는 lever-balance 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(3);
    expect(unit.module).toBe(leverBalanceModule);
    expect(MODULES['lever-balance'].kind).toBe('lever-balance');
    expect(experiment.safety).toEqual([]);
    expect(experiment.safetyChecklist).toBeUndefined();
  });
});

describe('결과 열·센서·그래프', () => {
  it('결과 열: 사양 기준값 아홉 줄', () => {
    const cols = leverBalanceModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['기울어진 쪽', '오른쪽 끝의 높이(cm)']);
    const row = (count: number, distance: number) => cols.map((c) => c.value(sim({ ...base, count, distance }).result));
    expect(row(1, 2)).toEqual(['왼쪽이 내려감', '20']);
    expect(row(1, 4)).toEqual(['왼쪽이 내려감', '20']);
    expect(row(1, 8)).toEqual(['수평', '10']);
    expect(row(2, 2)).toEqual(['왼쪽이 내려감', '20']);
    expect(row(2, 4)).toEqual(['수평', '10']);
    expect(row(2, 8)).toEqual(['오른쪽이 내려감', '0']);
    expect(row(4, 2)).toEqual(['수평', '10']);
    expect(row(4, 4)).toEqual(['오른쪽이 내려감', '0']);
    expect(row(4, 8)).toEqual(['오른쪽이 내려감', '0']);
  });

  it('센서: 가상 기울기 센서는 tilt 종류로 막대의 기울기(부호 포함)를 읽는다', () => {
    const [none] = leverBalanceModule.sensors(null, base);
    expect([none!.kind, none!.unit, none!.label, none!.source]).toEqual(['tilt', '°', '가상 기울기 센서', 0]);
    const [right] = leverBalanceModule.sensors(last({ ...base, distance: 8 }), base);
    expect(right!.source).toBeCloseTo(12.84, 1);
    const [left] = leverBalanceModule.sensors(last({ ...base, count: 1 }), base);
    expect(left!.source).toBeCloseTo(-12.84, 1);
  });

  it('그래프 설정과 예측 비교 기준', () => {
    const g = leverBalanceModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks]).toEqual(['오른쪽 끝 높이(cm)', 0, [0, 5, 10, 15, 20], '시간(초, 느린 화면)', [0, 0.2, 0.4, 0.6, 0.8, 1]]);
    expect(g.xTickFormat!(0.2)).toBe('0.2');
    expect(g.xTickFormat!(1)).toBe('1.0');
    expect(g.markers).toBeUndefined();
    expect(leverBalanceModule.restPlayhead).toBe(1);
    expect(leverBalanceModule.metric).toMatchObject({ sampleKey: 'rightHeightCm', resultKey: 'rightHeightCm' });
    expect(leverBalanceModule.metric.sameThreshold(experiment)).toBe(1);
  });
});

describe('눈으로 보기', () => {
  it('아래 문구: 수평·오른쪽·왼쪽과 높이', () => {
    expect(macro(base, null)).toContain('기울어진 쪽: 수평이에요 · 오른쪽 끝 높이 10 cm');
    expect(macro({ ...base, distance: 8 }, last({ ...base, distance: 8 }))).toContain('기울어진 쪽: 오른쪽이 내려갔어요 · 오른쪽 끝 높이 0 cm');
    expect(macro({ ...base, count: 1 }, last({ ...base, count: 1 }))).toContain('기울어진 쪽: 왼쪽이 내려갔어요 · 오른쪽 끝 높이 20 cm');
    expect(leverNote({ t: 0, angleDeg: 0, rightHeightCm: 10, leftTurn: 8, rightTurn: 8 })).toBe('기울어진 쪽: 수평이에요 · 오른쪽 끝 높이 10 cm');
    expect([sideOfAngle(0.01), sideOfAngle(3), sideOfAngle(-3)]).toEqual(['level', 'right', 'left']);
  });

  it('상단 문구, 눈금 1~8칸 양쪽, 탁자선, 멈춤 받침 둘, 받침점', () => {
    const html = macro(base, null);
    expect(html).toContain('느린 화면');
    expect(count(html, 'tick')).toBe(16);
    const nums = [...html.matchAll(/data-testid="tick"[^>]*>(\d)</g)].map((m) => Number(m[1]));
    expect(nums.sort()).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]);
    expect(count(html, 'floor')).toBe(1);
    expect(count(html, 'stopper')).toBe(2);
    expect(count(html, 'pivot')).toBe(1);
  });

  it('추: 왼쪽 2개(4칸 고정), 오른쪽은 고른 수, 모양에 따라 그림이 다르다', () => {
    const html = macro(base, null);
    expect(count(html, 'weight')).toBe(4);
    expect(macro({ ...base, count: 4 }, null).match(/data-testid="weight"/g)).toHaveLength(6);
    expect(macro({ ...base, count: 1 }, null).match(/data-testid="weight"/g)).toHaveLength(3);
    expect(html).toContain('data-shape="cylinder"');
    expect(html).not.toContain('data-shape="cube"');
    const cube = macro({ ...base, shape: 'cube' }, null);
    expect(cube).toContain('data-shape="cube"');
    expect(cube).not.toContain('data-shape="cylinder"');
    expect(html).toContain('추: 원기둥');
    expect(cube).toContain('추: 정육면체');
  });

  it('막대를 angleDeg만큼 돌리고, 오른쪽 추의 자리는 받침점에서 distance칸이다', () => {
    const s = last({ ...base, distance: 8 });
    const html = macro({ ...base, distance: 8 }, s);
    expect(html).toMatch(/data-testid="bar" data-angle="12\.84" transform="rotate\(12\.8\d* 120 84\)"/);
    const [x, y] = barPoint(8, s.angleDeg);
    expect(x).toBeCloseTo(120 + 96 * Math.cos((12.84 * Math.PI) / 180), 1);
    expect(y).toBeGreaterThan(84);
    expect(barPoint(-8, s.angleDeg)[1]).toBeLessThan(84);
  });

  it('추는 막대가 기울어도 연직으로 내려간다 (실의 x가 위아래에서 같다)', () => {
    for (const v of [{ ...base, distance: 8 }, { ...base, count: 1 }, base]) {
      const html = macro(v, last(v));
      const groups = html.match(/<g data-testid="hanger".*?<\/g><\/g>|<g data-testid="hanger".*?(?=<g data-testid="hanger"|<text)/g) ?? [];
      expect(groups).toHaveLength(2);
      for (const g of groups) {
        const [, x1, x2] = /<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/.exec(g)!;
        expect(x1).toBe(x2);
        // 추의 가운데도 같은 x
        for (const w of g.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="12" height="11"/g)) expect(Number(w[1]) + 6).toBeCloseTo(Number(x1), 0);
      }
    }
  });

  it('추는 항상 탁자선 위에 있고 멈춤 받침 윗면은 막대 끝이 멈추는 높이다', () => {
    for (const v of [{ ...base, count: 4, distance: 8 }, { ...base, count: 1 }, base]) {
      const html = macro(v, last(v));
      const table = Number(/data-testid="floor" x1="4" y1="([\d.]+)"/.exec(html)![1]);
      const stop = Number(/data-testid="stopper"[^>]* y="([\d.]+)"/.exec(html)![1]);
      for (const m of html.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="12" height="11"/g)) expect(Number(m[1]) + 11).toBeLessThan(table - 4);
      expect(stop).toBeCloseTo(84 + 24, 6);
      expect(table).toBeGreaterThan(stop);
    }
  });

  it('끝이 멈춤 받침에 닿으면 닿음 표시가 나타나고, 기울지 않았거나 닿기 전에는 없다', () => {
    expect(count(macro(base, null), 'touch-mark')).toBe(0);
    expect(count(macro(base, last(base)), 'touch-mark')).toBe(0);
    expect(count(macro({ ...base, distance: 8 }, last({ ...base, distance: 8 })), 'touch-mark')).toBe(1);
    expect(count(macro({ ...base, count: 1 }, last({ ...base, count: 1 })), 'touch-mark')).toBe(1);
    const mid = sim({ ...base, distance: 8 }).samples[10]!;
    expect(count(macro({ ...base, distance: 8 }, mid), 'touch-mark')).toBe(0);
  });
});

describe('돌리려는 정도 보기', () => {
  it('실험 전에는 두 막대를 보여 주지 않고 화살표만 그린다', () => {
    const html = turn(base, null, false);
    expect(count(html, 'turn-left')).toBe(0);
    expect(count(html, 'turn-right')).toBe(0);
    expect(count(html, 'arrow')).toBe(4);
  });

  it('추 하나당 화살표 하나(같은 길이), 왼쪽은 2개', () => {
    expect(count(turn(base, last(base)), 'arrow')).toBe(4);
    expect(count(turn({ ...base, count: 4 }, last({ ...base, count: 4 })), 'arrow')).toBe(6);
    const html = turn({ ...base, count: 4 }, null);
    const lens = new Set([...html.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="\1" y2="([\d.]+)"/g)].map((m) => Number(m[3]) - Number(m[2])));
    expect(lens.size).toBe(1);
  });

  it('막대 길이는 leftTurn·rightTurn에 비례한다', () => {
    const v = { ...base, count: 4, distance: 4 };
    const html = turn(v, last(v));
    const w = (id: string) => Number(new RegExp(`data-testid="${id}"[^>]* width="([\\d.]+)"`).exec(html)![1]);
    expect(w('turn-left')).toBeCloseTo(8 * TURN_UNIT, 6);
    expect(w('turn-right')).toBeCloseTo(16 * TURN_UNIT, 6);
    // 가장 긴 막대(6개 × 8칸)도 그림 폭 240 안에 들어간다.
    expect(54 + 48 * TURN_UNIT).toBeLessThan(240);
  });

  it('같으면 "두 쪽이 같아요", 다르면 "한쪽이 더 커요" (어느 쪽인지는 말하지 않는다)', () => {
    expect(turn(base, last(base))).toContain('두 쪽이 같아요');
    expect(turn({ ...base, count: 4 }, last({ ...base, count: 4 }))).toContain('한쪽이 더 커요');
    expect(turn({ ...base, count: 1 }, last({ ...base, count: 1 }))).toContain('한쪽이 더 커요');
    expect(compareText({ leftTurn: 8, rightTurn: 8 })).toBe('두 쪽이 같아요');
    for (const v of [base, { ...base, count: 4 }, { ...base, count: 1 }]) {
      const html = turn(v, last(v));
      expect(html).not.toMatch(/(왼|오른)쪽이 더/);
    }
  });

  it('그림과 글에 숫자가 없고, 곱셈 규칙은 말하지 않는다', () => {
    for (const ran of [false, true]) {
      for (const v of [base, { ...base, count: 4, distance: 8 }, { ...base, count: 1, distance: 2 }]) {
        const html = turn(v, last(v), ran);
        const texts = [...html.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1]).join(' ');
        const label = /aria-label="([^"]*)"/.exec(html.slice(html.indexOf('<svg')))![1]!;
        const note = /<p class="view-note">([^<]*)</.exec(html)![1]!;
        for (const t of [texts, label, note, /<figcaption>([^<]*)</.exec(html)![1]!]) {
          expect(t).not.toMatch(/\d/);
          expect(t).not.toMatch(/곱|×/);
        }
      }
    }
    expect(turn(base, last(base))).toContain('추가 막대를 돌리려는 정도는 추의 무게와 놓은 자리에 따라 달라져요.');
  });
});
