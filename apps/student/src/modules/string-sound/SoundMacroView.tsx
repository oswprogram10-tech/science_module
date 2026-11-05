import type { StringSoundSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { usePrefersReducedMotion } from '../transpiration/motion';
import { COLOR_TEXT, STRENGTH_TEXT, soundNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 212;
const STRING_Y = 126;
/** 줄을 받치는 왼쪽 막대(고정)와 오른쪽 막대 */
export const NUT_X = 30;
const END_X = 210;
/** 1 cm = 5 그림 단위. 30 cm = 150 */
export const PX_PER_CM = 5;
/** 떨림 크기 A = 1 일 때 띠 반높이(그림 단위) */
export const BAND_HALF = 9;
const STRING_COLOR = { red: '#dc2626', yellow: '#eab308' } as const;
const STRING_EDGE = { red: '#7f1d1d', yellow: '#854d0e' } as const;

/** 브리지의 x */
export const bridgeX = (lengthCm: number) => NUT_X + lengthCm * PX_PER_CM;

/** 떨리는 구간의 띠 높이(그림 단위): 떨림의 크기에 비례 */
export const bandHeight = (amplitude: number) => 2 * amplitude * BAND_HALF;

export function SoundMacroView({ trial, snapshot, values }: ViewProps<StringSoundSample>) {
  const { strength, lengthCm, color } = toParams(values);
  const reduced = usePrefersReducedMotion();
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const bx = bridgeX(lengthCm);
  const mid = (NUT_X + bx) / 2;
  const note = ran ? soundNote(s) : '줄을 튕겨 보세요. 실험하면 줄이 떨린 횟수와 소리의 크기를 알 수 있어요.';
  // 줄의 휘어짐: 움직임 줄이기이면 곧게 둔다. 이차 곡선의 조절점은 최대 휘어짐의 두 배 자리이다.
  const bow = ran && !reduced ? s.displacement * BAND_HALF * 2 : 0;
  const stringFill = STRING_COLOR[color];
  const strong = strength === 'strong';

  return (
    <figure className="view string-box" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`고무줄 상자 악기: ${COLOR_TEXT[color]} 고무줄, 떨리는 길이 ${lengthCm} cm, ${STRENGTH_TEXT[strength]} 튕김. ${note}`}
      >
        <text x={W / 2} y="16" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">느린 화면</text>
        <text x={W / 2} y="36" textAnchor="middle" fontSize="14" fill="currentColor">튕기는 세기: {STRENGTH_TEXT[strength]}</text>

        {/* 고무줄 상자와 구멍 */}
        <rect x="14" y="88" width="212" height="76" rx="6" fill="#d6b27c" fillOpacity="0.5" stroke="#7c5a2a" strokeWidth="2" />
        <circle cx={W / 2} cy={STRING_Y} r="26" fill="#1d2733" fillOpacity="0.55" stroke="#7c5a2a" strokeWidth="2" />

        {/* 떨리는 구간의 흐릿한 띠: 폭(높이)이 떨림의 크기에 비례한다 */}
        {ran && (
          <rect
            data-testid="vibe-band"
            data-amp={s.amplitude}
            x={NUT_X}
            y={STRING_Y - bandHeight(s.amplitude) / 2}
            width={bx - NUT_X}
            height={bandHeight(s.amplitude)}
            rx="3"
            fill={stringFill}
            fillOpacity="0.28"
          />
        )}

        {/* 줄: 떨리는 구간(브리지 왼쪽)은 휘어지고 나머지는 곧다 */}
        <path data-testid="string" data-bow={bow.toFixed(2)} d={`M${NUT_X} ${STRING_Y} Q${mid} ${STRING_Y + bow} ${bx} ${STRING_Y}`} fill="none" stroke={STRING_EDGE[color]} strokeWidth="5" strokeLinecap="round" />
        <path d={`M${NUT_X} ${STRING_Y} Q${mid} ${STRING_Y + bow} ${bx} ${STRING_Y}`} fill="none" stroke={stringFill} strokeWidth="3" strokeLinecap="round" />
        <line x1={bx} y1={STRING_Y} x2={END_X} y2={STRING_Y} stroke={STRING_EDGE[color]} strokeWidth="5" strokeLinecap="round" />
        <line x1={bx} y1={STRING_Y} x2={END_X} y2={STRING_Y} stroke={stringFill} strokeWidth="3" strokeLinecap="round" />

        {/* 줄을 거는 막대와 브리지 */}
        <rect x={NUT_X - 4} y={STRING_Y - 14} width="8" height="28" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
        <rect x={END_X - 4} y={STRING_Y - 14} width="8" height="28" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
        <path data-testid="bridge" d={`M${bx - 7} ${STRING_Y + 16} L${bx - 3} ${STRING_Y - 6} L${bx + 3} ${STRING_Y - 6} L${bx + 7} ${STRING_Y + 16} Z`} fill="#cbd5e1" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />

        {/* 손가락: 약하게는 화살표 하나, 세게는 둘 */}
        <g data-testid="finger" data-strength={strength}>
          <rect x={mid - 7} y="46" width="14" height="52" rx="7" fill="#f1c9a5" stroke="#8a5a3a" strokeWidth="2" />
          <path d={`M${mid - 18} 70 l0 14 l-4 -5 m4 5 l4 -5`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {strong && <path d={`M${mid + 18} 66 l0 18 l-4 -5 m4 5 l4 -5`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        </g>

        {/* 떨리는 길이 치수선 */}
        <line x1={NUT_X} y1="180" x2={bx} y2="180" stroke="currentColor" strokeWidth="1.5" />
        <line x1={NUT_X} y1="174" x2={NUT_X} y2="186" stroke="currentColor" strokeWidth="1.5" />
        <line x1={bx} y1="174" x2={bx} y2="186" stroke="currentColor" strokeWidth="1.5" />
        <text data-testid="length-label" x={mid} y="204" textAnchor="middle" fontSize="14" fill="currentColor">떨리는 길이 {lengthCm} cm</text>
      </svg>
      <p className="view-note" data-testid="sound-note">{note}</p>
    </figure>
  );
}
