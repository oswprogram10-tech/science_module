import { ROCK_M } from '@sci/engine-earth';
import { heightText, type TideScene } from './tideModel';
import { useNarrow } from './useNarrow';

const SKY = '#1c2f4d';
const WATER = '#2b6cb0';
const WATER_LINE = '#bfe3ff';
const SOIL = '#6a563a';
const ROCK = '#6d6f78';
const SAND = '#b79b62';
const MUD = '#5b4636';
const PANEL = '#0f1b2e';
const TEXT = '#ffffff';
const HALO = '#0b1424';

// ---- 바닷가 보기: 옆에서 본 바닷가(왼쪽 육지, 오른쪽 갯벌 비탈과 바다) ----
const W = 640;
const H = 300;
/** 높이(m) → 그림 y. */
const yOf = (h: number) => 140 - 24 * h;
const LAND_H = 4;
const SLOPE_X0 = 150;
const SLOPE_X1 = 480;
const SLOPE_H1 = -4;
const DEEP_X = 600;
const DEEP_H = -7;
const BAR_X = 584;

/** 지형 높이(m): 육지는 평평하고, 비탈을 내려가 바다 밑으로 이어진다. */
const terrainH = (x: number): number => {
  if (x <= SLOPE_X0) return LAND_H;
  if (x <= SLOPE_X1) return LAND_H + ((SLOPE_H1 - LAND_H) * (x - SLOPE_X0)) / (SLOPE_X1 - SLOPE_X0);
  return SLOPE_H1 + ((DEEP_H - SLOPE_H1) * (x - SLOPE_X1)) / (DEEP_X - SLOPE_X1);
};
const terrainY = (x: number) => yOf(terrainH(x));
/** 높이 h에서 지형과 만나는 x(비탈 위). */
const xAtH = (h: number) => SLOPE_X0 + ((LAND_H - h) / (LAND_H - SLOPE_H1)) * (SLOPE_X1 - SLOPE_X0);

/** x 구간 [a, b]의 지형 아래를 채우는 다각형. 구간 안에서 꺾이는 곳(비탈 끝)도 점으로 넣는다. */
const piece = (a: number, b: number): string => {
  const xs = [a, ...[SLOPE_X0, SLOPE_X1].filter((k) => k > a && k < b), b];
  const top = xs.map((x) => `${x.toFixed(1)},${terrainY(x).toFixed(1)}`).join(' ');
  return `${top} ${b},${H} ${a},${H}`;
};

const ROCK_X = xAtH(ROCK_M); // 이보다 낮은 비탈이 모래
const MUD_X = xAtH(-1.5);
const SAND_X = ROCK_X;

/** 갯벌 위 생물 아이콘 자리: [x, 종류]. 지형이 물 밖으로 나와 있을 때만 그린다(장식, 글자 없음). */
const LIFE: [number, 'crab' | 'shell'][] = [
  [395, 'crab'],
  [418, 'shell'],
  [440, 'crab'],
  [452, 'shell'],
];

function Crab({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="tide-life" aria-hidden="true">
      <ellipse cx={x} cy={y - 7} rx={8} ry={5} fill="#e4572e" stroke={HALO} strokeWidth={1} />
      <circle cx={x - 8} cy={y - 13} r={3} fill="#e4572e" stroke={HALO} strokeWidth={1} />
      <circle cx={x + 8} cy={y - 13} r={3} fill="#e4572e" stroke={HALO} strokeWidth={1} />
      <path d={`M${x - 6},${y - 3} l-5,4 M${x - 3},${y - 2} l-3,5 M${x + 3},${y - 2} l3,5 M${x + 6},${y - 3} l5,4`} stroke="#e4572e" strokeWidth={1.5} fill="none" />
    </g>
  );
}

function Shell({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="tide-life" aria-hidden="true">
      <path d={`M${x - 8},${y} A8,8 0 0 1 ${x + 8},${y} Z`} fill="#f1e3c6" stroke={HALO} strokeWidth={1} />
      <path d={`M${x},${y} L${x},${y - 8} M${x - 4},${y} L${x - 5},${y - 6} M${x + 4},${y} L${x + 5},${y - 6}`} stroke="#a58b5b" strokeWidth={1} fill="none" />
    </g>
  );
}

