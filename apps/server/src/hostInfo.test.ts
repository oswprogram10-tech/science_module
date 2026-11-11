import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { isLoopback, isPrivateIPv4, pickPrivateIPv4, type Interfaces } from './hostInfo';

const v4 = (address: string, internal = false): NetworkInterfaceInfo => ({
  address,
  netmask: '255.255.255.0',
  family: 'IPv4',
  mac: '00:00:00:00:00:00',
  internal,
  cidr: `${address}/24`,
});
const v6 = (address: string): NetworkInterfaceInfo => ({
  address,
  netmask: 'ffff:ffff:ffff:ffff::',
  family: 'IPv6',
  mac: '00:00:00:00:00:00',
  internal: false,
  cidr: `${address}/64`,
  scopeid: 0,
});

describe('사설 IPv4 고르기', () => {
  it('사설 대역만 사설로 본다', () => {
    for (const a of ['192.168.0.10', '10.0.3.4', '172.16.0.1', '172.31.255.254']) expect(isPrivateIPv4(a)).toBe(true);
    for (const a of ['172.15.0.1', '172.32.0.1', '8.8.8.8', '169.254.1.2', '127.0.0.1', '192.169.0.1', '300.1.1.1', 'abc', '']) expect(isPrivateIPv4(a)).toBe(false);
  });

  it('루프백·IPv6·링크 로컬·공인 주소를 빼고 192.168 → 10 → 172 순으로 돌려준다', () => {
    const ifaces: Interfaces = {
      lo: [v4('127.0.0.1', true), v6('::1')],
      docker0: [v4('172.17.0.1')],
      'Ethernet': [v4('10.1.2.3'), v6('fe80::1'), v4('169.254.10.10')],
      'Wi-Fi': [v4('192.168.0.10'), v4('192.168.0.10')],
      wan: [v4('203.0.113.5')],
      down: undefined,
    };
    expect(pickPrivateIPv4(ifaces)).toEqual(['192.168.0.10', '10.1.2.3', '172.17.0.1']);
  });

  it('후보가 없으면 빈 목록', () => {
    expect(pickPrivateIPv4({ lo: [v4('127.0.0.1', true)] })).toEqual([]);
    expect(pickPrivateIPv4({})).toEqual([]);
  });
});

describe('isLoopback', () => {
  it('루프백 주소만 true', () => {
    for (const a of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1']) expect(isLoopback(a)).toBe(true);
    for (const a of ['192.168.0.10', '::ffff:192.168.0.10', '10.0.0.1', '', undefined]) expect(isLoopback(a)).toBe(false);
  });
});
