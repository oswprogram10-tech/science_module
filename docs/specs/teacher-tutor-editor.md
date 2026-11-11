# 구현 사양: 교사 앱에서 튜터 질문을 수업 전에 고치기(고치기·끄기·더하기)와 학생 기기로 보내기

> 결정(사용자, 2026-11-11): "교사 앱에서 바로 고치는 기능을 넣자."
> 앞 문서: `docs/specs/teacher-local-server.md`(교사 PC 수업 서버), `docs/classroom.md`, `packages/tutor/src/index.ts`(renderAndGuard, selectProbe), `packages/tutor/src/check.ts`(checkTutorResponse).
> 교사 검토용 문서(claude.ai)의 "튜터 질문 (상황별)" 표와 같은 상황 이름을 쓴다.

## 0. 결정

### 0.1 무엇을 고칠 수 있나
- 활동마다 매니페스트의 튜터 질문(probe)이 있다.
  - 대상: `experiment.tutor.probes`와 관찰 활동의 `tasks[].probes`
  - 질문 하나는 **(task, when, iv)**로 구별한다. 저장소 전체에서 이 조합이 겹치지 않음을 확인했다.
  - 키 문자열: `${task ?? ''}|${when}|${iv ?? ''}`
- 선생님이 할 수 있는 일
  1. **고치기**: 문장을 바꾼다.
  2. **끄기**: 그 상황에서 튜터가 아무 말도 하지 않는다. 학생 화면에 튜터 말풍선이 나오지 않는다.
  3. **기본으로**: 고친 것과 끈 것을 되돌린다.
  4. **더하기**: 그 활동에서 생길 수 있지만 아직 질문이 없는 상황에 질문을 새로 넣는다. 예: 변인 실험에서 `fair-test`의 아직 없는 iv 질문.
     - 한 상황에는 질문이 하나만 있다. 번갈아 보여 주기는 하지 않는다(v1).
- 매니페스트(기본값)는 바꾸지 않는다. 고친 내용은 "덧씌우기(edits)"로 따로 둔다.

### 0.2 데이터 (`packages/classroom/src/tutorEdits.ts`, zod)
```ts
tutorEditsSchema = z.strictObject({
  v: z.literal(1),
  units: z.record(unitId, z.record(experimentId, z.strictObject({
    changed: z.record(probeKey, z.strictObject({ text: z.string().min(1).max(200).optional(), off: z.literal(true).optional() })),
    added: z.array(z.strictObject({ task: shortText.optional(), when: shortText, iv: shortText.optional(), text: z.string().min(1).max(200) })).max(20),
  }))),
})
```
- 키에 쓸 수 있는 글자를 정한다.
  - unitId와 experimentId: `^[a-z0-9-]{1,40}$`
  - probeKey: `^[a-z0-9-]{0,40}\|[a-z0-9-]{1,40}\|[A-Za-z0-9-]{0,40}$`
- 직렬화 크기는 최대 48 KB이다(`MAX_TUTOR_EDITS_BYTES`).

### 0.3 적용 (`packages/tutor/src/edits.ts`)
- `applyTutorEdits(probes, exp?: ExperimentEdits, task?: string): ProbeTemplate[]`
  - 바뀐 질문은 text를 바꾼다.
  - 꺼진 질문은 `off: true`를 단 채로 남긴다.
  - added 가운데 같은 (task, when, iv)에 켜진 기본 질문이 없는 것만 뒤에 붙인다. task가 다른 것은 빼고 붙인다.
  - 없는 키는 무시한다.
- `ProbeTemplate`에 `off?: boolean`을 더한다.
  - `renderAndGuard`와 `selectProbe`가 고른 질문이 off이면 **빈 문자열 `''`**을 돌려준다. 상수 `TUTOR_SILENT`로 둔다.
  - 학생 화면의 튜터 말풍선은 문자열이 비어 있으면 그리지 않는다. 호출하는 곳 8곳을 모두 고친다.
    - `App.tsx`
    - `CardSortLab`, `TreeSortLab`, `OrderSortLab`
    - `ObserveLab`
    - `ClassifyLab`
    - `PortfolioLab`
    - 그 밖에 tutorText를 그리는 곳
  - **기존 동작은 바뀌지 않는다.** edits가 없으면 기존과 같은 문장이 나온다. 기존 단위·E2E·DOM 해시 테스트가 그대로 통과해야 한다.
