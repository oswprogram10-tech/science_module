> **이동 메모(2026-11-10)**: 이 사양의 흐르는 물 실험(`stream-table`)은 4학년 「땅의 변화」(`g4-land`)의 두 번째 활동으로 옮겼고 `g3-earth-sea` 단원은 앱에서 뺐다. 이 문서는 실험을 만들 때의 기록으로 남긴다(단원 id·학년·튜터 데이터 위치는 옛 것). 이동 내용은 `stream-table-to-g4-land.md`.

# 구현 사양: 3학년 「지구와 바다」 최소 실험 (v0) — 흐르는 물이 흙을 깎고 쌓기

> 앞 사양: `phase2-roadmap.md`(순서 15). 지구 엔진 단원(`g4-land` `magma-cooling`)과 여러 선 그래프(`g4-ecosystem`, `g5-body`)가 본보기다.
> 새 변인 실험 모듈은 `stream-table`이다(`@sci/engine-earth`, `stream.ts`).
> 교육과정 위치(3학년 지구와 바다 vs 4학년 지표 변화)는 성취기준 대조 때 함께 확인한다. 로드맵 결정대로 이 단원에 둔다.

## 0. 결정

- 흙 언덕(흐르는 물 실험 상자)의 위쪽에 같은 빠르기(초당 0.05 L)로 물을 붓는다. 물을 붓는 시간은 물의 양에 따라 1 L는 20초, 2 L는 40초이다. 60초 동안 관찰한다.
- 측정은 위쪽에서 **깎인 흙(g)**과 아래쪽 평평한 곳에 **쌓인 흙(g)**이다. 깎인 흙의 일부(20%)는 물받이로 흘러 나가 쌓이지 않는다.
- 근사 모델이며 **교사 검수 대상**이다. 침식·퇴적·운반이라는 용어는 쓰지 않고 "깎인다", "옮겨진다", "쌓인다"를 쓴다(3학년 수준).

## 1. 실험 개요

- **탐구 질문**: "흐르는 물은 흙 언덕을 어떻게 바꿀까?"
- **조건 3가지**
  - 언덕의 기울기: 완만하게 / 가파르게
  - 흘려보내는 물의 양: 1 L / 2 L
  - 물을 붓는 그릇: 컵 / 페트병 — 대조 변인. 붓는 빠르기는 같다. 영향이 없다.
- **측정**: 깎인 흙(g), 쌓인 흙(g)
- **학습 의도**
  - 흐르는 물은 높은 곳의 흙을 깎아 낮은 곳으로 옮겨 쌓는다.
  - 경사가 급할수록, 물이 많을수록 더 많이 깎이고 쌓인다.
  - 그릇은 관계없다.

## 2. 모델 (`@sci/engine-earth`, `stream.ts`)

- **입력과 옵션**
  - 입력: `{ slope: 'gentle'|'steep', waterL: number, vessel: 'cup'|'bottle' }`
  - `opts = { totalS = 60, sampleEveryS = 0.5 }`
- **붓는 시간** `T = waterL / 0.05`(초)
- **깎이는 빠르기** r(g/s): gentle 1.0, steep 2.5
- **누적값**
  - 깎인 흙 `E(t) = r·min(t, T)`
  - 쌓인 흙 `D(t) = 0.8·r·max(0, min(t, T + 2) − 2)`. 흙이 아래까지 가는 데 2초가 늦는다. 끝값은 0.8·E이다.
- **물 흐름 빠르기**(화면용) `flow(t)`: 붓는 동안 gentle 0.4, steep 1.0. 그 뒤 2초 동안 0으로 줄어든다.
- **샘플**: `{ t, eroded: E, deposited: D, flow, pouring: t < T }`. 마지막 샘플은 t = 60이다.
- **결과**: `eroded`, `deposited`(정수 g)
- **`validateStreamExperiment(exp)`**: 세 변인이 있는지, 값이 허용 범위인지 검사한다. waterL은 0.5~2.5이고, T + 2 ≤ totalS이어야 한다.
- 순수 함수, 난수 없음. vessel은 계산에 쓰지 않는다.

### 2.1 기준값 (테스트로 고정, 그릇 두 가지 모두)

| 기울기 | 물 | 깎인 흙(g) | 쌓인 흙(g) |
|---|---|---|---|
| 완만 | 1 L | 20 | 16 |
| 완만 | 2 L | 40 | 32 |
| 가파름 | 1 L | 50 | 40 |
| 가파름 | 2 L | 100 | 80 |

### 2.2 반드시 통과할 테스트

- 표 4칸을 그릇 두 가지 각각으로 고정한다.
- 그릇만 바꾸면 결과와 샘플이 같다.
- E와 D는 단조 비감소이다.
- 모든 샘플에서 D ≤ E이다.
- t ≥ T + 2이면 값이 변하지 않는다.

## 3. 매니페스트 (`content/units/g3-earth-sea/manifest.json`)

