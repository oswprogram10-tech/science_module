import { describe, expect, it } from 'vitest';
import type { BusEvent, SafetyKind } from './bus';
import { MAX_QUEUE, clampText, compactQueue } from './queue';

const st = (trials: number): BusEvent => ({ k: 'status', status: { phase: 'idle', trials, safetyLocked: false } });
const sf = (type: SafetyKind, at: number): BusEvent => ({ k: 'safety', type, at });
const cl = (type: SafetyKind): BusEvent => ({ k: 'clear', type });

describe('compactQueue', () => {
  it('status는 마지막 하나만 남긴다', () => {
    expect(compactQueue([st(1), sf('SPILL', 1), st(2), st(3)])).toEqual([sf('SPILL', 1), st(3)]);
  });
  it('safety와 safetyClear는 종류마다 마지막 하나만 남기고 순서를 지킨다', () => {
    const q = [sf('SPILL', 1), sf('FOOD', 2), sf('SPILL', 3), cl('SPILL'), cl('SPILL'), sf('FOOD', 4)];
    expect(compactQueue(q)).toEqual([sf('SPILL', 3), cl('SPILL'), sf('FOOD', 4)]);
  });
  it('8개를 넘으면 오래된 것부터 버린다', () => {
    const all: BusEvent[] = [st(1), sf('NO_GOGGLES', 1), sf('NO_GLOVES', 2), sf('SPILL', 3), sf('FOOD', 4), cl('NO_GOGGLES'), cl('NO_GLOVES'), cl('SPILL'), cl('FOOD')];
    const out = compactQueue(all);
    expect(out).toHaveLength(MAX_QUEUE);
    expect(out[0]).toEqual(sf('NO_GOGGLES', 1)); // 가장 오래된 status가 빠졌다
    expect(compactQueue(all, 3)).toEqual(all.slice(-3));
  });
});

describe('clampText', () => {
  it('상한 이하는 그대로, 넘으면 자른다', () => {
    expect(clampText('abc', 64)).toBe('abc');
    expect(clampText('x'.repeat(100), 64)).toHaveLength(64);
  });
  it('이모지가 반으로 갈라지지 않는다', () => {
    const s = 'a'.repeat(63) + '😀';
    expect(clampText(s, 64)).toBe('a'.repeat(63));
  });
});
