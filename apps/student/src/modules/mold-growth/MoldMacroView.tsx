import { useMemo } from 'react';
import type { MoldSample } from '@sci/engine-life';
import { TEMP_PLACE_TEXT, tempPlace } from '../germination/initial';
import type { ViewProps } from '../types';
import { LIGHT_TEXT, MOISTURE_TEXT, dayText, lightOf, moistureOf, moldColor, seeded, startSample } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 262;
/** 빵 위에 찍을 수 있는 얼룩 수(덮은 넓이 100 %) */
export const SPOT_COUNT = 120;

/** 아래 문구 */
export function moldNote(s: MoldSample): string {
  return `${dayText(s.t)}일째 · 곰팡이가 덮은 넓이 ${Math.round(s.coverPct)}%`;
}

/** 덮은 넓이에 맞게 그릴 얼룩 수. 곰팡이가 조금이라도 있으면 하나는 보인다. */
export const spotCount = (coverPct: number) => (coverPct <= 0 ? 0 : Math.min(SPOT_COUNT, Math.max(1, Math.round((coverPct / 100) * SPOT_COUNT))));

/** 시드 고정 얼룩 자리: 빵 몸통 안(x 62~178, y 96~172)에 흩어 둔다. 앞에서부터 쓰므로 퍼지는 모습이 된다. */
function makeSpots() {
  const rnd = seeded(20260);
  return Array.from({ length: SPOT_COUNT }, () => ({
    x: 64 + rnd() * 112,
    y: 98 + rnd() * 74,
    r: 5 + rnd() * 4,
  }));
}

const DROPS = [
  [78, 120],
  [112, 104],
  [150, 126],
  [96, 158],
  [160, 160],
] as const;

export function MoldMacroView({ experiment, snapshot, values }: ViewProps<MoldSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const wet = moistureOf(values) === 'wet';
  const light = lightOf(values);
  const tempC = Number(values.tempC);
  const place = tempPlace(tempC);
  const frame = place === 'cold' ? '#2563eb' : place === 'warm' ? '#ea580c' : '#9ca3af';
  const envText = `${TEMP_PLACE_TEXT[place]} ${tempC} °C`;
  const note = moldNote(s);
  const spots = useMemo(makeSpots, []);
  const n = spotCount(s.coverPct);
  const color = moldColor(s.spores);

  return (
    <figure className="view mold-bag" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`지퍼 봉지 속 ${MOISTURE_TEXT[wet ? 'wet' : 'dry']}: ${envText}, ${LIGHT_TEXT[light]}, ${note}`}
      >
        {/* 온도 표시: 냉장고는 파란 테두리, 따뜻한 곳은 주황 테두리 */}
        <rect data-testid="env-frame" data-place={place} x="4" y="26" width="232" height="190" rx="10" fill="none" stroke={frame} strokeWidth={place === 'room' ? 1.5 : 4} strokeDasharray={place === 'room' ? '4 4' : undefined} />
        <text data-testid="env-label" x={W / 2} y="18" textAnchor="middle" fontSize="14" fill="currentColor">{envText}</text>

        {/* 지퍼 봉지 */}
        <rect data-testid="bag" x="18" y="40" width="204" height="166" rx="10" fill="#f1f5f9" fillOpacity="0.7" stroke="#64748b" strokeWidth="2" />
        <line x1="26" y1="52" x2="214" y2="52" stroke="#64748b" strokeWidth="3" strokeDasharray="6 3" />

        {/* 빵 조각 */}
        <path data-testid="bread" data-wet={wet ? 'true' : 'false'} d="M58 180 L58 112 Q38 110 42 90 Q48 70 80 76 Q120 62 160 76 Q194 72 198 94 Q200 112 182 112 L182 180 Z" fill={wet ? '#d9b36a' : '#ecc885'} stroke="#a16207" strokeWidth="2.5" />

        {/* 물을 뿌린 빵: 물방울 */}
        {wet &&
          DROPS.map(([x, y]) => (
            <path key={`${x}-${y}`} data-testid="drop" d={`M${x} ${y - 7} q-6 8 0 12 q6 -4 0 -12z`} fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
          ))}

        {/* 곰팡이 얼룩: 시드 고정 점 무리. 앞에서부터 n개 */}
        {spots.slice(0, n).map((p, i) => (
          <circle key={i} data-testid="mold-spot" cx={p.x} cy={p.y} r={p.r} fill={color} fillOpacity="0.85" />
        ))}

        {/* 빛 표시: 밝은 곳은 해, 어두운 곳은 봉지를 어둡게 덮고 달 */}
        {light === 'bright' ? (
          <g data-testid="light-icon" data-light="bright">
            <circle cx="200" cy="72" r="8" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <line key={a} x1={200 + 11 * Math.cos((a * Math.PI) / 180)} y1={72 + 11 * Math.sin((a * Math.PI) / 180)} x2={200 + 15 * Math.cos((a * Math.PI) / 180)} y2={72 + 15 * Math.sin((a * Math.PI) / 180)} stroke="#a16207" strokeWidth="1.5" strokeLinecap="round" />
            ))}
          </g>
        ) : (
          <g data-testid="dark-overlay" data-light="dark">
            <rect x="18" y="40" width="204" height="166" rx="10" fill="#1f2937" fillOpacity="0.4" />
            <path d="M204 62 a10 10 0 1 0 6 18 a8 8 0 0 1 -6 -18z" fill="#e5e7eb" stroke="#4b5563" strokeWidth="1.2" />
          </g>
        )}

        <text x={W / 2} y="232" textAnchor="middle" fontSize="14" fill="currentColor">
          {MOISTURE_TEXT[wet ? 'wet' : 'dry']}
          {wet ? ' · 물방울' : ''}
        </text>
        <text x={W / 2} y="250" textAnchor="middle" fontSize="14" fill="currentColor">지퍼 봉지 · {LIGHT_TEXT[light]}</text>
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
