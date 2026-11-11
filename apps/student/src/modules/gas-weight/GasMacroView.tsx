import type { GasWeightSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { CAP_TEXT, LABEL_FILL, LABEL_TEXT, gasNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 262;
/** 병과 저울의 가운데 x */
export const CX = 130;
/** 병이 놓인 저울 판의 윗면 y */
export const PLATE_Y = 206;
/** 병 몸통의 가운데에서 옆면까지의 거리와 몸통 위·아래 y */
export const BODY = { half: 22, top: 128, bottom: PLATE_Y } as const;
/** 마개를 누르는 깊이(그림 단위) */
export const PRESS_DEPTH = 10;
const SKIN = '#f2b48c';

/** 병이 팽팽한 정도(0~1) → 몸통 옆면의 부풀림(px): 말랑하면 안으로 조금 들어가고, 팽팽하면 바깥으로 부푼다. */
export const bulge = (taut: number) => -5 + 11 * Math.min(1, Math.max(0, taut));

/** 마개를 누르는 손의 눌린 정도(0~1): 누르는 중에만 한 번 누를 때마다 한 번 눌린다. */
export const pressPhase = (pressed: number, pumps: number): number => {
  if (pumps === 0 || pressed >= pumps) return 0;
  const f = pressed - Math.floor(pressed);
  return Math.sin(Math.PI * f);
};

export function GasMacroView({ trial, snapshot, values }: ViewProps<GasWeightSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values);
  const taut = ran ? s.taut : 0;
  const dep = ran ? PRESS_DEPTH * pressPhase(s.pressed, p.pumps) : 0;
  const note = ran ? gasNote(s) : '실험하면 누른 횟수만큼 공기를 넣어요.';
  const b = bulge(taut);
  const l = CX - BODY.half;
  const r = CX + BODY.half;
  const mid = (BODY.top + BODY.bottom) / 2;
  const open = p.cap === 'open';
  const body = `M${CX - 10} 106 L${CX - 10} 112 Q${l} 116 ${l} ${BODY.top} Q${(l - b).toFixed(1)} ${mid} ${l} ${BODY.bottom} L${r} ${BODY.bottom} Q${(r + b).toFixed(1)} ${mid} ${r} ${BODY.top} Q${r} 116 ${CX + 10} 112 L${CX + 10} 106 Z`;
  const display = ran ? `${s.weight.toFixed(1)} g` : '— g';
  // 병 어깨의 공기 빼는 마개: 닫아 두면 어깨에 붙어 있고, 열면 비스듬히 들려 있다. 쉿 표시는 실행하는 동안에만 나온다.
  const capTransform = open ? `translate(${CX + 24} 116) rotate(-40)` : `translate(${CX + 24} 122)`;

  return (
    <figure className="view gas-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`전자저울 위 페트병: 공기 주입 마개를 ${p.pumps}번 누름, 마개 ${CAP_TEXT[p.cap]}, 띠지 색깔 ${LABEL_TEXT[p.label]}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="gas-label">{p.pumps}번 누름</text>
        <text x="12" y="36" fontSize="14" fill="currentColor" data-testid="gas-cap-label">마개 {CAP_TEXT[p.cap]}</text>
        <text x="12" y="54" fontSize="14" fill="currentColor" data-testid="gas-sub">띠지 {LABEL_TEXT[p.label]}</text>
        {/* 전자저울: 판, 몸체, 숫자 창 */}
        <rect x="56" y={PLATE_Y + 6} width="148" height="46" rx="6" fill="#cbd5e1" stroke="currentColor" strokeWidth="2" />
        <rect x="70" y={PLATE_Y} width="120" height="6" rx="2" fill="#94a3b8" stroke="currentColor" strokeWidth="1.5" />
        <rect x="84" y={PLATE_Y + 14} width="92" height="28" rx="4" fill="#0f172a" stroke="currentColor" strokeWidth="1.5" />
        <text x={CX} y={PLATE_Y + 34} textAnchor="middle" fontSize="14" fill="#e2e8f0" data-testid="scale-digits">{display}</text>
        <g data-testid="gas-art" data-pumps={p.pumps} data-cap={p.cap} data-label={p.label} data-taut={taut.toFixed(3)} data-pressed={(ran ? s.pressed : 0).toFixed(2)} data-weight={ran ? s.weight.toFixed(2) : ''}>
          <path d={body} fill="#e0f2fe" fillOpacity="0.85" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" data-testid="bottle-body" />
          {/* 띠지 */}
          <rect x={CX - BODY.half} y="156" width={BODY.half * 2} height="24" fill={LABEL_FILL[p.label]} stroke="currentColor" strokeWidth="1.5" data-testid="bottle-label" />
          {/* 말랑한 병의 주름 */}
          {taut < 0.3 && (
            <g data-testid="wrinkles" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d={`M${l + 4} 140 q6 4 0 9`} />
              <path d={`M${r - 4} 190 q-6 4 0 9`} />
            </g>
          )}
          {/* 공기 주입 마개: 막대와 손잡이를 아래로 누른다. */}
          <g data-testid="pump" data-depth={dep.toFixed(2)}>
            <rect x={CX - 12} y="94" width="24" height="12" rx="2" fill="#475569" stroke="currentColor" strokeWidth="1.5" />
            <rect x={CX - 3} y={70 + dep} width="6" height={24 - dep} fill="#94a3b8" stroke="currentColor" strokeWidth="1.5" />
            <rect x={CX - 12} y={62 + dep} width="24" height="8" rx="3" fill="#64748b" stroke="currentColor" strokeWidth="1.5" />
          </g>
          <g transform={capTransform} data-testid="bottle-cap" data-open={open ? 'yes' : 'no'}>
            <rect x="-4" y="-5" width="14" height="10" rx="2" fill="#475569" stroke="currentColor" strokeWidth="1.5" />
          </g>
          {/* 누르는 손 */}
          <g data-testid="press-hand" data-depth={dep.toFixed(2)}>
            <rect x={CX - 14} y={44 + dep} width="28" height="18" rx="8" fill={SKIN} stroke="currentColor" strokeWidth="2" />
          </g>
          {/* 쉿 표시(마개를 열어 공기가 빠지는 모습): 글자 없이 곡선 세 줄 */}
          {ran && open && (
            <g data-testid="vent-marks" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={`M${CX + 40} 100 q10 -6 20 0`} />
              <path d={`M${CX + 42} 112 q12 -4 24 2`} />
              <path d={`M${CX + 40} 124 q10 0 20 6`} />
            </g>
          )}
        </g>
      </svg>
      <p className="view-note" data-testid="gas-note">{note}</p>
    </figure>
  );
}
