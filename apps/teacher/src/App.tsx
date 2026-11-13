import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import {
  PHASE_LABEL,
  phaseLabel,
  SAFETY_LABEL,
  agoText,
  describeSituation,
  type GroupView,
  type SafetyType,
} from '@sci/classroom';
import { countTutorEdits, type TutorEdits } from '@sci/classroom';
import { TeacherClient, type TeacherState } from './client';
import { ConfirmDialog } from './ConfirmDialog';
import { HostAddress } from './HostAddress';
import { serverUrl } from './serverUrl';
import { beep, enableSound } from './sound';
import { ModelPicker } from './ModelPicker';
import { modelChoiceStore } from './modelChoice';
import { TutorEditor } from './TutorEditor';
import { TUTOR_CATALOG } from './tutorManifests';
import { tutorEditsStore } from './tutorEditsStore';
import { activityTitle, unitTitle } from './units';

interface Creds {
  code: string;
  token: string;
}

const readCreds = (hash: string): Creds | null => {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const code = p.get('class');
  const token = p.get('token');
  return code && token ? { code, token } : null;
};
const writeHash = (c: Creds | null) => {
  const next = c ? `#class=${c.code}&token=${c.token}` : '';
  if (window.location.hash !== next) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
};

export function App() {
  const [client, setClient] = useState<TeacherClient | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    const c = new TeacherClient(serverUrl(), readCreds(window.location.hash));
    // 교사 PC에 저장된 튜터 질문 덧씌우기를 수업 연결에 알린다(수업을 만들거나 다시 연결될 때와 저장할 때마다 서버에 보낸다).
    const store = tutorEditsStore();
    c.setTutorEdits(store.get());
    const off = store.subscribe(() => c.setTutorEdits(store.get()));
    setClient(c);
    return () => {
      off();
      c.dispose();
    };
  }, []);
  if (!client) return null;
  return <Screen client={client} soundOn={soundOn} onSound={() => setSoundOn(enableSound())} />;
}

function Screen({ client, soundOn, onSound }: { client: TeacherClient; soundOn: boolean; onSound: () => void }) {
  const state = useSyncExternalStore(client.subscribe, client.getState);
  const store = tutorEditsStore();
  const tutorEdits = useSyncExternalStore(store.subscribe, store.get);
  const [editing, setEditing] = useState(false);
  const choiceStore = modelChoiceStore();
  const modelChoice = useSyncExternalStore(choiceStore.subscribe, choiceStore.get);
  const [picking, setPicking] = useState(false);
  const created = state.created;
  // 주소 해시: 수업을 만들면 코드와 토큰을 넣고, 처음 화면이면 지운다.
  useEffect(() => {
    if (created) writeHash(created);
  }, [created]);
  const inClass = state.snapshot !== null || created !== null || (readCreds(window.location.hash) !== null && state.error === null);

  if (state.error && state.error !== 'class_full' && state.error !== 'rate_limited' && state.error !== 'bad_secret' && state.error !== 'not_local') {
    return <GoneScreen onBack={() => { writeHash(null); client.leave(); }} />;
  }
  const alertCount = (state.snapshot?.groups ?? []).reduce((n, g) => n + unacked(g).length, 0);
  const editor = editing ? (
    <TutorEditor catalog={TUTOR_CATALOG} saved={tutorEdits} onSave={(e) => store.set(e)} onClose={() => setEditing(false)} alertCount={alertCount} />
  ) : picking ? (
    <ModelPicker choice={modelChoice} onChange={(c) => choiceStore.set(c)} onClose={() => setPicking(false)} alertCount={alertCount} />
  ) : null;
  const overlay = editing || picking;
  if (!inClass) {
    return (
      <>
        <StartScreen state={state} soundOn={soundOn} onSound={onSound} onCreate={(secret) => client.create(secret)} tutorEdits={tutorEdits} onEdit={() => setEditing(true)} onPickModel={() => setPicking(true)} inert={overlay} />
        {editor}
      </>
    );
  }
  return (
    <>
      <ClassScreen
        client={client}
        state={state}
        soundOn={soundOn}
        tutorEdits={tutorEdits}
        onEdit={() => setEditing(true)}
        onPickModel={() => setPicking(true)}
        inert={overlay}
        onEnd={() => {
          client.end();
          writeHash(null);
        }}
      />
      {editor}
    </>
  );
}

const CONN_TEXT: Record<TeacherState['conn'], string> = {
  connecting: '서버에 연결하는 중…',
  open: '서버에 연결됨',
  closed: '서버와 끊겼어요. 다시 연결하는 중…',
};

/** 주소의 `?key=`: 수업 만들기 비밀번호를 미리 채운다. */
const keyFromUrl = (search: string = window.location.search): string => {
  try {
    return new URLSearchParams(search).get('key')?.slice(0, 64) ?? '';
  } catch {
    return '';
  }
};

