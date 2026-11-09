import type { PhaseSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { useLoopPhase, usePrefersReducedMotion } from '../transpiration/motion';
import { particleCount, ROW_SIZE, startSample, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 226;
const BOX = { x: 8, y: 34, w: 224, h: 158 };
/** 가운데 x와 맨 아래 줄의 y */
const CX = 120;
const Y_BOTTOM = 176;
/** 알갱이 반지름 */
export const R = 8;
/** 이웃 알갱이 사이 간격(그림 단위): 얼음이 액체보다 조금 넓다 */
export const GAP_ICE = 34;
export const GAP_LIQUID = 31;
/** 액체가 조금씩 움직이는 폭과 빠르기(초당 바퀴 수) */
const WOBBLE = 1.6;
const WOBBLE_SPEED = 1.2;
/** 액체의 불규칙한 흩어짐(그림 단위, 난수 없이 고정된 값) */
const JITTER = 3;

/** 육각 배치에서 줄 사이 간격 / 이웃 사이 간격 */
const HEX = Math.sqrt(3) / 2;

export interface Pt { x: number; y: number }

/** 얼음 배치의 i번째 자리: 일정한 육각 무늬(줄마다 반 칸씩 어긋난다). 맨 아래 줄부터 채운다. */
export function iceSlot(i: number): Pt {
  const row = Math.floor(i / ROW_SIZE);
  const col = i % ROW_SIZE;
  const shift = row % 2 === 1 ? GAP_ICE / 4 : -GAP_ICE / 4;
  return { x: CX + (col - (ROW_SIZE - 1) / 2) * GAP_ICE + shift, y: Y_BOTTOM - row * GAP_ICE * HEX };
}

/** 액체 배치의 i번째 자리: 조금 더 가깝고 불규칙하다. */
export function liquidSlot(i: number): Pt {
  const row = Math.floor(i / ROW_SIZE);
  const col = i % ROW_SIZE;
  const shift = row % 2 === 1 ? GAP_LIQUID / 4 : -GAP_LIQUID / 4;
  const jx = Math.sin(i * 12.9898 + 1.7) * JITTER;
  const jy = Math.cos(i * 78.233 + 0.9) * JITTER;
  return { x: CX + (col - (ROW_SIZE - 1) / 2) * GAP_LIQUID + shift + jx, y: Y_BOTTOM - row * GAP_LIQUID * HEX + jy };
}

/** 얼음 배치인 알갱이 수 */
export const iceCount = (frozen: number, n: number) => Math.round(Math.min(1, Math.max(0, frozen)) * n);

/** 알갱이 n개의 자리: 얼음은 아래부터 차오르고(녹이기는 위부터 풀리고) 나머지는 액체 배치다. phase는 액체가 흔들리는 위상(0~1). */
export function layoutParticles(n: number, frozen: number, phase = 0): { x: number; y: number; ice: boolean }[] {
  const k = iceCount(frozen, n);
  return Array.from({ length: n }, (_, i) => {
    if (i < k) return { ...iceSlot(i), ice: true };
    const p = liquidSlot(i);
    return { x: p.x + WOBBLE * Math.sin(2 * Math.PI * (phase + i * 0.37)), y: p.y + WOBBLE * Math.cos(2 * Math.PI * (phase + i * 0.61)), ice: false };
  });
}

export function ParticleView({ trial, snapshot, values, experiment, playhead }: ViewProps<PhaseSample>) {
  const reduced = usePrefersReducedMotion();
  const { startMl } = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values, experiment);
  const last = trial ? (trial.samples as PhaseSample[]).at(-1)!.t : 0;
  // 실험 중(플레이헤드가 끝에 닿기 전)에만 액체가 움직인다. 움직임 줄이기이면 언제나 멈춰 있다.
  const running = ran && !reduced && playhead < last - 1e-9;
  const phase = useLoopPhase(running, WOBBLE_SPEED);
  const n = particleCount(startMl);
  const parts = layoutParticles(n, s.frozen, phase);
  const k = iceCount(s.frozen, n);
  const state = k === 0 ? '모두 물(액체)' : k === n ? '모두 얼음(고체)' : '물(액체)과 얼음(고체)이 섞여 있음';
  const bonds: [Pt, Pt][] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const a = iceSlot(i);
      const b = iceSlot(j);
      if (Math.hypot(a.x - b.x, a.y - b.y) < GAP_ICE * 1.05) bonds.push([a, b]);
    }
  }
  const note = ran ? '얼음이 될 때 알갱이 수는 같고, 알갱이 사이가 조금 넓어져요.' : '실험하면 물이 얼거나 얼음이 녹는 동안 알갱이가 어떻게 달라지는지 볼 수 있어요.';

  return (
    <figure className="view freeze-particles" aria-label="알갱이 보기">
      <figcaption>알갱이 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`물 알갱이 ${n}개를 그린 그림: ${state}. 액체일 때는 불규칙하게 가깝게, 얼음일 때는 육각 무늬로 놓여요.`}
      >
        <text data-testid="particle-count" x={W / 2} y="24" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">알갱이 수 {n}개</text>
        <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <g data-testid="ice-bonds" stroke="#0369a1" strokeWidth="1.6" opacity="0.5">
          {bonds.map(([a, b], i) => (
            <line key={i} x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={b.x.toFixed(1)} y2={b.y.toFixed(1)} />
          ))}
        </g>
        <g data-testid="particles" data-count={n} data-ice={k} data-running={running ? 'true' : 'false'}>
          {parts.map((p, i) => (
            <circle
              key={i}
              data-testid="particle"
              data-state={p.ice ? 'ice' : 'liquid'}
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r={R}
              fill={p.ice ? '#e0f2fe' : '#3b82f6'}
              fillOpacity={p.ice ? 1 : 0.85}
              stroke={p.ice ? '#0369a1' : '#1e40af'}
              strokeWidth="2"
            />
          ))}
        </g>
        {/* 라벨 */}
        <circle cx="16" cy="212" r="6" fill="#3b82f6" fillOpacity="0.85" stroke="#1e40af" strokeWidth="2" />
        <text x="28" y="217" fontSize="14" fill="currentColor">물(액체)</text>
        <circle cx="122" cy="212" r="6" fill="#e0f2fe" stroke="#0369a1" strokeWidth="2" />
        <text x="134" y="217" fontSize="14" fill="currentColor">얼음(고체)</text>
      </svg>
      <p className="view-note" data-testid="particle-note">{note}</p>
    </figure>
  );
}
