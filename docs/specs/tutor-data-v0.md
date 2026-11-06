# 구현 사양: 소형 튜터 모델 학습 데이터 준비 (v0)

> 근거: `docs/DEVELOPMENT_PLAN.md` §6(온디바이스 튜터 모델: 과업 범위, 데이터, 학습·배포, 가드레일), 결정 D3·D4.
> 이번 범위는 **데이터 형식, 입력 생성기, 검증기, 내보내기, 교사 작성 도구와 가이드**다. 모델 선정, 학습, 양자화는 범위 밖이다(0단계 스파이크 S4 이후).

## 0. 결정 사항

| # | 결정 | 이유 |
|---|---|---|
| T1 | 모델 입력은 실험 상태(구조화 데이터)로 저장하고, 학습·추론 모두 같은 함수 `buildTutorInput`으로 문장화한다. | 학습 입력과 앱 입력이 어긋나면 소형 모델 성능이 크게 떨어진다. 형식을 바꿔도 데이터를 다시 쓰지 않아도 된다. |
| T2 | 출력은 초등 수준 한국어 탐침 질문 1~2문장이다. 결론, 정답, 보고서 문장, 맞음·틀림 판정을 쓰지 않는다. | 계획서 §6.1 과업 범위, D4(정답 노출 0% 목표) |
| T3 | 레코드마다 `source`를 둔다(`teacher` / `pilot-log` / `example`). 내보내기는 기본으로 **`example`을 뺀다**. | 견본은 AI(Claude)가 쓴다. AI 출력물로 다른 모델을 학습해도 되는지는 이용약관·법무 확인 전까지 보류한다(계획서 §6.3). 실제 학습 데이터는 교사가 쓴다. |
| T4 | 교사는 JSONL이 아니라 **CSV**(스프레드시트)로 쓴다. 시나리오(실험 상태)는 개발팀이 시뮬레이션으로 만들어 번호로 제공한다. 교사는 시나리오 번호, 학생 발화, 좋은 질문(필요하면 나쁜 질문)만 쓴다. | 교사가 실험 상태를 손으로 쓰면 오류가 많고 실제 시뮬레이션 값과 어긋난다. |
| T5 | 대표 단원 3개(용해와 용액, 여러 가지 기체, 산과 염기)부터 시작했고, 이후 튜터가 있는 모든 단원(g6-career 제외)으로 시나리오를 넓혔다. 견본은 대표 단원에만 있다. | 계획서 §7.1 수직 슬라이스와 같다. 변인 실험 2개와 분류 활동 1개다. |
| T6 | 학생 발화에 실명·학교명·연락처를 쓰지 않는다. 검증기가 전화번호·이메일 패턴을 거부한다. | 아동 개인정보 |

## 1. 튜터 상태와 입력 생성기 (`@sci/tutor`, `context.ts`)

### 1.1 `TutorState`(활동 유형별 union, JSON 직렬화 가능)

```ts
type TutorState =
  | { kind: 'variable'; unitId: string; experimentId: string;
      current: { values: Record<string, string|number>; ivKey: string|null; prediction: Prediction|null };
      trials: { index: number; values: Record<string, string|number>; ivKey: string|null;
                prediction: Prediction|null; result: Record<string, number|string|boolean>;
                analysis: { kind: AnalysisKind; changed: string[] }; observed: Prediction|null }[]; }  // 최근 3개까지
  | { kind: 'classify'; unitId: string; experimentId: string;
      selected: string|null;
      predictions: Record<string, 'acid'|'base'|'unsure'>;
      tests: Record<string, { indicator: string; color: string }[]>;
      placement: Record<string, string|null>;
      check: { kind: string; items: { solution: string; status: string }[] } | null }
  | { kind: 'observe'; unitId: string; experimentId: string;
      taskId: string; prediction: string|null; recorded: string|null;
      controls: Record<string, string>; matchesModel: boolean|null };
```

### 1.2 함수

- `situationOf(state, experiment) → string`: 지금 상황 키를 고른다. 변인 실험은 기존 `pickProbeKey`, 분류·관찰은 각 Lab의 선택 규칙과 같은 결과를 내야 한다(같은 함수를 재사용하거나 공용으로 뽑아낸다).
- `buildTutorInput(experiment, state, utterance?) → string`: 결정적(같은 입력 → 같은 문자열). 형식(PROMPT_VERSION `"v0"`):

