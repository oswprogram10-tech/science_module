# 구현 사양: 3학년 「동물의 생활」 최소 활동 (v0) — 카드 분류(새 활동 유형)

> 앞 사양: `phase2-roadmap.md`(순서 6). 분류 활동의 본보기는 산과 염기(`indicator-classify`)이다. 관찰한 근거와 분류가 맞는지 확인하고, 정답 무리는 알려 주지 않는다.
> 새 활동 유형은 `card-sort`이다. 같은 유형을 식물의 생활(트리 변형), 물체와 물질, 지층과 화석(순서 변형)이 다시 쓴다. 이번에는 **무리 나누기(groups)** 형태만 만든다. 다만 스키마와 로직은 변형을 붙일 수 있게 둔다.

## 0. 결정

- 활동 유형 이름은 `card-sort`이다. 단원별 카드·기준·관찰 문장은 매니페스트에 둔다. 판정 로직은 단원과 무관한 순수 패키지 `@sci/cardsort`(`packages/cardsort`)에 둔다. 엔진 패키지에 두지 않는 까닭은 생명·물질·지구 단원이 함께 쓰기 때문이다.
- **관찰 근거 원칙**: 카드를 무리에 넣는 것은 언제든 할 수 있다. 다만 "확인하기"에서는 각 카드가 **지금 기준에 쓰는 특징을 학생이 관찰했는지**를 먼저 본다. 관찰하지 않은 카드는 "아직 살펴보지 않았어요"로 돌려준다. 관찰했는데 넣은 무리와 특징이 다르면 "관찰한 내용과 넣은 무리를 다시 비교해 볼까요?"로 돌려준다. 정답 무리는 어떤 경우에도 말하지 않는다.
- **분류 기준의 객관성**: 학습 목표는 "누가 분류해도 같은 결과가 나오는 기준"이다. 그래서 기준 목록에 주관적인 기준("귀여운가요?") 하나를 일부러 넣는다. 이 기준으로 확인하면 판정하지 않고 "누가 분류해도 같게 나오는 기준인가요?"라는 질문만 한다.
- **완료 조건**: 서로 다른 객관적 기준 2가지로 모든 카드를 관찰에 맞게 분류하면 완료이다.
- 예측 단계는 두지 않는다. 대신 카드를 고르면 먼저 "어느 무리일 것 같나요?"라는 튜터 질문이 나온다.

## 1. 활동 개요

- **탐구 질문**: "동물을 어떤 기준으로 분류할 수 있을까?"
- **카드 8장**: 개미, 달팽이, 지렁이, 고양이, 붕어, 게, 참새, 나비
- **관찰할 특징 3가지**: 사는 곳, 다리, 날개
- **분류 기준 4가지**:
  - `habitat` "어디에서 사나요?": 땅에서 사는 동물 / 물에서 사는 동물 / 날아다니는 동물
  - `legs` "다리가 있나요?": 있다 / 없다
  - `wings` "날개가 있나요?": 있다 / 없다
  - `cute` "귀여운가요?": 귀엽다 / 귀엽지 않다 — 주관적 기준(`objective: false`, 특징 없음)
- **특징표**(테스트로 고정)

| 카드 | habitat | legs | wings |
|---|---|---|---|
| 개미 | land | yes | no |
| 달팽이 | land | no | no |
| 지렁이 | land | no | no |
| 고양이 | land | yes | no |
| 붕어 | water | no | no |
| 게 | water | yes | no |
| 참새 | air | yes | yes |
| 나비 | air | yes | yes |

  - 게는 "물에 사는 동물은 다리가 없다"는 오개념을 흔든다.
  - 나비는 "날개가 있으면 새"라는 오개념을 흔든다.
  - 개미는 일개미(날개 없음)로 그리고 관찰 문장에도 그렇게 쓴다.
- **관찰 문장**(카드 × 특징, 매니페스트에 둔다. 판정 단어 없이 보이는 사실만 쓴다)
  - 개미
    - 사는 곳: "땅 위와 땅속 굴을 오가며 살아요."
    - 다리: "다리가 6개 있어요."
    - 날개: "일개미에게는 날개가 없어요."
  - 달팽이
    - 사는 곳: "축축한 땅 위나 풀잎에서 살아요."
    - 다리: "다리가 없어요. 배발로 미끄러지듯 기어가요."
    - 날개: "날개가 없어요."
  - 지렁이
    - 사는 곳: "땅속에서 흙을 먹으며 살아요."
    - 다리: "다리가 없어요. 몸을 늘였다 줄였다 하며 움직여요."
    - 날개: "날개가 없어요."
  - 고양이
    - 사는 곳: "땅 위에서 걷고 뛰며 살아요."
    - 다리: "다리가 4개 있어요."
    - 날개: "날개가 없어요."
  - 붕어
    - 사는 곳: "강이나 연못 물속에서 살아요."
    - 다리: "다리가 없어요. 지느러미로 헤엄쳐요."
    - 날개: "날개가 없어요."
  - 게
    - 사는 곳: "바닷가 물속과 갯벌에서 살아요. 아가미로 숨을 쉬어요."
    - 다리: "다리가 10개 있어요. 그중 2개는 집게다리예요."
    - 날개: "날개가 없어요."
  - 참새
    - 사는 곳: "날개로 하늘을 날아다니며 살아요."
    - 다리: "다리가 2개 있어요."
    - 날개: "날개가 2개 있어요. 깃털로 덮여 있어요."
  - 나비
    - 사는 곳: "날개로 꽃 사이를 날아다니며 살아요."
    - 다리: "다리가 6개 있어요."
    - 날개: "날개가 4장 있어요. 가루 같은 비늘로 덮여 있어요."
