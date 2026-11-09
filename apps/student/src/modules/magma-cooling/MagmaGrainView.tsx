import { useId, useMemo } from 'react';
import type { MagmaSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { LIQUID_FILL, ROCK_GRAINS, ROCK_TONES, WINDOW_MM, grainCount, mosaic, polyPoints, toneOf } from './grains';
import { ROCK_CARD_TEXT, magmaResult } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 282;
const WIN = { x: 20, y: 30, size: 200 };
/** 1 mm 축척 막대의 길이(px) = 창 한 변(px) / 창이 나타내는 길이(mm). */
export { WINDOW_MM };
export const BAR_PX = WIN.size / WINDOW_MM;

/** 굳은(채운) 알갱이 수: 전체 알갱이 수 × 진행도(반올림). */
export const filledGrains = (n: number, crystal: number) => Math.round(n * Math.min(1, Math.max(0, crystal)));

/** 비교 카드의 암석 표면 그림(단순화한 무늬). */
function RockPattern({ rock }: { rock: keyof typeof ROCK_TONES }) {
  const cells = mosaic(ROCK_GRAINS[rock]);
  const tones = ROCK_TONES[rock];
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" role="img" aria-label={`${rock === 'basalt' ? '현무암' : rock === 'granite' ? '화강암' : '중간 암석'} 표면 그림`}>
      {cells.map((c, i) => (
        <polygon key={i} points={polyPoints(c.poly, 0, 0, 80)} fill={tones[(i * 3 + 1) % tones.length]} stroke="#1f2937" strokeWidth="0.6" strokeOpacity="0.5" />
      ))}
      <rect x="0.5" y="0.5" width="79" height="79" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function MagmaGrainView({ experiment, snapshot, values }: ViewProps<MagmaSample>) {
  const clipId = useId();
  const result = magmaResult(values, experiment);
  const crystal = snapshot?.crystal ?? 0;
  const color = values.color === 'black' ? 'black' : 'white';
  const n = grainCount(result.sizeMm);
  const filled = filledGrains(n, crystal);
  // 알갱이 수가 같으면 점 문자열도 같으므로 한 번만 계산한다.
  const pointsList = useMemo(() => mosaic(n).map((c) => polyPoints(c.poly, WIN.x, WIN.y, WIN.size)), [n]);
  const done = !!snapshot && snapshot.t >= result.solidS;

  return (
    <figure className="view grains" aria-label="알갱이로 보기(돋보기)">
      <figcaption>알갱이로 보기(돋보기)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`돋보기로 본 알갱이: 굳은 알갱이 ${filled}개(모두 ${n}개), 눈금 1 mm`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={WIN.x} y={WIN.y} width={WIN.size} height={WIN.size} rx="6" />
          </clipPath>
        </defs>
        <text x={WIN.x} y="20" fontSize="14" fill="currentColor">확대 창</text>
        <g clipPath={`url(#${clipId})`} data-testid="grain-window" data-grains={n} data-filled={filled}>
          <rect x={WIN.x} y={WIN.y} width={WIN.size} height={WIN.size} fill={LIQUID_FILL[color]} />
          {pointsList.map((pts, i) =>
            i < filled ? (
              <polygon key={i} data-testid="grain" points={pts} fill={toneOf(i, color)} stroke="#6b7280" strokeWidth="1" />
            ) : (
              <polygon key={i} points={pts} fill={LIQUID_FILL[color]} stroke="#9ca3af" strokeWidth="0.5" strokeOpacity="0.5" />
            ),
          )}
        </g>
        <rect x={WIN.x} y={WIN.y} width={WIN.size} height={WIN.size} rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
        {/* 축척 막대 */}
        <g data-testid="scale-bar" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d={`M${WIN.x} 254 H${WIN.x + BAR_PX} M${WIN.x} 248 V260 M${WIN.x + BAR_PX} 248 V260`} fill="none" />
        </g>
        <text x={WIN.x + BAR_PX + 10} y="259" fontSize="14" fill="currentColor">1 mm</text>
      </svg>
      <p className="view-note">{`굳은 알갱이 ${filled}개 / 모두 ${n}개`}</p>
      {done && (
        <div className="rock-card" data-testid="rock-card" data-rock={result.rockLike}>
          <RockPattern rock={result.rockLike} />
          <p>{ROCK_CARD_TEXT[result.rockLike]}</p>
        </div>
      )}
    </figure>
  );
}
