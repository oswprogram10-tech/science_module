import { ORBIT_DEG, SEASONS, type SeasonKind, type SunAngleSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { areaRatio } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 372;
const CX = 120;
const CY = 96;
const RX = 80;
const RY = 34;
const EARTH_R = 11;
const AXIS_HALF = 21;
const RAD = Math.PI / 180;

const SEASON_TEXT: Record<SeasonKind, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };

/** 공전 궤도 위의 위치(그림 좌표). 봄은 안쪽(위), 여름은 왼쪽, 가을은 앞(아래), 겨울은 오른쪽. */
export const orbitPoint = (season: SeasonKind) => {
  const o = ORBIT_DEG[season] * RAD;
  return { x: CX - RX * Math.sin(o), y: CY - RY * Math.cos(o) };
};

/** 땅에 닿는 빛의 폭(그림, px)과 막대로 그릴 수 있는 가장 긴 길이 */
const BEAM_W = 26;
const BAR_MAX = 150;
const GROUND_Y = 292;
const BAR_X = 62;
const RAY_LEN = 56;

export function SunSpaceView({ experiment, values }: ViewProps<SunAngleSample>) {
  const season = (SEASONS as readonly string[]).includes(String(values.season)) ? (values.season as SeasonKind) : 'spring';
  const tilt = Number(values.tiltDeg);
  const tiltLabel =
    experiment.variables.find((v) => v.key === 'tiltDeg')?.options.find((o) => o.value === values.tiltDeg)?.label.split(' ')[0] ?? `${tilt}°`;
  const ratio = areaRatio(values, experiment);
  // 남중 고도: sin(고도) = 봄의 sin / 넓이 비율. 그림에서 빛이 비스듬히 닿는 각도로 쓴다.
  const springAlt = 90 - Number(experiment.params?.latDeg ?? 37.5);
  const alt = Math.asin(Math.min(1, Math.sin(springAlt * RAD) / ratio));
  const barLen = Math.min(BAR_MAX, BEAM_W / Math.sin(alt));
  const bx = BAR_X;
  const rayDx = RAY_LEN * Math.cos(alt);
  const rayDy = RAY_LEN * Math.sin(alt);
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;
  const ratioText = ratio.toFixed(2);

  return (
    <figure className="view sun-space" aria-label="우주에서 보기">
      <figcaption>우주에서 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`공전 궤도의 네 계절 위치와 자전축 기울기 ${tiltLabel}. ${SEASON_TEXT[season]}에 같은 양의 빛이 닿는 넓이는 봄의 ${ratioText}배`}
      >
        <text x={CX} y="18" textAnchor="middle" fontSize="14" fill="currentColor">지구의 공전과 자전축</text>

        {/* 공전 궤도와 태양 */}
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx={CX} cy={CY} r="17" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
        <text x={CX} y={CY + 5} textAnchor="middle" fontSize="14" fill="#1f2937">태양</text>

        {/* 네 계절의 지구: 자전축은 모두 같은 방향으로 기울어 있다 */}
        {SEASONS.map((k) => {
          const { x, y } = orbitPoint(k);
          const on = k === season;
          const dx = AXIS_HALF * Math.sin(tilt * RAD);
          const dy = AXIS_HALF * Math.cos(tilt * RAD);
          const side = k === 'spring' || k === 'autumn';
          return (
            <g key={k} data-testid="earth" data-season={k} data-selected={on ? 'true' : 'false'}>
              <line data-testid="earth-axis" x1={x - dx} y1={y + dy} x2={x + dx} y2={y - dy} stroke="currentColor" strokeWidth="2" />
              <circle cx={x + dx} cy={y - dy} r="3" fill="currentColor" />
              <circle cx={x} cy={y} r={EARTH_R} fill="#3b82f6" stroke={on ? '#d97706' : '#1e3a8a'} strokeWidth={on ? 4 : 1.5} />
              <text
                x={side ? x + EARTH_R + 8 : x}
                y={side ? y + 5 : y + EARTH_R + 22}
                textAnchor={side ? 'start' : 'middle'}
                fontSize="14"
                fontWeight={on ? 700 : 400}
                fill="currentColor"
                {...halo}
              >
                {SEASON_TEXT[k]}
              </text>
            </g>
          );
        })}
        <text x={CX} y="178" textAnchor="middle" fontSize="14" fill="currentColor">자전축 기울기 {tiltLabel}</text>

        <line x1="8" y1="192" x2="232" y2="192" stroke="currentColor" strokeOpacity="0.25" />

        {/* 같은 폭의 햇빛 다발이 땅에 비스듬히 닿는 모습 */}
        <text x={CX} y="214" textAnchor="middle" fontSize="14" fill="currentColor">같은 양의 빛이 닿는 넓이</text>
        <g data-testid="beam" data-ratio={ratioText}>
          <polygon
            points={`${bx - rayDx},${GROUND_Y - rayDy} ${bx + barLen - rayDx},${GROUND_Y - rayDy} ${bx + barLen},${GROUND_Y} ${bx},${GROUND_Y}`}
            fill="#fbbf24"
            fillOpacity="0.55"
            stroke="#d97706"
            strokeWidth="1.5"
          />
        </g>
        <rect x="8" y={GROUND_Y} width="224" height="8" fill="#d6c7a1" stroke="#8a7a4f" strokeWidth="1" />
        <rect data-testid="area-bar" data-width={barLen.toFixed(1)} x={bx} y={GROUND_Y + 1} width={barLen} height="6" fill="#dc2626" />
        <text x={CX} y="330" textAnchor="middle" fontSize="14" fill="currentColor">넓이: 봄의 {ratioText}배</text>
        <text x={CX} y="352" textAnchor="middle" fontSize="14" fill="currentColor">좁을수록 땅이 더 따뜻해져요</text>
      </svg>
    </figure>
  );
}
