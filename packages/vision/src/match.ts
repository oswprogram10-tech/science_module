import { deltaE76, hexToRgb, srgbToLab, type Rgb } from './color';

export interface MatchResult {
  best: string;
  deltaE: number;
  ranked: { key: string; deltaE: number }[];
  confident: boolean;
}

export const CONFIDENT_MAX_DELTA = 20;
export const CONFIDENT_MIN_GAP = 5;

/** 평균색을 색표와 CIELAB 색차(ΔE76)로 비교한다. chart는 1개 이상이어야 한다. */
export function matchColor(rgb: Rgb, chart: { key: string; hex: string }[]): MatchResult {
  if (chart.length === 0) throw new Error('색표가 비어 있습니다.');
  const lab = srgbToLab(rgb.r, rgb.g, rgb.b);
  const ranked = chart
    .map(({ key, hex }) => {
      const c = hexToRgb(hex);
      return { key, deltaE: deltaE76(lab, srgbToLab(c.r, c.g, c.b)) };
    })
    .sort((p, q) => p.deltaE - q.deltaE);
  const best = ranked[0]!;
  const second = ranked[1];
  const gap = second ? second.deltaE - best.deltaE : Infinity;
  return {
    best: best.key,
    deltaE: best.deltaE,
    ranked,
    confident: best.deltaE <= CONFIDENT_MAX_DELTA && gap >= CONFIDENT_MIN_GAP,
  };
}