- 남은 자리표시: 바꾼 뒤에도 `{이름}`이 남으면 가드 실패처럼 `FALLBACK_PROBE`로 둔다. 선생님이 모르는 자리표시를 쓴 경우를 막는다.

### 0.4 상황 이름과 자리표시 (`packages/tutor/src/situationLabels.ts`, 교사·검토 문서 공용)
- `SITUATION_LABELS`: when → 한국어 이름. 교사 검토 문서 표와 같은 말을 쓴다.

  | when | 한국어 이름 |
  |---|---|
  | before-run | 실행 전(예측할 때) |
  | first-trial | 첫 시행 뒤 |
  | confounded | 조건을 두 개 넘게 함께 바꿨을 때 |
  | iv-unchanged | 알아보려던 조건은 그대로 두고 다른 조건을 바꿨을 때 |
  | repeat | 같은 조건으로 다시 했을 때 |
  | fair-test | 한 조건만 바꿨을 때. iv가 있으면 "‘〈iv 라벨〉’만 바꿨을 때" |
  | prediction-mismatch | 예측과 결과가 다를 때 |
  | pick-card | 카드를 고를 때 |
  | before-observe | 관찰하기 전 |
  | sorting | 나누는 중 |
  | choose-criterion | 기준을 고를 때 |
  | check-unplaced | 아직 넣지 않은 카드가 있을 때 |
  | check-unobserved | 관찰하지 않고 넣었을 때 |
  | check-inconsistent | 관찰 기록과 다르게 넣었을 때 |
  | check-complete | 다 맞게 넣었을 때 |
  | check-subjective | 주관 기준을 골랐을 때 |
  | finished | 모두 마쳤을 때 |
  | tree-split-empty | 한쪽 갈래가 비었을 때 |
  | tree-next-node | 다음 갈래로 넘어갈 때 |
  | order-check-unplaced | 아직 놓지 않은 카드가 있을 때 |
  | order-check-unobserved | 관찰하지 않고 놓았을 때 |
  | order-check-inconsistent | 관찰 기록과 다르게 놓았을 때 |
  | order-check-complete | 다 맞게 놓았을 때 |
  | before-test | 검사하기 전 |
  | testing | 검사하는 중 |
  | check-untested | 검사하지 않고 넣었을 때 |
  | stage-1 ~ stage-4 | 1~4단계 |
  | observing | 관찰하는 중 |
  | record-mismatch | 기록이 관찰과 다를 때 |
  | record-match | 기록이 관찰과 맞을 때 |

  관찰 과제 질문은 앞에 "[과제 이름] "을 붙인다.
- `SITUATIONS_BY_KIND`: 활동 종류별로 생길 수 있는 when 목록. "더하기"에서 고를 수 있는 상황이다. 지금 매니페스트에 쓰이는 when에서 모은다.
  - variable: before-run, first-trial, confounded, iv-unchanged, repeat, fair-test(+iv마다), prediction-mismatch
  - card-sort groups·tree·order: 각 레이아웃 모듈이 실제로 쓰는 when
  - classify: before-test, testing, prediction-mismatch, check-untested, check-inconsistent, check-complete
  - observation: 과제마다 before-observe, observing, record-mismatch, record-match, prediction-mismatch
  - portfolio: stage-1~4
  - 목록은 모듈의 situation 함수에서 실제로 돌려주는 값과 맞는지 단위 테스트로 고정한다.
- 자리표시 보이기
  - 교사 화면에서는 `{iv}`→〔바꾼 조건〕, `{changed}`→〔함께 바뀐 조건〕, `{card}`→〔카드 이름〕, `{criterion}`→〔기준〕, `{solution}`→〔용액 이름〕으로 보인다.
  - 저장할 때 되돌린다: `toDisplayText`와 `fromDisplayText`(서로 역함수, 단위 테스트).
  - 그 활동의 기본 질문에 없는 자리표시를 쓰면 오류이다. 예: 카드 분류에서 〔바꾼 조건〕.

