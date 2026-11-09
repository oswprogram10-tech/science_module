import type { StreamSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { useLoopPhase, usePrefersReducedMotion } from '../transpiration/motion';
import { startSample, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 232;
/** 물길 단면 틀 */
const BOX = { x: 8, y: 26, w: 224, h: 150 };
const CH_W = BOX.w - 16;
/** 바닥(물길 밑) 기울기: 완만 8°, 가파름 20°에 가깝게 그린다 */
export const bedDrop = (slope: 'gentle' | 'steep') => (slope === 'steep' ? 78 : 30);
const bedY = (x: number, drop: number, y0: number) => y0 + ((x - BOX.x) / BOX.w) * drop;
/** 물 깊이: 흐름이 셀수록 깊다 */
export const waterDepth = (flow: number) => 14 + 18 * flow;

/** 작은 알갱이 수, 큰 알갱이 수 */
export const SMALL_COUNT = 9;
export const BIG_COUNT = 3;
/** phase는 0~1을 되풀이한다. 작은 알갱이는 두 바퀴, 큰 알갱이는 한 바퀴(굴러서 더 느리다). 흐름 1.0에서 위상 속도는 초당 SPEED 바퀴. */
export const SMALL_LAPS = 2;
export const BIG_LAPS = 1;
export const SPEED = 0.125;
const WOBBLE = 2.5;

/** 처음(실행 전)과 움직일 때의 출발 자리(0~1) */
const smallX0 = (i: number) => (i * 0.618) % 1;
const bigX0 = (i: number) => (0.15 + i * 0.33) % 1;
/** 작은 알갱이가 물 속에 떠 있는 높이(바닥에서 위로, 물 깊이의 비율) */
const smallLift = (i: number) => 0.25 + ((i * 37) % 60) / 100;

const bigPath = (r: number) => `M${-r} ${r * 0.3} L${-r * 0.6} ${-r * 0.8} L${r * 0.4} ${-r} L${r} ${-r * 0.1} L${r * 0.5} ${r * 0.9} L${-r * 0.5} ${r} Z`;

export function StreamGrainView({ trial, snapshot, values, experiment, playhead }: ViewProps<StreamSample>) {
  const reduced = usePrefersReducedMotion();
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = ran ? (snapshot ?? startSample(values, experiment)) : startSample(values, experiment);
  const last = trial ? (trial.samples as StreamSample[]).at(-1)!.t : 0;
  // 흙을 옮기는 동안(물이 흐르고 플레이헤드가 끝에 닿기 전)에만 움직인다. 움직임 줄이기이면 언제나 멈춰 있다.
  const flow = ran ? s.flow : 0;
  const moving = ran && !reduced && flow > 1e-9 && playhead < last - 1e-9;
  const phase = useLoopPhase(moving, SPEED * flow);
  const drop = bedDrop(p.slope);
  const y0 = BOX.y + (p.slope === 'steep' ? 36 : 70);
  const depth = waterDepth(p.slope === 'steep' ? 1 : 0.4);
  const showWater = ran && flow > 1e-9;
  const settled = ran && !moving;
  const bx = (u: number) => BOX.x + 8 + u * CH_W;

  // 자리: 움직이는 중에는 위상에 따라 오른쪽으로 흐르고, 멈추면 바닥에 내려앉아 오른쪽 끝에 쌓인다.
  const small = Array.from({ length: SMALL_COUNT }, (_, i) => {
    if (moving) {
      const u = (smallX0(i) + phase * SMALL_LAPS) % 1;
      const x = bx(u);
      const lift = smallLift(i) * depth;
      const wob = WOBBLE * Math.sin(2 * Math.PI * (phase * SMALL_LAPS + i * 0.37));
      return { x, y: bedY(x, drop, y0) - 6 - lift + wob };
    }
    if (settled) {
      const x = bx(0.97) - (i % 5) * 10 - (Math.floor(i / 5) % 2) * 5;
      return { x, y: bedY(x, drop, y0) - 3.5 - Math.floor(i / 5) * 7 };
    }
    const x = bx(smallX0(i));
    return { x, y: bedY(x, drop, y0) - 3.5 };
  });
  const big = Array.from({ length: BIG_COUNT }, (_, i) => {
    const r = 7;
    if (moving) {
      const u = (bigX0(i) + phase * BIG_LAPS) % 1;
      const x = bx(u);
      return { x, y: bedY(x, drop, y0) - r + 1, rot: ((u * CH_W) / (2 * Math.PI * r)) * 360 };
    }
    if (settled) {
      const x = bx(0.93) - i * 15 - 55;
      return { x, y: bedY(x, drop, y0) - r + 1, rot: 0 };
    }
    const x = bx(bigX0(i));
    return { x, y: bedY(x, drop, y0) - r + 1, rot: 0 };
  });
  const note = '흐르는 물은 흙 알갱이를 함께 옮겨요.';
  const bedPts = `${BOX.x},${fix(bedY(BOX.x, drop, y0))} ${BOX.x + BOX.w},${fix(bedY(BOX.x + BOX.w, drop, y0))}`;
  const topAt = (x: number) => bedY(x, drop, y0) - depth;

  return (
    <figure className="view stream-grains" aria-label="흙 알갱이 보기">
      <figcaption>흙 알갱이 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`물길 단면을 크게 그린 그림: 작은 알갱이 ${SMALL_COUNT}개는 물에 떠서 흘러가고, 큰 알갱이 ${BIG_COUNT}개는 바닥을 굴러가요. ${note}`}
      >
        <text x={BOX.x} y="18" fontSize="14" fontWeight="700" fill="currentColor">물길 단면 확대</text>
        <defs>
          <clipPath id="stream-grain-clip">
            <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx="6" />
          </clipPath>
        </defs>
        <g clipPath="url(#stream-grain-clip)">
          {showWater && (
            <polygon
              data-testid="grain-water"
              points={`${BOX.x},${fix(bedY(BOX.x, drop, y0))} ${BOX.x},${fix(topAt(BOX.x))} ${BOX.x + BOX.w},${fix(topAt(BOX.x + BOX.w))} ${BOX.x + BOX.w},${fix(bedY(BOX.x + BOX.w, drop, y0))}`}
              fill="#4aa8e0"
              fillOpacity="0.45"
            />
          )}
          <polygon points={`${bedPts} ${BOX.x + BOX.w},${BOX.y + BOX.h} ${BOX.x},${BOX.y + BOX.h}`} fill="#b9803f" stroke="#6b4423" strokeWidth="2" />
          <g data-testid="grains" data-running={moving ? 'true' : 'false'} data-state={moving ? 'moving' : settled ? 'settled' : 'idle'}>
            {small.map((g, i) => (
              <circle key={`s${i}`} data-testid="small-grain" cx={fix(g.x)} cy={fix(g.y)} r="3.2" fill="#e6c48b" stroke="#6b4423" strokeWidth="1.2" />
            ))}
            {big.map((g, i) => (
              <path key={`b${i}`} data-testid="big-grain" d={bigPath(7)} transform={`translate(${fix(g.x)} ${fix(g.y)}) rotate(${fix(g.rot)})`} fill="#8a5a2b" stroke="#3f2a14" strokeWidth="1.8" strokeLinejoin="round" />
            ))}
          </g>
        </g>
        <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        {/* 라벨: 물과 흙 알갱이를 한 번씩만 쓴다 */}
        <rect x="10" y="188" width="14" height="12" rx="2" fill="#4aa8e0" fillOpacity="0.55" stroke="#2f8fd8" strokeWidth="1.5" />
        <text x="32" y="199" fontSize="14" fill="currentColor">물</text>
        <circle cx="16" cy="219" r="3.2" fill="#e6c48b" stroke="#6b4423" strokeWidth="1.2" />
        <path d={bigPath(6)} transform="translate(34 219)" fill="#8a5a2b" stroke="#3f2a14" strokeWidth="1.5" strokeLinejoin="round" />
        <text x="48" y="224" fontSize="14" fill="currentColor">흙 알갱이</text>
      </svg>
      <p className="view-note" data-testid="stream-grain-note">{note}</p>
    </figure>
  );
}

function fix(n: number) {
  return n.toFixed(1);
}
