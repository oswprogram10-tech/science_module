import type { TranspirationSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { usePrefersReducedMotion, useLoopPhase } from './motion';
import { leavesOf, lightOf, startSample, transpirationRate, vaporPerStoma, windOf } from './initial';

const W = 240;
const H = 290;
const LEAF = { x: 10, y: 84, w: 220, h: 84 } as const;
/** 기공 네 개의 자리(잎 윗면 가까이) */
const STOMATA_X = [66, 108, 150, 192] as const;
const STOMA_Y = LEAF.y + 14;
const TUBE = { x: 98, w: 44, top: LEAF.y + LEAF.h, bottom: 268 } as const;
/** 물이 올라가는 화살표 수 */
const ARROWS = 3;
const INK_ON_LEAF = '#14532d';

/** 기공의 열린 틈 크기(세로 반지름): 열림 0.25~1에 비례 */
export const slitRy = (stomata: number) => 1 + 7 * Math.min(1, Math.max(0, stomata));

/** 한 기공에서 i번째 수증기 점의 자리. phase는 0~1 위상이고 점마다 같은 간격으로 어긋난다. */
export function vaporPoint(sx: number, i: number, n: number, phase: number): [number, number] {
  const u = (i / n + phase) % 1;
  return [sx + 5 * Math.sin((u + i * 0.37) * Math.PI * 2), STOMA_Y - 8 - u * 40];
}

export function LeafMicroView({ snapshot, values, experiment }: ViewProps<TranspirationSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const leaves = leavesOf(values);
  const light = lightOf(values);
  const wind = windOf(values);
  const rate = transpirationRate(leaves, light, wind);
  const perStoma = vaporPerStoma(rate);
  const reduced = usePrefersReducedMotion();
  const running = rate > 0 && !reduced;
  // 증산량에 비례한 속도(초당 0.1~0.5바퀴). 움직임 줄이기이면 멈춘다.
  const phase = useLoopPhase(running, 0.5 * rate);
  const open = s.stomata >= 0.75 ? '기공이 활짝 열렸어요' : '기공이 조금만 열렸어요';
  const ry = slitRy(s.stomata);
  const hasLeaf = leaves > 0;

  return (
    <figure className="view leaf-micro" aria-label="잎 확대해 보기">
      <figcaption>잎 확대해 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        data-animating={running ? 'true' : 'false'}
        aria-label={hasLeaf ? `잎 뒷면을 크게 본 모습: ${open}, 기공마다 수증기 ${perStoma}개가 나가요, 줄기 속 물관으로 물이 올라가요` : '잎이 없어요: 줄기 속 물관만 있고 물이 빠져나갈 기공이 없어요'}
      >
        <text x={W / 2} y="16" textAnchor="middle" fontSize="14" fill="currentColor">{hasLeaf ? '잎 뒷면을 크게 본 모습' : '잎이 없어요'}</text>
        {hasLeaf && <text x={W / 2} y="34" textAnchor="middle" fontSize="14" fill="currentColor">{open}</text>}

        {hasLeaf ? (
          <>
            {/* 잎 단면: 기공 */}
            <rect data-testid="leaf-surface" x={LEAF.x} y={LEAF.y} width={LEAF.w} height={LEAF.h} rx="10" fill="#bbf7d0" stroke="#15803d" strokeWidth="2" />
            {STOMATA_X.map((sx, k) => (
              <g key={sx} data-testid="stoma" data-open={s.stomata}>
                <ellipse cx={sx} cy={STOMA_Y} rx="17" ry="10" fill="#86efac" stroke="#15803d" strokeWidth="2" />
                <ellipse data-testid="stoma-slit" cx={sx} cy={STOMA_Y} rx="11" ry={ry} fill="#14532d" />
                {k === 0 && (
                  <>
                    <line x1={sx} y1={STOMA_Y + 12} x2={sx} y2={LEAF.y + 52} stroke={INK_ON_LEAF} strokeWidth="1.5" />
                    <text x={sx} y={LEAF.y + 68} textAnchor="middle" fontSize="14" fontWeight="700" fill={INK_ON_LEAF}>기공</text>
                  </>
                )}
              </g>
            ))}
            {/* 기공에서 나가는 수증기: 증산량에 비례한 개수와 속도 */}
            <g data-testid="vapor" data-per-stoma={perStoma} fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1">
              {STOMATA_X.flatMap((sx, k) =>
                Array.from({ length: perStoma }, (_, i) => {
                  const [x, y] = vaporPoint(sx, i, perStoma, (phase + k * 0.25) % 1);
                  return <circle key={`${sx}-${i}`} data-testid="vapor-dot" cx={x.toFixed(2)} cy={y.toFixed(2)} r="3" />;
                }),
              )}
            </g>
            <text x="6" y="64" fontSize="14" fill="currentColor">수증기</text>
          </>
        ) : (
          <g data-testid="no-leaf">
            <path d={`M${TUBE.x - 6} ${TUBE.top} q-8 -14 8 -22 M${TUBE.x + TUBE.w + 6} ${TUBE.top} q8 -14 -8 -22`} fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
            <text x={W / 2} y="76" textAnchor="middle" fontSize="14" fill="currentColor">기공이 없어서 물이 거의</text>
            <text x={W / 2} y="96" textAnchor="middle" fontSize="14" fill="currentColor">빠져나가지 않아요</text>
          </g>
        )}

        {/* 줄기 속 물관과 올라가는 물 */}
        <rect data-testid="xylem" x={TUBE.x} y={TUBE.top} width={TUBE.w} height={TUBE.bottom - TUBE.top} rx="4" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="2" />
        {hasLeaf && (
          <g data-testid="water-arrows" fill="#1d4ed8">
            {Array.from({ length: ARROWS }, (_, i) => {
              const span = TUBE.bottom - TUBE.top - 16;
              const u = (i / ARROWS + phase) % 1;
              const y = TUBE.bottom - 8 - u * span;
              return <polygon key={i} data-testid="water-arrow" points={`${TUBE.x + TUBE.w / 2},${y - 8} ${TUBE.x + TUBE.w / 2 + 9},${y + 5} ${TUBE.x + TUBE.w / 2 - 9},${y + 5}`} />;
            })}
          </g>
        )}
        <text x={TUBE.x + TUBE.w + 8} y={(TUBE.top + TUBE.bottom) / 2 + 5} fontSize="14" fontWeight="700" fill="currentColor">물관</text>
        <text x={TUBE.x - 8} y={(TUBE.top + TUBE.bottom) / 2 + 5} textAnchor="end" fontSize="14" fill="currentColor">줄기 속</text>
      </svg>
      <p className="view-note">물은 뿌리와 줄기를 거쳐 잎의 기공으로 빠져나가요.</p>
    </figure>
  );
}
