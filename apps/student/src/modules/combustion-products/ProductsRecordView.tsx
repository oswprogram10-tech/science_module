import type { CombustionProductsResult, CombustionProductsSample, CpOutcome, CpTest } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { BURN_TEXT, LIME_CLEAR, LIME_MILK, TEST_SHORT, clamp01, outcomeName, outcomeNow, paperFill, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
/** 한 번에 보여 주는 시행 수(가장 최근 것부터) */
export const MAX_ROWS = 5;
export const ROW = { top: 34, pitch: 44, swatchW: 28, swatchH: 26 };
export const H = ROW.top + MAX_ROWS * ROW.pitch + 4;

export interface RecordRow {
  index: number;
  burnMin: number;
  test: CpTest;
  outcome: CpOutcome;
  /** 색 칸을 채우는 값: 종이는 붉은 정도(0~1), 석회수는 뿌연 정도를 0~1로 */
  level: number;
  active: boolean;
}

/** 시행마다 한 줄: 끝난 시행은 결과로, 화면에 보이는 시행은 지금 순간의 모습으로 */
export function rowsOf(trials: ViewProps<CombustionProductsSample>['trials'], activeId: string | undefined, now: CombustionProductsSample | null): RecordRow[] {
  return (trials ?? []).slice(-MAX_ROWS).map((t) => {
    const v = toParams(t.values);
    if (t.id === activeId && now !== null) {
      return { index: t.index, burnMin: v.burnMin, test: v.test, outcome: outcomeNow(now, v.test), level: v.test === 'paper' ? now.red : clamp01(now.cloud / 10), active: true };
    }
    const r = t.result as CombustionProductsResult;
    return { index: t.index, burnMin: v.burnMin, test: v.test, outcome: r.result, level: v.test === 'paper' ? (r.result === 'paperRed' ? 1 : 0) : clamp01((r.cloud ?? 0) / 10), active: false };
  });
}

export function ProductsRecordView({ trial, snapshot, trials, values }: ViewProps<CombustionProductsSample>) {
  const rows = rowsOf(trials, trial?.id, snapshot);
  const p = toParams(values);
  const note = rows.length === 0 ? '실험하면 시행마다 검사 결과가 기록돼요.' : `시행 ${rows.length}번의 검사 결과를 기록했어요. 지금 고른 검사: ${TEST_SHORT[p.test]}`;
  const summary = rows.map((r) => `${r.index}번 ${BURN_TEXT[r.burnMin]} ${TEST_SHORT[r.test]} ${outcomeName(r.outcome)}`).join(', ');

  return (
    <figure className="view products-record" aria-label="검사 결과 기록">
      <figcaption>검사 결과 기록</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`시행마다 태운 시간과 검사 결과를 적은 기록. ${rows.length === 0 ? '아직 시행이 없어요.' : summary}`}>
        <text x="4" y="18" fontSize="14" fontWeight="700" fill="currentColor">시행별 검사 결과</text>
        <g data-testid="record-rows">
          {rows.map((r, i) => {
            const y = ROW.top + i * ROW.pitch;
            return (
              <g key={r.index} data-testid="record-row" data-trial={r.index} data-burn={r.burnMin} data-test={r.test} data-outcome={r.outcome}>
                {r.test === 'paper' ? (
                  <rect data-testid="record-swatch" data-fill={paperFill(r.level)} x="4" y={y} width={ROW.swatchW} height={ROW.swatchH} rx="3" fill={paperFill(r.level)} stroke="currentColor" strokeWidth={r.active ? 2.5 : 1.5} />
                ) : (
                  <g data-testid="record-swatch" data-level={r.level.toFixed(2)}>
                    <rect x="4" y={y} width={ROW.swatchW} height={ROW.swatchH} rx="3" fill={LIME_CLEAR} fillOpacity="0.55" />
                    <rect x="4" y={y} width={ROW.swatchW} height={ROW.swatchH} rx="3" fill={LIME_MILK} fillOpacity={r.level * 0.95} stroke="currentColor" strokeWidth={r.active ? 2.5 : 1.5} />
                  </g>
                )}
                <text x="40" y={y + 13} fontSize="14" fill="currentColor">{r.index}회 · {BURN_TEXT[r.burnMin]}</text>
                <text data-testid="record-name" x="40" y={y + 33} fontSize="14" fontWeight="700" fill="currentColor">{TEST_SHORT[r.test]}: {outcomeName(r.outcome)}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <p className="view-note" data-testid="record-note">{note}</p>
    </figure>
  );
}
