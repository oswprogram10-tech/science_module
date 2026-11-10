# 이동 사양: 흐르는 물 실험을 3학년 「지구와 바다」에서 4학년 「땅의 변화」로 옮김

> 근거: 교육과정 원문(교육부 고시 제2022-33호 [별책 9])은 흐르는 물의 작용과 강 주변 지형을 3~4학년 「땅의 변화」(4과11-01)에 둔다. 원문의 「지구와 바다」(4과06)는 육지와 바다, 바닷물, 밀물·썰물과 갯벌을 다룬다(`docs/curriculum-standards.md`).
> 앞 사양: `g3-earth-sea-mvp.md`(흐르는 물 실험), `multi-activity-mixture-ext.md`(한 단원 여러 활동).
> 실험 내용(모듈 `stream-table`, 계산, 화면, 문구)은 바꾸지 않고 **자리만 옮긴다.**

## 0. 결정

- **「땅의 변화」(`content/units/g4-land/manifest.json`)**
  - `experiments`에 흐르는 물 실험(experiment id `stream-table`)을 **두 번째 활동**으로 덧붙인다.
  - 기존 `magma-cooling`은 첫 활동 그대로 둔다.
  - 실험 정의(변인, 안전, limits, tutor의 probes와 forbiddenAnswers, 문구)는 `g3-earth-sea`에서 글자 그대로 옮긴다.
  - `standards`는 `["4과11-01", "4과11-03"]`로 바꾼다.
  - 두 활동은 엔진(`earth`)이 같다.
- **「지구와 바다」(`g3-earth-sea`)**
  - 활동이 남지 않으므로 **단원을 앱에서 뺀다.** 앱은 31개 단원이 된다.
  - `content/units/g3-earth-sea/` 폴더를 지우고, 학생 앱 단원 목록에서도 뺀다.
  - 원문 내용(4과06)으로 새로 만드는 일은 나중 과제로 남긴다. `docs/curriculum-standards.md`에 적는다.
  - `docs/specs/g3-earth-sea-mvp.md`는 기록으로 남기고 맨 위에 이동 메모를 단다.
- **주소**
  - `#/unit/g3-earth-sea`는 이제 없는 단원이다. 앱은 모르는 단원 id를 목록으로 돌린다(기존 동작). 따로 넘겨 주는 주소는 두지 않는다.
  - 흐르는 물 실험은 `#/unit/g4-land/stream-table`로 연다.
- **진로 단원(`g6-career`)**
  - 직업 카드의 관련 단원 등에 있는 `g3-earth-sea` 참조를 `g4-land`로 바꾼다.
  - 같은 카드에 `g4-land`가 이미 있으면 하나만 남긴다.
  - 영역별 단원 목록에 들어 있으면 같은 방식으로 정리한다.
  - 기록장 요약은 unitId 단위이므로 옛 기기 기록의 `g3-earth-sea`는 모르는 단원으로 무시되어야 한다. 오류가 나면 안 되며, 테스트로 확인한다.
- **교실과 교사 앱**: 교사 앱 단원 목록이 매니페스트에서 오면 자동으로 따라간다. 하드코딩되어 있으면 고친다. 「땅의 변화」는 활동이 둘이 되므로 교사 화면에 활동 이름이 보여야 한다.

## 1. 튜터 데이터
- 시나리오 생성기는 단원의 모든 experiment를 돈다(`multi-activity-mixture-ext.md`).
  - `ml/tutor/scenarios/g4-land.jsonl`은 기존 줄을 **바이트 단위로 그대로** 두고, 흐르는 물 활동 시나리오를 뒤에 덧붙인다.
  - `ml/tutor/scenarios/g3-earth-sea.jsonl`은 지운다.
- `ml/tutor/data/g3-earth-sea/`의 sft·pairs·redteam 예시를 `ml/tutor/data/g4-land/`의 해당 파일 끝으로 옮긴다.
  - 새 시나리오 id와 `unitId`, 예시 id 규칙은 기존 g4-land 예시를 따른다.
  - 옮긴 예시마다 **새 시나리오의 상태가 예시의 학생 말·응답과 맞는지** 확인한다. 생성기 변형 순서가 바뀌어 상태가 달라질 수 있다. 맞지 않으면 같은 상황(situation)이고 상태가 맞는 다른 시나리오로 연결한다. 그런 시나리오가 없으면 고치지 말고 목록으로 보고한다.
- `packages/tutor/src/datasetIo.ts`의 단원 목록(`TUTOR_UNITS`, `RICH_EXAMPLE_UNITS` 등)에서 `g3-earth-sea`를 뺀다. g4-land가 목록에 있는지 확인한다.
- 단원별 상한·개수 테스트는 숫자만 조정한다.
- `pnpm tutor:validate`가 통과해야 한다. 전체 시나리오 수는 그대로(696)여야 하고, 다르면 까닭을 보고한다.

## 2. 테스트
- 단위 테스트
  - 단원 수 32 → 31
  - g4-land의 활동 2개와 순서
  - g4-land standards
  - stream-table 모듈 테스트가 g4-land 매니페스트를 보게 함
  - 진로 단원 참조
  - 기록장의 옛 unitId 무시
- E2E
  - `earth-sea.spec.ts`를 g4-land의 두 번째 활동 주소(`#/unit/g4-land/stream-table`) 또는 탭으로 열도록 바꾼다(파일 이름은 `land-stream.spec.ts` 등으로 바꿔도 된다). 실험 기대값은 그대로 둔다.
  - routing·layout·a11y·svg-text의 단원 목록에서 g3-earth-sea를 뺀다. g4-land의 두 활동이 모두 검사되는지 확인한다.
  - `#/unit/g3-earth-sea`가 단원 목록으로 돌아가는지 확인한다.
  - 「땅의 변화」 첫 활동(마그마)의 기존 E2E는 그대로 통과해야 한다.
  - g4-land는 이제 활동이 둘이다. 활동 하나인 단원의 DOM 해시 목록에 들어 있으면 빼고 까닭을 적는다.
- 기존 기대값은 바꾸지 않는다. 단원 수, 활동 수, 시나리오와 예시의 위치·수, 해시, 성취기준만 조정한다.
- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`가 모두 종료 코드 0이어야 하고, `pnpm tutor:validate`가 통과해야 한다.

## 3. 문서
- `docs/curriculum-standards.md`
  - g3-earth-sea 행을 빼고 g4-land 행을 4과11-01·4과11-03으로 고친다.
  - "결정 필요" 1번을 "해결: 흐르는 물 실험을 땅의 변화로 옮김. 원문의 지구와 바다(4과06) 단원은 아직 없음(나중 과제)"으로 바꾼다.
- README의 단원 표와 단원 수(32 → 31)를 고친다.
- `docs/testing.md`, `docs/specs/phase2-roadmap.md`의 해당 행, `ml/tutor/README.md`(단원 수·시나리오 수)를 고친다.
- `docs/specs/g3-earth-sea-mvp.md` 맨 위에 이동 메모를 단다.
