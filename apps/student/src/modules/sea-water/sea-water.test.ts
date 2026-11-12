import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guardOutput } from '@sci/tutor';
import { observedOutcome } from '@sci/gateway';
import { simulateSeaWater, type SeaWaterSample } from '@sci/engine-earth';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { seaWaterModule } from './index';
import { DISH_TEXT, WATER_TEXT, seaWaterNote, startSample } from './initial';
import { DISH_BOTTOM, SeaWaterMacroView, crystalSlots, dishFloorY, waterHeight } from './SeaWaterMacroView';
import { FLYING_DOTS, SALT_DOTS, SeaWaterParticleView, WATER_DOTS, waterDotCount } from './SeaWaterParticleView';

const unit = UNITS.find((u) => u.id === 'g3-earth-sea')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g3-earth-sea가 없어요');
const experiment = unit.experiment;
type V = { water: string; volumeMl: number; dish: string };
const base: V = { water: 'river', volumeMl: 50, dish: 'round' };
const CONDITIONS: V[] = (['river', 'sea'] as const).flatMap((water) => [50, 100].flatMap((volumeMl) => (['round', 'square'] as const).map((dish) => ({ water, volumeMl, dish }))));
const sim = (v: V) => simulateSeaWater(v as never);
const at = (v: V, t: number): SeaWaterSample => sim(v).samples.find((s) => Math.abs(s.t - t) < 1e-9)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: SeaWaterSample | null, ran = true) =>
  renderToStaticMarkup(createElement(SeaWaterMacroView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const micro = (v: V, snapshot: SeaWaterSample | null, ran = true) =>
  renderToStaticMarkup(createElement(SeaWaterParticleView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
/** 화면에 보이는 글자: 태그 밖의 글과 aria-label 값 */
const shownText = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n'), ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!)].map((t) => t.trim()).filter(Boolean);

describe('레지스트리', () => {
  it('g3-earth-sea는 sea-water 모듈로 로드된다', () => {
    expect([unit.manifest.title, unit.manifest.grade, unit.manifest.engine, unit.manifest.standards]).toEqual(['지구와 바다', 3, 'earth', ['4과06-01', '4과06-02', '4과06-03']]);
    // 활동 2(밀물과 썰물 관찰하기)는 관찰 모듈이다. unit.module은 첫 활동의 모듈이다.
    expect(unit.activities.map((a) => [a.activity, a.experiment.id])).toEqual([['variable', 'sea-water'], ['observe', 'tide'], ['variable', 'land-sea-dots']]);
    expect(unit.module).toBe(seaWaterModule);
    expect(MODULES['sea-water'].kind).toBe('sea-water');
    expect(experiment.id).toBe('sea-water');
    expect(experiment.safety).toEqual(['heat', 'taste']);
    expect(experiment.safetyChecklist).toEqual(['보안경을 썼어요.', '가열하는 증발 접시는 맨손으로 만지지 않아요.', '알코올램프 주변에 종이를 두지 않았어요.']);
  });

  it('매니페스트의 문구와 변인이 사양과 같다', () => {
    expect([experiment.title, experiment.question, experiment.predictionPrompt]).toEqual([
      '바닷물과 강물 비교하기',
      '바닷물과 강물을 증발시키면 남는 것이 어떻게 다를까?',
      '예측: 물을 모두 증발시킨 뒤 접시에 남는 하얀 가루의 양은?',
    ]);
    expect(experiment.variables.map((v) => [v.key, v.label, v.default])).toEqual([
      ['water', '물의 종류', 'river'],
      ['volumeMl', '증발 접시에 붓는 물의 양', 50],
      ['dish', '증발 접시 모양', 'round'],
    ]);
    expect(experiment.variables.map((v) => v.options.map((o) => [o.value, o.label]))).toEqual([
      [['river', '강물'], ['sea', '바닷물']],
      [[50, '50 mL'], [100, '100 mL']],
      [['round', '둥근 접시'], ['square', '네모난 접시']],
    ]);
    expect(experiment.dependent.map((d) => [d.key, d.label, d.unit])).toEqual([['residue', '남은 하얀 가루', 'g'], ['dryMin', '물이 다 마른 시간', '분']]);
    expect(experiment.limits).toEqual(['염분', '염화 나트륨', '용질', '용매', '농도', '밀도', '퍼밀']);
    expect(experiment.params).toEqual({ totalMin: 20 });
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 사양 기준값 4줄(소수 첫째 자리 g, 정수 분)과 접시 모양 무영향', () => {
    const cols = seaWaterModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['남은 하얀 가루(g)', '물이 다 마른 시간(분)']);
    const row = (water: string, volumeMl: number, dish = 'round') => cols.map((c) => c.value(sim({ water, volumeMl, dish }).result));
    for (const dish of ['round', 'square']) {
      expect(row('river', 50, dish)).toEqual(['0.0', '10']);
      expect(row('river', 100, dish)).toEqual(['0.0', '20']);
      expect(row('sea', 50, dish)).toEqual(['1.8', '10']);
      expect(row('sea', 100, dish)).toEqual(['3.6', '20']);
    }
  });

  it('센서: 가상 전자저울: 접시 위 가루(scale, g) 하나, 받침 100 g을 빼서 가루의 무게를 보여 준다', () => {
    const specs = seaWaterModule.sensors(null, base);
    expect(specs.map((s) => [s.label, s.kind, s.unit])).toEqual([['가상 전자저울: 접시 위 가루', 'scale', 'g']]);
    expect(specs[0]!.source + 100).toBe(0);
    const sea = { ...base, water: 'sea' };
    expect(seaWaterModule.sensors(at(sea, 20), sea)[0]!.source + 100).toBeCloseTo(1.79375, 5);
    expect(seaWaterModule.sensors(at(sea, 5), sea)[0]!.source + 100).toBe(0);
  });

  it('그래프 설정: 접시에 남은 물 0~100 고정(0, 25, 50, 75, 100), x 0~20분(0, 5, 10, 15, 20), 선 하나', () => {
    const g = seaWaterModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks, g.series, g.markers]).toEqual(['접시에 남은 물(mL)', undefined, [0, 25, 50, 75, 100], '시간(분)', [0, 5, 10, 15, 20], undefined, undefined]);
    expect(seaWaterModule.restPlayhead).toBe(20);
    expect(seaWaterModule.metric.sampleKey).toBe('dishWaterMl');
    expect(seaWaterModule.metric.resultKey).toBe('residue');
    for (const v of CONDITIONS) expect(Math.max(...sim(v).samples.map((s) => s.dishWaterMl))).toBeLessThanOrEqual(100);
  });

  it('예측 비교는 남은 하얀 가루(g): 강물 → 바닷물은 늘어남, 100 mL는 늘어남, 접시 모양과 강물의 양은 변하지 않음(기준 0.1 g)', () => {
    const m = seaWaterModule.metric;
    const residue = (v: V) => sim(v).result[m.resultKey as 'residue'];
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.1);
    expect(observedOutcome(residue(base), residue({ ...base, water: 'sea' }), th)).toBe('increase');
    expect(observedOutcome(residue({ ...base, water: 'sea' }), residue(base), th)).toBe('decrease');
    expect(observedOutcome(residue({ ...base, water: 'sea' }), residue({ ...base, water: 'sea', volumeMl: 100 }), th)).toBe('increase');
    expect(observedOutcome(residue(base), residue({ ...base, dish: 'square' }), th)).toBe('same');
    expect(observedOutcome(residue({ ...base, water: 'sea' }), residue({ ...base, water: 'sea', dish: 'square' }), th)).toBe('same');
    expect(observedOutcome(residue(base), residue({ ...base, volumeMl: 100 }), th)).toBe('same');
  });

  it('그래프가 그려지고 y축 라벨과 x축 라벨이 있다', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: seaWaterModule as never, experiment, trial: trialOf(base), prev: undefined, playhead: 20, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('접시에 남은 물(mL)');
    expect(html).toContain('시간(분)');
  });
});

