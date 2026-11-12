import { LS_CELL_DEG, LS_LAT_CELLS, LS_LON_CELLS, LS_MASK_ROWS, isLandCell } from '@sci/engine-earth';

// ---- 지구본(정사도법으로 본 한 반구) ----
/** 지구본 그림: 중심과 반지름, 바라보는 위도·경도(아시아와 인도양, 오스트레일리아가 보이는 쪽) */
export const GLOBE = { cx: 120, cy: 104, r: 70, lat0: 20, lon0: 100 };
const RAD = Math.PI / 180;

export interface GlobePoint {
  x: number;
  y: number;
  /** 보는 쪽 면 위인가(뒷면이면 false) */
  visible: boolean;
  /** 보는 방향과의 cos(가장자리에 가까울수록 작다) */
  facing: number;
}

/** 위도·경도(°) → 지구본 위의 그림 좌표 */
export function projectGlobe(lat: number, lon: number): GlobePoint {
  const phi = lat * RAD;
  const phi0 = GLOBE.lat0 * RAD;
  const lam = (lon - GLOBE.lon0) * RAD;
  const facing = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
  const x = GLOBE.cx + GLOBE.r * Math.cos(phi) * Math.sin(lam);
  const y = GLOBE.cy - GLOBE.r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam));
  return { x, y, visible: facing > 0, facing };
}

let globeLand: string | null = null;
/** 지구본에서 보이는 육지 칸을 작은 네모로 이은 길(한 번만 만든다) */
export function globeLandPath(): string {
  if (globeLand !== null) return globeLand;
  const parts: string[] = [];
  for (let i = 0; i < LS_LAT_CELLS; i++) {
    const lat = 90 - (i + 0.5) * LS_CELL_DEG;
    for (let j = 0; j < LS_LON_CELLS; j++) {
      if (!isLandCell(i, j)) continue;
      const lon = -180 + (j + 0.5) * LS_CELL_DEG;
      const g = projectGlobe(lat, lon);
      if (g.facing <= 0.04) continue;
      parts.push(`M${(g.x - 1.6).toFixed(1)} ${(g.y - 1.6).toFixed(1)}h3.2v3.2h-3.2z`);
    }
  }
  globeLand = parts.join('');
  return globeLand;
}

// ---- 평면 지도(위도·경도를 그대로 편 그림) ----
export const MAP = { x: 10, y: 14, w: 220, h: 110 };
export const mapX = (lon: number) => MAP.x + ((lon + 180) / 360) * MAP.w;
export const mapY = (lat: number) => MAP.y + ((90 - lat) / 180) * MAP.h;

let mapLand: string | null = null;
/** 평면 지도의 육지: 줄마다 이어진 칸을 가로로 긴 네모 하나로 묶은 길(한 번만 만든다) */
export function mapLandPath(): string {
  if (mapLand !== null) return mapLand;
  const cw = MAP.w / LS_LON_CELLS;
  const ch = MAP.h / LS_LAT_CELLS;
  const parts: string[] = [];
  LS_MASK_ROWS.forEach((row, i) => {
    if (row === '') return;
    for (const run of row.split(',')) {
      const [a, b] = run.split('-').map(Number) as [number, number];
      parts.push(`M${(MAP.x + a * cw).toFixed(2)} ${(MAP.y + i * ch).toFixed(2)}h${((b - a + 1) * cw).toFixed(2)}v${ch.toFixed(2)}h${(-(b - a + 1) * cw).toFixed(2)}z`);
    }
  });
  mapLand = parts.join('');
  return mapLand;
}

/** 육지(세모) 점의 꼭짓점 */
export const triangle = (x: number, y: number, s: number) => `${(x).toFixed(1)},${(y - s).toFixed(1)} ${(x - s * 0.95).toFixed(1)},${(y + s * 0.7).toFixed(1)} ${(x + s * 0.95).toFixed(1)},${(y + s * 0.7).toFixed(1)}`;
