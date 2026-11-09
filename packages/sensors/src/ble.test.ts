import { describe, expect, it } from 'vitest';
import {
  BleError,
  BleHeartRateDriver,
  BleTemperatureDriver,
  HEART_RATE_MEASUREMENT,
  HEART_RATE_SERVICE,
  heartRateProfile,
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

describe('Heart Rate 프로필(0x180D / 0x2A37)', () => {
  const bytes = (...b: number[]) => new DataView(new Uint8Array(b).buffer);

  it('UUID와 기기 선택 조건', () => {
    expect(HEART_RATE_SERVICE).toBe('0000180d-0000-1000-8000-00805f9b34fb');
    expect(HEART_RATE_MEASUREMENT).toBe('00002a37-0000-1000-8000-00805f9b34fb');
    expect(heartRateProfile.service).toBe(HEART_RATE_SERVICE);
    expect(heartRateProfile.characteristic).toBe(HEART_RATE_MEASUREMENT);
    expect(heartRateProfile.filters).toEqual({ services: [HEART_RATE_SERVICE] });
  });

  it('flags bit0 = 0이면 uint8', () => {
    expect(heartRateProfile.parse(bytes(0x00, 72))).toBe(72);
    expect(heartRateProfile.parse(bytes(0x00, 255))).toBe(255);
    // 다른 flags 비트(센서 접촉 등)가 켜져 있어도 bit0만 본다
    expect(heartRateProfile.parse(bytes(0x16, 90, 0x10, 0x03))).toBe(90);
  });

  it('flags bit0 = 1이면 uint16 little-endian', () => {
    expect(heartRateProfile.parse(bytes(0x01, 0x2c, 0x01))).toBe(300); // 0x012C
    expect(heartRateProfile.parse(bytes(0x01, 0x48, 0x00))).toBe(72);
    expect(heartRateProfile.parse(bytes(0x17, 0x00, 0x01))).toBe(256);
  });

  it('짧은 데이터와 0회/분은 null', () => {
    expect(heartRateProfile.parse(bytes())).toBeNull();
    expect(heartRateProfile.parse(bytes(0x00))).toBeNull();
    expect(heartRateProfile.parse(bytes(0x01, 0x48))).toBeNull();
    expect(heartRateProfile.parse(bytes(0x00, 0))).toBeNull();
    expect(heartRateProfile.parse(bytes(0x01, 0, 0))).toBeNull();
  });

  it('BleHeartRateDriver: 연결 순서, 정수 회/분, kind pulse', async () => {
    const t = new FakeTransport();
    const d = new BleHeartRateDriver(t);
    expect([d.kind, d.unit]).toEqual(['pulse', '회/분']);
    await d.connect();
    expect(t.calls).toEqual(['request', 'connect', 'notify']);
    expect(t.filters).toEqual(heartRateProfile.filters);
    const seen: number[] = [];
    d.subscribe((r) => seen.push(r.value));
    t.push!(bytes(0x00, 80));
    t.push!(bytes(0x01, 0x6e, 0x00));
    t.push!(bytes(0x00, 0)); // 접촉 없음은 무시한다
    expect(seen).toEqual([80, 110]);
    expect(d.read()).toMatchObject({ value: 110, unit: '회/분' });
  });
});
