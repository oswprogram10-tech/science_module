import { useSyncExternalStore } from 'react';
import { createLogbook } from './logbook';

export * from './logbook';

/** 앱 전체가 쓰는 기록장(브라우저 localStorage). 꺼져 있으면 아무것도 쓰지 않는다. */
export const logbook = createLogbook();

/** 기록장이 바뀔 때 다시 그리게 한다. */
export function useLogbookVersion(): number {
  return useSyncExternalStore(logbook.subscribe, logbook.getVersion, logbook.getVersion);
}