- **용어**: "분류", "분류 기준", "특징"을 쓴다. 곤충·절지동물·척추동물 같은 분류학 용어는 쓰지 않는다(`limits`).

## 2. 판정 로직 (`@sci/cardsort`, `packages/cardsort/src/index.ts`)

순수 함수이고 난수가 없다. React를 쓰지 않는다.

```ts
export interface SortState {
  criterion: string | null;                 // 지금 기준 key
  observed: Record<string, string[]>;       // 카드 key → 관찰한 특징 key들(순서 유지, 중복 없음)
  placement: Record<string, string | null>; // 카드 key → 무리 key (지금 기준의 무리)
  completed: string[];                      // 관찰에 맞게 끝낸 객관적 기준 key들(중복 없음)
  checked: SortCheck | null;
}
export type SortCheckKind = 'check-subjective' | 'check-unplaced' | 'check-unobserved' | 'check-inconsistent' | 'check-complete';
export interface SortCheck { kind: SortCheckKind; items: { card: string; status: 'ok' | 'unobserved' | 'inconsistent' | 'unplaced' }[] }
```

- 초기 상태, `chooseCriterion`, `observe`, `place`, `check`, `isFinished`(completed에 객관적 기준이 2개 이상)를 둔다.
- `chooseCriterion`: 기준을 바꾸면 placement와 checked를 비운다. observed와 completed는 남긴다.
- `observe`: 같은 특징을 다시 관찰해도 늘지 않는다.
- `place`: 기준이 없거나 그 기준의 무리 key가 아니면 상태를 바꾸지 않는다. `null`이면 카드를 빼낸다. 무리를 옮기면 `checked`를 비운다.
- `check`의 우선순위는 아래 순서이다. 앞 단계에서 걸리면 거기서 끝난다.
  1. 주관적 기준이면 `check-subjective`이다. 카드마다 status `ok`로 두고 completed에 넣지 않는다.
  2. 무리에 넣지 않은 카드가 있으면 `check-unplaced`이다.
  3. 기준의 특징을 관찰하지 않은 카드가 하나라도 있으면 `check-unobserved`이다. 해당 카드들은 `unobserved`이다.
  4. 관찰했지만 무리와 특징값이 다른 카드가 있으면 `check-inconsistent`이다. 해당 카드들은 `inconsistent`이다.
  5. 그 밖에는 `check-complete`이고, 기준을 completed에 넣는다.
- 기준의 무리는 특징값과 1:1로 대응한다. 매니페스트의 `groups[].value`가 특징값이다.
- `validateCardSortExperiment(exp)`는 아래를 검사한다.
  - 객관적 기준의 `feature`가 `features`에 있는가
  - 각 카드에 모든 특징값과 관찰 문장이 있는가
  - 특징값이 그 특징을 쓰는 기준의 무리 value 중 하나인가
  - 주관적 기준에는 feature가 없는가
  - 객관적 기준이 2개 이상인가
- 테스트
  - §1 특징표를 고정한다.
  - 우선순위 5단계를 각각 확인한다.
  - 기준을 바꾸면 placement는 비고 observed는 남는다.
  - 주관적 기준은 완료에 들어가지 않는다.
  - 객관적 기준 2개를 끝내면 `isFinished`가 된다.

## 3. 스키마 (`@sci/schema`)

`experimentSchema` 판별 합집합에 `cardSortExperimentSchema`(module `'card-sort'`)를 추가한다.

