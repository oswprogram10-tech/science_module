export interface SensorReading {
  value: number;
  unit: string;
  ts: number;
  /** 실물 센서가 끊겨 마지막 값을 그대로 보여 줄 때 true */
  stale?: boolean;
}

export type SensorKind = 'temperature' | 'scale' | 'pressure' | 'oxygen' | 'carbonDioxide' | 'light' | 'humidity' | 'pulse';

export interface SensorDriver {
  id: string;
  kind: SensorKind;
  unit: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(): SensorReading;
  subscribe(cb: (r: SensorReading) => void): () => void;
}

/** 시드 고정 의사난수 (mulberry32). [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

abstract class MockDriver implements SensorDriver {
  abstract id: string;
  abstract kind: SensorKind;
  abstract unit: string;
  protected rng: () => number;
  private listeners = new Set<(r: SensorReading) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    protected source: () => number,
    seed: number,
    private pollMs = 250,
  ) {
    this.rng = mulberry32(seed);
  }

  protected abstract measure(): number;

  async connect() {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      const r = this.read();
      this.listeners.forEach((cb) => cb(r));
    }, this.pollMs);
  }

  async disconnect() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  read(): SensorReading {
    return { value: this.measure(), unit: this.unit, ts: Date.now() };
  }

  subscribe(cb: (r: SensorReading) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

const roundTo = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

export const TEMPERATURE_NOISE_C = 0.2;
export const SCALE_NOISE_G = 0.01;
export const PRESSURE_NOISE_KPA = 0.1;
export const GAS_NOISE_PCT = 0.05;
export const LIGHT_NOISE_PCT = 0.5;
export const HUMIDITY_NOISE_PCT = 0.5;
export const PULSE_NOISE_BPM = 1;
export const BEAKER_G = 100;

/** 값 = source() + 시드 고정 잡음(±0.2 °C), 소수 첫째 자리. */
export class MockTemperatureDriver extends MockDriver {
  id = 'mock-temperature';
  kind = 'temperature' as const;
  unit = '°C';
  protected measure() {
    return roundTo(this.source() + (this.rng() * 2 - 1) * TEMPERATURE_NOISE_C, 1);
  }
}

/**
 * 값 = 비커 100 g + source(). source는 물(waterMl g) + 넣은 용질(addedG)의 무게를 돌려준다.
 * 녹은 양은 무게에 들어가지 않으므로, 용질이 녹는 동안 값이 변하지 않는다.
 * 잡음 ±0.01 g, 소수 둘째 자리.
 */
export class MockScaleDriver extends MockDriver {
  id = 'mock-scale';
  kind = 'scale' as const;
  unit = 'g';
  protected measure() {
    return roundTo(BEAKER_G + this.source() + (this.rng() * 2 - 1) * SCALE_NOISE_G, 2);
  }
}

/** 값 = source()(kPa) + 시드 고정 잡음(±0.1 kPa), 소수 첫째 자리. */
export class MockPressureDriver extends MockDriver {
  id = 'mock-pressure';
  kind = 'pressure' as const;
  unit = 'kPa';
  protected measure() {
    return roundTo(this.source() + (this.rng() * 2 - 1) * PRESSURE_NOISE_KPA, 1);
  }
}

/** 값 = source()(%) + 시드 고정 잡음(±0.05 %), 소수 첫째 자리. kind는 산소 또는 이산화 탄소. */
export class MockGasDriver extends MockDriver {
  id: string;
  unit = '%';
  constructor(
    readonly kind: 'oxygen' | 'carbonDioxide',
    source: () => number,
    seed: number,
    pollMs?: number,
  ) {
    super(source, seed, pollMs);
    this.id = kind === 'oxygen' ? 'mock-oxygen' : 'mock-carbon-dioxide';
  }
  protected measure() {
    return roundTo(this.source() + (this.rng() * 2 - 1) * GAS_NOISE_PCT, 1);
  }
}

/** 값 = source()(%, 상대 빛 세기) + 시드 고정 잡음(±0.5 %), 0~100 %로 자르고 소수 첫째 자리. */
export class MockLightDriver extends MockDriver {
  id = 'mock-light';
  kind = 'light' as const;
  unit = '%';
  protected measure() {
    const v = this.source() + (this.rng() * 2 - 1) * LIGHT_NOISE_PCT;
    return roundTo(Math.min(100, Math.max(0, v)), 1);
  }
}

/** 값 = source()(%, 상대 습도) + 시드 고정 잡음(±0.5 %), 0~100 %로 자르고 소수 첫째 자리. */
export class MockHumidityDriver extends MockDriver {
  id = 'mock-humidity';
  kind = 'humidity' as const;
  unit = '%';
  protected measure() {
    const v = this.source() + (this.rng() * 2 - 1) * HUMIDITY_NOISE_PCT;
    return roundTo(Math.min(100, Math.max(0, v)), 1);
  }
}

/** 가상 맥박계: 값 = source()(회/분) + 시드 고정 잡음(±1회/분), 정수. 가상 친구의 값을 보여 주며 실제 학생의 측정이 아니다. */
export class MockPulseDriver extends MockDriver {
  id = 'mock-pulse';
  kind = 'pulse' as const;
  unit = '회/분';
  protected measure() {
    return Math.max(0, Math.round(this.source() + (this.rng() * 2 - 1) * PULSE_NOISE_BPM));
  }
}

export * from './ble';
