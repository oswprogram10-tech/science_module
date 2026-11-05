import type { SpreadSample } from '@sci/engine-ssi';
import { headcount } from '@sci/engine-ssi';
import type { ViewProps } from '../types';
import { DISCLAIMER, SEAT_COLS, SEAT_ROWS, START_SAMPLE, STATE_LABEL, seatStates, spreadNote, toParams, type PersonState } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다(viewBox 폭 240은 이 칸의 실제 폭과 거의 같다).
export const W = 240;
export const H = 236;
const X0 = 30;
const DX = 36;
const Y0 = 52;
const DY = 28;
const R = 10;

/** 사람 모양 점. 색과 무늬를 함께 써서 구분한다: 건강 = 빈 원, 아픔 = 채운 원 + 점, 나음 = 원 + 체크. */
export function PersonDot({ state, cx, cy, r = R, testid }: { state: PersonState; cx: number; cy: number; r?: number; testid?: string }) {
  return (
    <g data-testid={testid} data-state={state}>
      {state === 'healthy' && <circle className="pd-healthy" cx={cx} cy={cy} r={r} />}
      {state === 'sick' && (
        <>
          <circle className="pd-sick" cx={cx} cy={cy} r={r} />
          <circle data-testid="pattern-dot" cx={cx} cy={cy} r={r * 0.34} fill="#fff" />
        </>
      )}
      {state === 'recovered' && (
        <>
          <circle className="pd-recovered" cx={cx} cy={cy} r={r} />
          <path data-testid="pattern-check" className="pd-check" d={`M${cx - r * 0.5} ${cy + r * 0.05} L${cx - r * 0.1} ${cy + r * 0.45} L${cx + r * 0.55} ${cy - r * 0.4}`} />
        </>
      )}
    </g>
  );
}

export function ClassroomView({ trial, snapshot, values }: ViewProps<SpreadSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  // 실행 전에는 처음 상태(아픈 친구 1명)만 그린다. 결과를 드러내지 않는다.
  const s: SpreadSample = ran ? (snapshot ?? START_SAMPLE) : START_SAMPLE;
  const states = seatStates(s, p.seat);
  const c = headcount(s);
  const note = spreadNote(s);
  const legendY = 218;
  return (
    <figure className="view spread-macro" aria-label="눈으로 보기: 교실">
      <figcaption>눈으로 보기: 교실</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`가상 반의 자리 ${SEAT_COLS}칸씩 ${SEAT_ROWS}줄에 앉은 사람 30명. 건강 ${c.healthy}명, 아픔 ${c.sick}명, 나음 ${c.recovered}명. ${note}`}>
        <rect x="14" y="6" width="212" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="120" y="22" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">칠판 (앞)</text>
        <g data-testid="classroom" data-healthy={c.healthy} data-sick={c.sick} data-recovered={c.recovered} data-seat={p.seat}>
          {states.map((state, n) => {
            const row = Math.floor(n / SEAT_COLS);
            const col = n % SEAT_COLS;
            return <PersonDot key={n} testid="seat" state={state} cx={X0 + DX * col} cy={Y0 + DY * row} />;
          })}
        </g>
        <text x="120" y={Y0 + DY * (SEAT_ROWS - 1) + 26} textAnchor="middle" fontSize="14" fill="currentColor">뒤</text>
        <g data-testid="legend" fontSize="14" fill="currentColor">
          {(['healthy', 'sick', 'recovered'] as const).map((state, i) => (
            <g key={state} data-testid={`legend-${state}`}>
              <PersonDot state={state} cx={18 + i * 80} cy={legendY} r={8} />
              <text x={32 + i * 80} y={legendY + 5} fontSize="14" fill="currentColor">{STATE_LABEL[state]}</text>
            </g>
          ))}
        </g>
      </svg>
      <p className="view-note" data-testid="spread-note">{note}</p>
      <p className="view-note disclaimer" data-testid="disclaimer">{DISCLAIMER}</p>
    </figure>
  );
}
