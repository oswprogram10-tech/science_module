let ctx: AudioContext | null = null;

/** 첫 클릭(사용자 조작) 안에서 불러야 한다. 소리를 켤 수 없으면 false. */
export function enableSound(): boolean {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = ctx ?? new AC();
    void ctx.resume();
    beep();
    return true;
  } catch {
    return false;
  }
}

/** 경고음 한 번. 소리를 켜지 않았으면 아무것도 하지 않는다. */
export function beep(): void {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* 소리는 보조 수단이다. */
  }
}
