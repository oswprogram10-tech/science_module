import { LEVEL_MAX, type SoundVibrationSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { startSample } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 110;
export const CELL = { x: 10, w: 19, gap: 3, y: 34, h: 28 };

/** 채울 칸 수: 소리의 크기(눈금)를 반올림한다. */
export const filledCells = (level: number) => Math.max(0, Math.min(LEVEL_MAX, Math.round(level)));

export function VibMeterView({ trial, snapshot, values }: ViewProps<SoundVibrationSample>) {
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  // 실행하기 전에는 칸을 채우지 않는다.
  const n = ran ? filledCells(s.level) : 0;
  const note = ran ? `소리의 크기 ${n}눈금` : '실험하면 소음계의 눈금이 채워져요.';

  return (
    <figure className="view vib-meter" aria-label="소음계 보기">
      <figcaption>소음계 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`소음계의 눈금 열 칸 가운데 ${n}칸이 채워져 있어요. ${note}`}>
        <text x={CELL.x} y="20" fontSize="14" fontWeight="700" fill="currentColor">소리의 크기(눈금)</text>
        <g data-testid="meter-cells" data-filled={n}>
          {Array.from({ length: LEVEL_MAX }, (_, i) => (
            <rect
              key={i}
              data-testid="meter-cell"
              data-on={i < n ? 'true' : 'false'}
              x={CELL.x + i * (CELL.w + CELL.gap)}
              y={CELL.y}
              width={CELL.w}
              height={CELL.h}
              rx="3"
              fill={i < n ? '#d97706' : 'none'}
              fillOpacity={i < n ? 0.9 : 0}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          ))}
        </g>
        <text x={CELL.x} y={CELL.y + CELL.h + 20} fontSize="14" fill="currentColor">0</text>
        <text x={CELL.x + LEVEL_MAX * (CELL.w + CELL.gap) - CELL.gap} y={CELL.y + CELL.h + 20} fontSize="14" textAnchor="end" fill="currentColor">{LEVEL_MAX}</text>
      </svg>
      <p className="view-note" data-testid="vib-meter-note">{note}</p>
    </figure>
  );
}
