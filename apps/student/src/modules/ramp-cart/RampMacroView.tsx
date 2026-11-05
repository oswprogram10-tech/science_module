import type { CartLoad, FloorKind, RampSample } from '@sci/engine-physics';
import { FINISH_M, WALL_M } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { FLOOR_TEXT, LOAD_TEXT, rampNote, rampOutput, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 206;
/** 출발선(0 m)의 x. 1 m = PX_PER_M 그림 단위 */
export const X0 = 64;
export const PX_PER_M = 100;
/** 바닥 윗면의 y와 바닥 띠의 두께 */
export const FLOOR_Y = 140;
const BAND_H = 16;
/** 경사면: 위쪽 끝의 x, 1 cm = CM_PX 그림 단위 */
const RAMP_X = 14;
const CM_PX = 1.5;
/** 수레 */
export const CART_W = 26;
const CART_H = 11;
const WHEEL_R = 3.5;
/** 잔상 점의 간격(초) */
export const GHOST_EVERY_S = 0.1;

export const xOf = (m: number) => X0 + m * PX_PER_M;

/** 눈금 0·0.5·1·1.5 m */
const TICKS = [0, 0.5, 1, 1.5] as const;

function Cart({ load, ramp }: { load: CartLoad; ramp?: boolean }) {
  // 원점 = 수레 바닥 가운데(바퀴 아래). 위쪽이 −y.
  return (
    <g data-testid="cart" data-load={load} data-on-ramp={ramp ? 'true' : 'false'}>
      <rect x={-CART_W / 2} y={-2 * WHEEL_R - CART_H + 3} width={CART_W} height={CART_H} rx="2" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1.5" />
      <circle cx={-CART_W / 2 + 6} cy={-WHEEL_R} r={WHEEL_R} fill="#475569" stroke="currentColor" strokeWidth="1" />
      <circle cx={CART_W / 2 - 6} cy={-WHEEL_R} r={WHEEL_R} fill="#475569" stroke="currentColor" strokeWidth="1" />
      {load === 2 &&
        [-6, 6].map((dx) => (
          <rect key={dx} data-testid="cart-weight" x={dx - 4.5} y={-2 * WHEEL_R - CART_H + 3 - 9} width="9" height="9" rx="1" fill="#6b7280" stroke="#111827" strokeWidth="1.5" />
        ))}
    </g>
  );
}

function Floor({ floor }: { floor: FloorKind }) {
  const x1 = xOf(WALL_M) + 12;
  if (floor === 'wood') {
    return (
      <g data-testid="floor" data-floor="wood">
        <rect x={X0} y={FLOOR_Y} width={x1 - X0} height={BAND_H} fill="#d9b382" stroke="#7c5a2a" strokeWidth="1.5" />
        {/* 나무 결: 가는 가로줄 */}
        {[4, 8, 12].map((dy, i) => (
          <path key={dy} d={`M${X0 + 6 + i * 22} ${FLOOR_Y + dy} H${x1 - 8 - ((i * 17) % 40)}`} stroke="#7c5a2a" strokeWidth="1" fill="none" />
        ))}
        {[X0 + 52, X0 + 118].map((cx) => (
          <ellipse key={cx} cx={cx} cy={FLOOR_Y + 8} rx="5" ry="2.2" fill="none" stroke="#7c5a2a" strokeWidth="1" />
        ))}
      </g>
    );
  }
  // 수건: 굵은 세로 줄무늬와 아래쪽 술 장식
  const stripes: number[] = [];
  for (let x = X0; x < x1 - 8; x += 16) stripes.push(x);
  return (
    <g data-testid="floor" data-floor="towel">
      <rect x={X0} y={FLOOR_Y} width={x1 - X0} height={BAND_H} fill="#e8f1fa" stroke="#1e5a8a" strokeWidth="1.5" />
      {stripes.map((x) => (
        <rect key={x} x={x + 8} y={FLOOR_Y} width="8" height={BAND_H} fill="#7fb2e0" />
      ))}
      <rect x={X0} y={FLOOR_Y} width={x1 - X0} height={BAND_H} fill="none" stroke="#1e5a8a" strokeWidth="1.5" />
      {Array.from({ length: Math.floor((x1 - X0) / 4) }, (_, i) => (
        <line key={i} x1={X0 + 2 + i * 4} y1={FLOOR_Y + BAND_H} x2={X0 + 2 + i * 4} y2={FLOOR_Y + BAND_H + 4} stroke="#1e5a8a" strokeWidth="1" />
      ))}
    </g>
  );
}

export function RampMacroView({ experiment, snapshot, values }: ViewProps<RampSample>) {
  const { heightCm, floor, load } = toParams(values);
  const ran = snapshot !== null;
  const s = snapshot ?? startSample(values, experiment);
  const note = ran ? rampNote(s, values, experiment) : `수레를 ${heightCm} cm 높이에서 놓아요`;
  const hPx = heightCm * CM_PX;
  const topY = FLOOR_Y - hPx;
  // 경사면의 기울기(도)와, 실험 전에 수레를 올려 두는 자리(위쪽 끝에서 비탈을 따라 조금 내려온 곳)
  const slope = Math.atan2(hPx, X0 - RAMP_X);
  const slopeDeg = (slope * 180) / Math.PI;
  const along = 20;
  const rampPt: [number, number] = [RAMP_X + along * Math.cos(slope), topY + along * Math.sin(slope)];

  // 잔상: 0.1초마다 수레가 있던 자리. 지금 자리보다 뒤에 있고 서로 겹치지 않는 것만 그린다.
  const ghosts: number[] = [];
  if (ran) {
    const all = rampOutput(values, experiment).samples;
    let last = -Infinity;
    for (let k = 0; k * GHOST_EVERY_S <= s.t + 1e-9; k++) {
      const g = all.find((p) => Math.abs(p.t - k * GHOST_EVERY_S) < 1e-6);
      if (!g) break;
      if (g.x < s.x - 0.02 && g.x - last > 0.005) {
        ghosts.push(g.x);
        last = g.x;
      }
    }
  }
  const cartCx = xOf(s.x) - CART_W / 2;

  return (
    <figure className="view ramp-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`경사면 ${heightCm} cm 높이에서 놓는 수레: 바닥 ${FLOOR_TEXT[floor]}, 추 ${LOAD_TEXT[load]}, ${note}`}
      >
        <text x={W / 2} y="16" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">느린 화면</text>

        {/* 출발선·도착선·멈춤 벽 이름 */}
        <text x={X0} y="36" textAnchor="middle" fontSize="14" fill="currentColor">출발선</text>
        <text x={xOf(FINISH_M)} y="36" textAnchor="middle" fontSize="14" fill="currentColor">도착</text>
        <text x={W - 2} y="36" textAnchor="end" fontSize="14" fill="currentColor">멈춤 벽</text>
        <line data-testid="start-line" x1={X0} y1="42" x2={X0} y2={FLOOR_Y + BAND_H} stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />

        {/* 경사면: 얇은 판과 다리. 높이를 재는 치수선과 숫자 */}
        <line x1={RAMP_X} y1={topY} x2={RAMP_X} y2={FLOOR_Y} stroke="#7c5a2a" strokeWidth="4" />
        <line data-testid="ramp" data-height={heightCm} x1={RAMP_X} y1={topY} x2={X0} y2={FLOOR_Y} stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
        <g stroke="currentColor" strokeWidth="1.5" fill="none">
          <line x1="6" y1={topY} x2="6" y2={FLOOR_Y} />
          <line x1="3" y1={topY} x2="9" y2={topY} />
          <line x1="3" y1={FLOOR_Y} x2="9" y2={FLOOR_Y} />
        </g>
        <text data-testid="ramp-height" x="18" y={topY - 8} fontSize="14" fill="currentColor">{heightCm} cm</text>
        <line x1="4" y1={FLOOR_Y} x2={X0} y2={FLOOR_Y} stroke="currentColor" strokeWidth="1.5" opacity="0.6" />

        {/* 바닥(나무 결 또는 수건 줄무늬) */}
        <Floor floor={floor} />

        {/* 도착선: 깃발 */}
        <g data-testid="finish-flag">
          <line x1={xOf(FINISH_M)} y1="42" x2={xOf(FINISH_M)} y2={FLOOR_Y} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
          <line x1={xOf(FINISH_M)} y1={FLOOR_Y - 40} x2={xOf(FINISH_M)} y2={FLOOR_Y} stroke="currentColor" strokeWidth="2" />
          <path d={`M${xOf(FINISH_M)} ${FLOOR_Y - 40} L${xOf(FINISH_M) + 18} ${FLOOR_Y - 33} L${xOf(FINISH_M)} ${FLOOR_Y - 26} Z`} fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" strokeLinejoin="round" />
        </g>

        {/* 멈춤 벽: 푹신한 벽 */}
        <g data-testid="wall">
          <rect x={xOf(WALL_M)} y={FLOOR_Y - 34} width="12" height="34" rx="3" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          {[8, 18, 28].map((dy) => (
            <path key={dy} d={`M${xOf(WALL_M) + 1} ${FLOOR_Y - 34 + dy} l10 -6`} stroke="#92400e" strokeWidth="1.5" fill="none" />
          ))}
        </g>

        {/* 눈금 0·0.5·1·1.5 (단위 m는 끝에 한 번) */}
        {TICKS.map((m) => (
          <g key={m} data-testid="ramp-tick">
            <line x1={xOf(m)} y1={FLOOR_Y + BAND_H} x2={xOf(m)} y2={FLOOR_Y + BAND_H + 5} stroke="currentColor" strokeWidth="1.5" />
            <text x={xOf(m)} y={FLOOR_Y + BAND_H + 21} textAnchor="middle" fontSize="14" fill="currentColor">{m}</text>
          </g>
        ))}
        <text x={xOf(WALL_M) + 14} y={FLOOR_Y + BAND_H + 21} fontSize="14" fill="currentColor">m</text>

        {/* 잔상 점: 0.1초마다 수레가 있던 자리(간격이 넓을수록 빠르다) */}
        {ghosts.map((gx, i) => (
          <circle key={i} data-testid="ghost" cx={xOf(gx) - CART_W / 2} cy={FLOOR_Y - WHEEL_R * 2 - CART_H / 2 + 3} r="2.6" fill="#2563eb" fillOpacity="0.55" stroke="#1e3a8a" strokeWidth="1" />
        ))}

        {/* 수레: 실험 전에는 경사면 위, 시작하면 바닥 위 */}
        {ran ? (
          <g data-testid="cart-pos" data-x={s.x.toFixed(3)} transform={`translate(${cartCx} ${FLOOR_Y})`}>
            <Cart load={load} />
          </g>
        ) : (
          <g data-testid="cart-pos" data-x="0.000" transform={`translate(${rampPt[0]} ${rampPt[1] - 3}) rotate(${slopeDeg})`}>
            <Cart load={load} ramp />
          </g>
        )}

        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="14" fill="currentColor">바닥: {FLOOR_TEXT[floor]} · 추: {LOAD_TEXT[load]}</text>
      </svg>
      <p className="view-note" data-testid="ramp-note">{note}</p>
    </figure>
  );
}
