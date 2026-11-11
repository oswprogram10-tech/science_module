import type { MagnetPolesSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { startSample, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 120;
export const RULER = { x: 10, per: 22, y: 74, cm: 10 };

/** 거리(cm) → 자 위의 x */
export const rulerX = (cm: number) => RULER.x + cm * RULER.per;

export function PolesRulerView({ trial, snapshot, values }: ViewProps<MagnetPolesSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const note = ran ? `두 자석 사이 ${s.gapCm.toFixed(1)} cm` : `처음 두 자석 사이는 ${p.gapCm} cm예요.`;
  const x1 = rulerX(Math.max(0, s.gapCm));

  return (
    <figure className="view poles-ruler" aria-label="거리 재기">
      <figcaption>거리 재기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`자 위에서 두 자석 사이를 재요. ${note}`}>
        <text x={RULER.x} y="18" fontSize="14" fontWeight="700" fill="currentColor">두 자석 사이 거리</text>
        <text x={RULER.x} y="44" fontSize="14" fill="currentColor" data-testid="ruler-label">{s.gapCm.toFixed(1)} cm</text>
        {/* 왼쪽 자석의 면(0)에서 오른쪽 자석의 면까지 */}
        <g data-testid="gap-bracket" data-gap={s.gapCm.toFixed(2)} stroke="#d97706" strokeWidth="3" strokeLinecap="round">
          <line x1={RULER.x} y1="56" x2={x1} y2="56" />
          <line x1={RULER.x} y1="50" x2={RULER.x} y2="62" />
          <line x1={x1} y1="50" x2={x1} y2="62" />
        </g>
        <line x1={RULER.x} y1={RULER.y} x2={rulerX(RULER.cm)} y2={RULER.y} stroke="currentColor" strokeWidth="2" />
        {Array.from({ length: RULER.cm + 1 }, (_, i) => (
          <line key={i} x1={rulerX(i)} y1={RULER.y} x2={rulerX(i)} y2={RULER.y + (i % 2 === 0 ? 10 : 6)} stroke="currentColor" strokeWidth="1.5" />
        ))}
        {[0, 2, 4, 6, 8, 10].map((i) => (
          <text key={i} x={rulerX(i)} y={RULER.y + 28} textAnchor={i === 0 ? 'start' : i === 10 ? 'end' : 'middle'} fontSize="14" fill="currentColor">{i}</text>
        ))}
      </svg>
      <p className="view-note" data-testid="poles-ruler-note">{note}</p>
    </figure>
  );
}
