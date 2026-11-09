import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { observedOutcome } from '@sci/gateway';
import { chancePerContact, headcount, simulateSpread, type SpreadSample } from '@sci/engine-ssi';
import { GraphView } from '../../components/GraphView';
import { UNITS } from '../../units';
import { MODULES } from '../index';
import { infectionSpreadModule } from './index';
import { CONTACT_NOTE, DISCLAIMER, ORIGIN_SEAT, START_SAMPLE, infectionOrder, seatStates, spreadNote } from './initial';
import { ClassroomView } from './ClassroomView';
import { ContactView, NEUTRAL_WIDTH, lineWidth } from './ContactView';

const unit = UNITS.find((u) => u.id === 'g3-health')!;
if (!unit.ok || unit.activity !== 'variable') throw new Error('g3-health가 없어요');
const experiment = unit.experiment;
type V = { wash: string; mask: string; contacts: number; seat: string };
const base: V = { wash: 'rarely', mask: 'off', contacts: 4, seat: 'front' };
const sim = (v: V) => simulateSpread(v as never);
const at = (v: V, t: number): SpreadSample => sim(v).samples.find((s) => s.t === t)!;
const trialOf = (v: V) => ({ samples: sim(v).samples, result: sim(v).result, values: v }) as never;
const macro = (v: V, snapshot: SpreadSample | null, ran = true) =>
  renderToStaticMarkup(createElement(ClassroomView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot, values: v, playhead: 0 }));
const contact = (v: V, ran = true) =>
  renderToStaticMarkup(createElement(ContactView, { experiment, trial: ran ? trialOf(v) : undefined, snapshot: null, values: v, playhead: 0 }));
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, 'g')) ?? []).length;
const widths = (html: string) => [...html.matchAll(/data-testid="contact-line" data-width="([^"]*)"/g)].map((m) => Number(m[1]));
const stateOfSeats = (html: string) => [...html.matchAll(/data-testid="seat" data-state="([^"]*)"/g)].map((m) => m[1]!);

const CONDITIONS: V[] = [4, 8].flatMap((contacts) => ['rarely', 'often'].flatMap((wash) => ['off', 'on'].flatMap((mask) => ['front', 'back'].map((seat) => ({ wash, mask, contacts, seat })))));

describe('레지스트리', () => {
  it('g3-health는 infection-spread 모듈로 로드된다', () => {
    expect(unit.manifest.grade).toBe(3);
    expect(unit.manifest.engine).toBe('ssi');
    expect(unit.module).toBe(infectionSpreadModule);
    expect(MODULES['infection-spread'].kind).toBe('infection-spread');
    expect(experiment.safety).toEqual([]);
    expect(experiment.safetyChecklist).toBeUndefined();
  });
});

