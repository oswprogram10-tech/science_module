import type { PhaseSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { PROCESS_TEXT, TUBE_TEXT, phaseNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 262;
/** 시험관: 바깥 왼쪽 x, 폭, 위쪽 끝 y. 아래는 반원 */
export const TUBE_X = 40;
export const TUBE_W = 40;
const TUBE_TOP = 30;
const TUBE_R = TUBE_W / 2;
const TUBE_STRAIGHT = 196;
/** 시험관 속 바닥(그림 단위)과 1 mL의 높이 */
export const BOT = 213;
export const PX_PER_ML = 5.5;
/** 비커(소금 얼음물 또는 따뜻한 물): 왼쪽·오른쪽 x, 위쪽 끝·바닥·수면 y */
const BK_L = 10;
const BK_R = 110;
const BK_TOP = 44;
const BK_BOTTOM = 246;
export const BATH_TOP = 84;
/** 높이 표시 글자가 시작하는 x */
const LABEL_X = 118;

const ICE_ABOVE = 0.09;

/** 시험관 속 물 높이(그림 단위 y) */
export const levelY = (volume: number) => BOT - volume * PX_PER_ML;

const tubePath = (inset: number) => {
  const l = TUBE_X + inset;
  const r = TUBE_X + TUBE_W - inset;
  const rad = TUBE_R - inset;
  return `M${l} ${TUBE_TOP} V${TUBE_STRAIGHT} A${rad} ${rad} 0 0 0 ${r} ${TUBE_STRAIGHT} V${TUBE_TOP}`;
};

const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;

export function FreezeMacroView({ trial, snapshot, values, experiment }: ViewProps<PhaseSample>) {
  const { process, startMl, tube } = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values, experiment);
  const frozen0 = process === 'melt' ? 1 : 0;
  const volume0 = startMl * (1 + ICE_ABOVE * frozen0);
  const iceH = s.frozen * startMl * (1 + ICE_ABOVE) * PX_PER_ML;
  const liquidH = (1 - s.frozen) * startMl * PX_PER_ML;
  const yStart = levelY(volume0);
  const yNow = levelY(s.volume);
  // 얼리기는 지금 높이가 처음 높이보다 위, 녹이기는 아래라서 두 글자가 겹치지 않게 위아래로 나눈다.
  const nowAbove = process === 'freeze';
  const note = ran ? phaseNote(s) : '실험하면 시험관 속 물의 높이와 저울의 숫자가 어떻게 달라지는지 볼 수 있어요.';
  const cold = process === 'freeze';
  const bathName = cold ? '소금 얼음물' : '따뜻한 물';

  return (
    <figure className="view freeze-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${bathName}에 담근 ${TUBE_TEXT[tube]}: ${PROCESS_TEXT[process]}, 처음 물의 양 ${startMl} mL. ${note}`}
      >
        <defs>
          <pattern id="fm-ice" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="8" height="8" fill="#dff1fb" />
            <rect width="2" height="8" fill="#ffffff" fillOpacity="0.9" />
            <circle cx="6" cy="4" r="0.9" fill="#8fc7e8" />
          </pattern>
          <clipPath id="fm-tube-clip">
            <path d={`${tubePath(3)} Z`} />
          </clipPath>
        </defs>

        {/* 비커와 그 속의 물: 얼리기는 소금 얼음물, 녹이기는 따뜻한 물 */}
        <g data-testid="bath" data-kind={cold ? 'cold' : 'warm'}>
          <rect x={BK_L} y={BATH_TOP} width={BK_R - BK_L} height={BK_BOTTOM - BATH_TOP} fill={cold ? '#b9def2' : '#fcd9a8'} />
          <line x1={BK_L} y1={BATH_TOP} x2={BK_R} y2={BATH_TOP} stroke={cold ? '#2b7aa8' : '#c2410c'} strokeWidth="2" />
          {cold &&
            [[16, 92], [90, 104], [92, 190], [15, 176]].map(([x, y], i) => (
              <rect key={i} data-testid="bath-ice" x={x} y={y} width="16" height="16" rx="3" fill="#f2faff" stroke="#2b7aa8" strokeWidth="1.5" transform={`rotate(${i * 14 - 10} ${x! + 8} ${y! + 8})`} />
            ))}
          {cold && [[30, 130], [96, 150], [24, 214], [98, 222], [30, 100]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" fill="#2b7aa8" />)}
          {!cold &&
            [[22, 120], [96, 130], [24, 200], [96, 196]].map(([x, y], i) => (
              <path key={i} d={`M${x! - 5} ${y} q2.5 -5 5 0 t5 0`} fill="none" stroke="#c2410c" strokeWidth="1.5" strokeLinecap="round" />
            ))}
        </g>
        <path d={`M${BK_L} ${BK_TOP} V${BK_BOTTOM} H${BK_R} V${BK_TOP}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <text x={(BK_L + BK_R) / 2} y={BK_BOTTOM - 6} textAnchor="middle" fontSize="14" fill="currentColor" {...halo}>{bathName}</text>

        {/* 시험관과 그 속의 물·얼음: 얼음은 아래부터 차오른다(녹이기는 반대) */}
        <path d={`${tubePath(0)} Z`} fill={tube === 'plastic' ? '#e6f4ea' : '#ffffff'} fillOpacity="0.55" data-testid="tube-body" data-tube={tube} />
        <g clipPath="url(#fm-tube-clip)" data-testid="tube-content" data-frozen={s.frozen.toFixed(3)} data-volume={s.volume.toFixed(2)}>
          {liquidH > 0.05 && <rect data-testid="tube-water" x={TUBE_X} y={BOT - iceH - liquidH} width={TUBE_W} height={liquidH + 1} fill="#4aa8e0" fillOpacity="0.85" />}
          {iceH > 0.05 && <rect data-testid="tube-ice" x={TUBE_X} y={BOT - iceH} width={TUBE_W} height={iceH + 8} fill="url(#fm-ice)" />}
          {iceH > 0.05 && liquidH > 0.05 && <line x1={TUBE_X} x2={TUBE_X + TUBE_W} y1={BOT - iceH} y2={BOT - iceH} stroke="#2b7aa8" strokeWidth="1.2" />}
        </g>
        <path d={tubePath(0)} fill="none" stroke="currentColor" strokeWidth={tube === 'plastic' ? 3 : 2} strokeLinejoin="round" />
        {tube === 'glass' && <path d={`M${TUBE_X + 7} ${TUBE_TOP + 14} V${TUBE_STRAIGHT - 24}`} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />}
        <line x1={TUBE_X - 3} y1={TUBE_TOP} x2={TUBE_X + TUBE_W + 3} y2={TUBE_TOP} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <text x={TUBE_X + TUBE_W + 8} y="38" fontSize="14" fill="currentColor">{TUBE_TEXT[tube]}</text>

        {/* 처음 높이(고무줄 표시선)와 지금 높이 */}
        <g data-testid="start-band" data-y={yStart.toFixed(1)}>
          <line x1={TUBE_X - 4} x2={LABEL_X - 4} y1={yStart} y2={yStart} stroke="#d97706" strokeWidth="2.5" />
          <text x={LABEL_X} y={nowAbove ? yStart + 16 : yStart - 4} fontSize="14" fill="currentColor">처음 높이</text>
        </g>
        <g data-testid="now-line" data-y={yNow.toFixed(1)}>
          <line x1={TUBE_X + 2} x2={LABEL_X - 4} y1={yNow} y2={yNow} stroke="#1d4ed8" strokeWidth="1.8" strokeDasharray="4 3" />
          <text x={LABEL_X} y={nowAbove ? yNow - 4 : yNow + 16} fontSize="14" fill="currentColor">지금 높이</text>
        </g>

        {/* 전자저울 */}
        <g data-testid="scale">
          <rect x="140" y="186" width="82" height="7" rx="2" fill="#9ca3af" stroke="currentColor" strokeWidth="1.5" />
          <rect x="130" y="193" width="102" height="52" rx="6" fill="#e5e7eb" stroke="currentColor" strokeWidth="2" />
          <rect x="140" y="199" width="82" height="24" rx="3" fill="#dcf2dc" stroke="#1d2733" strokeWidth="1.2" />
          <text data-testid="scale-value" x="181" y="217" textAnchor="middle" fontSize="16" fontWeight="700" fill="#14301a">{s.massG.toFixed(1)} g</text>
          <text x="181" y="238" textAnchor="middle" fontSize="14" fill="#1d2733">전자저울</text>
        </g>
      </svg>
      <p className="view-note" data-testid="freeze-note">{note}</p>
    </figure>
  );
}
