import type { SunAngleSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { BELOW_HORIZON_DEG, clockText, noonSample } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 240;
const BOARD_L = 8;
const BOARD_R = 232;
const GROUND_Y = 196;
const BASE_X = 88;
/** 막대와 그림자 길이의 그림 배율(px/cm) */
const PX_PER_CM = 4;
const SUN_R = 64;
const ARC_R = 24;
const RAD = Math.PI / 180;

/** 아래 문구 */
export function sunNote(s: SunAngleSample): string {
  const time = clockText(s.t);
  if (s.sunAltDeg < BELOW_HORIZON_DEG) return `${time} · 태양이 지평선 아래에 있어요`;
  const shadow = s.shadowCm < 0 ? '그림자가 아주 길어요' : `그림자 ${s.shadowCm.toFixed(1)} cm`;
  return `${time} · 태양 고도 ${s.sunAltDeg.toFixed(1)}° · ${shadow}`;
}

export function SunMacroView({ experiment, snapshot, values }: ViewProps<SunAngleSample>) {
  const s = snapshot ?? noonSample(values, experiment);
  const stickCm = Number(values.stickCm);
  const stickPx = stickCm * PX_PER_CM;
  const tipX = BASE_X;
  const tipY = GROUND_Y - stickPx;
  const alt = s.sunAltDeg;
  const day = alt >= BELOW_HORIZON_DEG;
  const a = alt * RAD;
  const long = s.shadowCm < 0;
  const maxShadowPx = BOARD_R - BASE_X;
  const clipped = long || s.shadowCm * PX_PER_CM > maxShadowPx;
  const shadowPx = clipped ? maxShadowPx : s.shadowCm * PX_PER_CM;
  // 막대 끝에서 그림자 끝까지 이은 빛의 길. 판 끝에서 잘리면 실제 기울기대로 판 끝 위치까지만 그린다.
  const rayEndX = BASE_X + shadowPx;
  const rayEndY = clipped ? Math.min(GROUND_Y, tipY + shadowPx * Math.tan(a)) : GROUND_Y;
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;
  const note = sunNote(s);
  const half = (alt / 2) * RAD;

  return (
    <figure className="view sun-stick" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`태양 고도 측정기: 막대 ${stickCm} cm, ${note}`}>
        {/* 평평한 판 */}
        <rect x={BOARD_L} y={GROUND_Y} width={BOARD_R - BOARD_L} height="14" rx="3" fill="#d6c7a1" stroke="#8a7a4f" strokeWidth="1.5" />

        {day && (
          <g data-testid="sun-light" data-alt={alt.toFixed(1)}>
            {/* 그림자 */}
            <line data-testid="shadow" data-clipped={clipped ? 'true' : 'false'} x1={BASE_X} y1={GROUND_Y} x2={BASE_X + shadowPx} y2={GROUND_Y} stroke="currentColor" strokeOpacity="0.55" strokeWidth="6" />
            {/* 막대 끝과 그림자 끝을 잇는 선(빛의 길) */}
            <line x1={tipX} y1={tipY} x2={rayEndX} y2={rayEndY} stroke="#d97706" strokeWidth="2" strokeDasharray="4 3" />
            {/* 태양은 막대 끝에서 고도각 방향 위쪽에 놓는다 */}
            <line x1={tipX} y1={tipY} x2={tipX - SUN_R * Math.cos(a)} y2={tipY - SUN_R * Math.sin(a)} stroke="#d97706" strokeWidth="2" />
            <circle data-testid="sun" cx={tipX - SUN_R * Math.cos(a)} cy={tipY - SUN_R * Math.sin(a)} r="10" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
            {/* 고도각 */}
            <line x1={tipX} y1={tipY} x2={tipX - 38} y2={tipY} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3" />
            <path d={`M${tipX - ARC_R} ${tipY} A${ARC_R} ${ARC_R} 0 0 1 ${tipX - ARC_R * Math.cos(a)} ${tipY - ARC_R * Math.sin(a)}`} fill="none" stroke="currentColor" strokeWidth="2" />
            <text x={tipX - 40 * Math.cos(half)} y={tipY - 40 * Math.sin(half) + 5} textAnchor="middle" fontSize="14" fill="currentColor" {...halo}>
              {alt.toFixed(1)}°
            </text>
          </g>
        )}

        {/* 막대 */}
        <line data-testid="stick" x1={BASE_X} y1={GROUND_Y} x2={tipX} y2={tipY} stroke="#b45309" strokeWidth="5" strokeLinecap="round" />

        {day && clipped && (
          <text x={BOARD_R} y={GROUND_Y - 10} textAnchor="end" fontSize="14" fill="currentColor" {...halo}>→ 더 길어요</text>
        )}
        <text x={BASE_X} y="232" textAnchor="middle" fontSize="14" fill="currentColor">막대 {stickCm} cm</text>
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
