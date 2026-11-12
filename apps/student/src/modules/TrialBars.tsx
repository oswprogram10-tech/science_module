import type { Trial } from '@sci/runtime';
import type { ViewProps } from './types';

// 시행끼리 견주는 막대 그래프(x는 시행 번호, y는 눈금 0~10). 용액의 진하기 비교(ConcBarsView)와 같은 모양이다.
// 글자 14는 화면에서도 약 13 px 이상이다.
export const BARS_W = 240;
export const BARS_H = 196;
export const BARS_PLOT = { x0: 34, x1: 232, top: 40, bottom: 152 };
/** 한 번에 보여 주는 시행 수(가장 최근 것부터) */
export const BARS_MAX = 8;
export const BARS_LEVEL_MAX = 10;

/** 눈금(0~levelMax, 기본 0~10) → 막대 높이(그림 단위) */
export const barsHeight = (level: number, levelMax = BARS_LEVEL_MAX) => (Math.min(levelMax, Math.max(0, level)) / levelMax) * (BARS_PLOT.bottom - BARS_PLOT.top);

export interface TrialBar {
  index: number;
  /** 막대가 나타내는 눈금. 지금 재생 중인 시행은 그 순간의 값이다. */
  level: number;
  active: boolean;
}

/** 시행별 막대: 이미 끝난 시행은 결과의 눈금, 화면에 보이는 시행은 지금 순간의 값 */
export function trialBarsOf<S extends { t: number }>(trials: ViewProps<S>['trials'], activeId: string | undefined, nowLevel: number, resultLevel: (result: unknown) => number): TrialBar[] {
  const list: readonly Trial<S, unknown>[] = (trials ?? []).slice(-BARS_MAX);
  return list.map((t) => {
    const active = t.id === activeId;
    return { index: t.index, level: active ? nowLevel : resultLevel(t.result), active };
  });
}

export interface TrialBarsProps<S extends { t: number }> extends ViewProps<S> {
  /** 그림 이름(figcaption) */
  caption: string;
  /** 위쪽 제목과 접근성 이름에 쓰는 값 이름 */
  yTitle: string;
  /** data-testid 앞부분: `${testPrefix}-bars`, `${testPrefix}-bar`, `${testPrefix}-bars-note` */
  testPrefix: string;
  /** 지금 재생 중인 시행의 현재 눈금 */
  nowLevel: number;
  resultLevel: (result: unknown) => number;
  /** 막대 색(CSS 색) */
  barFill?: string;
  /** 막대 그래프 맨 위 값(기본 10) */
  levelMax?: number;
  /** 세로 눈금 값(기본 0, 5, 10) */
  ticks?: number[];
  /** 값 뒤에 붙는 단위 글자(접근성 이름용, 기본 '눈금') */
  unit?: string;
}

export function TrialBars<S extends { t: number }>({ trial, trials, caption, yTitle, testPrefix, nowLevel, resultLevel, barFill = '#d97706', levelMax = BARS_LEVEL_MAX, ticks = [0, 5, 10], unit = '눈금' }: TrialBarsProps<S>) {
  const bars = trialBarsOf<S>(trials, trial?.id, nowLevel, resultLevel);
  const P = BARS_PLOT;
  const slot = (P.x1 - P.x0) / BARS_MAX;
  const w = Math.min(22, slot - 4);
  const note = bars.length === 0 ? '실험하면 시행마다 막대가 생겨요.' : `시행 ${bars.length}번의 결과를 막대로 견주어요.`;
  const summary = bars.map((b) => `${b.index}번 ${Math.round(b.level)}${unit}`).join(', ');

  return (
    <figure className={`view ${testPrefix}-bars-view`} aria-label={caption}>
      <figcaption>{caption}</figcaption>
      <svg viewBox={`0 0 ${BARS_W} ${BARS_H}`} role="img" aria-label={`시행별 ${yTitle} 막대 그래프. ${bars.length === 0 ? '아직 시행이 없어요.' : summary}`}>
        <text x="8" y="16" fontSize="14" fontWeight="700" fill="currentColor">{yTitle}</text>
        <rect x={P.x0} y={P.top} width={P.x1 - P.x0} height={P.bottom - P.top} fill="none" stroke="#999" />
        {ticks.map((v) => {
          const y = P.bottom - barsHeight(v, levelMax);
          return (
            <g key={v}>
              <line x1={P.x0 - 4} y1={y} x2={P.x0} y2={y} stroke="#666" />
              <line x1={P.x0} y1={y} x2={P.x1} y2={y} stroke="currentColor" opacity="0.12" />
              <text x={P.x0 - 7} y={y + 5} fontSize="14" textAnchor="end" fill="currentColor">{v}</text>
            </g>
          );
        })}
        <g data-testid={`${testPrefix}-bars`}>
          {bars.map((b, i) => {
            const x = P.x0 + slot * i + (slot - w) / 2;
            const h = barsHeight(b.level, levelMax);
            return (
              <g key={b.index} data-testid={`${testPrefix}-bar`} data-trial={b.index} data-value={Math.round(b.level)}>
                <rect x={x} y={P.bottom - h} width={w} height={h} fill={barFill} fillOpacity={b.active ? 0.95 : 0.55} stroke="currentColor" strokeWidth={b.active ? 2 : 1} />
                <text x={x + w / 2} y={P.bottom - h - 4} fontSize="14" textAnchor="middle" fill="currentColor">{Math.round(b.level)}</text>
                <text x={x + w / 2} y={P.bottom + 17} fontSize="14" textAnchor="middle" fill="currentColor">{b.index}</text>
              </g>
            );
          })}
        </g>
        <text x={(P.x0 + P.x1) / 2} y={P.bottom + 36} fontSize="14" textAnchor="middle" fill="currentColor">시행 번호</text>
      </svg>
      <p className="view-note" data-testid={`${testPrefix}-bars-note`}>{note}</p>
    </figure>
  );
}
