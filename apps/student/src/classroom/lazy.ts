import { lazy } from 'react';

/** 수업 화면 코드는 서버 주소가 있을 때만 내려받는다(R6). */
export const LazyHost = lazy(() => import('./ui').then((m) => ({ default: m.ClassroomHost })));
export const LazyControl = lazy(() => import('./ui').then((m) => ({ default: m.ClassroomControl })));
