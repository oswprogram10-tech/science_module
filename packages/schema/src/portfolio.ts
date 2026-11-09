import { PORTFOLIO_STAGES, type PortfolioExperiment } from './index';

/** 직업 카드에 쓰지 않는 성별 가리키는 말. 모든 문장은 "이 일을 하는 사람은 …"처럼 성별 중립으로 쓴다. */
export const PORTFOLIO_BANNED_WORDS = [
  '그는', '그녀는', '그가', '그녀가', '그녀', '그의', '그분',
  '아저씨', '아주머니', '아줌마', '아가씨', '할아버지', '할머니',
  '남자', '여자', '남성', '여성', '소년', '소녀', '남학생', '여학생',
] as const;

/** 영역마다 직업 카드가 이 수 이상 있어야 한다. */
export const MIN_JOBS_PER_AREA = 3;

/** 문제 문장 목록(없으면 빈 배열). 이 중 하나라도 있으면 단원을 열지 않는다. */
export function validatePortfolioExperiment(exp: PortfolioExperiment): string[] {
  const issues: string[] = [];
  const dup = (what: string, keys: string[]) => {
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k)) issues.push(`${what} key가 겹칩니다: ${k}`);
      seen.add(k);
    }
  };
  dup('영역', exp.areas.map((a) => a.key));
  dup('탐구 능력', exp.skills.map((s) => s.key));
  dup('직업', exp.jobs.map((j) => j.key));

  // 단원 배정이 겹치지 않는다.
  const owner = new Map<string, string>();
  for (const a of exp.areas) {
    for (const u of a.units) {
      const prev = owner.get(u);
      if (prev !== undefined) issues.push(`단원 ${u}이(가) 영역 ${prev}와 ${a.key}에 모두 있습니다.`);
      else owner.set(u, a.key);
    }
  }

  const areaKeys = new Set(exp.areas.map((a) => a.key));
  const skillKeys = new Set(exp.skills.map((s) => s.key));
  for (const j of exp.jobs) {
    if (!areaKeys.has(j.area)) issues.push(`직업 ${j.key}: 모르는 영역 ${j.area}`);
    if (j.skills.length < 2 || j.skills.length > 3) issues.push(`직업 ${j.key}: 탐구 능력은 2~3개여야 합니다.`);
    for (const s of j.skills) if (!skillKeys.has(s)) issues.push(`직업 ${j.key}: 모르는 탐구 능력 ${s}`);
    if (new Set(j.skills).size !== j.skills.length) issues.push(`직업 ${j.key}: 탐구 능력이 겹칩니다.`);
    if (j.units.length < 1 || j.units.length > 3) issues.push(`직업 ${j.key}: 관련 단원은 1~3개여야 합니다.`);
    // "하는 일"은 한 문장이다: 끝에 마침표 하나.
    const sentences = j.does.split(/[.!?]/).filter((t) => t.trim() !== '');
    if (sentences.length !== 1) issues.push(`직업 ${j.key}: '하는 일'은 한 문장이어야 합니다.`);
    for (const w of PORTFOLIO_BANNED_WORDS) {
      if (j.does.includes(w) || j.label.includes(w)) issues.push(`직업 ${j.key}: 성별을 가리키는 말(${w})을 쓰지 않습니다.`);
    }
  }
  for (const a of exp.areas) {
    const n = exp.jobs.filter((j) => j.area === a.key).length;
    if (n < MIN_JOBS_PER_AREA) issues.push(`영역 ${a.key}: 직업 카드가 ${MIN_JOBS_PER_AREA}장 이상 있어야 합니다(${n}장).`);
  }

  const whens = new Set(exp.tutor.probes.map((p) => p.when));
  for (const s of PORTFOLIO_STAGES) if (!whens.has(s)) issues.push(`튜터 질문에 ${s}가 없습니다.`);
  return issues;
}

/**
 * 구현되지 않은 단원 id를 가리키는 경고. 검사는 실패하지 않고, 화면이 "준비 중"을 보여 주는 데 쓴다.
 * knownUnitIds는 앱에 실제로 있는 단원 id 목록이다.
 */
export function portfolioUnitWarnings(exp: PortfolioExperiment, knownUnitIds: readonly string[]): string[] {
  const known = new Set(knownUnitIds);
  const out = new Set<string>();
  const check = (where: string, id: string) => {
    if (!known.has(id)) out.add(`${where}: 단원 ${id}은(는) 아직 없어요(준비 중).`);
  };
  for (const a of exp.areas) for (const u of a.units) check(`영역 ${a.key}`, u);
  for (const j of exp.jobs) for (const u of j.units) check(`직업 ${j.key}`, u);
  return [...out];
}
