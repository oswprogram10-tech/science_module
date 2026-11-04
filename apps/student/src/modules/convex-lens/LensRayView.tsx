import { FOCUS_CM, traceRay, type ConvexLensSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { optionLabel } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const AX = 52; // 거리 축의 x
const CX = 146; // 광축의 x
const LENS_Y = 40;
/** 1 cm = 11 px. 가로(렌즈 지름)와 세로(거리)에 같은 비율을 쓴다. */
const CM_PX = 11;
const TICKS = [0, 5, 10, 15, 20];
const TAIL_CM = 22; // 종이를 지난 뒤 흐리게 그리는 끝 거리
const RAY_COUNT = 7;
const RAY_COLOR = '#d98a00';

const mmPx = (mm: number) => (mm / 10) * CM_PX;
const yOf = (cm: number) => LENS_Y + cm * CM_PX;

/** 렌즈 가운데 위에서 아래로 7개 광선의 높이(mm). 가장 바깥 광선이 렌즈 가장자리. */
export const rayHeights = (diameterCm: number): number[] =>
  Array.from({ length: RAY_COUNT }, (_, i) => ((i / (RAY_COUNT - 1)) * 2 - 1) * diameterCm * 5);

export function LensRayView({ experiment, values }: ViewProps<ConvexLensSample>) {
  const d = Number(values.distanceCm);
  const dia = Number(values.diameterCm);
  const curve = values.curve === 'low' ? 'low' : 'high';
  const f = FOCUS_CM[curve];
  const heights = rayHeights(dia);
  const lensR = mmPx(dia * 5);
  const bulge = curve === 'high' ? 14 : 7;
  const paperY = yOf(d);
  const outerMm = Math.abs(traceRay(dia * 5, f, d).xAtPaperMm);
  const halfW = Math.max(1.5, mmPx(outerMm));
  const focusY = yOf(f);
  const curveLabel = optionLabel(experiment, 'curve', values.curve);
  const text = { fontSize: 14, fill: 'currentColor' } as const;
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;

  return (
    <figure className="view ray" aria-label="빛의 길로 보기">
      <figcaption>빛의 길로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} 292`}
        role="img"
        aria-label={`빛의 길: ${curveLabel}, 지름 ${dia} cm, 종이는 렌즈에서 ${d} cm, 종이에 닿는 빛의 폭 ${(2 * outerMm).toFixed(1)} mm`}
      >
        {/* 거리 축 */}
        <line x1={AX} y1={LENS_Y} x2={AX} y2={yOf(20)} stroke="currentColor" strokeWidth="1" />
        {TICKS.map((cm) => (
          <g key={cm}>
            <line x1={AX - 4} y1={yOf(cm)} x2={AX + 4} y2={yOf(cm)} stroke="currentColor" strokeWidth="1" />
            <text x={AX - 7} y={yOf(cm) + 5} textAnchor="end" {...text}>{cm === 0 ? '0' : cm === 20 ? '20 cm' : cm}</text>
          </g>
        ))}
        {/* 광축 */}
        <line x1={CX} y1="8" x2={CX} y2={yOf(TAIL_CM)} stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.5" />

        {/* 위에서 들어오는 평행 광선 */}
        <g stroke={RAY_COLOR} strokeWidth="1.6">
          {heights.map((h) => (
            <line key={h} x1={CX + mmPx(h)} y1="10" x2={CX + mmPx(h)} y2={LENS_Y} />
          ))}
        </g>
        {/* 렌즈에서 꺾여 종이까지: traceRay로 계산한 직선 */}
        <g stroke={RAY_COLOR} strokeWidth="1.6" data-testid="rays">
          {heights.map((h) => (
            <line key={h} x1={CX + mmPx(h)} y1={LENS_Y} x2={CX + mmPx(traceRay(h, f, d).xAtPaperMm)} y2={paperY} />
          ))}
        </g>
        {/* 종이를 지나는 부분은 흐리게 */}
        <g stroke={RAY_COLOR} strokeWidth="1.6" strokeDasharray="3 3" opacity="0.3">
          {heights.map((h) => (
            <line key={h} x1={CX + mmPx(traceRay(h, f, d).xAtPaperMm)} y1={paperY} x2={CX + mmPx(traceRay(h, f, TAIL_CM).xAtPaperMm)} y2={yOf(TAIL_CM)} />
          ))}
        </g>

        {/* 렌즈 */}
        <path
          d={`M${CX - lensR} ${LENS_Y} Q${CX} ${LENS_Y - bulge} ${CX + lensR} ${LENS_Y} Q${CX} ${LENS_Y + bulge} ${CX - lensR} ${LENS_Y} Z`}
          fill="#bfe3f7"
          fillOpacity="0.85"
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* 빛이 한곳에 모이는 곳 */}
        <text x={CX} y={focusY + 6} textAnchor="middle" fontSize="18" fill="#c2410c" aria-hidden="true" data-testid="meet-star" {...halo}>★</text>
        {/* 라벨은 광선 오른쪽에 둔다. 종이와 가까우면 겹치지 않게 위로 올린다. */}
        <text x={CX + 14} y={Math.abs(focusY - paperY) < 34 ? focusY - 34 : focusY - 4} textAnchor="start" {...text} {...halo}>
          <tspan x={CX + 14}>{'빛이 한곳에 '}</tspan>
          <tspan x={CX + 14} dy="15">모이는 곳</tspan>
        </text>

        {/* 종이 */}
        <line x1={CX - 50} y1={paperY} x2={CX + 50} y2={paperY} stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <text x={CX + 56} y={paperY + 5} {...text} {...halo}>종이</text>
        {/* 종이에 닿는 광선 폭: 양쪽 꺾쇠 */}
        <path
          data-testid="ray-width"
          d={`M${CX - halfW} ${paperY + 8} v7 H${CX + halfW} v-7`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
      <p className="view-note">빛은 렌즈를 지나면서 꺾여요.</p>
    </figure>
  );
}
