import { SAND_G, SALT_G, FILTER_START_MIN, HEAT_START_MIN, PASS_RATIO, POURED_SAND_G, type SeparationSample, type SeparationStage } from '@sci/engine-matter';
import type { ViewProps } from '../types';
import { STIRRER_TEXT, FILTER_TEXT, clamp01, separationNote, startSample, toParams } from './initial';

// viewBox 폭 240은 1280 px 화면에서 이 칸의 실제 폭(약 230 px)과 거의 같다. 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const PANEL_H = 116;
const GAP = 6;
export const H = PANEL_H * 3 + GAP * 2;
/** 비커 바닥(패널 안 y)과 그 속 물 높이 */
const BK_BOTTOM = 108;
const BK_TOP = 34;
export const waterHeight = (waterMl: number) => 22 + waterMl * 0.75;
/** 접시 물 1 mL당 높이(그림 단위) */
const DISH_PX_PER_ML = 0.4;
/** 받는 비커 물 1 mL당 높이 */
const CATCH_PX_PER_ML = 0.42;

/** 비커 바닥의 자리: 모래 → 녹지 않은 소금 순으로 위로 쌓인다. */
export const sandSlot = (i: number) => ({ x: 28 + (i < 6 ? i * 14 : 7 + (i - 6) * 14), y: i < 6 ? 103 : 95 });
export const saltSlot = (i: number) => ({ x: 28 + (i % 5) * 14, y: 87 - Math.floor(i / 5) * 8 });
/** 녹지 않고 남은 소금 알갱이 수(g 단위 올림, 1 g 이하는 1개) */
export const undissolvedCount = (dissolvedG: number) => Math.min(SALT_G, Math.ceil(SALT_G - dissolvedG - 1e-6));

/** 접시 바닥의 높이(x에서) */
const dishFloorY = (x: number) => 56 + 20 * (1 - ((x - 80) / 40) ** 2);
/** 접시 위 가루 자리: 가운데에서 바깥으로, 아래 줄부터 */
export function dishSlots(n: number): { x: number; y: number }[] {
  const order = [4.5, 5.5, 3.5, 6.5, 2.5, 7.5, 1.5, 8.5, 0.5, 9.5];
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 10);
    const col = order[i % 10]!;
    const x = 80 + (col - 5) * 5 + 2.5;
    return { x, y: dishFloorY(x) - 2.5 - row * 5 };
  });
}

function Panel({ index, stage, active, title, children, labels }: { index: number; stage: SeparationStage; active: boolean; title: string; children: React.ReactNode; labels: React.ReactNode }) {
  const oy = index * (PANEL_H + GAP);
  return (
    <g transform={`translate(0 ${oy})`} data-testid="stage-panel" data-stage={stage} data-active={active ? 'true' : 'false'}>
      <rect x="2" y="2" width={W - 4} height={PANEL_H - 4} rx="8" fill="none" stroke={active ? '#d97706' : 'currentColor'} strokeWidth={active ? 3 : 1.5} strokeOpacity={active ? 1 : 0.3} />
      <text x="12" y="20" fontSize="14" fontWeight={active ? 700 : 400} fill="currentColor">{title}</text>
      {active && <text x={W - 12} y="20" textAnchor="end" fontSize="14" fontWeight="700" fill="currentColor">지금</text>}
      <g opacity={active ? 1 : 0.55} data-testid="stage-art">{children}</g>
      {labels}
    </g>
  );
}

