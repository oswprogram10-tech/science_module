import { describe, expect, it } from 'vitest';
import { circuitSegments, dotPositions, fieldCurveCount, pointAt, segLength } from './MagnetFlowView';
import { clipDrawing, coilLines, needleAngle } from './MagnetMacroView';

describe('전자석 그림 계산', () => {
  it('코일 줄 수는 50·100·200회에 6·10·16줄이다', () => {
    expect([50, 100, 200].map(coilLines)).toEqual([6, 10, 16]);
  });

  it('클립은 최대 12개까지 그리고 나머지는 +n으로 센다', () => {
    expect(clipDrawing(0)).toEqual({ drawn: 0, extra: 0 });
    expect(clipDrawing(11.6)).toEqual({ drawn: 12, extra: 0 });
    expect(clipDrawing(25)).toEqual({ drawn: 12, extra: 13 });
    expect(clipDrawing(30)).toEqual({ drawn: 12, extra: 18 });
  });

  it('나침반 바늘은 꺼지면 북쪽(위), 켜지면 머리 쪽 극에 따라 반대로 간다', () => {
    expect(needleAngle(false, 'N')).toBe(0);
    expect(needleAngle(false, 'S')).toBe(0);
    expect(needleAngle(true, 'N')).toBe(-90);
    expect(needleAngle(true, 'S')).toBe(90);
  });

  it('코일 주위 곡선은 클립 수에 비례해 0~6개다', () => {
    expect([0, 0.04, 0.1, 5, 5.1, 12, 25, 30, 100].map(fieldCurveCount)).toEqual([0, 0, 1, 1, 2, 3, 5, 6, 6]);
  });
});

describe('전기가 흐르는 모습: 점의 길', () => {
  it('병렬은 두 갈래가 절반 속도, 나머지는 한 줄 길이다', () => {
    const one = circuitSegments('one', false);
    expect(one).toHaveLength(1);
    expect(one[0]!.factor).toBe(1);
    expect(circuitSegments('series', false)).toHaveLength(1);
    const par = circuitSegments('parallel', false);
    expect(par.map((s) => s.factor)).toEqual([1, 0.5, 0.5]);
  });

  it('방향을 바꾸면 같은 길을 거꾸로 간다', () => {
    for (const battery of ['one', 'parallel']) {
      const f = circuitSegments(battery, false);
      const r = circuitSegments(battery, true);
      f.forEach((seg, i) => {
        expect(r[i]!.pts).toEqual([...seg.pts].reverse());
        // 화살표 위치는 같은 점에서 방향만 반대
        seg.arrows.forEach((a) => {
          const p = pointAt(seg.pts, a);
          const q = pointAt(r[i]!.pts, segLength(seg.pts) - a);
          expect([q.x, q.y]).toEqual([p.x, p.y]);
          expect(Math.abs((((q.angle - p.angle) % 360) + 360) % 360 - 180)).toBeLessThan(1e-9);
        });
      });
    }
  });

  it('점은 일정한 간격으로 놓이고, phase만큼 갈래 속도 비율로 앞으로 간다', () => {
    const [main, upper] = circuitSegments('parallel', false);
    const a = dotPositions(upper!, 0);
    const b = dotPositions(upper!, 20); // 갈래 속도 1/2 → 10 px
    expect(a).toHaveLength(b.length);
    const L = segLength(upper!.pts);
    expect(a.length).toBe(Math.round(L / 22));
    // 첫 점은 경로를 따라 10 px 이동: 시작점 (84,300)에서 위로 10 px
    expect(a[0]).toEqual([84, 300]);
    expect(b[0]![0]).toBeCloseTo(84, 9);
    expect(b[0]![1]).toBeCloseTo(290, 9);
    const m = dotPositions(main!, 0);
    const m2 = dotPositions(main!, 20);
    expect(m.length).toBe(Math.round(segLength(main!.pts) / 22));
    expect(m2[0]![0]).toBeCloseTo(m[0]![0] + 20, 9); // 주 줄은 20 px (아래쪽 줄을 오른쪽으로)
  });

  it('phase가 한 바퀴를 넘어가도 위치가 이어진다', () => {
    const [loop] = circuitSegments('one', false);
    const L = segLength(loop!.pts);
    const a = dotPositions(loop!, 5);
    const b = dotPositions(loop!, 5 + L);
    a.forEach((p, i) => {
      expect(b[i]![0]).toBeCloseTo(p[0], 6);
      expect(b[i]![1]).toBeCloseTo(p[1], 6);
    });
  });
});
