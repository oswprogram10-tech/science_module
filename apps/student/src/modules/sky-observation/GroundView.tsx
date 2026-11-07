import type { SkyPoint } from '@sci/engine-earth';
import type { GroundScene } from './model';
import { useNarrow } from './useNarrow';

const W = 640;
const H = 300;
const HORIZON = 250;
const SKY_TOP = 12;
const X0 = 40;
const X1 = 600;

const DAY_SKY = '#7ec8ff';
const NIGHT_SKY = '#0a1230';
const GROUND = '#2f4a2b';

/** 방위각 90(동)~270(서)을 가로 X0~X1에 놓는다. */
const xOf = (az: number) => X0 + ((az - 90) / 180) * (X1 - X0);
const yOf = (alt: number) => HORIZON - (alt / 90) * (HORIZON - SKY_TOP);
/** 화면에 그릴 수 있는 방위(동·남·서 둘레). 북쪽에 가까운 점은 그리지 않는다. */
const inView = (p: SkyPoint) => p.altDeg > 0 && p.azDeg >= 60 && p.azDeg <= 300;

export function GroundView({ scene, trail }: { scene: GroundScene; trail: SkyPoint[] }) {
  // 휴대폰에서는 그림이 0.52배로 줄어 그려지므로 글자를 키워 화면에서 13 px 이상으로 만든다(데스크톱은 1배).
  const narrow = useNarrow();
  const nameSize = narrow ? 26 : 16;
  const dirSize = narrow ? 26 : 20;
  const sunX = xOf(scene.sun.azDeg);
  const sunY = yOf(scene.sun.altDeg);
  const trailPts = trail.filter(inView);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scene.ariaLabel} data-testid="ground-svg">
      <rect width={W} height={H} fill={scene.isDay ? DAY_SKY : NIGHT_SKY} />
      {scene.isDay && trailPts.length > 0 && (
        <g data-testid="sun-trail" aria-hidden="true">
          <polyline
            points={trailPts.map((p) => `${xOf(p.azDeg).toFixed(1)},${yOf(p.altDeg).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="#ffffff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="1 9"
          />
          {trailPts.map((p, i) => (
            <circle key={i} cx={xOf(p.azDeg)} cy={yOf(p.altDeg)} r={3} fill="#ffffff" stroke="#e07a00" strokeWidth={1} />
          ))}
        </g>
      )}
      {scene.isDay && inView(scene.sun) && (
        <g data-testid="sun-icon" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={sunX + Math.cos(a) * 20}
                y1={sunY + Math.sin(a) * 20}
                x2={sunX + Math.cos(a) * 29}
                y2={sunY + Math.sin(a) * 29}
                stroke="#ffb703"
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
          <circle cx={sunX} cy={sunY} r={15} fill="#ffd23f" stroke="#e07a00" strokeWidth={2} />
        </g>
      )}
      {scene.constellations.map((c) => {
        const visible = c.stars.map((s) => inView(s.point));
        const pts = c.stars.filter((_, i) => visible[i]);
        if (pts.length === 0) return null;
        const cx = pts.reduce((a, s) => a + xOf(s.point.azDeg), 0) / pts.length;
        const top = Math.min(...pts.map((s) => yOf(s.point.altDeg)));
        const half = (c.name.length * nameSize) / 2 + 6;
        const labelX = Math.min(W - half, Math.max(half, cx));
        return (
          <g key={c.key} data-testid={`constellation-${c.key}`}>
            <g aria-hidden="true">
              {c.lines.map(([a, b], i) =>
                visible[a] && visible[b] ? (
                  <line
                    key={i}
                    x1={xOf(c.stars[a]!.point.azDeg)}
                    y1={yOf(c.stars[a]!.point.altDeg)}
                    x2={xOf(c.stars[b]!.point.azDeg)}
                    y2={yOf(c.stars[b]!.point.altDeg)}
                    stroke="#9fb4ff"
                    strokeWidth={1.5}
                  />
                ) : null,
              )}
              {c.stars.map((s, i) =>
                visible[i] ? <circle key={i} cx={xOf(s.point.azDeg)} cy={yOf(s.point.altDeg)} r={3.5} fill="#ffffff" /> : null,
              )}
            </g>
            <text x={labelX} y={Math.max(nameSize + 4, top - 12)} textAnchor="middle" fontSize={nameSize} fontWeight={700} fill="#ffffff">
              {c.name}
            </text>
          </g>
        );
      })}
      <path d={`M0,${HORIZON} L0,${H} L${W},${H} L${W},${HORIZON} Z`} fill={GROUND} />
      <line x1={0} y1={HORIZON} x2={W} y2={HORIZON} stroke="#ffffff" strokeWidth={2} />
      <text x={X0} y={HORIZON + 30} textAnchor="middle" fontSize={dirSize} fontWeight={700} fill="#ffffff">
        동
      </text>
      <text x={(X0 + X1) / 2} y={HORIZON + 30} textAnchor="middle" fontSize={dirSize} fontWeight={700} fill="#ffffff">
        남
      </text>
      <text x={X1} y={HORIZON + 30} textAnchor="middle" fontSize={dirSize} fontWeight={700} fill="#ffffff">
        서
      </text>
    </svg>
  );
}