interface EditorHooks {
  tutorEdits: TutorEdits;
  onEdit: () => void;
  onPickModel: () => void;
  /** 튜터 질문 편집 화면이나 모델 고르기 화면이 열려 있는 동안 아래 화면을 잠근다. */
  inert: boolean;
}

function StartScreen({ state, soundOn, onSound, onCreate, onEdit, onPickModel, inert }: { state: TeacherState; soundOn: boolean; onSound: () => void; onCreate: (secret: string) => void } & EditorHooks) {
  const full = state.error === 'class_full';
  const badSecret = state.error === 'bad_secret';
  const [secret, setSecret] = useState(keyFromUrl);
  // 서버가 비밀번호를 요구했거나(bad_secret) 주소에 ?key=가 있으면 입력칸을 보여 준다.
  const showSecret = badSecret || secret !== '';
  return (
    <div className="app" inert={inert}>
      <header className="top">
        <h1>교사 대시보드</h1>
        <div className="actions">
          <button type="button" onClick={onEdit}>
            튜터 질문 고치기
          </button>
          <button type="button" onClick={onPickModel}>
            튜터 모델 고르기
          </button>
        </div>
      </header>
      <HostAddress />
      <main className="panel start">
        <p className="conn" role="status" data-conn={state.conn}>
          {CONN_TEXT[state.conn]}
        </p>
        {showSecret && (
          <label className="secret-field">
            <span>수업 만들기 비밀번호</span>
            <input
              type="password"
              value={secret}
              maxLength={64}
              autoComplete="off"
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && state.conn === 'open' && !state.creating) onCreate(secret);
              }}
            />
          </label>
        )}
        {badSecret && <p role="alert" className="error-text">비밀번호가 맞지 않아요. 다시 입력해 주세요.</p>}
        <div className="actions">
          <button type="button" className="run" disabled={state.conn !== 'open' || state.creating} onClick={() => onCreate(secret)}>
            {state.creating ? '만드는 중…' : '수업 만들기'}
          </button>
          <button type="button" aria-pressed={soundOn} onClick={onSound}>
            {soundOn ? '알림 소리 켜짐' : '알림 소리 켜기'}
          </button>
        </div>
        <p className="hint">수업을 만들면 학생에게 보여 줄 6자리 코드가 생겨요. 안전 경고가 생기면 소리로도 알려 드려요.</p>
        {full && <p role="alert" className="error-text">지금은 수업을 더 만들 수 없어요. 끝난 수업을 정리한 뒤 다시 해 보세요.</p>}
        {state.error === 'not_local' && <p role="alert" className="error-text">수업은 수업 서버가 켜진 PC에서 연 교사 화면에서만 만들 수 있어요.</p>}
        {state.error === 'rate_limited' && <p role="alert" className="error-text">수업을 너무 자주 만들었어요. 잠시 뒤에 다시 해 보세요.</p>}
      </main>
    </div>
  );
}

function GoneScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="app">
      <header className="top">
        <h1>교사 대시보드</h1>
      </header>
      <main className="panel start">
        <p role="alert">이 수업을 찾을 수 없어요. 서버가 다시 켜졌거나 수업이 끝났을 수 있어요.</p>
        <button type="button" className="run" onClick={onBack}>
          처음으로
        </button>
      </main>
    </div>
  );
}

// ---- 수업 화면 ----

type Entry = { group: number; view: GroupView | null };

const unacked = (g: GroupView | null) => g?.safety.filter((s) => !s.acked) ?? [];
const timeText = (at: number) =>
  new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 미확인 경고가 있는 모둠, 잠긴 모둠, 나머지 순서. 같은 무리 안에서는 모둠 번호 순. */
export function sortEntries(entries: Entry[], byNumber: boolean): Entry[] {
  const rank = (e: Entry) => (byNumber ? 0 : unacked(e.view).length > 0 ? 0 : e.view?.safetyLocked ? 1 : 2);
  return [...entries].sort((a, b) => rank(a) - rank(b) || a.group - b.group);
}

