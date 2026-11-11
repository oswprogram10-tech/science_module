import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { VIB_LOUDS, VIB_OBJECTS, VIB_SEEDS, VIB_SOUNDS, simulateSoundVibration, type SoundVibrationSample } from '@sci/engine-physics';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { soundVibrationModule } from './index';
import { LOUD_TEXT, OBJECT_TEXT, SEED_TEXT, SOUND_TEXT, soundLine, startSample, vibNote } from './initial';
import { GRAIN_COUNT, GRAIN_R, MM, SURFACE, VibMacroView, grainX, grainY } from './VibMacroView';
import { VibMeterView, filledCells } from './VibMeterView';

const unit = UNITS.find((u) => u.id === 'g3-sound')!;
if (!unit.ok) throw new Error('g3-sound가 없어요');
const activity = unit.activities[1]!;
if (activity.activity !== 'variable') throw new Error('g3-sound 활동 2가 변인 실험이 아니에요');
const experiment = activity.experiment;
type V = { sound: string; loud: string; object: string; seed: string };
const base: V = { sound: 'off', loud: 'weak', object: 'drum', seed: 'yellow' };
const CONDITIONS: V[] = VIB_SOUNDS.flatMap((sound) => VIB_LOUDS.flatMap((loud) => VIB_OBJECTS.flatMap((object) => VIB_SEEDS.map((seed) => ({ sound, loud, object, seed })))));
const sim = (v: V) => soundVibrationModule.simulate(v, experiment) as ReturnType<typeof simulateSoundVibration>;
const at = (v: V, t: number): SoundVibrationSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: SoundVibrationSample | null, ran = true) => renderToStaticMarkup(createElement(VibMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const meter = (v: V, snapshot: SoundVibrationSample | null, ran = true) => renderToStaticMarkup(createElement(VibMeterView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);
const grainYs = (html: string) => [...html.matchAll(/data-testid="grain" cx="[\d.]+" cy="([\d.]+)"/g)].map((m) => Number(m[1]));
const TIMES = [0, 0.125, 0.25, 0.5, 0.75, 1.5, 3];

describe('레지스트리', () => {
  it('g3-sound 활동 2는 sound-vibration 모듈로 로드되고 첫 활동(string-sound)은 그대로다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['소리의 성질', 3, 'physics', ['4과07-01', '4과07-02']]);
    expect(unit.activities.map((a) => [a.activity, a.experiment.id, a.module.kind])).toEqual([['variable', 'string-sound', 'string-sound'], ['variable', 'sound-vibration', 'sound-vibration']]);
    expect(unit.module.kind).toBe('string-sound');
    expect(activity.module).toBe(soundVibrationModule);
    expect(MODULES['sound-vibration'].kind).toBe('sound-vibration');
    expect(experiment.safety).toEqual([]);
    expect(soundVibrationModule.validate(experiment)).toEqual([]);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual(['소리 나는 물체의 떨림', '소리가 나는 물체에는 어떤 공통점이 있을까?', '예측: 좁쌀이 튄 높이는?']);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([['sound', '소리 내기', 'off'], ['loud', '소리의 세기', 'weak'], ['object', '물체', 'drum'], ['seed', '좁쌀 색', 'yellow']]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['off', '소리를 내지 않음'], ['on', '소리를 냄']],
      [['weak', '약하게'], ['strong', '세게']],
      [['drum', '작은북'], ['fork', '소리굽쇠'], ['speaker', '스피커']],
      [['yellow', '노란 좁쌀'], ['white', '흰 좁쌀']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['bounce', '좁쌀이 튄 높이', 'mm'], ['level', '소리의 크기', '눈금']]);
    expect(experiment.limits).toEqual(['진동수', '진폭', '파동', '헤르츠', '데시벨']);
    expect(VIB_SOUNDS.map((s) => SOUND_TEXT[s])).toEqual(experiment.variables[0]!.options.map((o) => o.label));
    expect(VIB_LOUDS.map((s) => LOUD_TEXT[s])).toEqual(experiment.variables[1]!.options.map((o) => o.label));
    expect(VIB_OBJECTS.map((s) => OBJECT_TEXT[s])).toEqual(experiment.variables[2]!.options.map((o) => o.label));
    expect(VIB_SEEDS.map((s) => SEED_TEXT[s])).toEqual(experiment.variables[3]!.options.map((o) => o.label));
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값(정수 mm, 0~10 눈금)과 좁쌀 색 무영향', () => {
    const cols = soundVibrationModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['좁쌀이 튄 높이(mm)', '소리의 크기(눈금)']);
    const row = (sound: string, loud: string, object: string, seed = 'yellow') => cols.map((c) => c.value(sim({ sound, loud, object, seed }).result));
    for (const seed of ['yellow', 'white']) {
      expect(row('off', 'strong', 'drum', seed)).toEqual(['0', '0']);
      expect(row('on', 'strong', 'drum', seed)).toEqual(['12', '7']);
      expect(row('on', 'weak', 'drum', seed)).toEqual(['5', '3']);
      expect(row('on', 'strong', 'fork', seed)).toEqual(['6', '4']);
      expect(row('on', 'weak', 'fork', seed)).toEqual(['2', '1']);
      expect(row('on', 'strong', 'speaker', seed)).toEqual(['9', '5']);
      expect(row('on', 'weak', 'speaker', seed)).toEqual(['4', '2']);
    }
  });

  it('센서: 가상 소음계(sound, 눈금) 하나, 소리의 크기를 그대로 보여 준다', () => {
    const specs = soundVibrationModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 소음계: 소리의 크기', 'sound', '눈금']]);
    expect(specs[0]!.source).toBe(0);
    const drum = { ...base, sound: 'on', loud: 'strong' };
    expect(soundVibrationModule.sensors(at(drum, 0.25), drum)[0]!.source).toBe(7);
    expect(soundVibrationModule.sensors(at(base, 0.25), base)[0]!.source).toBe(0);
  });

  it('그래프 설정: y 0~15 mm 고정(0, 5, 10, 15), x 0~3초(0, 1, 2, 3), 선 하나, 재생이 끝나면 첫 마루(0.25초)에 둔다', () => {
    const g = soundVibrationModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['좁쌀 높이(mm)', undefined, [0, 5, 10, 15], '시간(초)', [0, 1, 2, 3], undefined, undefined]);
    expect(soundVibrationModule.restPlayhead).toBe(0.25);
    expect(soundVibrationModule.metric.sampleKey).toBe('bounceMm');
    expect(soundVibrationModule.metric.resultKey).toBe('bounce');
    for (const v of CONDITIONS) {
      const s = sim(v).samples;
      expect(Math.max(...s.map((x) => x.bounceMm))).toBeLessThanOrEqual(15);
      expect(s.at(-1)!.t).toBe(3);
    }
  });

  it('예측 비교는 좁쌀이 튄 높이(mm): 소리를 냄 → 늘어남, 세게 → 늘어남, 소리굽쇠 → 줄어듦, 좁쌀 색은 변하지 않음 (기준 0.5 mm)', () => {
    const m = soundVibrationModule.metric;
    const bounce = (v: V) => sim(v).result[m.resultKey as 'bounce'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    const on = { ...base, sound: 'on' };
    expect(observedOutcome(bounce(base), bounce(on), th)).toBe('increase');
    expect(observedOutcome(bounce(on), bounce(base), th)).toBe('decrease');
    expect(observedOutcome(bounce(on), bounce({ ...on, loud: 'strong' }), th)).toBe('increase');
    expect(observedOutcome(bounce(on), bounce({ ...on, object: 'fork' }), th)).toBe('decrease');
    expect(observedOutcome(bounce({ ...on, loud: 'strong' }), bounce({ ...on, loud: 'strong', object: 'speaker' }), th)).toBe('decrease');
    for (const v of CONDITIONS) expect(observedOutcome(bounce(v), bounce({ ...v, seed: v.seed === 'yellow' ? 'white' : 'yellow' }), th)).toBe('same');
    // 소리를 내지 않으면 세기·물체를 바꿔도 변하지 않는다
    expect(observedOutcome(bounce(base), bounce({ ...base, loud: 'strong', object: 'speaker' }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축·x축 라벨과 눈금이 있다', () => {
    const v = { ...base, sound: 'on', loud: 'strong' };
    const html = renderToStaticMarkup(createElement(GraphView, { module: soundVibrationModule as never, experiment, trial: trialOf(v), prev: undefined, playhead: 0.25, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('좁쌀 높이(mm)');
    expect(html).toContain('시간(초)');
    expect([...html.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['0', '5', '10', '15']);
    expect(html.match(/<polyline/g)).toHaveLength(1);
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}초 · 좁쌀 높이 {mm} mm · 소리의 크기 {n}눈금"', () => {
    const drum = { ...base, sound: 'on', loud: 'strong' };
    expect(vibNote(at(drum, 0.25))).toBe('0.25초 · 좁쌀 높이 12.0 mm · 소리의 크기 7눈금');
    expect(vibNote(at(drum, 0.5))).toBe('0.50초 · 좁쌀 높이 0.0 mm · 소리의 크기 7눈금');
    expect(macro(drum, at(drum, 0.25))).toContain('0.25초 · 좁쌀 높이 12.0 mm · 소리의 크기 7눈금');
    expect(vibNote(at(base, 0.25))).toBe('0.25초 · 좁쌀 높이 0.0 mm · 소리의 크기 0눈금');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 좁쌀은 가만히(높이 0), 손·떨림 표시 없음, 문구에 숫자 없음', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(count(html, 'vib-hand'), JSON.stringify(v)).toBe(0);
      expect(count(html, 'vib-marks')).toBe(0);
      expect(html).toContain('data-bounce="0.00"');
      expect(html).toContain('실험하면');
      expect(html).not.toContain('좁쌀 높이');
      expect(count(html, 'grain')).toBe(GRAIN_COUNT);
      const ys = grainYs(html);
      expect(new Set(ys)).toEqual(new Set([SURFACE[v.object as 'drum'].y - GRAIN_R]));
      expect(meter(v, null, false)).toContain('data-filled="0"');
    }
  });

  it('좁쌀은 소리를 낼 때만 튄다: 마루(0.25초)에서 가장 높은 좁쌀이 튄 높이(mm × 4)만큼 올라가고, 소리를 내지 않으면 가만히 있다', () => {
    for (const v of CONDITIONS) {
      const rest = SURFACE[v.object as 'drum'].y - GRAIN_R;
      const html = macro(v, at(v, 0.25));
      const ys = grainYs(html);
      const bounce = sim(v).result.bounce;
      expect(Math.min(...ys), JSON.stringify(v)).toBeCloseTo(rest - bounce * MM, 1);
      if (v.sound === 'off') expect(new Set(ys)).toEqual(new Set([rest]));
      // 소리가 나면 좁쌀마다 높이가 다르다(겹치지 않게)
      else expect(new Set(ys).size).toBeGreaterThan(3);
      // 그림 위쪽 글자 줄(y 40)보다 아래에서 튄다
      expect(Math.min(...ys) - GRAIN_R).toBeGreaterThan(44);
    }
  });

  it('손과 떨림 표시(물결 테두리): 실행한 뒤에만 손이 있고, 소리를 낼 때만 떨림 표시가 있다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 0.25));
      expect(count(html, 'vib-hand'), JSON.stringify(v)).toBe(1);
      expect(count(html, 'vib-marks')).toBe(v.sound === 'on' ? 1 : 0);
      expect(html).toContain(`data-sound="${v.sound}"`);
    }
  });

  it('좁쌀 7알의 가로 자리는 물체 위 면 안에 있고 서로 겹치지 않는다', () => {
    for (const object of VIB_OBJECTS) {
      const xs = Array.from({ length: GRAIN_COUNT }, (_, i) => grainX(object, i));
      expect(new Set(xs).size).toBe(GRAIN_COUNT);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(2 * GRAIN_R);
      expect(xs[0]).toBeGreaterThanOrEqual(SURFACE[object].x0);
      expect(xs.at(-1)).toBeLessThanOrEqual(SURFACE[object].x1);
      // 가장 높이 튄 좁쌀(비율 1)은 튄 높이를 그대로 오른다
      expect(grainY(object, 0, 12)).toBe(SURFACE[object].y - GRAIN_R - 12 * MM);
    }
  });

  it('물체 그림과 조건 라벨: 물체·좁쌀 색·소리 내기·세기', () => {
    expect(soundLine({ sound: 'off', loud: 'strong' })).toBe('소리를 내지 않음');
    expect(soundLine({ sound: 'on', loud: 'strong' })).toBe('소리를 냄 · 세게');
    expect(soundLine({ sound: 'on', loud: 'weak' })).toBe('소리를 냄 · 약하게');
    for (const object of VIB_OBJECTS) {
      const html = macro({ ...base, object, seed: 'white', sound: 'on', loud: 'strong' }, null, false);
      expect(html).toContain(`data-object="${object}"`);
      expect(html).toContain(`${OBJECT_TEXT[object]} · ${SEED_TEXT.white}`);
      expect(html).toContain('소리를 냄 · 세게');
    }
  });

  it('좁쌀 색은 그림 색만 바꾼다: 노란 좁쌀과 흰 좁쌀의 결과 글자·높이가 같다', () => {
    for (const v of CONDITIONS) {
      const w = { ...v, seed: 'white' };
      const y = { ...v, seed: 'yellow' };
      const hw = macro(w, at(w, 0.25));
      const hy = macro(y, at(y, 0.25));
      expect(grainYs(hw)).toEqual(grainYs(hy));
      expect(hw).toContain('fill="#ffffff"');
      expect(hy).toContain('fill="#facc15"');
    }
  });

  it('startSample은 t = 0, 좁쌀 높이 0', () => {
    expect(startSample({ ...base, sound: 'on', loud: 'strong' })).toMatchObject({ t: 0, bounceMm: 0 });
  });
});

describe('소음계 보기', () => {
  it('눈금 열 칸 가운데 소리의 크기만큼 채워진다 (실행 뒤), 실행 전에는 비어 있다', () => {
    for (const v of CONDITIONS) {
      const level = sim(v).result.level;
      const html = meter(v, at(v, 0.25));
      expect(html).toContain(`data-filled="${level}"`);
      expect((html.match(/data-on="true"/g) ?? []).length).toBe(level);
      expect((html.match(/data-testid="meter-cell"/g) ?? []).length).toBe(10);
      expect(html).toContain(`소리의 크기 ${level}눈금`);
    }
    expect(filledCells(7.2)).toBe(7);
    expect(filledCells(99)).toBe(10);
    expect(filledCells(-1)).toBe(0);
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건(24가지) × 실행 전·여러 시각의 눈으로 보기·소음계 보기 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const list: [SoundVibrationSample | null, boolean][] = [[null, false], ...TIMES.map((t) => [at(v, t), true] as [SoundVibrationSample, boolean])];
      for (const [snap, ran] of list) {
        for (const html of [macro(v, snap, ran), meter(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...soundVibrationModule.resultColumns(experiment).map((c) => c.label),
      ...soundVibrationModule.sensors(null, base).map((s) => s.label),
      soundVibrationModule.graph.yLabel,
      soundVibrationModule.graph.xLabel!,
      ...CONDITIONS.map((v) => soundLine(v as never)),
    ];
    for (const t of shown) expect(guardOutput(t, guard).ok, t).toBe(true);
  });

  it('질문(probe) 문장은 모두 질문형이고, 모든 probe × 모든 변인 이름 치환으로도 가드를 통과한다', () => {
    const labels = experiment.variables.map((v) => v.label);
    for (const probe of experiment.tutor.probes) {
      expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
      for (const f of experiment.tutor.forbiddenAnswers) expect(probe.text, probe.text).not.toContain(f);
      for (const iv of labels) {
        for (const changed of [...labels.map((l) => [l]), labels]) {
          const text = probe.text.replaceAll('{iv}', iv).replaceAll('{changed}', changed.join(', '));
          expect(guardOutput(text, guard).ok, text).toBe(true);
        }
      }
    }
  });

  it('금지 구절은 활용형까지 막는다 (규칙 위반 응답은 모두 걸린다)', () => {
    for (const answer of [
      '소리가 나는 물체는 떨려요',
      '소리가 나는 물체는 떨린답니다',
      '소리가 나는 물체는 모두 떨려요',
      '소리 나는 물체는 떨려요',
      '소리 나는 물체는 모두 떨리고 있어요',
      '소리가 나면 물체가 떨려요',
      '소리가 날 때 물체가 떨려요',
      '소리를 내면 물체가 떨려요',
      '소리를 멈추면 떨림이 멈춰요',
      '소리를 멈추면 떨림이 멈춥니다',
      '소리가 멈추면 떨림이 멈춰요',
      '떨림이 멈추면 소리도 멈춰요',
      '떨림이 멈추면 소리가 안 나요',
      '세게 칠수록 많이 떨려요',
      '세게 칠수록 많이 떨립니다',
      '세게 치면 더 많이 떨려요',
      '떨림이 클수록 소리가 커요',
      '떨림이 클수록 소리가 큽니다',
      '떨림이 크면 소리가 커요',
      '떨림이 커질수록 소리도 커져요',
      '떨림이 크면 소리도 커져요',
      '떨림이 클수록 소리도 커져요',
      '세게 칠수록 떨림이 커져요',
      '좁쌀 색은 관계없어요',
      '좁쌀 색은 상관없습니다',
      '좁쌀 색은 영향이 없어요',
      '좁쌀 색과 관계없이 같아요',
      '좁쌀 색이 달라도 같아요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    for (const ok of ['소리 내기만 바꾸었을 때 좁쌀은 어떻게 되었나요?', '손을 대 보면 어떤 모습이 보이나요?', '좁쌀 색만 바꾸었을 때 결과가 달라졌나요?', '물체마다 좁쌀이 튄 높이를 견주어 볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
