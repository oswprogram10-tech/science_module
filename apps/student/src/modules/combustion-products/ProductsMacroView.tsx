import type { CombustionProductsSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { BURN_TEXT, JAR_FILL, JAR_TEXT, LIME_CLEAR, LIME_MILK, TEST_SHORT, TEST_TEXT, clamp01, cloudText, outcomeName, outcomeNow, paperFill, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 244;
export const PLATE_Y = 190;
/** 집기병: 받침 위에 덮어 놓은 병 */
export const JAR = { x0: 14, x1: 122, top: 58 };
export const CANDLE = { cx: 68, w: 12, fullH: 50, pxPerMm: 4 };
/** 검사 도구 자리 */
export const TOOL = { x0: 146, x1: 226 };

/** 지금까지 짧아진 만큼 줄어든 초의 높이 */
export const candleHeight = (shorterMm: number): number => CANDLE.fullH - CANDLE.pxPerMm * shorterMm;

export function ProductsMacroView({ trial, snapshot, values }: ViewProps<CombustionProductsSample>) {
  const p = toParams(values);
  const ran = trial !== undefined && snapshot !== null;
  // 실행하기 전에는 아직 태우지 않았고(불꽃 없음, 초 그대로), 검사 결과도 정해지지 않았다.
  const s = ran ? snapshot : null;
  const outcome = s ? outcomeNow(s, p.test) : null;
  const lit = s !== null && s.t < p.burnMin - 1e-9;
  const h = candleHeight(s ? s.shorterMm : 0);
  const red = s ? s.red : 0;
  const cloud = s && p.test === 'limewater' ? clamp01(s.cloud / 10) : 0;
  const jarFill = JAR_FILL[p.jar] ?? null;
  const resultText = outcome ? outcomeName(outcome) : '실험하면 나타나요';
  const shorter = s ? Math.round(s.shorterMm * 10) / 10 : 0;
  const note = s
    ? `태운 시간 ${Math.round(s.burned * 10) / 10}분 · 초가 짧아진 길이 ${shorter} mm · 석회수 뿌연 정도 ${p.test === 'limewater' ? cloudText(s.cloud) : '—'}`
    : `초를 태운 시간 ${BURN_TEXT[p.burnMin]}. 실험하면 초를 태우고 ${TEST_SHORT[p.test]}로 검사해요.`;
  const toolCx = (TOOL.x0 + TOOL.x1) / 2;

  return (
    <figure className="view products-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`집기병 안의 초와 검사 도구. 초를 태운 시간 ${BURN_TEXT[p.burnMin]}, 집기병 색 ${JAR_TEXT[p.jar]}, 검사 도구 ${TEST_TEXT[p.test]}. ${outcome ? `검사 결과 ${resultText}` : '실험 전'}. ${note}`}>
        <text x="8" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="burn-label">초를 태운 시간: {BURN_TEXT[p.burnMin]}</text>
        <text x="8" y="38" fontSize="14" fill="currentColor" data-testid="jar-label">집기병 색: {JAR_TEXT[p.jar]}</text>
        <g data-testid="products-art" data-test={p.test} data-jar={p.jar} data-lit={lit ? 'yes' : 'no'} data-result={outcome ?? 'none'} data-red={red.toFixed(2)} data-cloud={(cloud * 10).toFixed(1)} data-shorter={shorter}>
          {/* 받침 */}
          <rect x="8" y={PLATE_Y} width="120" height="8" rx="2" fill="#b89a6e" stroke="currentColor" strokeWidth="1.5" />
          {/* 초 */}
          <g data-testid="candle" data-height={h.toFixed(0)}>
            <rect x={CANDLE.cx - CANDLE.w / 2} y={PLATE_Y - h} width={CANDLE.w} height={h} fill="#f7f3e8" stroke="currentColor" strokeWidth="1.5" />
            <line x1={CANDLE.cx} y1={PLATE_Y - h} x2={CANDLE.cx} y2={PLATE_Y - h - 5} stroke="#333" strokeWidth="1.5" />
            {lit && <ellipse data-testid="flame" cx={CANDLE.cx} cy={PLATE_Y - h - 13} rx="5" ry="9" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />}
          </g>
          {/* 집기병: 투명하거나 연한 파랑 */}
          <path d={`M${JAR.x0} ${PLATE_Y} V${JAR.top + 12} Q${JAR.x0} ${JAR.top} ${JAR.x0 + 12} ${JAR.top} H${JAR.x1 - 12} Q${JAR.x1} ${JAR.top} ${JAR.x1} ${JAR.top + 12} V${PLATE_Y}`} data-testid="jar" data-fill={jarFill ?? 'none'} fill={jarFill ?? 'none'} fillOpacity={jarFill ? 0.55 : undefined} stroke="currentColor" strokeWidth="2.5" />
          {/* 검사 도구 */}
          {p.test === 'paper' ? (
            <g data-testid="tool-paper">
              <rect data-testid="paper" data-fill={paperFill(red)} x={toolCx - 22} y="80" width="44" height="76" rx="2" fill={paperFill(red)} stroke="currentColor" strokeWidth="2" />
              <line x1={toolCx} y1="60" x2={toolCx} y2="80" stroke="currentColor" strokeWidth="2" />
            </g>
          ) : (
            <g data-testid="tool-limewater">
              <path d={`M${toolCx - 22} 80 V150 Q${toolCx - 22} 158 ${toolCx - 14} 158 H${toolCx + 14} Q${toolCx + 22} 158 ${toolCx + 22} 150 V80`} fill="none" stroke="currentColor" strokeWidth="2.5" />
              <rect x={toolCx - 21} y="100" width="42" height="56" fill={LIME_CLEAR} fillOpacity="0.55" />
              <rect data-testid="lime-milk" data-cloud={(cloud * 10).toFixed(1)} x={toolCx - 21} y="100" width="42" height="56" fill={LIME_MILK} fillOpacity={cloud * 0.95} />
            </g>
          )}
        </g>
        <text x="8" y="214" fontSize="14" fill="currentColor" data-testid="tool-label">검사 도구: {TEST_SHORT[p.test]}</text>
        <text x="8" y="234" fontSize="14" fontWeight="700" fill="currentColor" data-testid="result-label">검사 결과: {resultText}</text>
      </svg>
      <p className="view-note" data-testid="products-note">{note}</p>
    </figure>
  );
}
