import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { TUTOR_MODELS, tutorModel, type TutorModelId } from '@sci/tutor';
import { FOCUSABLE } from './ConfirmDialog';
import { formatBytes, hostModelsStore, type HostModelsStore } from './hostModels';
import { isHostServed } from './serverUrl';
import {
  ALL_SAMPLES,
  answerOrder,
  filterSamples,
  tallyVotes,
  type CompareData,
  type CompareSample,
  type ModelChoice,
  type SampleFilter,
  type Vote,
} from './modelChoice';
import { unitTitle } from './units';

const PAGE = 10;

interface Props {
  choice: ModelChoice;
  /** 저장한다. 이 브라우저에 저장하지 못했으면 false. */
  onChange: (next: ModelChoice) => boolean;
  onClose: () => void;
  /** 확인하지 않은 안전 경고 수(수업 중에도 놓치지 않게 보여 준다). */
  alertCount: number;
  /** 시험에서 자료를 바로 넣는다. 없으면 비교 자료를 따로 불러온다(교사 화면 첫 로딩을 가볍게). */
  data?: CompareData;
  /** 수업 서버(교사 PC)가 내보낸 화면인가. 아니면 모델 파일 넣기를 보이지 않는다. 기본은 화면의 표시를 읽는다. */
  hosted?: boolean;
  /** 이 PC의 모델 파일 목록과 올리기 상태. 시험에서 바꿔 끼운다. */
  store?: HostModelsStore;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const pct0 = (loaded: number, total: number) => (total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0);

export function ModelPicker({ choice, onChange, onClose, alertCount, data: given, hosted = isHostServed(), store = hostModelsStore() }: Props) {
  const titleId = useId();
  const filesId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CompareData | null>(given ?? null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<SampleFilter>(ALL_SAMPLES);
  const [showNames, setShowNames] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [saveFailed, setSaveFailed] = useState(false);
  // 「아직 평가하지 않은 문항만」을 켠 채 평가한 문항은 이번에 보는 동안 목록에 남긴다(누른 단추가 사라져 포커스를 잃지 않고, 바로 고칠 수 있게).
  const [keep, setKeep] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (given) return;
    let alive = true;
    import('./modelCompare.data.json')
      .then((m) => alive && setData(m.default as unknown as CompareData))
      .catch(() => alive && setLoadFailed(true));
    return () => {
      alive = false;
    };
  }, [given]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
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

  const save = (next: ModelChoice) => setSaveFailed(!onChange(next));
  const pickModel = (id: TutorModelId) => save({ ...choice, model: id });
  const vote = (sampleId: string, v: Vote) => {
    const votes = { ...choice.votes };
    if (votes[sampleId] === v) delete votes[sampleId];
    else votes[sampleId] = v;
    setKeep((k) => new Set(k).add(sampleId));
    save({ ...choice, votes });
  };

  const sampleIds = useMemo(() => new Set(data?.samples.map((s) => s.id) ?? []), [data]);
  const tally = tallyVotes(choice.votes, sampleIds);
  const units = useMemo(() => [...new Set(data?.samples.map((s) => s.unitId) ?? [])].sort(), [data]);
  const filterVotes = useMemo(() => Object.fromEntries(Object.entries(choice.votes).filter(([id]) => !keep.has(id))), [choice.votes, keep]);
  const list = data ? filterSamples(data.samples, filter, filterVotes) : [];
  const setF = (patch: Partial<SampleFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setShown(PAGE);
    setKeep(new Set());
  };
  const chosen = choice.model ? tutorModel(choice.model) : null;
  const hostModels = useSyncExternalStore(store.subscribe, store.getModels);
  const upload = useSyncExternalStore(store.subscribe, store.getUpload);
  const onPc = !!chosen && !!hostModels?.some((m) => m.id === chosen.id);
  // 열 때마다 이 PC의 모델 목록을 다시 읽는다(폴더에 직접 넣은 파일도 보이게).
  useEffect(() => {
    if (hosted) void store.refresh();
  }, [hosted, store]);

  return (
    <div className="te-backdrop">
      <div ref={rootRef} className="te mp" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <header className="te-head">
          <h2 id={titleId}>튜터 모델 고르기</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>
        {alertCount > 0 && (
          <div className="alert-banner" role="alert">
            ⚠ 확인하지 않은 안전 경고 {alertCount}건
          </div>
        )}
        <p className="hint">
          학생 기기에서 돌아갈 AI 튜터 모델을 반마다 하나 골라요. 두 모델은 같은 견본으로 학습한 <b>예시 모델</b>이에요. 아래에서 같은 실험 상황에 두 모델이 한 답을 견주어 보고 골라 주세요. 고른 모델과 교사 평가는 이 PC의 브라우저에만 저장돼요.
        </p>

        <section aria-label="모델" className="mp-models">
          {TUTOR_MODELS.map((m) => {
            const s = data?.stats[m.id];
            const picked = choice.model === m.id;
            return (
              <article key={m.id} className={`mp-model${picked ? ' mp-picked' : ''}`} data-testid={`mp-model-${m.id}`}>
                <h3>{m.name}</h3>
                <p className="mp-meta">
                  {m.maker} · 기기 저장 공간 약 {m.sizeGb.toFixed(2)} GB
                </p>
                <p className="mp-meta">
                  라이선스: {m.license}
                  <br />
                  <span className="mp-note">{m.licenseNote}</span>
                </p>
                {s && (
                  <dl className="mp-stats">
                    <dt>일반 상황 규칙 통과</dt>
                    <dd>{pct(s.val_pass)}</dd>
                    <dt>어려운 말 규칙 통과</dt>
                    <dd>{pct(s.red_pass)}</dd>
                    <dt>정답 누출(어려운 말)</dt>
                    <dd>{s.answer}건</dd>
                    <dt>엉뚱한 말 되풀이(어려운 말)</dt>
                    <dd>{s.echo}건</dd>
                    <dt>개인정보 되풀이(어려운 말)</dt>
                    <dd>{s.personal}건</dd>
                    <dt>영어 낱말 섞임(모든 문항)</dt>
                    <dd>{s.latin}건</dd>
                    <dt>한자·일본 글자(모든 문항)</dt>
                    <dd>{s.foreign}건</dd>
                  </dl>
                )}
                {s && (
                  <p className="mp-meta">
                    자동 검사: 일반 상황 {s.n_val}문항, 어려운 말 {s.n_red}문항
                  </p>
                )}
                <p className="mp-meta">교사 평가에서 더 낫다고 고른 답: {tally.byModel[m.id] ?? 0}개</p>
                <button type="button" className={picked ? 'run' : ''} aria-pressed={picked} onClick={() => pickModel(m.id)}>
                  {picked ? '✓ 이 모델을 써요' : '이 모델 쓰기'}
                </button>
              </article>
            );
          })}
        </section>

        <div role="status" className="te-state">
          <p>
            {chosen ? (
              <>
                이 반에서 쓸 모델: <b>{chosen.name}</b>.
              </>
            ) : (
              '아직 모델을 고르지 않았어요.'
            )}
          </p>
          {hosted && chosen && (
            <p data-testid="mp-host-state">
              {onPc
                ? '이 PC에 모델 파일이 있어요. 수업에 들어온 학생 기기가 교실 와이파이로 이 PC에서 받아 가요.'
                : '이 PC에 모델 파일이 없어요. 아래에서 모델 파일을 넣어 주세요.'}
            </p>
          )}
          {saveFailed && <p className="error-text">이 브라우저에 저장하지 못했어요. 지금 화면에서만 적용돼요.</p>}
        </div>
        {hosted ? (
          <section className="mp-files" aria-labelledby={filesId} data-testid="mp-files">
            <h3 id={filesId}>이 PC의 모델 파일</h3>
            <p className="hint">
              Kaggle 학습 결과에서 받은 4비트 모델 파일(.gguf)이에요. 수업 서버가 이 PC에 보관하고, 학생 기기는 교실 와이파이로 받아 가요. 학생 기기에서 인터넷으로 받지는 않아요.
            </p>
            <ul aria-label="이 PC에 있는 모델 파일">
              {TUTOR_MODELS.map((m) => {
                const f = hostModels?.find((x) => x.id === m.id);
                return (
                  <li key={m.id} data-testid={`mp-file-${m.id}`}>
                    <b>{m.name}</b>:{' '}
                    {hostModels === null ? (
                      '확인하는 중…'
                    ) : f ? (
                      <>
                        있어요 · {formatBytes(f.size)}
                        <br />
                        <span className="mp-sha">
                          sha256 <code>{f.sha256}</code>
                        </span>
                      </>
                    ) : (
                      '없어요'
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mp-upload">
              <label>
                <span>
                  모델 파일 넣기{chosen ? `(${chosen.name})` : ''}
                </span>
                <input
                  type="file"
                  accept=".gguf,application/octet-stream"
                  disabled={!chosen || upload?.kind === 'uploading'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && chosen) store.startUpload(chosen.id, file);
                    e.target.value = ''; // 같은 파일을 다시 골라도 반응하게
                  }}
                />
              </label>
              {!chosen && <p className="hint">먼저 위에서 쓸 모델을 골라 주세요.</p>}
              {chosen && <p className="hint">이미 있는 모델 파일은 새 파일로 바뀌어요. 파일을 이 PC의 tutor-models 폴더에 <code>{chosen.id}.gguf</code>로 직접 복사해 넣어도 돼요.</p>}
            </div>
            <div role="status" data-testid="mp-upload-state" className="mp-upload">
              {upload?.kind === 'uploading' && (
                <div className="mp-progress">
                  <span>
                    {tutorModel(upload.id).name} 넣는 중… {pct0(upload.loaded, upload.total)}%
                  </span>
                  <progress value={upload.loaded} max={upload.total} aria-label={`${upload.fileName} 보내는 중`} />
                  <button type="button" onClick={() => store.cancelUpload()}>
                    취소
                  </button>
                </div>
              )}
              {upload?.kind === 'done' && (
                <>
                  <p>
                    <b>{tutorModel(upload.id).name}</b> 파일을 넣었어요 · {formatBytes(upload.size)}
                  </p>
                  <p className="mp-sha">
                    sha256 <code>{upload.sha256}</code>
                  </p>
                </>
              )}
            </div>
            {upload?.kind === 'error' && (
              <p role="alert" className="error-text">
                {upload.message}
              </p>
            )}
          </section>
        ) : (
          <p className="hint" data-testid="mp-not-hosted">
            모델 파일은 수업 서버가 켜진 PC에서 연 교사 화면에서만 넣을 수 있어요.
          </p>
        )}

        <h3 className="mp-section">답 견주어 보기</h3>
        {loadFailed && <p className="error-text">비교 자료를 불러오지 못했어요. 화면을 닫았다가 다시 열어 주세요.</p>}
        {!data && !loadFailed && <p role="status">비교 자료를 불러오는 중…</p>}
        {data && (
          <>
            <p className="hint">
              실험 상황은 교사·AI 견본이에요(학생 대화 아님). 기본은 모델 이름을 가리고 「답 A」「답 B」로 보여 줘요. 문항마다 A·B 자리가 바뀌어요.
            </p>
            <div className="te-pick">
              <label>
                단원
                <select value={filter.unitId} onChange={(e) => setF({ unitId: e.target.value })}>
                  <option value="">모든 단원</option>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {unitTitle(u)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                문항 종류
                <select value={filter.kind} onChange={(e) => setF({ kind: e.target.value as SampleFilter['kind'] })}>
                  <option value="all">모두</option>
                  <option value="val">일반 상황</option>
                  <option value="redteam">어려운 말(엉뚱한 말·답 조르기 등)</option>
                </select>
              </label>
            </div>
            <div className="actions">
              <button type="button" aria-pressed={filter.flaggedOnly} onClick={() => setF({ flaggedOnly: !filter.flaggedOnly })}>
                자동 검사에 걸린 문항만
              </button>
              <button type="button" aria-pressed={filter.unvotedOnly} onClick={() => setF({ unvotedOnly: !filter.unvotedOnly })}>
                아직 평가하지 않은 문항만
              </button>
              <button type="button" aria-pressed={showNames} onClick={() => setShowNames(!showNames)}>
                모델 이름 보기
              </button>
            </div>
            <p className="te-summary" data-testid="mp-tally">
              평가한 문항 {tally.total}/{data.samples.length} ·{' '}
              {data.models.map((id) => `${tutorModel(id as TutorModelId).name} ${tally.byModel[id] ?? 0}`).join(' · ')} · 비슷함 {tally.same}
            </p>
            <p className="hint">조건에 맞는 문항 {list.length}개</p>
            <ol className="te-list">
              {list.slice(0, shown).map((s, i) => (
                <SampleCard key={s.id} n={i + 1} sample={s} models={data.models} showNames={showNames} vote={choice.votes[s.id]} onVote={(v) => vote(s.id, v)} />
              ))}
            </ol>
            {shown < list.length && (
              <div className="actions">
                <button type="button" onClick={() => setShown((n) => n + PAGE)}>
                  문항 더 보기({list.length - shown}개 남음)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SampleCard({ n, sample, models, showNames, vote, onVote }: { n: number; sample: CompareSample; models: string[]; showNames: boolean; vote: Vote | undefined; onVote: (v: Vote) => void }) {
  const [a, b] = answerOrder(sample.id, models);
  const label = (id: string, letter: string) => (showNames ? tutorModel(id as TutorModelId).name : `답 ${letter}`);
  return (
    <li className="te-line mp-sample" data-testid="mp-sample">
      <h4>
        {n}. {unitTitle(sample.unitId)} · {sample.kind === 'val' ? '일반 상황' : `어려운 말: ${sample.category ?? ''}`}
      </h4>
      <dl className="mp-situation">
        {sample.lines.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt>학생 말</dt>
          <dd className="mp-student">{sample.student}</dd>
        </div>
      </dl>
      <div className="mp-answers">
        {([
          [a, 'A'],
          [b, 'B'],
        ] as const).map(([id, letter]) => {
          const ans = sample.answers[id]!;
          return (
            <div key={id} className="mp-answer">
              <p className="mp-answer-label">{label(id, letter)}</p>
              <p className="mp-answer-text">{ans.text}</p>
              {ans.flags.length > 0 && (
                <p className="mp-flags">
                  {ans.flags.map((f) => (
                    <span key={f} className="chip mp-flag">
                      {f}
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="actions" role="group" aria-label={`${n}번 문항: 어느 답이 더 나은가요?`}>
        <button type="button" aria-pressed={vote === a} onClick={() => onVote(a as Vote)}>
          {label(a, 'A')}가 더 나아요
        </button>
        <button type="button" aria-pressed={vote === b} onClick={() => onVote(b as Vote)}>
          {label(b, 'B')}가 더 나아요
        </button>
        <button type="button" aria-pressed={vote === 'same'} onClick={() => onVote('same')}>
          비슷해요
        </button>
      </div>
      {sample.reference && (
        <details>
          <summary>AI 견본 답 보기</summary>
          <p className="te-default">{sample.reference}</p>
        </details>
      )}
    </li>
  );
}
