import type { SensorReading } from '@sci/sensors';

export function SensorBar({ temperature, scale }: { temperature: SensorReading; scale: SensorReading }) {
  return (
    <div className="sensors" role="group" aria-label="센서">
      <span className="badge">모의 센서</span>
      <div className="sensor">
        <span className="sensor-name">가상 온도계</span>
        <output className="sensor-value" aria-label="온도">{temperature.value.toFixed(1)} {temperature.unit}</output>
      </div>
      <div className="sensor">
        <span className="sensor-name">전자저울</span>
        <output className="sensor-value" aria-label="무게">{scale.value.toFixed(2)} {scale.unit}</output>
      </div>
    </div>
  );
}