```jsonc
{
  "id": "g3-earth-sea",
  "title": "지구와 바다",
  "grade": 3,
  "standards": ["4과05-02"],     // 추정. 고시 대조 필요
  "engine": "earth",
  "experiments": [{
    "id": "stream-table",
    "module": "stream-table",
    "title": "흐르는 물이 흙 언덕을 바꾸는 모습 알아보기",
    "question": "흐르는 물은 흙 언덕을 어떻게 바꿀까?",
    "predictionPrompt": "예측: 깎인 흙의 양은?",
    "variables": [
      { "key": "slope", "label": "언덕의 기울기", "type": "choice",
        "options": [ {"value":"gentle","label":"완만하게"}, {"value":"steep","label":"가파르게"} ], "default": "gentle" },
      { "key": "waterL", "label": "흘려보내는 물의 양", "type": "choice", "unit": "L",
        "options": [ {"value":1,"label":"1 L"}, {"value":2,"label":"2 L"} ], "default": 1 },
      { "key": "vessel", "label": "물을 붓는 그릇", "type": "choice",
        "options": [ {"value":"cup","label":"컵"}, {"value":"bottle","label":"페트병"} ], "default": "cup" }
    ],
    "dependent": [
      { "key": "eroded", "label": "깎인 흙", "unit": "g" },
      { "key": "deposited", "label": "쌓인 흙", "unit": "g" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": [],
    "safetyNotices": [],
    "limits": ["침식", "퇴적", "운반", "유속", "삼각주", "선상지"],
    "params": { "totalS": 60 },
    "tutor": {
      "forbiddenAnswers": [
        "가파를수록 흙이 많이 깎",
        "물이 많을수록 흙이 많이 깎",
        "높은 곳의 흙을 깎아 낮은 곳에 쌓",
        "그릇은 관계없"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 깎이는 흙의 양이 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 결과가 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 위쪽과 아래쪽 흙은 각각 어떻게 달라졌나요? 그래프의 두 선을 함께 볼까요?" },
        { "when": "fair-test", "iv": "slope", "text": "기울기만 바꾸었어요. 물이 흐르는 빠르기는 어떻게 달라 보였나요? 흙 알갱이 그림도 살펴볼까요?" },
        { "when": "fair-test", "iv": "vessel", "text": "그릇만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 깎인 흙과 쌓인 흙은 각각 어디로 갔을지 그림에서 찾아볼까요?" }
      ]
    }
  }]
}
```

전수 가드에서 오검출이 없어야 한다.

## 4. 화면 (`apps/student/src/modules/stream-table/`)

- **거시(SVG) "눈으로 보기"**
  - 옆에서 본 흐르는 물 실험 상자를 그린다. 위쪽 언덕은 기울기 각도로 그리고, 아래쪽은 평평한 곳과 물받이이다.
  - 위쪽 언덕 표면은 E에 비례해 골이 패어 들어간다. 아래쪽에는 D에 비례해 부채꼴 흙 더미가 쌓인다.
  - 붓는 동안 물줄기와 그릇 아이콘을 보인다.
  - 라벨: "깎인 곳", "쌓인 곳"
  - 아래 문구: `"{t}초 · 깎인 흙 {E} g · 쌓인 흙 {D} g"`
- **미시 자리(SVG) "흙 알갱이 보기"**
  - 물길 단면을 확대해 그린다. 작은 알갱이는 물에 떠서 옮겨지고, 큰 알갱이는 굴러간다.
  - 움직임 빠르기는 flow에 비례한다. 붓기가 끝나면 알갱이가 멈추고 쌓인다.
  - 라벨: "물", "흙 알갱이"
  - 그림 아래 문구: "흐르는 물은 흙 알갱이를 함께 옮겨요."
  - reduced-motion이면 정지한다.
- **그래프**
  - series 두 개를 그린다. 깎인 흙(g)은 실선, 쌓인 흙(g)은 점선이다.
  - y 라벨 `흙의 양(g)`, y 0~100 고정(yTicks 0·20·40·60·80·100)
  - x 라벨 `시간(초)`, xTicks 0·10·…·60
  - markers는 함수형으로 둔다. T에 "붓기 끝"이다.
- **센서**: "가상 전자저울: 쌓인 흙"(deposited, 기존 scale kind)
- **결과 열**: 깎인 흙(g), 쌓인 흙(g)
- **예측 비교**: metric = eroded, `sameThreshold` = 0.5
- **재생 후 플레이헤드**: `restPlayhead` = 60

## 5. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`는 모두 종료 코드 0이어야 한다. 기존 기대값은 바꾸지 않는다(단원 수·카드 수 단언만 조정).
- 새 단위 테스트: §2.2, 스키마, 튜터 전수 가드, 레지스트리, 그래프 가드 목록(series·yTicks 단원 추가)
- 새 E2E (`e2e/earth-sea.spec.ts`)
  - 기준(완만, 1 L, 컵)이면 20, 16이 보인다.
  - 기울기를 가파르게 바꾸면 50, "결과: 늘어났다", 기울기 전용 질문이 나온다.
  - 새 페이지에서 물을 2 L로 바꾸면 40이 보인다.
  - 새 페이지에서 그릇만 바꾸면 "결과: 변하지 않았다"가 보인다.
  - "깎인 곳", "쌓인 곳" 라벨이 보인다.
  - SVG 글자는 13px 이상이다.
  - routing·layout·a11y(밝게·어둡게)에 단원을 추가한다.
- 문서: `docs/testing.md`, README.
