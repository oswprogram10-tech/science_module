import type { SoundTransmitSample, StBlock, StClock, StMedium } from '@sci/engine-physics';
import { ST_LEVEL_MAX } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { BLOCK_TEXT, CLOCK_TEXT, MEDIUM_TEXT, soundNote, soundResult, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 192;
export const CLOCK = { cx: 38, cy: 138, r: 17 };
/** 시계를 감싼 것의 바깥 사각형 */
export const WRAP = { x: 8, y: 104, w: 60, h: 66 };
/** 소음계 눈금판: 반원 가운데와 반지름 */
export const DIAL = { cx: 192, cy: 104, r: 30 };
export const CLOCK_FILL: Record<StClock, string> = { red: '#ef4444', blue: '#3b82f6' };

/** 소음계 눈금(0~10) → 바늘 끝 좌표. 0은 왼쪽 끝, 10은 오른쪽 끝이다. */
export const needleEnd = (level: number, len = DIAL.r - 4): { x: number; y: number } => {
  const k = Math.min(ST_LEVEL_MAX, Math.max(0, level)) / ST_LEVEL_MAX;
  const a = Math.PI * (1 - k);
  return { x: DIAL.cx + len * Math.cos(a), y: DIAL.cy - len * Math.sin(a) };
};

/** 시계 둘레에 그리는 감싼 것 */
function Wrap({ block }: { block: StBlock }) {
  if (block === 'none') return null;
  const { x, y, w, h } = WRAP;
  if (block === 'box') {
    return (
      <g data-testid="wrap" data-block="box" stroke="#92400e" strokeWidth="2">
        <rect x={x} y={y} width={w} height={h} rx="5" fill="#d6b98c" fillOpacity="0.55" />
        <line x1={x} y1={y + 12} x2={x + w} y2={y + 12} strokeWidth="1.5" />
      </g>
    );
  }
  if (block === 'sponge') {
    const pores: [number, number][] = [[16, 114], [30, 110], [48, 112], [60, 118], [14, 134], [62, 140], [16, 156], [30, 162], [46, 160], [60, 158]];
    return (
      <g data-testid="wrap" data-block="sponge" stroke="#b45309" strokeWidth="2">
        <rect x={x} y={y} width={w} height={h} rx="8" fill="#fde68a" fillOpacity="0.7" />
        {pores.map(([px, py]) => (
          <circle key={`${px}-${py}`} cx={px} cy={py} r="3" fill="none" strokeWidth="1.5" />
        ))}
      </g>
    );
  }
  const puffs: [number, number][] = [[14, 112], [30, 106], [46, 106], [62, 112], [66, 130], [62, 148], [60, 164], [44, 168], [28, 168], [12, 164], [10, 146], [10, 128]];
  return (
    <g data-testid="wrap" data-block="cotton" stroke="#64748b" strokeWidth="1.5" fill="#f1f5f9">
      {puffs.map(([px, py]) => (
        <circle key={`${px}-${py}`} cx={px} cy={py} r="10" />
      ))}
    </g>
  );
}

/** 알람 시계 */
function Clock({ color }: { color: StClock }) {
  const { cx, cy, r } = CLOCK;
  return (
    <g data-testid="clock" data-color={color} stroke="#1f2937" strokeWidth="1.5">
      <circle cx={cx - 12} cy={cy - r - 1} r="5" fill="#94a3b8" />
      <circle cx={cx + 12} cy={cy - r - 1} r="5" fill="#94a3b8" />
      <circle cx={cx} cy={cy} r={r} fill={CLOCK_FILL[color]} />
      <circle cx={cx} cy={cy} r={r - 6} fill="#ffffff" />
      <line x1={cx} y1={cy} x2={cx} y2={cy - 7} />
      <line x1={cx} y1={cy} x2={cx + 5} y2={cy + 2} />
    </g>
  );
}

/** 가운데에서 소리를 전하는 것. 소리 물결은 그리지 않는다. */
function MediumArt({ medium }: { medium: StMedium }) {
  if (medium === 'air') return <g data-testid="medium-art" data-medium="air" />;
  if (medium === 'water') {
    return (
      <g data-testid="medium-art" data-medium="water" stroke="currentColor" strokeWidth="2">
        <rect x="72" y="112" width="88" height="52" fill="#bae6fd" fillOpacity="0.85" />
      </g>
    );
  }
  if (medium === 'wood') {
    return (
      <g data-testid="medium-art" data-medium="wood" stroke="#78350f" strokeWidth="2">
        <rect x="70" y="132" width="102" height="16" fill="#b45309" />
        <line x1="82" y1="138" x2="130" y2="138" strokeWidth="1" opacity="0.6" />
        <line x1="100" y1="143" x2="156" y2="143" strokeWidth="1" opacity="0.6" />
      </g>
    );
  }
  return (
    <g data-testid="medium-art" data-medium="string" stroke="currentColor" strokeWidth="2">
      <polygon points="72,124 88,128 88,148 72,152" fill="#f1f5f9" />
      <polygon points="160,124 144,128 144,148 160,152" fill="#f1f5f9" />
      <line x1="88" y1="138" x2="144" y2="138" strokeWidth="1.5" />
    </g>
  );
}

export function SoundMacroView({ trial, snapshot, values }: ViewProps<SoundTransmitSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r = soundResult(values);
  // 실행하기 전에는 소음계 바늘이 0에 있다.
  const level = ran ? s.level : 0;
  const note = ran ? soundNote(s, r) : '실험하면 소음계 바늘이 움직여요.';
  const tip = needleEnd(level);
  const tickAt = (v: number) => {
    const a = needleEnd(v, DIAL.r);
    const b = needleEnd(v, DIAL.r - 6);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  };

  return (
    <figure className="view sound-transmit-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`왼쪽 알람 시계, 오른쪽 귀와 소음계. 소리를 전하는 것은 ${MEDIUM_TEXT[p.medium]}, 시계를 감싼 것은 ${BLOCK_TEXT[p.block]}, 알람 시계는 ${CLOCK_TEXT[p.clockColor]}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="medium-label">전하는 것: {MEDIUM_TEXT[p.medium]}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="block-label">감싼 것: {BLOCK_TEXT[p.block]}</text>
        <text x="12" y="58" fontSize="14" fill="currentColor" data-testid="clock-label">알람 시계: {CLOCK_TEXT[p.clockColor]}</text>
        <g data-testid="sound-art" data-medium={p.medium} data-block={p.block} data-clock={p.clockColor} data-level={level.toFixed(2)}>
          <Wrap block={p.block} />
          <Clock color={p.clockColor} />
          <MediumArt medium={p.medium} />
          {/* 귀 */}
          <g data-testid="ear" stroke="currentColor" strokeWidth="2" fill="#fcd7b0">
            <path d="M184 140 C172 140 172 164 184 170 C190 174 196 170 198 164 C204 156 202 142 192 138 C189 137 186 138 184 140 Z" />
            <path d="M186 148 C182 152 186 160 192 158" fill="none" strokeWidth="1.5" />
          </g>
          {/* 소음계 */}
          <g data-testid="meter" data-level={level.toFixed(2)}>
            <path d={`M${DIAL.cx - DIAL.r} ${DIAL.cy} A${DIAL.r} ${DIAL.r} 0 0 1 ${DIAL.cx + DIAL.r} ${DIAL.cy} Z`} fill="none" stroke="currentColor" strokeWidth="2" />
            {[0, 5, 10].map((v) => (
              <line key={v} {...tickAt(v)} stroke="currentColor" strokeWidth="1.5" />
            ))}
            <line data-testid="meter-needle" data-level={level.toFixed(2)} x1={DIAL.cx} y1={DIAL.cy} x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)} stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={DIAL.cx} cy={DIAL.cy} r="3" fill="#dc2626" />
            <text x={DIAL.cx - DIAL.r} y={DIAL.cy + 18} fontSize="14" fill="currentColor">0</text>
            <text x={DIAL.cx + DIAL.r} y={DIAL.cy + 18} fontSize="14" textAnchor="end" fill="currentColor">{ST_LEVEL_MAX}</text>
          </g>
        </g>
      </svg>
      <p className="view-note" data-testid="sound-note">{note}</p>
    </figure>
  );
}