describe('결과 열·센서·그래프·예측 기준', () => {
  it('결과 열: 감염된 사람, 가장 많이 아팠던 날의 아픈 사람', () => {
    const cols = infectionSpreadModule.resultColumns(experiment);
    expect(cols.map((c) => c.label)).toEqual(['20일 동안 감염된 사람(명)', '가장 많이 아팠던 날의 아픈 사람(명)']);
    expect(cols.map((c) => c.value(sim(base).result))).toEqual(['12', '3']);
    expect(cols.map((c) => c.value(sim({ ...base, contacts: 8 }).result))).toEqual(['28', '10']);
  });

  it('센서가 없다', () => {
    expect(infectionSpreadModule.sensors(null, base)).toEqual([]);
    expect(infectionSpreadModule.sensors(at(base, 20), base)).toEqual([]);
  });

  it('그래프 설정: 두 선(아픈 사람 실선·감염된 사람 점선), y 0~30 고정(5 간격), x 0~20일', () => {
    const g = infectionSpreadModule.graph;
    expect([g.yLabel, g.yMin, g.yTicks, g.xLabel, g.xTicks]).toEqual(['사람 수(명)', undefined, [0, 5, 10, 15, 20, 25, 30], '날짜(일)', [0, 5, 10, 15, 20]]);
    expect(g.series!.map((x) => [x.key, x.label, x.dash])).toEqual([
      ['sick', '지금 아픈 사람(명)', undefined],
      ['total', '지금까지 감염된 사람(명)', '7 4'],
    ]);
    expect(g.series![0]!.color).not.toBe(g.series![1]!.color);
    expect(g.markers).toBeUndefined();
    expect(infectionSpreadModule.restPlayhead).toBe(20);
  });

  it('두 선과 앞 시행 모두 y 0~30 안에 들어온다', () => {
    for (const v of CONDITIONS) {
      for (const s of sim(v).samples) {
        expect(s.sick).toBeGreaterThanOrEqual(0);
        expect(s.total).toBeLessThanOrEqual(30);
      }
    }
  });

  it('그래프가 그려지고 두 선(점선 포함)·범례, 표식 없음', () => {
    const html = renderToStaticMarkup(createElement(GraphView, { module: infectionSpreadModule as never, experiment, trial: trialOf(base), prev: trialOf({ ...base, contacts: 8 }), playhead: 20, playing: false, onPlayhead: () => {}, describedBy: 'results-table' }));
    expect(html).toContain('사람 수(명)');
    expect(html).toContain('날짜(일)');
    expect(count(html, 'graph-series')).toBe(2);
    expect(html).toContain('stroke-dasharray="7 4"');
    expect(count(html, 'graph-legend-item')).toBe(2);
    expect(count(html, 'graph-marker')).toBe(0);
  });

  it('예측 비교: total, 0.5명 안이면 같음(자리), 마스크는 줄어듦, 만남 8명은 늘어남', () => {
    const m = infectionSpreadModule.metric;
    expect([m.sampleKey, m.resultKey]).toEqual(['total', 'total']);
    const th = m.sameThreshold(experiment);
    expect(th).toBe(0.5);
    const total = (v: V) => sim(v).result.total;
    expect(observedOutcome(total(base), total({ ...base, mask: 'on' }), th)).toBe('decrease');
    expect(observedOutcome(total(base), total({ ...base, contacts: 8 }), th)).toBe('increase');
    expect(observedOutcome(total(base), total({ ...base, seat: 'back' }), th)).toBe('same');
  });

  it('모듈은 샘플과 결과만 돌려준다', () => {
    const out = infectionSpreadModule.simulate(base as never, experiment);
    expect(Object.keys(out).sort()).toEqual(['result', 'samples']);
    expect(out.samples).toHaveLength(21);
  });
});

