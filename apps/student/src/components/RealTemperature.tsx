import { useCallback, useEffect, useRef, useState } from 'react';
import { BLE_TEMPERATURE_PROFILES, BleError, BleTemperatureDriver, type BleTemperatureProfile } from '@sci/sensors';
import { pickBleTransport } from '../platform/bleTransport';

export type RealTempStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface RealTemperature {
  status: RealTempStatus;
  message: string;
  value: number | null;
  stale: boolean;
  profileId: BleTemperatureProfile['id'];
  setProfileId(id: BleTemperatureProfile['id']): void;
  connect(): void;
  disconnect(): void;
}

export const BLE_MESSAGES = {
  unsupported: '이 기기에서는 블루투스 센서를 쓸 수 없어요.',
  denied: '블루투스 사용이 허락되지 않았어요. 설정에서 허용한 뒤 다시 해 보세요.',
  cancelled: '센서를 고르지 않았거나 찾지 못했어요. 센서를 켜고 다시 해 보세요.',
  failed: '연결하지 못했어요. 센서가 켜져 있는지 확인하고 다시 해 보세요.',
} as const;

/** (시험 기능) 실물 BLE 온도 센서를 연결하고 실측값을 돌려준다. 시뮬레이션 계산에는 쓰지 않는다. */
export function useRealTemperature(): RealTemperature {
  const [profileId, setProfileId] = useState<BleTemperatureProfile['id']>('ess-temperature');
  const [status, setStatus] = useState<RealTempStatus>('idle');
  const [message, setMessage] = useState('');
  const [value, setValue] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const driver = useRef<BleTemperatureDriver | null>(null);
  const cleanup = useRef<(() => void)[]>([]);

  const release = useCallback(() => {
    cleanup.current.forEach((f) => f());
    cleanup.current = [];
    const d = driver.current;
    driver.current = null;
    if (d) void d.disconnect().catch(() => undefined);
  }, []);

  useEffect(() => release, [release]);

  const connect = useCallback(() => {
    release();
    const transport = pickBleTransport();
    if (!transport) {
      setStatus('error');
      setMessage(BLE_MESSAGES.unsupported);
      return;
    }
    const profile = BLE_TEMPERATURE_PROFILES.find((p) => p.id === profileId)!;
    const d = new BleTemperatureDriver(transport, profile);
    driver.current = d;
    setStatus('connecting');
    setMessage('연결하는 중이에요.');
    setValue(null);
    setStale(false);
    cleanup.current = [
      d.subscribe((r) => setValue(r.value)),
      d.onStaleChange((s) => {
        setStale(s);
        setMessage(s ? '연결이 끊겨서 마지막 값을 보여 줘요.' : '실물 센서에 연결했어요.');
      }),
    ];
    d.connect().then(
      () => {
        if (driver.current !== d) return;
        setStatus('connected');
        setMessage('실물 센서에 연결했어요. 값을 기다리는 중이에요.');
      },
      (e: unknown) => {
        if (driver.current !== d) return;
        release();
        setStatus('error');
        setMessage(BLE_MESSAGES[e instanceof BleError ? e.code : 'failed']);
      },
    );
  }, [profileId, release]);

  const disconnect = useCallback(() => {
    release();
    setStatus('idle');
    setMessage('연결을 끊었어요.');
    setValue(null);
    setStale(false);
  }, [release]);

  return { status, message, value, stale, profileId, setProfileId, connect, disconnect };
}

/** `?dev=1`에서만 센서 막대에 붙는 시험용 연결 조작. */
export function RealTemperatureControls({ real }: { real: RealTemperature }) {
  const busy = real.status === 'connecting';
  const on = real.status === 'connected';
  return (
    <div className="real-temp">
      <label className="real-temp-profile">
        센서 종류{' '}
        <select value={real.profileId} disabled={busy || on} onChange={(e) => real.setProfileId(e.target.value as BleTemperatureProfile['id'])}>
          {BLE_TEMPERATURE_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {on ? (
        <button type="button" onClick={real.disconnect}>실물 온도 센서 연결 끊기</button>
      ) : (
        <button type="button" disabled={busy} onClick={real.connect}>실물 온도 센서 연결(시험)</button>
      )}
      <p className="real-temp-status" role="status" aria-live="polite">{real.message}</p>
    </div>
  );
}
