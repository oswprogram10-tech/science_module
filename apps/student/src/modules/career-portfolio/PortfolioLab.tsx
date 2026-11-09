import { useCallback, useId, useMemo, useState } from 'react';
import { ActivityTabsSlot } from '../../components/ActivityTabs';
import type { PortfolioExperiment, PortfolioJob } from '@sci/schema';
import { renderAndGuard } from '@sci/tutor';
import { MemoryRecorder, buildStatement, toExtensions } from '@sci/xapi';
import { MAX_MORE_CHARS, UNAVAILABLE_TEXT, logbook, useLogbookVersion } from '../../logbook';
import { useClassroomStatus } from '../../classroom/bus';
import { JobIcon } from './JobIcons';
import { MAX_AREAS, dayText, doneSkillsOf, splitJobs, summarizeRecords, toggleArea } from './portfolioModel';

const ACTOR_ID = 'anon-student-001';
const activityId = (unitId: string, expId: string) => `https://sci-bridge.local/activities/${unitId}/${expId}`;

const STAGES = [
  { n: 1, label: '내 탐구 기록' },
  { n: 2, label: '관심 영역 고르기' },
  { n: 3, label: '직업 카드' },
  { n: 4, label: '나의 진로 탐색 카드' },
] as const;

const FREE = 'free';
const MAX_JOB_TEXT = 40;

/**
 * 진로 포트폴리오 활동: 내 탐구 기록 -> 관심 영역 -> 직업 카드 -> 나의 진로 탐색 카드.
 * 교실 연결과 xAPI에는 단계 번호(1~4)만 보낸다. 글·고른 직업은 기록장(이 기기)에만 남는다.
 */
