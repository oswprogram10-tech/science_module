import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { countTutorEdits, type TutorEdits } from '@sci/classroom';
import { PLACEHOLDER_DISPLAY, SITUATIONS_BY_KIND, fromDisplayText, situationLabel, toDisplayText } from '@sci/tutor';
import { ConfirmDialog, FOCUSABLE } from './ConfirmDialog';
import { addCandidates, type CatalogExperiment, type CatalogProbe, type CatalogUnit } from './tutorCatalog';
import {
  MAX_ADDED,
  checkLine,
  draftFromEdits,
  draftToEdits,
  emptyDraftExp,
  exportFileName,
  exportJson,
  hasInvalid,
  importEdits,
  isTextChanged,
  lineCheck,
  sameEdits,
  validateEdits,
  type Draft,
  type DraftExp,
} from './tutorDraft';

const MAX_IMPORT_BYTES = 256 * 1024;

interface Props {
  catalog: CatalogUnit[];
  /** 지금 저장된 덧씌우기. */
  saved: TutorEdits;
  /** 저장한다. 이 브라우저에 저장하지 못했으면 false(이번 수업에는 그래도 적용된다). */
  onSave: (edits: TutorEdits) => boolean;
  onClose: () => void;
  /** 확인하지 않은 안전 경고 수(수업 중 편집 화면에서도 놓치지 않게 보여 준다). */
  alertCount: number;
}

