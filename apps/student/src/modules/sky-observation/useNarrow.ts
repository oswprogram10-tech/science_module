import { useEffect, useState } from 'react';

const QUERY = '(max-width: 600px)';

const read = (): boolean => {
  try {
    return window.matchMedia(QUERY).matches;
  } catch {
    return false;
  }
};

/** 좁은 화면(폭 600 px 이하)인가. 화면 크기가 바뀌면 따라 바뀐다. */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(QUERY);
    } catch {
      return;
    }
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}
