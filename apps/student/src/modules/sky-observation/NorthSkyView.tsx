import { NORTH_CONSTELLATIONS, type NorthStarKey, type SkyPoint } from '@sci/engine-earth';
import { azOffset, type NorthScene, type NorthStarPoint } from './nightModel';
import { useNarrow } from './useNarrow';
import { placeLabels, type Box, type LabelRequest, type PlacedLabel } from './labelLayout';

const SKY = '#0a1230';
const GROUND = '#2f4a2b';
const LINE = '#9fb4ff';
const GUIDE = '#ffb703';
const TEXT = '#ffffff';
/** 화면에 그리는 방위 범위: 북을 가운데로 좌우 이만큼(°). */
const HALF_RANGE = 75;

export interface Layout {
  W: number;
  H: number;
  horizon: number;
  cx: number;
  pxPerDeg: number;
  pxPerAlt: number;
  top: number;
}

export const WIDE: Layout = { W: 640, H: 360, horizon: 306, cx: 320, pxPerDeg: 4, pxPerAlt: 3.2, top: 18 };
export const NARROW: Layout = { W: 340, H: 430, horizon: 376, cx: 170, pxPerDeg: 2.1, pxPerAlt: 3.9, top: 18 };

/** 과제 선택지에 나오는 별은 언제나 이름을 붙인다(관찰하는 것은 길잡이 선이 닿는 곳이다). */
const OPTION_STARS: [NorthStarKey, string][] = [
  ['polaris', '북극성'],
  ['kochab', '코카브'],
  ['capella', '카펠라'],
  ['vega', '직녀성'],
];

const visible = (p: SkyPoint): boolean => p.altDeg > 0 && Math.abs(azOffset(p.azDeg)) <= HALF_RANGE;

const DOT = 3.5;
const dotBox = (x: number, y: number, r = DOT + 1.5): Box => ({ x: x - r, y: y - r, w: r * 2, h: r * 2 });

/**
 * 이름 자리를 정한다. 선택지 별 → 길잡이 별(두베·메라크) → 별자리 이름 순서로 놓고,
 * 별 점·별자리 선·길잡이 선·이미 놓은 이름과 겹치지 않는 자리를 고른다.
 */
export function northLabels(scene: NorthScene, L: Layout): PlacedLabel[] {
  const px = (p: SkyPoint) => L.cx + azOffset(p.azDeg) * L.pxPerDeg;
  const py = (p: SkyPoint) => L.horizon - p.altDeg * L.pxPerAlt;
  const star = (key: NorthStarKey): NorthStarPoint => scene.stars.find((s) => s.key === key)!;
  const shown = scene.stars.filter((s) => visible(s.point));

  const dots = shown.map((s) => dotBox(px(s.point), py(s.point)));
  const guidePts = scene.guide.filter(visible);
  for (const p of scene.guideMarks.filter(visible)) dots.push(dotBox(px(p), py(p), 4.5));
  const segments: [number, number, number, number][] = [];
  for (const c of NORTH_CONSTELLATIONS)
    for (const [a, b] of c.lines) {
      const pa = star(a).point;
      const pb = star(b).point;
      if (visible(pa) && visible(pb)) segments.push([px(pa), py(pa), px(pb), py(pb)]);
    }
  for (let i = 1; i < guidePts.length; i++) segments.push([px(guidePts[i - 1]!), py(guidePts[i - 1]!), px(guidePts[i]!), py(guidePts[i]!)]);

  const requests: LabelRequest[] = [];
  const starLabel = (k: NorthStarKey, text: string, fontSize: number, bold: boolean) => {
    const p = star(k).point;
    if (visible(p)) requests.push({ key: k, text, target: dotBox(px(p), py(p), DOT), fontSize, bold });
  };
  for (const [k, text] of OPTION_STARS) starLabel(k, text, 15, true);
  starLabel('dubhe', '두베', 14, false);
  starLabel('merak', '메라크', 14, false);
  for (const c of NORTH_CONSTELLATIONS) {
    const pts = c.stars.map((k) => star(k).point).filter(visible);
    if (pts.length === 0) continue;
    const xs = pts.map(px);
    const ys = pts.map(py);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    requests.push({ key: c.key, text: c.name, target: { x: x0 - DOT, y: y0 - DOT, w: Math.max(...xs) - x0 + DOT * 2, h: Math.max(...ys) - y0 + DOT * 2 }, fontSize: 16, bold: true });
  }
  return placeLabels(requests, { dots, segments }, { x: 2, y: L.top - 14, w: L.W - 4, h: L.horizon - (L.top - 14) - 2 });
}

