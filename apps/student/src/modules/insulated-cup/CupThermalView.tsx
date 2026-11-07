import type { InsulatedCupSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { initialSample } from './initial';

const BLUE: Rgb = [43, 108, 176];
const YELLOW: Rgb = [250, 214, 60];
const RED: Rgb = [200, 32, 32];
type Rgb = [number, number, number];

const hex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;

/** 열화상 색: 20 °C 파랑 → 40 °C 노랑 → 60 °C 빨강, 구간마다 선형 보간. 범위 밖은 양 끝 색. */
export function thermalColor(c: number): string {
  const lerp = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  if (c <= 20) return hex(BLUE);
  if (c >= 60) return hex(RED);
  return c <= 40 ? hex(lerp(BLUE, YELLOW, (c - 20) / 20)) : hex(lerp(YELLOW, RED, (c - 40) / 20));
}

/** 화살표 굵기(px): 열 손실(W)에 비례하고, 아주 작아도 보이도록 1 이상. */
export const arrowWidth = (lossW: number) => Math.max(1, lossW * 1.2);

const CUP = { l: 104, r: 176, top: 84, bottom: 220, wall: 11 };
const MID_X = (CUP.l + CUP.r) / 2;
const BAR = { x: 270, top: 44, bottom: 204 };
const LABEL = '열이 빠져나가요';

/** 가로·세로 화살표. dir: 어느 쪽으로 나가는지. 굵기 w, 길이 len. */
function Arrow({ x, y, dir, w, len = 38 }: { x: number; y: number; dir: 'left' | 'right' | 'up'; w: number; len?: number }) {
  const head = w * 1.6 + 6;
  const shaft = len - head;
  const fill = '#c2410c';
  if (dir === 'up') {
    return (
      <g fill={fill} stroke="currentColor" strokeWidth="0.8">
        <rect x={x - w / 2} y={y - shaft} width={w} height={shaft} />
        <polygon points={`${x - head / 2 - 2},${y - shaft} ${x + head / 2 + 2},${y - shaft} ${x},${y - len}`} />
      </g>
    );
  }
  const s = dir === 'left' ? -1 : 1;
  return (
    <g fill={fill} stroke="currentColor" strokeWidth="0.8">
      <rect x={dir === 'left' ? x - shaft : x} y={y - w / 2} width={shaft} height={w} />
      <polygon points={`${x + s * shaft},${y - head / 2 - 2} ${x + s * shaft},${y + head / 2 + 2} ${x + s * len},${y}`} />
    </g>
  );
}

export function CupThermalView({ experiment, snapshot, values }: ViewProps<InsulatedCupSample>) {
  const s = snapshot ?? initialSample(values, experiment);
  const side = s.surfaceSideC;
  const top = s.surfaceTopC;
  const wSide = arrowWidth(s.lossSideW);
  const wTop = arrowWidth(s.lossTopW);
  const sideText = `옆면 ${side.toFixed(1)} °C`;
  const topText = `윗면 ${top.toFixed(1)} °C`;
  const ticks = [60, 40, 20];
  const tickY = (c: number) => BAR.bottom - ((c - 20) / 40) * (BAR.bottom - BAR.top);

  return (
    <figure className="view thermal" aria-label="열화상으로 보기">
      <figcaption>열화상으로 보기</figcaption>
      <svg viewBox="0 0 316 250" role="img" aria-label={`열화상 그림: ${sideText}, ${topText}`}>
        <defs>
          <linearGradient id="thermal-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={thermalColor(60)} />
            <stop offset="0.5" stopColor={thermalColor(40)} />
            <stop offset="1" stopColor={thermalColor(20)} />
          </linearGradient>
        </defs>

        {/* 컵 속: 색을 칠하지 않고 물이 담겼다는 표시만 한다 */}
        <rect x={CUP.l + CUP.wall} y={CUP.top + 10} width={CUP.r - CUP.l - 2 * CUP.wall} height={CUP.bottom - CUP.top - 10} fill="#eef1f4" stroke="none" />
        {/* 옆면 바깥(왼쪽·오른쪽) */}
        <rect data-testid="thermal-side" x={CUP.l} y={CUP.top + 10} width={CUP.wall} height={CUP.bottom - CUP.top - 10} fill={thermalColor(side)} stroke="currentColor" strokeWidth="1.2" />
        <rect x={CUP.r - CUP.wall} y={CUP.top + 10} width={CUP.wall} height={CUP.bottom - CUP.top - 10} fill={thermalColor(side)} stroke="currentColor" strokeWidth="1.2" />
        <rect x={CUP.l} y={CUP.bottom} width={CUP.r - CUP.l} height="6" fill="#b8c0c8" stroke="currentColor" strokeWidth="1.2" />
        {/* 윗면 */}
        <rect data-testid="thermal-top" x={CUP.l} y={CUP.top} width={CUP.r - CUP.l} height="10" fill={thermalColor(top)} stroke="currentColor" strokeWidth="1.2" />

        {/* 열이 빠져나가는 화살표: 굵기는 열 손실에 비례 */}
        <Arrow x={CUP.l - 4} y={160} dir="left" w={wSide} />
        <Arrow x={CUP.r + 4} y={160} dir="right" w={wSide} />
        <Arrow x={MID_X} y={CUP.top - 4} dir="up" w={wTop} len={34} />

        {/* 숫자 온도: 색만으로 전달하지 않는다 */}
        {/* 데스크톱에서 그림이 0.72배로 줄어 그려져도 화면에서 13 px 이상이 되도록 글자는 19로 쓰고, 옆면은 두 줄로 나눈다. */}
        <text x={50} y={196} textAnchor="middle" fontSize="19" fontWeight="700" fill="currentColor">
          <tspan x={50}>옆면 </tspan>
          <tspan x={50} dy={22}>{side.toFixed(1)} °C</tspan>
        </text>
        <text x={MID_X} y={20} textAnchor="middle" fontSize="19" fontWeight="700" fill="currentColor">{topText}</text>

        {/* 색 막대 범례 */}
        <text x={BAR.x + 5} y={BAR.top - 10} textAnchor="middle" fontSize="19" fill="currentColor">°C</text>
        <rect x={BAR.x} y={BAR.top} width="10" height={BAR.bottom - BAR.top} fill="url(#thermal-bar)" stroke="currentColor" strokeWidth="1" />
        {ticks.map((c) => (
          <g key={c}>
            <line x1={BAR.x + 10} x2={BAR.x + 15} y1={tickY(c)} y2={tickY(c)} stroke="currentColor" strokeWidth="1" />
            <text x={BAR.x + 16} y={tickY(c) + 7} fontSize="19" fill="currentColor">{c}</text>
          </g>
        ))}
      </svg>
      <p className="view-note"><span aria-hidden="true" style={{ color: '#d35400' }}>➜</span> {LABEL} (화살표가 굵을수록 많이)<br />계산으로 그린 열화상 그림이에요.</p>
    </figure>
  );
}