```jsonc
{
  ...commonShape,                  // id, title, question 등 기존 공통 필드
  "module": "card-sort",
  "layout": "groups",              // enum. 이번에는 'groups'만 둔다. 나중에 'tree', 'order'를 추가한다.
  "features": [ { "key": "habitat", "label": "사는 곳" }, ... ],
  "criteria": [
    { "key": "habitat", "label": "어디에서 사나요?", "feature": "habitat", "objective": true,
      "groups": [ {"value":"land","label":"땅에서 사는 동물"}, {"value":"water","label":"물에서 사는 동물"}, {"value":"air","label":"날아다니는 동물"} ] },
    { "key": "cute", "label": "귀여운가요?", "objective": false,
      "groups": [ {"value":"cute","label":"귀엽다"}, {"value":"notCute","label":"귀엽지 않다"} ] }
  ],
  "cards": [ { "key": "ant", "label": "개미", "icon": "ant",
               "features": { "habitat": "land", "legs": "yes", "wings": "no" },
               "observations": { "habitat": "…", "legs": "…", "wings": "…" } } ],
  "safetyChecklist": [],
  "tutor": { "forbiddenAnswers": [...], "probes": [ { "when": "...", "text": "..." } ] }
}
```

- `cardSortProbeWhen`: `choose-criterion`(기준 없음), `pick-card`(카드를 고르지 않음), `before-observe`(고른 카드의 지금 기준 특징을 아직 관찰하지 않음), `sorting`, `check-subjective`, `check-unplaced`, `check-unobserved`, `check-inconsistent`, `check-complete`, `finished`.
- probe 문장의 `{card}`와 `{criterion}`을 치환한다. 조사는 기존 `josa`와 `renderProbe` 방식을 따른다.
- 스키마 테스트
  - 정상 매니페스트를 통과시킨다.
  - 모르는 layout을 거부한다.
  - 판별 합집합에서 module로 갈라진다.

## 4. 매니페스트 (`content/units/g3-animal/manifest.json`)

- 단원 정보
  - id `g3-animal`, title "동물의 생활", grade 3, engine `"life"`
  - standards `["4과06-01"]`: 추정값이며 고시 대조가 필요하다(다른 단원과 같이 표시).
- 실험 정보
  - experiment id `animal-sort`, module `card-sort`, layout `groups`
  - title "동물을 특징에 따라 분류하기", question "동물을 어떤 기준으로 분류할 수 있을까?"
  - features: habitat 사는 곳, legs 다리, wings 날개
  - criteria: §1의 4가지. legs와 wings의 무리 value는 `yes`/`no`이고, 라벨은 "다리가 있다"/"다리가 없다", "날개가 있다"/"날개가 없다"이다.
  - cards: §1의 8장. icon key는 영어 소문자(ant, snail, earthworm, cat, crucian, crab, sparrow, butterfly)이다.
  - limits: ["곤충", "절지동물", "척추동물", "무척추동물", "포유류", "연체동물"]
  - safetyChecklist: [], safetyNotices: []
- tutor.forbiddenAnswers는 정답 누설 문장이다. 아래를 모두 넣는다.
  - "게는 물에서 사는 동물"
  - "나비는 날아다니는 동물"
  - "지렁이는 다리가 없"
  - "달팽이는 다리가 없"
  - "붕어는 다리가 없"
  - "게는 다리가 있"
  - "나비는 날개가 있"
  - "개미는 날개가 없"
  - "귀여운가는 분류 기준이 될 수 없"
- tutor.probes는 상황마다 하나 이상 둔다.
  - choose-criterion: "동물들을 어떤 기준으로 나누어 볼까요? 누가 나누어도 같은 결과가 나오는 기준을 골라 보세요."
  - pick-card: "어떤 동물부터 살펴볼까요? 카드를 하나 골라 보세요."
  - before-observe: "{card}을(를) 무리에 넣기 전에 '{criterion}'에 맞는 특징을 먼저 살펴볼까요?"
  - sorting: "{card}의 관찰 내용을 보고 어느 무리에 넣을지 정해 볼까요? 왜 그 무리라고 생각했나요?"
  - check-subjective: "'{criterion}'로 나누면 친구와 내 결과가 같을까요? 누가 나누어도 같게 나오는 기준인지 생각해 볼까요?"
  - check-unplaced: "아직 무리에 넣지 않은 카드가 있어요. 모든 카드를 넣어 볼까요?"
  - check-unobserved: "{card}은(는) 아직 살펴보지 않았어요. 돋보기로 특징을 먼저 관찰해 볼까요?"
  - check-inconsistent: "{card}에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?"
  - check-complete: "관찰한 특징과 분류가 잘 맞아요. 이번에는 다른 기준으로도 나누어 볼까요?"
  - finished: "두 가지 기준으로 나누어 보았어요. 같은 동물이 기준에 따라 다른 무리에 들어간 것을 찾아볼까요?"
- **전수 가드**
  - 모든 probe를 모든 카드·기준 라벨로 치환한 문장이 금지 구절에 걸리지 않아야 한다.
  - 피드백 문장(아래 §5)도 같은 방식으로 걸리지 않아야 한다.
  - 특히 check-subjective 문장이 "귀여운가는 분류 기준이 될 수 없"에 걸리지 않는지 본다.

## 5. 화면 (`apps/student/src/modules/card-sort/`)

