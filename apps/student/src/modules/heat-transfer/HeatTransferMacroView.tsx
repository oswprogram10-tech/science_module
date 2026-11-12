import { HT_SPOT_AT, changeTimeOf, stickersOf, type HeatTransferSample, type HtColor, type HtSpot } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { COLOR_TEXT, MATERIAL_TEXT, SPOT_TEXT, clamp01, startSample, toParams, transferNote, transferResult } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 276;
/** 위에서 본 판과 붙임딱지 격자(7 × 7): 칸 간격 24, 딱지 한 변 18 */
export const PLATE = { x: 36, y: 64, w: 168, h: 168, pitch: 24, pad: 12, sticker: 18 };
/** 옆에서 본 비커 */
export const BEAKER = { x0: 44, x1: 196, top: 74, bottom: 212, surface: 94 };
export const BAND_Y = 106;
/** 붙임딱지 색(바뀌기 전)과 바뀐 뒤의 색 */
export const STICKER_FILL: Record<HtColor, string> = { pink: '#f9a8d4', blue: '#93c5fd' };
export const CHANGED_FILL = '#f8fafc';
export const DYE_FILL: Record<HtColor, string> = { pink: '#db2777', blue: '#1d4ed8' };
export const PLATE_FILL = { copper: '#c77d4a', iron: '#6b7280' } as const;

/** 칸 번호 → 판 위 가운데 좌표 */
export const stickerCenter = (col: number, row: number) => ({ x: PLATE.x + PLATE.pad + col * PLATE.pitch, y: PLATE.y + PLATE.pad + row * PLATE.pitch });

/** 비커 안에서 색소가 지나가는 길(꺾은선). 가장자리는 한 갈래, 가운데는 위에서 두 갈래로 나뉜다. */
export const dyePaths = (spot: HtSpot): [number, number][][] => {
  const bottom = BEAKER.bottom - 8;
  const right = BEAKER.x1 - 16;
  const left = BEAKER.x0 + 16;
  if (spot === 'edge') return [[[left, bottom], [left, BAND_Y], [right, BAND_Y], [right, bottom]]];
  const mid = (BEAKER.x0 + BEAKER.x1) / 2;
  return [
    [[mid, bottom], [mid, BAND_Y], [left, BAND_Y], [left, bottom]],
    [[mid, bottom], [mid, BAND_Y], [right, BAND_Y], [right, bottom]],
  ];
};

/** 꺾은선을 처음부터 길이의 s(0~1)만큼만 자른 점들 */
export const partialPath = (pts: [number, number][], s: number): [number, number][] => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  let left = clamp01(s) * lens.reduce((a, b) => a + b, 0);
  const out: [number, number][] = [pts[0]!];
  for (let i = 0; i < lens.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (left >= lens[i]!) {
      out.push(b);
      left -= lens[i]!;
    } else {
      const k = left / lens[i]!;
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
      break;
    }
  }
  return out;
};

const pointsAttr = (pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

export function HeatTransferMacroView({ trial, snapshot, values }: ViewProps<HeatTransferSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r = transferResult(values);
  const water = p.material === 'water';
  // 색 변화와 색소 길은 실행한 뒤에만 그린다.
  const note = ran ? transferNote(s, r, water) : '실험하면 열이 퍼지는 모습이 나타나요.';
  const spotText = SPOT_TEXT[water ? 'water' : 'plate'][p.heatAt];
  const stickers = stickersOf(p.heatAt);
  const spot = HT_SPOT_AT[p.heatAt];
  const flame = stickerCenter(spot.col, spot.row);
  const paths = dyePaths(p.heatAt);
  const candleX = (BEAKER.x0 + BEAKER.x1) / 2 + (p.heatAt === 'edge' ? -(BEAKER.x1 - BEAKER.x0) / 2 + 16 : 0);

  return (
    <figure className="view heat-transfer-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${water ? '옆에서 본 비커' : '위에서 본 판'}: ${MATERIAL_TEXT[p.material]}, ${spotText}를 데움. ${water ? '색소' : '열 붙임딱지'} 색 ${COLOR_TEXT[p.stickerColor]}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="material-label">{MATERIAL_TEXT[p.material]} · {spotText}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="color-label">{water ? '색소' : '열 붙임딱지'} 색: {COLOR_TEXT[p.stickerColor]}</text>
        {water ? (
          <g data-testid="heat-art" data-kind="water" data-heat={p.heatAt} data-color={p.stickerColor} data-front={s.front.toFixed(3)}>
            <rect x={BEAKER.x0} y={BEAKER.surface} width={BEAKER.x1 - BEAKER.x0} height={BEAKER.bottom - BEAKER.surface} fill="#8cc4ee" />
            <path d={`M${BEAKER.x0} ${BEAKER.top} V${BEAKER.bottom} H${BEAKER.x1} V${BEAKER.top}`} fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* 색소 알갱이는 데우는 곳 바닥에 놓여 있다. 색소 길(띠)은 실행한 뒤에만 그린다. */}
            <circle data-testid="dye-grain" cx={dyePaths(p.heatAt)[0]![0]![0]} cy={BEAKER.bottom - 8} r="4" fill={DYE_FILL[p.stickerColor]} />
            {ran &&
              paths.map((pts, i) => (
                <polyline key={i} data-testid="dye-band" data-branch={i} points={pointsAttr(partialPath(pts, s.front))} fill="none" stroke={DYE_FILL[p.stickerColor]} strokeOpacity="0.85" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            {/* 촛불 */}
            <g data-testid="candle">
              <path d={`M${candleX} 216 Q${candleX + 8} 226 ${candleX} 234 Q${candleX - 8} 226 ${candleX} 216 Z`} fill="#fb923c" stroke="#c2410c" strokeWidth="1.2" />
              <rect x={candleX - 7} y="234" width="14" height="22" fill="#fde68a" stroke="#374151" strokeWidth="1.2" />
            </g>
            <text x={candleX} y="272" fontSize="14" textAnchor="middle" fill="currentColor">촛불</text>
          </g>
        ) : (
          <g data-testid="heat-art" data-kind="plate" data-material={p.material} data-heat={p.heatAt} data-color={p.stickerColor} data-front={s.front.toFixed(3)}>
            <rect x={PLATE.x} y={PLATE.y} width={PLATE.w} height={PLATE.h} rx="6" fill={PLATE_FILL[p.material as 'copper' | 'iron']} stroke="currentColor" strokeWidth="2" />
            <circle data-testid="candle" cx={flame.x} cy={flame.y} r="15" fill="#fb923c" stroke="#c2410c" strokeWidth="2" />
            {stickers.map((st, i) => {
              const c = stickerCenter(st.col, st.row);
              const changed = ran && s.t >= changeTimeOf(st.frac, r.time);
              return (
                <rect
                  key={`${st.col}-${st.row}`}
                  data-testid="sticker"
                  data-order={i}
                  data-changed={changed ? 'true' : 'false'}
                  x={c.x - PLATE.sticker / 2}
                  y={c.y - PLATE.sticker / 2}
                  width={PLATE.sticker}
                  height={PLATE.sticker}
                  rx="3"
                  fill={changed ? CHANGED_FILL : STICKER_FILL[p.stickerColor]}
                  stroke="#374151"
                  strokeWidth="1.2"
                />
              );
            })}
            <text x="12" y="256" fontSize="14" fill="currentColor" data-testid="candle-caption">주황 원: 촛불(판 아래)</text>
          </g>
        )}
      </svg>
      <p className="view-note" data-testid="heat-transfer-note">{note}</p>
    </figure>
  );
}

