// 별 이름 배치: 별이 시각에 따라 돌아가므로 고정된 방향(늘 오른쪽 등)으로 쓰면 어느 시각에는 겹친다.
// 후보 자리를 차례로 따져 다른 이름, 별 점, 별자리 선, 길잡이 선과 가장 덜 겹치는 자리를 고른다.
// 순수 함수이고 결정론적이다(점수가 같으면 후보 순서가 앞선 자리).

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Anchor = 'start' | 'middle' | 'end';

export interface LabelRequest {
  key: string;
  text: string;
  /** 이름을 붙일 대상의 중심(별 하나, 또는 별자리 무리의 테두리 상자). */
  target: Box;
  fontSize: number;
  bold?: boolean;
}

export interface PlacedLabel {
  key: string;
  text: string;
  x: number;
  /** 글자의 기준선 y */
  y: number;
  anchor: Anchor;
  fontSize: number;
  bold: boolean;
  box: Box;
}

export interface Obstacles {
  /** 별 점처럼 덮으면 안 되는 것 */
  dots: Box[];
  /** 선분(별자리 선, 길잡이 선) */
  segments: [number, number, number, number][];
}

/** 한글은 글자 하나가 거의 정사각형이다. 굵은 글자는 조금 더 넓게 본다. */
export function textWidth(text: string, fontSize: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += /[ㄱ-힝]/.test(ch) ? fontSize : fontSize * 0.6;
  return w * (bold ? 1.06 : 1);
}

const intersects = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function boxOf(x: number, y: number, anchor: Anchor, w: number, fs: number): Box {
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  // 기준선 위로 글자 높이의 약 0.85, 아래로 0.2만큼 차지한다.
  return { x: left, y: y - fs * 0.85, w, h: fs * 1.05 };
}

/** 선분이 상자를 지나가는지(양 끝이 상자 밖이어도 가로지르면 참). 촘촘히 표본을 찍어 판단한다. */
function segmentHits(b: Box, [x1, y1, x2, y2]: [number, number, number, number]): boolean {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.ceil(len / 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** 대상 둘레의 후보 자리. 앞쪽일수록 먼저 고른다. */
function candidates(t: Box, w: number, fs: number, gap: number): { x: number; y: number; anchor: Anchor }[] {
  const cx = t.x + t.w / 2;
  const cy = t.y + t.h / 2;
  const right = t.x + t.w + gap;
  const left = t.x - gap;
  const above = t.y - gap; // 기준선
  const below = t.y + t.h + gap + fs * 0.85;
  const mid = cy + fs * 0.35;
  return [
    { x: right, y: mid, anchor: 'start' },
    { x: left, y: mid, anchor: 'end' },
    { x: right, y: above, anchor: 'start' },
    { x: left, y: above, anchor: 'end' },
    { x: right, y: below, anchor: 'start' },
    { x: left, y: below, anchor: 'end' },
    { x: cx, y: above, anchor: 'middle' },
    { x: cx, y: below, anchor: 'middle' },
    // 조금 더 떨어진 자리(가까운 자리가 모두 막힌 경우)
    { x: right + w * 0.3, y: above - fs * 0.6, anchor: 'start' },
    { x: left - w * 0.3, y: above - fs * 0.6, anchor: 'end' },
    { x: right + w * 0.3, y: below + fs * 0.6, anchor: 'start' },
    { x: left - w * 0.3, y: below + fs * 0.6, anchor: 'end' },
  ];
}

/**
 * 요청 순서대로 하나씩 놓는다(앞의 이름이 좋은 자리를 먼저 차지한다).
 * 점수: 화면 밖 1000, 이미 놓은 이름과 겹침 100, 별 점 덮음 50, 선이 지나감 10.
 */
export function placeLabels(requests: LabelRequest[], obstacles: Obstacles, bounds: Box, gap = 6): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  for (const r of requests) {
    const bold = !!r.bold;
    const w = textWidth(r.text, r.fontSize, bold);
    let best: PlacedLabel | null = null;
    let bestScore = Infinity;
    for (const c of candidates(r.target, w, r.fontSize, gap)) {
      const box = boxOf(c.x, c.y, c.anchor, w, r.fontSize);
      let score = 0;
      if (box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h) score += 1000;
      for (const p of placed) if (intersects(box, p.box)) score += 100;
      for (const d of obstacles.dots) if (intersects(box, d)) score += 50;
      for (const s of obstacles.segments) if (segmentHits(box, s)) score += 10;
      if (score < bestScore) {
        bestScore = score;
        best = { key: r.key, text: r.text, x: c.x, y: c.y, anchor: c.anchor, fontSize: r.fontSize, bold, box };
        if (score === 0) break;
      }
    }
    placed.push(best!);
  }
  return placed;
}
