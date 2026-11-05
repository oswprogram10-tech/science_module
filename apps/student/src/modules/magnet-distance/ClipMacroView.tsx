import type { BetweenKind, MagnetCount, MagnetSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { BETWEEN_TEXT, MAGNET_TEXT, cmText, magnetNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 256;
/** 자석(과 매단 물체) 가운데의 x */
export const CX = 100;
/** 1 cm = 18 그림 단위. 5 cm = 90 */
export const PX_PER_CM = 18;
/** 클립 더미 맨 위의 y(자의 0 cm 눈금), 탁자 면의 y */
export const PILE_TOP = 176;
export const TABLE_Y = 208;
const MAG_W = 26;
const MAG_H = 44;
const ARM_Y = 16;
const POST_X = 232;
const RULER_X = 6;
const DIM_X = 46;

/** 사이 물체의 두께(그림 단위): 질감이 보이도록 실제보다 두껍게 그린다. 계산에는 쓰지 않는다. */
export const SHEET_T: Record<Exclude<BetweenKind, 'none'>, number> = { paper: 4, plastic: 6, iron: 8 };

/** 클립 한 개의 크기(그림 단위)와 줄 간격 */
const CLIP_W = 10;
const CLIP_H = 6;
const ROW_STEP = 5;

/** 한 줄에 놓는 클립 수: 자석 1개 3개, 2개(더 넓다) 4개 */
export const clipsPerRow = (magnets: MagnetCount) => (magnets === 2 ? 4 : 3);

/**
 * 자석(과 매단 물체) 맨 아래에 매달린 클립 n개의 자리. 맨 아래 가운데가 (0, 0)이고 y는 아래쪽이 +이다.
 * 첫 줄은 맨 아래 면에 바로 붙고, 다음 줄은 앞 줄의 클립에 걸려 송이 모양으로 매달린다.
 */
export function heldLayout(n: number, magnets: MagnetCount): { x: number; y: number }[] {
  const cap = clipsPerRow(magnets);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cap);
    const inRow = Math.min(cap, n - row * cap);
    const j = i - row * cap;
    // 줄마다 반 칸씩 번갈아 어긋나게 해 송이처럼 보이게 한다.
    const shift = row % 2 === 1 ? CLIP_W / 4 : 0;
    out.push({ x: (j - (inRow - 1) / 2) * CLIP_W + shift, y: 1 + row * ROW_STEP });
  }
  return out;
}

/** 더미에 흩어진 클립(위치 x, y, 기울기) */
const PILE: [number, number, number][] = [
  [-30, 30, -20], [-18, 24, 35], [-6, 20, -10], [8, 22, 25], [20, 26, -35], [32, 31, 10],
  [-24, 18, 70], [0, 11, 15], [14, 14, -60], [-12, 8, 40], [26, 18, 80], [-36, 26, 60],
];

export function Texture() {
  return (
    <defs>
      <pattern id="mg-paper" width="6" height="4" patternUnits="userSpaceOnUse">
        <rect width="6" height="4" fill="#fffdf2" />
        <path d="M0 1.5 H3 M3 3.5 H6" stroke="#9a8f6a" strokeWidth="0.8" />
      </pattern>
      <pattern id="mg-plastic" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#bfe3f5" />
        <rect width="2.2" height="6" fill="#ffffff" fillOpacity="0.85" />
      </pattern>
      <pattern id="mg-iron" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#4b5563" />
        <circle cx="3" cy="3" r="1.2" fill="#9ca3af" />
      </pattern>
    </defs>
  );
}

const SHEET_FILL: Record<Exclude<BetweenKind, 'none'>, string> = { paper: 'url(#mg-paper)', plastic: 'url(#mg-plastic)', iron: 'url(#mg-iron)' };
const SHEET_W: Record<Exclude<BetweenKind, 'none'>, number> = { paper: 60, plastic: 60, iron: 42 };

