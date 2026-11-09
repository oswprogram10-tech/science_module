import type { RampSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { passed1m, rampResult, startSample } from './initial';

// 숫자 카드 두 개와 나눗셈 식, 지금 빠르기 막대. 글자 14는 화면에서 약 13 px 이상이다.
const W = 240;
const H = 196;
/** 빠르기 막대: 0~3 m/s */
const BAR_X = 8;
const BAR_W = 224;
const BAR_MAX = 3;
const BAR_Y = 140;

export function SpeedCalcView({ experiment, trial, snapshot, values }: ViewProps<RampSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const { timeS, speed } = rampResult(values, experiment);
  // 실험을 하기 전에는 어떤 결과도 보여 주지 않는다. 1 m에 닿은 뒤에야 걸린 시간과 계산 식이 나타난다.
  const ran = trial !== undefined && snapshot !== null;
  const arrived = ran && passed1m(s.t, values);
  const v = ran ? s.v : 0;
  const timeText = arrived ? `${timeS.toFixed(2)}초` : '?';

  return (
    <figure className="view speed-calc" aria-label="속력 계산해 보기">
      <figcaption>속력 계산해 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={arrived ? `이동 거리 1 m, 걸린 시간 ${timeS.toFixed(2)}초, 계산: 1 나누기 ${timeS.toFixed(2)}는 ${speed.toFixed(2)} m/s` : '이동 거리 1 m, 걸린 시간은 수레가 1 m에 닿으면 알 수 있어요.'}
      >
        {/* 숫자 카드 두 개 */}
        <rect x="4" y="6" width={W - 8} height="34" rx="6" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeWidth="1.5" />
        <text data-testid="card-distance" x={W / 2} y="28" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">이동 거리 1 m</text>
        <rect x="4" y="46" width={W - 8} height="34" rx="6" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeWidth="1.5" strokeDasharray={arrived ? undefined : '4 3'} />
        <text data-testid="card-time" x={W / 2} y="68" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">걸린 시간 {timeText}</text>

        {/* 나눗셈 식 */}
        {arrived ? (
          <text data-testid="division" x={W / 2} y="108" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
            1 ÷ {timeS.toFixed(2)} = {speed.toFixed(2)} (m/s)
          </text>
        ) : (
          <text data-testid="division-hint" x={W / 2} y="106" textAnchor="middle" fontSize="14" fill="currentColor">
            {ran ? '1 m에 닿으면 계산해요' : '실험을 하면 계산할 수 있어요'}
          </text>
        )}

        {/* 지금 빠르기 막대 */}
        <text x={BAR_X} y={BAR_Y - 8} fontSize="14" fill="currentColor">지금 빠르기</text>
        <rect x={BAR_X} y={BAR_Y} width={BAR_W} height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect data-testid="speed-bar" data-v={v.toFixed(2)} x={BAR_X} y={BAR_Y} width={(Math.min(v, BAR_MAX) / BAR_MAX) * BAR_W} height="14" rx="3" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1.5" />
        {[0, 1, 2, 3].map((m) => (
          <g key={m}>
            <line x1={BAR_X + (m / BAR_MAX) * BAR_W} y1={BAR_Y + 14} x2={BAR_X + (m / BAR_MAX) * BAR_W} y2={BAR_Y + 19} stroke="currentColor" strokeWidth="1.5" />
            <text x={BAR_X + (m / BAR_MAX) * BAR_W} y={BAR_Y + 34} textAnchor={m === 0 ? 'start' : m === BAR_MAX ? 'end' : 'middle'} fontSize="14" fill="currentColor">{m === BAR_MAX ? `${m} m/s` : m}</text>
          </g>
        ))}
      </svg>
      <p className="view-note">속력은 간 거리를 걸린 시간으로 나누어 구해요.</p>
    </figure>
  );
}
