# 구현 사양: 3학년 「식물의 생활」 최소 활동 (v0) — 잎 카드 분류 트리(card-sort 트리 변형)

> 앞 사양: `phase2-roadmap.md`(순서 7), `g3-animal-mvp.md`(카드 분류 `card-sort`, `@sci/cardsort`의 첫 사용).
> 이번에는 `card-sort`의 **`layout: 'tree'`**(두 갈래로 거듭 나누기)를 추가한다. 무리 나누기(groups)와 같은 관찰 근거 원칙·확인 규칙을 노드마다 쓴다.

## 0. 결정

- 트리의 각 노드는 "예/아니요" 기준 하나로 카드를 두 무리로 나눈다. 판정은 `@sci/cardsort`의 기존 `check` 규칙(주관 → 안 넣음 → 관찰 안 함 → 관찰과 다름 → 완료)을 **그 노드의 카드에만** 적용해 재사용한다.
- 한 갈래로 가는 길에서 같은 기준을 두 번 쓸 수 없다(조상 노드가 쓴 기준은 고를 수 없다).
- 노드 확인이 `check-complete`가 되면 그 노드의 두 자식 무리를 다시 나눌 수 있다.
- **완료 조건**: 모든 잎 무리(자식이 없는 노드)가 "더 나눌 수 없는" 상태가 된다. 즉 그 무리의 카드들이 모든 객관적 기준의 특징값이 같고, 트리의 모든 나눈 노드가 `check-complete`이다. 이것은 내부 판정이고 화면에 무리별 정답을 드러내지 않는다. 완료 전에는 "아직 더 나눌 수 있는 무리가 있어요"만 말한다(어느 무리인지는 말하지 않는다).
- 나누었더니 한쪽이 빈 경우(모든 카드가 같은 쪽)는 노드 확인 결과 complete로 둔다. 다만 튜터가 "이 기준으로는 나누어지지 않았어요. 다른 기준을 골라 볼까요?"라고 묻고, 기준을 바꿀 수 있게 한다. 빈 쪽이 있는 노드는 자식을 만들지 않는다.
- 깊이는 객관 기준 수(3)를 넘지 않는다.

## 1. 활동 개요

- **탐구 질문**: "잎의 생김새에 따라 식물을 어떻게 분류할 수 있을까?"
- **잎 카드 8장**(교사 검수 대상, 식물학적 특징은 아래 표로 고정)

| 카드 | serrated 가장자리 톱니 | lobed 여러 갈래로 갈라짐 | parallel 잎맥이 나란함 |
|---|---|---|---|
| 단풍나무 | yes | yes | no |
| 국화 | yes | yes | no |
| 벚나무 | yes | no | no |
| 동백나무 | yes | no | no |
| 감나무 | no | no | no |
| 라일락 | no | no | no |
| 붓꽃 | no | no | yes |
| 백합 | no | no | yes |

  완성 트리 예: 잎맥이 나란한가? → 예 {붓꽃, 백합} / 아니요 → 톱니? → 예 → 갈라짐? {단풍, 국화}/{벚, 동백}, 아니요 {감, 라일락}. 더 나눌 수 없는 무리 4개.
- **분류 기준 4가지**(모두 예/아니요): "잎 가장자리가 톱니 모양인가요?"(serrated), "잎이 여러 갈래로 갈라져 있나요?"(lobed), "잎맥이 나란한가요?"(parallel), "잎이 예쁜가요?"(주관, `objective: false`)
- **관찰 문장**(카드 × 특징, 매니페스트)
  - 단풍나무: serrated "가장자리에 뾰족뾰족한 톱니가 있어요." / lobed "손바닥처럼 5~7갈래로 깊게 갈라져 있어요." / parallel "잎맥이 손바닥 모양으로 퍼져 있어요."
  - 국화: serrated "갈라진 조각 끝에 톱니가 있어요." / lobed "잎이 여러 갈래로 갈라져 있어요." / parallel "잎맥이 그물처럼 퍼져 있어요."
  - 벚나무: serrated "가장자리에 잔 톱니가 촘촘해요." / lobed "갈라지지 않은 둥근 달걀 모양이에요." / parallel "가운데 잎맥에서 옆으로 잎맥이 뻗어 그물 모양이에요."
  - 동백나무: serrated "가장자리에 아주 작은 톱니가 있어요." / lobed "갈라지지 않은 길쭉한 둥근 모양이고 반질반질해요." / parallel "잎맥이 그물처럼 퍼져 있어요."
  - 감나무: serrated "가장자리가 매끈해요." / lobed "갈라지지 않은 넓은 달걀 모양이에요." / parallel "잎맥이 그물처럼 퍼져 있어요."
  - 라일락: serrated "가장자리가 매끈해요." / lobed "갈라지지 않은 하트 모양이에요." / parallel "잎맥이 그물처럼 퍼져 있어요."
  - 붓꽃: serrated "가장자리가 매끈해요." / lobed "갈라지지 않은 칼처럼 긴 모양이에요." / parallel "잎맥이 잎 끝까지 나란히 뻗어 있어요."
  - 백합: serrated "가장자리가 매끈해요." / lobed "갈라지지 않은 길쭉한 모양이에요." / parallel "잎맥이 잎 끝까지 나란히 뻗어 있어요."
