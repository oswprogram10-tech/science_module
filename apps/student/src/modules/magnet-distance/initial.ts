import { START_HEIGHT_CM, simulateMagnet, type BetweenKind, type MagnetCount, type MagnetParams, type MagnetResult, type MagnetSample } from '@sci/engine-physics';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const magnetOptions = (exp?: VariableExperiment) => ({
  totalS: typeof exp?.params?.totalS === 'number' ? exp.params.totalS : undefined,
});

export const toParams = (values: Values): MagnetParams => ({
  gapCm: Number(values.gapCm),
  magnets: values.magnets === 2 ? 2 : 1,
  between: values.between === 'paper' || values.between === 'plastic' || values.between === 'iron' ? values.between : 'none',
});

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플: 자석은 5 cm 높이, 붙은 클립은 0개 */
export const startSample = (values: Values, exp?: VariableExperiment): MagnetSample => simulateMagnet(toParams(values), magnetOptions(exp)).samples[0]!;

export const magnetResult = (values: Values, exp?: VariableExperiment): MagnetResult => simulateMagnet(toParams(values), magnetOptions(exp)).result;

export const BETWEEN_TEXT: Record<BetweenKind, string> = { none: '없음', paper: '종이', plastic: '플라스틱 판', iron: '얇은 철판' };
export const MAGNET_TEXT: Record<MagnetCount, string> = { 1: '자석 1개', 2: '자석 2개를 겹침' };

/** 자석의 힘이 미치는 정도 reach에 비례하는 그림 속 길이(cm). 1개(reach 1)일 때 1.9 cm */
export const REACH_CM = 1.9;

export const cmText = (x: number) => x.toFixed(1);

/** 눈으로 보기 아래 문구 */
export const magnetNote = (s: Pick<MagnetSample, 't' | 'heightCm' | 'clipsHeld'>) => `${s.t.toFixed(1)}초 · 자석 높이 ${cmText(s.heightCm)} cm · 붙은 클립 ${Math.round(s.clipsHeld)}개`;

export { START_HEIGHT_CM };
