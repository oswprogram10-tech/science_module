import { moonElongationDeg } from '@sci/engine-earth';
import { litWidth, moonLitPath, type MoonScene } from './moonModel';
import { useNarrow } from './useNarrow';

const SKY = '#0a1230';
const GROUND = '#2f4a2b';
const BG = '#0b1020';
const LIT = '#fff3c4';
const DARK = '#38405f';
const RIM = '#aab4d8';
const SUN = '#ffb703';
const TEXT = '#ffffff';

// ---- 땅에서 보기: 저녁 7시 남쪽 하늘 (왼쪽이 동쪽, 오른쪽이 서쪽) ----
const W = 640;
const H = 300;
const HORIZON = 250;
const SKY_TOP = 12;
const X0 = 40;
const X1 = 600;
const MOON_R = 24;

/** 방위각 90(동)~270(서)을 가로 X0~X1에 놓는다. */
const xOf = (az: number) => X0 + ((az - 90) / 180) * (X1 - X0);
const yOf = (alt: number) => HORIZON - (alt / 90) * (HORIZON - SKY_TOP);

export function MoonGroundView({ scene }: { scene: MoonScene }) {
  // 휴대폰에서는 그림이 0.52배로 줄어 그려지므로 글자를 키워 화면에서 13 px 이상으로 만든다(데스크톱은 1배).
  const narrow = useNarrow();
  const nameSize = narrow ? 26 : 16;
  const dirSize = narrow ? 26 : 20;
  const cx = xOf(scene.pos.azDeg);
  const cy = yOf(scene.pos.altDeg);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scene.groundAria} data-testid="moon-ground-svg">
      <rect width={W} height={H} fill={SKY} />
      <text x={10} y={nameSize + 4} textAnchor="start" fontSize={nameSize} fontWeight={700} fill={TEXT} data-testid="moon-day-label">
        {`음력 ${scene.day}일`}
      </text>
      {scene.visible ? (
        <g
          data-testid="moon-ground"
          data-day={scene.day}
          data-frac={scene.frac.toFixed(3)}
          data-waxing={scene.waxing}
          data-lit-width={litWidth(MOON_R, scene.frac).toFixed(2)}
          data-az={scene.pos.azDeg.toFixed(1)}
          data-alt={scene.pos.altDeg.toFixed(1)}
        >
          <circle data-testid="moon-disc" cx={cx} cy={cy} r={MOON_R} fill={DARK} stroke={RIM} strokeWidth={1.5} />
          <path data-testid="moon-lit" d={moonLitPath(cx, cy, MOON_R, scene.frac, scene.waxing)} fill={LIT} />
          <text x={cx} y={Math.max(nameSize + 4, cy - MOON_R - 8)} textAnchor="middle" fontSize={nameSize} fontWeight={700} fill={TEXT}>
            달
          </text>
        </g>
      ) : (
        <text x={W / 2} y={120} textAnchor="middle" fontSize={nameSize} fontWeight={700} fill={TEXT} data-testid="moon-hidden-note">
          {scene.hiddenNote}
        </text>
      )}
      <path d={`M0,${HORIZON} L0,${H} L${W},${H} L${W},${HORIZON} Z`} fill={GROUND} />
      <line x1={0} y1={HORIZON} x2={W} y2={HORIZON} stroke={TEXT} strokeWidth={2} />
      <text x={X0} y={HORIZON + 30} textAnchor="middle" fontSize={dirSize} fontWeight={700} fill={TEXT}>
        동
      </text>
      <text x={(X0 + X1) / 2} y={HORIZON + 30} textAnchor="middle" fontSize={dirSize} fontWeight={700} fill={TEXT}>
        남
      </text>
      <text x={X1} y={HORIZON + 30} textAnchor="middle" fontSize={dirSize} fontWeight={700} fill={TEXT}>
        서
      </text>
    </svg>
  );
}

