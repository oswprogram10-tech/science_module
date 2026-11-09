import type { GreenhouseSample } from '@sci/engine-ssi';
import type { ViewProps } from '../types';
import { FLOW_IDLE_NOTE, FLOW_NOTE, HEAT_COUNT, LIMITS_TEXT, LIMITS_TITLE, greenhouseOutput, returningCount, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다(viewBox 폭 240은 이 칸의 실제 폭과 거의 같다).
export const W = 240;
export const H = 262;
/** 공기층 선, 병 윗면(열이 나오는 곳), 빛 화살표 */
export const LAYER_Y = 100;
const SURFACE_Y = 168;
const LIGHT_X = [64, 108, 152, 196];
const HEAT_X0 = 50;
const HEAT_DX = 20;

const LIGHT = '#eab308';
const HEAT = '#dc2626';
const BACK = '#c2410c';

/** 화살표: 머리가 (x2, y2)에 있고 (x1, y1)에서 출발한다. */
function Arrow({ x1, y1, x2, y2, color, dash, testid, kind }: { x1: number; y1: number; x2: number; y2: number; color: string; dash?: string; testid: string; kind: string }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <g data-testid={testid} data-kind={kind}>
      <line x1={x1} y1={y1} x2={x1 + ((x2 - x1) * (len - 3)) / len} y2={y1 + ((y2 - y1) * (len - 3)) / len} stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={dash} />
      <path transform={`translate(${x2} ${y2}) rotate(${deg.toFixed(1)})`} d="M-8 -5 L0 0 L-8 5 Z" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  );
}

export function HeatFlowView({ trial, snapshot, values, experiment }: ViewProps<GreenhouseSample>) {
  const ran = trial !== undefined;
  // 실행 전에는 열 화살표와 그 이름표를 그리지 않는다(어떤 조건에서 얼마나 되돌아오는지 드러내지 않는다).
  const trapped = ran ? (snapshot?.trapped ?? greenhouseOutput(values, experiment).samples[0]!.trapped) : 0;
  const back = ran ? returningCount(trapped) : 0;
  const p = toParams(values);
  const heat = Array.from({ length: HEAT_COUNT }, (_, i) => ({ x: HEAT_X0 + i * HEAT_DX, returns: i < back }));
  // 되돌아오는 화살표를 가운데에서 양쪽으로 고르게 놓아 그림이 한쪽으로 쏠리지 않게 한다.
  const order = [3, 4, 2, 5, 1, 6, 0, 7];
  const returnsAt = new Set(order.slice(0, back));
  const note = ran ? FLOW_NOTE : FLOW_IDLE_NOTE;
  const legend: Array<[string, string, string, string?]> = [
    [LIGHT, '들어오는 빛', 'legend-light'],
    [HEAT, '빠져나가는 열', 'legend-heat'],
    [BACK, '되돌아오는 열', 'legend-back', '4 3'],
  ];
  return (
    <figure className="view greenhouse-flow" aria-label="열이 드나드는 모습 보기">
      <figcaption>열이 드나드는 모습 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`전등 빛이 병으로 들어오는 화살표와${ran ? `, 병에서 나가려는 열 화살표 ${HEAT_COUNT}개 중 ${back}개가 공기층에서 되돌아오는 그림` : ' 병이 있는 그림'}. 덮개 ${p.cover === 'film' ? '씌움' : '없음'}, 병 속 공기 ${p.air === 'co2' ? '이산화 탄소를 더 넣은 공기' : '보통 공기'}. ${note}`}
      >
        {/* 들어오는 빛 */}
        <g data-testid="light-arrows">
          {LIGHT_X.map((x) => (
            <Arrow key={x} testid="light-arrow" kind="light" x1={x - 34} y1={6} x2={x} y2={SURFACE_Y - 6} color={LIGHT} />
          ))}
        </g>
        {/* 공기층(투명한 층): 점선만 그린다 */}
        <line data-testid="layer" x1="14" y1={LAYER_Y} x2="226" y2={LAYER_Y} stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
        {/* 병(단면) */}
        <rect x="30" y={SURFACE_Y} width="180" height="38" rx="8" fill="#e0f2fe" fillOpacity="0.55" stroke="currentColor" strokeWidth="2" />
        {/* 열 화살표 */}
        {ran && (
          <g data-testid="heat-arrows" data-total={HEAT_COUNT} data-returning={back}>
            {heat.map((h, i) => {
              const returns = returnsAt.has(i);
              return returns ? (
                <g key={i} data-testid="heat-back" data-x={h.x}>
                  <Arrow testid="heat-out-short" kind="heat-short" x1={h.x} y1={SURFACE_Y - 4} x2={h.x} y2={LAYER_Y + 4} color={HEAT} />
                  <Arrow testid="heat-return" kind="heat-return" x1={h.x + 9} y1={LAYER_Y + 16} x2={h.x + 9} y2={SURFACE_Y - 10} color={BACK} dash="4 3" />
                </g>
              ) : (
                <g key={i} data-testid="heat-escape" data-x={h.x}>
                  <Arrow testid="heat-out" kind="heat-out" x1={h.x} y1={SURFACE_Y - 4} x2={h.x} y2={LAYER_Y - 38} color={HEAT} />
                </g>
              );
            })}
          </g>
        )}
        {/* 이름표 */}
        <g data-testid="flow-legend" fontSize="14" fill="currentColor">
          {ran
            ? legend.map(([color, text, id, dash], i) => (
                <g key={id} data-testid={id}>
                  <line x1="8" y1={222 + i * 16} x2="30" y2={222 + i * 16} stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={dash} />
                  <text x="36" y={227 + i * 16} fontSize="14" fill="currentColor">{text}</text>
                </g>
              ))
            : (
                <g data-testid="legend-light">
                  <line x1="8" y1="222" x2="30" y2="222" stroke={LIGHT} strokeWidth="3" strokeLinecap="round" />
                  <text x="36" y="227" fontSize="14" fill="currentColor">들어오는 빛</text>
                </g>
              )}
        </g>
      </svg>
      <p className="view-note" data-testid="flow-note">{note}</p>
      <details className="limits" data-testid="model-limits">
        <summary>{LIMITS_TITLE}</summary>
        <p>{LIMITS_TEXT}</p>
      </details>
    </figure>
  );
}
