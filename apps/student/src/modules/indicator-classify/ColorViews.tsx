import { useEffect, useState } from 'react';
import type { ClassificationExperiment, ColorPattern } from '@sci/schema';

const FALLBACK_WATER = '#e8eef3';
const PATTERN_INK = '#10202f';

/** 색 견본에 겹치는 SVG 패턴 정의. 화면에 한 번만 두고 url(#pat-이름)으로 참조한다. */
export function PatternDefs() {
  const p = { stroke: PATTERN_INK, strokeOpacity: 0.6, strokeWidth: 1.6, fill: 'none' } as const;
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <pattern id="pat-diagonal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" {...p} />
        </pattern>
        <pattern id="pat-diagonal-sparse" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="13" {...p} />
        </pattern>
        <pattern id="pat-dots" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.6" fill={PATTERN_INK} fillOpacity="0.6" />
        </pattern>
        <pattern id="pat-cross" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 0L8 8M8 0L0 8" {...p} strokeWidth={1.2} />
        </pattern>
        <pattern id="pat-horizontal" width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="3" x2="6" y2="3" {...p} />
        </pattern>
        <pattern id="pat-vertical" width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="3" y1="0" x2="3" y2="6" {...p} />
        </pattern>
      </defs>
    </svg>
  );
}

const patternFill = (pattern: ColorPattern | undefined) =>
  !pattern || pattern === 'none' ? 'none' : `url(#pat-${pattern})`;

/** 목표 색으로 0.6초 동안 바뀌는 hex. from이 없으면 바로 목표 색. prefers-reduced-motion은 CSS가 처리한다. */
function useFadedHex(target: string, from: string | undefined): string {
  const [hex, setHex] = useState(from ?? target);
  useEffect(() => {
    if (from === undefined) {
      setHex(target);
      return;
    }
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setHex(target));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [target, from]);
  return hex;
}

/** 색 견본 + 패턴. 색 이름 글자는 곁에서 함께 보여 준다. */
export function Swatch({
  exp,
  colorKey,
  fromKey,
  width = 28,
  height = 28,
}: {
  exp: ClassificationExperiment;
  colorKey: string;
  /** 있으면 이 색에서 colorKey로 바뀌는 모습을 보인다. */
  fromKey?: string;
  width?: number;
  height?: number;
}) {
  const def = exp.colors[colorKey];
  const hex = useFadedHex(def?.hex ?? FALLBACK_WATER, fromKey ? exp.colors[fromKey]?.hex : undefined);
  return (
    <svg className="swatch" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width={width - 2} height={height - 2} rx="4" style={{ fill: hex, transition: 'fill .6s ease' }} />
      <rect x="1" y="1" width={width - 2} height={height - 2} rx="4" fill={patternFill(def?.pattern)} />
      <rect x="1" y="1" width={width - 2} height={height - 2} rx="4" fill="none" stroke="currentColor" strokeOpacity="0.55" />
    </svg>
  );
}

/** 선택한 용액의 시험관. 액체 색은 마지막으로 넣은 용액형 지시약의 결과색이다. */
export function TestTube({
  exp,
  label,
  liquidKey,
  fromKey,
}: {
  exp: ClassificationExperiment;
  label: string;
  /** 액체 색 키. 없으면 맑은 용액. */
  liquidKey: string | null;
  fromKey?: string;
}) {
  const key = liquidKey ?? 'clear';
  const def = exp.colors[key];
  const hex = useFadedHex(def?.hex ?? FALLBACK_WATER, liquidKey && fromKey ? exp.colors[fromKey]?.hex : undefined);
  const liquid = 'M32 92H88V178a28 28 0 0 1-56 0Z';
  return (
    <svg viewBox="0 0 120 200" role="img" aria-label={`${label} 시험관`} className="tube">
      <path d={liquid} style={{ fill: hex, transition: 'fill .6s ease' }} />
      <path d={liquid} fill={liquidKey ? patternFill(def?.pattern) : 'none'} />
      <path d="M30 12V178a30 30 0 0 0 60 0V12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 12H96" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
