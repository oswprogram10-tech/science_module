import type { PortfolioExperiment, PortfolioJob } from '@sci/schema';
import type { LogEntry } from '../../logbook/logbook';

/** 영역별 기록. units는 기록이 있는 단원(가장 최근 날짜). */
export interface AreaRecord {
  key: string;
  label: string;
  units: { unitId: string; day: string }[];
}

export interface RecordSummary {
  /** 단원 기록이 하나라도 있는가(진로 카드 자체는 세지 않는다). */
  hasRecords: boolean;
  areas: AreaRecord[];
  /** 탐구 능력 key -> 해 본 횟수. 비교나 평가가 아니라 센 횟수일 뿐이다. */
  skills: Record<string, number>;
  /** 기록이 가장 많은 영역 key들(참고용 표시). 기록이 없으면 빈 배열. */
  hintAreas: string[];
}

/**
 * 기록장 항목을 영역·탐구 능력별로 센다.
 * - fair-test: 공정한 비교 시행 수
 * - predict: 예측한 시행 수(맞힌 수가 아니다)
 * - classify: 분류 완료 수(분류 활동 완료 + 카드 분류에서 끝낸 기준 수)
 * - observe: 관찰 과제 기록 수
 * - model: 미시 보기·모형 보기가 있는 변인 실험의 실행 수
 */
export function summarizeRecords(entries: readonly LogEntry[], exp: PortfolioExperiment): RecordSummary {
  const skills: Record<string, number> = Object.fromEntries(exp.skills.map((s) => [s.key, 0]));
  const add = (key: string, n: number) => {
    if (key in skills) skills[key] = skills[key]! + n;
  };
  const latest = new Map<string, string>();
  let hasRecords = false;
  for (const e of entries) {
    if (e.kind === 'portfolio') continue;
    hasRecords = true;
    const prev = latest.get(e.unitId);
    if (prev === undefined || prev < e.day) latest.set(e.unitId, e.day);
    switch (e.kind) {
      case 'variable':
        add('fair-test', e.summary.fair);
        add('predict', e.summary.predicted);
        add('model', e.summary.trials);
        break;
      case 'classify':
        add('classify', e.summary.completed ? 1 : 0);
        break;
      case 'card-sort':
        add('classify', e.summary.criteriaDone);
        break;
      case 'observation':
        add('observe', e.summary.recorded.length);
        break;
    }
  }
  const areas: AreaRecord[] = exp.areas.map((a) => ({
    key: a.key,
    label: a.label,
    units: a.units.filter((u) => latest.has(u)).map((u) => ({ unitId: u, day: latest.get(u)! })),
  }));
  const most = Math.max(0, ...areas.map((a) => a.units.length));
  return {
    hasRecords,
    areas,
    skills,
    hintAreas: most > 0 ? areas.filter((a) => a.units.length === most).map((a) => a.key) : [],
  };
}

/** 직업 카드에서 내가 해 본 탐구 능력(기록과 교집합). */
export function doneSkillsOf(job: PortfolioJob, skills: Record<string, number>): string[] {
  return job.skills.filter((k) => (skills[k] ?? 0) > 0);
}

/** 직업 카드를 보여 줄 순서: 고른 영역의 카드 먼저, 나머지는 따로. 고른 영역이 없으면 모두 앞쪽이다. */
export function splitJobs(jobs: readonly PortfolioJob[], selectedAreas: readonly string[]): { first: PortfolioJob[]; others: PortfolioJob[] } {
  if (selectedAreas.length === 0) return { first: [...jobs], others: [] };
  return {
    first: jobs.filter((j) => selectedAreas.includes(j.area)),
    others: jobs.filter((j) => !selectedAreas.includes(j.area)),
  };
}

/** 1~2개까지 고를 수 있다. 이미 고른 것을 누르면 뺀다. 세 번째는 받지 않는다. */
export const MAX_AREAS = 2;
export function toggleArea(selected: readonly string[], key: string): string[] {
  if (selected.includes(key)) return selected.filter((k) => k !== key);
  return selected.length >= MAX_AREAS ? [...selected] : [...selected, key];
}

/** 화면 날짜: 2026-11-05 -> 11월 5일. */
export function dayText(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : day;
}
