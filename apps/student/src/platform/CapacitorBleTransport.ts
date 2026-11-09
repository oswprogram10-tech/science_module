import { BleError, type BleFilters, type BleTransport } from '@sci/sensors';

type BleClientType = (typeof import('@capacitor-community/bluetooth-le'))['BleClient'];

/** 플러그인은 처음 쓸 때만 불러온다(웹 첫 화면 번들에 넣지 않는다). */
const loadClient = async (): Promise<BleClientType> => (await import('@capacitor-community/bluetooth-le')).BleClient;

const toError = (e: unknown): BleError => {
  if (e instanceof BleError) return e;
  const msg = String((e as { message?: string } | null)?.message ?? e).toLowerCase();
  if (msg.includes('cancel')) return new BleError('cancelled');
  if (msg.includes('permission') || msg.includes('denied') || msg.includes('not authorized')) return new BleError('denied');
  if (msg.includes('not enabled') || msg.includes('unavailable') || msg.includes('not supported')) return new BleError('unsupported');
  return new BleError('failed', msg);
};

/** iOS·Android 앱의 `@capacitor-community/bluetooth-le`. */
export class CapacitorBleTransport implements BleTransport {
  private deviceId: string | null = null;
  private disconnectCb: (() => void) | null = null;
  private client: BleClientType | null = null;

  private async ble(): Promise<BleClientType> {
    if (!this.client) {
      this.client = await loadClient();
      await this.client.initialize({ androidNeverForLocation: true });
    }
    return this.client;
  }

  async requestDevice(filters: BleFilters): Promise<void> {
    try {
      const ble = await this.ble();
      const device = await ble.requestDevice({
        ...(filters.services ? { services: filters.services } : {}),
        ...(filters.namePrefix ? { namePrefix: filters.namePrefix } : {}),
        ...(filters.optionalServices ? { optionalServices: filters.optionalServices } : {}),
      });
      this.deviceId = device.deviceId;
    } catch (e) {
      throw toError(e);
    }
  }

  async connect(): Promise<void> {
    if (!this.deviceId) throw new BleError('failed', '기기가 선택되지 않았어요');
    try {
      const ble = await this.ble();
      await ble.connect(this.deviceId, () => this.disconnectCb?.());
    } catch (e) {
      throw toError(e);
    }
  }

  async startNotifications(service: string, characteristic: string, onValue: (v: DataView) => void): Promise<void> {
    if (!this.deviceId) throw new BleError('failed', '연결되지 않았어요');
    try {
      await (await this.ble()).startNotifications(this.deviceId, service, characteristic, onValue);
    } catch (e) {
      throw toError(e);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.deviceId) return;
    try {
      await (await this.ble()).disconnect(this.deviceId);
    } catch {
      /* 이미 끊겼으면 무시 */
    }
  }

  onDisconnect(cb: () => void): void {
    this.disconnectCb = cb;
  }
}