### 0.5 교사 화면 (`apps/teacher/src/TutorEditor.tsx` 등)
- 첫 화면(수업 만들기 화면)과 수업 중 화면 위쪽에 **「튜터 질문 고치기」** 버튼을 둔다. 수업 없이도 열 수 있다.
- 편집 화면
  - 단원 고르기: 학년 순, `unitTitle`. 활동이 둘 이상이면 활동 고르기.
  - 질문 목록: 질문 한 줄마다 다음을 보여 준다.
    - 상황 이름
    - 기본 질문(흐린 글씨)
    - 지금 질문: 여러 줄 입력칸. 고친 것이 없으면 기본 질문이 들어 있다.
    - 켜기·끄기 스위치
    - 「기본으로」
    - 검사 결과: 통과하면 "✓ 검사 통과", 아니면 한국어 문제 목록
  - **검사**(입력할 때마다)
    - `checkTutorResponse`를 쓴다. 대상은 자리표시를 예시 말("조건", "카드")로 바꾼 문장이고, 가드는 그 활동의 `forbiddenAnswers`와 `limits`이다.
    - 문제를 한국어로 보여 준다.
      - `guard:X` → "정답이나 학년에 맞지 않는 말이 들어 있어요: ‘X’"
      - `too-long` → "120자, 두 문장 안으로 줄여 주세요"
      - `no-question` → "물음표로 끝나는 질문이 있어야 해요"
      - `judgment` → "맞다·틀리다는 판정 말은 쓰지 않아요"
      - `personal-info` → "전화번호·이메일은 넣을 수 없어요"
      - 모르는 자리표시 → "쓸 수 없는 칸이에요: 〔…〕"
    - **검사를 통과하지 못한 줄은 저장되지 않는다.** 「저장」은 고친 줄이 모두 통과할 때만 눌린다.
  - 「질문 더하기」: `SITUATIONS_BY_KIND`에서 아직 질문이 없는 상황만 고를 수 있다. 고른 뒤 입력칸이 나온다.
  - 위쪽에 "고친 질문 N개 · 끈 질문 N개 · 더한 질문 N개"를 보여 준다.
  - 「모두 기본으로」를 누르면 확인을 묻는다.
- 저장
  - `localStorage` 키 `sci-bridge.tutor-edits.v1`. 교사 PC에만 둔다. 학생 정보는 없다.
  - 「파일로 내보내기」: JSON 파일로 내려받는다(`튜터질문-YYYYMMDD.json`).
  - 「파일 불러오기」: 스키마와 검사를 통과한 줄만 넣고, 넣지 못한 줄 수와 이유를 보여 준다.
  - 수업 서버의 포트가 바뀌면 브라우저 저장소가 달라질 수 있다. 그때 쓰라고 내보내기·불러오기를 둔다. 안내 문서에도 적는다.
- 수업 중
  - 수업을 만들거나(created) 다시 연결(watch)될 때 저장된 edits를 서버에 보낸다(`{t:'tutor', edits}`).
  - 편집 화면에서 저장할 때마다 다시 보낸다(500 ms 묶음).
  - 수업 화면에 "튜터 질문: 고친 질문 N개를 학생 기기에 보냈어요"를 보여 준다. 고친 것이 없으면 이 줄을 숨긴다.

### 0.6 프로토콜과 서버
- `packages/classroom/protocol.ts`
  - 클라이언트 메시지 `tutorSchema = {t:'tutor', edits: tutorEditsSchema}`
  - 서버 메시지 `{t:'tutor', edits}`
- 크기 제한
  - 일반 메시지는 지금처럼 8 KB이다.
  - `t:'tutor'`만 48 KB까지 받는다.
    - `parseClientMessage`와 `parseServerMessage`: 8 KB를 넘으면 48 KB 이하이고 `"t":"tutor"`일 때만 파싱한다.
    - 서버 ws `maxPayload`는 48 KB로 한다.
    - 허브의 원시 길이 사전 검사도 이에 맞춘다.
