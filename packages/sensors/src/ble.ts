import type { SensorDriver, SensorKind, SensorReading } from './index';

/** 블루투스 연결 오류. code로 화면이 안내 문구를 고른다. */
export type BleErrorCode = 'unsupported' | 'denied' | 'cancelled' | 'failed';

export class BleError extends Error {
  constructor(
    readonly code: BleErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'BleError';
  }
}

/** 기기 선택 조건. UUID는 128비트 문자열(소문자)로 쓴다. */
export interface BleFilters {
  services?: string[];
  namePrefix?: string;
  /** 웹 블루투스는 쓸 서비스를 미리 밝혀야 한다. */
  optionalServices?: string[];
}

/** 웹 블루투스와 Capacitor 플러그인을 같은 모양으로 감싼다. */
export interface BleTransport {
  /** 사용자가 기기를 고르게 한다(사용자 조작 안에서 불러야 한다). */
  requestDevice(filters: BleFilters): Promise<void>;
  connect(): Promise<void>;
  startNotifications(service: string, characteristic: string, onValue: (v: DataView) => void): Promise<void>;
  disconnect(): Promise<void>;
  /** 연결이 끊기면(기기 쪽 사정이든 disconnect() 호출이든) cb를 부른다. */
  onDisconnect(cb: () => void): void;
}

// ---- 프로필(순수 파서) -------------------------------------------------

export interface BleTemperatureProfile {
  id: 'ess-temperature' | 'microbit-temperature';
  label: string;
  service: string;
  characteristic: string;
  filters: BleFilters;
  /** 알림 값을 °C로. 알 수 없는 값이면 null. */
  parse(v: DataView): number | null;
}

