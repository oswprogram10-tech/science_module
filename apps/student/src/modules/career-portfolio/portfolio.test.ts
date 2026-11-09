import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseManifest, portfolioUnitWarnings, type PortfolioExperiment } from '@sci/schema';
import { renderAndGuard } from '@sci/tutor';
import careerJson from '../../../../../content/units/g6-career/manifest.json';
import type { LogEntry } from '../../logbook/logbook';
import { JOB_ICON_KEYS } from './JobIcons';
import { PortfolioLab } from './PortfolioLab';
import { MAX_AREAS, dayText, doneSkillsOf, splitJobs, summarizeRecords, toggleArea } from './portfolioModel';
import { portfolioModule } from './index';
import { UNITS } from '../../units';

const exp = parseManifest(careerJson).experiments[0] as PortfolioExperiment;
const day = '2026-11-05';

const entries: LogEntry[] = [
  { unitId: 'g5-solution', kind: 'variable', day, summary: { trials: 5, fair: 3, fairKeys: ['temp'], predicted: 4, matched: 1 } },
  { unitId: 'g6-acid-base', kind: 'classify', day: '2026-11-04', summary: { completed: true } },
  { unitId: 'g3-animal', kind: 'card-sort', day, summary: { criteriaDone: 2, finished: true } },
  { unitId: 'g6-earth-motion', kind: 'observation', day, summary: { recorded: ['a', 'b', 'c'], matched: ['a'] } },
  { unitId: 'g5-solution', kind: 'variable', day: '2026-11-06', summary: { trials: 1, fair: 0, fairKeys: [], predicted: 0, matched: 0 } },
  { unitId: 'g6-career', kind: 'portfolio', day, summary: { jobKey: 'vet', jobText: '', skills: [], more: '' } },
];

describe('진로 모듈', () => {
  it('validate는 검사기를 쓴다', () => {
    expect(portfolioModule.kind).toBe('career-portfolio');
    expect(portfolioModule.validate(exp)).toEqual([]);
  });
  it('직업 카드마다 도구 아이콘이 있다', () => {
    for (const j of exp.jobs) expect(JOB_ICON_KEYS, j.key).toContain(j.icon);
  });
});

describe('단원 배정은 실제 단원과 맞는다(준비 중인 단원이 없다)', () => {
  const dirs = readdirSync(join(__dirname, '../../../../../content/units'));
  const ids = exp.areas.flatMap((a) => a.units);
  it('영역·직업 카드가 가리키는 단원 id가 모두 content/units에 있고 앱에 로드된다', () => {
    for (const id of [...ids, ...exp.jobs.flatMap((j) => j.units)]) expect(dirs, id).toContain(id);
    const loaded = UNITS.filter((u) => u.ok).map((u) => u.id);
    for (const id of ids) expect(loaded, id).toContain(id);
    expect(portfolioUnitWarnings(exp, loaded)).toEqual([]);
  });
  it('content/units의 모든 단원(진로 단원 제외)이 어느 영역에 있다', () => {
    expect(dirs.filter((d) => d !== 'g6-career').sort()).toEqual([...ids].sort());
  });
});

