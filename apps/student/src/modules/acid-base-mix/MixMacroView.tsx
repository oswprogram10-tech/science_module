import type { AcidBaseMixSample } from '@sci/engine-matter';
import { START_ML, volumeMlOf } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { ADDED_TEXT, COLOR_HEX, FIRST_TEXT, INDICATOR_TEXT, clamp01, colorFor, colorName, dropsNow, mlText, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 272;
export const GROUND_Y = 218;
/** 비커 크기: 100 mL 비커가 더 넓고 높다. */
export const BEAKER: Record<number, { x0: number; x1: number; top: number }> = {
  50: { x0: 88, x1: 152, top: 134 },
  100: { x0: 76, x1: 164, top: 114 },
};
/** 실험 전(색이 정해지기 전) 용액 색 */
export const PLAIN_FILL = '#e7eef3';

/** 용액 높이(비커 안쪽 높이에 대한 비): 부피 ÷ 비커 크기 */
export const levelFraction = (drops: number, beakerMl: number): number => clamp01(volumeMlOf(drops) / beakerMl);

export function MixMacroView({ trial, snapshot, values }: ViewProps<AcidBaseMixSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  // 실행하기 전에는 방울을 넣지 않았고(0방울), 지시약 색도 아직 정해지지 않았다.
  const drops = ran && snapshot ? dropsNow(snapshot) : 0;
  const color = ran ? colorFor(drops, p.direction, p.indicator) : null;
  const colorText = color ? colorName(color) : '실험하면 나타나요';
  const b = BEAKER[p.beaker]!;
  const bottom = GROUND_Y - 4;
  const inner = bottom - b.top;
  const liquidH = inner * levelFraction(drops, p.beaker);
  const fill = color ? COLOR_HEX[color] : PLAIN_FILL;
  const cx = (b.x0 + b.x1) / 2;
  const note = ran ? `넣은 방울 수 ${drops}방울 · 넣은 양 ${mlText(drops)} mL · 지시약 색 ${colorText}` : `처음 용액 ${START_ML} mL. 실험하면 지시약 색이 나타나요.`;

  return (
    <figure className="view mix-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.beaker} mL 비커에 ${FIRST_TEXT[p.direction]}와 ${INDICATOR_TEXT[p.indicator]}. ${ADDED_TEXT[p.direction]}을 스포이트로 넣어요. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="indicator-label">{INDICATOR_TEXT[p.indicator]}</text>
        <text x="12" y="36" fontSize="14" fill="currentColor" data-testid="first-label">처음: {FIRST_TEXT[p.direction]}</text>
        <text x="12" y="54" fontSize="14" fill="currentColor" data-testid="added-label">넣는 용액: {ADDED_TEXT[p.direction]}</text>
        <line x1="4" y1={GROUND_Y} x2={W - 4} y2={GROUND_Y} stroke="#64748b" strokeWidth="2" />
        <g data-testid="mix-art" data-beaker={p.beaker} data-drops={drops} data-color={color ?? 'none'}>
          {/* 용액 */}
          <rect data-testid="mix-liquid" data-fill={fill} x={b.x0} y={bottom - liquidH} width={b.x1 - b.x0} height={liquidH} fill={fill} />
          {/* 비커 */}
          <path d={`M${b.x0} ${b.top} V${bottom} Q${b.x0} ${GROUND_Y} ${b.x0 + 4} ${GROUND_Y} H${b.x1 - 4} Q${b.x1} ${GROUND_Y} ${b.x1} ${bottom} V${b.top}`} fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* 스포이트: 고무 알과 유리관 */}
          <g data-testid="dropper" stroke="currentColor" strokeWidth="2">
            <rect x={cx - 7} y="66" width="14" height="22" rx="7" fill="#dc2626" />
            <path d={`M${cx - 4} 88 V${b.top - 14} L${cx} ${b.top - 4} L${cx + 4} ${b.top - 14} V88`} fill="#f8fafc" fillOpacity="0.7" />
          </g>
          {ran && drops > 0 && <circle data-testid="drop" cx={cx} cy={b.top + 4} r="4" fill="#475569" />}
        </g>
        <text x="12" y="240" fontSize="14" fill="currentColor" data-testid="drops-label">넣은 방울 수 {drops}방울 · {mlText(drops)} mL</text>
        <text x="12" y="260" fontSize="14" fontWeight="700" fill="currentColor" data-testid="color-label">지시약 색: {colorText}</text>
      </svg>
      <p className="view-note" data-testid="mix-note">{note}</p>
    </figure>
  );
}
