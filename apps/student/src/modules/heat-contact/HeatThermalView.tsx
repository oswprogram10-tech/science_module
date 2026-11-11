import type { HeatContactSample } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { thermalColor } from '../insulated-cup/CupThermalView';
import { startSample } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 186;
const OUTER = { x: 10, y: 24, w: 150, h: 96 };
const INNER = { x: 40, y: 24, w: 90, h: 72 };
const BAR = { x: 182, top: 28, bottom: 116 };
const tickY = (c: number) => BAR.bottom - ((c - 20) / 40) * (BAR.bottom - BAR.top);

export function HeatThermalView({ snapshot, values }: ViewProps<HeatContactSample>) {
  const s = snapshot ?? startSample(values);
  const innerText = `안쪽 컵 물 ${s.innerC.toFixed(1)} °C`;
  const outerText = `바깥 비커 물 ${s.outerC.toFixed(1)} °C`;

  return (
    <figure className="view thermal heat-thermal" aria-label="열화상으로 보기">
      <figcaption>열화상으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`열화상 그림: ${innerText}, ${outerText}`}>
        <defs>
          <linearGradient id="heat-thermal-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={thermalColor(60)} />
            <stop offset="0.5" stopColor={thermalColor(40)} />
            <stop offset="1" stopColor={thermalColor(20)} />
          </linearGradient>
        </defs>
        {/* 바깥 비커 물과 안쪽 컵 물: 색은 온도, 숫자는 아래에 따로 쓴다(색만으로 전달하지 않는다). */}
        <rect data-testid="thermal-outer" data-color={thermalColor(s.outerC)} x={OUTER.x} y={OUTER.y} width={OUTER.w} height={OUTER.h} fill={thermalColor(s.outerC)} stroke="currentColor" strokeWidth="2" />
        <rect data-testid="thermal-inner" data-color={thermalColor(s.innerC)} x={INNER.x} y={INNER.y} width={INNER.w} height={INNER.h} fill={thermalColor(s.innerC)} stroke="currentColor" strokeWidth="2" />
        {/* 색 막대 범례 */}
        <text x={BAR.x + 5} y={BAR.top - 10} textAnchor="middle" fontSize="14" fill="currentColor">°C</text>
        <rect x={BAR.x} y={BAR.top} width="10" height={BAR.bottom - BAR.top} fill="url(#heat-thermal-bar)" stroke="currentColor" strokeWidth="1" />
        {[60, 40, 20].map((c) => (
          <g key={c}>
            <line x1={BAR.x + 10} x2={BAR.x + 15} y1={tickY(c)} y2={tickY(c)} stroke="currentColor" strokeWidth="1" />
            <text x={BAR.x + 18} y={tickY(c) + 5} fontSize="14" fill="currentColor">{c}</text>
          </g>
        ))}
        {/* 숫자 온도 */}
        <rect x={OUTER.x} y="136" width="14" height="14" fill={thermalColor(s.innerC)} stroke="currentColor" strokeWidth="1.5" />
        <text x={OUTER.x + 22} y="148" fontSize="14" fontWeight="700" fill="currentColor" data-testid="thermal-inner-text">{innerText}</text>
        <rect x={OUTER.x} y="158" width="14" height="14" fill={thermalColor(s.outerC)} stroke="currentColor" strokeWidth="1.5" />
        <text x={OUTER.x + 22} y="170" fontSize="14" fontWeight="700" fill="currentColor" data-testid="thermal-outer-text">{outerText}</text>
      </svg>
      <p className="view-note">색이 붉을수록 온도가 높아요.<br />계산으로 그린 열화상 그림이에요.</p>
    </figure>
  );
}
