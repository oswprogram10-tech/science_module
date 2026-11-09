import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { simulateMagma } from '@sci/engine-earth';
import { UNITS } from '../../units';
import { BAR_PX, MagmaGrainView, filledGrains } from './MagmaGrainView';
import { MagmaMacroView, magmaNote, meltEllipse } from './MagmaMacroView';
import { WINDOW_MM, grainCount, mosaic, seedPoints } from './grains';
import { magmaCoolingModule } from './index';

const unit = UNITS.find((u) => u.id === 'g4-land')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g4-land이 없어요');
const experiment = unit.experiment;
const base = { place: 'room', grams: 5, dish: 'glass', color: 'white' };

describe('알갱이 수', () => {
  it('고정 배율(창 한 변 6 mm): 개수 = round((6 / 크기)²), 1~450개', () => {
    expect(grainCount(0.29)).toBe(428);
    expect(grainCount(0.57)).toBe(111);
    expect(grainCount(0.8)).toBe(56);
    expect(grainCount(2.04)).toBe(9);
    expect(grainCount(4.09)).toBe(2);
    expect(grainCount(0.1)).toBe(450);
    expect(grainCount(100)).toBe(1);
  });

  const TABLE_SIZES = [0.57, 0.8, 2.04, 1.14, 1.61, 4.09, 0.29, 0.4, 1.02, 0.57, 0.8, 2.04];
  // 알갱이의 크기 = 넓이가 같은 정사각형의 한 변 sqrt(넓이). 창 한 변이 6 mm이므로 mm 넓이 = 넓이 × 36.
  const meanSideMm = (n: number) => {
    const cells = mosaic(n);
    const area = (poly: [number, number][]) =>
      Math.abs(poly.reduce((a, p, i) => a + p[0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * p[1], 0)) / 2;
    return cells.reduce((a, c) => a + Math.sqrt(area(c.poly) * WINDOW_MM * WINDOW_MM), 0) / cells.length;
  };

  it('표 12칸의 크기에서 화면 알갱이의 평균 크기(sqrt(넓이), mm)가 sizeMm의 ±25 % 안이다', () => {
    expect(TABLE_SIZES).toHaveLength(12);
    for (const size of TABLE_SIZES) {
      const mean = meanSideMm(grainCount(size));
      expect(Math.abs(mean - size) / size, `${size} mm → ${mean.toFixed(3)} mm`).toBeLessThanOrEqual(0.25);
    }
  });

  it('450개 모자이크도 빨리 만들어지고 두 번째부터는 캐시를 쓴다', () => {
    const t0 = performance.now();
    const cells = mosaic(450);
    const first = performance.now() - t0;
    expect(cells).toHaveLength(450);
    expect(first).toBeLessThan(2000);
    const t1 = performance.now();
    expect(mosaic(450)).toBe(cells);
    expect(performance.now() - t1).toBeLessThan(5);
  });
});

describe('알갱이 모자이크', () => {
  it('같은 개수면 같은 모양이고(시드 고정), 칸 수가 개수와 같다', () => {
    expect(seedPoints(30)).toEqual(seedPoints(30));
    for (const n of [6, 30, 120, 450]) {
      const cells = mosaic(n);
      expect(cells).toHaveLength(n);
      expect(mosaic(n)).toBe(cells);
    }
  });

  it('칸들의 넓이를 모두 더하면 정사각형(1)이다', () => {
    const area = (poly: [number, number][]) =>
      Math.abs(poly.reduce((a, p, i) => a + p[0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * p[1], 0)) / 2;
    for (const n of [6, 30, 120, 450]) {
      const total = mosaic(n).reduce((a, c) => a + area(c.poly), 0);
      expect(total).toBeCloseTo(1, 6);
      for (const c of mosaic(n)) expect(c.poly.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('진행도만큼 칸을 채운다', () => {
    expect(filledGrains(120, 0)).toBe(0);
    expect(filledGrains(120, 0.5)).toBe(60);
    expect(filledGrains(120, 1)).toBe(120);
    expect(filledGrains(6, 2)).toBe(6);
    expect(filledGrains(6, -1)).toBe(0);
  });

  it('축척 막대: 확대 창 한 변이 나타내는 길이로 1 mm의 길이가 정해진다', () => {
    expect(BAR_PX).toBe(200 / WINDOW_MM);
  });
});

describe('녹은 물질 그림', () => {
  it('굳을수록 녹은 부분이 줄고 불투명해진다', () => {
    const a = meltEllipse(0);
    const b = meltEllipse(0.5);
    const c = meltEllipse(1);
    expect(a.rx).toBeGreaterThan(b.rx);
    expect(b.rx).toBeGreaterThan(c.rx);
    expect(c.rx).toBe(0);
    expect(a.liquidOpacity).toBeLessThan(b.liquidOpacity);
    expect(c.liquidOpacity).toBe(1);
  });

  it('아래 문구', () => {
    const { samples, result } = simulateMagma({ place: 'room', grams: 5, dish: 'glass', color: 'white' });
    expect(magmaNote(null, result.solidS, 90)).toBe('실험 전 · 90.0 °C');
    expect(magmaNote(samples[0]!, result.solidS, 90)).toBe('90.0 °C · 굳는 중');
    expect(magmaNote(samples[samples.length - 1]!, result.solidS, 90)).toBe('다 굳었어요 · 22.4초');
  });
});

describe('화면 렌더링', () => {
  const render = (View: typeof MagmaMacroView | typeof MagmaGrainView, values: Record<string, string | number>, atEnd: boolean) => {
    const { samples } = magmaCoolingModule.simulate(values, experiment);
    return renderToStaticMarkup(
      createElement(View, {
        experiment,
        trial: undefined,
        snapshot: atEnd ? samples[samples.length - 1]! : null,
        values,
        playhead: atEnd ? samples[samples.length - 1]!.t : 0,
      }),
    );
  };

  it('다 굳으면 비교 카드가 나오고 크기에 맞는 문구이다', () => {
    const text = (place: string) => render(MagmaGrainView, { ...base, place }, true);
    expect(text('ice')).toContain('현무암처럼 알갱이가 작아요');
    expect(text('room')).toContain('중간 크기예요');
    expect(text('warm')).toContain('화강암처럼 알갱이가 커요');
    expect(render(MagmaGrainView, base, false)).not.toContain('rock-card');
    expect(render(MagmaGrainView, base, true)).toContain('1 mm');
  });

  it('받침: 얼음물·따뜻한 물만 받침이 있다', () => {
    expect(render(MagmaMacroView, { ...base, place: 'ice' }, false)).toContain('support-ice');
    expect(render(MagmaMacroView, { ...base, place: 'warm' }, false)).toContain('support-warm');
    const room = render(MagmaMacroView, base, false);
    expect(room).not.toContain('support-');
    expect(room).toContain('실온');
  });

  it('접시 글자 라벨', () => {
    expect(render(MagmaMacroView, base, false)).toContain('유리 접시');
    expect(render(MagmaMacroView, { ...base, dish: 'aluminum' }, false)).toContain('알루미늄 접시');
  });

  it('화면 글자에 limits 용어가 없다', () => {
    for (const values of [base, { ...base, place: 'ice', dish: 'aluminum', color: 'black' }]) {
      for (const View of [MagmaMacroView, MagmaGrainView]) {
        const html = render(View, values, true).replace(/<[^>]+>/g, ' ');
        for (const term of experiment.limits) expect(html).not.toContain(term);
      }
    }
  });
});
