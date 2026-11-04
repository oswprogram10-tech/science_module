import type { LeverSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { startSample, toParams } from './initial';
import { CELL } from './LeverMacroView';

// 이 그림에는 숫자를 쓰지 않는다. 곱셈 규칙도 말하지 않고, 막대 길이로만 비교하게 한다.
const W = 240;
const H = 176;
const CX = 120;
const BAR_Y = 118;
/** 막대 길이 단위: 돌리려는 정도 1 = 이만큼(그림 단위). 가장 긴 막대(6개 × 8칸 = 48)가 들어간다. */
export const TURN_UNIT = 3.5;
const BAR_X0 = 54;
const ARROW_LEN = 22;
const ARROW_GAP = 7;
const LEFT = { count: 2, distance: 4 } as const;

/** 같은 길이면 "두 쪽이 같아요", 아니면 "한쪽이 더 커요" */
export const compareText = (s: Pick<LeverSample, 'leftTurn' | 'rightTurn'>) => (s.leftTurn === s.rightTurn ? '두 쪽이 같아요' : '한쪽이 더 커요');

/** 추 n개의 아래 화살표: 추 하나당 같은 길이이고, 같은 자리의 추끼리는 옆으로 조금씩 벌려 그린다. */
function Arrows({ u, n, color }: { u: number; n: number; color: string }) {
  const x0 = CX + u * CELL - ((n - 1) * ARROW_GAP) / 2;
  return (
    <g data-testid="arrow-group" data-count={n}>
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + i * ARROW_GAP;
        return (
          <g key={i} data-testid="arrow">
            <line x1={x} y1={BAR_Y + 6} x2={x} y2={BAR_Y + 6 + ARROW_LEN} stroke={color} strokeWidth="2" />
            <path d={`M${x - 3.5} ${BAR_Y + ARROW_LEN + 1} L${x} ${BAR_Y + ARROW_LEN + 8} L${x + 3.5} ${BAR_Y + ARROW_LEN + 1} Z`} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

export function LeverTurnView({ experiment, trial, snapshot, values }: ViewProps<LeverSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const { count, distance } = toParams(values);
  // 실험을 하기 전에는 두 막대를 보여 주지 않는다. 예측하기 전에 길이를 비교하면 답이 바로 보이기 때문이다.
  const ran = trial !== undefined;

  return (
    <figure className="view lever-turn" aria-label="돌리려는 정도 보기">
      <figcaption>돌리려는 정도 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ran ? `추마다 아래로 향한 화살표와, 막대를 돌리려는 정도를 왼쪽과 오른쪽 막대 길이로 비교한 그림: ${compareText(s)}` : '추마다 아래로 향한 화살표를 그린 그림. 실험을 하면 막대를 돌리려는 정도를 비교하는 막대가 나타나요.'}
      >
        {/* 돌리려는 정도 막대 두 개: 받침점 위에 놓고 길이를 비교한다 */}
        {ran ? (
          <g data-testid="turn-bars">
            <text x="4" y="30" fontSize="14" fill="currentColor">왼쪽</text>
            <rect data-testid="turn-left" data-turn={s.leftTurn} x={BAR_X0} y="16" width={s.leftTurn * TURN_UNIT} height="16" rx="3" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1.5" />
            <text x="4" y="58" fontSize="14" fill="currentColor">오른쪽</text>
            <rect data-testid="turn-right" data-turn={s.rightTurn} x={BAR_X0} y="44" width={s.rightTurn * TURN_UNIT} height="16" rx="3" fill="#ea580c" stroke="#7c2d12" strokeWidth="1.5" />
            <text data-testid="turn-compare" x={CX} y="82" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">{compareText(s)}</text>
          </g>
        ) : (
          <text x={CX} y="42" textAnchor="middle" fontSize="14" fill="currentColor">실험을 하면 두 막대가 나타나요</text>
        )}

        {/* 수평으로 놓은 막대와 받침점 */}
        <rect x={CX - 9 * CELL} y={BAR_Y - 3} width={18 * CELL} height="6" rx="1.5" fill="#d6b27c" stroke="#7c5a2a" strokeWidth="1.5" />
        <path d={`M${CX} ${BAR_Y + 3} L${CX - 10} ${BAR_Y + 28} L${CX + 10} ${BAR_Y + 28} Z`} fill="#cbd5e1" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />

        {/* 추마다 같은 길이의 아래 화살표 */}
        <Arrows u={-LEFT.distance} n={LEFT.count} color="#1e40af" />
        <Arrows u={distance} n={count} color="#c2410c" />
        <text x={CX - 4 * CELL} y={H - 6} textAnchor="middle" fontSize="14" fill="currentColor">왼쪽 추</text>
        <text x={CX + 4 * CELL} y={H - 6} textAnchor="middle" fontSize="14" fill="currentColor">오른쪽 추</text>
      </svg>
      <p className="view-note">추가 막대를 돌리려는 정도는 추의 무게와 놓은 자리에 따라 달라져요.</p>
    </figure>
  );
}
