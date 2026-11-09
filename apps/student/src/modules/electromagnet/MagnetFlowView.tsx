import { useEffect, useRef, useState } from 'react';
import type { ElectromagnetSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { initialSample, magnetResult } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 356;
const FIELD = { x: 120, y: 92 };
const TOP_Y = 206;
const BOTTOM_Y = 300;
const LEFT_X = 36;
const RIGHT_X = 204;
const SWITCH_A = 240; // 스위치 위 단자
const SWITCH_B = 270; // 스위치 아래 단자
const DOT_SPACING = 22;
/** 점이 움직이는 빠르기: flow 1당 1초에 움직이는 거리(px). */
export const DOT_SPEED = 40;
const COPPER = '#b45309';

type Pt = [number, number];
interface Seg {
  id: string;
  pts: Pt[];
  /** 이 갈래에서 점이 움직이는 빠르기의 비율(병렬의 갈래는 1/2) */
  factor: number;
  /** 화살표를 놓을 위치(경로를 따라 잰 거리, px) */
  arrows: number[];
}

const reversed = (s: Seg): Seg => ({ ...s, pts: [...s.pts].reverse(), arrows: s.arrows.map((a) => segLength(s.pts) - a).reverse() });

export function segLength(pts: Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return L;
}

/** 경로를 따라 s만큼 간 곳의 좌표와 진행 방향(도). */
export function pointAt(pts: Pt[], s: number): { x: number; y: number; angle: number } {
  let rest = s;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (rest <= len || i === pts.length - 1) {
      const k = len === 0 ? 0 : Math.min(1, Math.max(0, rest / len));
      return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI };
    }
    rest -= len;
  }
  return { x: pts[0]![0], y: pts[0]![1], angle: 0 };
}

/** 전지 연결과 전지 방향에 따른 점이 지나가는 길. 병렬이면 두 갈래가 따로 있고 갈래의 빠르기는 절반이다. */
export function circuitSegments(battery: string, reverse: boolean): Seg[] {
  const segs: Seg[] =
    battery === 'parallel'
      ? [
          { id: 'main', pts: [[156, 300], [RIGHT_X, 300], [RIGHT_X, TOP_Y], [LEFT_X, TOP_Y], [LEFT_X, 300], [84, 300]], factor: 1, arrows: [24, 70, 125, 170, 275, 355, 428] },
          { id: 'upper', pts: [[84, 300], [84, 284], [156, 284], [156, 300]], factor: 0.5, arrows: [30, 76] },
          { id: 'lower', pts: [[84, 300], [84, 316], [156, 316], [156, 300]], factor: 0.5, arrows: [30, 76] },
        ]
      : [{ id: 'loop', pts: [[LEFT_X, 300], [RIGHT_X, 300], [RIGHT_X, TOP_Y], [LEFT_X, TOP_Y], [LEFT_X, 300]], factor: 1, arrows: [30, 140, 180, 285, 400, 470] }];
  return reverse ? segs.map(reversed) : segs;
}

/** 점의 좌표들: 갈래마다 일정한 간격으로 놓고, phase(첫 갈래 기준 거리)만큼 앞으로 보낸다. */
export function dotPositions(seg: Seg, phase: number): Pt[] {
  const L = segLength(seg.pts);
  const count = Math.max(1, Math.round(L / DOT_SPACING));
  return Array.from({ length: count }, (_, i) => {
    const s = (((i * L) / count + phase * seg.factor) % L + L) % L;
    const p = pointAt(seg.pts, s);
    return [p.x, p.y];
  });
}

/** 켜진 동안 코일 주위 곡선 개수: 클립 수에 비례해 0~6개. */
export const fieldCurveCount = (clips: number) => (clips > 0.05 ? Math.min(6, Math.ceil(clips / 5)) : 0);

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [reduced, setReduced] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function Battery({ cx, cy, reverse }: { cx: number; cy: number; reverse: boolean }) {
  // 긴 판이 + 극, 짧고 굵은 판이 − 극. 처음 방향은 + 가 오른쪽.
  const plusX = cx + (reverse ? -6 : 6);
  const minusX = cx + (reverse ? 6 : -6);
  return (
    <g data-testid="cell">
      <rect x={cx - 12} y={cy - 3} width="24" height="6" fill="var(--card)" />
      <line x1={plusX} y1={cy - 11} x2={plusX} y2={cy + 11} stroke="currentColor" strokeWidth="2" />
      <line x1={minusX} y1={cy - 6} x2={minusX} y2={cy + 6} stroke="currentColor" strokeWidth="4" />
      <text x={plusX} y={cy - 14} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">+</text>
      <text x={minusX} y={cy - 14} textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">−</text>
    </g>
  );
}

