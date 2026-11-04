import { useMemo, useState, useSyncExternalStore } from 'react';
import { REQUIRED_CRITERIA, criterionOf } from '@sci/cardsort';
import type { CardSortExperiment } from '@sci/schema';
import { renderAndGuard } from '@sci/tutor';
import {
  allPlaced,
  check,
  chooseCriterion,
  createCardSortStore,
  isFinished,
  observe,
  place,
  select,
  tutorSituation,
} from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier, useSortEmit } from './SortParts';
import { TreeSortLab } from './TreeSortLab';
import { useClassroomStatus } from '../../classroom/bus';

export const CRITERION_CHANGED_NOTICE = '기준을 바꾸어서 카드를 다시 나눠요.';

/** 카드 분류 활동. layout에 따라 무리 나누기(groups)나 두 갈래 트리(tree) 화면을 그린다. */
export function CardSortLab(props: { unitId: string; title: string; experiment: CardSortExperiment }) {
  return props.experiment.layout === 'tree' ? <TreeSortLab {...props} /> : <GroupsSortLab {...props} />;
}

function GroupsSortLab({
  unitId,
  title,
  experiment: exp,
}: {
  unitId: string;
  title: string;
  experiment: CardSortExperiment;
}) {
  const store = useMemo(() => createCardSortStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  /** 기준을 바꿨을 때 스크린 리더에 알리는 문장(aria-live). */
  const [notice, setNotice] = useState('');

  const emit = useSortEmit(unitId, exp.id);

  const crit = criterionOf(exp, state.criterion);
  const cardOf = (key: string) => exp.cards.find((c) => c.key === key)!;
  const sel = state.selected ? cardOf(state.selected) : null;
  const selObserved = sel ? (state.observed[sel.key] ?? []) : [];
  const featureCount = exp.features.length;
  const placedIn = (group: string) => exp.cards.filter((c) => state.placement[c.key] === group);
  const pile = exp.cards.filter((c) => (state.placement[c.key] ?? null) === null);
  const ready = allPlaced(state, exp);
  const finished = isFinished(state, exp);
  const doneLabels = state.completed.map((k) => criterionOf(exp, k)?.label ?? k);
  const observedCount = Object.values(state.observed).reduce((n, f) => n + f.length, 0);

  const onCriterion = (key: string) => {
    const before = store.getState();
    const after = store.update((s) => chooseCriterion(s, exp, key));
    if (after === before) return;
    if (before.criterion !== null) setNotice(CRITERION_CHANGED_NOTICE);
    emit('criterion-chosen', { criterion: key });
  };

  const onSelect = (card: string) => store.update((s) => select(s, exp, card));

  const onObserve = (feature: string) => {
    const card = store.getState().selected;
    if (!card) return;
    const before = store.getState();
    const after = store.update((s) => observe(s, exp, card, feature));
    if (after !== before) emit('observed', { card, feature });
  };

  const onPlace = (card: string, group: string | null) => {
    const before = store.getState();
    const after = store.update((s) => place(s, exp, card, group));
    if (after === before) return;
    setNotice('');
    emit('classified', { criterion: after.criterion, card, group });
  };

  const onCheck = () => {
    const next = store.update((s) => check(s, exp));
    if (!next.checked) return;
    setNotice('');
    const counts: Record<string, number> = {};
    for (const i of next.checked.items) counts[i.status] = (counts[i.status] ?? 0) + 1;
    emit('checked', { kind: next.checked.kind, criterion: next.criterion, ...counts });
  };

  // 튜터
  const situation = tutorSituation(state, exp);
  const tutorText = renderAndGuard(
    situation.when,
    { card: situation.card, criterion: situation.criterion },
    exp.tutor.probes,
    { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits },
  );
  const feedback = cardSortFeedback(exp, state.checked);

  // 수업 연결(있을 때만 쓰인다): 진행 요약만 알린다.
  useClassroomStatus({
    unitId,
    activity: 'card-sort',
    phase: state.checked ? 'reviewing' : observedCount > 0 ? 'running' : 'designing',
    trials: observedCount,
    lastKind: situation.when,
    safetyLocked: false,
  });

  return (
    <div className="app">
      <header className="top">
        <a className="back" href="#/">← 단원 목록</a>
        <h1>{title}</h1>
        <p className="question">탐구 질문: {exp.question}</p>
      </header>

      <main className="sort-layout">
        <section className="panel" aria-label="카드 고르기">
          <fieldset className="plain sort-criteria" role="radiogroup">
            <legend>분류 기준</legend>
            {exp.criteria.map((c) => (
              <label key={c.key} className={`iv-radio${state.criterion === c.key ? ' checked' : ''}`}>
                <input
                  type="radio"
                  name="sort-criterion"
                  checked={state.criterion === c.key}
                  onChange={() => onCriterion(c.key)}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="visually-live" role="status" aria-live="polite">{notice}</p>

          <h2>카드 더미</h2>
          <ul className="sort-pile">
            {pile.map((c) => (
              <li key={c.key}>
                <CardButton
                  label={c.label}
                  icon={c.icon}
                  count={(state.observed[c.key] ?? []).length}
                  total={featureCount}
                  selected={state.selected === c.key}
                  onClick={() => onSelect(c.key)}
                />
              </li>
            ))}
          </ul>
          {pile.length === 0 && <p className="hint">모든 카드를 무리에 넣었어요.</p>}
        </section>

        <div className="center">
          <Magnifier exp={exp} sel={sel} observed={selObserved} onObserve={onObserve} />
        </div>

        <div className="side">
          <section className="panel" aria-label="무리 나누기">
            <h2>무리 나누기</h2>
            {!crit && <p className="hint">먼저 분류 기준을 골라 주세요.</p>}
            {crit && (
              <>
                <p className="hint">카드를 고르고, 넣고 싶은 무리의 버튼을 눌러요.</p>
                <div className="bins">
                  {crit.groups.map((g) => (
                    <div key={g.value} className="bin" role="group" aria-label={g.label}>
                      <h3>{g.label}</h3>
                      <ul className="chips">
                        {placedIn(g.value).map((c) => (
                          <li key={c.key} className="sort-placed">
                            <CardButton
                              label={c.label}
                              icon={c.icon}
                              count={(state.observed[c.key] ?? []).length}
                              total={featureCount}
                              selected={state.selected === c.key}
                              onClick={() => onSelect(c.key)}
                              small
                            />
                            <button type="button" aria-label={`${c.label} 빼기`} onClick={() => onPlace(c.key, null)}>
                              빼기
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="secondary"
                        disabled={!sel}
                        onClick={() => sel && onPlace(sel.key, g.value)}
                      >
                        {g.label}에 넣기
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button type="button" className="run" disabled={!crit || !ready} onClick={onCheck}>
              분류 확인하기
            </button>
            {crit && !ready && <p className="hint">카드 {exp.cards.length}장을 모두 무리에 넣으면 확인할 수 있어요.</p>}
          </section>

          <section className="panel sort-progress" aria-label="진행 상황">
            <p>
              끝낸 기준: {doneLabels.length > 0 ? doneLabels.join(', ') : '없음'} ({Math.min(doneLabels.length, REQUIRED_CRITERIA)}/{REQUIRED_CRITERIA})
            </p>
            <p className="finish" role="status">{finished ? '두 가지 기준으로 분류했어요!' : ''}</p>
          </section>

          <div className="boxes single">
            <div className="box feedback" aria-live="polite">
              <h2>피드백</h2>
              <p>{feedback}</p>
            </div>
            <div className="box tutor" aria-live="polite">
              <h2>생각해 볼까요?</h2>
              <p>{tutorText}</p>
            </div>
          </div>
        </div>
      </main>

      <section className="results" aria-label="결과표">
        <div className="table-wrap" role="region" aria-label="카드별 기록(좌우로 밀어서 볼 수 있어요)" tabIndex={0}>
          <table id="results-table">
            <caption className="sr-only">카드별로 살펴본 특징과 지금 기준에서 넣은 무리</caption>
            <thead>
              <tr>
                <th scope="col">카드</th>
                <th scope="col">살펴본 특징</th>
                <th scope="col">넣은 무리{crit ? ` (${crit.label})` : ''}</th>
              </tr>
            </thead>
            <tbody>
              {exp.cards.map((c) => {
                const seen = (state.observed[c.key] ?? []).map((f) => exp.features.find((x) => x.key === f)?.label ?? f);
                const g = state.placement[c.key] ?? null;
                return (
                  <tr key={c.key}>
                    <th scope="row">{c.label}</th>
                    <td>{seen.length > 0 ? seen.join(', ') : '–'}</td>
                    <td>{g ? (crit?.groups.find((x) => x.value === g)?.label ?? '–') : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
