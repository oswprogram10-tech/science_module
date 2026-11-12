import type { ThFeel, ThermometerSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { EYE_SHORT, EYE_TEXT, HAND_TEXT, TARGET_TEXT, TOOL_TEXT, clamp01, thermometerNote, thermometerResult, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 272;
/** 알코올 온도계: 유리관 가운데 x, 위·아래 끝, 눈금 범위(°C) */
export const TUBE = { x: 140, top: 76, bottom: 208, minC: 16, maxC: 32 };
/** 온도(°C) → 알코올 기둥 윗끝 y */
export const columnTop = (c: number): number => TUBE.bottom - clamp01((c - TUBE.minC) / (TUBE.maxC - TUBE.minC)) * (TUBE.bottom - TUBE.top);
/** 눈의 위치: 알코올 기둥 끝에서 위(−) 또는 아래(+)로 떨어진 정도 */
export const EYE_OFFSET = { above: -38, level: 0, below: 38 } as const;
export const eyeY = (eye: keyof typeof EYE_OFFSET, c: number): number => Math.min(236, Math.max(70, columnTop(c) + EYE_OFFSET[eye]));
const EYE_X = 214;
const SCALE_TICKS = [20, 25, 30];
const FEEL_FILL: Record<ThFeel, string> = { cold: '#93c5fd', lukewarm: '#fde68a', warm: '#fdba74' };
const PRIOR_FILL = { cold: '#60a5fa', warm: '#fb923c' } as const;

/** 손 느낌 얼굴 표정 아이콘(글자 없음) */
function FaceIcon({ feel, cx, cy, r }: { feel: ThFeel; cx: number; cy: number; r: number }) {
  const mouth = feel === 'cold' ? `M${cx - 6} ${cy + 8} Q${cx} ${cy + 2} ${cx + 6} ${cy + 8}` : feel === 'warm' ? `M${cx - 6} ${cy + 3} Q${cx} ${cy + 11} ${cx + 6} ${cy + 3}` : `M${cx - 6} ${cy + 6} L${cx + 6} ${cy + 6}`;
  return (
    <g data-testid="feel-face" data-feel={feel}>
      <circle cx={cx} cy={cy} r={r} fill={FEEL_FILL[feel]} stroke="#374151" strokeWidth="1.5" />
      <circle cx={cx - 5} cy={cy - 4} r="2" fill="#374151" />
      <circle cx={cx + 5} cy={cy - 4} r="2" fill="#374151" />
      <path d={mouth} fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

function TargetArt({ target }: { target: keyof typeof TARGET_TEXT }) {
  if (target === 'water') {
    return (
      <g data-testid="target-art" data-target="water">
        <rect x="96" y="198" width="100" height="52" fill="#8cc4ee" />
        <path d="M96 184 V250 H196 V184" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </g>
    );
  }
  if (target === 'rod') {
    return (
      <g data-testid="target-art" data-target="rod">
        <rect x="40" y="224" width="160" height="20" rx="3" fill="#94a3b8" stroke="#374151" strokeWidth="1.5" />
        <line x1="46" y1="229" x2="194" y2="229" stroke="#e2e8f0" strokeWidth="2" />
      </g>
    );
  }
  return (
    <g data-testid="target-art" data-target="wood">
      <rect x="40" y="224" width="160" height="20" rx="3" fill="#b9814a" stroke="#374151" strokeWidth="1.5" />
      <path d="M48 232 H90 M110 236 H180 M60 240 H140" fill="none" stroke="#7c4a1d" strokeWidth="1.5" />
    </g>
  );
}

export function ThermometerMacroView({ trial, snapshot, values }: ViewProps<ThermometerSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const r = thermometerResult(values);
  // 손 느낌 얼굴과 읽은 값은 실행한 뒤에만 그린다.
  const note = ran ? thermometerNote(s, r) : '실험하면 온도계 눈금과 손 느낌이 나타나요.';
  const alcohol = p.tool === 'alcohol';
  const top = columnTop(s.level);
  const ey = eyeY(p.eye, s.level);
  const display = ran ? `${Math.round(s.level)} °C` : '--';

  return (
    <figure className="view thermometer-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${TARGET_TEXT[p.target]}의 온도를 ${TOOL_TEXT[p.tool]}로 재는 그림. 먼저 손을 넣었던 물: ${HAND_TEXT[p.hand]}.${alcohol ? ` 눈금을 읽은 눈높이: ${EYE_TEXT[p.eye]}.` : ''} ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="target-label">{TARGET_TEXT[p.target]}</text>
        <text x="12" y="36" fontSize="14" fill="currentColor" data-testid="tool-label">{alcohol ? `${TOOL_TEXT.alcohol} · 눈높이 ${EYE_SHORT[p.eye]}` : `${TOOL_TEXT.ir} · 숫자 화면`}</text>
        <text x="12" y="54" fontSize="14" fill="currentColor" data-testid="hand-label">먼저 넣은 물: {HAND_TEXT[p.hand]}</text>
        <g data-testid="thermo-art" data-tool={p.tool} data-eye={p.eye} data-hand={p.hand} data-target={p.target} data-level={s.level.toFixed(2)}>
          <TargetArt target={p.target} />
          {/* 손: 먼저 넣었던 물이 있으면 작은 컵 그림도 함께 보인다. */}
          <g data-testid="hand" data-hand={p.hand}>
            <rect x="18" y="146" width="50" height="38" rx="14" fill="#f5c9a0" stroke="#374151" strokeWidth="1.5" />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={19 + i * 12.5} y="124" width="9" height="28" rx="4.5" fill="#f5c9a0" stroke="#374151" strokeWidth="1.5" />
            ))}
            {p.hand !== 'none' && (
              <g data-testid="prior-cup" data-prior={p.hand}>
                <rect x="72" y="156" width="22" height="28" fill={PRIOR_FILL[p.hand]} stroke="#374151" strokeWidth="1.5" />
              </g>
            )}
          </g>
          {ran && <FaceIcon feel={r.feel} cx={44} cy={100} r={17} />}
          {alcohol ? (
            <g data-testid="alcohol-thermo">
              <rect x={TUBE.x - 4} y={TUBE.top} width="8" height={TUBE.bottom - TUBE.top} rx="4" fill="#fff" stroke="#374151" strokeWidth="1.2" />
              <circle cx={TUBE.x} cy={TUBE.bottom + 8} r="9" fill="#dc2626" stroke="#374151" strokeWidth="1.2" />
              <rect data-testid="alcohol-column" x={TUBE.x - 2} y={top} width="4" height={TUBE.bottom + 4 - top} fill="#dc2626" />
              {SCALE_TICKS.map((c) => (
                <g key={c}>
                  <line x1={TUBE.x - 10} y1={columnTop(c)} x2={TUBE.x - 4} y2={columnTop(c)} stroke="currentColor" strokeWidth="1.2" />
                  <text x={TUBE.x - 13} y={columnTop(c) + 5} fontSize="14" textAnchor="end" fill="currentColor">{c}</text>
                </g>
              ))}
              {/* 눈: 눈높이에 따라 알코올 기둥 끝보다 위, 같은 높이, 아래에 놓인다. 점선은 눈에서 기둥 끝으로 보는 방향이다. */}
              <g data-testid="eye" data-eye={p.eye} data-y={ey.toFixed(1)}>
                <line x1={EYE_X - 13} y1={ey} x2={TUBE.x + 6} y2={top} stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 3" />
                <ellipse cx={EYE_X} cy={ey} rx="13" ry="8" fill="#ffffff" stroke="#374151" strokeWidth="1.5" />
                <circle cx={EYE_X - 4} cy={ey} r="4" fill="#1f2937" />
              </g>
            </g>
          ) : (
            <g data-testid="ir-thermo">
              <rect x="124" y="92" width="86" height="34" rx="8" fill="#475569" stroke="#1f2937" strokeWidth="1.5" />
              <rect x="164" y="124" width="22" height="34" rx="5" fill="#475569" stroke="#1f2937" strokeWidth="1.5" />
              <rect x="132" y="98" width="60" height="22" rx="3" fill="#0f172a" />
              <text data-testid="ir-display" x="162" y="114" fontSize="14" fontWeight="700" textAnchor="middle" fill="#bbf7d0">{display}</text>
              <line x1="128" y1="126" x2="146" y2={p.target === 'water' ? 196 : 222} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 3" />
            </g>
          )}
        </g>
      </svg>
      <p className="view-note" data-testid="thermo-note">{note}</p>
    </figure>
  );
}