- 허브(`apps/server/src/hub.ts`)
  - `tutor`는 그 수업을 만든 교사 연결(또는 token으로 watch한 연결)만 보낼 수 있다. 학생이 보내면 `bad_message`.
  - 수업 상태에 마지막 edits를 메모리로 둔다. 파일로 쓰지 않는다.
  - 받으면 그 수업의 모든 학생에게 보낸다. 학생이 join하면 `joined` 바로 뒤에 보낸다(있을 때만).
  - 수업이 끝나면 버린다.
  - 기존 rate limit을 그대로 적용한다.
- 학생(`apps/student/src/classroom/client.ts`)
  - 서버의 `tutor`를 받으면 메모리에만 둔다. sessionStorage와 localStorage에 두지 않는다.
  - 구독할 수 있는 `useTutorEdits()`를 둔다.
  - 수업에서 나오거나 끝나면 지운다.
  - 활동 화면에서 `applyTutorEdits(exp.tutor.probes, edits?.units[unitId]?.[experimentId], taskId)`로 질문을 만든다.
  - 학생 쪽에서도 가드(renderAndGuard)는 그대로 마지막 검사이다.

## 1. 테스트
- **단위 테스트**
  - tutorEditsSchema: 키 형식, 길이, added 20개, 48 KB
  - applyTutorEdits: 바꾸기, 끄기→빈 문자열, 더하기는 빈 자리에만, task 거르기, 없는 키 무시
  - `TUTOR_SILENT` 처리
  - 남은 `{x}` → FALLBACK
  - toDisplay/fromDisplay 역함수, 모르는 자리표시 오류
  - SITUATIONS_BY_KIND와 모듈 situation 값 일치
  - 교사 검사 메시지 매핑
  - 프로토콜 크기 규칙: 8 KB 넘는 tutor 허용, 8 KB 넘는 다른 메시지 거부, 48 KB 초과 거부
  - 허브
    - 학생의 tutor 거부
    - 교사 tutor 브로드캐스트
    - 나중에 join한 학생도 받음
    - end 뒤 버림
  - 학생 client: 받기, 수업 나가면 지우기, 저장소에 쓰지 않음
- **E2E**(`apps/student/e2e/tutor-edits.spec.ts`, 호스트 진입점 또는 dev 서버)
  1. 교사 화면에서 「튜터 질문 고치기」를 연다.
  2. 6학년 물체의 운동 `before-run`을 "출발 높이를 바꾸면 무엇이 달라질지 먼저 적어 볼까요?"로 고치고 `repeat`을 끈 뒤 저장한다.
  3. 금지 구절("높을수록 빨라")을 넣으면 오류 문장이 나오고 「저장」이 꺼진다.
  4. 수업을 만든다. 학생(앱 모드)이 참여한다.
  5. 학생이 물체의 운동을 열면 튜터에 고친 문장이 보인다.
  6. 같은 조건으로 다시 실행해 `repeat` 상황을 만들면 튜터 말풍선이 없다.
  7. 수업 없이(edits 없음) 열면 기본 문장이 나온다.
- 기존 테스트 기대값은 바꾸지 않는다. 교사 화면 DOM에 버튼이 더해지는 것은 예외로, 해시를 갱신하기 전에 버튼만 빼면 옛 해시가 나오는지 확인한다.
- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`가 모두 종료 코드 0이어야 하고, `pnpm tutor:validate`가 통과해야 한다. 이 환경에서 `pnpm host:build && pnpm host:smoke`가 통과해야 한다.

## 2. 문서
- `docs/classroom.md`에 "튜터 질문 고치기" 절을 둔다.
  - 여는 법
  - 검사 규칙
  - 수업에 보내는 법
  - 내보내기·불러오기
  - 포트가 바뀔 때
- 개인정보 문서 목록에 다음을 적는다.
  - `sci-bridge.tutor-edits.v1`(교사 PC, 학생 정보 없음)
  - 학생 기기에서는 메모리에만 둔다는 점
- README 기능 목록
