import type { BlEnd, BlWire, BsCells } from '@sci/engine-physics';

// 전구에 불 켜기와 전지 직렬연결 비교가 함께 쓰는 그림 부품: 전지 끼우개, 맨 전구, 스위치, 전선 두 가닥.
// 그림 안에는 글자가 없다(회로도 기호도 쓰지 않는다). 전지 (+)극 쪽 전선은 오른쪽, (−)극 쪽 전선은 왼쪽에 있어 서로 걸치지 않는다.
export const CW = 240;
export const CH = 232;
/** 전구의 가운데 x */
export const BX = 120;
/** 전구 유리 */
export const GLASS = { cx: BX, cy: 66, r: 26 };
/** 전구 옆면 쇠붙이(나사 모양)와 꼭지 */
export const THREAD = { x: BX - 12, y: 100, w: 24, h: 22 };
export const TIP = { x: BX - 6, y: 122, w: 12, h: 8 };
/** 전선이 옆면과 꼭지에 닿는 자리 */
export const SIDE_Y = 111;
export const TIP_Y = TIP.y + TIP.h + 1;
const LANE_Y = 146;
const LOOSE_Y = 150;
/** 전지 끼우개 */
const HOLDER_Y = 190;
const CELL_W = 56;
const TERMINAL_Y = HOLDER_Y + 16;
/** 스위치(왼쪽 위 접점 y와 아래 접점 y) */
const SW_TOP = 168;
const SW_BOTTOM = 184;

export const WIRE_FILL: Record<BlWire, string> = { red: '#c62828', black: '#111827' };
/** 선 둘레의 밝은 테두리: 어두운 화면에서도 검은 전선이 보이게 한다. */
const WIRE_HALO = '#e2e8f0';
const BULB_LIT = '#fde047';
const BULB_OFF = '#f1f5f9';

/** 불빛 둘레 원의 반지름: 밝기 눈금(0~10)에 따라 커진다. */
export const glowRadius = (level: number) => GLASS.r + 2 + Math.min(10, Math.max(0, level)) * 3.4;

export interface CircuitProps {
  cells: BsCells;
  plusEnd: BlEnd;
  minusEnd: BlEnd;
  closed: boolean;
  wire: BlWire;
  /** 지금 순간의 밝기 눈금 */
  level: number;
  /** 실행한 뒤에만 불빛을 그린다. */
  ran: boolean;
}

/** 전선 하나가 지나가는 점들(전지 끝 → 전구). 끝이 'none'이면 전구에 닿기 전에 멈춘다. */
export function wirePoints(side: 'plus' | 'minus', end: BlEnd, x: number): [number, number][] {
  const sign = side === 'plus' ? 1 : -1;
  if (end === 'tip') return [[x, LANE_Y], [BX + sign * 4, LANE_Y], [BX + sign * 4, TIP_Y]];
  if (end === 'side') return [[x, SIDE_Y], [BX + sign * (THREAD.w / 2 + 1), SIDE_Y]];
  return [[x, LOOSE_Y]];
}

/** 시작점에서 점들을 차례로 잇는 path 문자열 */
export const pathFrom = (start: [number, number], pts: [number, number][]) => `M${start[0]},${start[1]} ${pts.map(([x, y]) => `L${x},${y}`).join(' ')}`;

function Wire({ d, color, testid, end }: { d: string; color: string; testid?: string; end?: [number, number] }) {
  return (
    <g data-testid={testid}>
      <path d={d} fill="none" stroke={WIRE_HALO} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {end && <circle cx={end[0]} cy={end[1]} r="4.5" fill={color} stroke={WIRE_HALO} strokeWidth="1.5" />}
    </g>
  );
}

/** 극 표시(그림): 더하기는 가로·세로 선, 빼기는 가로 선 하나 */
function Mark({ x, y, plus }: { x: number; y: number; plus: boolean }) {
  return (
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" data-mark={plus ? 'plus' : 'minus'}>
      <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
      {plus && <line x1={x} y1={y - 5} x2={x} y2={y + 5} />}
    </g>
  );
}

