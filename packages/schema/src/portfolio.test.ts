import { describe, expect, it } from 'vitest';
import careerJson from '../../../content/units/g6-career/manifest.json';
import {
  ManifestError,
  PORTFOLIO_BANNED_WORDS,
  isPortfolioExperiment,
  isVariableExperiment,
  parseManifest,
  portfolioUnitWarnings,
  validatePortfolioExperiment,
  type PortfolioExperiment,
} from './index';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const load = (edit?: (e: Record<string, any>) => void): PortfolioExperiment => {
  const raw = clone(careerJson) as any;
  edit?.(raw.experiments[0]);
  return parseManifest(raw).experiments[0] as PortfolioExperiment;
};
const exp = load();

describe('진로 매니페스트', () => {
  it('단원 정보와 활동 유형', () => {
    const m = parseManifest(careerJson);
    expect([m.id, m.title, m.grade, m.engine, m.standards]).toEqual(['g6-career', '과학과 나의 진로', 6, 'ssi', ['6과16-02']]);
    expect(m.experiments).toHaveLength(1);
    expect(isPortfolioExperiment(exp)).toBe(true);
    expect(isVariableExperiment(exp)).toBe(false);
    expect([exp.id, exp.title, exp.question]).toEqual(['career-portfolio', '나의 탐구 기록으로 진로 살펴보기', '내가 해 온 과학 탐구는 어떤 일과 이어질까?']);
  });

  it('영역 5개, 탐구 능력 5개, 직업 카드 15장(영역마다 3장)', () => {
    expect(exp.areas.map((a) => a.key)).toEqual(['matter', 'life', 'earth', 'energy', 'society']);
    expect(exp.areas.map((a) => a.units.length)).toEqual([7, 7, 6, 7, 3]);
    expect(exp.skills.map((s) => s.key)).toEqual(['fair-test', 'predict', 'classify', 'observe', 'model']);
    expect(exp.jobs).toHaveLength(15);
    for (const a of exp.areas) expect(exp.jobs.filter((j) => j.area === a.key)).toHaveLength(3);
    expect(exp.jobs.map((j) => j.label)).toEqual([
      '화학 연구원', '식품 개발자', '신소재 공학자', '수의사', '식물 연구원', '미생물 연구원', '기상 예보관', '지질학자', '천문학자',
      '로봇 공학자', '음향 기술자', '전기 기술자', '역학 조사관', '기후 변화 전문가', '신재생 에너지 기술자',
    ]);
  });

  it('영역 배정은 30개 단원이고 겹치지 않는다(실제 단원 존재 여부는 앱 테스트가 확인)', () => {
    const ids = exp.areas.flatMap((a) => a.units);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(30);
    expect(exp.jobs.flatMap((j) => j.units).every((u) => ids.includes(u))).toBe(true);
  });

  it('검사기를 통과한다', () => {
    expect(validatePortfolioExperiment(exp)).toEqual([]);
  });

  it('직업 카드: 한 문장, 탐구 능력 2~3개, 관련 단원 1~3개, 도구 아이콘', () => {
    for (const j of exp.jobs) {
      expect(j.does.endsWith('.'), j.key).toBe(true);
      expect(j.does.split('.').filter(Boolean), j.key).toHaveLength(1);
      expect(j.does.startsWith('이 일을 하는 사람은'), j.key).toBe(true);
      expect(j.skills.length).toBeGreaterThanOrEqual(2);
      expect(j.skills.length).toBeLessThanOrEqual(3);
      expect(j.units.length).toBeGreaterThanOrEqual(1);
      expect(j.units.length).toBeLessThanOrEqual(3);
      expect(j.icon).not.toMatch(/person|people|man|woman|face|human/);
    }
  });

  it('직업 카드 문장은 성별 중립이다(금지 낱말이 없다)', () => {
    expect(PORTFOLIO_BANNED_WORDS).toEqual(expect.arrayContaining(['그는', '그녀는', '아저씨', '아주머니']));
    const text = JSON.stringify([exp.jobs, exp.areas, exp.skills, exp.prompts, exp.tutor, exp.title, exp.question]);
    for (const w of PORTFOLIO_BANNED_WORDS) expect(text, w).not.toContain(w);
  });

  it('튜터: 4단계 질문, forbiddenAnswers는 빈 배열', () => {
    expect(exp.tutor.forbiddenAnswers).toEqual([]);
    expect(exp.tutor.probes.map((p) => [p.when, p.text])).toEqual([
      ['stage-1', '어떤 탐구를 할 때 가장 재미있었나요?'],
      ['stage-2', '그 영역의 어떤 점이 궁금한가요?'],
      ['stage-3', '이 직업에서 쓰이는 탐구 능력 중 내가 해 본 것은 무엇인가요?'],
      ['stage-4', '더 알아보려면 누구에게, 어디에서 물어볼 수 있을까요?'],
    ]);
  });
});

