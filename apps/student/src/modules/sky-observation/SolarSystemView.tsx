import { planetOf, type PlanetKey } from '@sci/engine-earth';
import { EARTH_PX, type CompareMode, type SolarRow, type SolarScene } from './nightModel';
import { useNarrow } from './useNarrow';

const SKY = '#0a1230';
const LEADER = '#7f90c8';
const BAR = '#9fb4ff';
const SUN_FILL = '#ffd23f';
const SUN_EDGE = '#e07a00';
const TEXT = '#ffffff';

const PLANET_FILL: Record<PlanetKey, string> = {
  mercury: '#b9b9b9',
  venus: '#e8c477',
  earth: '#4a90d9',
  mars: '#d9593d',
  jupiter: '#d9a066',
  saturn: '#e3cf8f',
  uranus: '#8fd9e3',
  neptune: '#5d7be8',
};

const diameterPx = (key: PlanetKey): number => (planetOf(key).diameterKm / planetOf('earth').diameterKm) * EARTH_PX;

/** 태양은 너무 커서 그리지 못하고, 가장자리에 호 일부로만 그린다. */
function SunArc({ cx, top, sunPx }: { cx: number; top: number; sunPx: number }) {
  const r = sunPx / 2;
  return <circle data-testid="sun-arc" cx={cx} cy={top + r} r={r} fill={SUN_FILL} stroke={SUN_EDGE} strokeWidth={2} aria-hidden="true" />;
}

// ---- 크기 비교 ----

