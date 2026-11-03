import { useRef } from 'react';
import type { Trial } from '@sci/runtime';
import { trialDuration } from '@sci/runtime';

interface Props {
  trial: Trial | undefined;
  prev: Trial | undefined;
  playhead: number;
  playing: boolean;
  onPlayhead: (t: number) => void;
  describedBy: string;
}

const W = 320;
const H = 240;
const M = { l: 44, r: 12, t: 14, b: 38 };
const MAX_POINTS = 160;

function niceMax(x: number) {
  if (x <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(x));
  const n = x / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function toPoints(trial: Trial, sx: (t: number) => number, sy: (g: number) => number) {
  const s = trial.samples;
  const step = Math.max(1, Math.ceil(s.length / MAX_POINTS));
  const pts: string[] = [];
  for (let i = 0; i < s.length; i += step) pts.push(`${sx(s[i]!.t).toFixed(1)},${sy(s[i]!.dissolvedG).toFixed(1)}`);
  const last = s[s.length - 1]!;
  pts.push(`${sx(last.t).toFixed(1)},${sy(last.dissolvedG).toFixed(1)}`);
  return pts.join(' ');
}

export function GraphView({ trial, prev, playhead, playing, onPlayhead, describedBy }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const xMax = niceMax(Math.max(trial ? trialDuration(trial) : 0, prev ? trialDuration(prev) : 0));
  const yMax = niceMax(
    Math.max(trial?.result.dissolvedG ?? 0, prev?.result.dissolvedG ?? 0, 1) * 1.05,
  );
  const sx = (t: number) => M.l + (t / xMax) * (W - M.l - M.r);
  const sy = (g: number) => H - M.b - (g / yMax) * (H - M.t - M.b);

  const move = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || !trial || playing) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    onPlayhead(((x - M.l) / (W - M.l - M.r)) * xMax);
  };

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <figure className="view graph" aria-label="그래프로 보기">
      <figcaption>그래프로 보기</figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="시간에 따른 녹은 양 그래프. 자세한 값은 결과표를 보세요."
        aria-describedby={describedBy}
        className={trial && !playing ? 'scrubbable' : undefined}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="none" stroke="#999" />
        {ticks.map((f) => (
          <g key={f} fontSize="10" fill="currentColor">
            <line x1={sx(f * xMax)} x2={sx(f * xMax)} y1={H - M.b} y2={H - M.b + 4} stroke="#666" />
            <text x={sx(f * xMax)} y={H - M.b + 15} textAnchor="middle">{Math.round(f * xMax)}</text>
            <line x1={M.l - 4} x2={M.l} y1={sy(f * yMax)} y2={sy(f * yMax)} stroke="#666" />
            <text x={M.l - 7} y={sy(f * yMax) + 3} textAnchor="end">{+(f * yMax).toFixed(1)}</text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor">시간(초)</text>
        <text transform={`translate(11 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="currentColor">녹은 양(g)</text>
        {prev && <polyline points={toPoints(prev, sx, sy)} fill="none" stroke="#7a8794" strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />}
        {trial && <polyline points={toPoints(trial, sx, sy)} fill="none" stroke="#1f6fb5" strokeWidth="2.5" />}
        {trial && (
          <g>
            <line x1={sx(playhead)} x2={sx(playhead)} y1={M.t} y2={H - M.b} stroke="#c0392b" strokeWidth="2" />
            <polygon points={`${sx(playhead) - 5},${M.t} ${sx(playhead) + 5},${M.t} ${sx(playhead)},${M.t + 7}`} fill="#c0392b" />
          </g>
        )}
        {!trial && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="#666">실험하면 그래프가 그려져요.</text>}
      </svg>
      <p className="view-note">
        {trial ? <><span className="legend line-now">━</span> 이번 시행 {prev && <><span className="legend line-prev">╌</span> 앞 시행</>}</> : ''}
        {trial && !playing ? ' · 그래프를 눌러 시각을 옮겨 보세요.' : ''}
      </p>
    </figure>
  );
}