- **용어**: "잎맥", "분류 기준"을 쓴다. 외떡잎·쌍떡잎, 그물맥·나란히맥 같은 용어는 `limits`에 넣고 쓰지 않는다. 관찰 문장의 "그물처럼"은 비유이며 용어가 아니다. 가드 테스트에서 "그물맥"이 나오지 않는지만 본다.

## 2. 로직 (`@sci/cardsort` 확장)

- 트리 상태를 추가한다. 순수 함수이고 난수가 없다.
  ```ts
  interface TreeNode { id: string; cards: string[]; criterion: string | null; placement: Record<string, 'yes'|'no'|null>; checked: SortCheck | null; children: { yes: string; no: string } | null }
  interface TreeState { nodes: Record<string, TreeNode>; root: string; observed: Record<string, string[]>; selectedNode: string }
  ```
- 함수
  - `createTree(cards)`
  - `chooseNodeCriterion(state, nodeId, key)`: 조상이 쓴 기준이면 무시한다. 바꾸면 그 노드의 placement·checked를 비우고 자손 노드를 지운다.
  - `placeInNode`
  - `checkNode`: 기존 `check` 규칙을 노드 카드에 적용한다. complete이고 두 쪽 모두 카드가 있으면 자식 노드를 만든다.
  - `observe`: 공용 관찰 기록을 쓴다.
  - `isTreeFinished`
  - `treeLeaves`
  - `availableCriteria(state, nodeId)`
- 기존 groups용 `check`의 판정 코드를 공유 함수로 빼서 groups와 tree가 같은 코드를 쓰게 한다. groups 단원(g3-animal)의 기대값과 테스트는 바꾸지 않는다.
- 테스트
  - §1 표를 고정한다.
  - §1 완성 트리 예로 `isTreeFinished`가 true가 된다.
  - 한 단계만 나누면 false이다.
  - 조상 기준을 다시 고르지 못한다.
  - 기준을 바꾸면 자손이 지워진다.
  - 한쪽이 빈 노드는 자식이 없다.
  - 관찰 안 함과 관찰과 다름의 우선순위를 확인한다.
  - g3-animal 테스트를 그대로 통과한다.

## 3. 스키마

- `layout` enum에 `'tree'`를 추가한다.
- tree이면 모든 기준의 groups가 정확히 `[{value:'yes'}, {value:'no'}]`인지 refine으로 검사한다. 라벨은 자유("톱니가 있다"/"톱니가 없다" 등).
- probe when에 `tree-split-empty`(한쪽이 빔), `tree-next-node`(나눌 수 있는 자식 무리가 있음), `finished`를 쓴다. 기존 when도 그대로 쓴다.
- 스키마 테스트: tree에서 예/아니요가 아닌 무리를 거부한다.

## 4. 매니페스트 (`content/units/g3-plantlife/manifest.json`)

- id `g3-plantlife`, title "식물의 생활", grade 3, engine "life", standards `["4과07-01"]`(추정, 고시 대조 필요)
- experiment id `leaf-tree`, module `card-sort`, layout `tree`, title "잎의 생김새로 식물 분류하기", 질문은 §1
- icon key: maple, chrysanthemum, cherry, camellia, persimmon, lilac, iris, lily
- limits: ["외떡잎", "쌍떡잎", "그물맥", "나란히맥", "겹잎", "홑잎"]
- forbiddenAnswers(정답 누설)
  - "붓꽃과 백합은 잎맥이 나란"
  - "단풍나무는 갈라져"
  - "단풍나무와 국화는 같은 무리"
  - "감나무와 라일락은 같은 무리"
  - "벚나무는 톱니"
  - "감나무는 가장자리가 매끈"
  - "잎이 예쁜가는 분류 기준이 될 수 없"
