import type { ReactElement } from 'react';
import { ARM_CM, LIFT_HEIGHT_CM, type LeverLiftSample, type LiftColor } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { COLOR_TEXT, TOOL_TEXT, armLine, clamp01, liftNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 204;
export const GROUND_Y = 178;
/** 그림 단위 1 cm: 지레 팔 */
const CM = 2;
/** 지레: 받침점 */
export const PIVOT = { x: 80, y: 160 } as const;
/** 지레: 처음 기울기(도): 물체 쪽이 내려가 있다. 다 들어 올리면 수평이다. */
export const LEVER_START_DEG = -20;
const BOX_W = 30;
const BOX_H = 26;
/** 빗면 그림: 높이(20 cm)는 36, 길이는 1 cm = 1.4 */
const RAMP_BASE_X = 20;
const RAMP_H = 36;
const RAMP_CM = 1.4;

export const BOX_FILL: Record<LiftColor, string> = { red: '#f87171', blue: '#60a5fa' };
export const BOX_STROKE: Record<LiftColor, string> = { red: '#991b1b', blue: '#1e40af' };

/** 지레의 기울기(도): 처음 −20°에서 다 당기면 0° */
export const leverAngle = (progress: number) => LEVER_START_DEG * (1 - clamp01(progress)) + 0;

/** 막대 위 받침점에서 d만큼(오른쪽이 +) 떨어진 점. angle은 도(시계 방향이 +). */
export function leverPoint(d: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: PIVOT.x + d * Math.cos(a), y: PIVOT.y + d * Math.sin(a) };
}

/** 빗면 그림의 밑변 길이 */
export const rampBase = (lengthCm: number) => lengthCm * RAMP_CM;
/** 빗면 위 위치(0~1) → 그림 좌표(빗면 위의 점) */
export function rampPoint(lengthCm: number, s: number): { x: number; y: number } {
  const b = rampBase(lengthCm);
  return { x: RAMP_BASE_X + b * s, y: GROUND_Y - RAMP_H * s };
}

function Hand({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="hand" fill="#fcd7b0" stroke="#7c4a1d" strokeWidth="1.5">
      <circle cx={x} cy={y} r="8" />
      <rect x={x - 5} y={y + 5} width="10" height="7" rx="2" />
    </g>
  );
}

/** 위가 고리, 아래가 갈고리인 세로 용수철저울. (x, top)은 몸통 위 가운데. */
function Scale({ x, top }: { x: number; top: number }) {
  return (
    <g data-testid="spring-scale" fill="#e5e7eb" stroke="#374151" strokeWidth="1.5">
      <rect x={x - 7} y={top} width="14" height="26" rx="3" />
      <line x1={x - 4} y1={top + 8} x2={x + 4} y2={top + 8} />
      <line x1={x - 4} y1={top + 14} x2={x + 4} y2={top + 14} />
      <line x1={x - 4} y1={top + 20} x2={x + 4} y2={top + 20} />
      <path d={`M${x} ${top + 26} v4 q-3 0 -3 3 q0 3 3 3`} fill="none" />
    </g>
  );
}

function Box({ x, y, color }: { x: number; y: number; color: LiftColor }) {
  // (x, y)는 상자 아래 가운데
  return <rect data-testid="load-box" data-color={color} x={x - BOX_W / 2} y={y - BOX_H} width={BOX_W} height={BOX_H} rx="2" fill={BOX_FILL[color]} stroke={BOX_STROKE[color]} strokeWidth="2" />;
}

