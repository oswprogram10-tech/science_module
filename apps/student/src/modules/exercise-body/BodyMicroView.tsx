import type { BodySample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { usePrefersReducedMotion, useLoopPhase } from '../transpiration/motion';
import { startSample } from './initial';

const W = 240;
const H = 262;
/** 혈관 고리(타원) */
const LOOP = { cx: 120, cy: 178, rx: 84, ry: 58 } as const;
/** 혈관을 따라 도는 점 수 */
export const DOT_COUNT = 8;
const HEART = { x: 120, y: 178 } as const;

/** 심장 크기: 위상 0에서 1(멈춘 모습), 박동 순간에 가장 커진다. */
export const heartScale = (phase: number) => 1 + 0.14 * Math.max(0, Math.sin(phase * Math.PI * 2));
/** 폐 크기: 위상 0에서 1(멈춘 모습), 숨을 들이쉬면 커진다. */
export const lungScale = (phase: number) => 1 + 0.14 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));

/** 혈관을 도는 i번째 점의 자리. phase는 0~1 위상이고 점마다 같은 간격으로 어긋난다. */
export function dotPoint(i: number, phase: number): [number, number] {
  const a = ((i / DOT_COUNT + phase) % 1) * Math.PI * 2;
  return [LOOP.cx + LOOP.rx * Math.cos(a), LOOP.cy + LOOP.ry * Math.sin(a)];
}

/** 초당 박동 수(맥박/60). 혈관 점의 속도도 맥박에 비례한다(두 박동에 한 바퀴). */
export const beatsPerSec = (pulse: number) => pulse / 60;

export function BodyMicroView({ snapshot, values, experiment }: ViewProps<BodySample>) {
  const s = snapshot ?? startSample(values, experiment);
  const reduced = usePrefersReducedMotion();
  const running = !reduced;
  const heartPhase = useLoopPhase(running, beatsPerSec(s.pulse));
  const dotPhase = useLoopPhase(running, beatsPerSec(s.pulse) / 2);
  const lungPhase = useLoopPhase(running, s.breath / 60);
  const hs = heartScale(heartPhase);
  const ls = lungScale(lungPhase);
  const pulse = Math.round(s.pulse);
  const breath = Math.round(s.breath);

  return (
    <figure className="view body-micro" aria-label="몸속 기관 보기">
      <figcaption>몸속 기관 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        data-animating={running ? 'true' : 'false'}
        aria-label={`심장, 폐, 혈관을 단순하게 그린 그림: 맥박 ${pulse}회/분, 호흡 ${breath}회/분`}
      >
        {/* 기관지와 폐 */}
        <line x1="120" y1="14" x2="120" y2="56" stroke="#9f1239" strokeWidth="5" strokeLinecap="round" />
        <g data-testid="lung" data-scale={ls.toFixed(3)} transform={`translate(120 70) scale(${ls}) translate(-120 -70)`}>
          <ellipse cx="82" cy="72" rx="34" ry="44" fill="#fbcfe8" stroke="#9f1239" strokeWidth="2.5" />
          <ellipse cx="158" cy="72" rx="34" ry="44" fill="#fbcfe8" stroke="#9f1239" strokeWidth="2.5" />
        </g>
        <rect x="63" y="62" width="38" height="22" rx="11" fill="#fff7ed" stroke="#9f1239" strokeWidth="1.5" />
        <text x="82" y="78" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1d2733">폐</text>

        {/* 혈관: 고리 모양. 오른쪽 반은 붉은색(심장에서 나가는 쪽), 왼쪽 반은 푸른색(돌아오는 쪽) */}
        <path data-testid="vessel" d={`M${LOOP.cx} ${LOOP.cy - LOOP.ry} A${LOOP.rx} ${LOOP.ry} 0 0 1 ${LOOP.cx} ${LOOP.cy + LOOP.ry}`} fill="none" stroke="#dc2626" strokeWidth="6" />
        <path data-testid="vessel" d={`M${LOOP.cx} ${LOOP.cy + LOOP.ry} A${LOOP.rx} ${LOOP.ry} 0 0 1 ${LOOP.cx} ${LOOP.cy - LOOP.ry}`} fill="none" stroke="#2563eb" strokeWidth="6" />
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const [x, y] = dotPoint(i, dotPhase);
          return <circle key={i} data-testid="blood-dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r="4.5" fill="#fff" stroke="#1d2733" strokeWidth="1.5" />;
        })}
        <rect x="14" y="196" width="46" height="22" rx="11" fill="#eff6ff" stroke="#1d4ed8" strokeWidth="1.5" />
        <text x="37" y="212" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1d2733">혈관</text>

        {/* 심장 */}
        <g data-testid="heart" data-scale={hs.toFixed(3)} transform={`translate(${HEART.x} ${HEART.y}) scale(${hs}) translate(${-HEART.x} ${-HEART.y})`}>
          <path d={`M${HEART.x} ${HEART.y + 26} C${HEART.x - 44} ${HEART.y} ${HEART.x - 28} ${HEART.y - 30} ${HEART.x} ${HEART.y - 12} C${HEART.x + 28} ${HEART.y - 30} ${HEART.x + 44} ${HEART.y} ${HEART.x} ${HEART.y + 26}Z`} fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2.5" />
          <text x={HEART.x} y={HEART.y + 6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">심장</text>
        </g>
      </svg>
      <p className="view-note">심장은 혈액을 온몸으로 보내고, 폐는 숨을 쉬어 공기를 들이마셔요.</p>
      <p className="view-note" data-testid="organ-numbers">맥박 {pulse}회/분 · 호흡 {breath}회/분{reduced ? ' (움직임 줄이기: 그림이 멈춰 있어요)' : ''}</p>
    </figure>
  );
}
