import { useEffect, useMemo, useRef } from 'react';
import type { GasSample } from '@sci/engine-matter';
import { mulberry32 } from '@sci/sensors';
import type { ViewProps } from '../types';

const W = 240;
const H = 240;
const BOX_L = 20;
const BOX_R = 220;
const BOX_BOTTOM = 230;
const BOX_MAX_H = 200; // 60 mL
const SCALE_MAX = 60;
const MAX_PARTICLES = 100;
const R = 3.5;
const BASE_SPEED = 70; // px/s, 실온 기준
const REF_K = 293.15;

const GAS: Record<string, { name: string; color: string; glyph: string; shape: 'circle' | 'square' | 'diamond' }> = {
  air: { name: '공기', color: '#2f6fb5', glyph: '●', shape: 'circle' },
  oxygen: { name: '산소', color: '#c8372d', glyph: '■', shape: 'square' },
  carbonDioxide: { name: '이산화 탄소', color: '#4d4d4d', glyph: '◆', shape: 'diamond' },
};

interface Seed { nx: number; ny: number; dx: number; dy: number }
interface Particle { x: number; y: number; dx: number; dy: number }

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const boxHeight = (volumeMl: number) => Math.max(10, (volumeMl / SCALE_MAX) * BOX_MAX_H);

export function GasMicroView({ snapshot, values }: ViewProps<GasSample>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startMl = Number(values.startMl);
  const volume = snapshot?.volumeMl ?? startMl;
  const pressure = snapshot?.pressureAtm ?? 1;
  const gasTempC = snapshot?.gasTempC ?? 20;
  const gas = GAS[String(values.gasType)] ?? GAS.air!;
  const count = Math.min(MAX_PARTICLES, Math.max(1, Math.round(startMl))); // 처음 부피에 비례

  // 시드 고정 의사난수로 처음 위치와 방향을 정한다.
  const seeds = useMemo<Seed[]>(() => {
    const r = mulberry32(4242);
    return Array.from({ length: MAX_PARTICLES }, () => {
      const a = r() * Math.PI * 2;
      return { nx: r(), ny: r(), dx: Math.cos(a), dy: Math.sin(a) };
    });
  }, []);

  const drawRef = useRef<(() => void) | null>(null);
  const live = useRef({ volume, gasTempC, count, gas });
  live.current = { volume, gasTempC, count, gas };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = prefersReduced();
    const top0 = BOX_BOTTOM - boxHeight(live.current.volume);
    const parts: Particle[] = seeds.map((s) => ({
      x: BOX_L + R + s.nx * (BOX_R - BOX_L - 2 * R),
      y: top0 + R + s.ny * (BOX_BOTTOM - top0 - 2 * R),
      dx: s.dx,
      dy: s.dy,
    }));

    const shape = (g: (typeof GAS)[string], x: number, y: number) => {
      ctx.beginPath();
      if (g.shape === 'circle') ctx.arc(x, y, R, 0, Math.PI * 2);
      else if (g.shape === 'square') ctx.rect(x - R, y - R, 2 * R, 2 * R);
      else {
        ctx.moveTo(x, y - R - 1);
        ctx.lineTo(x + R + 1, y);
        ctx.lineTo(x, y + R + 1);
        ctx.lineTo(x - R - 1, y);
        ctx.closePath();
      }
      ctx.fill();
    };

    const draw = () => {
      const { volume: v, count: n, gas: g } = live.current;
      const bh = boxHeight(v);
      const top = BOX_BOTTOM - bh;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#eef6fc';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(BOX_L, top, BOX_R - BOX_L, bh);
      ctx.strokeStyle = '#33414f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(BOX_L, top);
      ctx.lineTo(BOX_L, BOX_BOTTOM);
      ctx.lineTo(BOX_R, BOX_BOTTOM);
      ctx.lineTo(BOX_R, top);
      ctx.stroke();
      // 피스톤(위쪽 벽)
      ctx.fillStyle = '#8a949e';
      ctx.fillRect(BOX_L - 4, top - 6, BOX_R - BOX_L + 8, 6);
      ctx.fillStyle = g.color;
      for (let i = 0; i < n; i++) {
        const p = parts[i]!;
        if (reduced) {
          // 움직임을 멈추고, 처음 위치를 지금 상자 크기에 맞춰 놓는다.
          const s = seeds[i]!;
          shape(g, BOX_L + R + s.nx * (BOX_R - BOX_L - 2 * R), top + R + s.ny * (bh - 2 * R));
        } else shape(g, p.x, p.y);
      }
    };

    const step = (dtS: number) => {
      const { volume: v, gasTempC: tc } = live.current;
      const top = BOX_BOTTOM - boxHeight(v);
      const speed = BASE_SPEED * Math.sqrt((tc + 273.15) / REF_K);
      for (const p of parts) {
        p.x += p.dx * speed * dtS;
        p.y += p.dy * speed * dtS;
        if (p.x < BOX_L + R) { p.x = BOX_L + R; p.dx = Math.abs(p.dx); }
        if (p.x > BOX_R - R) { p.x = BOX_R - R; p.dx = -Math.abs(p.dx); }
        if (p.y < top + R) { p.y = top + R; p.dy = Math.abs(p.dy); }
        if (p.y > BOX_BOTTOM - R) { p.y = BOX_BOTTOM - R; p.dy = -Math.abs(p.dy); }
      }
    };

    drawRef.current = draw;
    if (reduced) {
      draw();
      return () => {
        drawRef.current = null;
      };
    }
    let raf = 0;
    let last: number | null = null;
    const frame = (time: number) => {
      const dt = last === null ? 0 : Math.min((time - last) / 1000, 0.05);
      last = time;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      drawRef.current = null;
    };
  }, [seeds]);

  // 움직임을 줄인 경우: 값이 바뀔 때 한 번씩 다시 그린다.
  useEffect(() => {
    if (prefersReduced()) drawRef.current?.();
  }, [volume, count, gas, gasTempC]);

  return (
    <figure className="view particles" aria-label="알갱이로 보기">
      <figcaption>알갱이로 보기</figcaption>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        role="img"
        aria-label={`알갱이 그림: ${gas.name} 알갱이 ${count}개가 ${volume.toFixed(1)} mL 크기의 상자 안에서 움직여요`}
      />
      <div className="pressure-bar">
        <span id="pressure-bar-label">피스톤에 부딪히는 정도</span>
        <div
          className="bar-track"
          role="meter"
          aria-labelledby="pressure-bar-label"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={Math.round(pressure * 100) / 100}
          aria-valuetext={`처음보다 ${pressure.toFixed(1)}배`}
        >
          <div className="bar-fill" style={{ width: `${Math.min(100, (pressure / 2) * 100)}%` }} />
        </div>
        <span className="bar-text">처음보다 {pressure.toFixed(1)}배</span>
      </div>
      <p className="view-note">
        {Object.entries(GAS).map(([key, g]) => (
          <span key={key} className={key === values.gasType ? 'gas-now' : undefined}>
            <span className="legend" style={{ color: g.color }} aria-hidden="true">{g.glyph}</span>
            {g.name}
          </span>
        ))}
      </p>
    </figure>
  );
}