export function BulbCircuit({ cells, plusEnd, minusEnd, closed, wire, level, ran }: CircuitProps) {
  const n = cells === 'one' ? 1 : 2;
  const holderW = n * CELL_W + 8;
  const x0 = BX - holderW / 2;
  const minusX = x0 - 8;
  const plusX = x0 + holderW + 8;
  const color = WIRE_FILL[wire];
  const lit = ran && level > 0.05;
  const plusPts = wirePoints('plus', plusEnd, plusX);
  const minusPts = wirePoints('minus', minusEnd, minusX);
  const plusEndPt = plusPts[plusPts.length - 1]!;
  const minusEndPt = minusPts[minusPts.length - 1]!;

  return (
    <g data-testid="circuit-art" data-cells={cells} data-plus={plusEnd} data-minus={minusEnd} data-switch={closed ? 'closed' : 'open'} data-wire={wire} data-level={level.toFixed(2)}>
      {/* 불빛 둘레(실행한 뒤에만) */}
      {ran && (
        <circle data-testid="bulb-glow" data-level={level.toFixed(2)} cx={GLASS.cx} cy={GLASS.cy} r={glowRadius(level)} fill={BULB_LIT} fillOpacity={(Math.min(10, level) / 10) * 0.55} />
      )}
      {/* 맨 전구: 유리, 필라멘트, 옆면 쇠붙이, 꼭지 */}
      <g data-testid="bulb" data-lit={lit ? 'true' : 'false'} stroke="#374151" strokeWidth="1.5">
        <circle cx={GLASS.cx} cy={GLASS.cy} r={GLASS.r} fill={lit ? BULB_LIT : BULB_OFF} />
        <rect x={BX - 8} y={GLASS.cy + GLASS.r - 2} width="16" height="14" fill={lit ? BULB_LIT : BULB_OFF} />
        <polyline points={`${BX - 11},${GLASS.cy + 12} ${BX - 7},${GLASS.cy - 2} ${BX},${GLASS.cy + 10} ${BX + 7},${GLASS.cy - 2} ${BX + 11},${GLASS.cy + 12}`} fill="none" stroke={lit ? '#92400e' : '#64748b'} strokeWidth="2" />
        <rect data-testid="bulb-side" x={THREAD.x} y={THREAD.y} width={THREAD.w} height={THREAD.h} fill="#94a3b8" />
        {[106, 111, 116].map((y) => <line key={y} x1={THREAD.x} y1={y} x2={THREAD.x + THREAD.w} y2={y} stroke="#475569" strokeWidth="1" />)}
        <rect data-testid="bulb-tip" x={TIP.x} y={TIP.y} width={TIP.w} height={TIP.h} rx="3" fill="#64748b" />
      </g>
      {/* 전지 끼우개와 전지(한 줄). 반대로 넣은 전지는 불룩한 쪽과 극 표시가 뒤집힌다. */}
      <g data-testid="battery-holder" data-cells={n}>
        <rect x={x0} y={HOLDER_Y} width={holderW} height="32" rx="6" fill="#cbd5e1" stroke="currentColor" strokeWidth="2" />
        {Array.from({ length: n }, (_, i) => {
          const c0 = x0 + 4 + i * CELL_W;
          const flipped = cells === 'reversed' && i === 1;
          const plusSide = flipped ? 'left' : 'right';
          const bodyX = c0 + 5;
          const nubX = plusSide === 'right' ? c0 + 51 : c0;
          const plusX2 = plusSide === 'right' ? c0 + 42 : c0 + 14;
          const minusX2 = plusSide === 'right' ? c0 + 14 : c0 + 42;
          return (
            <g key={i} data-testid="cell" data-plus-side={plusSide}>
              <rect x={bodyX} y={HOLDER_Y + 5} width="46" height="22" rx="3" fill="#fef3c7" stroke="#374151" strokeWidth="1.5" />
              <rect x={nubX} y={HOLDER_Y + 11} width="5" height="10" fill="#64748b" stroke="#374151" strokeWidth="1" />
              <g color="#1f2937">
                <Mark x={plusX2} y={HOLDER_Y + 16} plus />
                <Mark x={minusX2} y={HOLDER_Y + 16} plus={false} />
              </g>
            </g>
          );
        })}
        <line x1={x0 + holderW} y1={TERMINAL_Y} x2={plusX} y2={TERMINAL_Y} stroke="#64748b" strokeWidth="3" />
        <line x1={minusX} y1={TERMINAL_Y} x2={x0} y2={TERMINAL_Y} stroke="#64748b" strokeWidth="3" />
      </g>
      {/* 전선 두 가닥. (+)극 쪽 전선에는 스위치가 있다. */}
      <Wire testid="wire-minus" d={pathFrom([minusX, TERMINAL_Y], minusPts)} color={color} end={minusEndPt} />
      <g data-testid="wire-plus" data-end={plusEnd}>
        <Wire d={`M${plusX},${TERMINAL_Y} L${plusX},${SW_BOTTOM}`} color={color} />
        <Wire d={pathFrom([plusX, SW_TOP], plusPts)} color={color} end={plusEndPt} />
      </g>
      <g data-testid="switch" data-state={closed ? 'closed' : 'open'} stroke="#374151" strokeWidth="1.5">
        <rect x={plusX - 11} y={SW_TOP - 6} width="22" height={SW_BOTTOM - SW_TOP + 12} rx="4" fill="#cbd5e1" fillOpacity="0.6" />
        <circle cx={plusX} cy={SW_BOTTOM} r="3.5" fill="#475569" />
        <circle cx={plusX} cy={SW_TOP} r="3.5" fill="#475569" />
        <line data-testid="switch-lever" x1={plusX} y1={SW_BOTTOM} x2={closed ? plusX : plusX + 18} y2={closed ? SW_TOP : SW_TOP + 3} stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
      </g>
    </g>
  );
}
