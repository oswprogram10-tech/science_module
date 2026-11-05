import type { BetweenKind, MagnetSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { BETWEEN_TEXT, REACH_CM, startSample, toParams } from './initial';
import { Texture } from './ClipMacroView';

const W = 240;
const H = 196;
export const CX = 104;
/** 1 cm = 36 그림 단위 */
export const PX_PER_CM = 36;
const MAG_W = 26;
const MAG_H = 40;
const MAG_TOP = 14;
/** 사이 물체의 두께(그림 단위, 이 그림에서만) */
export const SHEET_T = 10;
const SHEET_W: Record<Exclude<BetweenKind, 'none'>, number> = { paper: 60, plastic: 60, iron: 44 };
const SHEET_FILL: Record<Exclude<BetweenKind, 'none'>, string> = { paper: 'url(#mg-paper)', plastic: 'url(#mg-plastic)', iron: 'url(#mg-iron)' };
const DOT = '#d97706';

/** 점 하나(자석·사이 물체 맨 아래 가운데가 (0, 0), 아래쪽이 +y) */
export interface Dot { x: number; y: number; o: number }

/** 무늬가 아래로 퍼진 길이(그림 단위): reach에 비례한다 */
export const extentPx = (reach: number) => REACH_CM * reach * PX_PER_CM;

const ARCS = 5;

/**
 * 철가루 무늬처럼 점으로 그린 곡선. 맨 아래 면의 가운데를 중심으로 한 반타원 5개가 아래로 퍼진다.
 * 가장 바깥 곡선의 깊이가 extentPx(reach)이다. 철판이 있으면(reach 0) 점들이 철판 안(위쪽, y < 0)에 모이고 아래에는 거의 없다.
 */
export function patternDots(reach: number, between: BetweenKind): Dot[] {
  const dots: Dot[] = [];
  if (between === 'iron' || reach <= 0) {
    // 철판 안에 모인 점: 두 줄. 아래로 새는 점은 3개뿐이다.
    const half = SHEET_W.iron / 2 - 5;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 9; i++) dots.push({ x: -half + (i * (2 * half)) / 8, y: -SHEET_T / 2 + (row === 0 ? -1.8 : 2.2), o: 0.95 });
    }
    for (const x of [-7, 0, 7]) dots.push({ x, y: 4 + Math.abs(x) / 3.5, o: 0.4 });
    return dots;
  }
  const ext = extentPx(reach);
  for (let k = 1; k <= ARCS; k++) {
    const f = k / ARCS;
    const ry = f * ext;
    const rx = MAG_W / 2 + f * ext * 0.55;
    const len = Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const n = Math.max(6, Math.round(len / 7));
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI;
      // 철가루처럼 조금 흩어진다(난수 없이 고정된 값)
      const jx = Math.sin(k * 12.9898 + i * 78.233) * 1.1;
      const jy = Math.cos(k * 39.346 + i * 11.135) * 1.1;
      dots.push({ x: rx * Math.cos(th) + jx, y: ry * Math.sin(th) + jy, o: 0.95 - 0.55 * f });
    }
  }
  return dots;
}

export function ClipReachView({ trial, snapshot, values, experiment }: ViewProps<MagnetSample>) {
  const { gapCm, between, magnets } = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values, experiment);
  const reach = s.reach;
  const sheetT = between === 'none' ? 0 : SHEET_T;
  const yBottom = MAG_TOP + MAG_H + sheetT;
  const yPile = yBottom + gapCm * PX_PER_CM;
  const dots = ran ? patternDots(reach, between) : [];
  const note = ran ? '자석의 힘은 자석에서 멀어질수록 약해져요.' : '실험하면 자석의 힘이 미치는 곳이 나타나요.';
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;
  const magX = CX - MAG_W / 2;

  return (
    <figure className="view reach-view" aria-label="자석의 힘이 미치는 곳">
      <figcaption>자석의 힘이 미치는 곳</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          ran
            ? `자석 아래로 점이 곡선 모양으로 퍼진 그림. 사이에 둔 물체: ${BETWEEN_TEXT[between]}. ${between === 'iron' ? '점이 철판 안에 모여 있어요.' : '자석에서 멀어질수록 점이 드물어져요.'}`
            : '자석과 클립 더미와 사이에 둔 물체를 그린 그림. 실험하면 자석의 힘이 미치는 곳이 나타나요.'
        }
      >
        <Texture />
        {/* 자석 */}
        <rect x={magX} y={MAG_TOP} width={MAG_W} height={MAG_H / 2} rx="2" fill="#dc2626" stroke="currentColor" strokeWidth="1.5" />
        <rect x={magX} y={MAG_TOP + MAG_H / 2} width={MAG_W} height={MAG_H / 2} rx="2" fill="#2563eb" stroke="currentColor" strokeWidth="1.5" />
        <text x={CX} y={MAG_TOP + MAG_H / 4 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">N</text>
        <text x={CX} y={MAG_TOP + (3 * MAG_H) / 4 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">S</text>
        <text x={magX - 8} y={MAG_TOP + MAG_H / 2 + 5} textAnchor="end" fontSize="14" fill="currentColor" {...halo}>{magnets === 2 ? '자석 2개' : '자석'}</text>

        {/* 사이 물체 */}
        {between !== 'none' && (
          <g data-testid="reach-between" data-kind={between}>
            <rect x={CX - SHEET_W[between] / 2} y={MAG_TOP + MAG_H} width={SHEET_W[between]} height={SHEET_T} rx="1" fill={SHEET_FILL[between]} stroke="currentColor" strokeWidth="1.3" />
            <text x={CX + 36} y={MAG_TOP + MAG_H + SHEET_T / 2 + 5} fontSize="14" fontWeight="700" fill="currentColor" {...halo}>{BETWEEN_TEXT[between]}</text>
          </g>
        )}

        {/* 점 곡선: 사이 물체 위에 그려 철판 안의 점도 보인다 */}
        <g data-testid="reach-dots" data-reach={reach} data-extent={ran ? extentPx(reach).toFixed(1) : '0'} data-count={dots.length} fill={DOT}>
          {dots.map((d, i) => (
            <circle key={i} cx={(CX + d.x).toFixed(1)} cy={(yBottom + d.y).toFixed(1)} r="1.7" fillOpacity={d.o.toFixed(2)} />
          ))}
        </g>

        {/* 클립 더미와 위치 표시 */}
        <line data-testid="pile-marker" data-y={yPile.toFixed(1)} x1={CX - 76} y1={yPile} x2={CX + 76} y2={yPile} stroke="currentColor" strokeWidth="1.3" strokeDasharray="4 3" strokeOpacity="0.7" />
        <path d={`M${CX - 40} ${yPile + 26} C${CX - 30} ${yPile + 8} ${CX - 14} ${yPile} ${CX} ${yPile} C${CX + 14} ${yPile} ${CX + 30} ${yPile + 8} ${CX + 40} ${yPile + 26} Z`} fill="#9ca3af" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.5" />
        <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.7">
          {[[-16, 14, -15], [0, 8, 20], [14, 15, -40], [-5, 18, 60]].map(([dx, dy, rot], i) => (
            <rect key={i} x={CX + dx! - 5} y={yPile + dy! - 3} width="10" height="6" rx="3" transform={`rotate(${rot} ${CX + dx!} ${yPile + dy!})`} />
          ))}
        </g>
        <text x={CX} y={yPile + 44} textAnchor="middle" fontSize="14" fill="currentColor">클립</text>
        <path d={`M${CX + 82} ${yPile - 6} L${CX + 76} ${yPile} L${CX + 82} ${yPile + 6} Z`} fill="currentColor" />
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
