import { HOT_C, type ElectromagnetSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { initialSample, magnetResult } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 340;
const NAIL_Y = 96;
const HEAD_X = 64;
const TIP_X = 206;
const COIL_X0 = 84;
const COIL_X1 = 176;
const CLIP_MAX = 12;
const CLIP_Y0 = 100;
const CLIP_STEP = 10;
const COMPASS = { x: 32, y: 96, r: 27 };
const ROW_Y = 300; // 전지가 놓인 아래 줄
const SW_TOP = 190; // 스위치 위 단자
const SW_BOTTOM = 224;
const COPPER = '#b45309';
const HOT = '#dc2626';

/** 감은 횟수에 따른 코일 줄 수: 50·100·200회 → 6·10·16줄. */
export const coilLines = (turns: number) => (turns <= 50 ? 6 : turns <= 100 ? 10 : 16);

/** 그릴 클립 개수(최대 12개)와 다 못 그린 개수. */
export function clipDrawing(clips: number): { drawn: number; extra: number } {
  const n = Math.max(0, Math.round(clips));
  return { drawn: Math.min(CLIP_MAX, n), extra: Math.max(0, n - CLIP_MAX) };
}

/** 나침반 바늘 빨강(N) 끝이 가리키는 각(도, 위쪽이 0이고 시계 방향이 +). 꺼지면 북쪽(위). */
export function needleAngle(on: boolean, headPole: 'N' | 'S'): number {
  if (!on) return 0;
  // 빨강(N극) 바늘 끝: 머리가 N극이면 밀려나 왼쪽(−90°), S극이면 끌려와 오른쪽(+90°).
  return headPole === 'N' ? -90 : 90;
}

const dirOf = (deg: number) => ({ dx: Math.sin((deg * Math.PI) / 180), dy: -Math.cos((deg * Math.PI) / 180) });

function Cell({ x, y, reverse }: { x: number; y: number; reverse: boolean }) {
  const plusRight = !reverse;
  return (
    <g data-testid="cell">
      <rect x={plusRight ? x + 28 : x - 3} y={y - 4} width="3" height="8" fill="#1d2733" />
      <rect x={x} y={y - 9} width="28" height="18" rx="2" fill="#fde68a" stroke="currentColor" strokeWidth="1.5" />
      <text x={x + 7} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1d2733">{plusRight ? '−' : '+'}</text>
      <text x={x + 21} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1d2733">{plusRight ? '+' : '−'}</text>
    </g>
  );
}

export function MagnetMacroView({ experiment, snapshot, values }: ViewProps<ElectromagnetSample>) {
  const s = snapshot ?? initialSample(values, experiment);
  const { headPole } = magnetResult(values, experiment);
  const turns = Number(values.turns);
  const battery = values.battery;
  const straw = values.core === 'straw';
  const reverse = values.direction === 'reverse';
  const on = s.on >= 0.5;
  const hot = s.wireC >= HOT_C;
  const shownClips = Math.round(s.clips);
  const { drawn, extra } = clipDrawing(s.clips);
  const lines = coilLines(turns);
  const wireColor = hot ? HOT : COPPER;
  const angle = needleAngle(on, headPole);
  const { dx, dy } = dirOf(angle);
  const sub = `${on ? '스위치 켜짐' : '스위치 꺼짐'} · 클립 ${shownClips}개`;
  const note = hot ? `${sub} · ⚠ 에나멜선이 뜨거워요` : sub;
  const batteryText = battery === 'series' ? '전지 2개 직렬 연결' : battery === 'parallel' ? '전지 2개 병렬 연결' : '전지 1개';
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;

  return (
    <figure className="view magnet" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`전자석: ${straw ? '빨대만' : '철못'}, 에나멜선 ${turns}회, ${batteryText}, ${reverse ? '반대 방향' : '처음 방향'}, ${note}${on ? `, 못 머리 쪽 ${headPole}극` : ''}`}
      >
        {/* 나침반 */}
        <circle cx={COMPASS.x} cy={COMPASS.y} r={COMPASS.r} fill="#fff" stroke="currentColor" strokeWidth="1.5" />
        <g data-testid="needle" data-angle={angle} transform={`rotate(${angle} ${COMPASS.x} ${COMPASS.y})`}>
          <polygon points={`${COMPASS.x},${COMPASS.y - 22} ${COMPASS.x - 5},${COMPASS.y} ${COMPASS.x + 5},${COMPASS.y}`} fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
          <polygon points={`${COMPASS.x},${COMPASS.y + 22} ${COMPASS.x - 5},${COMPASS.y} ${COMPASS.x + 5},${COMPASS.y}`} fill="#fff" stroke="#374151" strokeWidth="1" />
        </g>
        <text x={COMPASS.x + dx * 14} y={COMPASS.y + dy * 14 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" {...halo}>N</text>
        <text x={COMPASS.x - dx * 14} y={COMPASS.y - dy * 14 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" {...halo}>S</text>
        <text x={COMPASS.x} y={COMPASS.y + COMPASS.r + 17} textAnchor="middle" fontSize="14" fill="currentColor">나침반</text>

        {/* 철못 또는 빨대 */}
        {straw ? (
          <rect data-testid="core-straw" x={HEAD_X + 8} y={NAIL_Y - 8} width={TIP_X - HEAD_X - 8} height="16" rx="3" fill="#d9f0c4" fillOpacity="0.8" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          <g data-testid="core-nail" fill="#9aa4ae" stroke="currentColor" strokeWidth="1.5">
            <rect x={HEAD_X} y={NAIL_Y - 12} width="8" height="24" rx="1" />
            <polygon points={`${HEAD_X + 8},${NAIL_Y - 6} ${TIP_X - 10},${NAIL_Y - 6} ${TIP_X},${NAIL_Y} ${TIP_X - 10},${NAIL_Y + 6} ${HEAD_X + 8},${NAIL_Y + 6}`} />
          </g>
        )}
        <text x={(COIL_X0 + COIL_X1) / 2} y={NAIL_Y - 30} textAnchor="middle" fontSize="14" fill="currentColor">{straw ? '빨대' : '철못'}</text>

        {/* 전선: 코일 양 끝 → 전지, 스위치 */}
        <g fill="none" stroke={wireColor} strokeWidth="2" data-testid="wires">
          <path d={`M${COIL_X0} ${NAIL_Y + 16} V${ROW_Y}`} />
          <path d={`M${COIL_X1} ${NAIL_Y + 16} V${SW_TOP}`} />
          <path d={`M${COIL_X1} ${SW_BOTTOM} V${ROW_Y}`} />
        </g>
        {/* 전지: 1개 / 직렬(일렬) / 병렬(위아래 나란히) */}
        <g fill="none" stroke={wireColor} strokeWidth="2">
          {battery === 'parallel' ? (
            <>
              <path d={`M${COIL_X0} ${ROW_Y} H104 M156 ${ROW_Y} H${COIL_X1}`} />
              <path d={`M104 ${ROW_Y - 16} V${ROW_Y + 16} M156 ${ROW_Y - 16} V${ROW_Y + 16}`} />
              <path d={`M104 ${ROW_Y - 16} H116 M144 ${ROW_Y - 16} H156 M104 ${ROW_Y + 16} H116 M144 ${ROW_Y + 16} H156`} />
            </>
          ) : battery === 'series' ? (
            <path d={`M${COIL_X0} ${ROW_Y} H94 M122 ${ROW_Y} H138 M166 ${ROW_Y} H${COIL_X1}`} />
          ) : (
            <path d={`M${COIL_X0} ${ROW_Y} H116 M144 ${ROW_Y} H${COIL_X1}`} />
          )}
        </g>
        {battery === 'parallel' ? (
          <>
            <Cell x={116} y={ROW_Y - 16} reverse={reverse} />
            <Cell x={116} y={ROW_Y + 16} reverse={reverse} />
          </>
        ) : battery === 'series' ? (
          <>
            <Cell x={94} y={ROW_Y} reverse={reverse} />
            <Cell x={138} y={ROW_Y} reverse={reverse} />
          </>
        ) : (
          <Cell x={116} y={ROW_Y} reverse={reverse} />
        )}

        {/* 스위치: 켜지면 닫힘, 아니면 열림 */}
        <g data-testid="switch" data-closed={on ? 'true' : 'false'}>
          <line
            x1={COIL_X1}
            y1={SW_BOTTOM}
            x2={on ? COIL_X1 : COIL_X1 - 18}
            y2={on ? SW_TOP : SW_TOP + 6}
            stroke={on ? '#15803d' : 'currentColor'}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx={COIL_X1} cy={SW_TOP} r="3.5" fill="currentColor" />
          <circle cx={COIL_X1} cy={SW_BOTTOM} r="3.5" fill="currentColor" />
        </g>
        <text x={COIL_X1 - 8} y={SW_BOTTOM + 22} textAnchor="end" fontSize="14" fill="currentColor">스위치</text>

        {/* 코일: 감은 횟수에 따라 줄 수가 다르다 */}
        <g data-testid="coil" data-lines={lines} stroke={wireColor} strokeWidth="2.2" strokeLinecap="round">
          {Array.from({ length: lines }, (_, i) => {
            const x = COIL_X0 + ((i + 0.5) * (COIL_X1 - COIL_X0)) / lines;
            return <line key={i} x1={x - 2.5} y1={NAIL_Y + 16} x2={x + 2.5} y2={NAIL_Y - 16} />;
          })}
        </g>

        {/* 못 끝에 붙은 클립 */}
        <g data-testid="clips" data-count={shownClips} fill="none" stroke="#4b5563" strokeWidth="1.8">
          {Array.from({ length: drawn }, (_, i) => (
            <rect key={i} x={TIP_X - 8} y={CLIP_Y0 + i * CLIP_STEP} width="16" height="12" rx="5" />
          ))}
        </g>
        {extra > 0 && (
          <text x={TIP_X} y={CLIP_Y0 + CLIP_MAX * CLIP_STEP + 22} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" {...halo}>+{extra}</text>
        )}
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