export function LiftMacroView({ trial, snapshot, values }: ViewProps<LeverLiftSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const progress = clamp01(s.liftCm / LIFT_HEIGHT_CM);
  const note = ran ? liftNote(s) : '실험하면 상자를 들어 올릴 때 저울 눈금과 손으로 당긴 거리를 알 수 있어요.';
  const reading = ran ? `저울 눈금: ${Math.round(s.force)} g` : '저울 눈금: ?';
  const armCm = p.tool === 'none' ? 0 : ARM_CM[p.tool][p.arm];

  let scene: ReactElement;
  if (p.tool === 'none') {
    // 손이 저울을 쥐고 상자를 곧바로 들어 올린다(1 cm = 2).
    const boxY = GROUND_Y - 2 * s.liftCm;
    const scaleTop = boxY - BOX_H - 36;
    scene = (
      <g data-testid="lift-art" data-tool="none" data-lift={s.liftCm.toFixed(2)}>
        <line x1="120" y1={scaleTop + 30} x2="120" y2={boxY - BOX_H} stroke="currentColor" strokeWidth="1.5" />
        <Scale x={120} top={scaleTop} />
        <Hand x={120} y={scaleTop - 10} />
        <Box x={120} y={boxY} color={p.color} />
      </g>
    );
  } else if (p.tool === 'lever') {
    const a = leverAngle(progress);
    const left = leverPoint(-20 * CM, a);
    const right = leverPoint(armCm * CM, a);
    scene = (
      <g data-testid="lift-art" data-tool="lever" data-lift={s.liftCm.toFixed(2)} data-arm-cm={armCm}>
        <path data-testid="fulcrum" d={`M${PIVOT.x} ${PIVOT.y + 2} L${PIVOT.x - 14} ${GROUND_Y} L${PIVOT.x + 14} ${GROUND_Y} Z`} fill="#cbd5e1" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />
        <line data-testid="lever-bar" x1={leverPoint(-24 * CM, a).x} y1={leverPoint(-24 * CM, a).y} x2={right.x + 6 * Math.cos((a * Math.PI) / 180)} y2={right.y + 6 * Math.sin((a * Math.PI) / 180)} stroke="#a16207" strokeWidth="6" strokeLinecap="round" />
        <circle cx={PIVOT.x} cy={PIVOT.y} r="3.5" fill="#475569" />
        <Box x={left.x} y={left.y - 3} color={p.color} />
        <line x1={right.x} y1={right.y - 30} x2={right.x} y2={right.y} stroke="currentColor" strokeWidth="1.5" />
        <Scale x={right.x} top={right.y - 56} />
        <Hand x={right.x} y={right.y - 66} />
      </g>
    );
  } else {
    // 빗면: 상자를 빗면을 따라 끌어 올린다. 빗면의 높이는 20 cm(36)로 고정이다.
    const b = rampBase(armCm);
    const phi = (Math.atan2(RAMP_H, b) * 180) / Math.PI;
    const pos = 0.1 + 0.62 * progress;
    const q = rampPoint(armCm, pos);
    const hand = { x: RAMP_BASE_X + b + 4, y: GROUND_Y - RAMP_H - 26 };
    const rad = (phi * Math.PI) / 180;
    // 상자 앞(빗면 위쪽) 모서리에서 손까지 줄을 건다. 저울은 줄 가운데쯤에 달린다.
    const front = { x: q.x + 17 * Math.cos(rad) - 13 * Math.sin(rad), y: q.y - 17 * Math.sin(rad) - 13 * Math.cos(rad) };
    const ang = (Math.atan2(hand.y - front.y, hand.x - front.x) * 180) / Math.PI;
    const mid = { x: front.x + (hand.x - front.x) * 0.45, y: front.y + (hand.y - front.y) * 0.45 };
    scene = (
      <g data-testid="lift-art" data-tool="ramp" data-lift={s.liftCm.toFixed(2)} data-arm-cm={armCm}>
        <path data-testid="ramp-surface" d={`M${RAMP_BASE_X} ${GROUND_Y} L${RAMP_BASE_X + b} ${GROUND_Y - RAMP_H} L${RAMP_BASE_X + b} ${GROUND_Y} Z`} fill="#d6b27c" stroke="#7c5a2a" strokeWidth="2" strokeLinejoin="round" />
        <g transform={`translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) rotate(${(-phi).toFixed(2)})`}>
          <Box x={0} y={-1} color={p.color} />
        </g>
        <line x1={front.x} y1={front.y} x2={hand.x} y2={hand.y} stroke="currentColor" strokeWidth="1.5" />
        <g transform={`translate(${mid.x.toFixed(2)} ${mid.y.toFixed(2)}) rotate(${(ang + 90).toFixed(2)})`}>
          <Scale x={0} top={-13} />
        </g>
        <Hand x={hand.x} y={hand.y} />
      </g>
    );
  }

  return (
    <figure className="view lift-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${TOOL_TEXT[p.tool]}로 ${COLOR_TEXT[p.color]}를 20 cm 들어 올려요. ${armLine(p.tool, p.arm)}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="tool-label">{TOOL_TEXT[p.tool]} · {COLOR_TEXT[p.color]}</text>
        <text x="12" y="38" fontSize="14" fill="currentColor" data-testid="arm-label">{armLine(p.tool, p.arm)}</text>
        <line x1="4" y1={GROUND_Y} x2={W - 4} y2={GROUND_Y} stroke="#64748b" strokeWidth="2" />
        {scene}
        <text x="12" y="198" fontSize="14" fill="currentColor" data-testid="scale-reading">{reading}</text>
      </svg>
      <p className="view-note" data-testid="lift-note">{note}</p>
    </figure>
  );
}
