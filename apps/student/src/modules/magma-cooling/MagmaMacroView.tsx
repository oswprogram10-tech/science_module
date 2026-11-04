import type { MagmaSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { initialSample, magmaResult } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 296;
const CX = 120;
const RIM_Y = 150;
const RIM_RX = 90;
const RIM_RY = 22;
const IN_RX = 80;
const IN_RY = 17;
const SUPPORT_TOP = 196;
const SUPPORT_BOTTOM = 252;

const LIQUID = { white: '#fff1b8', black: '#4b5563' } as const;
const SOLID = { white: '#f4f1e8', black: '#1f2937' } as const;

/** 녹은 물질의 모양: 가장자리부터 굳어 안쪽의 녹은 부분(rx, ry)이 줄어든다. */
export const meltEllipse = (crystal: number) => {
  const c = Math.min(1, Math.max(0, crystal));
  return { rx: IN_RX * (1 - c), ry: IN_RY * (1 - c), liquidOpacity: 0.55 + 0.45 * c };
};

/** 아래 문구 */
export function magmaNote(snapshot: MagmaSample | null, solidS: number, startC: number): string {
  if (!snapshot) return `실험 전 · ${startC.toFixed(1)} °C`;
  if (snapshot.t >= solidS) return `다 굳었어요 · ${solidS.toFixed(1)}초`;
  return `${snapshot.tempC.toFixed(1)} °C · 굳는 중`;
}

const PLACE_TEXT = { ice: '얼음물 위', room: '실온', warm: '따뜻한 물 위' } as const;

function Support({ place }: { place: string }) {
  if (place === 'ice') {
    return (
      <g data-testid="support-ice">
        <rect x="20" y={SUPPORT_TOP} width="200" height={SUPPORT_BOTTOM - SUPPORT_TOP} rx="4" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.5" />
        {[[36, 200, 0], [70, 204, 14], [160, 200, -12], [192, 205, 10]].map(([x, y, r]) => (
          <rect key={`${x}`} x={x} y={y} width="22" height="20" rx="3" fill="#f0f9ff" stroke="#38bdf8" strokeWidth="1.5" transform={`rotate(${r} ${x! + 11} ${y! + 10})`} />
        ))}
      </g>
    );
  }
  if (place === 'warm') {
    return (
      <g data-testid="support-warm">
        <rect x="20" y={SUPPORT_TOP} width="200" height={SUPPORT_BOTTOM - SUPPORT_TOP} rx="4" fill="#fdba74" stroke="#c2410c" strokeWidth="1.5" />
        <g fill="none" stroke="#c2410c" strokeWidth="2" strokeLinecap="round">
          {[24, 216].map((x) => (
            <path key={x} d={`M${x} ${SUPPORT_TOP - 4} q-6 -9 0 -18 q6 -9 0 -18`} />
          ))}
        </g>
      </g>
    );
  }
  return null;
}

export function MagmaMacroView({ experiment, snapshot, values }: ViewProps<MagmaSample>) {
  const s = snapshot ?? initialSample(values, experiment);
  const { solidS } = magmaResult(values, experiment);
  const place = String(values.place) in PLACE_TEXT ? (String(values.place) as keyof typeof PLACE_TEXT) : 'room';
  const aluminum = values.dish === 'aluminum';
  const dishText = aluminum ? '알루미늄 접시' : '유리 접시';
  const color = values.color === 'black' ? 'black' : 'white';
  const { rx, ry, liquidOpacity } = meltEllipse(s.crystal);
  const note = magmaNote(snapshot, solidS, s.tempC);
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;
  const colorText = color === 'black' ? '검은색 색소를 넣음' : '흰색';
  const state = !snapshot ? '실험 전' : snapshot.t >= solidS ? '다 굳음' : s.crystal > 0 ? '굳는 중' : '녹아 있음';

  return (
    <figure className="view magma" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`녹은 물질: ${dishText}, ${PLACE_TEXT[place]}, ${values.grams} g, ${colorText}, ${state}, ${note}`}
      >
        <text x={CX} y="112" textAnchor="middle" fontSize="14" fill="currentColor">{dishText}</text>

        <Support place={place} />

        {/* 접시 몸통과 안쪽 바닥 */}
        <path
          d={`M${CX - RIM_RX} ${RIM_Y} L${CX - RIM_RX + 10} ${RIM_Y + 22} A${RIM_RX - 10} ${RIM_RY - 4} 0 0 0 ${CX + RIM_RX - 10} ${RIM_Y + 22} L${CX + RIM_RX} ${RIM_Y} Z`}
          data-testid="dish"
          data-dish={aluminum ? 'aluminum' : 'glass'}
          fill={aluminum ? '#cbd5e1' : '#bfdbfe'}
          fillOpacity={aluminum ? 1 : 0.35}
          stroke={aluminum ? '#64748b' : '#2563eb'}
          strokeWidth="2"
        />
        <ellipse cx={CX} cy={RIM_Y} rx={RIM_RX} ry={RIM_RY} fill={aluminum ? '#e2e8f0' : '#dbeafe'} fillOpacity={aluminum ? 1 : 0.35} stroke={aluminum ? '#64748b' : '#2563eb'} strokeWidth="2" />

        {/* 녹은 물질: 액체는 반투명, 굳을수록 불투명, 가장자리부터 굳는다 */}
        <g data-testid="melt" data-crystal={s.crystal.toFixed(3)} data-color={color}>
          <ellipse cx={CX} cy={RIM_Y} rx={IN_RX} ry={IN_RY} fill={LIQUID[color]} fillOpacity={liquidOpacity} />
          <path
            data-testid="melt-solid"
            fillRule="evenodd"
            fill={SOLID[color]}
            stroke="#6b7280"
            strokeWidth="1"
            d={`M${CX - IN_RX} ${RIM_Y} a${IN_RX} ${IN_RY} 0 1 0 ${2 * IN_RX} 0 a${IN_RX} ${IN_RY} 0 1 0 ${-2 * IN_RX} 0 Z${
              rx > 0.01 ? ` M${CX - rx} ${RIM_Y} a${rx} ${ry} 0 1 1 ${2 * rx} 0 a${rx} ${ry} 0 1 1 ${-2 * rx} 0 Z` : ''
            }`}
            opacity={s.crystal > 0 ? 1 : 0}
          />
        </g>

        <text x={CX} y="282" textAnchor="middle" fontSize="14" fill="currentColor" {...halo}>
          {place === 'room' ? '실온 (받침 없음)' : PLACE_TEXT[place]}
        </text>
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
