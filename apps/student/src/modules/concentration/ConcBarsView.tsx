import type { ConcentrationResult, ConcentrationSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 196;
export const PLOT = { x0: 34, x1: 232, top: 40, bottom: 152 };
/** 한 번에 보여 주는 시행 수(가장 최근 것부터) */
export const MAX_BARS = 8;
export const LEVEL_MAX = 10;

/** 눈금(0~10) → 막대 높이(그림 단위) */
export const barHeight = (level: number) => (Math.min(LEVEL_MAX, Math.max(0, level)) / LEVEL_MAX) * (PLOT.bottom - PLOT.top);

export interface Bar {
  index: number;
  /** 막대가 나타내는 뜬 높이(눈금). 지금 재생 중인 시행은 그 순간의 값이다. */
  level: number;
  active: boolean;
}

/** 시행별 막대: 이미 끝난 시행은 결과의 뜬 높이, 화면에 보이는 시행은 지금 순간의 값 */
export function barsOf(trials: ViewProps<ConcentrationSample>['trials'], activeId: string | undefined, nowLevel: number): Bar[] {
  const list = (trials ?? []).slice(-MAX_BARS);
  return list.map((t) => {
    const active = t.id === activeId;
    return { index: t.index, level: active ? nowLevel : (t.result as ConcentrationResult).float, active };
  });
}

export function ConcBarsView({ trial, snapshot, trials }: ViewProps<ConcentrationSample>) {
  const bars = barsOf(trials, trial?.id, snapshot?.floatH ?? 0);
  const slot = (PLOT.x1 - PLOT.x0) / MAX_BARS;
  const w = Math.min(22, slot - 4);
  const note = bars.length === 0 ? '실험하면 시행마다 막대가 생겨요.' : `시행 ${bars.length}번의 뜬 높이를 막대로 견주어요.`;
  const summary = bars.map((b) => `${b.index}번 ${Math.round(b.level)}눈금`).join(', ');

  return (
    <figure className="view conc-bars" aria-label="시행별 막대 그래프">
      <figcaption>시행별 막대 그래프</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`시행별 방울토마토가 뜬 높이(눈금) 막대 그래프. ${bars.length === 0 ? '아직 시행이 없어요.' : summary}`}>
        <text x="8" y="16" fontSize="14" fontWeight="700" fill="currentColor">뜬 높이(눈금)</text>
        <rect x={PLOT.x0} y={PLOT.top} width={PLOT.x1 - PLOT.x0} height={PLOT.bottom - PLOT.top} fill="none" stroke="#999" />
        {[0, 5, 10].map((v) => {
          const y = PLOT.bottom - barHeight(v);
          return (
            <g key={v}>
              <line x1={PLOT.x0 - 4} y1={y} x2={PLOT.x0} y2={y} stroke="#666" />
              <line x1={PLOT.x0} y1={y} x2={PLOT.x1} y2={y} stroke="currentColor" opacity="0.12" />
              <text x={PLOT.x0 - 7} y={y + 5} fontSize="14" textAnchor="end" fill="currentColor">{v}</text>
            </g>
          );
        })}
        <g data-testid="conc-bars">
          {bars.map((b, i) => {
            const x = PLOT.x0 + slot * i + (slot - w) / 2;
            const h = barHeight(b.level);
            return (
              <g key={b.index} data-testid="conc-bar" data-trial={b.index} data-value={Math.round(b.level)}>
                <rect x={x} y={PLOT.bottom - h} width={w} height={h} fill="#d97706" fillOpacity={b.active ? 0.95 : 0.55} stroke="currentColor" strokeWidth={b.active ? 2 : 1} />
                <text x={x + w / 2} y={PLOT.bottom - h - 4} fontSize="14" textAnchor="middle" fill="currentColor">{Math.round(b.level)}</text>
                <text x={x + w / 2} y={PLOT.bottom + 17} fontSize="14" textAnchor="middle" fill="currentColor">{b.index}</text>
              </g>
            );
          })}
        </g>
        <text x={(PLOT.x0 + PLOT.x1) / 2} y={PLOT.bottom + 36} fontSize="14" textAnchor="middle" fill="currentColor">시행 번호</text>
      </svg>
      <p className="view-note" data-testid="conc-bars-note">{note}</p>
    </figure>
  );
}
