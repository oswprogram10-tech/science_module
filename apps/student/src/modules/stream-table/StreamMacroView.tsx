import { pourSeconds, type StreamSample, type VesselKind } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { clamp01, startSample, streamNote, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 240;
/** 상자 바닥, 언덕 꼭대기 x, 언덕 끝(발치) x, 평평한 곳 끝 x, 평평한 곳 높이 */
const BASE = 212;
const X_TOP = 14;
export const X_FOOT = 134;
const X_FLAT_END = 196;
export const FLAT_Y = 184;
/** 언덕이 평평한 곳보다 높은 정도(그림 단위): 완만 36, 가파름 84 */
export const dropOf = (slope: 'gentle' | 'steep') => (slope === 'steep' ? 84 : 36);
/** 골이 파이는 구간 */
const G0 = 34;
const G1 = 126;
/** 깎인 흙 100 g일 때 골의 깊이, 쌓인 흙 100 g일 때 흙 더미의 폭·높이(그림 단위). 그래프의 y축 끝(100 g)과 맞춘다. */
const GROOVE_MAX = 20;
const FAN_W_MIN = 6;
const FAN_W_MAX = 58;
const FAN_H_MIN = 2;
const FAN_H_MAX = 26;
/** 그릇 입구 오른쪽 끝(물이 쏟아지는 곳) */
const SPOUT_X = 62;

export const grooveDepth = (eroded: number) => GROOVE_MAX * clamp01(eroded / 100);
export const fanWidth = (deposited: number) => FAN_W_MIN + (FAN_W_MAX - FAN_W_MIN) * clamp01(deposited / 100);
export const fanHeight = (deposited: number) => FAN_H_MIN + (FAN_H_MAX - FAN_H_MIN) * clamp01(deposited / 100);

const fixed = (n: number) => n.toFixed(1);

/** 파이지 않은 흙 표면의 높이 */
function baseY(x: number, drop: number): number {
  if (x <= X_TOP) return FLAT_Y - drop;
  if (x >= X_FOOT) return FLAT_Y;
  return FLAT_Y - drop + ((x - X_TOP) / (X_FOOT - X_TOP)) * drop;
}

/** 골이 파인 표면의 높이(위쪽 언덕 구간만 판다) */
function surfaceY(x: number, drop: number, eroded: number): number {
  const d = x > G0 && x < G1 ? grooveDepth(eroded) * Math.sin((Math.PI * (x - G0)) / (G1 - G0)) : 0;
  return baseY(x, drop) + d;
}

/** 쌓인 흙 더미의 겉모양 높이(비탈 발치에서 오른쪽으로 부채꼴처럼 퍼진다) */
function fanY(x: number, deposited: number): number {
  const x0 = X_FOOT - 6;
  const w = fanWidth(deposited) + 6;
  if (x <= x0 || x >= x0 + w) return FLAT_Y;
  const u = (x - x0) / w;
  return FLAT_Y - fanHeight(deposited) * Math.sin(Math.PI * Math.pow(u, 0.7));
}

const topY = (x: number, drop: number, s: Pick<StreamSample, 'eroded' | 'deposited'>) => Math.min(surfaceY(x, drop, s.eroded), s.deposited > 0 ? fanY(x, s.deposited) : FLAT_Y);

function points(x0: number, x1: number, step: number, y: (x: number) => number): string {
  const out: string[] = [];
  for (let x = x0; x < x1; x += step) out.push(`${fixed(x)} ${fixed(y(x))}`);
  out.push(`${fixed(x1)} ${fixed(y(x1))}`);
  return out.join(' L');
}

/** 그릇 아이콘: 입구 오른쪽 끝이 원점. 기울여서 물을 쏟는다. */
function Vessel({ kind }: { kind: VesselKind }) {
  const cup = 'M0 0 L-22 0 L-18 28 L-4 28 Z';
  const bottle = 'M0 0 L-8 0 L-8 8 L-18 16 L-18 46 L10 46 L10 16 L0 8 Z';
  return (
    <g data-testid="vessel" data-kind={kind} transform={`rotate(${kind === 'cup' ? 65 : 58}) scale(${kind === 'cup' ? 1 : 0.75})`}>
      <path d={kind === 'cup' ? cup : bottle} fill="#e5eef7" fillOpacity="0.9" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={kind === 'cup' ? 'M-19.5 8 L-3 8 L-3.5 12 L-19 12 Z' : 'M-16 24 L8 24 L8 44 L-16 44 Z'} fill="#4aa8e0" fillOpacity="0.8" />
    </g>
  );
}

export function StreamMacroView({ trial, snapshot, values, experiment }: ViewProps<StreamSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  // 실행 전에는 어떤 결과도 보이지 않도록 t = 0 의 빈 상태를 그린다.
  const s = ran ? (snapshot ?? startSample(values, experiment)) : startSample(values, experiment);
  const eroded = ran ? s.eroded : 0;
  const deposited = ran ? s.deposited : 0;
  const drop = dropOf(p.slope);
  const yTop = FLAT_Y - drop;
  const flowing = ran && s.flow > 1e-9;
  const pouring = ran && s.pouring;
  const note = ran ? streamNote(s) : '실험하면 물이 흙 언덕을 어떻게 바꾸는지 볼 수 있어요.';
  const spoutY = yTop - 16;
  const landY = topY(SPOUT_X + 1, drop, { eroded, deposited });
  const waterW = 2 + 3 * s.flow;
  const surface = { eroded, deposited };

  // 물받이: 지금까지 부은 물의 높이(0.05 L/s)와, 쌓이지 않고 흘러 나간 흙
  const poured = ran ? 0.05 * Math.min(s.t, pourSeconds(p.waterL)) : 0;
  const trayInner = BASE - (FLAT_Y + 2);
  const trayWater = Math.min(trayInner - 2, poured * 9);
  const outflow = Math.max(0, eroded - deposited);
  const trayMud = Math.min(8, outflow * 0.25);

  const soil = `M10 ${BASE} L10 ${fixed(yTop)} L${points(X_TOP, X_FLAT_END, 4, (x) => surfaceY(x, drop, eroded))} L${X_FLAT_END} ${BASE} Z`;
  const fan = deposited > 0.05 ? `M${X_FOOT - 6} ${FLAT_Y} L${points(X_FOOT - 6, X_FOOT + fanWidth(deposited), 3, (x) => fanY(x, deposited))} L${fixed(X_FOOT + fanWidth(deposited))} ${FLAT_Y} Z` : '';
  const grooveMidY = surfaceY((G0 + G1) / 2, drop, eroded);
  const labelY = Math.max(40, grooveMidY - 38);
  const fanPeakY = deposited > 0.05 ? FLAT_Y - fanHeight(deposited) - 1 : FLAT_Y - 3;
  const fanPeakX = X_FOOT - 6 + (fanWidth(deposited) + 6) * 0.35;

  return (
    <figure className="view stream-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`흐르는 물 실험 상자를 옆에서 본 그림: ${p.slope === 'steep' ? '가파른' : '완만한'} 흙 언덕 위쪽에서 물을 붓고, 아래쪽 평평한 곳을 지나 물받이로 흘러요. ${note}`}
      >
        {/* 흙 언덕: 위쪽에서 파인 골은 깎인 흙에 따라 깊어진다 */}
        <path data-testid="soil" d={soil} fill="#b9803f" stroke="#6b4423" strokeWidth="2" strokeLinejoin="round" />
        <path data-testid="groove" data-depth={fixed(grooveDepth(eroded))} d={`M${points(G0, G1, 4, (x) => surfaceY(x, drop, eroded))}`} fill="none" stroke="#6b4423" strokeWidth="3" strokeLinecap="round" />
        {/* 쌓인 흙: 비탈 발치의 평평한 곳에 부채꼴로 퍼진다 */}
        {fan && (
          <g data-testid="deposit-fan" data-width={fixed(fanWidth(deposited))} data-height={fixed(fanHeight(deposited))}>
            <path d={fan} fill="#e6c48b" stroke="#6b4423" strokeWidth="2" strokeLinejoin="round" />
            {[0.66, 0.33].map((k) => (
              <path
                key={k}
                d={`M${X_FOOT - 6} ${FLAT_Y} L${points(X_FOOT - 6, X_FOOT - 6 + (fanWidth(deposited) + 6) * k, 3, (x) => FLAT_Y - k * (FLAT_Y - fanY(X_FOOT - 6 + (x - (X_FOOT - 6)) / k, deposited)))}`}
                fill="none"
                stroke="#6b4423"
                strokeWidth="1"
                opacity="0.6"
              />
            ))}
          </g>
        )}
        {/* 상자 바닥 */}
        <line x1="10" y1={BASE} x2="234" y2={BASE} stroke="currentColor" strokeWidth="2.5" />
        {/* 물받이 */}
        <g data-testid="tray">
          {trayWater > 0.05 && <rect data-testid="tray-water" x={X_FLAT_END + 4} y={BASE - trayWater} width={232 - X_FLAT_END - 6} height={trayWater} fill="#4aa8e0" fillOpacity="0.75" />}
          {trayMud > 0.05 && <rect data-testid="tray-mud" x={X_FLAT_END + 4} y={BASE - trayMud} width={232 - X_FLAT_END - 6} height={trayMud} fill="#b9803f" />}
          <path d={`M${X_FLAT_END + 2} ${FLAT_Y + 2} V${BASE} H232 V${FLAT_Y + 2}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        {/* 흐르는 물: 그릇에서 쏟아져 비탈을 따라 내려가 평평한 곳을 지나 물받이로 떨어진다 */}
        {flowing && (
          <g data-testid="water-stream" data-flow={s.flow.toFixed(2)} fill="none" stroke="#2f8fd8" strokeWidth={waterW} strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
            <path d={`M${SPOUT_X + 1} ${fixed(spoutY + 2)} L${SPOUT_X + 1} ${fixed(landY - 1)} L${points(SPOUT_X + 1, X_FLAT_END, 4, (x) => topY(x, drop, surface) - 1)} L${X_FLAT_END + 4} ${FLAT_Y + 4}`} />
          </g>
        )}
        {/* 그릇은 붓는 동안에만 보인다 */}
        {pouring && (
          <g transform={`translate(${SPOUT_X} ${fixed(spoutY)})`}>
            <Vessel kind={p.vessel} />
          </g>
        )}
        {/* 라벨 */}
        <line x1="98" y1={fixed(labelY + 5)} x2="80" y2={fixed(grooveMidY - 4)} stroke="currentColor" strokeWidth="1.5" />
        <text x="96" y={fixed(labelY)} fontSize="14" fontWeight="700" fill="currentColor">깎인 곳</text>
        <line x1="166" y1={FLAT_Y - FAN_H_MAX - 10} x2={fixed(fanPeakX)} y2={fixed(fanPeakY)} stroke="currentColor" strokeWidth="1.5" />
        <text x="150" y={FLAT_Y - FAN_H_MAX - 12} fontSize="14" fontWeight="700" fill="currentColor">쌓인 곳</text>
        <text x="234" y="232" textAnchor="end" fontSize="14" fill="currentColor">물받이</text>
      </svg>
      <p className="view-note" data-testid="stream-note">{note}</p>
    </figure>
  );
}
