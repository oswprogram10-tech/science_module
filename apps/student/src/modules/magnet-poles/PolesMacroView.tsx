import type { MagnetPolesSample, PoleCover, PoleFacing, PoleSize } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { COVER_TEXT, FACING_TEXT, SIZE_TEXT, polesNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 196;
/** 두 자석 사이 거리 1 cm = 그림 단위 12 */
export const CM = 12;
export const MAG_W = 60;
export const LEFT_X = 10;
/** 자석이 놓인 탁자 선 */
export const TABLE_Y = 114;
export const MAG_H: Record<PoleSize, number> = { small: 24, large: 36 };
export const COMPASS = { y: 148, r: 16 } as const;
export const POLE_FILL: Record<PoleCover, { N: string; S: string }> = {
  color: { N: '#f87171', S: '#60a5fa' },
  gray: { N: '#b6bcc6', S: '#b6bcc6' },
};

export type Pole = 'N' | 'S';
/** 마주 보는 극 → 왼쪽 자석과 오른쪽 자석의 (왼쪽 절반, 오른쪽 절반) 극 */
export function halves(facing: PoleFacing): { left: [Pole, Pole]; right: [Pole, Pole] } {
  const l: Pole = facing === 'SS' ? 'S' : 'N';
  const r: Pole = facing === 'NN' ? 'N' : 'S';
  const flip = (x: Pole): Pole => (x === 'N' ? 'S' : 'N');
  return { left: [flip(l), l], right: [r, flip(r)] };
}

/** 오른쪽 자석의 왼쪽 면 x */
export const rightX = (gapCm: number) => LEFT_X + MAG_W + gapCm * CM;

/** 나침반 바늘의 빨간 쪽(N극 끝)이 가리키는 방향: 자석의 S극 절반 쪽이다. −1이면 왼쪽, +1이면 오른쪽. */
export const needleDir = (halvesOf: [Pole, Pole]): -1 | 1 => (halvesOf[0] === 'S' ? -1 : 1);

function Magnet({ x, size, cover, hs, side }: { x: number; size: PoleSize; cover: PoleCover; hs: [Pole, Pole]; side: 'left' | 'right' }) {
  const h = MAG_H[size];
  const y = TABLE_Y - h;
  const half = MAG_W / 2;
  return (
    <g data-testid="magnet" data-side={side} data-size={size} data-x={x.toFixed(1)}>
      {hs.map((pole, k) => (
        <g key={k} data-testid="pole-half" data-pole={pole}>
          <rect x={x + k * half} y={y} width={half} height={h} fill={POLE_FILL[cover][pole]} stroke="currentColor" strokeWidth="2" />
          <text x={x + k * half + half / 2} y={y - 6} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" data-testid="pole-letter">{pole}</text>
        </g>
      ))}
    </g>
  );
}

function Compass({ cx, dir, side }: { cx: number; dir: -1 | 1; side: 'left' | 'right' }) {
  const { y, r } = COMPASS;
  return (
    <g data-testid="compass" data-side={side} data-red-dir={dir}>
      <circle cx={cx} cy={y} r={r} fill="#f8fafc" stroke="currentColor" strokeWidth="2" />
      <path data-testid="needle-red" d={`M${cx + dir * 12} ${y} L${cx} ${y - 4} L${cx} ${y + 4} Z`} fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" strokeLinejoin="round" />
      <path d={`M${cx - dir * 12} ${y} L${cx} ${y - 4} L${cx} ${y + 4} Z`} fill="#e5e7eb" stroke="#475569" strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

export function PolesMacroView({ trial, snapshot, values }: ViewProps<MagnetPolesSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const note = ran ? polesNote(s) : '실험하면 오른쪽 자석이 어느 쪽으로 움직이는지 볼 수 있어요.';
  const hs = halves(p.facing);
  const rx = rightX(s.gapCm);
  const leftC = LEFT_X + MAG_W / 2;
  const rightC = rx + MAG_W / 2;

  return (
    <figure className="view poles-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`막대자석 두 개: 마주 보는 극은 ${FACING_TEXT[p.facing]}, ${SIZE_TEXT[p.size]}, 처음 거리 ${p.gapCm} cm. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="facing-label">{FACING_TEXT[p.facing]} · {SIZE_TEXT[p.size]}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="gap-label">처음 거리 {p.gapCm} cm · 색칠 {COVER_TEXT[p.cover]}</text>
        <line x1="4" y1={TABLE_Y} x2={W - 4} y2={TABLE_Y} stroke="#64748b" strokeWidth="2" />
        <g data-testid="poles-art" data-facing={p.facing} data-cover={p.cover} data-gap={s.gapCm.toFixed(2)}>
          <Magnet x={LEFT_X} size={p.size} cover={p.cover} hs={hs.left} side="left" />
          <Magnet x={rx} size={p.size} cover={p.cover} hs={hs.right} side="right" />
          <Compass cx={leftC} dir={needleDir(hs.left)} side="left" />
          <Compass cx={rightC} dir={needleDir(hs.right)} side="right" />
        </g>
        <text x={leftC} y="184" textAnchor="middle" fontSize="14" fill="currentColor">나침반</text>
        <text x={rightC} y="184" textAnchor="middle" fontSize="14" fill="currentColor">나침반</text>
      </svg>
      <p className="view-note" data-testid="poles-note">{note}</p>
    </figure>
  );
}
