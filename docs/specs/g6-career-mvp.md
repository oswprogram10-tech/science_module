# 구현 사양: 6학년 「과학과 나의 진로」 최소 활동 (v0) — 탐구 기록장과 진로 포트폴리오(새 활동 유형)

> 앞 사양: `phase2-roadmap.md`(순서 22, 마지막). 새 활동 유형 `portfolio`이다.
> 이 단원은 앞 단원들의 탐구 기록이 필요하다. 지금 앱은 시행 기록을 단원을 나가면 버린다(xAPI `MemoryRecorder`도 활동마다 메모리에만 둔다). 그래서 **기기 안 "탐구 기록장"**을 새로 만든다.

## 0. 결정 (D11 후보 — `docs/DEVELOPMENT_PLAN.md` 의사결정 기록에 추가)

- **탐구 기록장은 기본으로 꺼져 있다.**
  - 학교 태블릿은 여러 학생이 함께 쓸 수 있다. 그래서 학생이 단원 목록의 "탐구 기록장" 카드에서 직접 켜야 기록된다.
  - 켤 때 안내 대화 상자(`role="dialog"`)에 쉬운 말로 적는 내용:
    - 무엇을 남기는지
    - 이 기기에만 남는다는 것
    - 서버·선생님 화면으로 보내지 않는다는 것
    - 언제든 모두 지울 수 있다는 것
    - 같은 기기를 쓰는 친구가 볼 수 있다는 것
- **남기는 것(최소화)**: 단원 id, 활동 종류, 날짜(일 단위), 다음 이벤트 요약.
  - 변인 실험: 시행 수, 공정한 비교로 확인한 변인 key 목록, 예측이 맞은 횟수/전체 횟수
  - 분류 활동(indicator-classify, card-sort): 확인 완료 여부, 끝낸 기준 수
  - 관찰 활동: 기록이 모델과 맞은 과제 수
  - 학생이 진로 단원에서 쓴 글(선택)
- **남기지 않는 것**
  - 이름, 가명 ID, 교실 코드
  - 시행별 상세값
  - 튜터 대화
  - 심박 실측값(`realPulse/`는 기록장 코드를 가져오지 않는다. 의존 검사 테스트로 보장)
- **저장소**: `localStorage` 키 하나(`sci-bridge.logbook.v1`)에 JSON으로 둔다. 크기는 200 KB 상한을 넘지 않게 한다. 넘치면 오래된 항목부터 버린다. 접근은 모두 try/catch로 감싸고, 저장소가 막혀 있으면 "이 기기에서는 기록장을 쓸 수 없어요"를 보여 준다.
- **끄기/지우기**: "기록장 끄기"는 기록을 멈추고, 남은 기록을 지울지 묻는다. "모두 지우기"는 키를 삭제한다.
- 진로 단원 자체는 기록장이 꺼져 있어도 열 수 있다. 이때는 "기록이 없어요"와 함께 직업 카드 탐색만 할 수 있다.
- 법무 확인: 학생 작성 글이 기기에 남는 점을 `docs/app-packaging.md`의 개인정보 절에 추가한다(D10과 같은 절).

## 1. 기록장 (`apps/student/src/logbook/`)

- `logbook.ts`: 순수 함수와 저장 어댑터를 둔다.
  - `LogEntry = { unitId, kind: 'variable'|'classify'|'card-sort'|'observation'|'portfolio', day: 'YYYY-MM-DD', summary: {...} }`
  - `noteVariableTrial(unitId, {iv?, fair: boolean, predictionMatched?: boolean})`: 같은 단원·같은 날 항목을 갱신한다.
  - `noteClassifyComplete`, `noteCardSort(criteriaDone, finished)`, `noteObservation(taskId, matched)`
  - `isEnabled`, `enable`, `disable(clear: boolean)`, `clearAll`, `entries()`
