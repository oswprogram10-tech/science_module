import { EMPTY_TUTOR_EDITS, tutorEditsSchema, type TutorEdits } from '@sci/classroom';

/** 교사 PC의 브라우저에만 둔다. 학생 정보는 없다(질문 문장과 단원·활동 id뿐). */
export const TUTOR_EDITS_KEY = 'sci-bridge.tutor-edits.v1';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

const defaultStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** 저장된 덧씌우기를 읽는다. 없거나 깨졌거나 규격에 맞지 않으면 빈 덧씌우기. */
export function loadTutorEdits(storage: ReadStorage | null = defaultStorage()): TutorEdits {
  try {
    const raw = storage?.getItem(TUTOR_EDITS_KEY);
    if (!raw) return EMPTY_TUTOR_EDITS;
    const r = tutorEditsSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : EMPTY_TUTOR_EDITS;
  } catch {
    return EMPTY_TUTOR_EDITS;
  }
}

/** 저장한다. 저장하지 못하면(저장소가 막혔거나 가득 참) false. */
export function saveTutorEdits(edits: TutorEdits, storage: WriteStorage | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(TUTOR_EDITS_KEY, JSON.stringify(edits));
    return true;
  } catch {
    return false;
  }
}

/** 화면과 수업 연결이 함께 보는 덧씌우기. 저장하면 구독자에게 알린다. */
export class TutorEditsStore {
  private edits: TutorEdits;
  private listeners = new Set<() => void>();
  constructor(
    initial: TutorEdits,
    private readonly write: (e: TutorEdits) => boolean = (e) => saveTutorEdits(e),
  ) {
    this.edits = initial;
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  get = () => this.edits;
  /** 저장한다. 브라우저 저장소에 쓰지 못해도 이 화면과 수업에는 적용된다(false를 돌려준다). */
  set(next: TutorEdits): boolean {
    this.edits = next;
    const ok = this.write(next);
    this.listeners.forEach((l) => l());
    return ok;
  }
}

let shared: TutorEditsStore | null = null;
export const tutorEditsStore = (): TutorEditsStore => (shared ??= new TutorEditsStore(loadTutorEdits()));
