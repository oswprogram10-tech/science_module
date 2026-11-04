import { describe, expect, it } from 'vitest';
import {
  analyzeTrial,
  canRun,
  josa,
  observedOutcome,
  structuralFeedback,
  type Values,
} from './index';

const v = (o: Partial<Values> = {}): Values => ({
  solute: 'salt',
  waterMl: 50,
  waterTempC: 20,
  stir: 1,
  ...o,
});
const labels = {
  solute: '용질의 종류',
  waterMl: '물의 양',
  waterTempC: '물의 온도',
  stir: '젓기',
};

describe('analyzeTrial', () => {
  it('first-trial', () => {
    expect(analyzeTrial(undefined, { values: v(), ivKey: 'waterTempC' }, labels)).toEqual({
      kind: 'first-trial',
      changed: [],
    });
  });
  it('repeat', () => {
    const prev = { values: v(), ivKey: 'waterTempC' };
    expect(analyzeTrial(prev, { values: v(), ivKey: 'waterTempC' }, labels)).toEqual({
      kind: 'repeat',
      changed: [],
    });
  });
  it('fair-test', () => {
    const prev = { values: v(), ivKey: 'waterTempC' };
    expect(analyzeTrial(prev, { values: v({ waterTempC: 40 }), ivKey: 'waterTempC' }, labels)).toEqual({
      kind: 'fair-test',
      changed: ['waterTempC'],
    });
  });
  it('confounded: IV 말고 다른 변인도 바뀜', () => {
    const prev = { values: v(), ivKey: 'waterTempC' };
    const a = analyzeTrial(prev, { values: v({ waterTempC: 40, waterMl: 100 }), ivKey: 'waterTempC' }, labels);
    expect(a.kind).toBe('confounded');
    expect(a.changed.sort()).toEqual(['waterMl', 'waterTempC']);
  });
  it('iv-unchanged: IV가 아닌 변인 하나만 바뀜', () => {
    const prev = { values: v(), ivKey: 'waterTempC' };
    expect(analyzeTrial(prev, { values: v({ stir: 2 }), ivKey: 'waterTempC' }, labels)).toEqual({
      kind: 'iv-unchanged',
      changed: ['stir'],
    });
  });
  it('iv-unchanged: IV가 아닌 변인 여러 개', () => {
    const prev = { values: v(), ivKey: 'waterTempC' };
    expect(
      analyzeTrial(prev, { values: v({ stir: 2, waterMl: 100 }), ivKey: 'waterTempC' }, labels).kind,
    ).toBe('iv-unchanged');
  });
  it('confounded: IV가 null이면 변화가 있을 때 confounded', () => {
    const prev = { values: v(), ivKey: null };
    expect(analyzeTrial(prev, { values: v({ stir: 2 }), ivKey: null }, labels).kind).toBe('confounded');
  });
});

describe('canRun', () => {
  const cfg = { requirePrediction: true, requireSingleIV: true };
  it('예측과 조작변인이 있으면 ok', () => {
    expect(canRun({ ivKey: 'stir', prediction: 'same' }, cfg)).toEqual({ ok: true, reasons: [] });
  });
  it('둘 다 없으면 이유 두 개', () => {
    expect(canRun({ ivKey: null, prediction: null }, cfg)).toEqual({
      ok: false,
      reasons: ['예측을 먼저 골라 주세요.', '바꿀 조건(조작변인)을 하나 골라 주세요.'],
    });
  });
  it('설정이 꺼져 있으면 요구하지 않는다', () => {
    expect(canRun({ ivKey: null, prediction: null }, { requirePrediction: false, requireSingleIV: false }).ok).toBe(true);
  });
});