- 저장 어댑터 `Storage` 인터페이스를 주입한다(테스트는 메모리 저장소). 날짜는 주입한 시계로 정한다.
- **연결 지점**: 각 활동이 이미 xAPI 문장을 만드는 곳(App.tsx, ClassifyLab, SortParts, ObserveLab)에서 기록장 함수를 함께 부른다. 기록장이 꺼져 있으면 아무것도 쓰지 않는다.
- 교실 연결 메시지와 xAPI 문장에는 기록장 내용을 넣지 않는다.
- `realPulse/`에서 `logbook`을 가져오지 않는다. 소스 검사 테스트로 확인한다.

## 2. 진로 단원 활동 (`portfolio`)

- **스키마** `portfolioExperimentSchema`(module `'career-portfolio'`)

```jsonc
{
  ...commonShape,
  "module": "career-portfolio",
  "areas": [ { "key": "matter", "label": "물질", "units": ["g5-solution","g4-gases","g6-acid-base","g6-combustion","g3-material","g4-water-state","g5-mixture"] }, ... ],
  "skills": [ { "key": "fair-test", "label": "공정하게 비교하기" }, { "key": "predict", "label": "예측하기" }, { "key": "classify", "label": "기준을 세워 분류하기" }, { "key": "observe", "label": "관찰하고 기록하기" }, { "key": "model", "label": "모형으로 설명하기" } ],
  "jobs": [ { "key": "...", "label": "...", "area": "...", "does": "한 문장", "skills": ["..."], "units": ["..."] } ],
  "prompts": { ... }
}
```

- **영역 5개**와 단원 배정
  - matter 물질: g5-solution, g4-gases, g6-acid-base, g6-combustion, g3-material, g4-water-state, g5-mixture
  - life 생명: g3-lifecycle, g6-plant, g4-ecosystem, g4-microbe, g5-body, g3-animal, g3-plantlife
  - earth 지구와 우주: g4-land, g6-earth-motion, g6-seasons, g3-earth-sea, g4-night-sky, g5-strata, g5-weather
  - energy 운동과 에너지: g5-heat, g5-light, g6-electricity, g3-force, g3-sound, g4-magnet, g6-motion
  - society 과학과 사회: g3-health, g4-climate, g5-energy
  - 아직 구현되지 않은 단원 id가 있어도 검사기는 경고만 하고 실패하지 않는다. 구현된 단원 id 목록과 대조해 "준비 중" 표시를 한다.
- **직업 카드 15장**(영역별 3장, 교사 검수 대상)
  - 물질: 화학 연구원, 식품 개발자, 신소재 공학자
  - 생명: 수의사, 식물 연구원, 미생물 연구원
  - 지구와 우주: 기상 예보관, 지질학자, 천문학자
  - 운동과 에너지: 로봇 공학자, 음향 기술자, 전기 기술자
  - 과학과 사회: 역학 조사관, 기후 변화 전문가, 신재생 에너지 기술자
  - 각 카드에는 "하는 일" 한 문장, 쓰이는 탐구 능력 2~3개, 관련 단원 1~3개를 둔다.
  - 사람 그림은 쓰지 않고 도구 아이콘을 쓴다(성별·외모 고정관념 방지). 모든 문장은 "이 일을 하는 사람은 …"처럼 성별 중립으로 쓴다.
- **화면 단계**(같은 페이지, 4단계 탭 또는 세로 순서)
  1. **내 탐구 기록**
     - 영역별로 기록이 있는 단원 수, 단원 이름, 날짜를 보여 준다.
     - 탐구 능력별 "해 본 횟수"를 보여 준다.
       - fair-test: 공정한 비교 시행 수
       - predict: 예측 맞음 횟수가 아니라 예측한 시행 수. 맞힌 수로 평가하지 않는다.
       - classify: 분류 완료 수
       - observe: 관찰 과제 기록 수
       - model: 미시 보기·모형 보기가 있는 단원의 실행 수
     - 막대 그래프로 그리되 비교·순위 문구는 쓰지 않는다.
  2. **관심 영역 고르기**
     - 학생이 1~2개를 고른다. 앱은 "기록이 많은 영역"을 참고로 표시만 하고, 미리 선택하지 않는다.
  3. **직업 카드 살펴보기**
     - 고른 영역의 카드를 먼저 보이고, "다른 영역도 보기"로 전체를 연다.
     - 카드에는 "내가 해 본 탐구 능력"을 표시한다(기록과 교집합). 관련 단원 버튼으로 해당 단원에 갈 수 있다.
  4. **나의 진로 탐색 카드 쓰기**
     - 관심 있는 직업(카드 선택 또는 직접 쓰기), "그 일에 쓰이는 나의 탐구 능력"(체크), "더 알아보고 싶은 것"(글, 200자)을 쓴다.
     - "인쇄하기" 버튼은 `window.print()`이고 인쇄용 CSS를 둔다. 기록장이 켜져 있으면 저장하고, 꺼져 있으면 "기록장을 켜야 저장돼요"를 보인다.
