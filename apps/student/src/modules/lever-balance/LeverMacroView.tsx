import type { LeverSample, WeightShape } from '@sci/engine-physics';
import { THETA_MAX } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { SHAPE_TEXT, SIDE_NOTE, shapeOf, sideOfAngle, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 204;
const CX = 120;
/** 받침점 높이(막대가 수평일 때 막대의 y) */
const PIVOT_Y = 84;
/** 눈금 한 칸의 폭(그림 단위). 막대 반길이 9칸 = 108 */
export const CELL = 12;
/** 멈춤 받침 윗면 y: 받침점 높이 10 cm = 24 (1 cm = 2.4). 오른쪽 끝의 높이는 여기서부터 잰다. */
const FLOOR_Y = PIVOT_Y + 24;
/** 탁자(바닥) 선 y: 기울어진 쪽에 추 4개가 가장 낮게 매달려도(약 y 160) 그 아래에 있다. */
const TABLE_Y = 174;
const MAX_DEG = (THETA_MAX * 180) / Math.PI;
/** 멈춤 받침의 x(막대가 θmax로 기울었을 때 끝의 x) */
const STOP_DX = 9 * CELL * Math.cos((MAX_DEG * Math.PI) / 180);
/** 추 하나의 높이와 실 길이 */
const WEIGHT_H = 11;
const STRING = 7;
const LEFT = { count: 2, distance: 4 } as const;

/** 아래 문구 */
export function leverNote(s: LeverSample): string {
  return `기울어진 쪽: ${SIDE_NOTE[sideOfAngle(s.angleDeg)]} · 오른쪽 끝 높이 ${Math.round(s.rightHeightCm)} cm`;
}

/** 막대 위 받침점에서 u칸(오른쪽이 +) 떨어진 점의 화면 좌표. angleDeg는 오른쪽이 내려가면 +. */
export function barPoint(u: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + u * CELL * Math.cos(a), PIVOT_Y + u * CELL * Math.sin(a)];
}

function Weight({ x, y, shape }: { x: number; y: number; shape: WeightShape }) {
  // (x, y)는 추의 위 가운데
  return shape === 'cylinder' ? (
    <g data-testid="weight" data-shape="cylinder">
      <rect x={x - 6} y={y} width="12" height={WEIGHT_H} fill="#9db4cc" stroke="#33506d" strokeWidth="1.5" />
      <ellipse cx={x} cy={y} rx="6" ry="2.4" fill="#c9d8e6" stroke="#33506d" strokeWidth="1.5" />
    </g>
  ) : (
    <g data-testid="weight" data-shape="cube">
      <rect x={x - 6} y={y} width="12" height={WEIGHT_H} fill="#e0b98a" stroke="#6b4a1f" strokeWidth="1.5" />
      <path d={`M${x - 6} ${y} l3 -3 h12 l-3 3 z`} fill="#f1d9b8" stroke="#6b4a1f" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  );
}

/** 막대에서 u칸 떨어진 자리에 실을 연직으로 내리고 추 n개를 아래로 겹쳐 매단다. */
function Hanger({ u, n, angleDeg, shape, side }: { u: number; n: number; angleDeg: number; shape: WeightShape; side: 'left' | 'right' }) {
  const [x, y] = barPoint(u, angleDeg);
  const top = y + 3;
  return (
    <g data-testid="hanger" data-side={side} data-count={n}>
      <line x1={x} y1={top} x2={x} y2={top + STRING} stroke="#1d2733" strokeWidth="1.5" />
      {Array.from({ length: n }, (_, i) => (
        <Weight key={i} x={x} y={top + STRING + i * WEIGHT_H} shape={shape} />
      ))}
    </g>
  );
}

