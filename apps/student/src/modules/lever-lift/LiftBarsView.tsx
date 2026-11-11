import { LIFT_X_MAX_CM, LIFT_Y_MAX_G, type LeverLiftSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { clamp01, startSample, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 190;
export const BAR = { x: 10, w: 220, h: 26 };
/** 막대 두 개의 위쪽 y */
export const ROW_Y = { force: 34, pull: 112 } as const;

/** 막대 채움 길이(그림 단위). 가로 범위를 넘으면 틀 안에서 멈춘다. */
export const barLength = (value: number, max: number) => BAR.w * clamp01(value / max);

export function LiftBarsView({ trial, snapshot, values }: ViewProps<LeverLiftSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  // 실행하기 전에는 막대를 채우지 않는다.
  const force = ran ? s.force : 0;
  const pull = ran ? s.t : 0;
  const note = ran ? `저울 눈금 ${Math.round(s.force)} g · 손으로 ${Math.round(s.t)} cm 당김` : '실험하면 두 막대가 채워져요.';

  return (
    <figure className="view lift-bars" aria-label="힘과 거리 보기">
      <figcaption>힘과 거리 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`저울 눈금과 손으로 당긴 거리를 막대로 견주어요. ${note}`} data-tool={p.tool}>
        <text x={BAR.x} y="20" fontSize="14" fontWeight="700" fill="currentColor">저울 눈금(g)</text>
        <rect x={BAR.x} y={ROW_Y.force} width={BAR.w} height={BAR.h} rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect data-testid="force-bar" data-value={force.toFixed(1)} x={BAR.x} y={ROW_Y.force} width={barLength(force, LIFT_Y_MAX_G).toFixed(1)} height={BAR.h} rx="4" fill="#2b7aa8" fillOpacity="0.85" />
        <text x={BAR.x} y={ROW_Y.force + BAR.h + 18} fontSize="14" fill="currentColor">0</text>
        <text x={BAR.x + BAR.w} y={ROW_Y.force + BAR.h + 18} fontSize="14" textAnchor="end" fill="currentColor">{LIFT_Y_MAX_G}</text>

        <text x={BAR.x} y="98" fontSize="14" fontWeight="700" fill="currentColor">손으로 당긴 거리(cm)</text>
        <rect x={BAR.x} y={ROW_Y.pull} width={BAR.w} height={BAR.h} rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect data-testid="pull-bar" data-value={pull.toFixed(1)} x={BAR.x} y={ROW_Y.pull} width={barLength(pull, LIFT_X_MAX_CM).toFixed(1)} height={BAR.h} rx="4" fill="#d97706" fillOpacity="0.85" />
        <text x={BAR.x} y={ROW_Y.pull + BAR.h + 18} fontSize="14" fill="currentColor">0</text>
        <text x={BAR.x + BAR.w} y={ROW_Y.pull + BAR.h + 18} fontSize="14" textAnchor="end" fill="currentColor">{LIFT_X_MAX_CM}</text>
      </svg>
      <p className="view-note" data-testid="lift-bars-note">{note}</p>
    </figure>
  );
}
