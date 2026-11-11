import type { ReactElement } from 'react';
import type { SoundVibrationSample, VibObject, VibSeed } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { OBJECT_TEXT, SEED_TEXT, soundLine, startSample, toParams, vibNote } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 204;
export const GROUND_Y = 178;
/** 좁쌀이 튄 높이 1 mm = 그림 단위 4 */
export const MM = 4;
export const GRAIN_R = 4;
export const GRAIN_COUNT = 7;
/** 좁쌀마다 튀는 높이의 비율(가장 높은 것이 튄 높이와 같다) */
export const GRAIN_FACTOR = [1, 0.78, 0.92, 0.66, 0.86, 0.72, 0.95] as const;
/** 좁쌀이 놓이는 면의 높이(y)와 가로 범위 */
export const SURFACE: Record<VibObject, { y: number; x0: number; x1: number }> = {
  drum: { y: 150, x0: 88, x1: 152 },
  fork: { y: 118, x0: 94, x1: 146 },
  speaker: { y: 122, x0: 92, x1: 148 },
};
export const SEED_FILL: Record<VibSeed, string> = { yellow: '#facc15', white: '#ffffff' };

/** i번째 좁쌀의 x */
export const grainX = (object: VibObject, i: number) => {
  const s = SURFACE[object];
  return s.x0 + ((s.x1 - s.x0) * i) / (GRAIN_COUNT - 1);
};
/** i번째 좁쌀의 중심 y. bounceMm는 그 순간 좁쌀 높이(mm). */
export const grainY = (object: VibObject, i: number, bounceMm: number) => SURFACE[object].y - GRAIN_R - bounceMm * MM * GRAIN_FACTOR[i]!;

/** 떨림 표시(물결 테두리): 물체 양옆에 그리는 겹 물결 */
function Waves({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  const mid = (y0 + y1) / 2;
  const wave = (x: number, dir: 1 | -1, k: number) => `M${x + dir * k * 6} ${mid - 14} q${dir * 4} 7 0 14 q${-dir * 4} 7 0 14`;
  return (
    <g data-testid="vib-marks" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round">
      {[1, 2].map((k) => (
        <path key={`l${k}`} d={wave(x0, -1, k)} />
      ))}
      {[1, 2].map((k) => (
        <path key={`r${k}`} d={wave(x1, 1, k)} />
      ))}
    </g>
  );
}

function Hand({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="vib-hand" fill="#fcd7b0" stroke="#7c4a1d" strokeWidth="1.5">
      <rect x={x - 3} y={y - 7} width="26" height="14" rx="6" />
      <line x1={x + 7} y1={y - 7} x2={x + 7} y2={y + 7} />
      <line x1={x + 14} y1={y - 7} x2={x + 14} y2={y + 7} />
    </g>
  );
}

function ObjectArt({ object }: { object: VibObject }) {
  if (object === 'drum') {
    return (
      <g data-testid="vib-object" data-object="drum" stroke="currentColor" strokeWidth="2">
        <rect x="80" y="150" width="80" height="28" fill="#cbd5e1" />
        <line x1="80" y1="158" x2="160" y2="158" strokeWidth="1.5" />
        <line x1="80" y1="170" x2="160" y2="170" strokeWidth="1.5" />
        <ellipse cx="120" cy="150" rx="40" ry="5" fill="#f1f5f9" />
      </g>
    );
  }
  if (object === 'fork') {
    return (
      <g data-testid="vib-object" data-object="fork" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M110 120 V160 Q110 170 120 170 Q130 170 130 160 V120" />
        <line x1="120" y1="170" x2="120" y2={GROUND_Y} />
        <line x1="92" y1="118" x2="148" y2="118" stroke="#64748b" />
      </g>
    );
  }
  return (
    <g data-testid="vib-object" data-object="speaker" stroke="currentColor" strokeWidth="2">
      <rect x="84" y="122" width="72" height="56" rx="4" fill="#cbd5e1" />
      <circle cx="120" cy="156" r="17" fill="#94a3b8" />
      <circle cx="120" cy="156" r="6" fill="#475569" />
    </g>
  );
}

const BOUNDS: Record<VibObject, { x0: number; x1: number; y0: number; y1: number }> = {
  drum: { x0: 80, x1: 160, y0: 150, y1: 178 },
  fork: { x0: 100, x1: 140, y0: 118, y1: 170 },
  speaker: { x0: 84, x1: 156, y0: 122, y1: 178 },
};

export function VibMacroView({ trial, snapshot, values }: ViewProps<SoundVibrationSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  // 실행하기 전에는 좁쌀이 가만히 있고, 손도 떨림 표시도 없다.
  const bounce = ran ? s.bounceMm : 0;
  const note = ran ? vibNote(s) : '실험하면 물체 위의 좁쌀이 어떻게 되는지 볼 수 있어요.';
  const b = BOUNDS[p.object];
  const sounding = ran && p.sound === 'on';
  const hand: ReactElement | null = ran ? <Hand x={b.x1 + (sounding ? 16 : 8)} y={(b.y0 + b.y1) / 2} /> : null;

  return (
    <figure className="view vib-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${OBJECT_TEXT[p.object]} 위의 ${SEED_TEXT[p.seed]} 일곱 알. ${soundLine(p)}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="object-label">{OBJECT_TEXT[p.object]} · {SEED_TEXT[p.seed]}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="sound-label">{soundLine(p)}</text>
        <line x1="4" y1={GROUND_Y} x2={W - 4} y2={GROUND_Y} stroke="#64748b" strokeWidth="2" />
        <g data-testid="vib-art" data-object={p.object} data-sound={p.sound} data-bounce={bounce.toFixed(2)}>
          <ObjectArt object={p.object} />
          {sounding && <Waves {...b} />}
          {hand}
          <g data-testid="grains" data-seed={p.seed}>
            {Array.from({ length: GRAIN_COUNT }, (_, i) => (
              <circle key={i} data-testid="grain" cx={grainX(p.object, i)} cy={grainY(p.object, i, bounce).toFixed(2)} r={GRAIN_R} fill={SEED_FILL[p.seed]} stroke="#374151" strokeWidth="1.5" />
            ))}
          </g>
        </g>
      </svg>
      <p className="view-note" data-testid="vib-note">{note}</p>
    </figure>
  );
}
