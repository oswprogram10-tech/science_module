import { simulatePhase, type PhaseParams, type PhaseProcess, type PhaseResult, type PhaseSample, type PhaseTube } from '@sci/engine-matter';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const phaseOptions = (exp?: VariableExperiment) => ({
  totalMin: typeof exp?.params?.totalMin === 'number' ? exp.params.totalMin : undefined,
});

export const toParams = (values: Values): PhaseParams => ({
  process: values.process === 'melt' ? 'melt' : 'freeze',
  startMl: Number(values.startMl),
  tube: values.tube === 'plastic' ? 'plastic' : 'glass',
});

export const phaseOutput = (values: Values, exp?: VariableExperiment) => simulatePhase(toParams(values), phaseOptions(exp));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): PhaseSample => phaseOutput(values, exp).samples[0]!;

export const phaseResult = (values: Values, exp?: VariableExperiment): PhaseResult => phaseOutput(values, exp).result;

export const PROCESS_TEXT: Record<PhaseProcess, string> = { freeze: '물 얼리기', melt: '얼음 녹이기' };
export const TUBE_TEXT: Record<PhaseTube, string> = { glass: '유리 시험관', plastic: '플라스틱 시험관' };

/** 음수는 유니코드 빼기 기호(−)로 쓴다. */
const minus = (s: string) => s.replace('-', '−');

/** 부호 있는 부피 변화: +0.9, 0.0, −0.9 */
export const signedMl = (x: number) => (x > 0 ? `+${x.toFixed(1)}` : minus(x.toFixed(1)));

/** 온도 글자(음수는 −) */
export const tempText = (c: number) => minus((Math.abs(c) < 0.05 ? 0 : c).toFixed(1));

/** 눈으로 보기 아래 문구 */
export const phaseNote = (s: Pick<PhaseSample, 't' | 'volume' | 'massG' | 'tempC'>) => `${s.t.toFixed(1)}분 · 부피 ${s.volume.toFixed(1)} mL · 무게 ${s.massG.toFixed(1)} g · ${tempText(s.tempC)} °C`;

/** 알갱이 그림의 알갱이 수: 처음 물의 양에 따라 18개(10 mL) 또는 24개(20 mL). 한 시행 안에서는 언제나 같다. */
export const ROW_SIZE = 6;
export const particleCount = (startMl: number) => ROW_SIZE * Math.min(4, Math.max(3, Math.round(2 + startMl / 10)));