const uuid16 = (n: number) => `0000${n.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;

export const ESS_SERVICE = uuid16(0x181a);
export const ESS_TEMPERATURE = uuid16(0x2a6e);
export const MICROBIT_TEMPERATURE_SERVICE = 'e95d6100-251d-470a-a062-fa1922dfa9a8';
export const MICROBIT_TEMPERATURE = 'e95d9250-251d-470a-a062-fa1922dfa9a8';

/** 표준 Environmental Sensing: sint16 little-endian, 0.01 °C. 0x8000은 "값 없음". */
export const essTemperatureProfile: BleTemperatureProfile = {
  id: 'ess-temperature',
  label: '표준(Environmental Sensing)',
  service: ESS_SERVICE,
  characteristic: ESS_TEMPERATURE,
  filters: { services: [ESS_SERVICE] },
  parse(v) {
    if (v.byteLength < 2) return null;
    const raw = v.getInt16(0, true);
    return raw === -0x8000 ? null : raw / 100;
  },
};

/** micro:bit 온도 서비스: sint8, 1 °C. */
export const microbitTemperatureProfile: BleTemperatureProfile = {
  id: 'microbit-temperature',
  label: 'micro:bit',
  service: MICROBIT_TEMPERATURE_SERVICE,
  characteristic: MICROBIT_TEMPERATURE,
  filters: { namePrefix: 'BBC micro:bit', optionalServices: [MICROBIT_TEMPERATURE_SERVICE] },
  parse(v) {
    return v.byteLength < 1 ? null : v.getInt8(0);
  },
};

export const BLE_TEMPERATURE_PROFILES = [essTemperatureProfile, microbitTemperatureProfile] as const;

export const HEART_RATE_SERVICE = uuid16(0x180d);
export const HEART_RATE_MEASUREMENT = uuid16(0x2a37);

export interface BleHeartRateProfile {
  id: 'heart-rate';
  label: string;
  service: string;
  characteristic: string;
  filters: BleFilters;
  /** 알림 값을 회/분으로. 알 수 없는 값이면 null. */
  parse(v: DataView): number | null;
}

/**
 * 표준 Heart Rate Measurement(0x2A37): 첫 바이트 flags의 bit0이 0이면 심박이 uint8, 1이면 uint16 little-endian이다.
 * 심박은 flags 바로 다음에 온다. 0회/분(접촉 없음)과 짧은 데이터는 null.
 */
export const heartRateProfile: BleHeartRateProfile = {
  id: 'heart-rate',
  label: '표준(Heart Rate)',
  service: HEART_RATE_SERVICE,
  characteristic: HEART_RATE_MEASUREMENT,
  filters: { services: [HEART_RATE_SERVICE] },
  parse(v) {
    if (v.byteLength < 2) return null;
    const wide = (v.getUint8(0) & 0x01) === 1;
    if (wide && v.byteLength < 3) return null;
    const bpm = wide ? v.getUint16(1, true) : v.getUint8(1);
    return bpm > 0 ? bpm : null;
  },
};

// ---- 드라이버 ------------------------------------------------------------

const round1 = (x: number) => Math.round(x * 10) / 10;

/** 알림으로 값을 받는 BLE 프로필이 갖춰야 하는 것 */
export interface BleNotifyProfile {
  id: string;
  service: string;
  characteristic: string;
  filters: BleFilters;
  parse(v: DataView): number | null;
}

/**
 * 알림으로 값을 받는 실물 BLE 센서의 공통 동작.
 * 연결이 끊기면 read()가 마지막 값에 stale: true를 붙이고, connect() 한 번당 자동 재연결은 1회만 시도한다.
 */
export class BleNotifyDriver<K extends SensorKind = SensorKind> implements SensorDriver {
  readonly id: string;
  private last: SensorReading | null = null;
  private stale = true;
  private listeners = new Set<(r: SensorReading) => void>();
  private staleListeners = new Set<(stale: boolean) => void>();
  private reconnectsLeft = 0;
  private closing = false;

  constructor(
    private transport: BleTransport,
    private profile: BleNotifyProfile,
    readonly kind: K,
    readonly unit: string,
    private round: (x: number) => number,
  ) {
    this.id = `ble-${profile.id}`;
    transport.onDisconnect(() => void this.handleDisconnect());
  }

  async connect(): Promise<void> {
    this.closing = false;
    this.reconnectsLeft = 1;
    await this.transport.requestDevice(this.profile.filters);
    await this.open();
  }

  private async open(): Promise<void> {
    await this.transport.connect();
    await this.transport.startNotifications(this.profile.service, this.profile.characteristic, (v) => this.onValue(v));
  }

  private onValue(v: DataView) {
    const c = this.profile.parse(v);
    if (c === null) return;
    this.last = { value: this.round(c), unit: this.unit, ts: Date.now() };
    this.setStale(false);
    this.listeners.forEach((cb) => cb(this.last!));
  }

  private setStale(s: boolean) {
    if (this.stale === s) return;
    this.stale = s;
    this.staleListeners.forEach((cb) => cb(s));
  }

  private async handleDisconnect() {
    this.setStale(true);
    if (this.closing || this.reconnectsLeft <= 0) return;
    this.reconnectsLeft -= 1;
    try {
      await this.open();
    } catch {
      /* 한 번만 시도한다. 실패하면 끊긴 채로 둔다. */
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    this.setStale(true);
    await this.transport.disconnect();
  }

  /** 마지막 값. 아직 받은 값이 없으면 NaN과 stale: true. */
  read(): SensorReading {
    if (!this.last) return { value: Number.NaN, unit: this.unit, ts: Date.now(), stale: true };
    return this.stale ? { ...this.last, stale: true } : { ...this.last };
  }

  subscribe(cb: (r: SensorReading) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** 끊김·다시 연결됨을 알려 받는다. */
  onStaleChange(cb: (stale: boolean) => void): () => void {
    this.staleListeners.add(cb);
    return () => {
      this.staleListeners.delete(cb);
    };
  }
}

/** 실물 BLE 온도 센서(°C, 소수 첫째 자리). */
export class BleTemperatureDriver extends BleNotifyDriver<'temperature'> {
  constructor(transport: BleTransport, profile: BleTemperatureProfile) {
    super(transport, profile, 'temperature', '°C', round1);
  }
}

/** 실물 BLE 심박 센서(회/분, 정수). 값은 구독자에게만 전달하고 이 드라이버 밖에 남기지 않는다. */
export class BleHeartRateDriver extends BleNotifyDriver<'pulse'> {
  constructor(transport: BleTransport, profile: BleHeartRateProfile = heartRateProfile) {
    super(transport, profile, 'pulse', '회/분', Math.round);
  }
}

// ---- 전송 선택 ------------------------------------------------------------

/** 웹 블루투스 API가 있는지만 보는 최소 모양 */
export interface BluetoothLike {
  requestDevice(options: unknown): Promise<unknown>;
}

/**
 * 앱(Capacitor)이면 앱 전용 전송, 아니고 navigator.bluetooth가 있으면 웹 전송, 둘 다 없으면 null.
 * 전송은 팩토리로 받아 쓸 때만 만든다(앱 번들이 웹 전용 코드를, 웹 번들이 플러그인을 끌어오지 않게).
 */
export function pickTransport(env: {
  isNative: boolean;
  bluetooth: BluetoothLike | undefined | null;
  createNative: () => BleTransport;
  createWeb: (bluetooth: BluetoothLike) => BleTransport;
}): BleTransport | null {
  if (env.isNative) return env.createNative();
  if (env.bluetooth) return env.createWeb(env.bluetooth);
  return null;
}

// ---- 웹 블루투스 전송 -----------------------------------------------------

interface WebGattCharacteristic {
  startNotifications(): Promise<unknown>;
  addEventListener(type: 'characteristicvaluechanged', cb: (e: { target: { value?: DataView } }) => void): void;
}
interface WebGattServer {
  connect(): Promise<WebGattServer>;
  disconnect(): void;
  getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<WebGattCharacteristic> }>;
}
interface WebDevice {
  gatt?: WebGattServer;
  addEventListener(type: 'gattserverdisconnected', cb: () => void): void;
}

const toBleError = (e: unknown): BleError => {
  if (e instanceof BleError) return e;
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotFoundError') return new BleError('cancelled');
  if (name === 'NotAllowedError' || name === 'SecurityError') return new BleError('denied');
  if (name === 'NotSupportedError') return new BleError('unsupported');
  return new BleError('failed', (e as Error | null)?.message);
};

/** 크롬북·웨일북·안드로이드 크롬의 `navigator.bluetooth`. */
export class WebBluetoothTransport implements BleTransport {
  private device: WebDevice | null = null;
  private disconnectCb: (() => void) | null = null;

  constructor(private bluetooth: BluetoothLike) {}

  async requestDevice(filters: BleFilters): Promise<void> {
    const filter: Record<string, unknown> = {};
    if (filters.services) filter.services = filters.services;
    if (filters.namePrefix) filter.namePrefix = filters.namePrefix;
    try {
      const device = (await this.bluetooth.requestDevice({
        filters: [filter],
        ...(filters.optionalServices ? { optionalServices: filters.optionalServices } : {}),
      })) as WebDevice;
      this.device = device;
      device.addEventListener('gattserverdisconnected', () => this.disconnectCb?.());
    } catch (e) {
      throw toBleError(e);
    }
  }

  async connect(): Promise<void> {
    if (!this.device?.gatt) throw new BleError('failed', '기기가 선택되지 않았어요');
    try {
      await this.device.gatt.connect();
    } catch (e) {
      throw toBleError(e);
    }
  }

  async startNotifications(service: string, characteristic: string, onValue: (v: DataView) => void): Promise<void> {
    if (!this.device?.gatt) throw new BleError('failed', '연결되지 않았어요');
    try {
      const ch = await (await this.device.gatt.getPrimaryService(service)).getCharacteristic(characteristic);
      ch.addEventListener('characteristicvaluechanged', (e) => {
        if (e.target.value) onValue(e.target.value);
      });
      await ch.startNotifications();
    } catch (e) {
      throw toBleError(e);
    }
  }

  async disconnect(): Promise<void> {
    this.device?.gatt?.disconnect();
  }

  onDisconnect(cb: () => void): void {
    this.disconnectCb = cb;
  }
}
