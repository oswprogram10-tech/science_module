import { useEffect, useRef, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** 움직임 줄이기(prefers-reduced-motion) 설정을 따른다. */
export function usePrefersReducedMotion(): boolean {
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : false);
  const [reduced, setReduced] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * 0 이상 1 미만으로 되풀이되는 위상. speed(초당 바퀴 수)가 0이거나 running이 false면 움직이지 않는다(위상 0).
 * 화면이 사라지거나 멈추면 requestAnimationFrame을 바로 취소한다.
 */
export function useLoopPhase(running: boolean, speed: number): number {
  const [phase, setPhase] = useState(0);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      setPhase((p) => (p + speedRef.current * dt) % 1);
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);
  return running ? phase : 0;
}