export function SaltSandMacroView({ trial, snapshot, values, experiment }: ViewProps<SeparationSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values, experiment);
  const pour = p.filter === 'pour';
  const note = ran ? separationNote(s, p.filter) : '실험하면 소금과 모래가 녹이기, 거르기, 증발시키기 단계를 지나는 모습을 볼 수 있어요.';
  const wh = waterHeight(p.waterMl);
  const nSalt = undissolvedCount(s.dissolvedG);
  const filtering = s.t >= FILTER_START_MIN;
  const moved = clamp01((s.t - FILTER_START_MIN) / (HEAT_START_MIN - FILTER_START_MIN));
  const sandF = pour ? POURED_SAND_G : 0;
  const sandOnDish = Math.max(0, s.solidG - s.saltOnDishG);
  const heating = s.stage === 'evaporate' && s.dishWaterMl > 1e-9;
  const waterF = PASS_RATIO * p.waterMl;
  const catchH = moved * waterF * CATCH_PX_PER_ML;
  const dishWaterH = s.dishWaterMl * DISH_PX_PER_ML;
  const nDishSalt = Math.ceil(s.saltOnDishG * 2.2 - 1e-9);
  const nDishSand = Math.round(sandOnDish * 2);
  const slots = dishSlots(nDishSand + nDishSalt);
  const rodColor = p.stirrer === 'glass' ? '#60a5fa' : '#92400e';

  return (
    <figure className="view salt-sand-macro" aria-label="눈으로 보기">
      <figcaption>눈으로 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`소금과 모래 혼합물 분리: 물 ${p.waterMl} mL에 녹이고, ${FILTER_TEXT[p.filter]}, 증발 접시에서 가열해요. ${note}`}
      >
        <defs>
          <clipPath id="ss-dish-clip">
            <path d="M40 56 Q80 96 120 56 Z" />
          </clipPath>
        </defs>

        {/* 1. 녹이기: 비커, 물, 바닥의 모래와 녹지 않은 소금 */}
        <Panel index={0} stage="dissolve" active={s.stage === 'dissolve'} title="1 녹이기 (0~3분)" labels={
          <>
            <text x="118" y="56" fontSize="14" fill="currentColor" data-testid="water-label">물 {p.waterMl} mL</text>
            <text x="118" y="78" fontSize="14" fill="currentColor">{STIRRER_TEXT[p.stirrer]}</text>
          </>
        }>
          <g data-testid="beaker-1" data-water={p.waterMl} data-undissolved={nSalt}>
            <rect x="18" y={BK_BOTTOM - wh} width="90" height={wh} fill="#bfe0f5" fillOpacity="0.85" data-testid="beaker-water" />
            <path d={`M18 ${BK_TOP} V${BK_BOTTOM} H108 V${BK_TOP}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            {Array.from({ length: SAND_G }, (_, i) => {
              const { x, y } = sandSlot(i);
              return <circle key={`sa${i}`} data-testid="sand-1" cx={x} cy={y} r="4" fill="#a16207" stroke="#713f12" strokeWidth="1.2" />;
            })}
            {Array.from({ length: nSalt }, (_, i) => {
              const { x, y } = saltSlot(i);
              return <rect key={`sl${i}`} data-testid="salt-undissolved-1" x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#ffffff" stroke="#374151" strokeWidth="1.2" />;
            })}
            <line x1="92" y1="26" x2="66" y2="100" stroke={rodColor} strokeWidth={p.stirrer === 'glass' ? 3 : 4} strokeLinecap="round" data-testid="stirrer" data-kind={p.stirrer} />
          </g>
        </Panel>

        {/* 2. 거르기(거름종이 깔때기) 또는 따르기 */}
        <Panel index={1} stage="filter" active={s.stage === 'filter'} title={pour ? '2 따르기 (3~8분)' : '2 거르기 (3~8분)'} labels={
          <>
            <text x="118" y="56" fontSize="14" fill="currentColor">{pour ? '윗물만 따르기' : '깔때기·거름종이'}</text>
            <text x="118" y="104" fontSize="14" fill="currentColor">받는 비커</text>
          </>
        }>
          <g data-testid="filter-art" data-filter={p.filter} data-moved={moved.toFixed(2)}>
            {!pour && (
              <g data-testid="funnel">
                <polygon points="28,36 112,36 74,76" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                <line x1="74" y1="76" x2="74" y2="86" stroke="currentColor" strokeWidth="2.5" />
                <polygon points="35,40 105,40 74,72" fill="#fffbeb" stroke="#a16207" strokeWidth="1.5" strokeDasharray="4 3" />
                {filtering && (
                  <g data-testid="funnel-content">
                    {Array.from({ length: SAND_G }, (_, i) => (
                      <circle key={`fs${i}`} data-testid="sand-2" cx={56 + (i % 5) * 7} cy={66 - Math.floor(i / 5) * 6} r="3" fill="#a16207" stroke="#713f12" strokeWidth="1" />
                    ))}
                    {Array.from({ length: nSalt }, (_, i) => (
                      <rect key={`fl${i}`} data-testid="salt-undissolved-2" x={53 + (i % 5) * 7} y={54 - Math.floor(i / 5) * 6} width="5" height="5" fill="#ffffff" stroke="#374151" strokeWidth="1" />
                    ))}
                  </g>
                )}
              </g>
            )}
            {pour && (
              <g data-testid="pour-beaker" transform="translate(60 50) rotate(-30)">
                <path d="M0 0 V36 H36 V0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                {filtering && (
                  <g>
                    <rect x="1" y="10" width="34" height="26" fill="#bfe0f5" fillOpacity="0.85" />
                    {Array.from({ length: SAND_G }, (_, i) => (
                      <circle key={`ps${i}`} data-testid="sand-2" cx={6 + (i % 5) * 6} cy={32 - Math.floor(i / 5) * 5} r="2.5" fill="#a16207" stroke="#713f12" strokeWidth="1" />
                    ))}
                    {Array.from({ length: nSalt }, (_, i) => (
                      <rect key={`pl${i}`} data-testid="salt-undissolved-2" x={4 + (i % 5) * 6} y={22 - Math.floor(i / 5) * 5} width="4.5" height="4.5" fill="#ffffff" stroke="#374151" strokeWidth="1" />
                    ))}
                  </g>
                )}
              </g>
            )}
            {pour && moved > 0 && moved < 1 && <line x1="58" y1="54" x2="54" y2="90" stroke="#4aa8e0" strokeWidth="2.5" strokeDasharray="3 3" data-testid="stream" />}
            {/* 받는 비커: 걸러진 물이 모인다. 따를 때는 모래가 조금 함께 넘어온다 */}
            <path d="M40 86 V112 H100 V86" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            {catchH > 0.05 && <rect x="41.5" y={111 - catchH} width="57" height={catchH} fill="#bfe0f5" fillOpacity="0.9" data-testid="catch-water" />}
            {Array.from({ length: Math.ceil(sandF * moved - 1e-9) }, (_, i) => (
              <circle key={`cs${i}`} data-testid="sand-crossed" cx={62 + i * 12} cy="108" r="3" fill="#a16207" stroke="#713f12" strokeWidth="1" />
            ))}
          </g>
        </Panel>

        {/* 3. 증발: 알코올램프 위 증발 접시 */}
        <Panel index={2} stage="evaporate" active={s.stage === 'evaporate'} title="3 증발시키기 (8~20분)" labels={
          <>
            <text x="126" y="58" fontSize="14" fill="currentColor">증발 접시</text>
            <text x="108" y="108" fontSize="14" fill="currentColor">알코올램프</text>
          </>
        }>
          <g data-testid="dish-art" data-heating={heating ? 'true' : 'false'} data-dish-water={s.dishWaterMl.toFixed(2)}>
            <g clipPath="url(#ss-dish-clip)">
              {dishWaterH > 0.05 && <rect x="40" y={76 - dishWaterH} width="80" height={dishWaterH + 2} fill="#8ec9ee" fillOpacity="0.9" data-testid="dish-water" />}
            </g>
            {slots.map((q, i) => {
              const isSand = i < nDishSand;
              return isSand ? (
                <circle key={i} data-testid="dish-sand" cx={q.x} cy={q.y} r="2.6" fill="#a16207" stroke="#713f12" strokeWidth="1" />
              ) : (
                <circle key={i} data-testid="dish-salt" cx={q.x} cy={q.y} r="2.4" fill="#ffffff" stroke="#374151" strokeWidth="0.9" />
              );
            })}
            <path d="M40 56 Q80 96 120 56 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            {heating && <ellipse cx="80" cy="85" rx="5" ry="9" fill="#f97316" stroke="#c2410c" strokeWidth="1.2" data-testid="flame" />}
            <rect x="76" y="94" width="8" height="6" fill="#6b7280" />
            <rect x="60" y="100" width="40" height="12" rx="4" fill="#cbd5e1" stroke="currentColor" strokeWidth="2" />
          </g>
        </Panel>
      </svg>
      <p className="view-note" data-testid="salt-sand-note">{note}</p>
    </figure>
  );
}
