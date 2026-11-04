import { useRef, type KeyboardEvent } from 'react';
import type { VariableExperiment as Experiment } from '@sci/schema';
import type { Trial } from '@sci/runtime';
import { sampleAt, trialDuration } from '@sci/runtime';
import type { AnyModule, GraphMarker } from '../modules/types';
import { formatTick, niceScale, yAxis } from '../axis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTrial = Trial<any, any>;

interface Props {
  module: AnyModule;
  experiment: Experiment;
  trial: AnyTrial | undefined;
  prev: AnyTrial | undefined;
  playhead: number;
  playing: boolean;
  onPlayhead: (t: number) => void;
  describedBy: string;
}

const DEFAULT_X_LABEL = '시간(초)';
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

export function GraphView({ module: mod, experiment, trial, prev, playhead, playing, onPlayhead, describedBy }: Props) {
  const sampleKey = String(mod.metric.sampleKey);
  const { name: yName, unit: yUnit } = splitLabel(mod.graph.yLabel);
  const xLabel = mod.graph.xLabel ?? DEFAULT_X_LABEL;
  const { unit: xUnit } = splitLabel(xLabel);
  const yMin = mod.graph.yMin ?? 0;
  /** y축 범위용 최댓값: 모든 표본 중 가장 큰 값(올랐다가 내려오는 곡선도 담도록). */
  const yDataMax = (t: AnyTrial | undefined) => {
    if (!t) return yMin;
    const s = t.samples as Record<string, number>[];
    return s.reduce((m, p) => Math.max(m, Number(p[sampleKey])), -Infinity);
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const xData = Math.max(trial ? trialDuration(trial) : 0, prev ? trialDuration(prev) : 0);
  const fixedTicks = mod.graph.xTicks;
  const xScale = fixedTicks && fixedTicks.length > 1
    ? { max: fixedTicks[fixedTicks.length - 1]!, step: 0, ticks: fixedTicks, decimals: 0 }
    : niceScale(xData);
  const xTickText = (t: number) => (mod.graph.xTickFormat ? mod.graph.xTickFormat(t) : formatTick(t, xScale.decimals));
  // 정수 눈금 단원은 최댓값을 4 이상으로 잡아 눈금 간격이 1 아래로 내려가지 않게 한다.
  const yScale = yAxis(Math.max(yDataMax(trial), yDataMax(prev), mod.graph.integerTicks ? yMin + 4 : 0), yMin);
  const xMax = xScale.max;
  const markerSpec = mod.graph.markers;
  const markers =
    trial && markerSpec
      ? (typeof markerSpec === 'function' ? markerSpec(experiment, trial) : markerSpec).filter((m) => m.t >= 0 && m.t <= xMax)
      : [];
  const yMax = yScale.max;
  const sx = (t: number) => M.l + (t / xMax) * (W - M.l - M.r);
  // 라벨 자리: 다음 표식의 선을 가로지르거나 오른쪽 끝을 넘으면 선의 왼쪽에 쓰고, 앞 라벨과 겹치면 한 줄 아래로 내린다(글자 폭은 한글 12, 공백 4로 넉넉히 어림).
  const labelW = (label: string) => [...label].reduce((w, ch) => w + (ch === ' ' ? 4 : 12), 0);
  const placedMarkers = markers.reduce<{ m: GraphMarker; row: number; flip: boolean; right: number }[]>((acc, m, i) => {
    const x = sx(m.t);
    const w = labelW(m.label);
    const nextX = i + 1 < markers.length ? sx(markers[i + 1]!.t) : Infinity;
    const flip = x + 3 + w > W - M.r || x + 3 + w > nextX - 2;
    const left = flip ? x - 3 - w : x + 3;
    const prev = acc[acc.length - 1];
    const row = prev && left < prev.right ? prev.row + 1 : 0;
    acc.push({ m, row, flip, right: flip ? x - 3 : x + 3 + w });
    return acc;
  }, []);
  const sy = (g: number) => H - M.b - ((g - yMin) / (yMax - yMin)) * (H - M.t - M.b);

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
        'aria-valuetext': `${r1(playhead)}${xUnit}, ${yName} ${r1(sampleAt(trial, playhead, mod.interpolate)[sampleKey])}${yUnit ? ` ${yUnit}` : ''}`,
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
                <text x={sx(t)} y={H - M.b + 15} textAnchor="middle">{xTickText(t)}</text>
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
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor">{xLabel}</text>
        <text transform={`translate(11 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="currentColor">{mod.graph.yLabel}</text>
        {placedMarkers.map(({ m, row, flip }) => (
          <g key={`${m.t}:${m.label}`} data-testid="graph-marker">
            <line x1={sx(m.t)} x2={sx(m.t)} y1={M.t} y2={H - M.b} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            {flip ? (
              <text x={sx(m.t) - 3} y={M.t + 11 + 16 * row} textAnchor="end" fontSize="12" fill="currentColor">{m.label}</text>
            ) : (
              <text x={sx(m.t) + 3} y={M.t + 11 + 16 * row} fontSize="12" fill="currentColor">{m.label}</text>
            )}
          </g>
        ))}
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
