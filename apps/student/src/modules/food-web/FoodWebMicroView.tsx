import type { FoodWebSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { RAIN_TEXT, rainOf, shownCounts, startSample } from './initial';

const W = 240;
const H = 300;
const CX = 164;
const INK = '#1f2937';
const BOX_MIN_W = 64;
const BOX_MAX_W = 112;
const BOX_MIN_H = 44;
const BOX_MAX_H = 64;
/** 칸 크기가 가장 커지는 수 */
export const FULL = { grass: 100, rabbits: 30, foxes: 10 } as const;
/** 위에서 아래로: 여우, 토끼, 풀의 칸 가운데 높이 */
const CY = { fox: 50, rabbit: 150, grass: 250 } as const;

/** 칸 크기: 수에 비례하되 최소·최대로 제한 */
export function boxSize(n: number, full: number): { w: number; h: number } {
  const k = Math.min(1, Math.max(0, n / full));
  return { w: BOX_MIN_W + (BOX_MAX_W - BOX_MIN_W) * k, h: BOX_MIN_H + (BOX_MAX_H - BOX_MIN_H) * k };
}

function Arrow({ x1, y1, x2, y2, label, width = 2.5 }: { x1: number; y1: number; x2: number; y2: number; label?: string; width?: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * 9;
  const by = y2 - uy * 9;
  return (
    <g data-testid="arrow" stroke="currentColor" fill="currentColor">
      <line x1={x1} y1={y1} x2={bx} y2={by} strokeWidth={width} />
      <polygon points={`${x2},${y2} ${bx - uy * 5},${by + ux * 5} ${bx + uy * 5},${by - ux * 5}`} stroke="none" />
      {label && (
        <text x={(x1 + x2) / 2 + 9} y={(y1 + y2) / 2 + 5} fontSize="14" stroke="none">{label}</text>
      )}
    </g>
  );
}

export function FoodWebMicroView({ experiment, snapshot, values }: ViewProps<FoodWebSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const rain = rainOf(values);
  const c = shownCounts(s);
  const fox = boxSize(c.foxes, FULL.foxes);
  const rabbit = boxSize(c.rabbits, FULL.rabbits);
  const grass = boxSize(c.grass, FULL.grass);
  const noFox = c.foxes === 0;
  const aria = `먹이 그물: 풀을 토끼가 먹고 토끼를 여우가 먹어요. 지금 풀 ${c.grass}%, 토끼 ${c.rabbits}마리, ${noFox ? '여우 없음' : `여우 ${c.foxes}마리`}. 해와 비는 풀이 자라는 데 필요한 비생물 요소예요.`;
  const grassLeft = CX - grass.w / 2;
  const rainWidth = rain === 'low' ? 1.5 : rain === 'normal' ? 2.5 : 3.5;

  return (
    <figure className="view food-web-micro" aria-label="먹이 그물로 보기">
      <figcaption>먹이 그물로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        {/* 여우 */}
        {noFox ? (
          <g data-testid="fox-box" data-empty="true">
            <rect x={CX - fox.w / 2} y={CY.fox - fox.h / 2} width={fox.w} height={fox.h} rx="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
            <text x={CX} y={CY.fox - 3} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">여우</text>
            <text x={CX} y={CY.fox + 15} textAnchor="middle" fontSize="14" fill="currentColor">없음</text>
          </g>
        ) : (
          <g data-testid="fox-box" data-empty="false" data-w={fox.w.toFixed(1)}>
            <rect x={CX - fox.w / 2} y={CY.fox - fox.h / 2} width={fox.w} height={fox.h} rx="8" fill="#fdba74" stroke="#9a3412" strokeWidth="2" />
            <text x={CX} y={CY.fox - 3} textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>여우</text>
            <text x={CX} y={CY.fox + 15} textAnchor="middle" fontSize="14" fill={INK}>{c.foxes}마리</text>
          </g>
        )}
        {/* 토끼 */}
        <g data-testid="rabbit-box" data-w={rabbit.w.toFixed(1)}>
          <rect x={CX - rabbit.w / 2} y={CY.rabbit - rabbit.h / 2} width={rabbit.w} height={rabbit.h} rx="8" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          <text x={CX} y={CY.rabbit - 3} textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>토끼</text>
          <text x={CX} y={CY.rabbit + 15} textAnchor="middle" fontSize="14" fill={INK}>{c.rabbits}마리</text>
        </g>
        {/* 풀 */}
        <g data-testid="grass-box" data-w={grass.w.toFixed(1)}>
          <rect x={grassLeft} y={CY.grass - grass.h / 2} width={grass.w} height={grass.h} rx="8" fill="#bbf7d0" stroke="#15803d" strokeWidth="2" />
          <text x={CX} y={CY.grass - 3} textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>풀</text>
          <text x={CX} y={CY.grass + 15} textAnchor="middle" fontSize="14" fill={INK}>{c.grass}%</text>
        </g>

        {/* 먹고 먹히는 관계: 풀 → 토끼 → 여우 */}
        <Arrow x1={CX} y1={CY.grass - grass.h / 2 - 4} x2={CX} y2={CY.rabbit + rabbit.h / 2 + 4} label="먹힘" />
        <Arrow x1={CX} y1={CY.rabbit - rabbit.h / 2 - 4} x2={CX} y2={CY.fox + fox.h / 2 + 4} label="먹힘" />

        {/* 비생물 요소: 해, 비 → 풀 */}
        <text x="6" y="196" fontSize="14" fontWeight="700" fill="currentColor">비생물 요소</text>
        <circle cx="16" cy="232" r="8" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
        <text x="30" y="237" fontSize="14" fill="currentColor">해</text>
        <Arrow x1={50} y1={238} x2={grassLeft - 3} y2={238} />
        <path d="M16 258 q-6 9 0 12 q6 -3 0 -12z" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1" />
        <text x="30" y="270" fontSize="14" fill="currentColor">비 {RAIN_TEXT[rain]}</text>
        <g data-testid="rain-arrow" data-width={rainWidth}>
          <Arrow x1={84} y1={262} x2={grassLeft - 3} y2={262} width={rainWidth} />
        </g>
      </svg>
      <p className="view-note">화살표는 먹고 먹히는 관계를 나타내요.</p>
    </figure>
  );
}
