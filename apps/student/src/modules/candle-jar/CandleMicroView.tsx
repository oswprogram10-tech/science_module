import { useEffect, useMemo, useRef } from 'react';
import type { CombustionSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { scaleCount } from '../../platform/deviceTier';
import { useParticleScale } from '../../platform/DeviceTierContext';

const W = 240;
const H = 240;
const TOTAL = 60;
/** 공기 21 %일 때 산소 알갱이 수 */
const O2_AT_START = 13;
const START_PCT = 21;
/** 줄어든 산소 알갱이 중 이산화 탄소로 바뀌는 비율(나머지는 물) */
const CO2_SHARE = 0.7;

// 집기병 모양(안쪽 영역)
const JAR = { l: 54, r: 186, t: 26, b: 226, radius: 22 };

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dot { x: number; y: number; ph: number; r: number }

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function jarPath(ctx: CanvasRenderingContext2D) {
  const { l, r, t, b, radius } = JAR;
  ctx.beginPath();
  ctx.moveTo(l, b);
  ctx.lineTo(l, t + radius);
  ctx.quadraticCurveTo(l, t, l + radius, t);
  ctx.lineTo(r - radius, t);
  ctx.quadraticCurveTo(r, t, r, t + radius);
  ctx.lineTo(r, b);
}

/** scale: 기기 등급 배율. 전체 알갱이 수와 처음 산소 알갱이 수에 같이 곱해 산소 비율(약 21 %)을 지킨다. */
export function counts(oxygenPct: number, scale = 1) {
  const total = scale === 1 ? TOTAL : scaleCount(TOTAL, scale);
  const o2Start = scale === 1 ? O2_AT_START : scaleCount(O2_AT_START, scale);
  const o2 = Math.max(0, Math.min(o2Start, Math.round((o2Start * oxygenPct) / START_PCT)));
  const lost = o2Start - o2;
  const co2 = Math.round(lost * CO2_SHARE);
  return { o2, co2, water: lost - co2, other: total - o2Start, total, o2Start };
}

export function CandleMicroView({ snapshot }: ViewProps<CombustionSample>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = useParticleScale();
  const { o2, co2, water, other, total, o2Start } = counts(snapshot?.oxygenPct ?? START_PCT, scale);

  const dots = useMemo(() => {
    const r = mulberry(7);
    return Array.from({ length: TOTAL }, (): Dot => ({
      x: JAR.l + 12 + r() * (JAR.r - JAR.l - 24),
      y: JAR.t + 14 + r() * (JAR.b - JAR.t - 28),
      ph: r() * Math.PI * 2,
      r: r(),
    }));
  }, []);

  const stateRef = useRef({ o2, co2, total, o2Start });
  stateRef.current = { o2, co2, total, o2Start };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = prefersReduced();
    const amp = reduced ? 0 : 1;
    let raf = 0;

    const draw = (time: number) => {
      const { o2: nO, co2: nC, total: nTotal, o2Start: nO2Start } = stateRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#eef6fc';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(160, 205, 235, 0.35)';
      jarPath(ctx);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#33414f';
      ctx.lineWidth = 3;
      jarPath(ctx);
      ctx.stroke();

      dots.forEach((dot, i) => {
        if (i >= nTotal) return;
        const x = dot.x + Math.sin((time / 600) * (1 + dot.r) + dot.ph) * 6 * amp;
        const y = dot.y + Math.cos((time / 700) * (1 + dot.r) + dot.ph * 1.3) * 6 * amp;
        if (i >= nO2Start) {
          ctx.fillStyle = '#8a949e'; // 그 밖의 기체
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (i < nO) {
          ctx.fillStyle = '#d93a2f'; // 산소
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (i - nO < nC) {
          ctx.fillStyle = '#111'; // 이산화 탄소
          ctx.fillRect(x - 4.5, y - 4.5, 9, 9);
        } else {
          ctx.fillStyle = '#1f6fb5'; // 물
          ctx.beginPath();
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x + 5.5, y + 4);
          ctx.lineTo(x - 5.5, y + 4);
          ctx.closePath();
          ctx.fill();
        }
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [dots, o2, co2, water, total]); // 움직임을 줄인 경우 값이 바뀔 때 한 번씩 다시 그린다

  return (
    <figure className="view particles" aria-label="알갱이로 보기">
      <figcaption>알갱이로 보기</figcaption>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        role="img"
        aria-label={`알갱이 그림: 산소 알갱이 ${o2}개, 이산화 탄소 알갱이 ${co2}개, 물 알갱이 ${water}개, 그 밖의 기체 알갱이 ${other}개`}
      />
      <p className="view-note">
        <span className="legend-item"><span className="legend o2-dot" aria-hidden="true">●</span> 산소</span>{' '}
        <span className="legend-item"><span className="legend co2-dot" aria-hidden="true">■</span> 이산화 탄소</span>{' '}
        <span className="legend-item"><span className="legend h2o-dot" aria-hidden="true">▲</span> 물</span>{' '}
        <span className="legend-item"><span className="legend other-dot" aria-hidden="true">●</span> 그 밖의 기체</span>
      </p>
    </figure>
  );
}
