import { useRef } from 'react';
import { MockPressureDriver, MockScaleDriver, MockTemperatureDriver, type SensorDriver, type SensorKind, type SensorReading } from '@sci/sensors';
import type { SensorSpec } from '../modules/types';

const SEEDS: Record<SensorKind, number> = { temperature: 20250101, scale: 20250102, pressure: 20250103 };
const DECIMALS: Record<SensorKind, number> = { temperature: 1, scale: 2, pressure: 1 };
const ARIA: Record<SensorKind, string> = { temperature: '온도', scale: '무게', pressure: '압력' };

function makeDriver(kind: SensorKind, source: () => number): SensorDriver {
  switch (kind) {
    case 'temperature':
      return new MockTemperatureDriver(source, SEEDS.temperature);
    case 'scale':
      return new MockScaleDriver(source, SEEDS.scale);
    case 'pressure':
      return new MockPressureDriver(source, SEEDS.pressure);
  }
}

interface Entry { driver: SensorDriver; holder: { source: number }; key: number; reading: SensorReading }

/** 단원(모듈)이 준 SensorSpec마다 Mock 드라이버를 만들어 읽는다. 표시되는 값이 바뀔 때만 다시 읽어 숫자가 매 프레임 깜빡이지 않게 한다. */
function useSensorReadings(specs: SensorSpec[]): SensorReading[] {
  const entries = useRef(new Map<string, Entry>());
  return specs.map((spec) => {
    const key = Math.round(spec.source * 10 ** DECIMALS[spec.kind]);
    let e = entries.current.get(spec.id);
    if (!e) {
      const holder = { source: spec.source };
      const driver = makeDriver(spec.kind, () => holder.source);
      e = { driver, holder, key, reading: driver.read() };
      entries.current.set(spec.id, e);
    } else {
      e.holder.source = spec.source;
      if (e.key !== key) {
        e.key = key;
        e.reading = e.driver.read();
      }
    }
    return e.reading;
  });
}

export function SensorBar({ specs }: { specs: SensorSpec[] }) {
  const readings = useSensorReadings(specs);
  return (
    <div className="sensors" role="group" aria-label="센서">
      <span className="badge">모의 센서</span>
      {specs.map((spec, i) => (
        <div className="sensor" key={spec.id}>
          <span className="sensor-name">{spec.label}</span>
          <output className="sensor-value" aria-label={ARIA[spec.kind]}>
            {readings[i]!.value.toFixed(DECIMALS[spec.kind])} {readings[i]!.unit}
          </output>
        </div>
      ))}
    </div>
  );
}