export function PortfolioLab({
  unitId,
  title,
  experiment: exp,
  unitTitles,
}: {
  unitId: string;
  title: string;
  experiment: PortfolioExperiment;
  /** 이 앱에 있는 단원 id -> 이름. 여기 없는 단원은 "준비 중"으로 보인다. */
  unitTitles: Record<string, string>;
}) {
  useLogbookVersion();
  const enabled = logbook.isEnabled();
  const usable = logbook.usable();
  const entries = logbook.entries();
  const summary = useMemo(() => summarizeRecords(entries, exp), [entries, exp]);

  const [stage, setStage] = useState(1);
  const [areas, setAreas] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  const saved = useMemo(() => logbook.portfolioCard(), []);
  const [job, setJob] = useState<string>(saved ? (saved.jobKey ?? (saved.jobText ? FREE : '')) : '');
  const [jobText, setJobText] = useState(saved?.jobText ?? '');
  const [skillKeys, setSkillKeys] = useState<string[]>(saved?.skills ?? []);
  const [more, setMore] = useState(saved?.more ?? '');
  const [saveMsg, setSaveMsg] = useState('');

  const recorder = useMemo(() => new MemoryRecorder(), []);
  const goStage = useCallback(
    (n: number) => {
      setStage(n);
      const stmt = buildStatement({
        actorId: ACTOR_ID,
        verb: 'stage-viewed',
        objectId: activityId(unitId, exp.id),
        result: { extensions: toExtensions({ stage: n }) },
      });
      recorder.record(stmt);
      console.debug('[xAPI]', stmt);
    },
    [unitId, exp.id, recorder],
  );

  // 수업 연결(있을 때만 쓰인다): 단계 번호만 알린다. 글·고른 직업·기록 내용은 보내지 않는다.
  useClassroomStatus({
    unitId,
    activity: 'portfolio',
    phase: 'running',
    trials: stage,
    lastKind: `stage-${stage}`,
    safetyLocked: false,
  });

  const tutorText = renderAndGuard(`stage-${stage}`, {}, exp.tutor.probes, {
    forbiddenAnswers: exp.tutor.forbiddenAnswers,
    limits: exp.limits,
  });

  const skillLabel = (k: string) => exp.skills.find((s) => s.key === k)?.label ?? k;
  const areaLabel = (k: string) => exp.areas.find((a) => a.key === k)?.label ?? k;
  const unitName = (id: string) => unitTitles[id];
  const maxSkill = Math.max(1, ...Object.values(summary.skills));

  const onSave = () => {
    const picked = exp.jobs.find((j) => j.key === job);
    const ok = logbook.savePortfolio({
      jobKey: picked ? picked.key : null,
      jobText: job === FREE ? jobText.trim() : '',
      skills: skillKeys,
      more,
    });
    setSaveMsg(ok ? '이 기기의 기록장에 저장했어요.' : `저장하지 못했어요. ${UNAVAILABLE_TEXT}.`);
  };
  const edited = () => setSaveMsg('');

  const jobCards = splitJobs(exp.jobs, areas);

  return (
    <div className="app career">
      <header className="top no-print">
        <a className="back" href="#/">← 단원 목록</a>
        <h1>{title}</h1>
        <p className="question">탐구 질문: {exp.question}</p>
      </header>
      <ActivityTabsSlot />

      <main className="career-main">
        <nav className="career-steps no-print" aria-label="진로 탐색 단계">
          <ol>
            {STAGES.map((s) => (
              <li key={s.n}>
                <button
                  type="button"
                  className={stage === s.n ? 'selected' : ''}
                  aria-current={stage === s.n ? 'step' : undefined}
                  onClick={() => goStage(s.n)}
                >
                  <span className="step-n">{s.n}</span> {s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="box tutor no-print" aria-live="polite">
          <h2>생각해 볼까요?</h2>
          <p>{tutorText}</p>
        </div>

        {stage === 1 && (
          <section className="career-stage" aria-labelledby="career-s1">
            <h2 id="career-s1">1. 내 탐구 기록</h2>
            {!usable && (
              <p className="logbook-warn" role="status">{UNAVAILABLE_TEXT}</p>
            )}
            {!summary.hasRecords ? (
              <div className="career-empty">
                <p><strong>기록이 없어요</strong></p>
                <p>
                  {enabled
                    ? '탐구 기록장이 켜져 있어요. 다른 단원에서 탐구를 하고 오면 여기에 모여요.'
                    : '탐구 기록장이 꺼져 있으면 기록이 남지 않아요. 기록을 모아 보고 싶다면 단원 목록에서 기록장을 켜고 탐구해 보세요.'}
                </p>
                <p>기록이 없어도 아래 단계에서 직업 카드를 살펴볼 수 있어요.</p>
              </div>
            ) : (
              <>
                <h3>영역별로 탐구한 단원</h3>
                <ul className="area-records">
                  {summary.areas.map((a) => (
                    <li key={a.key} className="area-record">
                      <h4>
                        {a.label} <span className="tag">기록한 단원 {a.units.length}개</span>
                      </h4>
                      {a.units.length === 0 ? (
                        <p className="muted">기록한 단원이 아직 없어요.</p>
                      ) : (
                        <ul>
                          {a.units.map((u) => (
                            <li key={u.unitId}>
                              {unitName(u.unitId) ?? u.unitId} <span className="muted">({dayText(u.day)})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <h3>해 본 탐구 능력</h3>
                <p className="muted">
                  단원에서 해 본 횟수를 센 것이에요. 평가하는 숫자가 아니에요.
                </p>
                <ul className="skill-bars" aria-label="탐구 능력별 해 본 횟수">
                  {exp.skills.map((s) => {
                    const n = summary.skills[s.key] ?? 0;
                    return (
                      <li key={s.key}>
                        <span className="skill-name">{s.label}</span>
                        <span className="bar-track" aria-hidden="true">
                          <span className="bar-fill" style={{ width: n > 0 ? `${Math.max(4, Math.round((n / maxSkill) * 100))}%` : '0%' }} />
                        </span>
                        <span className="skill-count">{n}번</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <div className="stage-actions no-print">
              <button type="button" className="run" onClick={() => goStage(2)}>다음: 관심 영역 고르기</button>
            </div>
          </section>
        )}

        {stage === 2 && (
          <section className="career-stage" aria-labelledby="career-s2">
            <h2 id="career-s2">2. 관심 영역 고르기</h2>
            <p>끌리는 영역을 1~2개 골라 보세요. 고르지 않아도 다음으로 갈 수 있어요.</p>
            <fieldset className="area-pick">
              <legend>관심 영역 (최대 {MAX_AREAS}개)</legend>
              <ul>
                {exp.areas.map((a) => {
                  const on = areas.includes(a.key);
                  const full = !on && areas.length >= MAX_AREAS;
                  return (
                    <li key={a.key}>
                      <label className={`check-row area-choice${on ? ' checked' : ''}${full ? ' is-disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={full}
                          onChange={() => setAreas((cur) => toggleArea(cur, a.key))}
                        />
                        <span>{a.label}</span>
                        {summary.hintAreas.includes(a.key) && <span className="tag">참고: 기록이 많은 영역</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <p className="muted" role="status">
              {areas.length === 0 ? '고른 영역이 없어요.' : `고른 영역: ${areas.map(areaLabel).join(', ')}`}
              {areas.length >= MAX_AREAS ? ' (더 고르려면 하나를 먼저 빼 주세요.)' : ''}
            </p>
            <div className="stage-actions no-print">
              <button type="button" onClick={() => goStage(1)}>이전</button>
              <button type="button" className="run" onClick={() => goStage(3)}>다음: 직업 카드 보기</button>
            </div>
          </section>
        )}

        {stage === 3 && (
          <section className="career-stage" aria-labelledby="career-s3">
            <h2 id="career-s3">3. 직업 카드 살펴보기</h2>
            <p>
              {areas.length === 0
                ? '관심 영역을 고르지 않아서 모든 영역의 카드를 보여 줘요.'
                : `고른 영역(${areas.map(areaLabel).join(', ')})의 카드를 먼저 보여 줘요.`}
            </p>
            <ul className="job-cards">
              {jobCards.first.map(renderJob)}
            </ul>
            {jobCards.others.length > 0 && (
              <>
                <button type="button" className="no-print" aria-expanded={showOthers} onClick={() => setShowOthers((v) => !v)}>
                  {showOthers ? '다른 영역 접기' : '다른 영역도 보기'}
                </button>
                {showOthers && (
                  <ul className="job-cards">
                    {jobCards.others.map(renderJob)}
                  </ul>
                )}
              </>
            )}
            <div className="stage-actions no-print">
              <button type="button" onClick={() => goStage(2)}>이전</button>
              <button type="button" className="run" onClick={() => goStage(4)}>다음: 진로 탐색 카드 쓰기</button>
            </div>
          </section>
        )}

        {stage === 4 && (
          <section className="career-stage career-card" aria-labelledby="career-s4">
            <h2 id="career-s4">4. 나의 진로 탐색 카드</h2>
            <div className="field">
              <label htmlFor="career-job">{exp.prompts.job}</label>
              <select
                id="career-job"
                value={job}
                onChange={(e) => {
                  setJob(e.target.value);
                  edited();
                }}
              >
                <option value="">직업을 골라 주세요</option>
                {exp.jobs.map((j) => (
                  <option key={j.key} value={j.key}>{j.label}</option>
                ))}
                <option value={FREE}>직접 쓸래요</option>
              </select>
              {job === FREE && (
                <input
                  type="text"
                  aria-label="직업 이름 직접 쓰기"
                  maxLength={MAX_JOB_TEXT}
                  value={jobText}
                  onChange={(e) => {
                    setJobText(e.target.value);
                    edited();
                  }}
                />
              )}
              <span className="print-only print-value">
                {job === FREE ? jobText : (exp.jobs.find((j) => j.key === job)?.label ?? '')}
              </span>
            </div>
            <fieldset className="field">
              <legend>{exp.prompts.skills}</legend>
              <ul className="skill-checks">
                {exp.skills.map((s) => (
                  <li key={s.key}>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={skillKeys.includes(s.key)}
                        onChange={(e) => {
                          setSkillKeys((cur) => (e.target.checked ? [...cur, s.key] : cur.filter((k) => k !== s.key)));
                          edited();
                        }}
                      />
                      <span>{s.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div className="field">
              <label htmlFor="career-more">{exp.prompts.more} ({MAX_MORE_CHARS}자까지)</label>
              <textarea
                id="career-more"
                rows={4}
                maxLength={MAX_MORE_CHARS}
                value={more}
                onChange={(e) => {
                  setMore(e.target.value);
                  edited();
                }}
              />
              <span className="muted no-print" aria-live="off">{more.length}/{MAX_MORE_CHARS}</span>
            </div>

            <div className="no-print">
              {!usable ? (
                <p className="logbook-warn" role="status">{UNAVAILABLE_TEXT}</p>
              ) : !enabled ? (
                <p className="logbook-warn" role="status">기록장을 켜야 저장돼요 (단원 목록에서 켤 수 있어요).</p>
              ) : (
                <p className="muted">저장하면 이 기기의 기록장에만 남아요. 선생님께 보이지 않아요.</p>
              )}
              <div className="stage-actions">
                <button type="button" onClick={() => goStage(3)}>이전</button>
                <button type="button" className="run" disabled={!enabled} onClick={onSave}>저장하기</button>
                <button type="button" onClick={() => window.print()}>인쇄하기</button>
              </div>
              <p role="status" className="save-msg">{saveMsg}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );

  function renderJob(j: PortfolioJob) {
    const done = doneSkillsOf(j, summary.skills);
    return (
      <li key={j.key} className="job-card">
        <div className="job-head">
          <JobIcon icon={j.icon} />
          <div>
            <h3>{j.label}</h3>
            <span className="tag">{areaLabel(j.area)}</span>
          </div>
        </div>
        <p className="job-does">{j.does}</p>
        <p className="job-skills">
          <strong>쓰이는 탐구 능력</strong>: {j.skills.map(skillLabel).join(', ')}
        </p>
        <p className="job-done">
          {done.length > 0 ? (
            <>
              <strong>내가 해 본 탐구 능력</strong>: <span className="done-mark" aria-hidden="true">✓</span> {done.map(skillLabel).join(', ')}
            </>
          ) : (
            <span className="muted">해 본 기록이 아직 없어요.</span>
          )}
        </p>
        <div className="job-units">
          {j.units.map((u) => {
            const name = unitName(u);
            return name ? (
              <button key={u} type="button" className="no-print" onClick={() => (window.location.hash = `#/unit/${encodeURIComponent(u)}`)}>
                {name} 단원 가기
              </button>
            ) : (
              <button key={u} type="button" disabled>
                {u} (준비 중)
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="no-print"
          onClick={() => {
            setJob(j.key);
            goStage(4);
          }}
        >
          이 직업으로 카드 쓰기
        </button>
      </li>
    );
  }
}