function CheckResult({ messages }: { messages: string[] | null }) {
  if (messages === null) return null;
  return (
    <div className="te-check" aria-live="polite">
      {messages.length === 0 ? (
        <p className="te-ok">✓ 검사 통과</p>
      ) : (
        <ul className="te-bad">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TutorEditor({ catalog, saved, onSave, onClose, alertCount }: Props) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFromEdits(saved));
  const [unitId, setUnitId] = useState(catalog[0]?.id ?? '');
  const [expId, setExpId] = useState(catalog[0]?.experiments[0]?.id ?? '');
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'close' | null>(null);
  const [pick, setPick] = useState('');

  const unit = catalog.find((u) => u.id === unitId);
  const exp = unit?.experiments.find((e) => e.id === expId) ?? unit?.experiments[0];
  const d: DraftExp = (exp && draft[unitId]?.[exp.id]) || emptyDraftExp();

  const current = useMemo(() => draftToEdits(draft, catalog), [draft, catalog]);
  const counts = countTutorEdits(current);
  const dirty = !sameEdits(current, saved);
  const invalid = hasInvalid(draft, catalog);
  const schema = useMemo(() => validateEdits(current), [current]);
  const canSave = dirty && !invalid && schema.ok;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => opener?.focus?.();
  }, []);

  const update = (fn: (cur: DraftExp) => DraftExp) => {
    if (!exp) return;
    setNotice(null);
    setDraft((prev) => {
      const next = fn(prev[unitId]?.[exp.id] ?? emptyDraftExp());
      const empty = Object.keys(next.changed).length === 0 && next.added.length === 0;
      const unitDraft = { ...(prev[unitId] ?? {}) };
      if (empty) delete unitDraft[exp.id];
      else unitDraft[exp.id] = next;
      const out = { ...prev, [unitId]: unitDraft };
      if (Object.keys(unitDraft).length === 0) delete out[unitId];
      return out;
    });
  };

  const requestClose = () => (dirty ? setConfirm('close') : onClose());

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = rootRef.current ? [...rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !rootRef.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !rootRef.current?.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  const save = () => {
    if (!canSave) return;
    const ok = onSave(current);
    setNotice(
      ok
        ? { text: '저장했어요. 수업 중이면 학생 기기에도 보내요.' }
        : { text: '이 브라우저에 저장하지 못했어요. 지금 수업에는 적용돼요. 「파일로 내보내기」로 따로 보관해 주세요.', bad: true },
    );
  };

  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportJson(saved)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice({ text: '파일을 만들지 못했어요.', bad: true });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice({ text: '파일이 너무 커요. 이 앱에서 내보낸 파일을 골라 주세요.', bad: true });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ text: '파일을 읽지 못했어요.', bad: true });
      return;
    }
    const r = importEdits(text, catalog);
    if (r.error) {
      setNotice({ text: r.error, bad: true });
      return;
    }
    setDraft(r.draft);
    const rejected = r.rejected.reduce((n, x) => n + x.count, 0);
    const why = r.rejected.map((x) => `${x.reason}(${x.count}줄)`).join(', ');
    setNotice({
      text: `${r.accepted}줄을 불러왔어요. 저장하면 적용돼요.${rejected > 0 ? ` 넣지 못한 줄 ${rejected}줄: ${why}` : ''}`,
      bad: rejected > 0,
    });
  };

  const candidates = exp ? addCandidates(exp, SITUATIONS_BY_KIND[exp.kind], d.added) : [];

  return (
    <div className="te-backdrop">
      <div ref={rootRef} className="te" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <header className="te-head">
          <h2 id={titleId}>튜터 질문 고치기</h2>
          <button type="button" onClick={requestClose}>
            닫기
          </button>
        </header>
        {alertCount > 0 && (
          <div className="alert-banner" role="alert">
            ⚠ 확인하지 않은 안전 경고 {alertCount}건 · 「닫기」를 눌러 수업 화면에서 확인해 주세요
          </div>
        )}
        <p className="hint">
          학생 화면의 튜터가 하는 질문을 고치거나 끌 수 있어요. 고친 내용은 이 PC에만 저장되고, 수업 중에는 참여한 학생 기기에 보내져요.
        </p>
        <p className="te-summary" data-testid="te-summary">
          고친 질문 {counts.changed}개 · 끈 질문 {counts.off}개 · 더한 질문 {counts.added}개
        </p>
        <div className="actions te-tools">
          <button type="button" className="run" disabled={!canSave} onClick={save}>
            저장
          </button>
          <button type="button" disabled={Object.keys(saved.units).length === 0} onClick={download}>
            파일로 내보내기
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            파일 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="te-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onFile(f);
            }}
          />
          <button type="button" className="danger" disabled={Object.keys(draft).length === 0 && Object.keys(saved.units).length === 0} onClick={() => setConfirm('reset')}>
            모두 기본으로
          </button>
        </div>
        <div role="status" className="te-state">
          {invalid ? (
            <p className="error-text">검사를 통과하지 못한 줄이 있어서 저장할 수 없어요.</p>
          ) : !schema.ok && dirty ? (
            <p className="error-text">{schema.message}</p>
          ) : dirty ? (
            <p>저장하지 않은 변경이 있어요.</p>
          ) : null}
          {notice && <p className={notice.bad ? 'error-text' : undefined}>{notice.text}</p>}
        </div>

        <div className="te-pick">
          <label>
            <span>단원</span>
            <select
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setExpId(catalog.find((u) => u.id === e.target.value)?.experiments[0]?.id ?? '');
                setPick('');
              }}
            >
              {[...new Set(catalog.map((u) => u.grade))].map((g) => (
                <optgroup key={g} label={`${g}학년`}>
                  {catalog
                    .filter((u) => u.grade === g)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          {unit && unit.experiments.length > 1 && (
            <label>
              <span>활동</span>
              <select
                value={exp?.id}
                onChange={(e) => {
                  setExpId(e.target.value);
                  setPick('');
                }}
              >
                {unit.experiments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {exp && (
          <>
            {exp.placeholders.length > 0 && (
              <p className="hint">
                질문 안의 {exp.placeholders.map((k) => PLACEHOLDER_DISPLAY[k]).join(' ')}은(는) 학생 화면에서 실제 이름으로 바뀌어요. 지우지 말고 그대로 두거나 같은 칸만 써 주세요.
              </p>
            )}
            <ul className="te-list">
              {exp.probes.map((p) => (
                <ProbeLine key={p.key} exp={exp} probe={p} entry={d.changed[p.key]} update={update} />
              ))}
              {d.added.map((a, i) => {
                const label = situationLabel(a.when, {
                  ...(a.iv ? { ivLabel: exp.ivs.find((v) => v.key === a.iv)?.label ?? a.iv } : {}),
                  ...(a.task ? { taskTitle: exp.tasks.find((t) => t.id === a.task)?.title ?? a.task } : {}),
                });
                const r = checkLine(exp, a.text);
                return (
                  <li key={`add-${a.task ?? ''}|${a.when}|${a.iv ?? ''}`} className="te-line te-added">
                    <h3>
                      {label} <span className="chip on">더한 질문</span>
                    </h3>
                    <label className="te-field">
                      <span>지금 질문</span>
                      <textarea
                        aria-label={`${label} 질문`}
                        rows={3}
                        maxLength={200}
                        value={a.text}
                        onChange={(e) => update((cur) => ({ ...cur, added: cur.added.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))}
                      />
                    </label>
                    <div className="actions">
                      <button type="button" aria-label={`${label} 더한 질문 지우기`} onClick={() => update((cur) => ({ ...cur, added: cur.added.filter((_, j) => j !== i) }))}>
                        지우기
                      </button>
                    </div>
                    <CheckResult messages={r.messages} />
                  </li>
                );
              })}
            </ul>

            <section className="te-add" aria-label="질문 더하기">
              <h3>질문 더하기</h3>
              {d.added.length >= MAX_ADDED ? (
                <p className="hint">더한 질문은 활동마다 {MAX_ADDED}개까지예요.</p>
              ) : candidates.length === 0 ? (
                <p className="hint">이 활동은 모든 상황에 질문이 있어요.</p>
              ) : (
                <div className="actions">
                  <label className="te-add-pick">
                    <span>더할 상황</span>
                    <select value={pick} onChange={(e) => setPick(e.target.value)}>
                      <option value="">상황을 고르세요</option>
                      {candidates.map((c) => (
                        <option key={c.key} value={c.key}>
                          {situationLabel(c.when, { ...(c.ivLabel ? { ivLabel: c.ivLabel } : {}), ...(c.taskTitle ? { taskTitle: c.taskTitle } : {}) })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!pick}
                    onClick={() => {
                      const c = candidates.find((x) => x.key === pick);
                      if (!c) return;
                      update((cur) => ({ ...cur, added: [...cur.added, { ...(c.task ? { task: c.task } : {}), when: c.when, ...(c.iv ? { iv: c.iv } : {}), text: '' }] }));
                      setPick('');
                    }}
                  >
                    더하기
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {confirm === 'reset' && (
        <ConfirmDialog
          title="모두 기본으로 되돌릴까요?"
          body="고친 질문, 끈 질문, 더한 질문이 모두 사라지고 기본 질문으로 돌아가요. 「저장」을 눌러야 적용돼요."
          confirmLabel="모두 기본으로"
          onConfirm={() => {
            setDraft({});
            setNotice({ text: '모두 기본으로 되돌렸어요. 「저장」을 누르면 적용돼요.' });
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'close' && (
        <ConfirmDialog
          title="저장하지 않고 닫을까요?"
          body="저장하지 않은 변경은 사라져요."
          confirmLabel="저장하지 않고 닫기"
          onConfirm={() => {
            setConfirm(null);
            onClose();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function ProbeLine({
  exp,
  probe,
  entry,
  update,
}: {
  exp: CatalogExperiment;
  probe: CatalogProbe;
  entry: { text?: string; off?: boolean } | undefined;
  update: (fn: (cur: DraftExp) => DraftExp) => void;
}) {
  const label = situationLabel(probe.when, { ...(probe.ivLabel ? { ivLabel: probe.ivLabel } : {}), ...(probe.taskTitle ? { taskTitle: probe.taskTitle } : {}) });
  const base = toDisplayText(probe.text);
  const text = entry?.text ?? base;
  const off = !!entry?.off;
  const edited = isTextChanged(exp, probe.key, entry?.text);
  const result = lineCheck(exp, probe.key, entry ?? {});
  const set = (next: { text?: string; off?: boolean }) =>
    update((cur) => {
      const changed = { ...cur.changed };
      const keepText = next.text !== undefined && fromDisplayText(next.text) !== probe.text;
      const e = { ...(next.text !== undefined ? { text: next.text } : {}), ...(next.off ? { off: true } : {}) };
      // 기본과 같아졌고 켜져 있으면 고친 줄이 아니다. 지우는 도중의 빈 칸은 기본과 다르므로 남고, 검사에서 걸린다.
      if (!keepText && !next.off) delete changed[probe.key];
      else changed[probe.key] = e;
      return { ...cur, changed };
    });
  return (
    <li className={`te-line${off ? ' te-off' : ''}`}>
      <h3>{label}</h3>
      <p className="te-default">기본 질문: {base}</p>
      <label className="te-field">
        <span>지금 질문</span>
        <textarea aria-label={`${label} 질문`} rows={3} maxLength={200} value={text} disabled={off} onChange={(e) => set({ text: e.target.value, ...(off ? { off: true } : {}) })} />
      </label>
      <div className="actions">
        <label className="te-switch">
          <input type="checkbox" role="switch" aria-label={`${label} 튜터 말하기`} checked={!off} onChange={(e) => set({ ...(entry?.text !== undefined ? { text: entry.text } : {}), ...(e.target.checked ? {} : { off: true }) })} />
          <span>{off ? '튜터가 말하지 않아요' : '튜터가 말해요'}</span>
        </label>
        <button type="button" aria-label={`${label} 기본으로`} disabled={!edited && !off} onClick={() => update((cur) => { const changed = { ...cur.changed }; delete changed[probe.key]; return { ...cur, changed }; })}>
          기본으로
        </button>
      </div>
      <CheckResult messages={result ? result.messages : null} />
    </li>
  );
}