describe('눈으로 보기', () => {
  it('문구: "{t}분 · 접시에 남은 물 {mL} mL · 접시 위 가루 {g} g"', () => {
    const sea = { ...base, water: 'sea' };
    expect(macro(sea, at(sea, 12))).toContain(seaWaterNote(at(sea, 12)));
    expect(seaWaterNote(at(sea, 20))).toBe('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 1.8 g');
    expect(seaWaterNote(at(sea, 5))).toBe('5.0분 · 접시에 남은 물 25 mL · 접시 위 가루 0.0 g');
    expect(seaWaterNote(at({ ...sea, volumeMl: 100 }, 20))).toBe('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 3.6 g');
    expect(seaWaterNote(at(base, 20))).toBe('20.0분 · 접시에 남은 물 0 mL · 접시 위 가루 0.0 g');
  });

  it('실행 전에는 조건과 상관없이 결과 그림이 없다: 결정·마른 접시·불꽃·김이 없고 문구에 숫자가 없다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, null, false);
      expect(count(html, 'dish-crystal'), JSON.stringify(v)).toBe(0);
      expect(count(html, 'dish-film')).toBe(0);
      expect(count(html, 'flame')).toBe(0);
      expect(count(html, 'steam')).toBe(0);
      expect(html).toContain('data-dry="false"');
      expect(html).toContain('data-heating="false"');
      expect(html).not.toContain('접시 위 가루');
      expect(html).toContain('실험하면');
      // 물은 처음 양만큼 담겨 있다
      expect(count(html, 'dish-water')).toBe(1);
    }
  });

  it('바닷물이 다 마르면 결정이 남는다: 50 mL 14개, 100 mL 29개, 강물은 결정 없이 얇은 자국만', () => {
    expect(count(macro({ ...base, water: 'sea' }, at({ ...base, water: 'sea' }, 20)), 'dish-crystal')).toBe(14);
    expect(count(macro({ ...base, water: 'sea', volumeMl: 100 }, at({ ...base, water: 'sea', volumeMl: 100 }, 20)), 'dish-crystal')).toBe(29);
    const river = macro(base, at(base, 20));
    expect(count(river, 'dish-crystal')).toBe(0);
    expect(count(river, 'dish-film')).toBe(1);
    expect(river).toContain('data-dry="true"');
    expect(count(river, 'dish-water')).toBe(0);
  });

  it('50 mL는 10분에 다 마르고, 그 전에는 결정이 없다', () => {
    const sea = { ...base, water: 'sea' };
    expect(count(macro(sea, at(sea, 9.9)), 'dish-crystal')).toBe(0);
    expect(count(macro(sea, at(sea, 9.9)), 'dish-water')).toBe(1);
    expect(count(macro(sea, at(sea, 10)), 'dish-crystal')).toBe(14);
    expect(count(macro(sea, at(sea, 10)), 'dish-water')).toBe(0);
    // 100 mL는 10분에 아직 물이 반 남아 있다
    const big = { ...sea, volumeMl: 100 };
    expect(count(macro(big, at(big, 10)), 'dish-crystal')).toBe(0);
    expect(count(macro(big, at(big, 10)), 'dish-water')).toBe(1);
  });

  it('가열 중에는 불꽃과 김이 있고, 다 마르면 둘 다 없다', () => {
    const sea = { ...base, water: 'sea' };
    expect(count(macro(sea, at(sea, 5)), 'flame')).toBe(1);
    expect(count(macro(sea, at(sea, 5)), 'steam')).toBe(1);
    expect(count(macro(sea, at(sea, 20)), 'flame')).toBe(0);
    expect(count(macro(sea, at(sea, 20)), 'steam')).toBe(0);
  });

  it('남은 물 높이: 물이 많을수록 높고, 시간이 지나면 낮아진다', () => {
    const h = (v: V, t: number) => Number(/y="[\d.]+" width="160" height="([\d.]+)" fill="#8ec9ee"/.exec(macro(v, at(v, t)))![1]) - 2;
    expect(h({ ...base, volumeMl: 100 }, 0)).toBeGreaterThan(h(base, 0));
    expect(h(base, 5)).toBeLessThan(h(base, 0));
    expect(waterHeight('round', 100)).toBeGreaterThan(waterHeight('round', 50));
    expect(waterHeight('round', 0)).toBe(0);
  });

  it('접시 모양 그림만 달라지고 결과 그림(결정 수·물 높이 기준)은 같다', () => {
    for (const water of ['river', 'sea']) {
      const a = { ...base, water };
      const b = { ...a, dish: 'square' };
      expect(count(macro(b, at(b, 20)), 'dish-crystal')).toBe(count(macro(a, at(a, 20)), 'dish-crystal'));
      expect(macro(b, at(b, 20))).toContain('data-dish="square"');
      expect(macro(a, at(a, 20))).toContain('data-dish="round"');
      expect(macro(a, null, false)).not.toBe(macro(b, null, false));
    }
    expect(macro({ ...base, dish: 'square' }, null, false)).toContain(DISH_TEXT.square);
  });

  it('결정 자리는 접시 안(바닥 위, 가장자리 아래)에 있고 서로 겹치지 않는다', () => {
    for (const kind of ['round', 'square'] as const) {
      const slots = crystalSlots(kind, 29);
      expect(new Set(slots.map((q) => `${q.x}/${q.y}`)).size).toBe(29);
      for (const q of slots) {
        expect(q.y + 3).toBeLessThanOrEqual(dishFloorY(kind, q.x));
        expect(q.y - 3).toBeGreaterThan(74);
      }
    }
  });

  it('알코올램프는 접시 바로 아래 가운데에 있고 삼발이(선)가 접시를 받친다. 불꽃은 가열하는 동안에만 램프 위, 접시 아래에 있다', () => {
    const num = (html: string, id: string, name: string) => Number(new RegExp(`data-testid="${id}"[^>]*?\\s${name}="([\\d.]+)"|${name}="([\\d.]+)"[^>]*?data-testid="${id}"`).exec(html)!.slice(1).find(Boolean));
    for (const dish of ['round', 'square']) {
      const v = { ...base, water: 'sea', dish };
      const html = macro(v, at(v, 5));
      expect(count(html, 'lamp-stand'), dish).toBe(1);
      expect(html.match(/data-testid="lamp-stand"[\s\S]*?<\/g>/)![0].match(/<line /g)).toHaveLength(4);
      // 램프 몸체는 접시(가운데 x=120)와 같은 가운데에 있고, 접시보다 아래에 있다.
      const x = num(html, 'lamp-body', 'x');
      const w = num(html, 'lamp-body', 'width');
      expect(x + w / 2, dish).toBe(120);
      expect(num(html, 'lamp-body', 'y')).toBeGreaterThan(DISH_BOTTOM[dish as 'round' | 'square']);
      // 불꽃은 접시 바닥보다 아래, 램프 몸체보다 위
      const cy = num(html, 'flame', 'cy');
      expect(cy).toBeGreaterThan(DISH_BOTTOM[dish as 'round' | 'square']);
      expect(cy + 8).toBeLessThanOrEqual(num(html, 'lamp-body', 'y') + 2);
      expect(count(macro(v, at(v, 20)), 'flame'), dish).toBe(0);
      expect(count(macro(v, at(v, 20)), 'lamp-stand'), dish).toBe(1);
    }
  });

  it('조건 라벨: 물의 종류와 양, 접시 모양', () => {
    const html = macro({ water: 'sea', volumeMl: 100, dish: 'square' }, null, false);
    expect(html).toContain(`${WATER_TEXT.sea} 100 mL`);
    expect(html).toContain(DISH_TEXT.square);
    expect(html).toContain('알코올램프');
  });

  it('startSample은 t = 0', () => {
    expect(startSample(base, experiment).t).toBe(0);
  });
});