export function MagnetFlowView({ experiment, snapshot, values }: ViewProps<ElectromagnetSample>) {
  const s = snapshot ?? initialSample(values, experiment);
  const { headPole } = magnetResult(values, experiment);
  const reverse = values.direction === 'reverse';
  const battery = String(values.battery);
  const on = s.on >= 0.5;
  const flow = s.flow;
  const reduced = usePrefersReducedMotion();
  const running = flow > 0.001 && !reduced;

  const flowRef = useRef(flow);
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);
  const [phase, setPhase] = useState(0);
  // 점의 움직임: 켜져 있고 움직임 줄이기가 아닐 때만 requestAnimationFrame을 돌린다. 꺼지거나 화면이 사라지면 바로 멈춘다.
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      setPhase((p) => p + flowRef.current * DOT_SPEED * dt);
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);

  const segs = circuitSegments(battery, reverse);
  const curves = on ? fieldCurveCount(s.clips) : 0;
  const leftPole = headPole;
  const rightPole = headPole === 'N' ? 'S' : 'N';
  const speedText = flow > 0 ? `전기가 흘러요(점의 빠르기 ${flow.toFixed(1)})` : '전기가 흐르지 않아요';
  const batteryText = battery === 'series' ? '전지 2개 직렬 연결' : battery === 'parallel' ? '전지 2개 병렬 연결' : '전지 1개';
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;
  const wirePath = (pts: Pt[]) => `M${pts.map((p) => p.join(' ')).join(' L')}`;

  return (
    <figure className="view flow" aria-label="전기가 흐르는 모습">
      <figcaption>전기가 흐르는 모습</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        data-animating={running ? 'true' : 'false'}
        aria-label={`전기가 흐르는 모습: ${batteryText}, ${speedText}${curves > 0 ? `, 코일 주위에 곡선 ${curves}개` : ''}`}
      >
        {/* 코일 주위 곡선: 자석의 힘이 미치는 모양을 단순하게 그린 그림 */}
        <g data-testid="field-curves" data-count={curves} fill="none" stroke="#2563eb" strokeWidth="1.8" opacity="0.85">
          {Array.from({ length: curves }, (_, i) => (
            <ellipse key={i} cx={FIELD.x} cy={FIELD.y} rx={68 + 10 * i} ry={27 + 7 * i} />
          ))}
        </g>
        <rect x="92" y="80" width="56" height="24" rx="3" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
        <g stroke={COPPER} strokeWidth="2.2" strokeLinecap="round">
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={98 + i * 9 - 2} y1="101" x2={98 + i * 9 + 2} y2="83" />
          ))}
        </g>
        {on && (
          <g data-testid="field-poles" fontSize="14" fontWeight="700" fill="currentColor">
            <text x="76" y={FIELD.y + 10} textAnchor="middle" {...halo}>{leftPole}</text>
            <text x="164" y={FIELD.y + 10} textAnchor="middle" {...halo}>{rightPole}</text>
          </g>
        )}
        {curves > 0 && <text x={FIELD.x} y="18" textAnchor="middle" fontSize="14" fill="currentColor">자석의 힘</text>}

        {/* 회로 */}
        <g fill="none" stroke="currentColor" strokeWidth="2" data-testid="circuit">
          {segs.map((seg) => (
            <path key={seg.id} d={wirePath(seg.pts)} />
          ))}
        </g>
        <path d={`M${RIGHT_X} ${SWITCH_A} V${SWITCH_B}`} stroke="var(--card)" strokeWidth="6" />
        <g data-testid="switch" data-closed={on ? 'true' : 'false'}>
          <line
            x1={RIGHT_X}
            y1={SWITCH_B}
            x2={on ? RIGHT_X : RIGHT_X + 18}
            y2={on ? SWITCH_A : SWITCH_A + 6}
            stroke={on ? '#15803d' : 'currentColor'}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx={RIGHT_X} cy={SWITCH_A} r="3.5" fill="currentColor" />
          <circle cx={RIGHT_X} cy={SWITCH_B} r="3.5" fill="currentColor" />
        </g>
        <text x={RIGHT_X - 10} y={SWITCH_B - 8} textAnchor="end" fontSize="14" fill="currentColor">스위치</text>

        {/* 코일 기호 */}
        <rect x="92" y={TOP_Y - 10} width="56" height="20" rx="3" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
        <g stroke={COPPER} strokeWidth="2.2" strokeLinecap="round">
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={98 + i * 9 - 2} y1={TOP_Y + 7} x2={98 + i * 9 + 2} y2={TOP_Y - 7} />
          ))}
        </g>
        <text x="120" y={TOP_Y - 16} textAnchor="middle" fontSize="14" fill="currentColor">코일</text>

        {/* 전지 */}
        {battery === 'parallel' ? (
          <>
            <Battery cx={120} cy={284} reverse={reverse} />
            <Battery cx={120} cy={316} reverse={reverse} />
          </>
        ) : battery === 'series' ? (
          <>
            <Battery cx={96} cy={BOTTOM_Y} reverse={reverse} />
            <Battery cx={144} cy={BOTTOM_Y} reverse={reverse} />
          </>
        ) : (
          <Battery cx={120} cy={BOTTOM_Y} reverse={reverse} />
        )}
        <text x="120" y="348" textAnchor="middle" fontSize="14" fill="currentColor">전지</text>

        {/* 움직이는 점 */}
        <g data-testid="flow-dots" fill="#f59e0b" stroke="#92400e" strokeWidth="1">
          {segs.map((seg) =>
            dotPositions(seg, reduced ? 0 : phase).map(([x, y], i) => (
              <circle key={`${seg.id}${i}`} data-testid="flow-dot" cx={x.toFixed(2)} cy={y.toFixed(2)} r="3.5" />
            )),
          )}
        </g>
        {/* 움직임 줄이기: 점은 멈춰 있고 방향만 화살표로 */}
        {reduced && on && (
          <g data-testid="flow-arrows" fill="#1d4ed8" stroke="var(--card)" strokeWidth="1">
            {segs.flatMap((seg) =>
              seg.arrows.map((a) => {
                const p = pointAt(seg.pts, a);
                return <polygon key={`${seg.id}${a}`} points="-6,-5 7,0 -6,5" transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`} />;
              }),
            )}
          </g>
        )}
      </svg>
      <p className="view-note">점이 빠를수록 전기가 많이 흘러요.</p>
    </figure>
  );
}