function SizeWide({ scene }: { scene: SolarScene }) {
  const W = 640;
  const H = 312;
  const CY = 72;
  const pitch = scene.rows.map((r) => Math.max(diameterPx(r.key) + 12, 64));
  const total = pitch.reduce((a, b) => a + b, 0);
  let x = (W - total) / 2;
  const cols = scene.rows.map((r, i) => {
    const c = x + pitch[i]! / 2;
    x += pitch[i]!;
    return { row: r, cx: c };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scene.ariaLabel} data-testid="solar-svg" data-mode="size" data-layout="wide">
      <rect width={W} height={H} fill={SKY} />
      <SunArc cx={W / 2} top={278} sunPx={scene.sunPx} />
      <text x={W / 2} y={266} textAnchor="middle" fontSize={16} fontWeight={700} fill={TEXT} data-testid="sun-label">
        {scene.sunText}
      </text>
      {cols.map(({ row, cx }, i) => {
        const r = diameterPx(row.key) / 2;
        const nameY = i % 2 === 0 ? 156 : 206;
        const lx = Math.min(W - 56, Math.max(56, cx));
        return (
          <g key={row.key}>
            <g aria-hidden="true">
              <line x1={cx} y1={CY + Math.max(r, 2) + 3} x2={cx} y2={nameY - 18} stroke={LEADER} strokeWidth={1} />
              <circle data-testid={`planet-circle-${row.key}`} data-diameter={(r * 2).toFixed(2)} cx={cx} cy={CY} r={r} fill={PLANET_FILL[row.key]} />
            </g>
            <text x={lx} y={nameY} textAnchor="middle" fontSize={16} fontWeight={700} fill={TEXT}>
              {row.name}
            </text>
            <text data-testid={`size-label-${row.key}`} x={lx} y={nameY + 20} textAnchor="middle" fontSize={15} fill={TEXT}>
              {row.sizeText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SizeNarrow({ scene }: { scene: SolarScene }) {
  const W = 340;
  const heights = scene.rows.map((r) => Math.max(diameterPx(r.key) + 16, 46));
  const rowsEnd = 14 + heights.reduce((a, b) => a + b, 0);
  const sunTop = rowsEnd + 44;
  const H = sunTop + 28;
  let y = 14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scene.ariaLabel} data-testid="solar-svg" data-mode="size" data-layout="narrow">
      <rect width={W} height={H} fill={SKY} />
      <SunArc cx={W / 2} top={sunTop} sunPx={scene.sunPx} />
      <text x={W / 2} y={sunTop - 12} textAnchor="middle" fontSize={16} fontWeight={700} fill={TEXT} data-testid="sun-label">
        {scene.sunText}
      </text>
      {scene.rows.map((row, i) => {
        const h = heights[i]!;
        const cy = y + h / 2;
        y += h;
        const r = diameterPx(row.key) / 2;
        return (
          <g key={row.key}>
            <circle data-testid={`planet-circle-${row.key}`} data-diameter={(r * 2).toFixed(2)} cx={64} cy={cy} r={r} fill={PLANET_FILL[row.key]} aria-hidden="true" />
            <text x={140} y={cy - 2} fontSize={16} fontWeight={700} fill={TEXT}>
              {row.name}
            </text>
            <text data-testid={`size-label-${row.key}`} x={140} y={cy + 18} fontSize={15} fill={TEXT}>
              {row.sizeText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- 거리 비교 ----

const CELLS = 30;
const MAJOR = [0, 5, 10, 15, 20, 25, 30];

function DistanceWide({ scene }: { scene: SolarScene }) {
  const W = 640;
  const H = 266;
  const X0 = 40;
  const PX = 18.8;
  const BAR_Y = 178;
  const xOf = (cells: number) => X0 + cells * PX;
  const byKey = (k: PlanetKey): SolarRow => scene.rows.find((r) => r.key === k)!;
  const inner: PlanetKey[] = ['mercury', 'venus', 'earth', 'mars'];
  const outer: PlanetKey[] = ['jupiter', 'saturn', 'uranus', 'neptune'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scene.ariaLabel} data-testid="solar-svg" data-mode="distance" data-layout="wide">
      <rect width={W} height={H} fill={SKY} />
      <g aria-hidden="true">
        <line x1={X0} y1={BAR_Y} x2={xOf(CELLS)} y2={BAR_Y} stroke={BAR} strokeWidth={3} />
        {Array.from({ length: CELLS + 1 }, (_, k) => (
          <line key={k} x1={xOf(k)} y1={BAR_Y} x2={xOf(k)} y2={BAR_Y + (k % 5 === 0 ? 14 : 8)} stroke={BAR} strokeWidth={k % 5 === 0 ? 2 : 1} />
        ))}
        <circle cx={18} cy={BAR_Y} r={9} fill={SUN_FILL} stroke={SUN_EDGE} strokeWidth={2} />
      </g>
      {MAJOR.map((k) => (
        <text key={k} data-testid={`tick-${k}`} x={xOf(k)} y={BAR_Y + 36} textAnchor="middle" fontSize={15} fill={TEXT}>
          {k}
        </text>
      ))}
      <text x={4} y={150} fontSize={15} fontWeight={700} fill={TEXT}>
        태양
      </text>
      <text x={W / 2} y={BAR_Y + 78} textAnchor="middle" fontSize={15} fill={TEXT}>
        태양에서 지구까지의 거리가 1칸이에요
      </text>
      {inner.map((k, i) => {
        const row = byKey(k);
        const x = xOf(row.cells);
        const ty = 40 + i * 26;
        return (
          <g key={k}>
            <line x1={x} y1={BAR_Y} x2={x} y2={ty + 4} stroke={LEADER} strokeWidth={1} aria-hidden="true" />
            <circle data-testid={`planet-dot-${k}`} cx={x} cy={BAR_Y} r={4} fill={PLANET_FILL[k]} stroke={SKY} strokeWidth={1} aria-hidden="true" />
            <text data-testid={`dist-label-${k}`} x={x + 6} y={ty} fontSize={15} fill={TEXT}>
              {`${row.name} ${row.distText}`}
            </text>
          </g>
        );
      })}
      {outer.map((k) => {
        const row = byKey(k);
        const x = xOf(row.cells);
        const end = k === 'neptune';
        return (
          <g key={k}>
            <line x1={x} y1={BAR_Y} x2={x} y2={154} stroke={LEADER} strokeWidth={1} aria-hidden="true" />
            <circle data-testid={`planet-dot-${k}`} cx={x} cy={BAR_Y} r={6} fill={PLANET_FILL[k]} stroke={SKY} strokeWidth={1} aria-hidden="true" />
            <text data-testid={`dist-label-${k}`} x={end ? W - 8 : x} y={150} textAnchor={end ? 'end' : 'middle'} fontSize={15} fill={TEXT}>
              {`${row.name} ${row.distText}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DistanceNarrow({ scene }: { scene: SolarScene }) {
  const W = 340;
  const BX = 76;
  const Y0 = 56;
  const PY = 18.7;
  const H = Y0 + CELLS * PY + 52;
  const yOf = (cells: number) => Y0 + cells * PY;
  const byKey = (k: PlanetKey): SolarRow => scene.rows.find((r) => r.key === k)!;
  const inner: PlanetKey[] = ['mercury', 'venus', 'earth', 'mars'];
  const outer: PlanetKey[] = ['jupiter', 'saturn', 'uranus', 'neptune'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={scene.ariaLabel} data-testid="solar-svg" data-mode="distance" data-layout="narrow">
      <rect width={W} height={H} fill={SKY} />
      <g aria-hidden="true">
        <line x1={BX} y1={Y0} x2={BX} y2={yOf(CELLS)} stroke={BAR} strokeWidth={3} />
        {Array.from({ length: CELLS + 1 }, (_, k) => (
          <line key={k} x1={BX - (k % 5 === 0 ? 14 : 8)} y1={yOf(k)} x2={BX} y2={yOf(k)} stroke={BAR} strokeWidth={k % 5 === 0 ? 2 : 1} />
        ))}
        <circle cx={BX} cy={28} r={9} fill={SUN_FILL} stroke={SUN_EDGE} strokeWidth={2} />
      </g>
      <text x={BX + 16} y={34} fontSize={15} fontWeight={700} fill={TEXT}>
        태양
      </text>
      {MAJOR.map((k) => (
        <text key={k} data-testid={`tick-${k}`} x={BX - 20} y={yOf(k) + 5} textAnchor="end" fontSize={15} fill={TEXT}>
          {k}
        </text>
      ))}
      <text x={W / 2} y={H - 10} textAnchor="middle" fontSize={15} fill={TEXT}>
        태양에서 지구까지가 1칸이에요
      </text>
      {inner.map((k, i) => {
        const row = byKey(k);
        const y = yOf(row.cells);
        const ty = 66 + i * 22;
        return (
          <g key={k}>
            <polyline points={`${BX},${y} ${BX + 40},${y} ${BX + 56},${ty - 5}`} fill="none" stroke={LEADER} strokeWidth={1} aria-hidden="true" />
            <circle data-testid={`planet-dot-${k}`} cx={BX} cy={y} r={4} fill={PLANET_FILL[k]} stroke={SKY} strokeWidth={1} aria-hidden="true" />
            <text data-testid={`dist-label-${k}`} x={BX + 60} y={ty} fontSize={15} fill={TEXT}>
              {`${row.name} ${row.distText}`}
            </text>
          </g>
        );
      })}
      {outer.map((k) => {
        const row = byKey(k);
        const y = yOf(row.cells);
        return (
          <g key={k}>
            <line x1={BX} y1={y} x2={BX + 52} y2={y} stroke={LEADER} strokeWidth={1} aria-hidden="true" />
            <circle data-testid={`planet-dot-${k}`} cx={BX} cy={y} r={6} fill={PLANET_FILL[k]} stroke={SKY} strokeWidth={1} aria-hidden="true" />
            <text data-testid={`dist-label-${k}`} x={BX + 60} y={y + 5} fontSize={15} fill={TEXT}>
              {`${row.name} ${row.distText}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SolarSystemView({ scene, compare }: { scene: SolarScene; compare: CompareMode }) {
  const narrow = useNarrow();
  if (compare === 'size') return narrow ? <SizeNarrow scene={scene} /> : <SizeWide scene={scene} />;
  return narrow ? <DistanceNarrow scene={scene} /> : <DistanceWide scene={scene} />;
}
