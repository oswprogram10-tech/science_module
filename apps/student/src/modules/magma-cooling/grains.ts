/** 알갱이 모자이크: 시드 고정 점들로 만든 보로노이 모양(0~1 정사각형 안). 난수는 시드 고정이라 같은 개수면 항상 같은 그림이다. */

export type Pt = [number, number];
export interface GrainCell {
  /** 다각형 꼭짓점 (0~1 좌표) */
  poly: Pt[];
}

/** 확대 창 한 변이 나타내는 길이(mm). 배율은 고정이다. */
export const WINDOW_MM = 6;
export const GRAIN_MAX = 450;

/** 평균 크기(mm)에 따른 알갱이 수 = round((6 / 크기)²), 1~450개. 알갱이 하나의 넓이(= 창 넓이 / 개수)의 제곱근이 크기와 같다. */
export function grainCount(sizeMm: number): number {
  return Math.min(GRAIN_MAX, Math.max(1, Math.round((WINDOW_MM / sizeMm) ** 2)));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 점 n개를 고르게 흩뿌린다(best-candidate). 앞에 있는 점일수록 서로 멀리 떨어져 있다. */
export function seedPoints(n: number): Pt[] {
  const rnd = mulberry32(7000 + n);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    let best: Pt = [rnd(), rnd()];
    let bestD = -1;
    for (let k = 0; k < 8; k++) {
      const c: Pt = k === 0 ? best : [rnd(), rnd()];
      let d = Infinity;
      for (const p of pts) d = Math.min(d, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2);
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    pts.push(best);
  }
  return pts;
}

/** 다각형을 반평면 (p − m)·d ≤ 0 으로 자른다. */
function clip(poly: Pt[], m: Pt, d: Pt): Pt[] {
  const side = (p: Pt) => (p[0] - m[0]) * d[0] + (p[1] - m[1]) * d[1];
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const k = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}

const cache = new Map<number, GrainCell[]>();

/** 알갱이 n개의 모자이크. 같은 n이면 같은 결과(캐시). */
export function mosaic(n: number): GrainCell[] {
  const hit = cache.get(n);
  if (hit) return hit;
  const pts = seedPoints(n);
  const cells = pts.map((p, i) => {
    let poly: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let j = 0; j < pts.length && poly.length > 0; j++) {
      if (j === i) continue;
      const q = pts[j]!;
      poly = clip(poly, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], [q[0] - p[0], q[1] - p[1]]);
    }
    return { poly };
  });
  cache.set(n, cells);
  return cells;
}

/** 다각형을 SVG points 문자열로(원점 ox, oy, 한 변 size px). */
export const polyPoints = (poly: Pt[], ox: number, oy: number, size: number) =>
  poly.map(([x, y]) => `${(ox + x * size).toFixed(1)},${(oy + y * size).toFixed(1)}`).join(' ');

/** 굳은 알갱이 색: 알갱이마다 조금씩 다른 톤. */
export const SOLID_TONES = {
  white: ['#f4f1e8', '#e9e4d4', '#fbf9f2', '#ddd6c0', '#efe9da'],
  black: ['#1f2937', '#2b3441', '#374151', '#252d3a', '#303a48'],
} as const;
/** 아직 녹아 있는 칸의 색(반투명 느낌의 옅은 색) */
export const LIQUID_FILL = { white: '#fff3c4', black: '#6b7280' } as const;

export const toneOf = (i: number, color: 'white' | 'black') => SOLID_TONES[color][(i * 7 + 3) % SOLID_TONES[color].length]!;

/** 비교 카드의 암석 무늬(단순화한 그림). */
export const ROCK_TONES = {
  basalt: ['#3f3f46', '#52525b', '#2f2f35', '#46464e'],
  between: ['#8b7e74', '#b8aea4', '#5f5750', '#d6cdc2', '#a89a8c'],
  granite: ['#f1ddd0', '#e7b9a6', '#fbf7f0', '#2b2b30', '#b9b5ad'],
} as const;
export const ROCK_GRAINS = { basalt: 120, between: 30, granite: 8 } as const;