describe('기록 요약', () => {
  const s = summarizeRecords(entries, exp);
  it('영역별로 기록이 있는 단원과 가장 최근 날짜', () => {
    const by = Object.fromEntries(s.areas.map((a) => [a.key, a.units]));
    expect(by['matter']).toEqual([
      { unitId: 'g5-solution', day: '2026-11-06' },
      { unitId: 'g6-acid-base', day: '2026-11-04' },
    ]);
    expect(by['life']).toEqual([{ unitId: 'g3-animal', day }]);
    expect(by['earth']).toEqual([{ unitId: 'g6-earth-motion', day }]);
    expect(by['energy']).toEqual([]);
    expect(by['society']).toEqual([]);
  });
  it('탐구 능력별 해 본 횟수(예측은 맞힌 수가 아니라 예측한 수)', () => {
    expect(s.skills).toEqual({ 'fair-test': 3, predict: 4, classify: 3, observe: 3, model: 6 });
  });
  it('기록이 많은 영역은 참고 표시용으로만 돌려준다', () => {
    expect(s.hintAreas).toEqual(['matter']);
    expect(s.hasRecords).toBe(true);
  });
  it('진로 카드만 있거나 비어 있으면 기록이 없는 것이다', () => {
    const none = summarizeRecords(entries.filter((e) => e.kind === 'portfolio'), exp);
    expect(none.hasRecords).toBe(false);
    expect(none.hintAreas).toEqual([]);
    expect(Object.values(none.skills).every((n) => n === 0)).toBe(true);
    expect(summarizeRecords([], exp).hasRecords).toBe(false);
  });
  it('영역이 같은 개수면 모두 표시한다', () => {
    const tie = summarizeRecords(entries.slice(0, 3), exp);
    expect(tie.hintAreas).toEqual(['matter']);
    const t2 = summarizeRecords([entries[0]!, entries[2]!], exp);
    expect(t2.hintAreas).toEqual(['matter', 'life']);
  });
  it('내가 해 본 탐구 능력 = 직업의 능력과 기록의 교집합', () => {
    const vet = exp.jobs.find((j) => j.key === 'vet')!; // observe, classify
    expect(doneSkillsOf(vet, s.skills)).toEqual(['observe', 'classify']);
    expect(doneSkillsOf(vet, { ...s.skills, observe: 0 })).toEqual(['classify']);
    expect(doneSkillsOf(vet, summarizeRecords([], exp).skills)).toEqual([]);
  });
});

describe('영역 고르기와 카드 순서', () => {
  it('최대 2개, 다시 누르면 뺀다, 처음에는 아무것도 고르지 않는다', () => {
    expect(toggleArea([], 'life')).toEqual(['life']);
    expect(toggleArea(['life'], 'earth')).toEqual(['life', 'earth']);
    expect(toggleArea(['life', 'earth'], 'matter')).toEqual(['life', 'earth']);
    expect(toggleArea(['life', 'earth'], 'life')).toEqual(['earth']);
    expect(MAX_AREAS).toBe(2);
  });
  it('고른 영역의 카드를 먼저, 나머지는 따로', () => {
    const r = splitJobs(exp.jobs, ['earth']);
    expect(r.first.map((j) => j.area)).toEqual(['earth', 'earth', 'earth']);
    expect(r.others).toHaveLength(12);
    const none = splitJobs(exp.jobs, []);
    expect(none.first).toHaveLength(15);
    expect(none.others).toEqual([]);
  });
  it('날짜 표시', () => {
    expect(dayText('2026-11-05')).toBe('11월 5일');
    expect(dayText('x')).toBe('x');
  });
});

describe('튜터 질문은 출력 가드를 거친다', () => {
  const guard = { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits };
  it('단계마다 매니페스트의 질문이 나온다', () => {
    for (const p of exp.tutor.probes) expect(renderAndGuard(p.when, {}, exp.tutor.probes, guard)).toBe(p.text);
  });
  it('가드에 걸리는 문장은 대체 문장으로 바뀐다', () => {
    const out = renderAndGuard('stage-1', {}, exp.tutor.probes, { forbiddenAnswers: ['재미있었나요'], limits: [] });
    expect(out).not.toContain('재미있었나요');
  });
});

describe('화면(처음 상태, 기록장 꺼짐)', () => {
  const titles = { 'g5-solution': '용해와 용액', 'g6-acid-base': '산과 염기' };
  const html = renderToStaticMarkup(createElement(PortfolioLab, { unitId: 'g6-career', title: '과학과 나의 진로', experiment: exp, unitTitles: titles }));

  it('"기록이 없어요"를 보여 주고 영역별 기록 목록은 그리지 않는다', () => {
    expect(html).toContain('기록이 없어요');
    expect(html).not.toContain('area-record');
    expect(html).not.toContain('skill-bars');
  });
  it('네 단계 이름이 있고 현재 단계는 1이다', () => {
    for (const t of ['내 탐구 기록', '관심 영역 고르기', '직업 카드', '나의 진로 탐색 카드']) expect(html).toContain(t);
    expect(html).toContain('aria-current="step"');
  });
  it('비교·순위 문구를 쓰지 않는다', () => {
    for (const w of ['순위', '등수', '1등', '최고', '가장 잘', '제일', '우수', '부족', '잘하는', '못하는']) expect(html, w).not.toContain(w);
  });
  it('튜터 1단계 질문이 보인다', () => {
    expect(html).toContain('어떤 탐구를 할 때 가장 재미있었나요?');
  });
});