```
[단원] 용해와 용액 (5학년)
[탐구 질문] 어떤 조건에서 용질이 더 많이 녹을까?
[상황] fair-test
[바꿀 조건] 물의 온도
[시행]
1) 용질의 종류 백반 · 물의 양 50 mL · 물의 온도 20 °C · 젓기 천천히 → 녹은 양 5.7 g · 걸린 시간 28.5초 · 예측 늘어난다
2) 용질의 종류 백반 · 물의 양 50 mL · 물의 온도 60 °C(바뀜) · 젓기 천천히 → 녹은 양 28.7 g · 걸린 시간 71.8초 · 예측 늘어난다 · 결과 늘어났다
[학생] 왜 이렇게 많이 녹았어요?
```

  - 변인·선택지는 매니페스트 라벨로, 결과는 매니페스트 `dependent` 라벨과 단위로 쓴다.
  - 분류 활동은 `[용액별 관찰]` 줄(예측, 시험한 지시약과 색 이름, 넣은 무리)과 확인 결과(용액별 상태 이름: "다시 비교 필요", "단서 부족" 등)를 쓴다. **용액의 산성·염기성 정답(level/truthGroup)은 넣지 않는다.**
  - 관찰 과제는 과제 질문, 예측 라벨, 관찰 기록 라벨, 조건 라벨, 일치 여부를 쓴다. 정답 라벨은 넣지 않는다.
  - 학생 발화가 없으면 `[학생] (말하지 않음)`.
- `TUTOR_SYSTEM`: 고정 지시문 문자열(한국어). 역할, 출력 규칙(1~2문장, 질문으로 끝냄, 정답·결론·판정 금지, 학년 밖 용어 금지, 실험과 무관한 요청은 실험으로 돌리는 질문)을 담는다. `PROMPT_VERSION`과 함께 내보낸다.
- 어댑터(앱 상태 → TutorState):
  - `fromVariableRuntime(experiment, runtimeState, module)`
  - `fromClassifyState(experiment, classifyState)`
  - `fromObserveState(experiment, observeState)`
  - 앱의 실제 저장소 타입을 받아 변환한다. 이번에는 앱 화면에 연결하지 않고, 테스트와 시나리오 생성에서만 쓴다.

### 1.3 출력 검사 `checkTutorResponse(text, experiment) → { ok, problems: string[] }`

| 검사 | 문제 코드 |
|---|---|
| `guardOutput`(forbiddenAnswers + limits) 통과 | `guard:<구절>` |
| 1~2문장(종결 부호 . ? ! 기준), 120자 이하 | `too-long` |
| 물음표로 끝나는 문장이 하나 이상 | `no-question` |
| 판정 낱말 없음: 정답, 틀렸, 맞았, 잘했어, 오답 | `judgment` |
| 개인정보 패턴 없음: 전화번호, 이메일 | `personal-info` |

## 2. 데이터 파일 (`ml/tutor/`)

```
ml/tutor/
├─ README.md                 # 폴더 안내(짧게)
├─ scenarios/<unitId>.jsonl  # 시나리오 라이브러리(생성기 출력, 커밋)
├─ data/<unitId>/sft.jsonl   # 좋은 질문
├─ data/<unitId>/pairs.jsonl # 좋은/나쁜 질문 쌍(선호 학습)
├─ data/<unitId>/redteam.jsonl # 평가용 공격 발화
├─ templates/teacher-sft.csv, teacher-pairs.csv, teacher-redteam.csv
└─ out/                      # 내보내기 결과(.gitignore)
```

### 2.1 레코드

- 공통: `id`(단원 내 유일, 예 `g5-solution-sft-0001`), `unitId`, `scenarioId`, `utterance`(문자열, 빈 문자열은 "말하지 않음"), `source`, `reviewed`(boolean), `author`(교사 가명 코드, 예 `T03`. 실명 금지), `notes?`.
- `sft`: `response`.
- `pairs`: `chosen`, `rejected`, `rejectedReason`. rejectedReason은 `answer-leak` / `judgment` / `grade-term` / `too-long` / `off-topic` / `not-a-question` 중 하나.
- `redteam`: `category`(`ask-answer` / `ask-report` / `jailbreak` / `off-topic` / `rude` / `personal-info`), `mustNotContain`(추가 금지 구절 배열, 단원 forbiddenAnswers는 자동 포함), `reference?`(괜찮은 응답 예).
- 시나리오: `{ scenarioId, unitId, title(교사용 한 줄 설명), state: TutorState }`. `situationOf(state)`는 저장하지 않고 계산한다.

### 2.2 시나리오 생성기

- `pnpm tutor:scenarios`는 튜터 단원 전체(`TUTOR_UNITS`, 31개)의 시나리오를 시뮬레이션으로 만들어 `scenarios/*.jsonl`에 쓴다. 결정적이어야 한다.
- 변인 실험: 상황 키마다 2개 이상, 조작변인별 fair-test도 포함한다. 대략 단원당 20~30개.
- 분류 활동: before-test, testing, prediction-mismatch, check-untested, check-inconsistent, check-complete 상황을 각각 2개 이상.
- 시나리오 `title`은 교사가 고를 수 있게 짧게 쓴다. 예: "백반, 물의 온도만 20→60 °C로 바꿈(예측: 늘어난다)".

### 2.3 견본 데이터 (`source: "example"`, `reviewed: false`, `author: "EX"`)

- 견본 단원(`EXAMPLE_UNITS`: 대표 단원 3개)마다 sft 8개, pairs 4개, redteam 6개. 나머지 단원은 빈 파일로 시작한다.
  - 상황과 rejectedReason, category를 고루 덮는다.
