import type { LightKind } from '@sci/engine-life';
import type { GerminationSample } from '@sci/engine-life';
import type { ViewProps } from '../types';
import { LEAF_COLOR_TEXT, LEAF_FILL, STAGE_NAMES, seedStage, shownLeafColor, startSample, type SeedStage } from './initial';

const W = 240;
const H = 300;
const CELL_W = 112;
const CELL_H = 108;
const X0 = 8;
const Y0 = 30;
const STAGES: SeedStage[] = [0, 1, 2, 3];
const STAGE_NO = ['①', '②', '③', '④'] as const;

/** 단계 하나의 그림. (cx, ground)는 솜 표면의 가운데이다. */
function StageDrawing({ stage, cx, ground, leaf, dark }: { stage: SeedStage; cx: number; ground: number; leaf: string; dark: boolean }) {
  const stemColor = dark ? '#e7d98a' : '#65a30d';
  const stemTop = stage === 2 ? ground - 26 : ground - 40;
  return (
    <g>
      <rect x={cx - 40} y={ground} width="80" height="10" rx="4" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1" />
      {stage >= 1 && <path d={`M${cx} ${ground + 3} q-6 6 -2 12 M${cx} ${ground + 3} q6 5 3 12`} stroke="#a16207" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {stage >= 2 && <line x1={cx} y1={ground} x2={cx} y2={stemTop} stroke={stemColor} strokeWidth="3" strokeLinecap="round" />}
      {stage >= 2 && (
        <>
          <ellipse cx={cx - 8} cy={stemTop + 2} rx="8" ry="4.5" fill={leaf} stroke="#00000033" transform={`rotate(-20 ${cx - 8} ${stemTop + 2})`} />
          <ellipse cx={cx + 8} cy={stemTop + 2} rx="8" ry="4.5" fill={leaf} stroke="#00000033" transform={`rotate(20 ${cx + 8} ${stemTop + 2})`} />
        </>
      )}
      {/* 빛이 없으면 본잎도 노랗게 자란다. */}
      {stage === 3 && (
        <>
          <path d={`M${cx} ${stemTop} q-14 -4 -16 -16 q12 0 16 16z`} fill={dark ? '#d9c34a' : '#15803d'} stroke={dark ? '#8a7a1e' : '#14532d'} strokeWidth="1" />
          <path d={`M${cx} ${stemTop} q14 -4 16 -16 q-12 0 -16 16z`} fill={dark ? '#d9c34a' : '#15803d'} stroke={dark ? '#8a7a1e' : '#14532d'} strokeWidth="1" />
        </>
      )}
      {stage < 2 && <ellipse cx={cx} cy={ground - 5} rx="10" ry="7" fill="#b45309" stroke="#78350f" strokeWidth="1.5" />}
    </g>
  );
}

export function SeedMicroView({ experiment, snapshot, values }: ViewProps<GerminationSample>) {
  const s = snapshot ?? startSample(values, experiment);
  const light: LightKind = values.light === 'dark' ? 'dark' : 'bright';
  const stage = seedStage(s, light);
  const color = shownLeafColor(s, light);
  const leaf = LEAF_FILL[color ?? (light === 'bright' ? 'green' : 'yellow')];
  const halo = { stroke: 'var(--card)', strokeWidth: 3, paintOrder: 'stroke' } as const;

  return (
    <figure className="view seed-micro" aria-label="씨 하나 확대해 보기">
      <figcaption>씨 하나 확대해 보기</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`씨 하나의 단계: ${STAGE_NAMES[stage]}${color ? `, 떡잎 ${LEAF_COLOR_TEXT[color]}` : ''}`}
      >
        <text x={W / 2} y="18" textAnchor="middle" fontSize="14" fill="currentColor">가장 빨리 싹 튼 씨앗의 모습</text>
        {STAGES.map((k) => {
          const col = k % 2;
          const row = Math.floor(k / 2);
          const x = X0 + col * (CELL_W + 4);
          const y = Y0 + row * (CELL_H + 4);
          const on = k === stage;
          return (
            <g key={k} data-testid="seed-stage-cell" data-stage={k} data-current={on ? 'true' : 'false'}>
              <rect x={x} y={y} width={CELL_W} height={CELL_H} rx="8" fill="none" stroke={on ? '#d97706' : 'currentColor'} strokeOpacity={on ? 1 : 0.3} strokeWidth={on ? 4 : 1} />
              <StageDrawing stage={k} cx={x + CELL_W / 2} ground={y + 70} leaf={leaf} dark={light === 'dark'} />
              <text x={x + CELL_W / 2} y={y + CELL_H - 8} textAnchor="middle" fontSize="14" fontWeight={on ? 700 : 400} fill="currentColor" {...halo}>
                {STAGE_NO[k]} {STAGE_NAMES[k]}
              </text>
            </g>
          );
        })}
        <text data-testid="seed-stage" data-stage={stage} x={W / 2} y="268" textAnchor="middle" fontSize="14" fill="currentColor">지금 단계: {STAGE_NAMES[stage]}</text>
        <text x={W / 2} y="288" textAnchor="middle" fontSize="14" fill="currentColor">떡잎 색: {color ? LEAF_COLOR_TEXT[color] : '아직 없어요'}</text>
      </svg>
    </figure>
  );
}
