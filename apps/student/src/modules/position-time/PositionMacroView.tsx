import type { PositionTimeSample, PtObject, PtWeather } from '@sci/engine-physics';
import { flashPositions } from '@sci/engine-physics';
import type { ViewProps } from '../types';
import { OBJECT_TEXT, RULER_MAX, WEATHER_TEXT, metersText, positionNote, rulerTicks, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 216;
/** 눈금자의 왼쪽(0 m)과 오른쪽(끝) x */
export const X0 = 30;
export const X1 = 210;
export const GROUND_Y = 128;
const RULER_Y = 140;
/** 겹쳐 그린 그림이 서로 이 거리(그림 단위)보다 가까우면 하나만 그린다. */
const MIN_GAP = 1;

/** 위치(m) → x. 눈금자 끝을 넘지 않는다. */
export const xOf = (object: PtObject, posM: number): number => X0 + (Math.min(posM, RULER_MAX[object]) / RULER_MAX[object]) * (X1 - X0);

/** 원점 = 땅 위 가운데. 위쪽이 −y. */
function Shape({ object }: { object: PtObject }) {
  switch (object) {
    case 'bike':
      return (
        <g stroke="currentColor" strokeWidth="2" fill="none">
          <circle cx="-9" cy="-6" r="6" />
          <circle cx="9" cy="-6" r="6" />
          <path d="M-9 -6 L-2 -16 L5 -16 L9 -6 M-2 -16 L-4 -20 M5 -16 L7 -22 L10 -22" stroke="#2563eb" strokeWidth="2.5" />
        </g>
      );
    case 'walker':
      return (
        <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none">
          <circle cx="0" cy="-34" r="4" fill="#f59e0b" />
          <path d="M0 -30 V-16 M0 -16 L-5 0 M0 -16 L5 0 M0 -27 L-6 -19 M0 -27 L6 -21" />
        </g>
      );
    case 'snail':
      return (
        <g stroke="currentColor" strokeWidth="1.5">
          <rect x="-12" y="-4" width="26" height="4" rx="2" fill="#84cc16" />
          <circle cx="2" cy="-10" r="7" fill="#a16207" />
          <circle cx="2" cy="-10" r="3" fill="none" />
          <path d="M12 -4 L14 -10 M15 -3 L18 -9" fill="none" />
        </g>
      );
    case 'tree':
      return (
        <g stroke="currentColor" strokeWidth="1.5">
          <rect x="-3" y="-18" width="6" height="18" fill="#92400e" />
          <circle cx="0" cy="-28" r="11" fill="#16a34a" />
        </g>
      );
  }
}

function WeatherIcon({ weather }: { weather: PtWeather }) {
  // 오른쪽 위 모서리의 그림: 맑음은 해, 흐림은 구름
  if (weather === 'sunny') {
    return (
      <g data-testid="weather-icon" data-weather="sunny" transform="translate(212 22)" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
        <circle cx="0" cy="0" r="6" fill="#fbbf24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="0" y1="-9" x2="0" y2="-12" transform={`rotate(${a})`} />
        ))}
      </g>
    );
  }
  return (
    <g data-testid="weather-icon" data-weather="cloudy" transform="translate(212 22)" stroke="#64748b" strokeWidth="1.5" fill="#cbd5e1">
      <ellipse cx="-4" cy="2" rx="8" ry="5" />
      <ellipse cx="5" cy="3" rx="8" ry="5" />
      <ellipse cx="0" cy="-3" rx="6" ry="5" />
    </g>
  );
}

export function PositionMacroView({ trial, snapshot, values }: ViewProps<PositionTimeSample>) {
  const p = toParams(values);
  const ran = trial !== undefined && snapshot !== null;
  // 실행하기 전에는 출발 위치(0 m)에 서 있고, 1초 간격 겹침 그림은 없다.
  const now = ran ? snapshot : null;
  const posNow = now ? now.posM : 0;
  const xNow = xOf(p.object, posNow);
  const ghosts: { t: number; x: number }[] = [];
  if (now) {
    let last = xNow;
    for (const f of flashPositions(p.object, p.watchS)) {
      if (f.t >= now.t - 1e-9) break;
      const x = xOf(p.object, f.posM);
      if (Math.abs(x - last) >= MIN_GAP && Math.abs(x - xNow) >= MIN_GAP) {
        ghosts.push({ t: f.t, x });
        last = x;
      }
    }
  }
  const note = positionNote(now, p.watchS);
  const ticks = rulerTicks(p.object);

  return (
    <figure className="view position-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${OBJECT_TEXT[p.object]}을(를) ${p.watchS}초 동안 보는 모습. 날씨 ${WEATHER_TEXT[p.weather]}. 눈금자는 0에서 ${RULER_MAX[p.object]} m까지. ${note}`}>
        <text x="8" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="object-label">보는 물체: {OBJECT_TEXT[p.object]}</text>
        <text x="8" y="38" fontSize="14" fill="currentColor" data-testid="weather-label">날씨: {WEATHER_TEXT[p.weather]}</text>
        <WeatherIcon weather={p.weather} />
        <g data-testid="pos-art" data-object={p.object} data-weather={p.weather} data-ran={ran ? 'yes' : 'no'} data-pos={posNow.toFixed(2)} data-ghosts={ghosts.length}>
          {/* 땅 */}
          <line x1="4" y1={GROUND_Y} x2={W - 4} y2={GROUND_Y} stroke="#64748b" strokeWidth="2" />
          {/* 1초마다 있던 자리: 흐리게 겹쳐 그린다 */}
          {ghosts.map((g) => (
            <g key={g.t} data-testid="flash" data-t={g.t} opacity="0.3" transform={`translate(${g.x} ${GROUND_Y})`}>
              <Shape object={p.object} />
            </g>
          ))}
          {/* 지금 있는 자리 */}
          <g data-testid="object" transform={`translate(${xNow} ${GROUND_Y})`}>
            <Shape object={p.object} />
          </g>
        </g>
        {/* 눈금자 */}
        <g data-testid="ruler" data-max={RULER_MAX[p.object]}>
          <line x1={X0} y1={RULER_Y} x2={X1} y2={RULER_Y} stroke="currentColor" strokeWidth="2" />
          {ticks.map((m, i) => (
            <g key={m}>
              <line x1={X0 + (i * (X1 - X0)) / 2} y1={RULER_Y - 4} x2={X0 + (i * (X1 - X0)) / 2} y2={RULER_Y + 5} stroke="currentColor" strokeWidth="2" />
              <text data-testid="ruler-tick" x={X0 + (i * (X1 - X0)) / 2} y={RULER_Y + 22} fontSize="14" textAnchor="middle" fill="currentColor">
                {m}
                {i === 2 && <tspan dx="3">m</tspan>}
              </text>
            </g>
          ))}
        </g>
        <text x="8" y="186" fontSize="14" fill="currentColor" data-testid="watch-label">관찰 시간 {p.watchS}초</text>
        <text x="8" y="204" fontSize="14" fontWeight="700" fill="currentColor" data-testid="pos-label">{ran ? `지금 위치 ${metersText(posNow)} m` : '실험하면 위치가 나타나요'}</text>
      </svg>
      <p className="view-note" data-testid="position-note">{note}</p>
    </figure>
  );
}
