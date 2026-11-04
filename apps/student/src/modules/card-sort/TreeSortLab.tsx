import { useMemo, useState, useSyncExternalStore } from 'react';
import { availableCriteria, criterionOf, isEmptySplit, type TreeState } from '@sci/cardsort';
import type { CardSortExperiment } from '@sci/schema';
import { renderAndGuard } from '@sci/tutor';
import { createStore } from './cardSortStore';
import { cardSortFeedback } from './feedback';
import { CardButton, Magnifier, useSortEmit } from './SortParts';
import {
  checkNode,
  chooseCriterion,
  createInitialTreeState,
  isTreeFinished,
  observe,
  place,
  selectCard,
  selectNode,
  splitCount,
  treeTutorSituation,
} from './treeStore';
import { useClassroomStatus } from '../../classroom/bus';

export const TREE_CRITERION_CHANGED_NOTICE = '질문을 바꾸어서 아래 무리를 다시 나눠요.';
export const TREE_NO_QUESTION = '질문을 골라 주세요';
export const TREE_USED_REASON = '위에서 이미 쓴 질문이에요';
export const TREE_FINISHED_TEXT = '더 나눌 수 없을 때까지 나누었어요!';
export const TREE_MORE_TEXT = '아직 더 나눌 수 있는 무리가 있어요.';

