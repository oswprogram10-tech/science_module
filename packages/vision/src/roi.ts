import type { Rgb } from './color';

export interface Roi {
  /** 모두 0~1 비율 */
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_ROI: Roi = { x: 0.35, y: 0.35, w: 0.3, h: 0.3 };
/** 밝기(V) 상위·하위에서 제외할 픽셀 비율. 반사광과 그림자를 걸러 낸다. */
export const TRIM_FRACTION = 0.05;

/**
 * 가운데 영역(ROI)의 평균 RGB. 밝기(V) 상위 5%와 하위 5% 픽셀은 제외한다.
 * data는 RGBA(ImageData.data) 순서.
 */
export function averageRoi(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roi: Roi = DEFAULT_ROI,
): Rgb {
  const x0 = Math.max(0, Math.floor(roi.x * width));
  const y0 = Math.max(0, Math.floor(roi.y * height));
  const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil((roi.x + roi.w) * width)));
  const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil((roi.y + roi.h) * height)));
  const px: { r: number; g: number; b: number; v: number }[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      px.push({ r, g, b, v: Math.max(r, g, b) });
    }
  }
  if (px.length === 0) return { r: 0, g: 0, b: 0 };
  px.sort((p, q) => p.v - q.v);
  const cut = Math.floor(px.length * TRIM_FRACTION);
  const kept = px.length - 2 * cut > 0 ? px.slice(cut, px.length - cut) : px;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of kept) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  return { r: r / kept.length, g: g / kept.length, b: b / kept.length };
}
