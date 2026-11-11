import type { PositionTimeSample } from '@sci/engine-physics';
import { flashPositions } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { OBJECT_TEXT, metersText, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
/** 기록 칸은 0초부터 10초까지 11개가 가장 많다. */
export const MAX_ROWS = 11;
export const ROW = { top: 40, pitch: 20 };
export const H = ROW.top + MAX_ROWS * ROW.pitch + 4;

/** 지금까지 남긴 기록: 1초마다 한 줄씩, 지금 시각을 지난 것까지만 */
export function logRows(object: ReturnType<typeof toParams>['object'], watchS: number, now: Pick<PositionTimeSample, 't'> | null): { t: number; posM: number }[] {
  if (now === null) return [];
  return flashPositions(object, watchS).filter((f) => f.t <= now.t + 1e-9);
}

export function PositionLogView({ trial, snapshot, values }: ViewProps<PositionTimeSample>) {
  const p = toParams(values);
  const rows = logRows(p.object, p.watchS, trial !== undefined ? snapshot : null);
  const note = rows.length === 0 ? '실험하면 1초마다 위치가 기록돼요.' : `${OBJECT_TEXT[p.object]}의 위치를 1초마다 기록했어요.`;
  const summary = rows.map((r) => `${r.t}초 ${metersText(r.posM)} m`).join(', ');

  return (
    <figure className="view position-log" aria-label="위치 기록표">
      <figcaption>위치 기록표</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`1초마다 잰 위치 기록. ${rows.length === 0 ? '아직 기록이 없어요.' : summary}`}>
        <text x="8" y="18" fontSize="14" fontWeight="700" fill="currentColor">시간(초)</text>
        <text x="120" y="18" fontSize="14" fontWeight="700" fill="currentColor">위치(m)</text>
        <line x1="4" y1="26" x2={W - 4} y2="26" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <g data-testid="log-rows">
          {rows.map((r, i) => {
            const y = ROW.top + i * ROW.pitch;
            return (
              <g key={r.t} data-testid="log-row" data-t={r.t} data-pos={metersText(r.posM)}>
                <text x="8" y={y + 12} fontSize="14" fill="currentColor">{r.t}</text>
                <text x="120" y={y + 12} fontSize="14" fill="currentColor">{metersText(r.posM)}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <p className="view-note" data-testid="log-note">{note}</p>
    </figure>
  );
}