`indicator-classify`의 `ClassifyLab` 구성(왼쪽 대상, 오른쪽 무리, 아래 튜터·피드백)을 따른다. 끌어 놓기만으로 조작하게 하지 않는다. 고르기→무리 버튼 누르기로 하고 키보드로도 된다.

- **기준 고르기**: 라디오 그룹 "분류 기준"에 4가지를 둔다. 바꾸면 무리 칸이 기준의 무리로 바뀌고, 넣어 둔 카드는 다시 카드 더미로 돌아간다. 이때 "기준을 바꾸어서 카드를 다시 나눠요."를 알린다(aria-live).
- **카드 더미**
  - 카드는 SVG 그림(단순 도형, 아이콘 key별 컴포넌트, 다크 모드에서도 보이게)과 이름으로 그린다.
  - 관찰한 특징 수를 작은 점 3개로 보여 준다(글자로도 "관찰 2/3").
  - 판정 색(맞음/틀림)은 칠하지 않는다.
- **돋보기(카드 상세)**
  - 고른 카드를 크게 보여 준다. "사는 곳 살펴보기", "다리 살펴보기", "날개 살펴보기" 버튼을 둔다.
  - 누르면 관찰 문장이 "관찰 기록"에 쌓인다.
  - 아직 관찰하지 않은 특징의 문장은 DOM에 넣지 않는다.
- **무리 칸**: 지금 기준의 무리마다 칸을 두고, 칸 제목에 무리 라벨을 쓴다. 고른 카드는 "〈무리 라벨〉에 넣기" 버튼으로 넣고, 무리 안 카드는 "빼기"로 뺀다.
- **확인하기**: 모든 카드를 넣었을 때 활성화한다. 피드백 문장(판정 단어와 정답 무리 없이)은 아래와 같다.
  - subjective: "이 기준은 사람마다 다르게 나눌 수 있어요. 누가 나누어도 같은 결과가 나오는 기준을 골라 볼까요?"
  - unobserved: "{카드들}은(는) 아직 이 기준의 특징을 살펴보지 않았어요."
  - inconsistent: "{카드들}은(는) 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?"
  - complete: "관찰한 특징과 분류가 서로 잘 맞아요."
  - 카드 목록은 `josa`로 조사를 붙인다.
- **진행 표시**: "끝낸 기준: 어디에서 사나요?, 다리가 있나요? (2/2)". 2개를 끝내면 "두 가지 기준으로 분류했어요!"를 보여 준다.
- **튜터 상자**: `cardSortWhen`(`@sci/tutor`, 기존 `classifyWhen`과 같은 방식)으로 상황을 정하고 probe를 보인다. 출력은 guardOutput을 거친다.
- **xAPI·교실**
  - 기존 classify 활동이 보내는 것과 같은 수준으로 보낸다(기준 선택, 관찰, 확인 결과 kind). 정답 무리는 보내지 않는다.
  - 교사 대시보드 진행 표시는 classify 활동처럼 처리한다. 교사 검수 체크리스트와 교사 입력 화면에 새 유형이 걸리면 classify처럼 다룬다. 다룰 수 없으면 그 단원을 목록에서 빼고 보고한다.

## 6. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 종료 코드 0이어야 한다. 기존 기대값은 바꾸지 않는다(단원 수·카드 수 단언만 조정).
- 새 단위 테스트
  - `@sci/cardsort`(§2)
  - 스키마(§3)
  - 튜터 전수 가드(§4)
  - 레지스트리
  - 피드백 문장
- 새 E2E (`e2e/animal.spec.ts`)
  - 기준 "다리가 있나요?"를 고른다. 관찰 없이 8장을 넣고 확인하면 "아직 이 기준의 특징을 살펴보지 않았어요"가 보인다. 정답 무리 라벨을 가리키는 문장은 없다.
  - 8장의 다리를 관찰하고 게를 "다리가 없다"에 넣고 확인하면 "게는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?"가 보인다. 게를 옮기면 "서로 잘 맞아요"가 보인다.
  - "귀여운가요?"로 나누고 확인하면 "사람마다 다르게" 문장이 보이고, 끝낸 기준 수는 늘지 않는다.
  - "어디에서 사나요?"까지 끝내면 "두 가지 기준으로 분류했어요!"가 보인다.
  - 기준을 바꾸면 무리 칸이 비고, 관찰 기록은 남는다.
  - 키보드만으로 카드 고르기→관찰→넣기를 할 수 있다.
  - SVG 글자는 13 px 이상이다.
  - 기존 `routing`, `layout`, `a11y`(밝게·어둡게) spec에 새 단원을 추가한다.
- 문서: `docs/testing.md`, README 단원 목록, `docs/specs/phase2-roadmap.md` 카드 분류 행에 "`@sci/cardsort` 공통 로직" 메모를 단다.