describe('진로 스키마', () => {
  it('필수 필드가 없으면 거부한다', () => {
    expect(() => load((e) => delete e.areas)).toThrow(ManifestError);
    expect(() => load((e) => delete e.prompts)).toThrow(ManifestError);
    expect(() => load((e) => delete e.jobs[0].does)).toThrow(ManifestError);
    expect(() => load((e) => (e.tutor.probes[0].when = 'stage-9'))).toThrow(ManifestError);
    expect(() => load((e) => (e.jobs = []))).toThrow(ManifestError);
  });
  it('모르는 모듈은 거부한다', () => {
    const raw = clone(careerJson) as any;
    raw.experiments[0].module = 'career-nope';
    expect(() => parseManifest(raw)).toThrow(ManifestError);
  });
});

describe('validatePortfolioExperiment', () => {
  const issues = (edit: (e: Record<string, any>) => void) => validatePortfolioExperiment(load(edit)).join('\n');

  it('직업의 영역·탐구 능력이 정의에 있어야 한다', () => {
    expect(issues((e) => (e.jobs[0].area = 'ocean'))).toContain('모르는 영역 ocean');
    expect(issues((e) => (e.jobs[0].skills = ['fair-test', 'telepathy']))).toContain('모르는 탐구 능력 telepathy');
  });
  it('영역마다 직업이 3장 이상이어야 한다', () => {
    expect(issues((e) => (e.jobs[0].area = 'life'))).toContain('영역 matter: 직업 카드가 3장 이상');
  });
  it('단원 배정이 겹치면 안 된다', () => {
    expect(issues((e) => e.areas[1].units.push('g5-solution'))).toContain('g5-solution');
  });
  it('탐구 능력 2~3개, 관련 단원 1~3개, 한 문장', () => {
    expect(issues((e) => (e.jobs[0].skills = ['observe']))).toContain('탐구 능력은 2~3개');
    expect(issues((e) => (e.jobs[0].skills = ['observe', 'predict', 'model', 'classify']))).toContain('탐구 능력은 2~3개');
    expect(issues((e) => (e.jobs[0].units = []))).toContain('관련 단원은 1~3개');
    expect(issues((e) => (e.jobs[0].units = ['a', 'b', 'c', 'd']))).toContain('관련 단원은 1~3개');
    expect(issues((e) => (e.jobs[0].does = '첫째 일을 합니다. 둘째 일도 합니다.'))).toContain('한 문장');
  });
  it('성별을 가리키는 말이 있으면 거부한다', () => {
    expect(issues((e) => (e.jobs[0].does = '그는 실험을 합니다.'))).toContain('그는');
    expect(issues((e) => (e.jobs[3].does = '이 일을 하는 아저씨는 동물을 돌봅니다.'))).toContain('아저씨');
  });
  it('key 중복과 튜터 단계 누락을 거부한다', () => {
    expect(issues((e) => (e.jobs[1].key = e.jobs[0].key))).toContain('직업 key가 겹칩니다');
    expect(issues((e) => e.tutor.probes.pop())).toContain('stage-4');
  });
  it('아직 없는 단원 id는 경고만 하고 실패하지 않는다', () => {
    const e = load((x) => x.areas[4].units.push('g6-future'));
    expect(validatePortfolioExperiment(e)).toEqual([]);
    const known = exp.areas.flatMap((a) => a.units);
    expect(portfolioUnitWarnings(exp, known)).toEqual([]);
    const w = portfolioUnitWarnings(e, known);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('g6-future');
    expect(w[0]).toContain('준비 중');
  });
});
