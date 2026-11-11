import type { ConcCup, ConcentrationSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { CUP_TEXT, SUGAR_TEXT, clamp01, concNote, concResult, mixLine, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 214;
export const GROUND_Y = 196;
export const TOMATO_R = 9;
/** 비커 모양: 낮은 비커는 넓고 낮고, 높은 비커는 좁고 높다. 안쪽 바닥은 GROUND_Y - 4 */
export const BEAKER: Record<ConcCup, { x0: number; x1: number; top: number }> = {
  low: { x0: 78, x1: 188, top: 92 },
  high: { x0: 100, x1: 168, top: 52 },
};
/** 물의 양에 따른 물 높이(비커 안쪽 높이에 대한 비): 100 mL = 0.8, 50 mL = 0.4 */
export const WATER_FRACTION = (waterMl: number) => (waterMl >= 100 ? 0.8 : 0.4);
/** 물이 비어 있을 때와 가장 진할 때의 용액 색 */
const PLAIN: [number, number, number] = [207, 232, 247];
const AMBER: [number, number, number] = [196, 120, 28];

export const liquidFill = (color: number): string => {
  const k = clamp01(color / 10);
  const [r, g, b] = PLAIN.map((c, i) => Math.round(c + (AMBER[i]! - c) * k));
  return `rgb(${r}, ${g}, ${b})`;
};

/** 비커 안쪽 바닥(y), 물 높이와 물 윗면(y) */
export const liquidBox = (cup: ConcCup, waterMl: number) => {
  const b = BEAKER[cup];
  const bottom = GROUND_Y - 4;
  const inner = bottom - b.top;
  const h = inner * WATER_FRACTION(waterMl);
  return { bottom, top: bottom - h, h };
};

/** 방울토마토 중심 y: 눈금 0은 바닥, 눈금 10은 물 윗면 */
export const tomatoY = (cup: ConcCup, waterMl: number, floatH: number): number => {
  const { bottom, h } = liquidBox(cup, waterMl);
  const room = h - 2 * TOMATO_R - 2;
  return bottom - TOMATO_R - 1 - clamp01(floatH / 10) * room;
};

export function ConcMacroView({ trial, snapshot, values }: ViewProps<ConcentrationSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  // 실행하기 전에는 용액에 색이 없고 방울토마토는 바닥에 있다.
  const floatH = ran ? s.floatH : 0;
  const color = ran ? concResult(values).color : 0;
  const note = ran ? concNote(s, color) : '실험하면 방울토마토가 어디쯤 뜨는지 볼 수 있어요.';
  const b = BEAKER[p.cup];
  const box = liquidBox(p.cup, p.waterMl);
  const cy = tomatoY(p.cup, p.waterMl, floatH);
  const cx = (b.x0 + b.x1) / 2;
  const fill = ran ? liquidFill(color) : liquidFill(0);
  // 눈금 막대: 비커 왼쪽에 0·5·10을 쓴다
  const ticks = [0, 5, 10].map((v) => ({ v, y: tomatoY(p.cup, p.waterMl, v) }));

  return (
    <figure className="view conc-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${CUP_TEXT[p.cup]}에 ${SUGAR_TEXT[p.sugar]}을 녹인 용액과 방울토마토. ${mixLine(p)}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="mix-label">{mixLine(p)}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="cup-label">{CUP_TEXT[p.cup]}</text>
        <line x1="4" y1={GROUND_Y} x2={W - 4} y2={GROUND_Y} stroke="#64748b" strokeWidth="2" />
        <g data-testid="conc-art" data-cup={p.cup} data-sugar={p.sugar} data-float={floatH.toFixed(2)} data-color={color}>
          {/* 용액 */}
          <rect data-testid="liquid" data-fill={fill} x={b.x0} y={box.top} width={b.x1 - b.x0} height={box.h} fill={fill} />
          {/* 비커 */}
          <path d={`M${b.x0} ${b.top} V${GROUND_Y - 4} Q${b.x0} ${GROUND_Y} ${b.x0 + 4} ${GROUND_Y} H${b.x1 - 4} Q${b.x1} ${GROUND_Y} ${b.x1} ${GROUND_Y - 4} V${b.top}`} fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* 눈금 */}
          <g fontSize="14" fill="currentColor" textAnchor="end">
            {ticks.map((t) => (
              <g key={t.v}>
                <line x1={b.x0 - 6} y1={t.y} x2={b.x0} y2={t.y} stroke="currentColor" strokeWidth="1.5" />
                <text x={b.x0 - 9} y={t.y + 5}>{t.v}</text>
              </g>
            ))}
          </g>
          {/* 방울토마토 */}
          <g data-testid="tomato" data-height={floatH.toFixed(2)}>
            <circle cx={cx} cy={cy} r={TOMATO_R} fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" />
            <path d={`M${cx - 4} ${cy - TOMATO_R + 1} l4 -4 l4 4`} fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </svg>
      <p className="view-note" data-testid="conc-note">{note}</p>
    </figure>
  );
}
