import {
  HT_COLORS,
  HT_MATERIALS,
  HT_PATH_LABEL,
  HT_SPOTS,
  simulateHeatTransfer,
  type HeatTransferParams,
  type HeatTransferResult,
  type HeatTransferSample,
  type HtColor,
  type HtMaterial,
  type HtSpot,
} from '@sci/engine-physics';
import type { Values } from '@sci/gateway';

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export const toParams = (values: Values): HeatTransferParams => ({
  material: pick(HT_MATERIALS, values.material, 'copper'),
  heatAt: pick(HT_SPOTS, values.heatAt, 'edge'),
  stickerColor: pick(HT_COLORS, values.stickerColor, 'pink'),
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const transferOutput = (values: Values) => simulateHeatTransfer(toParams(values));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 색이 바뀐 것이 없다. */
export const startSample = (values: Values): HeatTransferSample => transferOutput(values).samples[0]!;

export const transferResult = (values: Values): HeatTransferResult => transferOutput(values).result;

export const MATERIAL_TEXT: Record<HtMaterial, string> = { copper: '구리판', iron: '철판', water: '비커 속 물' };
export const SPOT_TEXT: Record<'plate' | 'water', Record<HtSpot, string>> = {
  plate: { edge: '가장자리', center: '가운데' },
  water: { edge: '비커 바닥 가장자리', center: '비커 바닥 가운데' },
};
export const COLOR_TEXT: Record<HtColor, string> = { pink: '분홍색', blue: '파란색' };

/** 결과표의 "열이 퍼진 모습" 글자 */
export const pathText = (r: Pick<HeatTransferResult, 'path'>): string => HT_PATH_LABEL[r.path];

/** 눈으로 보기 아래 문구 */
export const transferNote = (s: Pick<HeatTransferSample, 't' | 'pct'>, r: HeatTransferResult, water: boolean) =>
  `${s.t.toFixed(0)}초 · ${water ? '색소가 퍼진' : '색이 바뀐 붙임딱지'} ${s.pct.toFixed(0)} % · 열이 퍼진 모습: ${pathText(r)}`;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
