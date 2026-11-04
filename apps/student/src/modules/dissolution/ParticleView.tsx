import { useEffect, useMemo, useRef } from 'react';
import type { DissolutionSample } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { scaleCount } from '../../platform/deviceTier';
import { useParticleScale } from '../../platform/DeviceTierContext';

const W = 240;
const H = 240;
const MAX_DISSOLVED = 220;
const MAX_UNDISSOLVED = 60;
const WATER_COUNT = 140;

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

function makeDots(n: number, seed: number, place: (r: () => number) => [number, number]): Dot[] {
  const r = mulberry(seed);
  return Array.from({ length: n }, () => {
    const [x, y] = place(r);
    return { x, y, ph: r() * Math.PI * 2, r: r() };
  });
}

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ParticleView({ snapshot }: ViewProps<DissolutionSample>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dissolved = snapshot?.dissolvedG ?? 0;
  const undissolved = snapshot?.undissolvedG ?? 0;
  const scale = useParticleScale();
  const nD = Math.min(scaleCount(MAX_DISSOLVED, scale), Math.round(dissolved * 6));
  const nU = Math.min(scaleCount(MAX_UNDISSOLVED, scale), Math.round(undissolved * 12));

  const water = useMemo(() => makeDots(WATER_COUNT, 1, (r) => [10 + r() * (W - 20), 20 + r() * (H - 30)]), []);
  const dissolvedDots = useMemo(() => makeDots(MAX_DISSOLVED, 2, (r) => [14 + r() * (W - 28), 24 + r() * (H - 40)]), []);
  const pile = useMemo(
    () => makeDots(MAX_UNDISSOLVED, 3, (r) => [W / 2 + (r() - 0.5) * 60, H - 12 - r() * 14]),
    [],
  );

  const stateRef = useRef({ nD, nU });
  stateRef.current = { nD, nU };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = prefersReduced();
    const amp = reduced ? 0 : 1;
    let raf = 0;

    const draw = (time: number) => {
      const { nD: d, nU: u } = stateRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#eef6fc';
      ctx.fillRect(0, 0, W, H);
      const wob = (dot: Dot, speed: number, size: number) => ({
        x: dot.x + Math.sin(time / 600 * speed + dot.ph) * size * amp,
        y: dot.y + Math.cos(time / 700 * speed + dot.ph * 1.3) * size * amp,
      });
      ctx.fillStyle = 'rgba(70, 140, 210, 0.55)';
      for (const dot of water) {
        const p = wob(dot, 1, 3);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // 녹은 알갱이: 물 알갱이 사이로 흩어진다.
      ctx.fillStyle = '#e0952b';
      for (let i = 0; i < d; i++) {
        const dot = dissolvedDots[i]!;
        const p = wob(dot, 1.6 + dot.r, 5);
        ctx.beginPath();
        ctx.rect(p.x - 2.5, p.y - 2.5, 5, 5);
        ctx.fill();
      }
      // 녹지 않은 알갱이: 바닥에 뭉친다.
      ctx.fillStyle = '#8a5a14';
      for (let i = 0; i < u; i++) {
        const dot = pile[i]!;
        const p = wob(dot, 0.3, 0.8);
        ctx.beginPath();
        ctx.rect(p.x - 3, p.y - 3, 6, 6);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [water, dissolvedDots, pile, nD, nU]); // 움직임을 줄인 경우 값이 바뀔 때 한 번씩 다시 그린다

  return (
    <figure className="view particles" aria-label="알갱이로 보기">
      <figcaption>알갱이로 보기</figcaption>
      <canvas ref={canvasRef} width={W} height={H} role="img" aria-label={`알갱이 그림: 흩어진 알갱이 ${nD}개, 바닥에 뭉친 알갱이 ${nU}개`} />
      <p className="view-note">
        <span className="legend water-dot" aria-hidden="true">●</span> 물
        <span className="legend dissolved-dot" aria-hidden="true">■</span> 녹은 알갱이
        <span className="legend pile-dot" aria-hidden="true">■</span> 녹지 않은 알갱이
      </p>
    </figure>
  );
}
