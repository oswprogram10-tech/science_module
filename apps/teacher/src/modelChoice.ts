import { isTutorModelId, type TutorModelId } from '@sci/tutor';

/** ml/tutor/compare/build_compare.py가 만든 비교 자료(modelCompare.data.json)의 모양. */
export interface CompareAnswer {
  text: string;
  /** 자동 검사에 걸린 점(예: '영어 낱말 섞임'). 없으면 빈 배열. */
  flags: string[];
}
export interface CompareSample {
  id: string;
  kind: 'val' | 'redteam';
  unitId: string;
  /** 모델이 본 실험 상황 [칸 이름, 내용] */
  lines: [string, string][];
  student: string;
  answers: Record<string, CompareAnswer>;
  /** 일반 상황: AI 견본 답 */
  reference?: string;
  /** 어려운 말(레드팀): 유형 이름 */
  category?: string;
}
export interface ModelStats {
  val_pass: number;
  red_pass: number;
  answer: number;
  limit: number;
  echo: number;
  personal: number;
  foreign: number;
  latin: number;
  total: number;
  /** 일반 상황(검증) 문항 수 */
  n_val: number;
  /** 어려운 말(레드팀) 문항 수. 정답 누출·되풀이는 이 문항에서만 센다. */
  n_red: number;
}
export interface CompareData {
  source: string;
  models: string[];
  stats: Record<string, ModelStats>;
  samples: CompareSample[];
}

export type Vote = TutorModelId | 'same';
export interface ModelChoice {
  /** 이 반(교사 PC)에서 쓸 모델. 아직 고르지 않았으면 null. */
  model: TutorModelId | null;
  /** 문항 id -> 교사가 더 낫다고 본 답 */
  votes: Record<string, Vote>;
}
export const EMPTY_CHOICE: ModelChoice = { model: null, votes: {} };

/** 교사 PC의 브라우저에만 둔다. 학생 정보는 없다(모델 이름과 견본 문항 id뿐). */
export const MODEL_CHOICE_KEY = 'sci-bridge.tutor-model.v1';
const MAX_VOTES = 2000;

const isVote = (v: unknown): v is Vote => v === 'same' || isTutorModelId(v);

/** 저장된 값을 검사해 읽는다. 모르는 모델이나 깨진 값은 버린다. */
export function parseChoice(raw: unknown): ModelChoice {
  if (!raw || typeof raw !== 'object') return EMPTY_CHOICE;
  const r = raw as { model?: unknown; votes?: unknown };
  const votes: Record<string, Vote> = {};
  if (r.votes && typeof r.votes === 'object') {
    for (const [id, v] of Object.entries(r.votes as Record<string, unknown>).slice(0, MAX_VOTES)) {
      if (id.length <= 80 && isVote(v)) votes[id] = v;
    }
  }
  return { model: isTutorModelId(r.model) ? r.model : null, votes };
}

const defaultStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadChoice(storage: Pick<Storage, 'getItem'> | null = defaultStorage()): ModelChoice {
  try {
    const raw = storage?.getItem(MODEL_CHOICE_KEY);
    return raw ? parseChoice(JSON.parse(raw)) : EMPTY_CHOICE;
  } catch {
    return EMPTY_CHOICE;
  }
}

export function saveChoice(c: ModelChoice, storage: Pick<Storage, 'setItem'> | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(MODEL_CHOICE_KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

export class ModelChoiceStore {
  private listeners = new Set<() => void>();
  constructor(
    private choice: ModelChoice,
    private readonly write: (c: ModelChoice) => boolean = (c) => saveChoice(c),
  ) {}
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  get = () => this.choice;
  /** 저장한다. 브라우저 저장소에 쓰지 못해도 화면에는 적용된다(false를 돌려준다). */
  set(next: ModelChoice): boolean {
    this.choice = next;
    const ok = this.write(next);
    this.listeners.forEach((l) => l());
    return ok;
  }
}

let shared: ModelChoiceStore | null = null;
export const modelChoiceStore = (): ModelChoiceStore => (shared ??= new ModelChoiceStore(loadChoice()));

/** 같은 문항이면 늘 같은 순서로, 문항마다는 섞이게 두 모델을 A·B에 놓는다(이름을 가리고 볼 때 한쪽에 쏠리지 않게). */
export function answerOrder(sampleId: string, models: readonly string[]): [string, string] {
  let h = 0;
  for (const ch of sampleId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = models as [string, string];
  return h % 2 === 0 ? [a, b] : [b, a];
}

export function tallyVotes(votes: Record<string, Vote>, sampleIds: ReadonlySet<string>): { byModel: Record<string, number>; same: number; total: number } {
  const byModel: Record<string, number> = {};
  let same = 0;
  let total = 0;
  for (const [id, v] of Object.entries(votes)) {
    if (!sampleIds.has(id)) continue;
    total++;
    if (v === 'same') same++;
    else byModel[v] = (byModel[v] ?? 0) + 1;
  }
  return { byModel, same, total };
}

export interface SampleFilter {
  unitId: string;
  kind: 'all' | 'val' | 'redteam';
  flaggedOnly: boolean;
  unvotedOnly: boolean;
}
export const ALL_SAMPLES: SampleFilter = { unitId: '', kind: 'all', flaggedOnly: false, unvotedOnly: false };

export function filterSamples(samples: readonly CompareSample[], f: SampleFilter, votes: Record<string, Vote>): CompareSample[] {
  return samples.filter(
    (s) =>
      (!f.unitId || s.unitId === f.unitId) &&
      (f.kind === 'all' || s.kind === f.kind) &&
      (!f.flaggedOnly || Object.values(s.answers).some((a) => a.flags.length > 0)) &&
      (!f.unvotedOnly || !Object.hasOwn(votes, s.id)),
  );
}
