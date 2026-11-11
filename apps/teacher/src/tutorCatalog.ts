import { PLACEHOLDER_DISPLAY, activityKindOf, type ActivityKind } from '@sci/tutor';

/** 교사 화면의 "튜터 질문 고치기"가 보여 줄 기본 질문 하나(매니페스트의 probe 하나). */
export interface CatalogProbe {
  /** 관찰 활동의 과제 id(과제 질문일 때만). */
  task?: string;
  taskTitle?: string;
  when: string;
  iv?: string;
  /** iv의 한국어 라벨(변인 실험). */
  ivLabel?: string;
  /** 저장 형태의 기본 문장(`{iv}` 같은 자리표시가 그대로 있다). */
  text: string;
  /** 덧씌우기(changed)의 키: `${task ?? ''}|${when}|${iv ?? ''}`. */
  key: string;
}

export interface CatalogExperiment {
  id: string;
  title: string;
  kind: ActivityKind;
  forbiddenAnswers: string[];
  limits: string[];
  /** 이 활동의 기본 질문에 나오는 자리표시 이름(여기에 없는 자리표시는 쓸 수 없다). */
  placeholders: string[];
  probes: CatalogProbe[];
  /** 관찰 활동의 과제 목록(질문 더하기에서 과제를 고른다). */
  tasks: { id: string; title: string }[];
  /** 변인 실험의 변인(fair-test를 조작변인마다 더할 수 있다). */
  ivs: { key: string; label: string }[];
}

export interface CatalogUnit {
  id: string;
  title: string;
  grade: number;
  experiments: CatalogExperiment[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const keyOf = (task: string | undefined, when: string, iv: string | undefined): string => `${task ?? ''}|${when}|${iv ?? ''}`;

function readProbes(list: unknown, task: { id: string; title: string } | undefined, ivLabels: Map<string, string>): CatalogProbe[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((p): CatalogProbe[] => {
    if (!isObj(p)) return [];
    const when = str(p.when);
    const text = str(p.text);
    if (!when || !text) return [];
    const iv = str(p.iv);
    return [
      {
        ...(task ? { task: task.id, taskTitle: task.title } : {}),
        when,
        ...(iv ? { iv, ivLabel: ivLabels.get(iv) ?? iv } : {}),
        text,
        key: keyOf(task?.id, when, iv),
      },
    ];
  });
}

/** 매니페스트들(content/units/*\/manifest.json)에서 교사 화면용 목록을 만든다. 학년 순, 같은 학년은 이름 순. */
export function buildCatalog(manifests: unknown[]): CatalogUnit[] {
  const units: CatalogUnit[] = [];
  for (const m of manifests) {
    if (!isObj(m)) continue;
    const id = str(m.id);
    const title = str(m.title);
    if (!id || !title || !Array.isArray(m.experiments)) continue;
    const experiments: CatalogExperiment[] = [];
    for (const e of m.experiments) {
      if (!isObj(e)) continue;
      const eid = str(e.id);
      const etitle = str(e.title);
      const module = str(e.module);
      if (!eid || !etitle || !module) continue;
      const layout = str(e.layout);
      const kind = activityKindOf({ module, ...(layout ? { layout } : {}) });
      const ivs = Array.isArray(e.variables)
        ? e.variables.flatMap((v): { key: string; label: string }[] => (isObj(v) && str(v.key) ? [{ key: str(v.key)!, label: str(v.label) ?? str(v.key)! }] : []))
        : [];
      const ivLabels = new Map(ivs.map((v) => [v.key, v.label]));
      const tasks = Array.isArray(e.tasks)
        ? e.tasks.flatMap((t): { id: string; title: string; probes: unknown }[] => (isObj(t) && str(t.id) ? [{ id: str(t.id)!, title: str(t.title) ?? str(t.id)!, probes: t.probes }] : []))
        : [];
      const tutor = isObj(e.tutor) ? e.tutor : {};
      const probes = kind === 'observation' ? tasks.flatMap((t) => readProbes(t.probes, t, ivLabels)) : readProbes(tutor.probes, undefined, ivLabels);
      const used = probes.map((p) => p.text).join(' ');
      experiments.push({
        id: eid,
        title: etitle,
        kind,
        forbiddenAnswers: strs(tutor.forbiddenAnswers),
        limits: strs(e.limits),
        placeholders: Object.keys(PLACEHOLDER_DISPLAY).filter((k) => used.includes(`{${k}}`)),
        probes,
        tasks: tasks.map((t) => ({ id: t.id, title: t.title })),
        ivs: kind === 'variable' ? ivs : [],
      });
    }
    if (experiments.length > 0) units.push({ id, title, grade: typeof m.grade === 'number' ? m.grade : 0, experiments });
  }
  return units.sort((a, b) => a.grade - b.grade || a.title.localeCompare(b.title, 'ko'));
}

/** 이 활동에서 "질문 더하기"로 고를 수 있는 상황: 아직 켜진 기본 질문이 없고, 이미 더한 것도 아닌 것. */
export interface AddCandidate {
  task?: string;
  taskTitle?: string;
  when: string;
  iv?: string;
  ivLabel?: string;
  key: string;
}

export function addCandidates(
  exp: CatalogExperiment,
  situations: readonly string[],
  taken: { task?: string; when: string; iv?: string }[],
): AddCandidate[] {
  const occupied = new Set([...exp.probes.map((p) => p.key), ...taken.map((t) => keyOf(t.task, t.when, t.iv))]);
  const out: AddCandidate[] = [];
  const scopes: { task?: { id: string; title: string } }[] = exp.kind === 'observation' ? exp.tasks.map((t) => ({ task: t })) : [{}];
  for (const scope of scopes) {
    for (const when of situations) {
      const base = { ...(scope.task ? { task: scope.task.id, taskTitle: scope.task.title } : {}), when };
      if (exp.kind === 'variable' && when === 'fair-test') {
        // fair-test는 iv가 없는 질문과, 조작변인마다 따로 더할 수 있다.
        for (const iv of [undefined, ...exp.ivs]) {
          const key = keyOf(undefined, when, iv?.key);
          if (!occupied.has(key)) out.push({ ...base, ...(iv ? { iv: iv.key, ivLabel: iv.label } : {}), key });
        }
        continue;
      }
      const key = keyOf(scope.task?.id, when, undefined);
      if (!occupied.has(key)) out.push({ ...base, key });
    }
  }
  return out;
}
