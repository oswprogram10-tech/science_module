/** 학생 앱의 단원 목록(content/units 매니페스트)에서 단원 id -> 이름만 읽는다. */
const manifests = import.meta.glob<{ id?: unknown; title?: unknown }>('../../../content/units/*/manifest.json', {
  eager: true,
  import: 'default',
});

export const UNIT_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(manifests).flatMap((m) => (typeof m.id === 'string' && typeof m.title === 'string' ? [[m.id, m.title]] : [])),
);

export const unitTitle = (id: string | undefined): string | null => (id ? (UNIT_TITLES[id] ?? id) : null);
