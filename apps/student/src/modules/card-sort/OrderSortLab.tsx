import { useMemo, useSyncExternalStore } from 'react';
import { ActivityTabsSlot } from '../../components/ActivityTabs';
import { orderPile } from '@sci/cardsort';
import type { CardSortExperiment } from '@sci/schema';
import { renderAndGuard } from '@sci/tutor';
import {
  checkFollowUp,
  checkOrder,
  createInitialOrderState,
  followUpAllPlaced,
  followUpPlace,
  isOrderFinished,
  observe,
  orderTutorSituation,
  placeInSlot,
  removeFromSlot,
  select,
  allSlotsFilled,
} from './orderStore';
import { createStore } from './cardSortStore';
import { followUpFeedback, orderFeedback } from './feedback';
import { CardButton, Magnifier, useSortEmit } from './SortParts';
import { useClassroomStatus } from '../../classroom/bus';
import { logbook } from '../../logbook';

export const ORDER_FINISHED_TEXT = '지층의 차례와 그때의 환경을 모두 알아냈어요!';
export const ORDER_EARLIEST = '먼저 쌓임';
export const ORDER_LATEST = '나중에 쌓임';

/**
 * 카드 분류의 순서 놓기 화면(layout: 'order'). 표본을 관찰해 "먼저 쌓인 층 → 나중에 쌓인 층" 칸에 놓고,
 * 순서가 맞으면 같은 표본으로 followUp 무리 나누기(예: 그때의 환경)를 이어서 한다.
 * 정답 칸 번호, 특징값, 관찰하지 않은 문장은 화면과 DOM 속성에 나타나지 않는다.
 */
/** 끝낸 기준 수: 순서 맞추기와 이어서 하는 무리 나누기 중 확인을 통과한 것. */
function orderCriteriaDone(s: { checked: { kind: string } | null; followUp: { checked: { kind: string } | null } }): number {
  return (s.checked?.kind === 'check-complete' ? 1 : 0) + (s.followUp.checked?.kind === 'check-complete' ? 1 : 0);
}

