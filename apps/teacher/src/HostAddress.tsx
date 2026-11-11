import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { isHostServed } from './serverUrl';

interface HostInfo {
  addresses: string[];
  port: number;
}

/** 학생 앱에 입력할 주소(IP:포트). */
export const hostAddress = (ip: string, port: number): string => `${ip}:${port}`;

/** 주소를 QR 코드 SVG로 만든다. 인터넷 없이 이 기기에서 만든다. */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

async function fetchHostInfo(): Promise<HostInfo | null> {
  try {
    const r = await fetch('/host-info', { cache: 'no-store' });
    if (!r.ok) return null; // 교사 PC 밖의 기기에서 열면 403 — 아무것도 보여 주지 않는다.
    const j: unknown = await r.json();
    if (!j || typeof j !== 'object') return null;
    const { addresses, port } = j as { addresses?: unknown; port?: unknown };
    if (!Array.isArray(addresses) || typeof port !== 'number') return null;
    return { addresses: addresses.filter((a): a is string => typeof a === 'string'), port };
  } catch {
    return null;
  }
}

/** 수업 서버(교사 PC)가 내보낸 화면에서만: 학생 앱에 입력할 주소와 QR 코드. */
export function HostAddress() {
  const [info, setInfo] = useState<HostInfo | null>(null);
  const [pick, setPick] = useState(0);
  const served = useMemo(isHostServed, []);
  useEffect(() => {
    if (!served) return;
    let cancelled = false;
    const load = () => void fetchHostInfo().then((i) => !cancelled && setInfo(i));
    load();
    // 와이파이를 바꾸면 주소가 달라지므로 가끔 다시 읽는다.
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [served]);

  const list = info?.addresses.map((a) => hostAddress(a, info.port)) ?? [];
  const current = list[Math.min(pick, list.length - 1)];
  const svg = useMemo(() => (current ? qrSvg(current) : ''), [current]);
  if (!served || !info) return null;

  if (list.length === 0) {
    return (
      <section className="host-address" data-testid="host-address" aria-label="학생 앱에 입력할 주소">
        <p>이 PC의 무선망 주소를 찾지 못했어요. 와이파이나 유선망에 연결되어 있는지 확인해 주세요.</p>
      </section>
    );
  }
  return (
    <section className="host-address" data-testid="host-address" aria-label="학생 앱에 입력할 주소">
      <div className="host-address-text">
        <p>
          학생 앱에 입력할 주소: <strong data-testid="host-address-value">{current}</strong>
        </p>
        {list.length > 1 && (
          <p className="hint">
            주소가 여러 개예요. 학생 기기와 같은 무선망의 주소를 고르세요.{' '}
            {list.map((a, i) => (
              <button key={a} type="button" aria-pressed={i === Math.min(pick, list.length - 1)} onClick={() => setPick(i)}>
                {a}
              </button>
            ))}
          </p>
        )}
      </div>
      <div className="host-qr" data-testid="host-qr" role="img" aria-label={`${current} QR 코드`} dangerouslySetInnerHTML={{ __html: svg }} />
    </section>
  );
}