/** 카드 분류의 두 갈래 트리 화면. 카드·돋보기·관찰 기록은 무리 나누기 화면과 같은 조각을 쓴다. */
export function TreeSortLab({
  unitId,
  title,
  experiment: exp,
}: {
  unitId: string;
  title: string;
  experiment: CardSortExperiment;
}) {
  const store = useMemo(() => createStore(createInitialTreeState(exp)), [exp]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  /** 질문을 바꿨을 때 스크린 리더에 알리는 문장(aria-live). */
  const [notice, setNotice] = useState('');
  const emit = useSortEmit(unitId, exp.id);

  const node = state.nodes[state.selectedNode]!;
  const crit = criterionOf(exp, node.criterion);
  const cardOf = (key: string) => exp.cards.find((c) => c.key === key)!;
  const sel = state.selected ? cardOf(state.selected) : null;
  const selObserved = sel ? (state.observed[sel.key] ?? []) : [];
  const featureCount = exp.features.length;
  const side = (key: string) => node.placement[key] ?? null;
  const pile = node.cards.filter((k) => side(k) === null).map(cardOf);
  const ready = pile.length === 0;
  const available = availableCriteria(state, exp, node.id);
  const splits = splitCount(state);
  const finished = isTreeFinished(state, exp);
  const emptySplit = isEmptySplit(state, node.id);
  const observedCount = Object.values(state.observed).reduce((n, f) => n + f.length, 0);

  const onNode = (id: string) => store.update((s) => selectNode(s, id));

  const onCriterion = (key: string) => {
    const before = store.getState();
    const after = store.update((s) => chooseCriterion(s, exp, s.selectedNode, key));
    if (after === before) return;
    const had = before.nodes[before.selectedNode]!;
    if (had.criterion !== null) setNotice(TREE_CRITERION_CHANGED_NOTICE);
    emit('criterion-chosen', { node: before.selectedNode, criterion: key });
  };

  const onSelect = (card: string) => store.update((s) => selectCard(s, exp, card));

  const onObserve = (feature: string) => {
    const card = store.getState().selected;
    if (!card) return;
    const before = store.getState();
    const after = store.update((s) => observe(s, exp, card, feature));
    if (after !== before) emit('observed', { card, feature });
  };

  const onPlace = (card: string, to: 'yes' | 'no' | null) => {
    const before = store.getState();
    const after = store.update((s) => place(s, exp, s.selectedNode, card, to));
    if (after === before) return;
    setNotice('');
    emit('classified', { node: before.selectedNode, criterion: before.nodes[before.selectedNode]!.criterion, card, group: to });
  };

  const onCheck = () => {
    const before = store.getState();
    const next = store.update((s) => checkNode(s, exp, s.selectedNode));
    const checked = next.nodes[before.selectedNode]?.checked;
    if (next === before || !checked) return;
    setNotice('');
    const counts: Record<string, number> = {};
    for (const i of checked.items) counts[i.status] = (counts[i.status] ?? 0) + 1;
    emit('checked', {
      node: before.selectedNode,
      kind: checked.kind,
      criterion: next.nodes[before.selectedNode]!.criterion,
      splits: splitCount(next),
      ...counts,
    });
  };

  // 튜터
  const situation = treeTutorSituation(state, exp);
  const tutorText = renderAndGuard(
    situation.when,
    { card: situation.card, criterion: situation.criterion },
    exp.tutor.probes,
    { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits },
  );
  const feedback = cardSortFeedback(exp, node.checked, emptySplit);

  // 수업 연결(있을 때만 쓰인다): 진행 요약만 알린다(나눈 횟수와 지금 노드의 확인 종류).
  useClassroomStatus({
    unitId,
    activity: 'card-sort',
    phase: node.checked ? 'reviewing' : observedCount > 0 ? 'running' : 'designing',
    trials: splits,
    lastKind: situation.when === 'finished' ? 'tree-finished' : situation.when,
    safetyLocked: false,
  });

  return (
    <div className="app">
      <header className="top">
        <a className="back" href="#/">← 단원 목록</a>
        <h1>{title}</h1>
        <p className="question">탐구 질문: {exp.question}</p>
      </header>

      <main className="sort-layout tree-layout">
        <section className="panel tree-area" aria-label="나누기 트리">
          <h2>나누기 트리</h2>
          <p className="hint">나누고 싶은 무리를 누르면 아래에서 그 무리를 나눌 수 있어요.</p>
          <nav aria-label="나누기 트리 그림">
            <ul className="tree">
              <TreeBranch exp={exp} state={state} id={state.root} edge={null} onNode={onNode} />
            </ul>
          </nav>
        </section>

        <section className="panel tree-current" aria-label="지금 나누는 무리">
          <h2>지금 나누는 무리</h2>
          <p className="hint">카드 {node.cards.length}장</p>
          <fieldset className="plain sort-criteria" role="radiogroup">
            <legend>분류 기준</legend>
            {exp.criteria.map((c) => {
              const usable = available.includes(c.key);
              return (
                <div key={c.key} className="sort-criterion">
                  <label className={`iv-radio${node.criterion === c.key ? ' checked' : ''}`}>
                    <input
                      type="radio"
                      name="sort-criterion"
                      checked={node.criterion === c.key}
                      disabled={!usable}
                      aria-describedby={usable ? undefined : `used-${c.key}`}
                      onChange={() => onCriterion(c.key)}
                    />
                    <span>{c.label}</span>
                  </label>
                  {!usable && (
                    <span id={`used-${c.key}`} className="hint criterion-used">{TREE_USED_REASON}</span>
                  )}
                </div>
              );
            })}
          </fieldset>
          <p className="visually-live" role="status" aria-live="polite">{notice}</p>

          <h3>카드 더미</h3>
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
          {pile.length === 0 && <p className="hint">이 무리의 모든 카드를 넣었어요.</p>}

          {!crit && <p className="hint">먼저 이 무리를 나눌 질문을 골라 주세요.</p>}
          {crit && (
            <>
              <p className="hint">카드를 고르고, 넣고 싶은 쪽의 버튼을 눌러요.</p>
              <div className="bins">
                {crit.groups.map((g) => (
                  <div key={g.value} className="bin" role="group" aria-label={`${g.value === 'yes' ? '예' : '아니요'} 쪽: ${g.label}`}>
                    <h3>{g.label}</h3>
                    <ul className="chips">
                      {node.cards.filter((k) => side(k) === g.value).map((k) => {
                        const c = cardOf(k);
                        return (
                          <li key={k} className="sort-placed">
                            <CardButton
                              label={c.label}
                              icon={c.icon}
                              count={(state.observed[k] ?? []).length}
                              total={featureCount}
                              selected={state.selected === k}
                              onClick={() => onSelect(k)}
                              small
                            />
                            <button type="button" aria-label={`${c.label} 빼기`} onClick={() => onPlace(k, null)}>
                              빼기
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!sel}
                      onClick={() => sel && onPlace(sel.key, g.value as 'yes' | 'no')}
                    >
                      {g.value === 'yes' ? '예' : '아니요'} 쪽에 넣기
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <button type="button" className="run" disabled={!crit || !ready} onClick={onCheck}>
            분류 확인하기
          </button>
          {crit && !ready && <p className="hint">이 무리의 카드 {node.cards.length}장을 모두 넣으면 확인할 수 있어요.</p>}
        </section>

        <div className="center">
          <Magnifier exp={exp} sel={sel} observed={selObserved} onObserve={onObserve} />
        </div>

        <div className="side">
          <section className="panel sort-progress" aria-label="진행 상황">
            <p>나눈 횟수 {splits}번</p>
            <p className="finish" role="status">{finished ? TREE_FINISHED_TEXT : splits > 0 ? TREE_MORE_TEXT : ''}</p>
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
            <caption className="sr-only">카드별로 살펴본 특징과 지금 나누는 무리에서 넣은 쪽</caption>
            <thead>
              <tr>
                <th scope="col">카드</th>
                <th scope="col">살펴본 특징</th>
                <th scope="col">넣은 쪽{crit ? ` (${crit.label})` : ''}</th>
              </tr>
            </thead>
            <tbody>
              {exp.cards.map((c) => {
                const seen = (state.observed[c.key] ?? []).map((f) => exp.features.find((x) => x.key === f)?.label ?? f);
                const g = node.cards.includes(c.key) ? side(c.key) : null;
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

/** 트리의 한 노드와 그 아래 갈래. 넓은 화면에서는 위에서 아래로, 좁은 화면에서는 들여쓰기 목록으로 그린다(CSS). */
function TreeBranch({
  exp,
  state,
  id,
  edge,
  onNode,
}: {
  exp: CardSortExperiment;
  state: TreeState;
  id: string;
  /** 부모 기준에서 이 노드로 오는 무리의 라벨. 뿌리는 null. */
  edge: string | null;
  onNode: (id: string) => void;
}) {
  const n = state.nodes[id]!;
  const crit = criterionOf(exp, n.criterion);
  const selected = state.selectedNode === id;
  const label = (key: string) => exp.cards.find((c) => c.key === key)?.label ?? key;
  return (
    <li className="tree-item">
      {edge !== null && <span className="tree-edge">{edge}</span>}
      <button
        type="button"
        className={`tree-node${selected ? ' selected' : ''}${n.children ? '' : ' leaf'}`}
        id={`node-${id.replace(/\//g, '-')}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onNode(id)}
      >
        <span className="tn-title">{crit ? crit.label : TREE_NO_QUESTION}</span>
        <span className="tn-cards">{n.cards.map(label).join(', ')}</span>
      </button>
      {n.children && crit && (
        <ul className="tree-children">
          <TreeBranch exp={exp} state={state} id={n.children.yes} edge={crit.groups.find((g) => g.value === 'yes')?.label ?? '예'} onNode={onNode} />
          <TreeBranch exp={exp} state={state} id={n.children.no} edge={crit.groups.find((g) => g.value === 'no')?.label ?? '아니요'} onNode={onNode} />
        </ul>
      )}
    </li>
  );
}
