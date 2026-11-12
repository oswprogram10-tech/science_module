import { useMemo, useRef } from 'react';
import { MockGasDriver, MockDistanceDriver, MockHumidityDriver, MockLightDriver, MockPowerDriver, MockPressureDriver, MockPulseDriver, MockScaleDriver, MockSoundDriver, MockSpeedDriver, MockTemperatureDriver, MockTiltDriver, type SensorDriver, type SensorKind, type SensorReading } from '@sci/sensors';
import type { SensorSpec } from '../modules/types';
import { devMode } from './safety/devMode';
import { RealTemperatureControls, useRealTemperature } from './RealTemperature';

const SEEDS: Record<SensorKind, number> = { temperature: 20250101, scale: 20250102, pressure: 20250103, oxygen: 20250104, carbonDioxide: 20250105, light: 20250106, humidity: 20250107, pulse: 20250108, tilt: 20250109, sound: 20250110, distance: 20250111, speed: 20250112, power: 20250113 };
const DECIMALS: Record<SensorKind, number> = { temperature: 1, scale: 2, pressure: 1, oxygen: 1, carbonDioxide: 1, light: 1, humidity: 1, pulse: 0, tilt: 1, sound: 1, distance: 1, speed: 2, power: 0 };
const ARIA: Record<SensorKind, string> = { temperature: '온도', scale: '무게', pressure: '압력', oxygen: '산소', carbonDioxide: '이산화 탄소', light: '빛 세기', humidity: '습도', pulse: '맥박', tilt: '기울기', sound: '소리', distance: '거리', speed: '속력', power: '전력' };

function makeDriver(kind: SensorKind, source: () => number): SensorDriver {
  switch (kind) {
    case 'temperature':
      return new MockTemperatureDriver(source, SEEDS.temperature);
    case 'scale':
      return new MockScaleDriver(source, SEEDS.scale);
    case 'pressure':
      return new MockPressureDriver(source, SEEDS.pressure);
    case 'light':
      return new MockLightDriver(source, SEEDS.light);
    case 'humidity':
      return new MockHumidityDriver(source, SEEDS.humidity);
    case 'pulse':
      return new MockPulseDriver(source, SEEDS.pulse);
    case 'tilt':
      return new MockTiltDriver(source, SEEDS.tilt);
    case 'sound':
      return new MockSoundDriver(source, SEEDS.sound);
    case 'distance':
      return new MockDistanceDriver(source, SEEDS.distance);
    case 'speed':
      return new MockSpeedDriver(source, SEEDS.speed);
    case 'power':
      return new MockPowerDriver(source, SEEDS.power);
    case 'oxygen':
    case 'carbonDioxide':
      return new MockGasDriver(kind, source, SEEDS[kind]);
  }
}

/** toFixed와 같지만 "-0.0"처럼 0에 가까운 음수는 "0.0"으로 쓴다(가상 센서의 작은 잡음). */
const fixed = (value: number, decimals: number): string => {
  const text = value.toFixed(decimals);
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
};

interface Entry { driver: SensorDriver; holder: { source: number }; key: number; reading: SensorReading }

/** 단원(모듈)이 준 SensorSpec마다 Mock 드라이버를 만들어 읽는다. 표시되는 값이 바뀔 때만 다시 읽어 숫자가 매 프레임 깜빡이지 않게 한다. */
function useSensorReadings(specs: SensorSpec[]): SensorReading[] {
  const entries = useRef(new Map<string, Entry>());
  return specs.map((spec) => {
    const key = Math.round(spec.source * 10 ** (spec.decimals ?? DECIMALS[spec.kind]));
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
  const dev = useMemo(devMode, []);
  const real = useRealTemperature();
  // (시험) 실물 온도 센서가 연결되면 첫 가상 온도계 자리에 실측값을 보여 준다. 시뮬레이션 계산에는 쓰지 않는다.
  const tempIndex = dev ? specs.findIndex((s) => s.kind === 'temperature') : -1;
  const realShown = tempIndex >= 0 && real.status === 'connected';
  // 센서가 없는 단원은 막대를 그리지 않는다(모의 센서 배지만 남지 않게).
  if (specs.length === 0) return null;
  return (
    <div className="sensors" role="group" aria-label="센서">
      <span className="badge">모의 센서</span>
      {specs.map((spec, i) => {
        const isReal = realShown && i === tempIndex;
        return (
          <div className="sensor" key={spec.id}>
            <span className="sensor-name">{isReal ? '실물 온도계' : spec.label}</span>
            {isReal && <span className="badge real-badge">실물 센서</span>}
            <output className="sensor-value" aria-label={spec.ariaLabel ?? ARIA[spec.kind]}>
              {isReal
                ? real.value === null || Number.isNaN(real.value)
                  ? '기다리는 중'
                  : `${real.value.toFixed(DECIMALS[spec.kind])} °C`
                : `${fixed(readings[i]!.value, spec.decimals ?? DECIMALS[spec.kind])} ${readings[i]!.unit}`}
            </output>
            {isReal && real.stale && <span className="real-stale">(끊김: 마지막 값)</span>}
          </div>
        );
      })}
      {tempIndex >= 0 && <RealTemperatureControls real={real} />}
    </div>
  );
}
