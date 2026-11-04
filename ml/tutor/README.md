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

대표 단원: `g5-solution`(용해와 용액), `g4-gases`(여러 가지 기체), `g6-acid-base`(산과 염기).

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