describe('알갱이 보기', () => {
  it('범례: 물 알갱이, 소금 알갱이가 한 번씩 있다(실행 전에도)', () => {
    for (const ran of [false, true]) {
      const html = micro({ ...base, water: 'sea' }, ran ? at({ ...base, water: 'sea' }, 20) : null, ran);
      for (const label of ['물 알갱이', '소금 알갱이']) {
        expect(html.match(new RegExp(`>${label}</text>`, 'g')), label).toHaveLength(1);
      }
    }
  });

  it('실행 전에는 조건과 상관없이 물 알갱이만 그리고 소금 알갱이·날아가는 알갱이는 없다', () => {
    for (const v of CONDITIONS) {
      const html = micro(v, null, false);
      expect(count(html, 'water-dot')).toBe(WATER_DOTS);
      expect(count(html, 'salt-dot')).toBe(0);
      expect(count(html, 'flying-dot')).toBe(0);
      expect(html).toContain('실험하면');
    }
  });

  it('바닷물이 다 마르면 물 알갱이는 없고 소금 알갱이가 남는다', () => {
    const sea = { ...base, water: 'sea' };
    const end = micro(sea, at(sea, 20));
    expect(count(end, 'water-dot')).toBe(0);
    expect(count(end, 'salt-dot')).toBe(SALT_DOTS.sea);
    expect(count(end, 'flying-dot')).toBe(0);
    expect(end).toContain('물 알갱이는 날아가고, 소금 알갱이는 접시에 남아요.');
    // 증발하는 동안: 물 알갱이가 줄고 소금 알갱이는 그대로, 물 알갱이만 날아간다
    const mid = micro(sea, at(sea, 5));
    expect(count(mid, 'water-dot')).toBe(waterDotCount(25, 50));
    expect(count(mid, 'water-dot')).toBeLessThan(WATER_DOTS);
    expect(count(mid, 'salt-dot')).toBe(SALT_DOTS.sea);
    expect(count(mid, 'flying-dot')).toBe(FLYING_DOTS);
    expect(count(micro(sea, at(sea, 0)), 'flying-dot')).toBe(0);
  });

  it('강물은 소금 알갱이가 아주 적게(1개) 남는다', () => {
    const end = micro(base, at(base, 20));
    expect(count(end, 'salt-dot')).toBe(SALT_DOTS.river);
    expect(SALT_DOTS.river).toBeLessThan(SALT_DOTS.sea);
    expect(count(end, 'water-dot')).toBe(0);
  });

  it('물 알갱이 수는 남은 물의 비율을 따른다 (50 mL 25 mL 남음 → 15개, 100 mL 50 mL 남음 → 15개)', () => {
    expect(waterDotCount(50, 50)).toBe(30);
    expect(waterDotCount(25, 50)).toBe(15);
    expect(waterDotCount(50, 100)).toBe(15);
    expect(waterDotCount(0, 100)).toBe(0);
  });

  it('접시 모양은 알갱이 그림을 바꾸지 않는다', () => {
    for (const water of ['river', 'sea']) {
      const a = { ...base, water };
      expect(micro({ ...a, dish: 'square' }, at(a, 20))).toBe(micro(a, at(a, 20)));
    }
  });
});

