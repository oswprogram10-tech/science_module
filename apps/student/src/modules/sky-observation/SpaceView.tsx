import { CONSTELLATIONS, CONSTELLATION_KEYS, dayOfMonth15, type Rotation } from '@sci/engine-earth';
import { earthOrbitAngleDeg, screenAngleIsDay, seoulScreenAngle } from './model';

const BG = '#0b1020';
const NIGHT = '#1b2a4a';
const DAYSIDE = '#8ecbff';
const SUN = '#ffb703';

type Pt = [number, number];
const fmt = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

/** 끝점 e에서 방향 t(단위벡터)로 향하는 화살촉 삼각형 점들. */
function arrowHead(e: Pt, t: Pt, size = 9): string {
  const n: Pt = [-t[1], t[0]];
  const base: Pt = [e[0] - t[0] * size, e[1] - t[1] * size];
  return [fmt([e[0], e[1]]), fmt([base[0] + n[0] * size * 0.55, base[1] + n[1] * size * 0.55]), fmt([base[0] - n[0] * size * 0.55, base[1] - n[1] * size * 0.55])].join(' ');
}

/** 중심에서 본 방향 각도(화면 각도 rad)로 바깥 라벨의 정렬을 정한다. */
function labelSpot(cx: number, cy: number, r: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const anchor = c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle';
  const dy = anchor === 'middle' ? (s < 0 ? -4 : 16) : 5;
  return { x: cx + r * c, y: cy + r * s + dy, anchor: anchor as 'start' | 'end' | 'middle' };
}

export interface RotationSpaceProps {
  hour: number;
  rotation: Rotation;
  showAntipode: boolean;
  ariaLabel: string;
}

