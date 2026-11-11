import { SPRING_Y_MAX_CM, type SpringScaleSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { clamp01, startSample } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 190;
export const BAR = { x: 10, w: 220, h: 26 };
/** 막대의 가로 범위 끝: 저울 눈금(g)과 늘어난 길이(cm). 추 5개와 필통(400 g, 16 cm)까지 담는다. */
export const READING_MAX_G = 400;
/** 막대 두 개의 위쪽 y */
export const ROW_Y = { reading: 34, stretch: 112 } as const;

/** 막대 채움 길이(그림 단위). 가로 범위를 넘으면 틀 안에서 멈춘다. */
export const barLength = (value: number, max: number) => BAR.w * clamp01(value / max);

export function SpringBarsView({ trial, snapshot, values }: ViewProps<SpringScaleSample>) {
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  // 실행하기 전에는 막대를 채우지 않는다.
  const reading = ran ? s.readingG : 0;
  const stretch = ran ? s.stretchCm : 0;
  const note = ran ? `저울 눈금 ${Math.round(s.readingG)} g · 늘어난 길이 ${s.stretchCm.toFixed(1)} cm` : '실험하면 두 막대가 채워져요.';

  return (
    <figure className="view spring-bars" aria-label="눈금과 길이 보기">
      <figcaption>눈금과 길이 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`저울 눈금과 용수철이 늘어난 길이를 막대로 견주어요. ${note}`}>
        <text x={BAR.x} y="20" fontSize="14" fontWeight="700" fill="currentColor">저울 눈금(g)</text>
        <rect x={BAR.x} y={ROW_Y.reading} width={BAR.w} height={BAR.h} rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect data-testid="reading-bar" data-value={reading.toFixed(1)} x={BAR.x} y={ROW_Y.reading} width={barLength(reading, READING_MAX_G).toFixed(1)} height={BAR.h} rx="4" fill="#2b7aa8" fillOpacity="0.85" />
        <text x={BAR.x} y={ROW_Y.reading + BAR.h + 18} fontSize="14" fill="currentColor">0</text>
        <text x={BAR.x + BAR.w} y={ROW_Y.reading + BAR.h + 18} fontSize="14" textAnchor="end" fill="currentColor">{READING_MAX_G}</text>

        <text x={BAR.x} y="98" fontSize="14" fontWeight="700" fill="currentColor">늘어난 길이(cm)</text>
        <rect x={BAR.x} y={ROW_Y.stretch} width={BAR.w} height={BAR.h} rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect data-testid="stretch-bar" data-value={stretch.toFixed(2)} x={BAR.x} y={ROW_Y.stretch} width={barLength(stretch, SPRING_Y_MAX_CM).toFixed(1)} height={BAR.h} rx="4" fill="#d97706" fillOpacity="0.85" />
        <text x={BAR.x} y={ROW_Y.stretch + BAR.h + 18} fontSize="14" fill="currentColor">0</text>
        <text x={BAR.x + BAR.w} y={ROW_Y.stretch + BAR.h + 18} fontSize="14" textAnchor="end" fill="currentColor">{SPRING_Y_MAX_CM}</text>
      </svg>
      <p className="view-note" data-testid="spring-bars-note">{note}</p>
    </figure>
  );
}