describe('josa', () => {
  it('받침 유무', () => {
    expect(josa('물의 양', '이/가')).toBe('이');
    expect(josa('물의 온도', '이/가')).toBe('가');
    expect(josa('물의 양', '을/를')).toBe('을');
    expect(josa('젓기', '을/를')).toBe('를');
    expect(josa('물의 온도', '와/과')).toBe('와');
    expect(josa('물의 양', '와/과')).toBe('과');
    expect(josa('용질', '은/는')).toBe('은');
    expect(josa('온도', '은/는')).toBe('는');
  });
  it('한글이 아니면 괄호형', () => {
    expect(josa('pH', '을/를')).toBe('을(를)');
    expect(josa('10 °C', '이/가')).toBe('이(가)');
    expect(josa('', '와/과')).toBe('와(과)');
  });
});

describe('structuralFeedback', () => {
  it('confounded 문장', () => {
    expect(
      structuralFeedback({ kind: 'confounded', changed: ['waterTempC', 'waterMl'] }, labels, null, '녹은 양'),
    ).toBe('물의 온도와 물의 양이 함께 바뀌어서, 녹은 양이 무엇 때문에 달라졌는지 알 수 없어요.');
  });
  it('세 개: 조사를 맞춰 잇는다', () => {
    expect(
      structuralFeedback({ kind: 'confounded', changed: ['waterMl', 'stir', 'waterTempC'] }, labels, null, '녹은 양'),
    ).toBe('물의 양과 젓기와 물의 온도가 함께 바뀌어서, 녹은 양이 무엇 때문에 달라졌는지 알 수 없어요.');
  });
  it('iv-unchanged 문장', () => {
    expect(structuralFeedback({ kind: 'iv-unchanged', changed: ['stir'] }, labels, 'waterTempC', '녹은 양')).toBe(
      '바꿀 조건으로 고른 물의 온도는 그대로이고, 젓기가 바뀌었어요.',
    );
    expect(
      structuralFeedback({ kind: 'iv-unchanged', changed: ['waterMl', 'stir'] }, labels, 'waterTempC', '녹은 양'),
    ).toBe('바꿀 조건으로 고른 물의 온도는 그대로이고, 물의 양과 젓기가 바뀌었어요.');
    expect(structuralFeedback({ kind: 'iv-unchanged', changed: ['stir'] }, labels, 'waterMl', '녹은 양')).toBe(
      '바꿀 조건으로 고른 물의 양은 그대로이고, 젓기가 바뀌었어요.',
    );
  });
  it('종속변인 이름과 조사를 바꿔 끼운다', () => {
    expect(
      structuralFeedback({ kind: 'confounded', changed: ['waterMl', 'stir'] }, labels, null, '기체의 부피'),
    ).toBe('물의 양과 젓기가 함께 바뀌어서, 기체의 부피가 무엇 때문에 달라졌는지 알 수 없어요.');
    expect(
      structuralFeedback({ kind: 'confounded', changed: ['waterMl', 'stir'] }, labels, null, '부피 변화'),
    ).toBe('물의 양과 젓기가 함께 바뀌어서, 부피 변화가 무엇 때문에 달라졌는지 알 수 없어요.');
  });
  it('confounded가 아니면 null', () => {
    for (const kind of ['first-trial', 'repeat', 'fair-test'] as const) {
      expect(structuralFeedback({ kind, changed: [] }, labels, null, '녹은 양')).toBeNull();
    }
  });
});

describe('observedOutcome', () => {
  it('숟가락 1개 이하면 same', () => {
    expect(observedOutcome(10, 12, 2)).toBe('same');
    expect(observedOutcome(10, 8, 2)).toBe('same');
    expect(observedOutcome(10, 12.1, 2)).toBe('increase');
    expect(observedOutcome(10, 7.9, 2)).toBe('decrease');
  });
});

describe('josa: 끝이 괄호 설명인 낱말', () => {
  it('괄호 앞 낱말의 받침으로 조사를 고른다', () => {
    expect(josa('계절(공전 위치)', '을/를')).toBe('을');
    expect(josa('자전축 기울기(만약에)', '이/가')).toBe('가');
    expect(josa('물의 양', '을/를')).toBe('을');
    expect(josa('ABC', '을/를')).toBe('을(를)');
  });
});
