# 구현 사양: 5학년 「지층과 화석」 최소 활동 (v0) — 지층 순서 맞추기와 화석으로 과거 환경 추리(card-sort order 변형)

> 앞 사양: `phase2-roadmap.md`(순서 17), `g3-animal-mvp.md`(groups), `g3-plantlife-mvp.md`(tree).
> 이번에는 `card-sort`에 **`layout: 'order'`**를 추가한다. 순서를 맞춘 뒤에는 같은 카드로 무리 나누기 한 단계(`followUp`)를 이어서 한다.

## 0. 결정

- 카드는 절벽에서 채집한 암석 표본 5개이다. 학생에게는 섞인 순서로 주어진다.
- 학생은 표본을 관찰한다. 관찰할 수 있는 것은 채집한 높이, 알갱이, 화석이다. 그다음 "먼저 쌓인 층 → 나중에 쌓인 층" 순서로 칸 1~5에 놓는다.
- 순서 판정의 근거는 **채집 높이**이다. 아래에 있는 층일수록 먼저 쌓였다(층이 뒤집히지 않은 지역이라고 안내 문구에 밝힌다).
- 확인 규칙은 groups와 같은 정신이다.
  1. 칸이 빈 카드가 있으면 `check-unplaced`이다.
  2. 높이를 관찰하지 않은 카드가 있으면 `check-unobserved`이다.
  3. 관찰한 높이와 놓은 순서가 어긋난 카드가 있으면 `check-inconsistent`이다. 이웃 칸과 높이 순서가 맞지 않는 카드를 모두 고른다.
  4. 나머지는 `check-complete`이다.
  - 정답 칸 번호는 말하지 않는다.
- 순서를 맞추면 `followUp` 기준 "이 층이 쌓일 때 그곳은 어떤 곳이었을까요?"가 열린다. 무리는 바다 / 육지 / 화석이 없어 알 수 없음이다. 근거 특징은 fossil이다. 판정은 groups의 `judgeCards`를 그대로 쓴다.
- **완료 조건**: 순서 확인 complete와 followUp complete이다. 주관적 기준은 이 단원에 두지 않는다.
- 층이 뒤집힌 지형, 부정합, 지층 대비는 다루지 않는다(`limits`).

## 1. 활동 개요

- **탐구 질문**: "지층이 쌓인 순서와 그때의 환경을 어떻게 알 수 있을까?"
- **카드 5장**(교사 검수 대상). 표의 순서가 정답 순서(먼저 → 나중)이다.

| key | 이름 | height(m) | grain | fossil | env |
|---|---|---|---|---|---|
| conglomerate | 역암 | 0.5 | gravel | none | unknown |
| sandstone | 사암 | 1.5 | sand | clam | sea |
| mudstone | 이암 | 2.5 | mud | fern | land |
| limestone | 석회암 | 3.5 | fine | coral | sea |
| shale | 셰일 | 4.5 | mud | leaf | land |

- 화면에 보이는 처음 순서는 셰일, 사암, 역암, 석회암, 이암으로 고정한다(난수 없음). 정답 순서와 다르다.
- **관찰 문장**
  - 역암
    - 높이: "절벽 바닥에서 0.5 m 높이에서 채집했어요."
    - 알갱이: "둥근 자갈이 모래와 섞여 굳어 있어요."
    - 화석: "화석이 보이지 않아요."
  - 사암
    - 높이: "절벽 바닥에서 1.5 m 높이에서 채집했어요."
    - 알갱이: "모래 알갱이가 굳어 있어요."
    - 화석: "조개 껍데기 모양의 화석이 있어요."
  - 이암
    - 높이: "절벽 바닥에서 2.5 m 높이에서 채집했어요."
    - 알갱이: "아주 고운 진흙이 굳어 있어요."
    - 화석: "고사리 잎 모양의 화석이 있어요."
  - 석회암
    - 높이: "절벽 바닥에서 3.5 m 높이에서 채집했어요."
    - 알갱이: "알갱이가 거의 보이지 않을 만큼 고와요."
    - 화석: "산호 모양의 화석이 있어요."
  - 셰일
    - 높이: "절벽 바닥에서 4.5 m 높이에서 채집했어요."
    - 알갱이: "고운 진흙이 얇은 판처럼 겹쳐 있어요."
    - 화석: "나뭇잎 모양의 화석이 있어요."
