import type { AcidBaseMixResult, AcidBaseMixSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { COLOR_HEX, colorFor, colorName, dropsNow, scaleText, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
/** 한 번에 보여 주는 시행 수(가장 최근 것부터) */
export const MAX_ROWS = 5;
export const ROW = { top: 46, pitch: 46, cellW: 26, cellH: 20 };
export const H = ROW.top + MAX_ROWS * ROW.pitch + 4;
/** 방울 수 0~40을 가로 위치로: 0방울은 x0, 40방울은 x1 */
export const AXIS = { x0: 52, x1: 220, max: 40 };
export const dropX = (drops: number) => AXIS.x0 + (drops / AXIS.max) * (AXIS.x1 - AXIS.x0);

export interface StripRow {
  index: number;
  drops: number;
  color: ReturnType<typeof colorFor>;
  active: boolean;
}

/** 시행마다 한 줄: 끝난 시행은 결과의 방울 수와 색, 화면에 보이는 시행은 지금 순간의 방울 수와 색 */
export function rowsOf(trials: ViewProps<AcidBaseMixSample>['trials'], activeId: string | undefined, now: AcidBaseMixSample | null): StripRow[] {
  return (trials ?? []).slice(-MAX_ROWS).map((t) => {
    const v = toParams(t.values);
    const active = t.id === activeId && now !== null;
    if (active) {
      const d = dropsNow(now!);
      return { index: t.index, drops: d, color: colorFor(d, v.direction, v.indicator), active };
    }
    return { index: t.index, drops: v.drops, color: (t.result as AcidBaseMixResult).color, active: false };
  });
}

/** 글자가 그림 밖으로 나가지 않게 중심 x를 맞춘다(글자 폭은 한글 14, 공백 4로 넉넉히 어림). */
const clampX = (cx: number, label: string) => {
  const w = [...label].reduce((s, ch) => s + (ch === ' ' ? 4 : 14), 0);
  return Math.min(W - 4 - w / 2, Math.max(4 + w / 2, cx));
};

export function MixStripView({ trial, snapshot, trials, values }: ViewProps<AcidBaseMixSample>) {
  const rows = rowsOf(trials, trial?.id, snapshot);
  const p = toParams(values);
  const note = rows.length === 0 ? '실험하면 시행마다 색 칸이 찍혀요.' : `시행 ${rows.length}번의 지시약 색을 방울 수 자리에 찍었어요.`;
  const summary = rows.map((r) => `${r.index}번 ${r.drops}방울 ${colorName(r.color)}`).join(', ');

  return (
    <figure className="view mix-strip" aria-label="색 띠 기록">
      <figcaption>색 띠 기록</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`시행마다 넣은 방울 수 자리에 지시약 색을 찍은 기록. ${rows.length === 0 ? '아직 시행이 없어요.' : summary}`}>
        <text x="4" y="16" fontSize="14" fontWeight="700" fill="currentColor">넣은 방울 수</text>
        {[0, 10, 20, 30, 40].map((d) => (
          <text key={d} x={dropX(d)} y="36" fontSize="14" textAnchor="middle" fill="currentColor">{d}</text>
        ))}
        <g data-testid="strip-rows">
          {rows.map((r, i) => {
            const y = ROW.top + i * ROW.pitch;
            const cx = dropX(r.drops);
            const name = colorName(r.color);
            return (
              <g key={r.index} data-testid="strip-row" data-trial={r.index} data-drops={r.drops} data-color={r.color}>
                <text x="4" y={y + 15} fontSize="14" fill="currentColor">{r.index}회</text>
                <line x1={AXIS.x0} y1={y + ROW.cellH / 2} x2={AXIS.x1} y2={y + ROW.cellH / 2} stroke="currentColor" strokeWidth="1" opacity="0.25" />
                <rect data-testid="strip-cell" x={cx - ROW.cellW / 2} y={y} width={ROW.cellW} height={ROW.cellH} rx="3" fill={COLOR_HEX[r.color]} stroke="currentColor" strokeWidth={r.active ? 2.5 : 1.5} />
                <text data-testid="strip-name" x={clampX(cx, name)} y={y + ROW.cellH + 16} fontSize="14" textAnchor="middle" fill="currentColor">{name}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <p className="view-note" data-testid="strip-note">{note}</p>
      <p className="view-note" data-testid="strip-scale">{INDICATOR_SCALE_PREFIX[p.indicator]} 색 띠: {scaleText(p.indicator)}</p>
    </figure>
  );
}

const INDICATOR_SCALE_PREFIX = { cabbage: '붉은 양배추', phenol: '페놀프탈레인' } as const;
