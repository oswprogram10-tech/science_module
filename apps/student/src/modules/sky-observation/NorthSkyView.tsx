import { NORTH_CONSTELLATIONS, type NorthStarKey, type SkyPoint } from '@sci/engine-earth';
import { azOffset, type NorthScene, type NorthStarPoint } from './nightModel';
import { useNarrow } from './useNarrow';

const SKY = '#0a1230';
const GROUND = '#2f4a2b';
const LINE = '#9fb4ff';
const GUIDE = '#ffb703';
const TEXT = '#ffffff';
/** 화면에 그리는 방위 범위: 북을 가운데로 좌우 이만큼(°). */
const HALF_RANGE = 75;

interface Layout {
  W: number;
  H: number;
  horizon: number;
  cx: number;
  pxPerDeg: number;
  pxPerAlt: number;
  top: number;
}

const WIDE: Layout = { W: 640, H: 360, horizon: 306, cx: 320, pxPerDeg: 4, pxPerAlt: 3.2, top: 18 };
const NARROW: Layout = { W: 340, H: 430, horizon: 376, cx: 170, pxPerDeg: 2.1, pxPerAlt: 3.9, top: 18 };

/** 과제 선택지에 나오는 별은 언제나 이름을 붙인다(관찰하는 것은 길잡이 선이 닿는 곳이다). */
const OPTION_STARS: [NorthStarKey, string][] = [
  ['polaris', '북극성'],
  ['kochab', '코카브'],
  ['capella', '카펠라'],
  ['vega', '직녀성'],
];

const visible = (p: SkyPoint): boolean => p.altDeg > 0 && Math.abs(azOffset(p.azDeg)) <= HALF_RANGE;

export function NorthSkyView({ scene, showTrail }: { scene: NorthScene; showTrail: boolean }) {
  const L = useNarrow() ? NARROW : WIDE;
  const px = (p: SkyPoint) => L.cx + azOffset(p.azDeg) * L.pxPerDeg;
  const py = (p: SkyPoint) => L.horizon - p.altDeg * L.pxPerAlt;
  const star = (key: NorthStarKey): NorthStarPoint => scene.stars.find((s) => s.key === key)!;

  // 길잡이 별 이름: 두베는 오른쪽 위, 메라크는 오른쪽 아래에 써서 국자 선과 겹치지 않게 한다.
  const pointerLabel = (k: NorthStarKey, dy: number, text: string) => {
    const p = star(k).point;
    if (!visible(p)) return null;
    return (
      <text key={k} data-testid={`name-${k}`} x={px(p) + 10} y={py(p) + dy} fontSize={14} fill={TEXT}>
        {text}
      </text>
    );
  };

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

      {NORTH_CONSTELLATIONS.map((c) => {
        const pts = c.stars.map((k) => star(k).point).filter(visible);
        if (pts.length === 0) return null;
        const xs = pts.map(px);
        const ys = pts.map(py);
        const cxm = xs.reduce((a, b) => a + b, 0) / xs.length;
                // 북두칠성은 별 무리 옆에, 카시오페이아는 위에 이름을 쓴다(길잡이 별 이름과 겹치지 않게).
        const side = c.key === 'dipper';
        const x = side ? Math.min(Math.max(...xs) + 16, L.W - 74) : Math.min(L.W - 62, Math.max(62, cxm));
        const y = side ? Math.max(...ys) + 5 : Math.max(L.top + 8, Math.min(...ys) - 16);
        return (
          <text
            key={c.key}
            data-testid={`name-${c.key}`}
            x={x}
            y={y}
            textAnchor={side ? 'start' : 'middle'}
            fontSize={16}
            fontWeight={700}
            fill={TEXT}
          >
            {c.name}
          </text>
        );
      })}
      {pointerLabel('dubhe', -9, '두베')}
      {pointerLabel('merak', 17, '메라크')}
      {OPTION_STARS.map(([k, text]) => {
        const p = star(k).point;
        if (!visible(p)) return null;
        const x = px(p);
        // 코카브는 국자 쪽(오른쪽)과 겹치지 않게 왼쪽에, 나머지는 오른쪽 위에 쓴다.
        const left = k === 'kochab' || x + 80 > L.W;
        return (
          <text key={k} data-testid={`name-${k}`} x={left ? x - 9 : x + 9} y={py(p) - 8} textAnchor={left ? 'end' : 'start'} fontSize={15} fontWeight={700} fill={TEXT}>
            {text}
          </text>
        );
      })}

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
