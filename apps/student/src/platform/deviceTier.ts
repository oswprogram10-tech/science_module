import { Capacitor } from '@capacitor/core';

export type DeviceTier = 'A' | 'B' | 'C';
export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceSignals {
  memoryGb?: number;
  cores?: number;
  webgpu: boolean;
  platform: DevicePlatform;
  reducedMotion: boolean;
}

export interface DeviceClass {
  tier: DeviceTier;
  reasons: string[];
}

/** 미시 화면 알갱이 수 상한에 곱하는 배율(docs/DEVICES.md). */
export const TIER_PARTICLE_SCALE: Record<DeviceTier, number> = { A: 1, B: 0.7, C: 0.4 };

/** 상한(cap)에 등급 배율을 곱한다. 0이 되면 그림이 비므로 1개는 남긴다. */
export function scaleCount(cap: number, scale: number): number {
  return Math.max(1, Math.round(cap * scale));
}

/**
 * 기기 신호로 등급을 정한다(초안 규칙).
 * 메모리 4 GB 이하 또는 코어 4개 이하면 C, 메모리 8 GB 이상이면서 코어 8개 이상이면 A, 그 밖은 B.
 * 신호가 없으면(예: iOS 웹뷰는 deviceMemory가 없다) 있는 신호만 본다. reducedMotion은 등급을 바꾸지 않고 이유에만 남긴다.
 */
export function classifyDevice(s: DeviceSignals): DeviceClass {
  const reasons: string[] = [];
  const { memoryGb, cores } = s;
  if (memoryGb === undefined) reasons.push('메모리 신호 없음');
  else reasons.push(`메모리 ${memoryGb} GB`);
  if (cores === undefined) reasons.push('코어 신호 없음');
  else reasons.push(`코어 ${cores}개`);
  if (s.reducedMotion) reasons.push('움직임 줄이기 켜짐');

  let tier: DeviceTier = 'B';
  if ((memoryGb !== undefined && memoryGb <= 4) || (cores !== undefined && cores <= 4)) tier = 'C';
  else if (memoryGb !== undefined && cores !== undefined && memoryGb >= 8 && cores >= 8) tier = 'A';
  return { tier, reasons };
}

/** 브라우저와 Capacitor에서 기기 신호를 읽는다. */
export function readDeviceSignals(): DeviceSignals {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as Navigator & { deviceMemory?: number };
  let platform: DevicePlatform = 'web';
  try {
    const p = Capacitor.getPlatform();
    if (p === 'ios' || p === 'android') platform = p;
  } catch {
    /* 웹으로 본다 */
  }
  return {
    ...(typeof nav.deviceMemory === 'number' ? { memoryGb: nav.deviceMemory } : {}),
    ...(typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? { cores: nav.hardwareConcurrency } : {}),
    webgpu: 'gpu' in nav,
    platform,
    reducedMotion: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  };
}

/** 주소의 `?tier=A|B|C`(테스트·시연용). 없거나 잘못되면 null. */
export function tierFromUrl(search: string): DeviceTier | null {
  const t = new URLSearchParams(search).get('tier');
  return t === 'A' || t === 'B' || t === 'C' ? t : null;
}
