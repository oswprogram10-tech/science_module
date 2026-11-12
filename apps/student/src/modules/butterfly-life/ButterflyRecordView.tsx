import type { ButterflyLifeResult, ButterflyLifeSample } from '@sci/engine-life';
import { BL_X_MAX, BL_Y_MAX_MM } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { toParams } from './initial';

// 지금까지 관찰한 날의 몸 길이만 점으로 찍고 잇는 기록 그래프(관찰하지 않은 날은 그리지 않는다). 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 196;
export const PLOT = { x0: 40, x1: 228, top: 40, bottom: 150 };
export const X_TICKS = [0, 10, 20, 30] as const;
export const Y_TICKS = [0, 10, 20, 30] as const;

export const dayX = (day: number) => PLOT.x0 + ((PLOT.x1 - PLOT.x0) * day) / BL_X_MAX;
export const lengthY = (mm: number) => PLOT.bottom - ((PLOT.bottom - PLOT.top) * Math.min(BL_Y_MAX_MM, Math.max(0, mm))) / BL_Y_MAX_MM;

export interface RecordPoint {
  day: number;
  length: number;
  /** 지금 화면에 보이는 시행의 점 */
  active: boolean;
}

/**
 * 기록 점: 시행마다 (관찰한 날, 몸 길이). 같은 날을 여러 번 관찰했으면 점 하나로 모으고, 날 순서로 늘어놓는다.
 * 지금 재생 중인 시행은 관찰한 날에 닿은 뒤(스냅샷에 몸 길이가 생긴 뒤)에만 점을 찍는다.
 */
export function recordPoints(trials: ViewProps<ButterflyLifeSample>['trials'], activeId: string | undefined, snapshot: ButterflyLifeSample | null): RecordPoint[] {
  const byDay = new Map<number, RecordPoint>();
  for (const t of trials ?? []) {
    const active = t.id === activeId;
    if (active && !(snapshot !== null && Number.isFinite(snapshot.length))) continue;
    const day = toParams(t.values).day;
    const prev = byDay.get(day);
    byDay.set(day, { day, length: (t.result as ButterflyLifeResult).length, active: active || (prev?.active ?? false) });
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

export function ButterflyRecordView({ trial, snapshot, trials }: ViewProps<ButterflyLifeSample>) {
  const points = recordPoints(trials, trial?.id, snapshot);
  const note = points.length === 0 ? '실험하면 관찰한 날의 점이 찍혀요.' : `관찰한 ${points.length}개의 날을 점으로 찍고 이었어요.`;
  const summary = points.map((q) => `${q.day}일째 ${q.length} mm`).join(', ');

  return (
    <figure className="view life-record-view" aria-label="관찰 기록 그래프">
      <figcaption>관찰 기록 그래프</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`관찰한 날에 따른 몸 길이 기록 그래프. ${points.length === 0 ? '아직 관찰한 날이 없어요.' : summary}`}>
        <text x="8" y="16" fontSize="14" fontWeight="700" fill="currentColor">몸 길이(mm)</text>
        <rect x={PLOT.x0} y={PLOT.top} width={PLOT.x1 - PLOT.x0} height={PLOT.bottom - PLOT.top} fill="none" stroke="#999" />
        {Y_TICKS.map((v) => (
          <g key={`y${v}`}>
            <line x1={PLOT.x0 - 4} y1={lengthY(v)} x2={PLOT.x0} y2={lengthY(v)} stroke="#666" />
            <line x1={PLOT.x0} y1={lengthY(v)} x2={PLOT.x1} y2={lengthY(v)} stroke="currentColor" opacity="0.12" />
            <text x={PLOT.x0 - 7} y={lengthY(v) + 5} fontSize="14" textAnchor="end" fill="currentColor">{v}</text>
          </g>
        ))}
        {X_TICKS.map((v) => (
          <g key={`x${v}`}>
            <line x1={dayX(v)} y1={PLOT.bottom} x2={dayX(v)} y2={PLOT.bottom + 4} stroke="#666" />
            <text x={dayX(v)} y={PLOT.bottom + 19} fontSize="14" textAnchor="middle" fill="currentColor">{v}</text>
          </g>
        ))}
        {points.length >= 2 && <polyline data-testid="life-line" points={points.map((q) => `${dayX(q.day).toFixed(1)},${lengthY(q.length).toFixed(1)}`).join(' ')} fill="none" stroke="#0f766e" strokeWidth="2" />}
        <g data-testid="life-dots">
          {points.map((q) => (
            <g key={q.day} data-testid="life-dot" data-day={q.day} data-value={q.length}>
              {q.active && <circle cx={dayX(q.day)} cy={lengthY(q.length)} r="8" fill="none" stroke="currentColor" strokeWidth="2" />}
              <circle cx={dayX(q.day)} cy={lengthY(q.length)} r="4.5" fill="#0f766e" stroke="currentColor" strokeWidth="1" />
            </g>
          ))}
        </g>
        <text x={(PLOT.x0 + PLOT.x1) / 2} y={PLOT.bottom + 38} fontSize="14" textAnchor="middle" fill="currentColor">관찰한 날(일째)</text>
      </svg>
      <p className="view-note" data-testid="life-record-note">{note}</p>
    </figure>
  );
}
