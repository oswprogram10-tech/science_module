import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SensorBar } from './SensorBar';
import { UNITS } from '../units';

describe('SensorBar: 센서가 없으면 그리지 않는다', () => {
  it('specs가 빈 배열이면 아무것도 그리지 않는다', () => {
    expect(renderToStaticMarkup(createElement(SensorBar, { specs: [] }))).toBe('');
  });

  it('센서가 있으면 모의 센서 막대를 그린다(기존 단원 무변화)', () => {
    const html = renderToStaticMarkup(createElement(SensorBar, { specs: [{ id: 't', label: '가상 온도계', unit: '°C', kind: 'temperature', source: 20 }] }));
    expect(html).toContain('모의 센서');
    expect(html).toContain('가상 온도계');
  });

  it('display가 있으면 읽은 값에 scale을 곱하고 단위 글자를 바꿔 보여 준다(조도계 %를 눈금으로, 거리 센서 cm를 mm로)', () => {
    const light = renderToStaticMarkup(createElement(SensorBar, { specs: [{ id: 'l', label: '가상 조도계', unit: '눈금', kind: 'light', source: 60, display: { scale: 0.1, unitLabel: '눈금' } }] }));
    expect(light).toMatch(/>(5\.[89]|6\.[0-2]) 눈금</);
    expect(light).not.toContain('%');
    const ruler = renderToStaticMarkup(createElement(SensorBar, { specs: [{ id: 'r', label: '가상 눈금자', unit: 'mm', kind: 'distance', source: 2.5, decimals: 0, display: { scale: 10, unitLabel: 'mm' } }] }));
    expect(ruler).toMatch(/>2[456] mm</);
    expect(ruler).not.toContain('cm');
  });

  it('센서가 없는 변인 실험 단원은 먹이 관계와 감염 전파뿐이고 나머지는 센서를 그대로 가진다', () => {
    const none = UNITS.flatMap((u) => (u.ok && u.activity === 'variable' && u.module.sensors(null, Object.fromEntries(u.experiment.variables.map((v) => [v.key, v.default]))).length === 0 ? [u.id] : []));
    expect(none).toEqual(['g4-ecosystem', 'g3-health']);
  });
});
