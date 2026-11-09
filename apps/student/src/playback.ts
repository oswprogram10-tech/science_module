/** `?playback=초` (0.2~8, 기본 8): 재생 시간을 줄여 자동 테스트를 빠르게 한다. 읽을 수 없으면 undefined(기본값). */
export function readPlaybackSeconds(): number | undefined {
  try {
    const raw = new URLSearchParams(window.location.search).get('playback');
    if (raw === null || raw.trim() === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(8, Math.max(0.2, n));
  } catch {
    return undefined;
  }
}