describe('화면 글자 가드 (쓰지 않는 말·한계 용어)', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };

  it('모든 조건 × 여러 시각 × 실행 전·후의 눈으로 보기·알갱이 보기 글자는 금지 구절·한계 용어와 겹치지 않는다', () => {
    let n = 0;
    for (const v of CONDITIONS) {
      const frames: [SeaWaterSample | null, boolean][] = [[null, false], ...[0, 2.5, 5, 9.9, 10, 15, 20].map((t) => [at(v, t), true] as [SeaWaterSample, boolean])];
      for (const [snap, ran] of frames) {
        for (const html of [macro(v, snap, ran), micro(v, snap, ran)]) {
          for (const shown of shownText(html)) {
            expect(guardOutput(shown, guard), shown).toEqual({ ok: true, hits: [] });
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(500);
  });

  it('제목·질문·예측 문구·변인·선택지·결과 열·안전 문구·센서·그래프 라벨은 금지 구절·한계 용어와 겹치지 않는다', () => {
    const shown = [
      experiment.title,
      experiment.question,
      experiment.predictionPrompt,
      ...experiment.variables.flatMap((v) => [v.label, v.unit ?? '', ...v.options.map((o) => o.label)]),
      ...experiment.dependent.flatMap((d) => [d.label, d.unit ?? '']),
      ...(experiment.safetyChecklist ?? []),
      ...Object.values(experiment.safetyMessages ?? {}),
      ...seaWaterModule.resultColumns(experiment).map((c) => c.label),
      ...seaWaterModule.sensors(null, base).map((s) => s.label),
      seaWaterModule.graph.yLabel,
      seaWaterModule.graph.xLabel!,
      '⚠ 증발 접시와 알코올램프는 아주 뜨거워요. 선생님과 함께 다뤄요.',
      '⚠ 실험에 쓰는 바닷물은 맛보지 않아요.',
    ];
    for (const t of shown) expect(guardOutput(t, guard).ok, t).toBe(true);
  });

  it('질문(probe) 문장은 금지 구절·한계 용어와 겹치지 않고 모두 질문형이다', () => {
    for (const probe of experiment.tutor.probes) {
      expect(guardOutput(probe.text, guard).ok, probe.text).toBe(true);
      expect(probe.text.trim().endsWith('?'), probe.text).toBe(true);
    }
  });

  it('금지 구절은 활용형까지 막는다 (규칙 위반 응답은 모두 걸린다)', () => {
    for (const answer of [
      '바닷물에는 소금이 녹아 있어요',
      '바닷물에는 소금이 녹아 있답니다',
      '바닷물에는 소금이 들어 있어요',
      '바닷물에는 소금이 들어 있습니다',
      '바닷물에 소금이 녹아 있지요',
      '바닷물에 소금이 녹아서 짠 거예요',
      '바닷물을 증발시키면 소금이 남아요',
      '바닷물을 증발시키면 소금이 남습니다',
      '바닷물은 하얀 가루가 남아요',
      '바닷물은 하얀 가루가 남는 물이에요',
      '강물에는 소금이 거의 없어요',
      '강물에는 소금이 거의 없답니다',
      '강물은 아무것도 남지 않아요',
      '강물은 아무것도 남지 않았어요',
      '물이 많을수록 가루가 많이 남아요',
      '물이 많을수록 가루가 많이 나와요',
      '물을 많이 부을수록 가루가 늘어요',
      '물을 많이 부을수록 많아져요',
      '접시 모양은 관계없어요',
      '접시 모양은 관계없답니다',
      '접시 모양은 상관없어요',
      '접시 모양은 상관없습니다',
      '접시 모양은 영향이 없어요',
      '접시 모양은 영향이 없다고 해요',
      '접시 모양은 결과에 영향을 주지 않아요',
      '접시 모양과 관계없이 같아요',
      '접시 모양이 달라도 같아요',
      '바닷물 속에는 소금이 있어요',
    ]) {
      expect(guardOutput(answer, guard).ok, answer).toBe(false);
    }
    for (const l of experiment.limits) expect(guardOutput(`${l}이에요`, guard).ok, l).toBe(false);
    // 규칙에 걸리지 않는 질문은 막지 않는다 (오검출 없음)
    for (const ok of ['물의 종류만 바꾸었을 때 접시에 남은 것은 무엇이 달랐나요?', '접시 모양만 바꾸었을 때 결과가 달라졌나요?', '바닷물과 강물을 비교해 볼까요?']) {
      expect(guardOutput(ok, guard).ok, ok).toBe(true);
    }
  });
});
