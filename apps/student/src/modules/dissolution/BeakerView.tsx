import { trialDuration } from '@sci/runtime';
import type { DissolutionSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';

type Trial = NonNullable<ViewProps<DissolutionSample>['trial']>;

const BOTTOM = 200;
const LEFT = 40;
const RIGHT = 160;

/** 가장 최근에 숟가락이 들어간 시각(없으면 null). */
function lastSpoonTime(trial: Trial, playhead: number): { t: number; n: number } | null {
  let found: { t: number; n: number } | null = null;
  let n = 1;
  const s = trial.samples;
  for (let i = 1; i < s.length && s[i]!.t <= playhead; i++) {
    if (s[i]!.addedG > s[i - 1]!.addedG + 1e-9) {
      n++;
      found = { t: s[i]!.t, n };
    }
  }
  return found ?? { t: 0, n: 1 };
}

export function BeakerView({ experiment, trial, snapshot, values, playhead }: ViewProps<DissolutionSample>) {
  const waterMl = Number(values.waterMl);
  const spoonGrams = experiment.spoonGrams ?? 2;
  const dissolved = snapshot?.dissolvedG ?? 0;
  const undissolved = snapshot?.undissolvedG ?? 0;
  const added = snapshot?.addedG ?? 0;
  const baseH = 50 + waterMl * 0.7; // 50 mL -> 85, 150 mL -> 155
  const waterH = Math.min(170, baseH + Math.min(dissolved, 400) * 0.04);
  const conc = waterMl > 0 ? dissolved / waterMl : 0;
  const alpha = 0.25 + Math.min(0.55, conc * 1.2);
  const pileH = Math.min(16, undissolved * 6);
  const pileW = 20 + Math.min(40, undissolved * 18);

  let spoonLabel: string | null = null;
  if (trial && snapshot) {
    const sp = lastSpoonTime(trial, playhead);
    const window = Math.max(1.5, trialDuration(trial) * 0.04);
    if (sp && playhead - sp.t <= window && playhead < trialDuration(trial)) {
      spoonLabel = `${sp.n}번째 숟가락 넣는 중`;
    }
  }

  return (
    <figure className="view beaker" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox="0 0 200 240" role="img" aria-label={`비커: 녹은 양 ${dissolved.toFixed(1)} g, 녹지 않은 양 ${undissolved.toFixed(1)} g`}>
        <rect x={LEFT} y={BOTTOM - waterH} width={RIGHT - LEFT} height={waterH} fill={`rgba(40, 120, 200, ${alpha})`} />
        <path d={`M ${LEFT} 30 L ${LEFT} ${BOTTOM} Q ${LEFT} ${BOTTOM + 6} ${LEFT + 6} ${BOTTOM + 6} L ${RIGHT - 6} ${BOTTOM + 6} Q ${RIGHT} ${BOTTOM + 6} ${RIGHT} ${BOTTOM} L ${RIGHT} 30`} fill="none" stroke="currentColor" strokeWidth="3" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={LEFT} x2={LEFT + 10} y1={BOTTOM - 150 * f} y2={BOTTOM - 150 * f} stroke="currentColor" strokeWidth="1" />
        ))}
        {pileH > 0.3 && (
          <path d={`M ${100 - pileW / 2} ${BOTTOM} Q 100 ${BOTTOM - pileH * 2} ${100 + pileW / 2} ${BOTTOM} Z`} fill="#d8c9a8" stroke="#7a6a44" strokeWidth="1" />
        )}
        {spoonLabel && (
          <g aria-hidden="true">
            <ellipse cx="100" cy="14" rx="12" ry="6" fill="#999" stroke="#555" />
            <line x1="112" y1="14" x2="150" y2="4" stroke="#555" strokeWidth="3" />
            <circle cx="100" cy="24" r="2" fill="#d8c9a8" />
            <circle cx="96" cy="30" r="2" fill="#d8c9a8" />
            <circle cx="104" cy="32" r="2" fill="#d8c9a8" />
          </g>
        )}
        <text x="100" y="232" textAnchor="middle" fontSize="11" fill="currentColor">
          넣은 용질 {added.toFixed(1)} g ({Math.round(added / spoonGrams)}숟가락)
        </text>
      </svg>
      <p className="view-note" aria-live="off">
        {spoonLabel ?? (trial ? `녹은 양 ${dissolved.toFixed(1)} g · 바닥에 남은 양 ${undissolved.toFixed(1)} g` : '실험을 실행해 보세요.')}
      </p>
    </figure>
  );
}
