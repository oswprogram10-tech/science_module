import { describe, expect, it } from 'vitest';
import { hostAddress, qrSvg } from './HostAddress';

describe('학생 앱에 입력할 주소와 QR', () => {
  it('주소는 IP:포트', () => {
    expect(hostAddress('192.168.0.10', 8787)).toBe('192.168.0.10:8787');
  });
  it('QR은 이 기기에서 만든 SVG이고 바깥 주소를 가리키지 않는다', () => {
    const svg = qrSvg('192.168.0.10:8787');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:|href=|<image/);
    expect(svg.length).toBeGreaterThan(200);
  });
});
