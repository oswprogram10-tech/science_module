import type { BusEvent } from './bus';

/** 끊긴 동안 쌓아 둘 수 있는 메시지 수 상한. */
export const MAX_QUEUE = 8;
/** 다시 연결된 뒤 쌓인 메시지를 보낼 때 메시지 사이의 최소 간격(ms). 서버의 초당 10개 제한보다 훨씬 느리다. */
export const FLUSH_GAP_MS = 150;

const keyOf = (e: BusEvent): string => (e.k === 'status' ? 'status' : `${e.k}:${e.type}`);

/**
 * 끊긴 동안 쌓인 이벤트를 줄인다: status는 마지막 하나만, safety/safetyClear는 종류(type)마다 마지막 하나만 남긴다.
 * 순서는 유지하고, 그래도 max를 넘으면 오래된 것부터 버린다.
 */
export function compactQueue(events: readonly BusEvent[], max: number = MAX_QUEUE): BusEvent[] {
  const lastIndex = new Map<string, number>();
  events.forEach((e, i) => lastIndex.set(keyOf(e), i));
  const kept = events.filter((e, i) => lastIndex.get(keyOf(e)) === i);
  return kept.length > max ? kept.slice(kept.length - max) : kept;
}

/** 서버 규격의 글자 수 상한에 맞게 자른다(글자가 반으로 갈라지지 않게 한다). */
export function clampText(s: string, max: number): string {
  if (s.length <= max) return s;
  let end = max;
  const last = s.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end--; // 짝 잃은 high surrogate
  return s.slice(0, end);
}

/** 서버 규격(`@sci/classroom`)의 글자 수 상한. */
export const LIMITS = { shortText: 64, appVersion: 32 } as const;