/** 막대자석 하나: 위 N(빨강), 아래 S(파랑). 글자는 흰색이라 어두운 화면에서도 읽힌다. */
function BarMagnet({ x, top, letters }: { x: number; top: number; letters: boolean }) {
  const half = MAG_H / 2;
  return (
    <g data-testid="bar-magnet">
      <rect x={x} y={top} width={MAG_W} height={half} rx="2" fill="#dc2626" stroke="currentColor" strokeWidth="1.5" />
      <rect x={x} y={top + half} width={MAG_W} height={half} rx="2" fill="#2563eb" stroke="currentColor" strokeWidth="1.5" />
      {letters && (
        <>
          <text x={x + MAG_W / 2} y={top + half / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">N</text>
          <text x={x + MAG_W / 2} y={top + half + half / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">S</text>
        </>
      )}
    </g>
  );
}

export function ClipMacroView({ trial, snapshot, values, experiment }: ViewProps<MagnetSample>) {
  const { magnets, between, gapCm } = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values, experiment);
  const held = Math.max(0, Math.round(s.clipsHeld));
  const bottomY = PILE_TOP - s.heightCm * PX_PER_CM;
  const sheetT = between === 'none' ? 0 : SHEET_T[between];
  const magBottom = bottomY - sheetT;
  const magTop = magBottom - MAG_H;
  const note = ran ? magnetNote(s) : '실험하면 자석이 클립 더미 위에서 내려갔다가 올라와요. 붙은 클립의 수를 세어 봐요.';
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;
  const layout = heldLayout(held, magnets);

  return (
    <figure className="view magnet-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`자석과 클립: ${MAGNET_TEXT[magnets]}, 클립 더미까지 ${gapCm} cm, 사이에 둔 물체 ${BETWEEN_TEXT[between]}. ${note}`}
      >
        <Texture />
        {/* 탁자와 스탠드 */}
        <line x1="0" y1={TABLE_Y} x2={W} y2={TABLE_Y} stroke="currentColor" strokeWidth="2" />
        <line x1={POST_X} y1="10" x2={POST_X} y2={TABLE_Y} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <rect x={POST_X - 14} y={TABLE_Y - 5} width="28" height="5" rx="1" fill="#94a3b8" stroke="currentColor" strokeWidth="1.5" />
        <line x1={POST_X} y1={ARM_Y} x2={CX} y2={ARM_Y} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <line data-testid="thread" x1={CX} y1={ARM_Y} x2={CX} y2={magTop} stroke="currentColor" strokeWidth="1.5" />

        {/* 자 (cm 눈금): 0 cm가 클립 더미 맨 위 */}
        <g data-testid="ruler">
          <rect x={RULER_X} y={PILE_TOP - 5 * PX_PER_CM - 4} width="24" height={5 * PX_PER_CM + 8} rx="2" fill="#fde68a" stroke="currentColor" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <g key={c}>
              <line x1="23" y1={PILE_TOP - c * PX_PER_CM} x2="30" y2={PILE_TOP - c * PX_PER_CM} stroke="#1d2733" strokeWidth="1.3" />
              <text x="14" y={PILE_TOP - c * PX_PER_CM + 5} textAnchor="middle" fontSize="14" fill="#1d2733">{c}</text>
              {c < 5 && <line x1="27" y1={PILE_TOP - (c + 0.5) * PX_PER_CM} x2="30" y2={PILE_TOP - (c + 0.5) * PX_PER_CM} stroke="#1d2733" strokeWidth="1" />}
            </g>
          ))}
        </g>
        <text x={RULER_X + 12} y={PILE_TOP - 5 * PX_PER_CM - 10} textAnchor="middle" fontSize="14" fill="currentColor">cm</text>

        {/* 거리 치수선: 자석(과 매단 물체) 맨 아래 ~ 클립 더미 맨 위 */}
        <g data-testid="dimension" data-height={s.heightCm.toFixed(2)} stroke="currentColor" strokeWidth="1.5" fill="none">
          <line x1={DIM_X} y1={bottomY} x2={DIM_X} y2={PILE_TOP} />
          <line x1={DIM_X - 5} y1={bottomY} x2={DIM_X + 5} y2={bottomY} />
          <line x1={DIM_X - 5} y1={PILE_TOP} x2={DIM_X + 5} y2={PILE_TOP} />
          <line x1={DIM_X + 5} y1={bottomY} x2={CX - 30} y2={bottomY} strokeDasharray="2 3" strokeOpacity="0.6" />
        </g>

        {/* 클립 더미 */}
        <path
          d={`M${CX - 48} ${TABLE_Y} C${CX - 38} 188 ${CX - 20} ${PILE_TOP} ${CX} ${PILE_TOP} C${CX + 20} ${PILE_TOP} ${CX + 38} 188 ${CX + 48} ${TABLE_Y} Z`}
          fill="#9ca3af"
          fillOpacity="0.3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
        <g data-testid="pile" fill="none" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.65">
          {PILE.map(([dx, dy, rot], i) => (
            <rect key={i} x={CX + dx - CLIP_W / 2} y={PILE_TOP + dy - CLIP_H / 2} width={CLIP_W} height={CLIP_H} rx="3" transform={`rotate(${rot} ${CX + dx} ${PILE_TOP + dy})`} />
          ))}
        </g>
        <text x={CX} y="228" textAnchor="middle" fontSize="14" fill="currentColor">클립</text>

        {/* 자석: 2개면 겹쳐 그린다 */}
        {magnets === 2 && <BarMagnet x={CX - MAG_W / 2 + 5} top={magTop} letters={false} />}
        <BarMagnet x={CX - MAG_W / 2 - (magnets === 2 ? 5 : 0)} top={magTop} letters />

        {/* 사이 물체: 자석 맨 아래에 붙어(또는 받쳐) 함께 움직인다 */}
        {between !== 'none' && (
          <g data-testid="between" data-kind={between}>
            <rect x={CX - SHEET_W[between] / 2} y={magBottom} width={SHEET_W[between]} height={sheetT} rx="1" fill={SHEET_FILL[between]} stroke="currentColor" strokeWidth="1.3" />
            <text x={CX + 36} y={magBottom + sheetT / 2 + 5} fontSize="14" fontWeight="700" fill="currentColor" {...halo}>{BETWEEN_TEXT[between]}</text>
          </g>
        )}

        {/* 붙은 클립: 맨 아래 면에 걸려 송이 모양으로 매달린다 */}
        <g data-testid="clips" data-count={held} fill="var(--card)" stroke="currentColor" strokeWidth="1.6">
          {layout.map((p, i) => (
            <rect key={i} x={CX + p.x - CLIP_W / 2} y={bottomY + p.y} width={CLIP_W} height={CLIP_H} rx="3" />
          ))}
        </g>

        <text data-testid="gap-label" x={CX} y="248" textAnchor="middle" fontSize="14" fill="currentColor">거리 {cmText(s.heightCm)} cm</text>
      </svg>
      <p className="view-note" data-testid="magnet-note">{note}</p>
    </figure>
  );
}
