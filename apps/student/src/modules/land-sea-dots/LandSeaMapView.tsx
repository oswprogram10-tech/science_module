import type { LandSeaDotsSample } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { MAP, mapLandPath, mapX, mapY, triangle } from './geo';
import { dotsNote, dotsOf, seaOf, shownCount } from './initial';
import { LAND, LAND_DOT, OCEAN, SEA_DOT } from './LandSeaMacroView';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 160;

/** 평면 지도: 지구본에서 가려진 쪽까지 찍은 점을 모두 보여 준다. */
export function LandSeaMapView({ trial, snapshot, values }: ViewProps<LandSeaDotsSample>) {
  const ran = trial !== undefined;
  const points = dotsOf(values);
  const shown = shownCount(ran, snapshot, points.length);
  const sea = seaOf(points, shown);
  const note = ran ? dotsNote(shown, sea) : '실험하면 점이 하나씩 찍혀요.';

  return (
    <figure className="view land-sea-map" aria-label="평면 지도">
      <figcaption>평면 지도</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`지구 전체를 펼친 평면 지도. 육지는 초록색, 바다는 파란색이에요. ${note}`}>
        <g data-testid="map-art" data-shown={shown}>
          <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} fill={OCEAN} stroke="currentColor" strokeWidth="1.5" />
          <path data-testid="map-land" d={mapLandPath()} fill={LAND} />
          <g data-testid="map-dots">
            {points.slice(0, shown).map((q, k) =>
              q.sea ? (
                <circle key={k} data-testid="map-dot" data-kind="sea" cx={mapX(q.lon)} cy={mapY(q.lat)} r="2.6" fill={SEA_DOT.fill} stroke={SEA_DOT.stroke} strokeWidth="1" />
              ) : (
                <polygon key={k} data-testid="map-dot" data-kind="land" points={triangle(mapX(q.lon), mapY(q.lat), 3.4)} fill={LAND_DOT.fill} stroke={LAND_DOT.stroke} strokeWidth="1" />
              ),
            )}
          </g>
        </g>
        <g data-testid="map-legend">
          <circle cx="20" cy="143" r="4" fill={SEA_DOT.fill} stroke="currentColor" strokeWidth="1.2" />
          <text x="30" y="148" fontSize="14" fill="currentColor">바다</text>
          <polygon points={triangle(80, 143, 5)} fill={LAND_DOT.fill} stroke="currentColor" strokeWidth="1.2" />
          <text x="90" y="148" fontSize="14" fill="currentColor">육지</text>
        </g>
      </svg>
      <p className="view-note" data-testid="land-sea-map-note">{note}</p>
    </figure>
  );
}
