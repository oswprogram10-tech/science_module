import { describe, expect, it } from 'vitest';
import {
  BleError,
  BleTemperatureDriver,
  ESS_SERVICE,
  ESS_TEMPERATURE,
  MICROBIT_TEMPERATURE,
  MICROBIT_TEMPERATURE_SERVICE,
  essTemperatureProfile,
  microbitTemperatureProfile,
  pickTransport,
  type BleFilters,
  type BleTransport,
} from './index';

const i16 = (n: number) => {
  const v = new DataView(new ArrayBuffer(2));
  v.setInt16(0, n, true);
  return v;
};
const i8 = (n: number) => {
  const v = new DataView(new ArrayBuffer(1));
  v.setInt8(0, n);
  return v;
};

describe('프로필 파서', () => {
  it('ESS: sint16 little-endian, 0.01 °C', () => {
    expect(essTemperatureProfile.parse(i16(2350))).toBe(23.5);
    expect(essTemperatureProfile.parse(i16(-1250))).toBe(-12.5);
    expect(essTemperatureProfile.parse(i16(5))).toBe(0.05);
    // 바이트 순서: 0x0A 0x09 = 0x090A = 2314
    expect(essTemperatureProfile.parse(new DataView(new Uint8Array([0x0a, 0x09]).buffer))).toBe(23.14);
  });
  it('ESS: 값 없음(0x8000)과 짧은 데이터는 null', () => {
    expect(essTemperatureProfile.parse(i16(-32768))).toBeNull();
    expect(essTemperatureProfile.parse(i8(1))).toBeNull();
  });
  it('micro:bit: sint8 °C(음수 포함)', () => {
    expect(microbitTemperatureProfile.parse(i8(25))).toBe(25);
    expect(microbitTemperatureProfile.parse(i8(-5))).toBe(-5);
    expect(microbitTemperatureProfile.parse(new DataView(new ArrayBuffer(0)))).toBeNull();
  });
  it('UUID', () => {
    expect(ESS_SERVICE).toBe('0000181a-0000-1000-8000-00805f9b34fb');
    expect(ESS_TEMPERATURE).toBe('00002a6e-0000-1000-8000-00805f9b34fb');
    expect(microbitTemperatureProfile.service).toBe(MICROBIT_TEMPERATURE_SERVICE);
    expect(microbitTemperatureProfile.characteristic).toBe(MICROBIT_TEMPERATURE);
  });
});

class FakeTransport implements BleTransport {
  calls: string[] = [];
  filters: BleFilters | null = null;
  push: ((v: DataView) => void) | null = null;
  private dc: (() => void) | null = null;
  failConnectFrom = Infinity;
  connects = 0;
  async requestDevice(f: BleFilters) {
    this.calls.push('request');
    this.filters = f;
  }
  async connect() {
    this.connects += 1;
    this.calls.push('connect');
    if (this.connects >= this.failConnectFrom) throw new BleError('failed');
  }
  async startNotifications(_s: string, _c: string, cb: (v: DataView) => void) {
    this.calls.push('notify');
    this.push = cb;
  }
  async disconnect() {
    this.calls.push('disconnect');
    this.dc?.();
  }
  onDisconnect(cb: () => void) {
    this.dc = cb;
  }
  drop() {
    this.dc?.();
  }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('BleTemperatureDriver', () => {
  it('연결 순서와 값 수신(소수 첫째 자리, °C)', async () => {
    const t = new FakeTransport();
    const d = new BleTemperatureDriver(t, essTemperatureProfile);
    expect(d.kind).toBe('temperature');
    expect(d.unit).toBe('°C');
    expect(d.read().stale).toBe(true);
    expect(Number.isNaN(d.read().value)).toBe(true);
    await d.connect();
    expect(t.calls).toEqual(['request', 'connect', 'notify']);
    expect(t.filters).toEqual(essTemperatureProfile.filters);
    const seen: number[] = [];
    d.subscribe((r) => seen.push(r.value));
    t.push!(i16(2349));
    t.push!(i16(-1250));
    expect(seen).toEqual([23.5, -12.5]);
    const r = d.read();
    expect(r).toMatchObject({ value: -12.5, unit: '°C' });
    expect(r.stale).toBeUndefined();
  });

  it('끊기면 마지막 값과 stale: true, 자동 재연결은 1회만', async () => {
    const t = new FakeTransport();
    const d = new BleTemperatureDriver(t, microbitTemperatureProfile);
    await d.connect();
    t.push!(i8(30));
    t.drop();
    expect(d.read()).toMatchObject({ value: 30, stale: true });
    await tick();
    expect(t.calls).toEqual(['request', 'connect', 'notify', 'connect', 'notify']); // 재연결 1회
    t.push!(i8(31)); // 다시 값이 오면 stale 해제
    expect(d.read().stale).toBeUndefined();
    t.drop(); // 두 번째 끊김은 다시 연결하지 않는다
    await tick();
    expect(t.connects).toBe(2);
    expect(d.read()).toMatchObject({ value: 31, stale: true });
  });

  it('재연결이 실패해도 더 시도하지 않고 stale로 남는다', async () => {
    const t = new FakeTransport();
    t.failConnectFrom = 2;
    const d = new BleTemperatureDriver(t, essTemperatureProfile);
    await d.connect();
    t.push!(i16(2000));
    t.drop();
    await tick();
    expect(t.connects).toBe(2);
    expect(d.read()).toMatchObject({ value: 20, stale: true });
  });

  it('사용자가 disconnect()하면 재연결하지 않는다', async () => {
    const t = new FakeTransport();
    const d = new BleTemperatureDriver(t, essTemperatureProfile);
    await d.connect();
    await d.disconnect();
    await tick();
    expect(t.connects).toBe(1);
    expect(d.read().stale).toBe(true);
  });

  it('기기 선택 실패는 그대로 던진다', async () => {
    const t = new FakeTransport();
    t.requestDevice = async () => {
      throw new BleError('cancelled');
    };
    const d = new BleTemperatureDriver(t, essTemperatureProfile);
    await expect(d.connect()).rejects.toMatchObject({ code: 'cancelled' });
  });
});

describe('pickTransport', () => {
  const native = {} as BleTransport;
  const web = {} as BleTransport;
  const bt = { requestDevice: async () => ({}) };
  const make = (isNative: boolean, bluetooth: typeof bt | undefined) =>
    pickTransport({ isNative, bluetooth, createNative: () => native, createWeb: () => web });
  it('앱이면 Capacitor 전송', () => {
    expect(make(true, undefined)).toBe(native);
    expect(make(true, bt)).toBe(native);
  });
  it('앱이 아니고 navigator.bluetooth가 있으면 웹 전송', () => {
    expect(make(false, bt)).toBe(web);
  });
  it('둘 다 없으면 null', () => {
    expect(make(false, undefined)).toBeNull();
  });
});