// ---- 우주에서 보기: 북극 위에서 본 태양·지구·달 (태양은 왼쪽) ----
type Pt = [number, number];
const fmt = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

function arrowHead(e: Pt, size = 9): string {
  return [fmt(e), fmt([e[0] - size, e[1] + size * 0.55]), fmt([e[0] - size, e[1] - size * 0.55])].join(' ');
}

const SW = 520;
const SH = 300;
const ECX = 300;
const ECY = 150;
const ORBIT = 100;
const EARTH_R = 28;
const SPACE_MOON_R = 14;
const DAYS = Array.from({ length: 29 }, (_, i) => i + 1);

/** 음력 d일의 달 자리: 태양이 있는 왼쪽에서 반시계 방향으로 φ만큼 돈 곳. */
const moonSpot = (d: number, r = ORBIT): Pt => {
  const a = ((180 + moonElongationDeg(d)) * Math.PI) / 180;
  return [ECX + r * Math.cos(a), ECY - r * Math.sin(a)];
};

export function MoonSpaceView({ scene }: { scene: MoonScene }) {
  const narrow = useNarrow();
  const f = narrow ? 22 : 16;
  const [mx, my] = moonSpot(scene.day);
  const [lx, ly] = moonSpot(scene.day, ORBIT - 30);
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={scene.spaceAria} data-testid="moon-space-svg">
      <rect width={SW} height={SH} fill={BG} />
      <circle cx={60} cy={ECY} r={34} fill={SUN} stroke="#ffe08a" strokeWidth={3} />
      <text x={60} y={ECY + 55} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT}>
        태양
      </text>
      {[110, 150, 190].map((y) => (
        <g key={y} aria-hidden="true">
          <line x1={108} y1={y} x2={162} y2={y} stroke="#ffd966" strokeWidth={2.5} />
          <polygon points={arrowHead([174, y], 9)} fill="#ffd966" />
        </g>
      ))}
      <circle cx={ECX} cy={ECY} r={ORBIT} fill="none" stroke="#6f86b8" strokeWidth={2} strokeDasharray="6 6" />
      {DAYS.map((d) => {
        const [x, y] = moonSpot(d);
        return d === scene.day ? null : <circle key={d} cx={x} cy={y} r={3} fill="#8aa0d0" aria-hidden="true" />;
      })}
      <circle cx={ECX} cy={ECY} r={EARTH_R} fill="#1b2a4a" />
      <path d={`M${ECX},${ECY - EARTH_R} A${EARTH_R},${EARTH_R} 0 0 0 ${ECX},${ECY + EARTH_R} Z`} fill="#8ecbff" />
      <circle cx={ECX} cy={ECY} r={EARTH_R} fill="none" stroke={TEXT} strokeWidth={2} />
      <text x={ECX} y={ECY + f / 3} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT} stroke={BG} strokeWidth={4} paintOrder="stroke">
        지구
      </text>
      <g data-testid="moon-space" data-day={scene.day} data-frac={scene.frac.toFixed(3)} data-lit-side="sun">
        <circle cx={mx} cy={my} r={SPACE_MOON_R} fill={DARK} stroke={RIM} strokeWidth={1.5} />
        {/* 달은 언제나 태양 쪽(왼쪽) 반이 밝다. */}
        <path d={`M${mx.toFixed(1)},${(my - SPACE_MOON_R).toFixed(1)} A${SPACE_MOON_R},${SPACE_MOON_R} 0 0 0 ${mx.toFixed(1)},${(my + SPACE_MOON_R).toFixed(1)} Z`} fill={LIT} data-testid="moon-space-lit" />
        <text x={lx} y={ly + f / 3} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT} stroke={BG} strokeWidth={4} paintOrder="stroke">
          달
        </text>
      </g>
      <text x={SW - 12} y={f + 8} textAnchor="end" fontSize={f} fontWeight={700} fill={TEXT}>
        {`음력 ${scene.day}일`}
      </text>
    </svg>
  );
}
