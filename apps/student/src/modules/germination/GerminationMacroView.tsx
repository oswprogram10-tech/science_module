import type { GerminationSample, LightKind } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { LEAF_FILL, TEMP_PLACE_TEXT, dayText, shownLeafColor, startSample, tempPlace } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
const W = 240;
const H = 250;
const PER_ROW = 5;
const COL_X0 = 40;
const COL_DX = 40;
/** 앞줄과 뒷줄 씨앗의 높이(그릇 솜 위) */
const ROW_Y = [176, 142] as const;
/** 줄기 길이의 그림 배율(px/mm). 60 mm가 60 px. */
const STEM_PX_PER_MM = 1;
const STEM_MIN_PX = 5;

/** 아래 문구 */
export function germinationNote(s: GerminationSample): string {
  return `${dayText(s.t)}일째 · 싹 튼 씨앗 ${Math.round(s.sprouted)}개`;
}

export function GerminationMacroView({ experiment, snapshot, values }: ViewProps<GerminationSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const seeds = typeof experiment.params?.seeds === 'number' ? experiment.params.seeds : 10;
  const light: LightKind = values.light === 'dark' ? 'dark' : 'bright';
  const wet = values.water === 'water';
  const tempC = Number(values.tempC);
  const place = tempPlace(tempC);
  const sproutedCount = Math.min(seeds, Math.round(s.sprouted));
  const color = shownLeafColor(s, light) ?? (light === 'bright' ? 'green' : 'yellow');
  const leaf = LEAF_FILL[color];
  const stemPx = Math.max(STEM_MIN_PX, s.stemMm * STEM_PX_PER_MM);
  const note = germinationNote(s);
  const frame = place === 'cold' ? '#2563eb' : place === 'warm' ? '#ea580c' : '#9ca3af';
  const envText = `${TEMP_PLACE_TEXT[place]} ${tempC} °C`;
  const leafWord = shownLeafColor(s, light);

  const seedList = Array.from({ length: seeds }, (_, i) => {
    const row = Math.floor(i / PER_ROW) % ROW_Y.length;
    const col = i % PER_ROW;
    return { i, x: COL_X0 + col * COL_DX, y: ROW_Y[row]!, sprouted: i < sproutedCount };
  });

  return (
    <figure className="view seed-bowl" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`강낭콩 ${seeds}개를 담은 그릇: ${wet ? '젖은 솜' : '마른 솜'}, ${envText}, ${light === 'dark' ? '상자를 덮음' : '밝은 곳'}, ${note}`}
      >
        {/* 온도 표시: 냉장고는 파란 테두리, 따뜻한 곳은 주황 테두리 */}
        <rect data-testid="env-frame" data-place={place} x="4" y="26" width="232" height="190" rx="10" fill="none" stroke={frame} strokeWidth={place === 'room' ? 1.5 : 4} strokeDasharray={place === 'room' ? '4 4' : undefined} />
        <text data-testid="env-label" x={W / 2} y="18" textAnchor="middle" fontSize="14" fill="currentColor">{envText}</text>

        {/* 그릇과 솜 */}
        <path data-testid="bowl" d="M18 150 Q18 206 120 206 Q222 206 222 150 Z" fill="#e5e7eb" stroke="#6b7280" strokeWidth="2" />
        <path data-testid="cotton" data-wet={wet ? 'true' : 'false'} d="M24 150 Q24 164 36 160 Q48 150 62 160 Q78 150 92 160 Q106 150 120 160 Q134 150 148 160 Q162 150 176 160 Q190 150 204 160 Q216 164 216 150 Q216 200 120 200 Q24 200 24 150 Z" fill={wet ? '#bfdbfe' : '#fafaf9'} stroke={wet ? '#3b82f6' : '#a8a29e'} strokeWidth="1.5" />
        {wet && [58, 108, 160, 196].map((x, k) => <path key={x} d={`M${x} ${178 + (k % 2) * 6} q-3 5 0 8 q3 -3 0 -8z`} fill="#3b82f6" />)}

        {/* 씨앗: 뒷줄부터 그리고, 싹 튼 씨앗은 앞에서부터 센다 */}
        {[...seedList].reverse().map(({ i, x, y, sprouted }) => (
          <g key={i} data-testid={sprouted ? 'sprout' : 'seed'}>
            {sprouted && (
              <>
                <path d={`M${x} ${y + 4} q-5 8 -2 14 M${x} ${y + 4} q5 8 3 14`} stroke="#a16207" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <line data-testid="stem" x1={x} y1={y} x2={x} y2={y - stemPx} stroke={light === 'dark' ? '#e7d98a' : '#65a30d'} strokeWidth={light === 'dark' ? 2 : 3} strokeLinecap="round" />
                <ellipse cx={x - 6} cy={y - stemPx} rx="6" ry="3.5" fill={leaf} stroke="#00000033" transform={`rotate(-20 ${x - 6} ${y - stemPx})`} />
                <ellipse cx={x + 6} cy={y - stemPx} rx="6" ry="3.5" fill={leaf} stroke="#00000033" transform={`rotate(20 ${x + 6} ${y - stemPx})`} />
              </>
            )}
            <ellipse cx={x} cy={y + 2} rx="8" ry="5.5" fill="#b45309" stroke="#78350f" strokeWidth="1.5" />
          </g>
        ))}

        {/* 어두운 곳: 상자를 덮는다 */}
        {light === 'dark' && (
          <g data-testid="dark-box">
            <rect x="8" y="30" width="224" height="182" rx="8" fill="#1f2937" fillOpacity="0.55" stroke="#1f2937" strokeWidth="2" />
            <rect x="60" y="34" width="120" height="24" rx="6" fill="#1f2937" />
            <text x={W / 2} y="51" textAnchor="middle" fontSize="14" fill="#ffffff">상자를 덮음</text>
          </g>
        )}

        <text x={W / 2} y="232" textAnchor="middle" fontSize="14" fill="currentColor">
          {wet ? '젖은 솜' : '마른 솜'}
          {leafWord ? ` · 떡잎 ${leafWord === 'green' ? '초록색' : '노란색'}` : ''}
        </text>
      </svg>
      <p className="view-note">{note}</p>
    </figure>
  );
}
