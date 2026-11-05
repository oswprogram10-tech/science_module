import { SALT_G, type SeparationSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { useLoopPhase, usePrefersReducedMotion } from '../transpiration/motion';
import { startSample, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 268;
/** 위: 비커 속 확대 그림, 아래: 거름종이 구멍 그림 */
const TOP = { x: 8, y: 30, w: 224, h: 104 };
const LOW = { x: 8, y: 142, w: 224, h: 68 };
const PAPER_Y = 178;
/** 거름종이 구멍: 중심 x 목록과 구멍 폭 */
export const HOLES = [40, 90, 140, 190] as const;
export const HOLE_W = 12;
const WOBBLE = 1.8;
const WOBBLE_SPEED = 1.1;

/** 녹은 소금 알갱이 수: 녹은 양(g) × 2 */
export const dissolvedDotCount = (dissolvedG: number) => Math.round(dissolvedG * 2);
/** 녹지 않은 소금 덩어리 수: 남은 양(g)을 1.5 g 단위로 올림 */
export const lumpCount = (dissolvedG: number) => Math.max(0, Math.ceil((SALT_G - dissolvedG) / 1.5 - 1e-6));
/** 모래 알갱이(크고 각진 갈색) 수 */
export const SAND_PIECES = 4;

/** 물 속 녹은 소금 알갱이 자리(고정): 겹치지 않게 흩어 놓는다. */
export const dissolvedSlot = (i: number) => ({ x: 20 + ((i * 53) % 100) * 1.84, y: 42 + ((i * 37) % 100) * 0.38 });
/** 모래 자리(맨 아래, 왼쪽부터) */
const sandSlot = (i: number) => ({ x: 28 + i * 34, y: TOP.y + TOP.h - 12 });
const lumpSlot = (i: number) => ({ x: 150 + (i % 4) * 18, y: TOP.y + TOP.h - 10 - Math.floor(i / 4) * 14 });

const sandPath = (x: number, y: number) => `M${x - 9} ${y + 6} L${x - 6} ${y - 6} L${x + 3} ${y - 9} L${x + 10} ${y - 1} L${x + 7} ${y + 7} Z`;

export function SaltSandParticleView({ trial, snapshot, values, experiment, playhead }: ViewProps<SeparationSample>) {
  const reduced = usePrefersReducedMotion();
  const ran = trial !== undefined;
  // 따르기 시행이면 아래 그림은 거름종이 대신 윗물을 따르는 모습이다. 실행 전에는 어느 쪽도 아닌 중립 그림이다.
  const pour = ran && toParams(values).filter === 'pour';
  const s = snapshot ?? startSample(values, experiment);
  const last = trial ? (trial.samples as SeparationSample[]).at(-1)!.t : 0;
  // 실험 중(플레이헤드가 끝에 닿기 전)에만 녹은 알갱이가 움직인다. 움직임 줄이기이면 언제나 멈춰 있다.
  const running = ran && !reduced && playhead < last - 1e-9;
  const phase = useLoopPhase(running, WOBBLE_SPEED);
  const nDissolved = dissolvedDotCount(s.dissolvedG);
  const nLump = lumpCount(s.dissolvedG);
  const note = pour ? '윗물을 따르면 가라앉지 않은 모래 알갱이도 함께 넘어갈 수 있어요.' : ran ? '녹은 소금 알갱이는 아주 작아서 거름종이 구멍을 지나가요.' : '실험하면 비커 속 소금과 모래 알갱이가 어떻게 달라지는지 볼 수 있어요.';
  const segs: [number, number][] = [];
  let x = LOW.x + 4;
  for (const c of HOLES) {
    segs.push([x, c - HOLE_W / 2]);
    x = c + HOLE_W / 2;
  }
  segs.push([x, LOW.x + LOW.w - 4]);

  return (
    <figure className="view salt-sand-particles" aria-label="알갱이 보기">
      <figcaption>알갱이 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`비커 속을 크게 그린 그림: 녹은 소금 알갱이 ${nDissolved}개, 녹지 않은 소금 덩어리 ${nLump}개, 모래 알갱이 ${SAND_PIECES}개. 아래에는 ${pour ? '윗물을 따를 때 소금 알갱이와 모래 알갱이 일부가 함께 넘어가는' : '구멍이 있는 거름종이'} 그림이 있어요.`}
      >
        <text x={TOP.x} y="22" fontSize="14" fontWeight="700" fill="currentColor">비커 속 확대</text>
        <rect x={TOP.x} y={TOP.y} width={TOP.w} height={TOP.h} rx="6" fill="#bfe0f5" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.5" />
        {/* 물 알갱이: 작고 흐린 동그라미 */}
        <g data-testid="water-dots" opacity="0.5">
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={22 + (i % 10) * 20.5} cy={48 + Math.floor(i / 10) * 24} r="2.5" fill="none" stroke="#2b7aa8" strokeWidth="1" />
          ))}
        </g>
        <g data-testid="dissolved-dots" data-count={nDissolved} data-running={running ? 'true' : 'false'}>
          {Array.from({ length: nDissolved }, (_, i) => {
            const p = dissolvedSlot(i);
            return (
              <circle
                key={i}
                data-testid="dissolved-dot"
                cx={(p.x + WOBBLE * Math.sin(2 * Math.PI * (phase + i * 0.37))).toFixed(1)}
                cy={(p.y + WOBBLE * Math.cos(2 * Math.PI * (phase + i * 0.61))).toFixed(1)}
                r="3.5"
                fill="#1d4ed8"
                stroke="#1e3a8a"
                strokeWidth="1"
              />
            );
          })}
        </g>
        <g data-testid="lumps" data-count={nLump}>
          {Array.from({ length: nLump }, (_, i) => {
            const p = lumpSlot(i);
            return <rect key={i} data-testid="lump" x={p.x - 7} y={p.y - 6} width="14" height="12" rx="2" fill="#ffffff" stroke="#374151" strokeWidth="1.5" />;
          })}
        </g>
        <g data-testid="sand-pieces" data-count={SAND_PIECES}>
          {Array.from({ length: SAND_PIECES }, (_, i) => {
            const p = sandSlot(i);
            return <path key={i} data-testid="sand-piece" d={sandPath(p.x, p.y)} fill="#92400e" stroke="#451a03" strokeWidth="1.5" strokeLinejoin="round" />;
          })}
        </g>

        {/* 거름종이 구멍 그림: 모래는 걸리고 녹은 소금은 지나간다. 실험하기 전에는 알갱이를 그리지 않는다. */}
        <rect x={LOW.x} y={LOW.y} width={LOW.w} height={LOW.h} rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        {pour ? (
          <g data-testid="pour-diagram">
            <g transform="translate(70 152) rotate(30)" data-testid="pour-beaker-micro">
              <path d="M0 0 V34 H48 V0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <rect x="1" y="10" width="46" height="24" fill="#bfe0f5" fillOpacity="0.85" />
              {[10, 24, 38].map((x) => (
                <path key={x} data-testid="settled-sand" d={sandPath(x, 26)} transform={`translate(${x} 26) scale(0.5) translate(${-x} -26)`} fill="#92400e" stroke="#451a03" strokeWidth="2" strokeLinejoin="round" />
              ))}
              {[[12, 16], [26, 15], [38, 18]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1" />)}
            </g>
            <path d="M112 176 Q132 178 150 200" fill="none" stroke="#4aa8e0" strokeWidth="3" strokeDasharray="4 3" data-testid="pour-stream" />
            {[[122, 181], [138, 189], [148, 198]].map(([x, y], i) => <circle key={i} data-testid="poured-dot" cx={x} cy={y! - 6} r="3.5" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1" />)}
            {[[130, 190], [143, 197]].map(([x, y], i) => (
              <path key={i} data-testid="poured-sand" d={sandPath(x!, y!)} transform={`translate(${x} ${y}) scale(0.6) translate(${-x!} ${-y!})`} fill="#92400e" stroke="#451a03" strokeWidth="2" strokeLinejoin="round" />
            ))}
          </g>
        ) : (
          <>
        <g data-testid="paper" stroke="#a16207" strokeWidth="5" strokeLinecap="butt">
            {segs.map(([a, b], i) => (
              <line key={i} x1={a} y1={PAPER_Y} x2={b} y2={PAPER_Y} />
            ))}
          </g>
          {ran && (
            <g data-testid="paper-particles">
              {[65, 115, 165].map((cx, i) => <path key={`b${i}`} data-testid="blocked-sand" d={sandPath(cx, PAPER_Y - 12)} fill="#92400e" stroke="#451a03" strokeWidth="1.5" strokeLinejoin="round" />)}
              {HOLES.slice(0, 3).map((c, i) => (
                <g key={i}>
                  <circle data-testid="passing-dot" cx={c} cy={PAPER_Y - 14} r="3.5" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1" />
                  <circle cx={c} cy={PAPER_Y} r="3.5" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1" />
                  <circle cx={c} cy={PAPER_Y + 14} r="3.5" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1" />
                </g>
              ))}
            </g>
          )}
          </>
        )}

        {/* 라벨: 네 가지 알갱이를 한 번씩만 쓴다 */}
        <circle cx="16" cy="226" r="5" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1" />
        <text x="28" y="231" fontSize="14" fill="currentColor">녹은 소금</text>
        <rect x="116" y="220" width="12" height="11" rx="2" fill="#ffffff" stroke="#374151" strokeWidth="1.5" />
        <text x="134" y="231" fontSize="14" fill="currentColor">녹지 않은 소금</text>
        <path d={sandPath(16, 250)} transform="scale(1)" fill="#92400e" stroke="#451a03" strokeWidth="1.5" strokeLinejoin="round" />
        <text x="30" y="255" fontSize="14" fill="currentColor">모래</text>
        {pour ? (
          <>
            <line x1="112" y1="250" x2="130" y2="250" stroke="#4aa8e0" strokeWidth="3" strokeDasharray="4 3" />
            <text x="136" y="255" fontSize="14" fill="currentColor" data-testid="pour-label">윗물만 따르기</text>
          </>
        ) : (
          <>
            <line x1="112" y1="250" x2="130" y2="250" stroke="#a16207" strokeWidth="5" />
            <text x="136" y="255" fontSize="14" fill="currentColor">거름종이</text>
          </>
        )}
      </svg>
      <p className="view-note" data-testid="salt-sand-particle-note">{note}</p>
    </figure>
  );
}
