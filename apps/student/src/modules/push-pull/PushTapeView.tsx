import { PUSH_Y_MAX_CM, type PushPullSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { startSample } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 120;
export const TAPE = { x: 10, per: 2.4, y: 74 };
export const TAPE_LABELS = [0, 30, 60, 90] as const;

/** 거리(cm) → 줄자 위의 x */
export const tapeX = (cm: number) => TAPE.x + cm * TAPE.per;

export function PushTapeView({ trial, snapshot, values }: ViewProps<PushPullSample>) {
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const d = Math.min(PUSH_Y_MAX_CM, Math.max(0, s.distanceCm));
  const note = ran ? `출발점에서 ${Math.round(s.distanceCm)} cm` : '실험하면 줄자로 움직인 거리를 잴 수 있어요.';
  const x1 = tapeX(d);

  return (
    <figure className="view push-tape" aria-label="줄자로 재기">
      <figcaption>줄자로 재기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`줄자로 출발점에서 물체까지의 거리를 재요. ${note}`}>
        <text x={TAPE.x} y="18" fontSize="14" fontWeight="700" fill="currentColor">출발점에서 떨어진 거리(cm)</text>
        {ran && (
          <text x={TAPE.x} y="44" fontSize="14" fill="currentColor" data-testid="tape-label">{Math.round(s.distanceCm)} cm</text>
        )}
        {/* 실행하기 전에는 거리 표시를 그리지 않는다. */}
        {ran && (
          <g data-testid="tape-bracket" data-dist={s.distanceCm.toFixed(2)} stroke="#d97706" strokeWidth="3" strokeLinecap="round">
            <line x1={TAPE.x} y1="58" x2={x1} y2="58" />
            <line x1={TAPE.x} y1="52" x2={TAPE.x} y2="64" />
            <line x1={x1} y1="52" x2={x1} y2="64" />
          </g>
        )}
        <line x1={TAPE.x} y1={TAPE.y} x2={tapeX(PUSH_Y_MAX_CM)} y2={TAPE.y} stroke="currentColor" strokeWidth="2" />
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1={tapeX(i * 10)} y1={TAPE.y} x2={tapeX(i * 10)} y2={TAPE.y + (i % 2 === 0 ? 10 : 6)} stroke="currentColor" strokeWidth="1.5" />
        ))}
        {TAPE_LABELS.map((v) => (
          <text key={v} x={tapeX(v)} y={TAPE.y + 28} textAnchor={v === 0 ? 'start' : v === PUSH_Y_MAX_CM ? 'end' : 'middle'} fontSize="14" fill="currentColor">{v}</text>
        ))}
      </svg>
      <p className="view-note" data-testid="push-tape-note">{note}</p>
    </figure>
  );
}