describe('교실 그림', () => {
  it('자리 30개(6×5), 어떤 조건·어느 날에도 건강 + 아픔 + 나음 = 30', () => {
    for (const v of CONDITIONS) {
      for (const t of [0, 1, 3, 7, 10, 14, 20]) {
        const html = macro(v, at(v, t));
        const states = stateOfSeats(html);
        expect(states).toHaveLength(30);
        const c = headcount(at(v, t));
        expect(c.healthy + c.sick + c.recovered).toBe(30);
        for (const k of ['healthy', 'sick', 'recovered'] as const) expect(states.filter((s) => s === k)).toHaveLength(c[k]);
      }
    }
  });

  it('보간된 표본(하루 사이)도 합이 30이다', () => {
    const a = at(base, 3);
    const b = at(base, 4);
    for (const k of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const s = infectionSpreadModule.interpolate(a, b, k);
      const h = headcount(s);
      expect(h.healthy + h.sick + h.recovered).toBe(30);
      expect(stateOfSeats(macro(base, s))).toHaveLength(30);
    }
  });

  it('마지막 날 건강한 사람 수로 센 감염된 사람이 결과표의 값과 같다', () => {
    for (const v of CONDITIONS) {
      expect(30 - headcount(at(v, 20)).healthy).toBe(sim(v).result.total);
    }
  });

  it('문구: "{t}일째 · 지금 아픈 사람 {I}명 · 지금까지 감염 {total}명"', () => {
    expect(spreadNote(START_SAMPLE)).toBe('0일째 · 지금 아픈 사람 1명 · 지금까지 감염 1명');
    expect(spreadNote(at({ ...base, contacts: 8 }, 20))).toBe('20일째 · 지금 아픈 사람 3명 · 지금까지 감염 28명');
    expect(macro(base, at(base, 20))).toContain('20일째 · 지금 아픈 사람');
    const s = at(base, 7);
    const c = headcount(s);
    expect(spreadNote(s)).toBe(`7일째 · 지금 아픈 사람 ${c.sick}명 · 지금까지 감염 ${c.sick + c.recovered}명`);
  });

  it('안내 문구가 실행 전·후 언제나 보인다', () => {
    expect(DISCLAIMER).toBe('이 숫자는 공부를 위해 만든 가상 반의 계산이에요. 실제 병의 예측이 아니에요.');
    expect(macro(base, null, false)).toContain(DISCLAIMER);
    expect(macro(base, at(base, 20))).toContain(DISCLAIMER);
    expect(macro({ ...base, seat: 'back' }, at(base, 5))).toContain(DISCLAIMER);
  });

  it('실행 전에는 처음 상태(아픈 친구 1명)만 보여 결과를 드러내지 않는다', () => {
    for (const v of CONDITIONS) {
      const html = macro(v, at(v, 20), false);
      expect(stateOfSeats(html).filter((s) => s === 'sick')).toHaveLength(1);
      expect(stateOfSeats(html).filter((s) => s === 'recovered')).toHaveLength(0);
      expect(html).toContain('0일째 · 지금 아픈 사람 1명 · 지금까지 감염 1명');
    }
  });

  it('자리 배정은 결정론적이고, 앞줄·뒷줄은 처음 아픈 자리만 바꾼다', () => {
    for (const t of [0, 5, 10, 20]) {
      const f = seatStates(at(base, t), 'front');
      expect(seatStates(at(base, t), 'front')).toEqual(f);
      const b = seatStates(at(base, t), 'back');
      // 두 자리의 감염 순서는 처음 아픈 자리를 뺀 나머지가 같다.
      const rest = (seat: 'front' | 'back') => infectionOrder(seat).slice(1).filter((n) => n !== ORIGIN_SEAT.front && n !== ORIGIN_SEAT.back);
      expect(rest('front')).toEqual(rest('back'));
      expect(f.filter((s) => s === 'sick').length).toBe(b.filter((s) => s === 'sick').length);
    }
    const f0 = seatStates(START_SAMPLE, 'front');
    const b0 = seatStates(START_SAMPLE, 'back');
    expect(f0.indexOf('sick')).toBe(ORIGIN_SEAT.front);
    expect(b0.indexOf('sick')).toBe(ORIGIN_SEAT.back);
    expect(Math.floor(ORIGIN_SEAT.front / 6)).toBe(0);
    expect(Math.floor(ORIGIN_SEAT.back / 6)).toBe(4);
    expect(new Set(infectionOrder('front')).size).toBe(30);
    expect(new Set(infectionOrder('back')).size).toBe(30);
  });

  it('같은 입력은 같은 그림이다', () => {
    expect(macro(base, at(base, 9))).toBe(macro(base, at(base, 9)));
  });

  it('상태는 색 외에 무늬로도 구분한다: 건강 빈 원, 아픔 채운 원 + 점, 나음 원 + 체크', () => {
    const html = macro(base, at(base, 10));
    const c = headcount(at(base, 10));
    expect(count(html, 'pattern-dot')).toBe(c.sick + 1); // 범례 한 개 포함
    expect(count(html, 'pattern-check')).toBe(c.recovered + 1);
    for (const k of ['healthy', 'sick', 'recovered']) expect(count(html, `legend-${k}`)).toBe(1);
    expect(html).toContain('>건강</text>');
    expect(html).toContain('>아픔</text>');
    expect(html).toContain('>나음</text>');
    // 범례의 아픔 아이콘에는 점, 나음 아이콘에는 체크가 있고 건강 아이콘에는 둘 다 없다.
    const legend = (k: string) => html.split('<g data-testid="legend-').find((x) => x.startsWith(k)) ?? '';
    expect(legend('sick')).toContain('pattern-dot');
    expect(legend('recovered')).toContain('pattern-check');
    expect(legend('healthy')).not.toContain('pattern-');
  });

  it('이름이나 얼굴이 없다', () => {
    const html = macro(base, at(base, 10));
    expect(html).not.toMatch(/이름|얼굴|<image|<img/);
  });
});

