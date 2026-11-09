import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { TIER_PARTICLE_SCALE, classifyDevice, readDeviceSignals, tierFromUrl, type DeviceClass, type DeviceSignals } from './deviceTier';

export interface DeviceInfo extends DeviceClass {
  signals: DeviceSignals | null;
  forced: boolean;
}

/** Provider가 없으면(단위 테스트 등) 등급 A, 배율 1이다. */
const DEFAULT: DeviceInfo = { tier: 'A', reasons: [], signals: null, forced: false };
const Ctx = createContext<DeviceInfo>(DEFAULT);

export function detectDevice(): DeviceInfo {
  const signals = readDeviceSignals();
  const base = classifyDevice(signals);
  let forced: ReturnType<typeof tierFromUrl> = null;
  try {
    forced = tierFromUrl(window.location.search);
  } catch {
    /* 주소를 못 읽으면 판정값을 쓴다 */
  }
  return forced ? { ...base, tier: forced, signals, forced: true } : { ...base, signals, forced: false };
}

export function DeviceTierProvider({ children }: { children: ReactNode }) {
  const info = useMemo(detectDevice, []);
  return <Ctx.Provider value={info}>{children}</Ctx.Provider>;
}

export const useDeviceInfo = (): DeviceInfo => useContext(Ctx);

/** 미시 화면 알갱이 수 상한에 곱하는 배율. 돋보기 모자이크처럼 실제 크기를 뜻하는 그림에는 쓰지 않는다. */
export const useParticleScale = (): number => TIER_PARTICLE_SCALE[useContext(Ctx).tier];
