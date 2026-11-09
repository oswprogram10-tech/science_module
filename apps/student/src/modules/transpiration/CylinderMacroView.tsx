import type { TranspirationSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { hourText, leavesOf, lightOf, mlText, startSample, windOf } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 292;
/** 눈금실린더: 가운데 x, 폭, 위(150 mL)와 아래(0 mL) 높이 */
const CX = 112;
const CYL_W = 40;
const Y_TOP = 140;
const Y_BOTTOM = 276;
const ML_MAX = 150;
const OIL_PX = 5;
const TICKS = [0, 25, 50, 75, 100, 125, 150] as const;
const STEM_TOP_LEAVES = 40;
const MAX_LEAVES_DRAWN = 20;
/** 비닐봉지 안 물방울 점의 자리(왼쪽·오른쪽을 번갈아). fog에 비례해 앞에서부터 보인다. */
const DROPLET_SPOTS: readonly (readonly [number, number])[] = [
  [64, 120], [160, 112], [72, 96], [152, 128], [62, 72], [164, 90], [78, 118], [146, 70], [68, 52],
  [158, 56], [76, 76], [148, 102], [64, 100], [162, 124], [74, 58], [154, 84], [70, 130], [150, 48],
];

export const yOfMl = (ml: number) => Y_BOTTOM - (Math.min(ML_MAX, Math.max(0, ml)) / ML_MAX) * (Y_BOTTOM - Y_TOP);
/** 점이 보이는 개수 */
export const dropletCount = (fog: number) => Math.round(Math.min(1, Math.max(0, fog)) * DROPLET_SPOTS.length);

/** 아래 문구 */
export function transpirationNote(s: TranspirationSample): string {
  return `${hourText(s.t)}시간 · 남은 물 ${mlText(s.remainingMl)} mL`;
}

/** 잎의 자리(줄기 위쪽에서 아래로 번갈아 왼쪽·오른쪽) */
function leafSpots(n: number): { x: number; y: number; side: -1 | 1 }[] {
  const count = Math.min(n, MAX_LEAVES_DRAWN);
  const rows = Math.ceil(count / 2);
  const step = Math.min(22, 72 / Math.max(1, rows));
  return Array.from({ length: count }, (_, k) => {
    const side = k % 2 === 0 ? -1 : 1;
    return { x: CX + side * 13, y: 118 - Math.floor(k / 2) * step, side };
  });
}

export function CylinderMacroView({ experiment, snapshot, values }: ViewProps<TranspirationSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const leaves = leavesOf(values);
  const light = lightOf(values);
  const dark = light === 'dark';
  const wind = windOf(values) === 'on';
  const ink = dark ? '#f3f4f6' : 'currentColor';
  const note = transpirationNote(s);
  const yWater = yOfMl(s.remainingMl);
  const spots = leafSpots(leaves);
  const stemTop = leaves > 0 ? Math.min(...spots.map((p) => p.y)) - 12 : 56;
  const drops = dropletCount(s.fog);
  const x0 = CX - CYL_W / 2;
  const x1 = CX + CYL_W / 2;

  return (
    <figure className="view cylinder-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`눈금실린더 물에 ${leaves > 0 ? `잎 ${leaves}장이 달린` : '잎을 모두 딴'} 줄기를 꽂고 비닐봉지를 씌움: ${dark ? '어두운 곳' : '밝은 곳'}, ${wind ? '선풍기 약하게' : '바람 없음'}, ${note}`}
      >
        {dark && <rect data-testid="dark-bg" x="0" y="0" width={W} height={H} rx="8" fill="#1f2937" />}

        {/* 빛 표시 */}
        {dark ? (
          <g data-testid="light-label" data-light="dark">
            <rect x="6" y="4" width="74" height="22" rx="6" fill="#000000" fillOpacity="0.55" stroke="#9ca3af" strokeWidth="1" />
            <text x="43" y="20" textAnchor="middle" fontSize="14" fill="#ffffff">어두운 곳</text>
          </g>
        ) : (
          <g data-testid="light-label" data-light="bright">
            <circle cx="16" cy="16" r="6" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
            <text x="28" y="21" fontSize="14" fill={ink}>밝은 곳</text>
          </g>
        )}

        {/* 눈금실린더: 물, 식용유 */}
        <rect x={x0 + 1} y={yWater} width={CYL_W - 2} height={Y_BOTTOM - yWater} fill="#60a5fa" fillOpacity="0.6" />
        <rect data-testid="oil" x={x0 + 1} y={yWater - OIL_PX} width={CYL_W - 2} height={OIL_PX} fill="#fde047" stroke="#ca8a04" strokeWidth="0.8" />
        <text x={x1 + 8} y={yWater + 4} fontSize="14" fill={ink}>식용유</text>

        {/* 줄기와 잎 */}
        <line data-testid="stem" x1={CX} y1={Y_BOTTOM - 20} x2={CX} y2={stemTop} stroke="#65a30d" strokeWidth="3.5" strokeLinecap="round" />
        {spots.map((p, k) => (
          <ellipse
            key={k}
            data-testid="leaf"
            cx={p.x}
            cy={p.y}
            rx="13"
            ry="5"
            fill="#16a34a"
            stroke="#14532d"
            strokeWidth="1"
            transform={`rotate(${p.side * -25} ${p.x} ${p.y})`}
          />
        ))}
        {leaves === 0 && (
          <g data-testid="leaf-scars">
            {[STEM_TOP_LEAVES + 34, STEM_TOP_LEAVES + 56, STEM_TOP_LEAVES + 78].map((y, k) => (
              <line key={y} x1={CX} y1={y} x2={CX + (k % 2 === 0 ? 7 : -7)} y2={y - 4} stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
            ))}
            <text x={CX} y="44" textAnchor="middle" fontSize="14" fill={ink}>잎을 딴 자국</text>
          </g>
        )}

        {/* 유리 눈금실린더 */}
        <rect x={x0} y={Y_TOP} width={CYL_W} height={Y_BOTTOM - Y_TOP} rx="3" fill="none" stroke={dark ? '#d1d5db' : '#6b7280'} strokeWidth="2" />
        <rect x={x0 - 10} y={Y_BOTTOM} width={CYL_W + 20} height="8" rx="3" fill={dark ? '#9ca3af' : '#9ca3af'} />
        {TICKS.map((ml) => (
          <g key={ml}>
            <line x1={x0 - 5} y1={yOfMl(ml)} x2={x0} y2={yOfMl(ml)} stroke={ink} strokeWidth="1.5" />
            <text x={x0 - 8} y={yOfMl(ml) + 5} textAnchor="end" fontSize="14" fill={ink}>{ml}</text>
          </g>
        ))}

        {/* 비닐봉지와 물방울 */}
        <path data-testid="bag" d="M56 138 L56 52 Q56 24 112 24 Q168 24 168 52 L168 138 Z" fill="#bfdbfe" fillOpacity="0.25" stroke={dark ? '#bfdbfe' : '#3b82f6'} strokeWidth="1.5" strokeDasharray="5 3" />
        <line x1="86" y1="139" x2="138" y2="139" stroke={dark ? '#bfdbfe' : '#3b82f6'} strokeWidth="3" strokeLinecap="round" />
        <text x="174" y="40" fontSize="14" fill={ink}>비닐봉지</text>
        <g data-testid="droplets" data-count={drops}>
          {DROPLET_SPOTS.slice(0, drops).map(([x, y]) => (
            <path key={`${x}-${y}`} data-testid="droplet" d={`M${x} ${y - 5} q-4 6 0 9 q4 -3 0 -9z`} fill="#2563eb" stroke={dark ? '#e0f2fe' : '#1e3a8a'} strokeWidth="0.6" />
          ))}
        </g>

        {/* 바람: 선풍기와 바람 선 */}
        {wind && (
          <g data-testid="fan">
            <circle cx="208" cy="85" r="17" fill="none" stroke={ink} strokeWidth="2" />
            {[0, 120, 240].map((a) => (
              <ellipse key={a} cx="208" cy="77" rx="5" ry="8" fill="#93c5fd" stroke={ink} strokeWidth="1" transform={`rotate(${a} 208 85)`} />
            ))}
            <circle cx="208" cy="85" r="3.5" fill={ink} />
            <text x="208" y="118" textAnchor="middle" fontSize="14" fill={ink}>선풍기</text>
            <g data-testid="wind-lines" fill="none" stroke={dark ? '#bfdbfe' : '#2563eb'} strokeWidth="2" strokeLinecap="round">
              {[68, 85, 102].map((y) => (
                <path key={y} d={`M186 ${y} q-6 -5 -12 0 t-12 0`} />
              ))}
            </g>
          </g>
        )}
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