export function RotationSpaceView({ hour, rotation, showAntipode, ariaLabel }: RotationSpaceProps) {
  const cx = 300;
  const cy = 150;
  const R = 95;
  const seoul = seoulScreenAngle(hour, rotation);
  const anti = seoul + Math.PI;
  const sPos: Pt = [cx + R * Math.cos(seoul), cy + R * Math.sin(seoul)];
  const aPos: Pt = [cx + R * Math.cos(anti), cy + R * Math.sin(anti)];
  const sLabel = labelSpot(cx, cy, R + 14, seoul);
  const aLabel = labelSpot(cx, cy, R + 14, anti);
  // 북극 위에서 보면 실제 자전(forward)은 반시계 방향: 수학 각도가 늘어나는 쪽.
  const sign = rotation === 'forward' ? 1 : -1;
  const ringR = 29;
  const a0 = rotation === 'forward' ? 70 : 290;
  const arcPts: Pt[] = Array.from({ length: 36 }, (_, i) => {
    const a = ((a0 + sign * (i / 35) * 280) * Math.PI) / 180;
    return [cx + ringR * Math.cos(a), cy - ringR * Math.sin(a)];
  });
  const end = arcPts[arcPts.length - 1]!;
  const aEnd = ((a0 + sign * 280) * Math.PI) / 180;
  const tangent: Pt = [-sign * Math.sin(aEnd), -sign * Math.cos(aEnd)];
  const rays = [100, 125, 175, 200];
  return (
    <svg viewBox="0 0 520 300" role="img" aria-label={ariaLabel} data-testid="space-svg">
      <rect width={520} height={300} fill={BG} />
      <circle cx={60} cy={150} r={34} fill={SUN} stroke="#ffe08a" strokeWidth={3} />
      <text x={60} y={205} textAnchor="middle" fontSize={16} fontWeight={700} fill="#ffffff">
        태양
      </text>
      {rays.map((y) => (
        <g key={y} aria-hidden="true">
          <line x1={108} y1={y} x2={186} y2={y} stroke="#ffd966" strokeWidth={2.5} />
          <polygon points={arrowHead([196, y], [1, 0], 9)} fill="#ffd966" />
        </g>
      ))}
      <circle cx={cx} cy={cy} r={R} fill={NIGHT} />
      <path d={`M${cx},${cy - R} A${R},${R} 0 0 0 ${cx},${cy + R} Z`} fill={DAYSIDE} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#ffffff" strokeWidth={2} />
      <text x={cx - 66} y={cy + 6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#0b1530">
        낮
      </text>
      <text x={cx + 66} y={cy + 6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#ffffff">
        밤
      </text>
      <circle cx={cx} cy={cy} r={36} fill={BG} />
      <polyline points={arcPts.map(fmt).join(' ')} fill="none" stroke="#ffffff" strokeWidth={2.5} />
      <polygon points={arrowHead(end, tangent, 9)} fill="#ffffff" data-testid="rotation-arrow" data-direction={rotation} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#ffffff">
        자전
      </text>
      {showAntipode && (
        <g data-testid="antipode-marker">
          <rect x={aPos[0] - 7} y={aPos[1] - 7} width={14} height={14} fill="#ffe14d" stroke="#0b1020" strokeWidth={2} />
          <text x={aLabel.x} y={aLabel.y} textAnchor={aLabel.anchor} fontSize={15} fontWeight={700} fill="#ffe14d" stroke={BG} strokeWidth={4} paintOrder="stroke">
            지구 반대편
          </text>
        </g>
      )}
      <g data-testid="seoul-marker" data-day={screenAngleIsDay(seoul)}>
        <circle cx={sPos[0]} cy={sPos[1]} r={8} fill="#ff5a4d" stroke="#ffffff" strokeWidth={2.5} />
        <text x={sLabel.x} y={sLabel.y} textAnchor={sLabel.anchor} fontSize={15} fontWeight={700} fill="#ff9a90" stroke={BG} strokeWidth={4} paintOrder="stroke">
          우리나라
        </text>
      </g>
    </svg>
  );
}

export interface RevolutionSpaceProps {
  month: number;
  dayOfYear: number;
  ariaLabel: string;
}

export function RevolutionSpaceView({ month, dayOfYear, ariaLabel }: RevolutionSpaceProps) {
  const cx = 260;
  const cy = 185;
  const R = 88;
  const at = (deg: number, r: number): Pt => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
  const psi = earthOrbitAngleDeg(dayOfYear);
  const earth = at(psi, R);
  const outward = (psi * Math.PI) / 180;
  const dir: Pt = [Math.cos(outward), -Math.sin(outward)];
  const tail = at(psi, R + 13);
  const tip = at(psi, R + 40);
  const nameSpot = at(psi, R + 52);
  // 지구 이름표는 궤도 접선 방향(위쪽)으로 조금 띄운다.
  const tangent: Pt = [-dir[1], dir[0]];
  const earthLabel: Pt = [earth[0] + tangent[0] * 30, earth[1] + tangent[1] * 30];
  return (
    <svg viewBox="0 0 520 370" role="img" aria-label={ariaLabel} data-testid="space-svg">
      <rect width={520} height={370} fill={BG} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#6f86b8" strokeWidth={2} strokeDasharray="6 6" />
      <circle cx={cx} cy={cy} r={16} fill={SUN} stroke="#ffe08a" strokeWidth={2} />
      <text x={cx} y={cy + 36} textAnchor="middle" fontSize={15} fontWeight={700} fill="#ffffff">
        태양
      </text>
      {[1, 4, 7, 10].map((m) => {
        const a = earthOrbitAngleDeg(dayOfMonth15(m));
        const dot = at(a, R);
        const lab = at(a, R - 26);
        return (
          <g key={m}>
            <circle cx={dot[0]} cy={dot[1]} r={3.5} fill="#cfe0ff" />
            <text x={lab[0]} y={lab[1] + 5} textAnchor="middle" fontSize={14} fill="#cfe0ff">
              {m}월
            </text>
          </g>
        );
      })}
      {CONSTELLATION_KEYS.map((k) => {
        const c = CONSTELLATIONS[k];
        const p = at(c.raHours * 15, 160);
        return (
          <text key={k} x={p[0]} y={p[1] + 5} textAnchor="middle" fontSize={16} fontWeight={700} fill="#ffffff" data-testid={`ring-${k}`}>
            {c.name}
          </text>
        );
      })}
      <g aria-hidden="true">
        <line x1={tail[0]} y1={tail[1]} x2={tip[0] - dir[0] * 6} y2={tip[1] - dir[1] * 6} stroke="#9fb4ff" strokeWidth={3} />
        <polygon points={arrowHead(tip, dir, 11)} fill="#9fb4ff" data-testid="night-arrow" />
      </g>
      <text x={nameSpot[0]} y={nameSpot[1] + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#9fb4ff" stroke={BG} strokeWidth={4} paintOrder="stroke">
        밤하늘 쪽
      </text>
      <circle cx={earth[0]} cy={earth[1]} r={10} fill="#4aa3ff" stroke="#ffffff" strokeWidth={2.5} data-testid="earth-marker" data-month={month} />
      <text x={earthLabel[0]} y={earthLabel[1] + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#ffffff" stroke={BG} strokeWidth={4} paintOrder="stroke">
        지구
      </text>
    </svg>
  );
}
