# 튜터 모델 학습 데이터 (ml/tutor)

온디바이스 튜터 모델(계획서 §6)의 학습·평가 데이터와 도구다. 사양은 `docs/specs/tutor-data-v0.md`, 교사용 작성 안내는 `docs/tutor-data-guide.md`.

## 폴더

```
scenarios/<unitId>.jsonl     시나리오 라이브러리(생성기 출력, 커밋). 직접 고치지 않는다.
data/<unitId>/sft.jsonl      좋은 질문
data/<unitId>/pairs.jsonl    좋은/나쁜 질문 쌍(선호 학습)
data/<unitId>/redteam.jsonl  평가용 공격 발화
templates/teacher-*.csv      교사용 CSV 양식(헤더 + 견본 한 줄)
out/                         내보내기 결과(.gitignore)
```

단원: 튜터가 있는 모든 단원 31개(진로 포트폴리오 `g6-career`만 뺀다). 목록은 `packages/tutor/src/datasetIo.ts`의 `TUTOR_UNITS`(학년 순, 같은 학년은 앱 목록 순서)이고, 시나리오·`data/<단원>/`·검증·가져오기(`--unit`)가 모두 이 목록을 따른다. 새 단원을 넣으려면 `TUTOR_UNITS`에 추가하고 `pnpm tutor:scenarios`로 시나리오를 만든 뒤 `data/<단원>/`에 빈 `sft.jsonl`, `pairs.jsonl`, `redteam.jsonl`을 둔다.

시나리오 종류: 변인 실험(`genVariable`), 분류 활동(`genClassify`), 카드 분류(`genCardSort`: 무리 나누기·트리·순서 놓기), 관찰(`genObservation`: 과제마다 관찰 전·관찰 중·기록 불일치·기록 일치·예측 불일치). 단원마다 20개 안팎(15~25개)이다(활동이 여럿인 단원은 활동마다 만들어 더 많다: `g4-land` 42개). 전체 시나리오는 750개다(지구와 바다는 활동 2 밀물과 썰물 관찰하기의 10개가 20개 뒤에 덧붙어 30개, 날씨와 우리 생활은 활동 2 이슬·안개·구름 비교하기의 24개가 20개 뒤에 덧붙어 44개). 관찰 활동은 과제당 5개라서 과제가 늘면 그만큼 늘어난다(밤하늘 관찰은 과제 6개 = 30개, 견본 sft 6개: 달 모양 과제마다 1개씩 더함).

견본(`source: "example"`)은 31개 단원 모두에 있다. 대표 단원 `g5-solution`, `g4-gases`, `g6-acid-base`(`RICH_EXAMPLE_UNITS`)는 sft 8 · pairs 4 · redteam 6개, 나머지 단원은 sft 4 · pairs 2 · redteam 3개다(활동이 둘인 `g4-land`는 활동마다 4 · 2 · 3개라서 sft 8 · pairs 4 · redteam 6개다. 지구와 바다와 날씨와 우리 생활은 활동 2의 견본 sft 2 · pairs 1 · redteam 1개가 더해져 각각 sft 6 · pairs 3 · redteam 4개다). 교사 글은 견본 뒤에 이어서 가져와진다.

## 명령(저장소 루트에서)

| 명령 | 하는 일 |
|---|---|
| `pnpm tutor:scenarios [--csv]` | 시뮬레이션으로 시나리오를 만들어 `scenarios/*.jsonl`에 쓴다(결정적). `--csv`는 교사용 목록 `out/scenarios-<unitId>.csv`도 만든다. |
| `pnpm tutor:validate` | 전체 jsonl 검증(스키마, id 유일, 시나리오 존재, 개인정보 패턴, 출력 규칙, 나쁜 이유 라벨). `pnpm test`에도 포함된다. |
| `pnpm tutor:export [--include-examples] [--reviewed-only]` | `out/`에 `sft.jsonl`, `dpo.jsonl`, `eval-redteam.jsonl`, `manifest.json`을 쓴다. |
| `pnpm tutor:import <csv> --unit <unitId> --kind sft\|pairs\|redteam --author T03` | 교사 CSV를 가져온다. 실패한 행은 넣지 않고 행 번호와 이유를 출력하며, 하나라도 실패하면 종료 코드 1. |

## 견본 제외 규칙 (T3)

`source: "example"` 레코드는 AI(Claude)가 형식과 수준을 보여 주려고 쓴 **견본**이다(`reviewed: false`, `author: "EX"`).
AI 출력물로 다른 모델을 학습해도 되는지는 이용약관·법무 확인 전까지 보류한다(계획서 §6.3). 그래서 `tutor:export`는 기본으로 견본을 **뺀다**.
견본을 넣으려면 `--include-examples`를 명시한다(형식 점검·평가 하네스 시험용). 실제 학습 데이터는 교사가 쓴다(`source: "teacher"`).

## 입력 형식

모델 입력은 실험 상태(`TutorState`)로 저장하고, 학습과 앱 추론이 같은 함수 `buildTutorInput`(`packages/tutor/src/context.ts`)으로 문장화한다. 형식을 바꾸면 `PROMPT_VERSION`을 올리고 내보내기를 다시 한다.

## 시나리오 번호

시나리오 번호(`<unitId>-s001` ...)는 생성 순서다. 데이터가 쌓인 뒤에는 생성 규칙을 바꾸어 번호가 밀리지 않게, 새 시나리오를 규칙의 맨 뒤에 덧붙이는 방식으로만 늘린다. 테스트(`scenarios.test.ts`)가 저장소의 jsonl이 생성기 출력과 같은지 확인한다.

## 교사 입력 화면(웹 페이지)

교사는 claude.ai에 올린 "튜터 질문 작성실" 페이지에서 시나리오를 골라 글을 씁니다. 페이지의 검사 규칙은 `packages/tutor/src/check.ts`와 같고, 시나리오 목록과 입력 미리보기는 아래 명령으로 만든 JSON을 페이지에 넣은 것입니다. 시나리오를 다시 만들면 이 JSON도 다시 만들어 페이지를 갱신해야 합니다.

```
pnpm tutor:authoring-data <출력 파일.json>
```

페이지에 저장된 글은 개발팀이 읽어 `data/<unitId>/*.jsonl`로 가져옵니다(`source: "teacher"`, `reviewed: false`).