- **안내 문구**(처음부터 보임): "이 절벽의 지층은 쌓인 뒤에 뒤집히지 않았어요."
- **배경 지식 카드**
  - "조개·산호는 물속, 특히 바다에서 살아요. 고사리·나뭇잎은 땅에서 자라요."
  - 이 문장은 화석과 환경을 잇는 일반 지식이고, 카드별 정답은 말하지 않는다. 금지 구절과 겹치지 않는지 가드에서 확인한다.

## 2. 로직 (`@sci/cardsort` 확장)

- `OrderState`: `{ slots: (string|null)[], observed, checked, followUp: SortState-유사(placement, checked) }`
- 함수
  - `createOrder(cards, initialOrder)`: 처음에는 칸이 비어 있고, 더미가 initialOrder 순서이다.
  - `placeInSlot(state, card, slotIndex)`: 다른 칸에 있으면 옮긴다. 대상 칸에 카드가 있으면 두 카드를 맞바꾼다.
  - `removeFromSlot`, `checkOrder`, `followUpPlace`, `checkFollowUp`(순서 complete 전에는 무시), `isOrderFinished`
- 순서 판정 키는 매니페스트 `orderBy: { feature: "height", direction: "ascending" }`이다. 특징값은 숫자이다. 관찰 문장과 별개로 매니페스트에 숫자로 둔다.
- 테스트
  - §1 표를 고정한다.
  - 정답 순서이면 complete이다.
  - 사암과 이암을 맞바꾸면 두 카드가 inconsistent이다.
  - 높이를 하나 관찰하지 않으면 unobserved가 우선한다.
  - followUp은 순서 complete 전에 막힌다.
  - followUp의 화석 관찰 원칙(unobserved 우선)을 확인한다.
  - groups·tree 테스트를 그대로 통과한다.

## 3. 스키마

- `layout` enum에 `'order'`를 추가한다.
- order이면 `orderBy`가 필수이고, 모든 카드에 orderBy.feature 숫자값이 있어야 한다. `initialOrder`(카드 key 배열, 모든 카드를 한 번씩 포함)도 필수이다. `followUp`(기준 하나, objective)은 선택이다.
- 카드 특징값 타입은 `string | number`로 넓힌다. 기존 단원은 string 그대로이다.
- probe when 추가: `order-check-unplaced`, `order-check-unobserved`, `order-check-inconsistent`, `order-check-complete`(followUp으로 넘어가기), 그리고 followUp 단계는 기존 groups when을 재사용한다.
- 스키마 테스트: initialOrder 누락·중복 거부, orderBy 숫자 아님 거부.

## 4. 매니페스트 (`content/units/g5-strata/manifest.json`)

- 단원 정보
  - id `g5-strata`, title "지층과 화석", grade 5, engine "earth"
  - standards `["6과06-01"]`(추정, 고시 대조 필요)
- 실험 정보
  - experiment id `strata-order`, module `card-sort`, layout `order`
  - title "지층이 쌓인 순서와 과거 환경 알아보기", question은 §1
  - features: height 채집 높이, grain 알갱이, fossil 화석. action은 "높이 확인하기", "알갱이 살펴보기", "화석 살펴보기"이다.
  - orderBy: height ascending
  - followUp: key env, label "이 층이 쌓일 때 그곳은 어떤 곳이었을까요?", feature env, groups sea "바다" / land "육지" / unknown "화석이 없어 알 수 없음"
  - followUp은 fossil을 관찰했는지로 근거를 판정한다. 판정 기준 특징(env)과 관찰 근거 특징(fossil)이 다르므로 `evidenceFeature: "fossil"` 필드를 둔다.
- icon key: conglomerate, sandstone, mudstone, limestone, shale. 암석 질감과 화석 모양을 단순 SVG로 그린다.
  - **화석 모양은 관찰 전에는 그리지 않는다.** 그림이 정답을 미리 드러내기 때문이다.
  - 높이 숫자도 관찰 전에는 보이지 않는다.