export function LeverMacroView({ experiment, snapshot, values }: ViewProps<LeverSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const { count, distance } = toParams(values);
  const shape = shapeOf(values);
  const angle = s.angleDeg;
  const note = leverNote(s);
  const touching = Math.abs(angle) >= MAX_DEG - 1e-6;
  const endU = touching ? (angle > 0 ? 9 : -9) : 0;
  const [tx, ty] = barPoint(endU, angle);

  return (
    <figure className="view lever-bar" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`받침점에 올린 막대: 왼쪽 4칸에 추 2개, 오른쪽 ${distance}칸에 ${SHAPE_TEXT[shape]} 추 ${count}개, ${note}`}
      >
        <text x={CX} y="16" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">느린 화면</text>

        {/* 탁자(바닥) */}
        <rect x="4" y={TABLE_Y} width={W - 8} height="8" fill="#94a3b8" fillOpacity="0.35" />
        <line data-testid="floor" x1="4" y1={TABLE_Y} x2={W - 4} y2={TABLE_Y} stroke="#64748b" strokeWidth="2" />

        {/* 멈춤 받침: 윗면이 기울어진 막대 끝이 멈추는 높이 */}
        {[-1, 1].map((d) => (
          <rect key={d} data-testid="stopper" x={CX + d * STOP_DX - 5} y={FLOOR_Y} width="10" height={TABLE_Y - FLOOR_Y} fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
        ))}

        {/* 받침점: 탁자 위에 선 기둥 */}
        <path data-testid="pivot" d={`M${CX} ${PIVOT_Y + 3} L${CX - 13} ${TABLE_Y} L${CX + 13} ${TABLE_Y} Z`} fill="#cbd5e1" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />

        {/* 막대와 눈금: angleDeg만큼 받침점을 중심으로 돌린다 */}
        <g data-testid="bar" data-angle={angle.toFixed(2)} transform={`rotate(${angle} ${CX} ${PIVOT_Y})`}>
          <rect x={CX - 9 * CELL} y={PIVOT_Y - 3} width={18 * CELL} height="6" rx="1.5" fill="#d6b27c" stroke="#7c5a2a" strokeWidth="1.5" />
          {Array.from({ length: 17 }, (_, i) => i - 8).map((u) =>
            u === 0 ? null : (
              <g key={u}>
                <line x1={CX + u * CELL} y1={PIVOT_Y - 3} x2={CX + u * CELL} y2={PIVOT_Y - 8} stroke="#7c5a2a" strokeWidth="1.5" />
                <text data-testid="tick" x={CX + u * CELL} y={PIVOT_Y - 11} textAnchor="middle" fontSize="14" fill="currentColor">{Math.abs(u)}</text>
              </g>
            ),
          )}
        </g>
        <circle cx={CX} cy={PIVOT_Y} r="3" fill="#475569" />

        {/* 추: 막대가 기울어도 실은 연직으로 내려간다 */}
        <Hanger u={-LEFT.distance} n={LEFT.count} angleDeg={angle} shape={shape} side="left" />
        <Hanger u={distance} n={count} angleDeg={angle} shape={shape} side="right" />

        {/* 끝이 멈춤 받침에 닿았다는 표시 */}
        {touching && (
          <g data-testid="touch-mark" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
            <circle cx={tx} cy={ty} r="6" fill="none" />
            <line x1={tx} y1={ty - 10} x2={tx} y2={ty - 15} />
            <line x1={tx - 9} y1={ty - 7} x2={tx - 13} y2={ty - 11} />
            <line x1={tx + 9} y1={ty - 7} x2={tx + 13} y2={ty - 11} />
          </g>
        )}

        <text x={CX - 4 * CELL} y="38" textAnchor="middle" fontSize="14" fill="currentColor">왼쪽</text>
        <text x={CX + 4 * CELL} y="38" textAnchor="middle" fontSize="14" fill="currentColor">오른쪽</text>
        <text x={CX} y={H - 6} textAnchor="middle" fontSize="14" fill="currentColor">추: {SHAPE_TEXT[shape]}</text>
      </svg>
      <p className="view-note" data-testid="lever-note">{note}</p>
      <p className="view-note">높이는 멈춤 받침 윗면에서 잰 값이에요.</p>
    </figure>
  );
}
