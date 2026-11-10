import type { SeaWaterSample, WaterKind } from '@sci/engine-earth';
import type { ViewProps } from '../types';
import { startSample, toParams } from './initial';

// 글자 14는 화면에서도 약 13 px 이상이다.
export const W = 240;
export const H = 212;
/** 확대 그림 상자 */
const BOX = { x: 8, y: 58, w: 224, h: 100 };
export const WATER_DOTS = 30;
/** 접시 속 소금 알갱이 수: 바닷물은 많고 강물은 아주 적다(실행한 뒤에만 그린다). */
export const SALT_DOTS: Record<WaterKind, number> = { sea: 12, river: 1 };
/** 날아가는 물 알갱이(상자 위) */
export const FLYING_DOTS = 4;

/** 남은 물이 줄면 물 알갱이도 줄어든다(아래쪽부터 남는다). */
export const waterDotCount = (dishWaterMl: number, volumeMl: number) => Math.min(WATER_DOTS, Math.ceil((WATER_DOTS * Math.max(0, dishWaterMl)) / volumeMl - 1e-9)) || 0;
/** 물 알갱이 자리: 아래 줄부터 채운다. */
export const waterSlot = (i: number) => ({ x: 22 + (i % 10) * 20.5, y: BOX.y + BOX.h - 18 - Math.floor(i / 10) * 24 });
/** 물에 섞여 퍼져 있는 소금 알갱이 자리 */
export const spreadSlot = (i: number) => ({ x: 30 + ((i * 53) % 100) * 1.64, y: BOX.y + 16 + ((i * 37) % 100) * 0.5 });
/** 물이 다 마른 뒤 바닥에 남은 소금 알갱이 자리 */
export const settleSlot = (i: number) => ({ x: 30 + i * 16, y: BOX.y + BOX.h - 10 });

export function SeaWaterParticleView({ trial, snapshot, values, experiment }: ViewProps<SeaWaterSample>) {
  const p = toParams(values);
  const ran = trial !== undefined;
  const s = snapshot ?? startSample(values, experiment);
  const nWater = waterDotCount(s.dishWaterMl, p.volumeMl);
  // 실행하기 전에는 소금 알갱이를 그리지 않는다.
  const nSalt = ran ? SALT_DOTS[p.water] : 0;
  const settle = ran ? 1 - Math.min(1, Math.max(0, s.dishWaterMl / p.volumeMl)) : 0;
  const flying = ran && s.heating && s.t > 0;
  const note = !ran
    ? '실험하면 접시 속 알갱이가 어떻게 달라지는지 볼 수 있어요.'
    : p.water === 'sea'
      ? '물이 증발하면 물 알갱이는 날아가고, 소금 알갱이는 접시에 남아요.'
      : '물이 증발하면 물 알갱이는 날아가요. 소금 알갱이는 아주 적게만 보여요.';

  return (
    <figure className="view sea-water-particles" aria-label="알갱이 보기">
      <figcaption>알갱이 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`접시 속을 크게 그린 그림: 물 알갱이 ${nWater}개, 소금 알갱이 ${nSalt}개. 물이 증발하면 물 알갱이는 위로 날아가요.`}
      >
        <text x={BOX.x} y="20" fontSize="14" fontWeight="700" fill="currentColor">접시 속 확대</text>
        <g data-testid="flying-water" data-count={flying ? FLYING_DOTS : 0}>
          {flying &&
            Array.from({ length: FLYING_DOTS }, (_, i) => {
              const x = 40 + i * 52;
              return (
                <g key={i} data-testid="flying-dot">
                  <circle cx={x} cy="34" r="3.5" fill="none" stroke="#2b7aa8" strokeWidth="1.5" />
                  <path d={`M${x} 52 V42 M${x - 4} 46 L${x} 41 L${x + 4} 46`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}
        </g>
        <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx="6" fill="#bfe0f5" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.5" />
        <g data-testid="water-dots" data-count={nWater}>
          {Array.from({ length: nWater }, (_, i) => {
            const q = waterSlot(i);
            return <circle key={i} data-testid="water-dot" cx={q.x} cy={q.y} r="3.5" fill="none" stroke="#2b7aa8" strokeWidth="1.5" />;
          })}
        </g>
        <g data-testid="salt-dots" data-count={nSalt}>
          {Array.from({ length: nSalt }, (_, i) => {
            const a = spreadSlot(i);
            const b = settleSlot(i);
            const x = a.x + (b.x - a.x) * settle;
            const y = a.y + (b.y - a.y) * settle;
            return <rect key={i} data-testid="salt-dot" x={(x - 4.5).toFixed(1)} y={(y - 4.5).toFixed(1)} width="9" height="9" fill="#ffffff" stroke="#374151" strokeWidth="1.5" />;
          })}
        </g>

        {/* 범례: 두 알갱이를 한 번씩만 쓴다 */}
        <circle cx="16" cy="182" r="5" fill="none" stroke="#2b7aa8" strokeWidth="1.5" />
        <text x="28" y="187" fontSize="14" fill="currentColor">물 알갱이</text>
        <rect x="116" y="176" width="11" height="11" fill="#ffffff" stroke="#374151" strokeWidth="1.5" />
        <text x="134" y="187" fontSize="14" fill="currentColor">소금 알갱이</text>
      </svg>
      <p className="view-note" data-testid="sea-water-particle-note">{note}</p>
    </figure>
  );
}