- **튜터**: 정답 누설 개념이 없는 활동이다. 단계별 생각 질문(probes)만 쓰고, 입력 가드(`guardOutput`)는 그대로 거친다.
  - 1단계 "어떤 탐구를 할 때 가장 재미있었나요?"
  - 2단계 "그 영역의 어떤 점이 궁금한가요?"
  - 3단계 "이 직업에서 쓰이는 탐구 능력 중 내가 해 본 것은 무엇인가요?"
  - 4단계 "더 알아보려면 누구에게, 어디에서 물어볼 수 있을까요?"
  - forbiddenAnswers는 비워 두고, 스키마는 빈 배열을 허용한다.
- **교실·xAPI**: 단계 진행만 보낸다(stage 1~4). 글·선택한 직업은 보내지 않는다.

## 3. 매니페스트 (`content/units/g6-career/manifest.json`)

- id `g6-career`, title "과학과 나의 진로", grade 6, engine "ssi"(엔진 계산 없음, 분류용), standards `["6과19-01"]`(추정, 고시 대조 필요)
- experiment id `career-portfolio`, title "나의 탐구 기록으로 진로 살펴보기", question "내가 해 온 과학 탐구는 어떤 일과 이어질까?"
- §2의 areas, skills, jobs(15장), prompts를 넣는다.
- `validatePortfolioExperiment`
  - 직업의 area·skills가 정의에 있는지
  - 영역마다 직업이 3장 이상인지
  - 단원 배정이 겹치지 않는지

## 4. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`는 모두 종료 코드 0이어야 한다. 기존 기대값은 바꾸지 않는다(단원 수·카드 수 단언만 조정).
- 단위 테스트
  - 기록장: 꺼져 있으면 쓰지 않음, 켜고 노트, 같은 날 병합, 지우기, 200 KB 상한, 저장소 예외 처리, 주입 시계
  - `realPulse/`가 `logbook`을 가져오지 않음(소스 검사)
  - 스키마, 검사기, 직업 카드 문장 성별 중립 단어 검사(금지 목록: "그는", "그녀는", "아저씨", "아주머니" 등)
  - 레지스트리
- E2E (`e2e/career.spec.ts`)
  - 기록장을 켜지 않고 변인 실험 단원에서 시행한 뒤 진로 단원에 가면 "기록이 없어요"가 보인다. localStorage에 기록장 키가 없다.
  - 기록장을 켜고(대화 상자 확인) 두 단원에서 시행한 뒤 진로 단원에 가면 영역별 기록에 두 단원이 보인다.
  - 관심 영역 선택 전에는 선택된 영역이 없다.
  - 직업 카드에 "내가 해 본 탐구 능력" 표시가 있다.
  - 진로 탐색 카드를 저장하고 새로 고침하면 남아 있다. "모두 지우기" 뒤에는 사라진다.
  - 내 맥박 재기(g5-body)에 값을 넣은 뒤에도 기록장 JSON에 그 숫자가 없다.
  - 교실에 연결한 상태에서 진로 단계 메시지에 글 내용이 없다.
  - 390px 폭에서 가로 스크롤이 없다. SVG 글자는 13px 이상이다.
  - routing·layout·a11y(밝게·어둡게)에 단원을 추가한다.
- 문서: `docs/testing.md`, README, `docs/DEVELOPMENT_PLAN.md` D11, `docs/app-packaging.md` 개인정보 절.