export function NorthSkyView({ scene, showTrail }: { scene: NorthScene; showTrail: boolean }) {
  const L = useNarrow() ? NARROW : WIDE;
  const px = (p: SkyPoint) => L.cx + azOffset(p.azDeg) * L.pxPerDeg;
  const py = (p: SkyPoint) => L.horizon - p.altDeg * L.pxPerAlt;
  const star = (key: NorthStarKey): NorthStarPoint => scene.stars.find((s) => s.key === key)!;

  const guidePts = scene.guide.filter(visible);

  return (
    <svg viewBox={`0 0 ${L.W} ${L.H}`} role="img" aria-label={scene.ariaLabel} data-testid="north-svg" data-layout={L === NARROW ? 'narrow' : 'wide'}>
      <rect width={L.W} height={L.H} fill={SKY} />

      {showTrail && (
        <g data-testid="star-trails" aria-hidden="true">
          {scene.trail.flatMap((t) =>
            t.stars
              .filter((s) => visible(s.point))
              .map((s) => <circle key={`${t.hour}-${s.key}`} cx={px(s.point)} cy={py(s.point)} r={2} fill={TEXT} opacity={0.35} />),
          )}
        </g>
      )}

      <g aria-hidden="true">
        {NORTH_CONSTELLATIONS.flatMap((c) =>
          c.lines.map(([a, b]) => {
            const pa = star(a).point;
            const pb = star(b).point;
            return visible(pa) && visible(pb) ? (
              <line key={`${c.key}-${a}-${b}`} x1={px(pa)} y1={py(pa)} x2={px(pb)} y2={py(pb)} stroke={LINE} strokeWidth={1.5} />
            ) : null;
          }),
        )}
      </g>

      {scene.guide.length > 0 && (
        <g data-testid="guide" aria-hidden="true">
          <polyline
            data-testid="guide-line"
            points={guidePts.map((p) => `${px(p).toFixed(1)},${py(p).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={GUIDE}
            strokeWidth={2.5}
            strokeDasharray="7 5"
            strokeLinecap="round"
          />
          {scene.guideMarks.filter(visible).map((p, i) => (
            <circle key={i} cx={px(p)} cy={py(p)} r={3} fill={SKY} stroke={GUIDE} strokeWidth={2} />
          ))}
        </g>
      )}

      <g aria-hidden="true">
        {scene.stars
          .filter((s) => visible(s.point))
          .map((s) => (
            <circle key={s.key} data-testid={`star-${s.key}`} cx={px(s.point)} cy={py(s.point)} r={3.5} fill={TEXT} />
          ))}
      </g>

      {northLabels(scene, L).map((l) => (
        <text key={l.key} data-testid={`name-${l.key}`} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={l.fontSize} fontWeight={l.bold ? 700 : 400} fill={TEXT}>
          {l.text}
        </text>
      ))}

      <rect x={0} y={L.horizon} width={L.W} height={L.H - L.horizon} fill={GROUND} />
      <line x1={0} y1={L.horizon} x2={L.W} y2={L.horizon} stroke={TEXT} strokeWidth={2} />
      {[
        [-45, '북서'],
        [0, '북'],
        [45, '북동'],
      ].map(([off, label]) => (
        <text key={label} x={L.cx + (off as number) * L.pxPerDeg} y={L.horizon + 34} textAnchor="middle" fontSize={18} fontWeight={700} fill={TEXT}>
          {label}
        </text>
      ))}
    </svg>
  );
}
