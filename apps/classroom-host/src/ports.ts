import { createServer } from 'node:net';

/** 이 포트에서 열 수 있는지 잠깐 열어 본다. */
export function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, host, () => s.close(() => resolve(true)));
  });
}

/** first~last 가운데 처음으로 비어 있는 포트. 없으면 null. */
export async function findFreePort(first: number, last: number, host: string): Promise<number | null> {
  for (let p = first; p <= last; p++) if (await canListen(p, host)) return p;
  return null;
}
