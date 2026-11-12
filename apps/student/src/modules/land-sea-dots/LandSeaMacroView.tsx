import type { LandSeaDotsSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { GLOBE, globeLandPath, projectGlobe, triangle } from './geo';
import { GLOBE_FILL, GLOBE_TEXT, ROUND_TEXT, dotsNote, dotsOf, seaOf, shownCount, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 232;
export const OCEAN = '#60a5fa';
export const LAND = '#65a30d';
/** 점 표시: 바다는 흰 원, 육지는 노란 세모(모양으로도 구분) */
export const SEA_DOT = { fill: '#ffffff', stroke: '#111827' };
export const LAND_DOT = { fill: '#fde047', stroke: '#111827' };

export function LandSeaMacroView({ trial, snapshot, values }: ViewProps<LandSeaDotsSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const points = dotsOf(values);
  const shown = shownCount(ran, snapshot, points.length);
  const sea = seaOf(points, shown);
  // 실행하기 전에는 점을 하나도 찍지 않는다(지도와 지구본만 있다).
  const note = ran ? dotsNote(shown, sea) : '실험하면 점이 하나씩 찍혀요.';
  const visible = points.slice(0, shown).map((q) => ({ q, g: projectGlobe(q.lat, q.lon) })).filter((d) => d.g.visible && d.g.facing > 0.08);

  return (
    <figure className="view land-sea-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`지구본을 한 반구 보여 줘요. 점 ${p.dots}개, ${ROUND_TEXT[p.round]} 차례, 지구본 받침 색은 ${GLOBE_TEXT[p.globeColor]}. ${note}`}>
        <text x="12" y="18" fontSize="14" fontWeight="700" fill="currentColor" data-testid="dots-label">점 {p.dots}개 · {ROUND_TEXT[p.round]} 차례</text>
        <g data-testid="globe-art" data-dots={p.dots} data-round={p.round} data-shown={shown}>
          <clipPath id="globe-clip"><circle cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.r} /></clipPath>
          {/* 받침 */}
          <rect x={GLOBE.cx - 8} y={GLOBE.cy + GLOBE.r - 2} width="16" height="12" fill={GLOBE_FILL[p.globeColor]} />
          <polygon data-testid="globe-stand" data-fill={GLOBE_FILL[p.globeColor]} points={`${GLOBE.cx - 38},${GLOBE.cy + GLOBE.r + 22} ${GLOBE.cx + 38},${GLOBE.cy + GLOBE.r + 22} ${GLOBE.cx + 26},${GLOBE.cy + GLOBE.r + 10} ${GLOBE.cx - 26},${GLOBE.cy + GLOBE.r + 10}`} fill={GLOBE_FILL[p.globeColor]} stroke="currentColor" strokeWidth="1.5" />
          {/* 지구본: 바다 바탕에 육지 칸 */}
          <circle cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.r} fill={OCEAN} />
          <path data-testid="globe-land" d={globeLandPath()} fill={LAND} clipPath="url(#globe-clip)" />
          <circle cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.r} fill="none" stroke="currentColor" strokeWidth="2" />
          <g data-testid="globe-dots" clipPath="url(#globe-clip)">
            {visible.map(({ q, g }, k) =>
              q.sea ? (
                <circle key={k} data-testid="globe-dot" data-kind="sea" cx={g.x} cy={g.y} r="3.4" fill={SEA_DOT.fill} stroke={SEA_DOT.stroke} strokeWidth="1.2" />
              ) : (
                <polygon key={k} data-testid="globe-dot" data-kind="land" points={triangle(g.x, g.y, 4.2)} fill={LAND_DOT.fill} stroke={LAND_DOT.stroke} strokeWidth="1.2" />
              ),
            )}
          </g>
        </g>
        <text x="12" y="224" fontSize="14" fill="currentColor" data-testid="stand-label">지구본 받침 색: {GLOBE_TEXT[p.globeColor]}</text>
      </svg>
      <p className="view-note" data-testid="land-sea-note">{note}</p>
    </figure>
  );
}
