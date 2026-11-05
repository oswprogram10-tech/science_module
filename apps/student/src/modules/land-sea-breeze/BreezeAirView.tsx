import type { BreezeSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { useLoopPhase, usePrefersReducedMotion } from '../transpiration/motion';
import { IDLE_SAMPLE } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 212;
/** 상자 단면 틀, 모래·물 윗면과 바닥 */
const BOX = { x: 8, y: 26, w: 224, h: 150 };
const SURF = 150;
/** 공기 흐름 고리: 따뜻한 쪽 기둥과 차가운 쪽 기둥의 x, 위쪽·바닥 쪽 흐름의 y */
const X_NEAR = 64;
const X_FAR = 176;
const Y_TOP = 64;
const Y_BOT = 134;
/** 고리 한 바퀴 길이 */
const SIDE = Y_BOT - Y_TOP;
const SPAN = X_FAR - X_NEAR;
export const LOOP_LEN = 2 * (SIDE + SPAN);
export const ARROW_COUNT = 8;
/** |wind| = 1일 때 화살표가 초당 도는 바퀴 수. 실제 빠르기는 |wind|에 비례한다. */
export const LAPS_PER_S = 0.25;
/** 온도 차가 이보다 작으면 어느 쪽이 따뜻한지 가리지 않는다 */
const EQUAL_C = 0.05;

/** 따뜻한 쪽이 왼쪽(육지)이면 left. 같으면 null */
export const warmSide = (diff: number): 'left' | 'right' | null => (Math.abs(diff) < EQUAL_C ? null : diff > 0 ? 'left' : 'right');

/** 고리 위의 자리(0~1 → x, y, 방향 각도). 따뜻한 쪽에서 올라가 위쪽은 차가운 쪽으로, 내려와 바닥 쪽은 따뜻한 쪽으로 돌아온다. 따뜻한 쪽이 오른쪽이면 좌우를 뒤집는다. */
export function loopPoint(u: number, warm: 'left' | 'right'): { x: number; y: number; angle: number } {
  const d = (((u % 1) + 1) % 1) * LOOP_LEN;
  let x: number;
  let y: number;
  let angle: number;
  if (d < SIDE) {
    x = X_NEAR;
    y = Y_BOT - d;
    angle = -90;
  } else if (d < SIDE + SPAN) {
    x = X_NEAR + (d - SIDE);
    y = Y_TOP;
    angle = 0;
  } else if (d < 2 * SIDE + SPAN) {
    x = X_FAR;
    y = Y_TOP + (d - SIDE - SPAN);
    angle = 90;
  } else {
    x = X_FAR - (d - 2 * SIDE - SPAN);
    y = Y_BOT;
    angle = 180;
  }
  if (warm === 'right') {
    const mirrored = 180 - angle;
    return { x: W - x, y, angle: mirrored > 180 ? mirrored - 360 : mirrored };
  }
  return { x, y, angle };
}

const fix = (n: number) => n.toFixed(1);

export function BreezeAirView({ trial, snapshot, playhead }: ViewProps<BreezeSample>) {
  const reduced = usePrefersReducedMotion();
  const ran = trial !== undefined;
  // 실행 전에는 어느 쪽이 따뜻한지 드러나지 않도록 아무것도 그리지 않는다.
  const s: BreezeSample = ran ? (snapshot ?? IDLE_SAMPLE) : IDLE_SAMPLE;
  const warm = ran ? warmSide(s.diff) : null;
  const last = trial ? (trial.samples as BreezeSample[]).at(-1)!.t : 0;
  const speed = Math.abs(s.wind);
  // 공기가 움직이는 동안(재생 중이고 플레이헤드가 끝에 닿기 전)에만 움직인다. 움직임 줄이기이면 언제나 멈춰 있다.
  const moving = warm !== null && !reduced && speed > 1e-9 && playhead < last - 1e-9;
  const phase = useLoopPhase(moving, LAPS_PER_S * speed);
  const note = !ran
    ? '실험하면 공기가 어느 쪽으로 움직이는지 볼 수 있어요.'
    : warm === null
      ? '두 쪽의 온도가 같아서 공기가 한쪽으로 움직이지 않아요.'
      : '땅 가까이에서는 공기가 차가운 쪽에서 따뜻한 쪽으로 옮겨 가요.';
  const warmX = warm === 'right' ? W - X_NEAR : X_NEAR;
  const coolX = warm === 'right' ? W - X_FAR : X_FAR;
  const corners = [loopPoint(0, warm ?? 'left'), loopPoint(SIDE / LOOP_LEN, warm ?? 'left'), loopPoint((SIDE + SPAN) / LOOP_LEN, warm ?? 'left'), loopPoint((2 * SIDE + SPAN) / LOOP_LEN, warm ?? 'left')];
  const loopPath = `M${corners.map((c) => `${fix(c.x)} ${fix(c.y)}`).join(' L')} Z`;

  return (
    <figure className="view breeze-air" aria-label="공기의 움직임 보기">
      <figcaption>공기의 움직임 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`상자 단면 그림: ${warm ? `${warm === 'left' ? '육지(모래)' : '바다(물)'} 쪽이 더 따뜻하고, 그 위에서 공기가 위로 올라가요. 위쪽 공기는 차가운 쪽으로 가고, 바닥 근처 공기는 차가운 쪽에서 따뜻한 쪽으로 움직여요.` : '실험하면 공기의 움직임이 화살표로 보여요.'} ${note}`}
      >
        {/* 따뜻한 쪽과 차가운 쪽의 바탕색(실행한 뒤에만) */}
        {warm && (
          <g data-testid="air-tint">
            <rect x={warm === 'left' ? BOX.x : BOX.x + BOX.w / 2} y={BOX.y} width={BOX.w / 2} height={BOX.h} fill="#f97316" fillOpacity="0.16" />
            <rect x={warm === 'left' ? BOX.x + BOX.w / 2 : BOX.x} y={BOX.y} width={BOX.w / 2} height={BOX.h} fill="#3b82f6" fillOpacity="0.14" />
          </g>
        )}
        {/* 모래(육지)와 물(바다) */}
        <rect x={BOX.x} y={SURF} width={BOX.w / 2} height={BOX.y + BOX.h - SURF} fill="#d9a45b" stroke="#8a5a2b" strokeWidth="1.5" />
        <rect x={BOX.x + BOX.w / 2} y={SURF} width={BOX.w / 2} height={BOX.y + BOX.h - SURF} fill="#7cc4ee" stroke="#2f6fa6" strokeWidth="1.5" />
        <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <text x="64" y="198" textAnchor="middle" fontSize="14" fill="currentColor">육지 (모래)</text>
        <text x="176" y="198" textAnchor="middle" fontSize="14" fill="currentColor">바다 (물)</text>

        {warm && (
          <g data-testid="air-loop" data-warm={warm} data-running={moving ? 'true' : 'false'} data-speed={speed.toFixed(2)}>
            <path d={loopPath} fill="none" stroke="currentColor" strokeWidth={1 + 1.5 * speed} strokeOpacity="0.35" strokeLinejoin="round" />
            {Array.from({ length: ARROW_COUNT }, (_, i) => {
              const { x, y, angle } = loopPoint(i / ARROW_COUNT + phase, warm);
              return (
                <polygon key={i} data-testid="air-arrow" data-x={fix(x)} data-y={fix(y)} points="-6,-6 7,0 -6,6" transform={`translate(${fix(x)} ${fix(y)}) rotate(${fix(angle)})`} fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
              );
            })}
            <text data-testid="label-warm" x={warmX} y="46" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">따뜻한 쪽</text>
            <text data-testid="label-cool" x={coolX} y="46" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">차가운 쪽</text>
            <text data-testid="label-floor" x="120" y={Y_BOT - 11} textAnchor="middle" fontSize="14" fill="currentColor">바닥 근처 바람</text>
          </g>
        )}
      </svg>
      <p className="view-note" data-testid="breeze-air-note">{note}</p>
    </figure>
  );
}