- limits: ["부정합", "지층 대비", "습곡", "단층", "표준 화석", "시상 화석", "누중의 법칙"]
- forbiddenAnswers
  - "아래에 있는 층이 먼저 쌓"
  - "역암이 가장 먼저"
  - "셰일이 가장 나중"
  - "사암은 바다"
  - "이암은 육지"
  - "석회암은 바다"
  - "조개 화석이 있으니 바다"
- probes
  - 순서 단계
    - pick-card: "어떤 표본부터 살펴볼까요?"
    - before-observe: "{card}을(를) 칸에 놓기 전에 채집한 높이를 확인해 볼까요?"
    - sorting: "{card}은(는) 어느 칸에 놓을까요? 높이와 쌓이는 차례를 함께 생각해 볼까요?"
    - order-check-unplaced: "아직 칸에 놓지 않은 표본이 있어요."
    - order-check-unobserved: "{card}은(는) 아직 채집 높이를 확인하지 않았어요."
    - order-check-inconsistent: "{card}의 채집 높이와 놓은 차례를 다시 비교해 볼까요? 흙이 쌓일 때 어느 쪽부터 쌓일까요?"
    - order-check-complete: "높이와 차례가 잘 맞아요. 이번에는 화석을 보고 그때 그곳이 어떤 곳이었을지 생각해 볼까요?"
  - followUp 단계: groups when을 같은 원칙으로 쓴다. 근거 문장은 "화석"이다.
  - finished: "쌓인 차례와 환경을 함께 보면, 이곳의 환경은 시간이 지나며 어떻게 바뀌었을까요?"
- 전수 가드: 모든 치환 조합과 배경 지식 카드 문장에 대해 확인한다.

## 5. 화면

- **order 화면**
  - 왼쪽은 표본 더미와 돋보기이다(기존 공유 컴포넌트).
  - 오른쪽에 "쌓인 차례" 칸 5개를 **아래에서 위로** 세로로 쌓아 그린다. 맨 아래 칸 옆에는 "먼저 쌓임", 맨 위 칸 옆에는 "나중에 쌓임"이라고 쓴다.
  - 칸 버튼은 "{n}번째로 쌓인 층에 놓기"이다. 칸 안 카드에는 "빼기"가 있다.
- **확인 뒤**: complete이면 followUp 무리 칸 3개가 나타난다. 아래쪽 "쌓인 차례" 칸 옆에는 학생이 넣은 환경 글자를 표시한다(학생 입력만 표시).
- **완료 문구**: "지층의 차례와 그때의 환경을 모두 알아냈어요!"
- 좁은 화면에서는 칸 목록이 세로이다. 가로 스크롤이 없어야 하고, 키보드로 조작할 수 있어야 한다.
- xAPI·교실: order 확인 kind, followUp kind, 완료를 보낸다. 정답은 보내지 않는다.

## 6. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`는 모두 종료 코드 0이어야 한다. 기존 기대값은 바꾸지 않는다(단원 수·카드 수 단언만 조정). g3-animal·g3-plantlife(·g3-material이 먼저 들어갔다면 그것도)는 변하지 않아야 한다.
- E2E (`e2e/strata.spec.ts`)
  - 높이를 관찰하지 않고 5칸을 채운 뒤 확인하면 "아직 채집 높이를 확인하지 않았어요"가 보인다.
  - 모두 관찰한 뒤 사암과 이암을 바꿔 놓고 확인하면 두 카드 이름이 inconsistent 문장에 있다. 고치면 followUp 칸이 나타난다.
  - 화석 관찰 전에는 카드 그림에 화석 모양이 없다. DOM의 data-testid로 확인한다.
  - followUp을 모두 맞게 넣으면 완료 문구가 보인다.
  - 맨 아래 칸 옆에 "먼저 쌓임"이 보인다.
  - SVG 글자는 13px 이상이다. 390px 폭에서 가로 스크롤이 없다.
  - routing·layout·a11y(밝게·어둡게)에 단원을 추가한다.
- 문서: `docs/testing.md`, README.
