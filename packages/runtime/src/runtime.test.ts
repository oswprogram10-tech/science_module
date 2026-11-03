import { describe, expect, it } from 'vitest';
import { simulateDissolution, type DissolutionParams } from '@sci/engine-matter';
import { analyzeTrial } from '@sci/gateway';
import { createRuntime, sampleAt, trialDuration, type Trial } from './index';

const defaults = { solute: 'salt', waterMl: 50, waterTempC: 20, stir: 1 };
const sim = (v: Record<string, string | number>) => simulateDissolution(v as unknown as DissolutionParams);
const analyze = (prev: Trial | undefined, cur: { values: Record<string, string | number>; ivKey: string | null }) =>
  analyzeTrial(prev, cur);

function makeRuntime() {
  let now = 0;
  const rt = createRuntime({ defaults, clock: () => now });
  return { rt, advance: (ms: number) => (now += ms) };
}

describe('runtime', () => {
  it('실행 후 prediction이 null로 초기화되고 시행에는 남는다', () => {
    const { rt } = makeRuntime();
    rt.setIV('stir');
    rt.setPrediction('same');
    const trial = rt.run(sim, analyze)!;
    expect(rt.getSnapshot().prediction).toBeNull();
    expect(trial.prediction).toBe('same');
    expect(trial.analysis.kind).toBe('first-trial');
    expect(rt.getSnapshot().trials).toHaveLength(1);
  });

  it('전체 sim 시간이 실제 8초에 매핑된다', () => {
    const { rt } = makeRuntime();
    const trial = rt.run(sim, analyze)!;
    const duration = trialDuration(trial);
    rt.tick(4000);
    expect(rt.getSnapshot().playhead).toBeCloseTo(duration / 2, 6);
    expect(rt.getSnapshot().playing).toBe(true);
    rt.tick(3999);
    expect(rt.getSnapshot().playing).toBe(true);
    rt.tick(1);
    expect(rt.getSnapshot().playing).toBe(false);
    expect(rt.getSnapshot().playhead).toBe(duration);
    rt.tick(1000);
    expect(rt.getSnapshot().playhead).toBe(duration);
  });

  it('주입한 시계로 tickNow가 진행한다', () => {
    const { rt, advance } = makeRuntime();
    const trial = rt.run(sim, analyze)!;
    rt.tickNow(); // 기준 시각 기록
    advance(2000);
    rt.tickNow();
    expect(rt.getSnapshot().playhead).toBeCloseTo(trialDuration(trial) * 0.25, 6);
  });

  it('재생 중에는 입력과 플레이헤드 이동이 잠긴다', () => {
    const { rt } = makeRuntime();
    rt.run(sim, analyze);
    rt.setValue('stir', 2);
    rt.setPlayhead(5);
    expect(rt.getSnapshot().values.stir).toBe(1);
    expect(rt.getSnapshot().playhead).toBe(0);
    rt.tick(8000);
    rt.setPlayhead(5);
    expect(rt.getSnapshot().playhead).toBe(5);
    rt.setPlayhead(1e9);
    expect(rt.getSnapshot().playhead).toBe(trialDuration(rt.getSnapshot().trials[0]!));
  });

  it('subscribe/getSnapshot: 변경 때만 새 스냅샷', () => {
    const { rt } = makeRuntime();
    let calls = 0;
    const off = rt.subscribe(() => calls++);
    const a = rt.getSnapshot();
    expect(rt.getSnapshot()).toBe(a);
    rt.setIV('stir');
    expect(rt.getSnapshot()).not.toBe(a);
    expect(calls).toBe(1);
    off();
    rt.setIV('waterMl');
    expect(calls).toBe(1);
  });

  it('두 번째 시행은 앞 시행과 비교된다', () => {
    const { rt } = makeRuntime();
    rt.setIV('waterTempC');
    rt.run(sim, analyze);
    rt.tick(8000);
    rt.setValue('waterTempC', 40);
    const t2 = rt.run(sim, analyze)!;
    expect(t2.analysis).toEqual({ kind: 'fair-test', changed: ['waterTempC'] });
    rt.reset();
    expect(rt.getSnapshot().trials).toHaveLength(0);
    expect(rt.getSnapshot().values).toEqual(defaults);
  });
});

describe('sampleAt', () => {
  const trial = {
    samples: [
      { t: 0, addedG: 2, dissolvedG: 0, undissolvedG: 2 },
      { t: 10, addedG: 2, dissolvedG: 2, undissolvedG: 0 },
      { t: 20, addedG: 4, dissolvedG: 3, undissolvedG: 1 },
    ],
  } as unknown as Trial;

  it('샘플 사이를 선형 보간한다', () => {
    expect(sampleAt(trial, 5)).toEqual({ t: 5, addedG: 2, dissolvedG: 1, undissolvedG: 1 });
    expect(sampleAt(trial, 15)).toEqual({ t: 15, addedG: 4, dissolvedG: 2.5, undissolvedG: 1.5 });
  });
  it('넣은 양은 보간하지 않고 계단식으로 바뀐다', () => {
    const real = { samples: simulateDissolution({ solute: 'salt', waterMl: 50, waterTempC: 20, stir: 0 }).samples } as unknown as Trial;
    const end = real.samples[real.samples.length - 1]!.t;
    for (let t = 0; t <= end; t += 0.37) {
      const s = sampleAt(real, t);
      expect(s.addedG % 2).toBeCloseTo(0, 9);
      expect(s.undissolvedG).toBeGreaterThanOrEqual(-1e-9);
      expect(s.addedG - s.dissolvedG - s.undissolvedG).toBeCloseTo(0, 9);
    }
  });
  it('범위 밖은 양 끝 값으로 고정', () => {
    expect(sampleAt(trial, -3).dissolvedG).toBe(0);
    expect(sampleAt(trial, 99)).toEqual({ t: 20, addedG: 4, dissolvedG: 3, undissolvedG: 1 });
  });
  it('정확히 샘플 시각이면 그 값', () => {
    expect(sampleAt(trial, 10).dissolvedG).toBe(2);
  });
});
