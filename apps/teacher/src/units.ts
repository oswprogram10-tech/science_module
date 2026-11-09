/** 학생 앱의 단원 목록(content/units 매니페스트)에서 단원 id -> 이름과 활동 이름만 읽는다. */
const manifests = import.meta.glob<{ id?: unknown; title?: unknown; experiments?: unknown }>('../../../content/units/*/manifest.json', {
  eager: true,
  import: 'default',
});

export const UNIT_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(manifests).flatMap((m) => (typeof m.id === 'string' && typeof m.title === 'string' ? [[m.id, m.title]] : [])),
);

/** 단원 id -> 활동(매니페스트 experiments 순서)의 id와 이름. */
export const UNIT_ACTIVITIES: Record<string, { id: string; title: string }[]> = Object.fromEntries(
  Object.values(manifests).flatMap((m) =>
    typeof m.id === 'string' && Array.isArray(m.experiments)
      ? [
          [
            m.id,
            m.experiments.flatMap((e: { id?: unknown; title?: unknown }) =>
              e && typeof e.id === 'string' && typeof e.title === 'string' ? [{ id: e.id, title: e.title }] : [],
            ),
          ],
        ]
      : [],
  ),
);

export const unitTitle = (id: string | undefined): string | null => (id ? (UNIT_TITLES[id] ?? id) : null);

/** 활동이 둘 이상인 단원에서만 활동 이름을 돌려준다(experimentId가 없으면 첫 활동). 활동이 하나면 null. */
export function activityTitle(unitId: string | undefined, experimentId: string | undefined): string | null {
  const list = unitId ? UNIT_ACTIVITIES[unitId] : undefined;
  if (!list || list.length < 2) return null;
  return (list.find((a) => a.id === experimentId) ?? list[0]!).title;
}