function ClassScreen({ client, state, soundOn, onEnd, tutorEdits, onEdit, onPickModel, inert }: { client: TeacherClient; state: TeacherState; soundOn: boolean; onEnd: () => void } & EditorHooks) {
  const snap = state.snapshot;
  const code = snap?.code ?? state.created?.code ?? readCreds(window.location.hash)?.code ?? '';
  const [byNumber, setByNumber] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const byGroup = new Map((snap?.groups ?? []).map((g) => [g.group, g]));
  const entries: Entry[] = Array.from({ length: 12 }, (_, i) => ({ group: i + 1, view: byGroup.get(i + 1) ?? null }));
  const alertCount = entries.reduce((n, e) => n + unacked(e.view).length, 0);
  const paused = snap?.paused ?? false;

  // 경고가 늘어날 때만 소리를 한 번 낸다.
  const prevAlerts = useRef(0);
  useEffect(() => {
    if (alertCount > prevAlerts.current && soundOn) beep();
    prevAlerts.current = alertCount;
  }, [alertCount, soundOn]);

  const tutorCount = countTutorEdits(tutorEdits);
  const tutorTotal = tutorCount.changed + tutorCount.off + tutorCount.added;

  return (
    <div className="app" inert={inert}>
      {alertCount > 0 && (
        <div className="alert-banner" role="alert">
          ⚠ 확인하지 않은 안전 경고 {alertCount}건
        </div>
      )}
      <header className="class-head">
        <div>
          <p className="code-label">학생에게 알려 줄 수업 코드</p>
          <p className="code" aria-label={`수업 코드 ${code.split('').join(' ')}`} data-testid="class-code">
            {code}
          </p>
        </div>
        <p className="conn" role="status" data-conn={state.conn}>
          {CONN_TEXT[state.conn]}
        </p>
        <div className="actions">
          <button type="button" className={paused ? 'run' : ''} aria-pressed={paused} onClick={() => client.pause(!paused)} disabled={state.conn !== 'open'}>
            {paused ? '다시 시작' : '모두 멈춤'}
          </button>
          <button type="button" aria-pressed={byNumber} onClick={() => setByNumber(!byNumber)}>
            모둠 번호 순
          </button>
          <button type="button" onClick={onEdit}>
            튜터 질문 고치기
          </button>
          <button type="button" onClick={onPickModel}>
            튜터 모델 고르기
          </button>
          <button type="button" className="danger" onClick={() => setConfirmEnd(true)}>
            수업 끝내기
          </button>
        </div>
      </header>
      <HostAddress />
      {paused && <p className="paused-note">지금 모든 학생 화면이 멈춰 있어요.</p>}
      {tutorTotal > 0 && state.conn === 'open' && (
        <p className="tutor-note" data-testid="tutor-note">
          튜터 질문: 고친 질문 {tutorTotal}개를 학생 기기에 보냈어요
        </p>
      )}

      <main>
        <h2 className="sr-only">모둠 현황</h2>
        <ul className="grid">
          {sortEntries(entries, byNumber).map((e) => (
            <GroupCard key={e.group} entry={e} now={now} onAck={(type) => client.ack(e.group, type)} />
          ))}
        </ul>
      </main>

      {confirmEnd && (
        <ConfirmDialog
          title="수업을 끝낼까요?"
          body="끝내면 모든 학생의 수업 연결이 끊기고 이 수업은 사라져요."
          confirmLabel="수업 끝내기"
          onConfirm={onEnd}
          onCancel={() => setConfirmEnd(false)}
        />
      )}
    </div>
  );
}

function GroupCard({ entry, now, onAck }: { entry: Entry; now: number; onAck: (t: SafetyType) => void }) {
  const { group, view: g } = entry;
  const alerts = unacked(g);
  const title = g ? unitTitle(g.unitId) : null;
  const actTitle = g ? activityTitle(g.unitId, g.experimentId) : null;
  const sentence = g ? describeSituation(g) : null;
  const cls = ['card', alerts.length > 0 ? 'alert' : '', g?.safetyLocked ? 'locked' : '', g ? '' : 'empty'].filter(Boolean).join(' ');
  return (
    <li className={cls} aria-label={`${group}모둠`}>
      <div className="card-head">
        <h3>{group}모둠</h3>
        {!g ? (
          <span className="chip off">참여 전</span>
        ) : g.online ? (
          <span className="chip on">연결됨</span>
        ) : (
          <span className="chip off">끊김 · {agoText(g.lastSeen, now)}</span>
        )}
      </div>
      {g && (
        <>
          <p className="unit">{title ? (actTitle ? `${title} · ${actTitle}` : title) : PHASE_LABEL.idle}</p>
          <p className="meta">
            {g.phase ? phaseLabel(g.phase, g.activity) : ''}
            {g.activity ? (g.activity === 'portfolio' ? ` · ${g.trials}단계` : ` · 시행 ${g.trials}회`) : ''}
          </p>
          {sentence && <p className="situation">{sentence}</p>}
          {g.safetyLocked && <p className="locked-tag">🔒 안전 경고로 실험이 잠겨 있어요</p>}
          {g.deviceTier && <p className="tier">기기 {g.deviceTier}</p>}
        </>
      )}
      {alerts.map((a) => (
        <div key={a.type} className="safety-row">
          <span>
            ⚠ {SAFETY_LABEL[a.type]} · {timeText(a.at)}
          </span>
          <button type="button" aria-label={`${group}모둠 ${SAFETY_LABEL[a.type]} 확인`} onClick={() => onAck(a.type)}>
            확인
          </button>
        </div>
      ))}
    </li>
  );
}
