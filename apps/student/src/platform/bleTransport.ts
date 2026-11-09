import { Capacitor } from '@capacitor/core';
import { WebBluetoothTransport, pickTransport, type BleTransport } from '@sci/sensors';
import { CapacitorBleTransport } from './CapacitorBleTransport';

/** 이 기기에서 쓸 수 있는 블루투스 전송. 없으면 null. */
export function pickBleTransport(): BleTransport | null {
  let isNative = false;
  try {
    isNative = Capacitor.isNativePlatform();
  } catch {
    /* 웹으로 본다 */
  }
  return pickTransport({
    isNative,
    bluetooth: typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { bluetooth?: { requestDevice(o: unknown): Promise<unknown> } }).bluetooth,
    createNative: () => new CapacitorBleTransport(),
    createWeb: (bt) => new WebBluetoothTransport(bt),
  });
}
