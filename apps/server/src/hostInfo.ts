import type { NetworkInterfaceInfo } from 'node:os';

/** `os.networkInterfaces()`의 반환 모양. */
export type Interfaces = Record<string, NetworkInterfaceInfo[] | undefined>;

/** 학생 앱에 알려 줄 수 있는 사설 IPv4인가: 10.x.x.x, 172.16–31.x.x, 192.168.x.x. */
export function isPrivateIPv4(addr: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number) as [number, number, number, number];
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * 이 PC의 사설 IPv4 주소 목록(중복 없이, 192.168 → 10 → 172 순). 내부(루프백) 주소와 IPv6, 링크 로컬(169.254)은 뺀다.
 * 가상 어댑터(WSL·Docker 등)의 사설 주소도 섞일 수 있어, 무선망 주소를 앞에 두려고 192.168을 먼저 놓는다.
 */
export function pickPrivateIPv4(interfaces: Interfaces): string[] {
  const found: string[] = [];
  for (const list of Object.values(interfaces)) {
    for (const i of list ?? []) {
      // 옛 Node는 family가 숫자 4로 나온다.
      const v4 = i.family === 'IPv4' || (i.family as unknown) === 4;
      if (v4 && !i.internal && isPrivateIPv4(i.address) && !found.includes(i.address)) found.push(i.address);
    }
  }
  const rank = (a: string) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : 2);
  return found.sort((x, y) => rank(x) - rank(y));
}

/** 서버가 있는 PC 자신에서 온 요청인가(루프백 주소). */
export function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  const a = ip.toLowerCase();
  return a === '::1' || a === '127.0.0.1' || a.startsWith('127.') || a.startsWith('::ffff:127.');
}

export interface HostInfo {
  addresses: string[];
  port: number;
}