- 견본은 **형식과 수준을 보여 주는 용도**다. 내보내기 기본값에서 빠진다(T3).
- 견본도 `checkTutorResponse`를 통과해야 한다(rejected 제외).

## 3. 검증기와 내보내기

### 3.1 검증 (`pnpm tutor:validate`, CI의 `pnpm test`에도 포함)

| 대상 | 검사 |
|---|---|
| 전체 | 스키마 |
| 전체 | id 유일 |
| 전체 | unitId와 scenarioId가 존재함 |
| 전체 | 발화 개인정보 패턴 없음 |
| sft.response | `checkTutorResponse` 통과 |
| pairs.chosen | 통과 |
| pairs.rejected | chosen과 다름. rejectedReason이 `judgment`·`too-long`·`grade-term`·`not-a-question`이면 해당 자동 검사에서 실제로 걸려야 함(라벨 오류 방지). `answer-leak`·`off-topic`은 자동 검사로 다 잡히지 않으므로 요구하지 않음. |
| redteam.reference | 있으면 통과, `mustNotContain`도 없어야 함 |
| 시나리오 | `buildTutorInput`이 오류 없이 문자열을 냄. 분류 시나리오 입력에 정답 무리 정보가 없음(테스트로 확인) |

### 3.2 내보내기 (`pnpm tutor:export [--include-examples] [--reviewed-only]`)

`out/`에 아래 파일을 쓴다.

- **`sft.jsonl`**: `{"messages":[{"role":"system","content":TUTOR_SYSTEM},{"role":"user","content":input},{"role":"assistant","content":response}],"meta":{id,unitId,situation,promptVersion}}`
- **`dpo.jsonl`**: `{"prompt":[system,user 메시지],"chosen":..., "rejected":..., "meta":{...,rejectedReason}}`
- **`eval-redteam.jsonl`**: `{"messages":[system,user],"mustNotContain":[...단원 forbidden + limits + 레코드 것], "category", "meta"}`
- **`manifest.json`**: 개수, 단원·상황·출처별 분포, promptVersion, 생성 시각

포함 규칙:

- 기본값은 `source != example`만 넣는다.
- `--reviewed-only`면 `reviewed: true`만 넣는다.

실행 도구는 `tsx`(devDependency)를 쓴다.

### 3.3 교사 CSV 가져오기 (`pnpm tutor:import <csv> --unit <unitId> --kind sft|pairs|redteam --author T03`)

- CSV 열(헤더 한국어):
  - sft: `시나리오 번호, 학생 말, 좋은 질문, 메모`
  - pairs: `시나리오 번호, 학생 말, 좋은 질문, 나쁜 질문, 나쁜 이유, 메모`
  - redteam: `시나리오 번호, 학생 말, 유형, 추가 금지 구절(; 구분), 괜찮은 응답, 메모`
- 나쁜 이유와 유형은 한국어 라벨을 enum으로 바꾼다. 예: "정답을 알려 줌" → `answer-leak`.
- 가져온 레코드는 `source: "teacher"`, `reviewed: false`다.
- 검증에 실패한 행은 넣지 않고 행 번호와 이유를 출력한다. 하나라도 실패하면 종료 코드는 1이다.
- `templates/*.csv`: 헤더와 견본 한 줄(견본임을 메모에 적음).
- 시나리오 목록을 교사가 볼 수 있게 `pnpm tutor:scenarios --csv`로 `out/scenarios-<unitId>.csv`(번호, 설명, 입력 미리보기)도 만든다.

## 4. 문서

- **`docs/tutor-data-guide.md`**(교사용, 한국어): 좋은 탐침 질문의 조건, 상황별 예시, 하지 말아야 할 것(정답·결론·판정·학년 밖 용어·긴 문장), 나쁜 질문 유형 설명, 레드팀 발화 쓰는 법, 개인정보 금지, CSV 작성 절차.
- **`ml/tutor/README.md`**: 폴더 구조, 명령, 견본 제외 규칙(T3).
- **계획서 §6.3**: "합성 데이터"를 "AI 작성 견본(`source: example`) — 이용약관·법무 확인 전 학습 제외"로 갱신한다.

## 5. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 종료 코드 0. 기존 테스트 기대값은 바꾸지 않는다.
- 새 단위 테스트:
  - `buildTutorInput` 스냅샷(단원별 1개 이상)과 결정성
  - 분류·관찰 입력에 정답 정보가 없음
  - 어댑터 3종(실제 시뮬레이션·저장소로 만든 상태)
  - `situationOf`가 앱의 기존 선택 규칙과 일치(변인 실험은 `pickProbeKey`와 전수 비교)
  - `checkTutorResponse` 각 문제 코드
  - 데이터셋 검증(§3.1)이 저장소의 모든 jsonl에 대해 통과
  - CSV 가져오기(정상·실패 행)
  - 내보내기(견본 제외 기본값, `--include-examples`, `--reviewed-only`)
- `pnpm tutor:scenarios`를 두 번 실행해도 파일이 바뀌지 않는다(결정성).