export function TideShoreView({ scene }: { scene: TideScene }) {
  // 휴대폰에서는 그림이 0.52배로 줄어 그려지므로 글자를 키워 화면에서 13 px 이상으로 만든다(데스크톱은 1배).
  const narrow = useNarrow();
  const f = narrow ? 26 : 16;
  const wy = yOf(scene.height);
  const wx = Math.min(xAtH(scene.height), BAR_X);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scene.aria} data-testid="tide-svg">
      <rect width={W} height={H} fill={SKY} />
      <rect
        data-testid="tide-water"
        x={0}
        y={wy}
        width={W}
        height={H - wy}
        fill={WATER}
        data-height={scene.height.toFixed(2)}
        data-y={wy.toFixed(1)}
        data-exposed={scene.exposed}
        data-rocks-submerged={scene.submerged}
        data-rising={scene.rising}
        data-hour={scene.hour}
      />
      {/* 땅: 육지(흙) → 바위 → 모래 → 갯벌 */}
      <polygon points={piece(0, SLOPE_X0)} fill={SOIL} />
      <polygon points={piece(SLOPE_X0, ROCK_X)} fill={ROCK} />
      <polygon points={piece(SAND_X, MUD_X)} fill={SAND} />
      <polygon points={piece(MUD_X, DEEP_X)} fill={MUD} />
      <line x1={wx} y1={wy} x2={BAR_X} y2={wy} stroke={WATER_LINE} strokeWidth={2.5} strokeDasharray="8 5" data-testid="tide-waterline" />
      {scene.exposed &&
        LIFE.filter(([x]) => terrainH(x) > scene.height).map(([x, kind]) =>
          kind === 'crab' ? <Crab key={x} x={x} y={terrainY(x)} /> : <Shell key={x} x={x} y={terrainY(x)} />,
        )}
      <text x={10} y={f + 4} textAnchor="start" fontSize={f} fontWeight={700} fill={TEXT} data-testid="tide-time-label">
        {scene.timeLabel}
      </text>
      <text x={BAR_X - 10} y={f + 4} textAnchor="end" fontSize={f} fontWeight={700} fill={TEXT}>
        바닷물 높이
      </text>
      <text x={75} y={120} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT}>
        육지
      </text>
      <text x={(MUD_X + xAtH(-3.5)) / 2 + 4} y={268} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT}>
        갯벌
      </text>
      <text x={546} y={250} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT} stroke={HALO} strokeWidth={4} paintOrder="stroke">
        바다
      </text>
      {/* 오른쪽 높이 눈금 막대(m) */}
      <rect x={BAR_X} y={0} width={W - BAR_X} height={H} fill={PANEL} />
      <line x1={BAR_X + 9} y1={yOf(4)} x2={BAR_X + 9} y2={yOf(-4)} stroke={TEXT} strokeWidth={2} />
      {[3, 0, -3].map((h) => (
        <g key={h}>
          <line x1={BAR_X + 4} y1={yOf(h)} x2={BAR_X + 14} y2={yOf(h)} stroke={TEXT} strokeWidth={2} />
          <text x={W - 6} y={yOf(h) + f / 3} textAnchor="end" fontSize={f} fontWeight={700} fill={TEXT}>
            {heightText(h).replace('.0', '')}
          </text>
        </g>
      ))}
      <text x={W - 6} y={f + 4} textAnchor="end" fontSize={f} fontWeight={700} fill={TEXT}>
        m
      </text>
      <polygon points={`${BAR_X + 2},${wy - 7} ${BAR_X + 16},${wy} ${BAR_X + 2},${wy + 7}`} fill={WATER_LINE} data-testid="tide-marker" />
    </svg>
  );
}

// ---- 하루 그래프: 지나온 시각의 높이를 점으로 남긴다 ----
const GW = 520;
const GH = 260;
const PX0 = 70;
const PX1 = 500;
const gx = (hour: number) => PX0 + (hour / 24) * (PX1 - PX0);
const gy = (h: number) => 116 - 18 * h;

export function TideGraphView({ scene }: { scene: TideScene }) {
  const narrow = useNarrow();
  const f = narrow ? 22 : 16;
  return (
    <svg viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={scene.graphAria} data-testid="tide-graph-svg">
      <rect width={GW} height={GH} fill={PANEL} />
      <text x={10} y={f + 2} textAnchor="start" fontSize={f} fontWeight={700} fill={TEXT}>
        높이(m)
      </text>
      <line x1={PX0} y1={gy(4)} x2={PX0} y2={gy(-4)} stroke="#8aa0d0" strokeWidth={2} />
      <line x1={PX0} y1={gy(0)} x2={PX1} y2={gy(0)} stroke="#8aa0d0" strokeWidth={1.5} strokeDasharray="5 5" />
      {[3, 0, -3].map((h) => (
        <text key={h} x={PX0 - 8} y={gy(h) + f / 3} textAnchor="end" fontSize={f} fontWeight={700} fill={TEXT}>
          {heightText(h).replace('.0', '')}
        </text>
      ))}
      {[0, 6, 12, 18, 24].map((t) => (
        <g key={t}>
          <line x1={gx(t)} y1={gy(-4)} x2={gx(t)} y2={gy(-4) + 6} stroke="#8aa0d0" strokeWidth={2} />
          <text x={gx(t)} y={gy(-4) + f + 8} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT}>
            {t}
          </text>
        </g>
      ))}
      <text x={(PX0 + PX1) / 2} y={GH - 8} textAnchor="middle" fontSize={f} fontWeight={700} fill={TEXT}>
        시각(시)
      </text>
      {scene.dots.map((d) => (
        <circle key={d.hour} data-testid="tide-graph-dot" cx={gx(d.hour)} cy={gy(d.height)} r={3.5} fill="#7fd1ff" />
      ))}
      <circle data-testid="tide-graph-now" data-hour={scene.hour} data-height={scene.height.toFixed(2)} cx={gx(scene.hour)} cy={gy(scene.height)} r={7} fill="none" stroke="#ffd966" strokeWidth={3} />
    </svg>
  );
}
