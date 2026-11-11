import { GAS_Y_MAX_G, GAS_Y_MIN_G, type GasWeightSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { clamp01, startSample } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 130;
/** 45.0~47.0 g를 가로로 늘여 놓은 눈금: 작은 무게 차이도 눈에 띄게 한다. */
export const GAUGE = { x: 24, w: 192, y: 84 };
export const GAUGE_LABELS = [45, 46, 47] as const;

/** 무게(g) → 눈금 위의 x */
export const gaugeX = (g: number) => GAUGE.x + GAUGE.w * clamp01((g - GAS_Y_MIN_G) / (GAS_Y_MAX_G - GAS_Y_MIN_G));

export function GasGaugeView({ trial, snapshot, values }: ViewProps<GasWeightSample>) {
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const note = ran ? `전자저울 ${s.weight.toFixed(1)} g` : '실험하면 저울 숫자를 눈금에서 볼 수 있어요.';
  const x = gaugeX(s.weight);

  return (
    <figure className="view gas-gauge" aria-label="저울 숫자 크게 보기">
      <figcaption>저울 숫자 크게 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`45.0 g에서 47.0 g까지의 눈금에서 저울 숫자를 읽어요. ${note}`}>
        <text x={GAUGE.x - 14} y="18" fontSize="14" fontWeight="700" fill="currentColor">전자저울 무게(g)</text>
        {ran && (
          <>
            <text x={GAUGE.x - 14} y="44" fontSize="14" fill="currentColor" data-testid="gauge-label">{s.weight.toFixed(1)} g</text>
            <path data-testid="gauge-marker" data-weight={s.weight.toFixed(3)} d={`M${x.toFixed(1)} ${GAUGE.y - 4} L${(x - 6).toFixed(1)} ${GAUGE.y - 18} L${(x + 6).toFixed(1)} ${GAUGE.y - 18} Z`} fill="#d97706" stroke="#78350f" strokeWidth="1.5" strokeLinejoin="round" />
          </>
        )}
        <line x1={GAUGE.x} y1={GAUGE.y} x2={GAUGE.x + GAUGE.w} y2={GAUGE.y} stroke="currentColor" strokeWidth="2" />
        {[0, 0.5, 1, 1.5, 2].map((d) => (
          <line key={d} x1={gaugeX(GAS_Y_MIN_G + d)} y1={GAUGE.y} x2={gaugeX(GAS_Y_MIN_G + d)} y2={GAUGE.y + (Number.isInteger(d) ? 10 : 6)} stroke="currentColor" strokeWidth="1.5" />
        ))}
        {GAUGE_LABELS.map((g) => (
          <text key={g} x={gaugeX(g)} y={GAUGE.y + 28} textAnchor="middle" fontSize="14" fill="currentColor">{g.toFixed(1)}</text>
        ))}
      </svg>
      <p className="view-note" data-testid="gas-gauge-note">{note}</p>
    </figure>
  );
}