export function OrderSortLab({
  unitId,
  title,
  experiment: exp,
}: {
  unitId: string;
  title: string;
  experiment: CardSortExperiment;
}) {
  const store = useMemo(() => createStore(createInitialOrderState(exp)), [exp]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const emit = useSortEmit(unitId, exp.id);

  const cardOf = (key: string) => exp.cards.find((c) => c.key === key)!;
  const sel = state.selected ? cardOf(state.selected) : null;
  const selObserved = sel ? (state.observed[sel.key] ?? []) : [];
  const featureCount = exp.features.length;
  const followUp = exp.followUp;
  const slotCount = state.slots.length;
  const pile = orderPile(state).map(cardOf);
  const ready = allSlotsFilled(state);
  const orderDone = state.checked?.kind === 'check-complete';
  const finished = isOrderFinished(state, exp);
  const followReady = followUpAllPlaced(state, exp);
  const observedCount = Object.values(state.observed).reduce((n, f) => n + f.length, 0);
  const groupLabel = (group: string | null | undefined) => followUp?.groups.find((g) => g.value === group)?.label ?? null;

  const counts = (items: { status: string }[]) => {
    const out: Record<string, number> = {};
    for (const i of items) out[i.status] = (out[i.status] ?? 0) + 1;
    return out;
  };

  const onSelect = (card: string) => store.update((s) => select(s, exp, card));

  const onObserve = (feature: string) => {
    const card = store.getState().selected;
    if (!card) return;
    const before = store.getState();
    const after = store.update((s) => observe(s, exp, card, feature));
    if (after !== before) emit('observed', { card, feature });
  };

  const onSlot = (card: string, slot: number) => {
    const before = store.getState();
    const after = store.update((s) => placeInSlot(s, card, slot));
    if (after !== before) emit('ordered', { card, slot: slot + 1 });
  };

  const onRemove = (card: string) => {
    const before = store.getState();
    const after = store.update((s) => removeFromSlot(s, card));
    if (after !== before) emit('ordered', { card, slot: null });
  };

  const onCheckOrder = () => {
    const next = store.update((s) => checkOrder(s, exp));
    if (!next.checked) return;
    emit('order-checked', { kind: next.checked.kind, ...counts(next.checked.items) });
    logbook.noteCardSort(unitId, orderCriteriaDone(next), isOrderFinished(next, exp));
  };

  const onFollowUp = (card: string, group: string | null) => {
    const before = store.getState();
    const after = store.update((s) => followUpPlace(s, exp, card, group));
    if (after !== before) emit('classified', { criterion: followUp?.key, card, group });
  };

  const onCheckFollowUp = () => {
    const next = store.update((s) => checkFollowUp(s, exp));
    const checked = next.followUp.checked;
    if (!checked) return;
    emit('followup-checked', { kind: checked.kind, criterion: followUp?.key, ...counts(checked.items) });
    if (isOrderFinished(next, exp)) emit('finished');
    logbook.noteCardSort(unitId, orderCriteriaDone(next), isOrderFinished(next, exp));
  };

  // 튜터
  const situation = orderTutorSituation(state, exp);
  const tutorText = renderAndGuard(
    situation.when,
    { card: situation.card, criterion: situation.criterion },
    exp.tutor.probes,
    { forbiddenAnswers: exp.tutor.forbiddenAnswers, limits: exp.limits },
  );
  const feedbackText = state.followUp.checked ? followUpFeedback(exp, state.followUp.checked) : orderFeedback(exp, state.checked);

  // 수업 연결(있을 때만 쓰인다): 진행 요약만 알린다.
  useClassroomStatus({
    unitId,
    activity: 'card-sort',
    phase: state.checked ? 'reviewing' : observedCount > 0 ? 'running' : 'designing',
    trials: observedCount,
    lastKind: situation.when === 'finished' ? 'order-finished' : situation.when,
    safetyLocked: false,
  });

  const slotCard = (i: number) => (state.slots[i] ? cardOf(state.slots[i]!) : null);

  return (
    <div className="app">
      <header className="top">
        <a className="back" href="#/">← 단원 목록</a>
        <h1>{title}</h1>
        <p className="question">탐구 질문: {exp.question}</p>
        {exp.notice && <p className="order-notice" role="note">{exp.notice}</p>}
      </header>
      <ActivityTabsSlot />

      <main className="sort-layout">
        <section className="panel" aria-label="표본 고르기">
          {exp.background && (
            <div className="order-background" role="note" aria-label={exp.background.title}>
              <h2>{exp.background.title}</h2>
              <p>{exp.background.text}</p>
            </div>
          )}

          <h2>표본 더미</h2>
          <ul className="sort-pile">
            {pile.map((c) => (
              <li key={c.key}>
                <CardButton
                  label={c.label}
                  sublabel={c.sublabel}
                  icon={c.icon}
                  count={(state.observed[c.key] ?? []).length}
                  total={featureCount}
                  selected={state.selected === c.key}
                  onClick={() => onSelect(c.key)}
                />
              </li>
            ))}
          </ul>
          {pile.length === 0 && <p className="hint">모든 표본을 칸에 놓았어요.</p>}
        </section>

        <div className="center">
          <Magnifier exp={exp} sel={sel} observed={selObserved} onObserve={onObserve} />
        </div>

        <div className="side">
          <section className="panel" aria-label="쌓인 차례">
            <h2>쌓인 차례</h2>
            <p className="hint">
              {orderDone
                ? '쌓인 차례를 맞게 놓았어요.'
                : '표본을 고르고, 놓고 싶은 칸의 버튼을 눌러요. 칸에 표본이 이미 있으면 서로 자리를 바꿔요.'}
            </p>
            <ol className="order-slots">
              {state.slots.map((_, i) => {
                const c = slotCard(i);
                const env = c ? groupLabel(state.followUp.placement[c.key]) : null;
                return (
                  <li key={i} className={`order-slot${c ? ' filled' : ''}`}>
                    <span className="order-edge">
                      {i === 0 ? ORDER_EARLIEST : i === slotCount - 1 ? ORDER_LATEST : ''}
                    </span>
                    <div className="order-slot-body" role="group" aria-label={`${i + 1}번째로 쌓인 층`}>
                      {c ? (
                        <div className="sort-placed">
                          <CardButton
                            label={c.label}
                            sublabel={c.sublabel}
                            icon={c.icon}
                            count={(state.observed[c.key] ?? []).length}
                            total={featureCount}
                            selected={state.selected === c.key}
                            onClick={() => onSelect(c.key)}
                            small
                          />
                          {!orderDone && (
                            <button type="button" aria-label={`${c.label} 빼기`} onClick={() => onRemove(c.key)}>
                              빼기
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="order-empty">비어 있음</span>
                      )}
                      {orderDone && env && <span className="order-env">{env}</span>}
                      <button
                        type="button"
                        className="secondary"
                        disabled={!sel || orderDone || sel.key === c?.key}
                        onClick={() => sel && onSlot(sel.key, i)}
                      >
                        {i + 1}번째로 쌓인 층에 놓기
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="run" disabled={!ready || orderDone} onClick={onCheckOrder}>
              쌓인 차례 확인하기
            </button>
            {!ready && <p className="hint">표본 {exp.cards.length}장을 모두 칸에 놓으면 확인할 수 있어요.</p>}
          </section>

          {orderDone && followUp && (
            <section className="panel" aria-label="그때의 환경">
              <h2>{followUp.label}</h2>
              <p className="hint">표본을 고르고, 화석을 살펴본 뒤 알맞은 무리의 버튼을 눌러요.</p>
              <div className="bins">
                {followUp.groups.map((g) => (
                  <div key={g.value} className="bin" role="group" aria-label={g.label}>
                    <h3>{g.label}</h3>
                    <ul className="chips">
                      {exp.cards
                        .filter((c) => state.followUp.placement[c.key] === g.value)
                        .map((c) => (
                          <li key={c.key} className="sort-placed order-chip">
                            <span>{c.label}</span>
                            <button type="button" aria-label={`${c.label} 무리에서 빼기`} onClick={() => onFollowUp(c.key, null)}>
                              빼기
                            </button>
                          </li>
                        ))}
                    </ul>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!sel}
                      onClick={() => sel && onFollowUp(sel.key, g.value)}
                    >
                      {g.label}에 넣기
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="run" disabled={!followReady} onClick={onCheckFollowUp}>
                환경 확인하기
              </button>
              {!followReady && <p className="hint">표본 {exp.cards.length}장을 모두 무리에 넣으면 확인할 수 있어요.</p>}
            </section>
          )}

          <section className="panel sort-progress" aria-label="진행 상황">
            <p>쌓인 차례: {orderDone ? '맞게 놓았어요' : '아직 확인 전'}</p>
            {followUp && <p>그때의 환경: {finished ? '확인했어요' : '아직 확인 전'}</p>}
            <p className="finish" role="status">{finished ? ORDER_FINISHED_TEXT : ''}</p>
          </section>

          <div className="boxes single">
            <div className="box feedback" aria-live="polite">
              <h2>피드백</h2>
              <p>{feedbackText}</p>
            </div>
            <div className="box tutor" aria-live="polite">
              <h2>생각해 볼까요?</h2>
              <p>{tutorText}</p>
            </div>
          </div>
        </div>
      </main>

      <section className="results" aria-label="결과표">
        <div className="table-wrap" role="region" aria-label="표본별 기록(좌우로 밀어서 볼 수 있어요)" tabIndex={0}>
          <table id="results-table">
            <caption className="sr-only">표본별로 살펴본 특징과 놓은 칸, 넣은 무리</caption>
            <thead>
              <tr>
                <th scope="col">표본</th>
                <th scope="col">살펴본 특징</th>
                <th scope="col">놓은 칸</th>
                {orderDone && followUp && <th scope="col">넣은 무리</th>}
              </tr>
            </thead>
            <tbody>
              {exp.cards.map((c) => {
                const seen = (state.observed[c.key] ?? []).map((f) => exp.features.find((x) => x.key === f)?.label ?? f);
                const slot = state.slots.indexOf(c.key);
                return (
                  <tr key={c.key}>
                    <th scope="row">{c.label}</th>
                    <td>{seen.length > 0 ? seen.join(', ') : '–'}</td>
                    <td>{slot >= 0 ? `${slot + 1}번째` : '–'}</td>
                    {orderDone && followUp && <td>{groupLabel(state.followUp.placement[c.key]) ?? '–'}</td>}
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