- probes
  - choose-criterion: "이 무리를 두 갈래로 나누려면 어떤 질문이 좋을까요? 누가 답해도 같은 질문을 골라 보세요."
  - pick-card: "어떤 잎부터 살펴볼까요?"
  - before-observe: "{card} 잎을 넣기 전에 '{criterion}'에 맞는 생김새를 먼저 살펴볼까요?"
  - sorting: "{card} 잎을 관찰한 내용으로 보면 '예'일까요, '아니요'일까요? 왜 그렇게 생각했나요?"
  - check-subjective: "'{criterion}'에 친구와 내가 같은 답을 할까요? 누가 답해도 같은 질문인지 생각해 볼까요?"
  - check-unplaced: "아직 넣지 않은 잎이 있어요. 모든 잎을 넣어 볼까요?"
  - check-unobserved: "{card} 잎은 아직 살펴보지 않았어요. 돋보기로 먼저 관찰해 볼까요?"
  - check-inconsistent: "{card} 잎에서 관찰한 내용과 넣은 쪽을 다시 비교해 볼까요?"
  - check-complete: "관찰한 생김새와 잘 맞게 나누었어요."
  - tree-split-empty: "모든 잎이 한쪽으로 모였어요. 이 질문으로는 나누어지지 않았어요. 다른 질문을 골라 볼까요?"
  - tree-next-node: "아직 더 나눌 수 있는 무리가 있을까요? 무리를 하나 골라 다시 나누어 볼까요?"
  - finished: "더 나눌 수 없을 때까지 나누었어요. 처음 질문을 바꾸면 트리 모양이 어떻게 달라질까요?"
- 전수 가드는 g3-animal과 같다. 모든 치환 조합에서 probe·피드백 문장이 걸리지 않아야 한다.

## 5. 화면 (`apps/student/src/modules/card-sort/` 확장)

- 같은 모듈 폴더에서 `layout`으로 갈라진다. groups 화면과 카드·돋보기·관찰 기록 컴포넌트를 공유한다.
- **트리 영역**
  - 노드를 위에서 아래로 그린다. 좁은 화면에서는 들여쓰기 목록으로 바꾼다.
  - 각 노드는 버튼이며, 누르면 그 노드가 "지금 나누는 무리"가 된다(`aria-current`).
  - 노드 제목은 고른 질문이다. 질문이 없으면 "질문을 골라 주세요"이다.
  - 자식 두 칸 제목은 무리 라벨이다.
  - 연결선은 SVG 또는 CSS로 그린다. 노드는 HTML 버튼이고 SVG 텍스트를 쓰면 13px 이상이다.
- **지금 나누는 무리 패널**: 기준 라디오(조상 기준은 비활성, 이유 텍스트 "위에서 이미 쓴 질문이에요"), 카드, "예 쪽에 넣기"/"아니요 쪽에 넣기", 확인하기
- **진행 문구**: "나눈 횟수 n번". 완료되면 "더 나눌 수 없을 때까지 나누었어요!"를 보인다. 완료 전에는 어느 무리가 남았는지 표시하지 않는다.
- **피드백 문장**은 g3-animal과 같은 원칙이다. 한쪽이 빈 경우: "모든 잎이 한쪽으로 모였어요."
- **잎 아이콘**은 생김새가 관찰 문장과 맞는 단순 SVG이다(톱니, 갈라짐, 잎맥 방향이 보이게, 다크 모드 대비).
- **xAPI·교실·교사 화면**은 g3-animal과 같은 수준이다. 노드 확인 kind와 나눈 횟수를 보내고, 정답은 보내지 않는다.

## 6. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`는 모두 종료 코드 0이어야 한다. 기존 기대값은 바꾸지 않는다(단원 수·카드 수 단언만 조정).
- E2E (`e2e/plantlife.spec.ts`)
  - 처음 노드에서 "잎맥이 나란한가요?"를 고른다. 관찰 없이 넣고 확인하면 "아직 살펴보지 않았어요"가 보인다.
  - 관찰하고 바르게 넣으면 자식 무리 두 개가 생긴다.
  - 붓꽃·백합 무리에 "잎 가장자리가 톱니 모양인가요?"를 쓰면 "모든 잎이 한쪽으로 모였어요"가 보인다.
  - 부모가 쓴 질문은 자식에서 비활성이다.
  - §1 완성 트리까지 진행하면 "더 나눌 수 없을 때까지 나누었어요!"가 보인다.
  - 처음 질문을 바꾸면 아래 노드가 사라진다.
  - 키보드만으로 조작할 수 있다. 390px 폭에서 가로 스크롤이 없다. SVG 글자는 13px 이상이다.
  - routing·layout·a11y(밝게·어둡게)에 단원을 추가한다.
- 문서: `docs/testing.md`, README.