describe('옮겨 가는 길 보기', () => {
  it('선 개수는 만나는 친구 수이고 라벨 "만남", "손 씻기", "마스크"가 있다', () => {
    for (const contacts of [4, 8]) {
      const html = contact({ ...base, contacts });
      expect(count(html, 'contact-line')).toBe(contacts);
      expect(count(html, 'contact-friend')).toBe(contacts);
      expect(count(html, 'contact-sick')).toBe(1);
      for (const label of ['만남', '손 씻기', '마스크']) expect(html).toContain(`>${label}</text>`);
    }
  });

  it('방패는 지키는 습관에만 선마다 있다', () => {
    expect([count(contact(base), 'shield-wash'), count(contact(base), 'shield-mask')]).toEqual([0, 0]);
    expect([count(contact({ ...base, wash: 'often' }), 'shield-wash'), count(contact({ ...base, wash: 'often' }), 'shield-mask')]).toEqual([4, 0]);
    expect([count(contact({ ...base, mask: 'on', contacts: 8 }), 'shield-wash'), count(contact({ ...base, mask: 'on', contacts: 8 }), 'shield-mask')]).toEqual([0, 8]);
    expect([count(contact({ ...base, wash: 'often', mask: 'on' }), 'shield-wash'), count(contact({ ...base, wash: 'often', mask: 'on' }), 'shield-mask')]).toEqual([4, 4]);
  });

  it('선 굵기는 옮을 확률에 비례한다(시행 뒤)', () => {
    const w = (wash: string, mask: string) => widths(contact({ ...base, wash, mask }))[0]!;
    expect(w('rarely', 'off')).toBeCloseTo(lineWidth(0.08), 2);
    expect(w('often', 'off') / w('rarely', 'off')).toBeCloseTo(0.6, 2);
    expect(w('rarely', 'on') / w('rarely', 'off')).toBeCloseTo(0.5, 2);
    expect(w('often', 'on') / w('rarely', 'off')).toBeCloseTo(0.3, 2);
    expect(w('rarely', 'off')).toBeGreaterThan(w('often', 'on'));
    for (const v of CONDITIONS) expect(widths(contact(v))[0]).toBeCloseTo(lineWidth(chancePerContact(v as never)), 2);
    // 선 굵기는 만나는 친구 수와 무관하다(선 하나가 옮을 확률)
    expect(widths(contact({ ...base, contacts: 8 }))[0]).toBe(widths(contact(base))[0]);
  });

  it('첫 시행 전에는 굵기 차이로 결과를 드러내지 않는다', () => {
    const lines = (v: V) => widths(contact(v, false));
    for (const v of CONDITIONS) expect(new Set(lines(v))).toEqual(new Set([NEUTRAL_WIDTH]));
    expect(lines({ ...base, wash: 'often', mask: 'on' })).toEqual(lines(base));
  });

  it('그림 아래 문구', () => {
    expect(CONTACT_NOTE).toBe('만날 때마다 병이 옮을 수 있는 기회가 생겨요.');
    expect(contact(base, false)).toContain(CONTACT_NOTE);
    expect(contact(base)).toContain(CONTACT_NOTE);
  });
});

describe('화면 글자 가드', () => {
  const guard = { forbiddenAnswers: experiment.tutor.forbiddenAnswers, limits: experiment.limits };
  it('화면에 보이는 글은 쓰지 않는 말·탓하는 표현이 없다', () => {
    const html = [macro(base, at(base, 10)), contact({ ...base, wash: 'often', mask: 'on' })].join(' ').replace(/<[^>]*>/g, ' ');
    expect(html).not.toMatch(/탓|잘못|때문에 아프|옮긴|퍼뜨|감염시/);
    for (const f of [...guard.forbiddenAnswers, ...guard.limits]) expect(html.replace(/[\s\p{P}\p{S}]/gu, '')).not.toContain(f.replace(/[\s\p{P}\p{S}]/gu, ''));
  });
});
