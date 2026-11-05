import { useCallback, useMemo } from 'react';
import type { CardSortExperiment, SortCard } from '@sci/schema';
import { MemoryRecorder, buildStatement, toExtensions } from '@sci/xapi';
import { ANIMAL_ICON_KEYS, AnimalIcon } from './AnimalIcons';
import { LEAF_ICON_KEYS, LeafIcon } from './LeafIcons';
import { MATERIAL_ICON_KEYS, MaterialIcon } from './MaterialIcons';
import { STRATA_ICON_KEYS, StrataIcon } from './StrataIcons';

/** 무리 나누기와 트리 화면이 함께 쓰는 조각들: 카드 그림, 카드 버튼, 돋보기와 관찰 기록, xAPI 기록. */

const ACTOR_ID = 'anon-student-001';
const activityId = (unitId: string, expId: string) => `https://sci-bridge.local/activities/${unitId}/${expId}`;

/** xAPI 진술을 만들어 기록한다. 정답(특징값·알맞은 무리)은 담지 않는다. */
export function useSortEmit(unitId: string, expId: string) {
  const recorder = useMemo(() => new MemoryRecorder(), []);
  const emit = useCallback(
    (verb: string, extensions?: Record<string, unknown>) => {
      const stmt = buildStatement({
        actorId: ACTOR_ID,
        verb,
        objectId: activityId(unitId, expId),
        result: extensions ? { extensions: toExtensions(extensions) } : undefined,
      });
      recorder.record(stmt);
      console.debug('[xAPI]', stmt);
    },
    [unitId, expId, recorder],
  );
  return emit;
}

/**
 * 카드 그림. 물체 그림 key면 물체, 잎 그림 key면 잎, 아니면 동물 그림.
 * shown은 시험해 본 특징 key들이다(물체 그림과 암석 그림만 쓰며, 그 특징의 결과 그림이 겹쳐진다).
 */
export function CardIcon({ icon, size, shown }: { icon: string; size: number; shown?: string[] }) {
  if (MATERIAL_ICON_KEYS.includes(icon)) return <MaterialIcon icon={icon} size={size} shown={shown} />;
  if (STRATA_ICON_KEYS.includes(icon)) return <StrataIcon icon={icon} size={size} shown={shown} />;
  return LEAF_ICON_KEYS.includes(icon) && !ANIMAL_ICON_KEYS.includes(icon) ? (
    <LeafIcon icon={icon} size={size} />
  ) : (
    <AnimalIcon icon={icon} size={size} />
  );
}

export function CardButton({
  label,
  sublabel,
  icon,
  count,
  total,
  selected,
  onClick,
  small,
}: {
  label: string;
  /** 이름 아래에 덧붙이는 말(없으면 그리지 않는다). */
  sublabel?: string;
  icon: string;
  count: number;
  total: number;
  selected: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button type="button" className={`sort-card${selected ? ' selected' : ''}${small ? ' small' : ''}${sublabel ? ' has-sub' : ''}`} aria-pressed={selected} onClick={onClick}>
      <CardIcon icon={icon} size={small ? 32 : 48} />
      <span className="sort-card-name">{label}</span>
      {sublabel && <span className="sort-card-sub">{sublabel}</span>}
      <span className="obs-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`dot${i < count ? ' on' : ''}`} />
        ))}
      </span>
      <span className="obs-count">관찰 {count}/{total}</span>
    </button>
  );
}

/** 돋보기: 고른 카드를 크게 보고, 특징을 살펴보면 그 관찰 문장만 기록에 나타난다. */
export function Magnifier({
  exp,
  sel,
  observed,
  onObserve,
}: {
  exp: CardSortExperiment;
  sel: SortCard | null;
  observed: string[];
  onObserve: (feature: string) => void;
}) {
  return (
    <section className="panel" aria-label="돋보기">
      <h2>돋보기</h2>
      {!sel && <p className="hint">카드를 고르면 여기에서 크게 보고 특징을 살펴볼 수 있어요.</p>}
      {sel && (
        <div className="magnifier">
          <figure className="view magnifier-card">
            <CardIcon icon={sel.icon} size={140} shown={observed} />
            <figcaption>{sel.sublabel ? `${sel.label} · ${sel.sublabel}` : sel.label}</figcaption>
          </figure>
          <div className="magnifier-side">
            <div className="choices" role="group" aria-label="특징 살펴보기">
              {exp.features.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={observed.includes(f.key) ? 'selected' : ''}
                  onClick={() => onObserve(f.key)}
                >
                  {f.action ?? <>{f.label} 살펴보기</>}
                </button>
              ))}
            </div>
            <h3>관찰 기록</h3>
            <ul className="obs-list" aria-label={`${sel.label} 관찰 기록`}>
              {observed.length === 0 && <li className="hint">버튼을 눌러 특징을 살펴보세요.</li>}
              {observed.map((f) => (
                <li key={f}>
                  <strong>{exp.features.find((x) => x.key === f)?.label ?? f}</strong>
                  <span>{sel.observations[f]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
