import { simulateStringSound, type Strength, type StringColor, type StringSoundParams, type StringSoundResult, type StringSoundSample } from '@sci/engine-physics';
import type { Values } from '@sci/gateway';
import type { VariableExperiment } from '@sci/schema';

/** 매니페스트 params에서 모델 옵션을 읽는다. */
export const soundOptions = (exp?: VariableExperiment) => ({
  windowMs: typeof exp?.params?.windowMs === 'number' ? exp.params.windowMs : undefined,
});

export const toParams = (values: Values): StringSoundParams => ({
  strength: values.strength === 'strong' ? 'strong' : 'weak',
  lengthCm: Number(values.lengthCm),
  color: values.color === 'yellow' ? 'yellow' : 'red',
});

/** 고른 조건 그대로 계산한 샘플과 결과 */
export const soundOutput = (values: Values, exp?: VariableExperiment) => simulateStringSound(toParams(values), soundOptions(exp));

/** 실험 전(스냅샷이 없을 때) 화면이 쓰는 t = 0 의 샘플 */
export const startSample = (values: Values, exp?: VariableExperiment): StringSoundSample => soundOutput(values, exp).samples[0]!;

export const STRENGTH_TEXT: Record<Strength, string> = { weak: '약하게', strong: '세게' };
export const COLOR_TEXT: Record<StringColor, string> = { red: '빨간색', yellow: '노란색' };

export const levelText = (level: number) => level.toFixed(1);
export const freqText = (r: Pick<StringSoundResult, 'freq'>) => String(r.freq);

/** 눈으로 보기 아래 문구 */
export const soundNote = (s: Pick<StringSoundSample, 'freq' | 'level'>) => `1초 동안 ${s.freq}번 떨려요 · 소리의 크기 ${levelText(s.level)}`;
