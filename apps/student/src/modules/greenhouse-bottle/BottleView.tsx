import type { GreenhouseSample } from '@sci/engine-ssi';
import type { ViewProps } from '../types';
import { IDLE_NOTE, IDLE_SAMPLE, bottleNote, shownTemp, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 232;

/** 병 몸통: 가운데 x=120, 너비 84, 위쪽에 목 */
const BODY = { x: 78, y: 96, w: 84, h: 92 };
const CAP_COLORS = { white: { fill: '#ffffff', stroke: '#374151', name: '흰색 뚜껑' }, blue: { fill: '#2563eb', stroke: '#1e3a8a', name: '파란색 뚜껑' } };

export function BottleView({ trial, snapshot, values }: ViewProps<GreenhouseSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s: GreenhouseSample = ran ? (snapshot ?? IDLE_SAMPLE) : IDLE_SAMPLE;
  const note = ran ? bottleNote(s) : IDLE_NOTE;
  const cap = CAP_COLORS[p.cap];
  const film = p.cover === 'film';
  const co2 = p.air === 'co2';
  const label = `전등이 비추는 페트병 그림. ${cap.name}, 투명 비닐 덮개 ${film ? '씌움' : '없음'}, 병 속 공기 ${co2 ? '이산화 탄소를 더 넣은 공기' : '보통 공기'}. 병 속 디지털 온도계가 ${shownTemp(s)} °C를 가리켜요. ${note}`;
  return (
    <figure className="view greenhouse-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {/* 전등과 빛 */}
        <g data-testid="lamp">
          <line x1="120" y1="4" x2="120" y2="12" stroke="currentColor" strokeWidth="1.5" />
          <path d="M96 34 L144 34 L132 12 L108 12 Z" fill="#d1d5db" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <ellipse cx="120" cy="37" rx="8" ry="6" fill="#facc15" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="108,44 132,44 176,92 64,92" fill="#fde047" fillOpacity="0.28" />
        </g>
        <text x="150" y="26" fontSize="14" fontWeight="700" fill="currentColor">전등</text>

        {/* 투명 비닐 덮개: 병을 둘러싼 투명한 막. 점선 테두리와 반사광만 그린다. */}
        {film && (
          <g data-testid="film">
            <rect x="58" y="68" width="124" height="130" rx="22" fill="#bae6fd" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
            <path d="M68 90 Q68 78 80 76" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
            <path d="M68 106 L68 124" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
            <text x="186" y="94" fontSize="14" fontWeight="700" fill="currentColor">투명</text>
            <text x="186" y="110" fontSize="14" fontWeight="700" fill="currentColor">비닐</text>
          </g>
        )}

        {/* 페트병과 뚜껑 */}
        <path d={`M108 ${BODY.y - 14} L108 ${BODY.y} Q${BODY.x} ${BODY.y + 6} ${BODY.x} ${BODY.y + 20} L${BODY.x} ${BODY.y + BODY.h - 8} Q${BODY.x} ${BODY.y + BODY.h} ${BODY.x + 8} ${BODY.y + BODY.h} L${BODY.x + BODY.w - 8} ${BODY.y + BODY.h} Q${BODY.x + BODY.w} ${BODY.y + BODY.h} ${BODY.x + BODY.w} ${BODY.y + BODY.h - 8} L${BODY.x + BODY.w} ${BODY.y + 20} Q${BODY.x + BODY.w} ${BODY.y + 6} 132 ${BODY.y} L132 ${BODY.y - 14}`} data-testid="bottle" fill="#e0f2fe" fillOpacity="0.55" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <rect data-testid="cap" data-color={p.cap} x="106" y={BODY.y - 24} width="28" height="12" rx="3" fill={cap.fill} stroke={cap.stroke} strokeWidth="2" />

        {/* 병 속 디지털 온도계 */}
        <g data-testid="thermo">
          <rect x="94" y="122" width="52" height="26" rx="4" fill="#0f172a" stroke="currentColor" strokeWidth="1.5" />
          <text data-testid="bottle-temp" x="120" y="141" textAnchor="middle" fontSize="14" fontWeight="700" fill="#4ade80">{shownTemp(s)}°C</text>
          <line x1="120" y1="148" x2="120" y2="168" stroke="currentColor" strokeWidth="2" />
          <circle cx="120" cy="170" r="3" fill="currentColor" />
        </g>

        {/* 병 이름표: 뚜껑 색, 이산화 탄소 */}
        <line x1="66" y1="56" x2="105" y2={BODY.y - 20} stroke="currentColor" strokeWidth="1.2" />
        <text data-testid="cap-label" x="4" y="58" fontSize="14" fill="currentColor">{cap.name}</text>
        {co2 && <text data-testid="co2-label" x="120" y="216" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">이산화 탄소 +</text>}
      </svg>
      <p className="view-note" data-testid="bottle-note">{note}</p>
    </figure>
  );
}
