import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/units/g6-acid-base/manifest.json';
import {
  MockSafetyDetector,
  averageRoi,
  deltaE76,
  hexToRgb,
  matchColor,
  rgbToHsv,
  srgbToLab,
  type SafetyEvent,
} from './index';

const colors = manifestJson.experiments[0]!.colors as Record<string, { hex: string }>;
const chart = Object.entries(colors).map(([key, c]) => ({ key, hex: c.hex }));

function image(w: number, h: number, fill: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  return d;
}

describe('색 변환', () => {
  it('sRGB → Lab 기준값', () => {
    const white = srgbToLab(255, 255, 255);
    expect(white.L).toBeCloseTo(100, 1);
    expect(white.a).toBeCloseTo(0, 1);
    expect(white.b).toBeCloseTo(0, 1);
    expect(srgbToLab(0, 0, 0).L).toBeCloseTo(0, 5);
    const red = srgbToLab(255, 0, 0);
    expect(red.L).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 0);
    expect(red.b).toBeCloseTo(67.2, 0);
  });
  it('deltaE76과 HSV', () => {
    const a = srgbToLab(10, 20, 30);
    expect(deltaE76(a, a)).toBe(0);
    expect(deltaE76({ L: 0, a: 0, b: 0 }, { L: 3, a: 4, b: 0 })).toBe(5);
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbToHsv(0, 0, 255).h).toBe(240);
    expect(rgbToHsv(128, 128, 128)).toMatchObject({ s: 0 });
    expect(hexToRgb('#d0605e')).toEqual({ r: 208, g: 96, b: 94 });
  });
});

describe('matchColor', () => {
  it('색표의 hex를 그대로 넣으면 deltaE≈0으로 그 키를 고른다', () => {
    for (const c of chart) {
      const m = matchColor(hexToRgb(c.hex), chart);
      expect(m.best).toBe(c.key);
      expect(m.deltaE).toBeCloseTo(0, 5);
      expect(m.ranked[0]!.key).toBe(c.key);
    }
  });
  it('색표가 지시약 하나의 색이면 확신한다', () => {
    const lit = chart.filter((c) => c.key === 'red' || c.key === 'blue');
    expect(matchColor(hexToRgb('#d0605e'), lit).confident).toBe(true);
  });
  it('회색은 확신하지 못한다', () => {
    expect(matchColor({ r: 128, g: 128, b: 128 }, chart).confident).toBe(false);
  });
  it('가까운 두 색 사이는 확신하지 못한다', () => {
    const near = [
      { key: 'a', hex: '#d0605e' },
      { key: 'b', hex: '#d2625e' },
    ];
    expect(matchColor(hexToRgb('#d1615e'), near).confident).toBe(false);
  });
  it('빈 색표는 오류', () => {
    expect(() => matchColor({ r: 0, g: 0, b: 0 }, [])).toThrow();
  });
});

describe('averageRoi', () => {
  it('가장자리 픽셀은 무시한다', () => {
    const d = image(100, 100, (x, y) => (x >= 35 && x < 65 && y >= 35 && y < 65 ? [200, 50, 50] : [0, 255, 0]));
    expect(averageRoi(d, 100, 100)).toEqual({ r: 200, g: 50, b: 50 });
  });
  it('밝기 상위 5%(반사광)와 하위 5%(그림자)를 제외한다', () => {
    // ROI 30x30 = 900픽셀. 처음 45개는 흰 반사광, 다음 45개는 검은 그림자, 나머지는 같은 색.
    let n = 0;
    const d = image(100, 100, (x, y) => {
      if (!(x >= 35 && x < 65 && y >= 35 && y < 65)) return [0, 0, 0];
      n++;
      if (n <= 45) return [255, 255, 255];
      if (n <= 90) return [0, 0, 0];
      return [100, 120, 140];
    });
    expect(averageRoi(d, 100, 100)).toEqual({ r: 100, g: 120, b: 140 });
  });
  it('ROI를 직접 정할 수 있다', () => {
    const d = image(10, 10, (x) => (x < 5 ? [10, 10, 10] : [250, 250, 250]));
    expect(averageRoi(d, 10, 10, { x: 0, y: 0, w: 0.5, h: 1 }).r).toBe(10);
  });
});

describe('MockSafetyDetector', () => {
  it('start 이후 trigger가 이벤트를 내고 stop 이후에는 내지 않는다', () => {
    const det = new MockSafetyDetector(() => 42);
    const got: SafetyEvent[] = [];
    det.trigger('SPILL');
    expect(got).toHaveLength(0);
    det.start((e) => got.push(e));
    det.trigger('NO_GOGGLES', 0.9);
    expect(got).toEqual([{ type: 'NO_GOGGLES', confidence: 0.9, ts: 42 }]);
    det.stop();
    det.trigger('FOOD');
    expect(got).toHaveLength(1);
  });
});
