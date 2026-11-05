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

  it('센서가 없는 변인 실험 단원은 먹이 관계와 감염 전파뿐이고 나머지는 센서를 그대로 가진다', () => {
    const none = UNITS.flatMap((u) => (u.ok && u.activity === 'variable' && u.module.sensors(null, Object.fromEntries(u.experiment.variables.map((v) => [v.key, v.default]))).length === 0 ? [u.id] : []));
    expect(none).toEqual(['g4-ecosystem', 'g3-health']);
  });
});
