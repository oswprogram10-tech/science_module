import { useRef, type KeyboardEvent } from 'react';
import type { Trial } from '@sci/runtime';
import { sampleAt, trialDuration } from '@sci/runtime';
import type { AnyModule } from '../modules/types';
import { formatTick, niceScale } from '../axis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTrial = Trial<any, any>;

interface Props {
  module: AnyModule;
  trial: AnyTrial | undefined;
  prev: AnyTrial | undefined;
  playhead: number;
  playing: boolean;
  onPlayhead: (t: number) => void;
  describedBy: string;
}

const W = 320;
const H = 240;
const M = { l: 44, r: 12, t: 14, b: 38 };
const MAX_POINTS = 160;

/** 'name(unit)' 형태의 y축 라벨을 이름과 단위로 나눈다. */
function splitLabel(label: string): { name: string; unit: string } {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(label);
  return m ? { name: m[1]!, unit: m[2]! } : { name: label, unit: '' };
}

function toPoints(
  trial: AnyTrial,
  key: string,
  sx: (t: number) => number,
  sy: (g: number) => number,
) {
  const s = trial.samples as Record<string, number>[];
  const step = Math.max(1, Math.ceil(s.length / MAX_POINTS));
  const pts: string[] = [];
  for (let i = 0; i < s.length; i += step) pts.push(`${sx(s[i]!.t!).toFixed(1)},${sy(s[i]![key]!).toFixed(1)}`);
  const last = s[s.length - 1]!;
  pts.push(`${sx(last.t!).toFixed(1)},${sy(last[key]!).toFixed(1)}`);
  return pts.join(' ');
}

export function GraphView({ module: mod, trial, prev, playhead, playing, onPlayhead, describedBy }: Props) {
  const sampleKey = String(mod.metric.sampleKey);
  const { name: yName, unit: yUnit } = splitLabel(mod.graph.yLabel);
  /** y축 범위용 최댓값: 처음 값과 마지막 값 중 큰 쪽(둘 사이에서 이보다 커지는 일은 없다). */
  const yDataMax = (t: AnyTrial | undefined) =>
    t ? Math.max(Number(t.result[mod.metric.resultKey]), Number((t.samples[0] as Record<string, number>)[sampleKey])) : 0;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const xScale = niceScale(Math.max(trial ? trialDuration(trial) : 0, prev ? trialDuration(prev) : 0));
  const yScale = niceScale(Math.max(yDataMax(trial), yDataMax(prev)) * 1.05);
  const xMax = xScale.max;
  const yMax = yScale.max;
  const sx = (t: number) => M.l + (t / xMax) * (W - M.l - M.r);
  const sy = (g: number) => H - M.b - (g / yMax) * (H - M.t - M.b);

  const move = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || !trial || playing) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    onPlayhead(((x - M.l) / (W - M.l - M.r)) * xMax);
  };

  const duration = trial ? trialDuration(trial) : 0;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!trial || playing) return;
    const small = duration / 50;
    const large = duration / 10;
    let next: number;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = playhead - small;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = playhead + small;
        break;
      case 'PageDown':
        next = playhead - large;
        break;
      case 'PageUp':
        next = playhead + large;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = duration;
        break;
      default:
        return;
    }
    e.preventDefault();
    onPlayhead(next);
  };
  const sliderProps = trial
    ? {
        role: 'slider' as const,
        tabIndex: 0,
        'aria-label': '그래프 시각 옮기기',
        'aria-valuemin': 0,
        'aria-valuemax': r1(duration),
        'aria-valuenow': r1(playhead),
        'aria-valuetext': `${r1(playhead)}초, ${yName} ${r1(sampleAt(trial, playhead, mod.interpolate)[sampleKey])}${yUnit ? ` ${yUnit}` : ''}`,
        'aria-disabled': playing ? true : undefined,
        onKeyDown,
      }
    : {
        role: 'img' as const,
        'aria-label': `시간에 따른 ${yName} 그래프. 자세한 값은 결과표를 보세요.`,
      };

  return (
    <figure className="view graph" aria-label="그래프로 보기">
      <figcaption>그래프로 보기</figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        {...sliderProps}
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
        {trial && (
          <g fontSize="10" fill="currentColor">
            {xScale.ticks.map((t) => (
              <g key={`x${t}`}>
                <line x1={sx(t)} x2={sx(t)} y1={H - M.b} y2={H - M.b + 4} stroke="#666" />
                <text x={sx(t)} y={H - M.b + 15} textAnchor="middle">{formatTick(t, xScale.decimals)}</text>
              </g>
            ))}
            {yScale.ticks.map((g) => (
              <g key={`y${g}`}>
                <line x1={M.l} x2={W - M.r} y1={sy(g)} y2={sy(g)} stroke="currentColor" opacity="0.12" />
                <line x1={M.l - 4} x2={M.l} y1={sy(g)} y2={sy(g)} stroke="#666" />
                <text x={M.l - 7} y={sy(g) + 3} textAnchor="end">{formatTick(g, yScale.decimals)}</text>
              </g>
            ))}
          </g>
        )}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor">시간(초)</text>
        <text transform={`translate(11 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="currentColor">{mod.graph.yLabel}</text>
        {prev && <polyline points={toPoints(prev, sampleKey, sx, sy)} fill="none" stroke="#7a8794" strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />}
        {trial && <polyline points={toPoints(trial, sampleKey, sx, sy)} fill="none" stroke="#1f6fb5" strokeWidth="2.5" />}
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
        {trial && !playing ? ' · 그래프를 누르거나 ← → 키로 시각을 옮겨 보세요.' : ''}
      </p>
    </figure>
  );
}
