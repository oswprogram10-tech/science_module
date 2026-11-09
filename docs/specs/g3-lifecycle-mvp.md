# 구현 사양: 3학년 「생물의 한살이」 최소 실험 (v0) — 씨가 싹 트는 조건

> 앞 사양: `phase2-roadmap.md`(순서 1). 변인 실험 모듈 구조는 `g4-gases-mvp.md`, 최근 변인 실험 단원은 `g6-seasons-mvp.md`(그래프 `xLabel`·`xTicks`·`integerTicks`·`restPlayhead`), 교사 대시보드 상태 보내기는 `teacher-dashboard-v0.md`를 참고한다.
> 이 단원으로 E3(생명) 엔진 패키지 `@sci/engine-life`를 시작한다. 새 변인 실험 모듈은 `germination`이다.

## 1. 실험 개요

- **탐구 질문**: "씨가 싹 트려면 어떤 조건이 필요할까?"
- **실험 설정**: 강낭콩 10개를 담은 그릇 여러 개를 조건만 달리해 10일 동안 관찰한다.
- **조건 3가지**:
  - 물: 주지 않음 / 줌(젖은 솜)
  - 온도: 냉장고 5 °C / 실온 20 °C / 따뜻한 곳 30 °C
  - 빛: 밝은 곳 / 어두운 곳(상자를 덮음)
- **측정**
  - 7일째 싹 튼 씨앗 수
  - 처음 싹 튼 날
  - 떡잎 색(초록색 / 노란색)
- **학습 의도**
  - 싹이 트려면 물과 알맞은 온도가 필요하다. 물이 없거나 너무 차가우면 싹이 트지 않는다.
  - **빛은 싹 트는 데 영향이 없다.** 싹 튼 씨앗 수는 같지만 떡잎 색은 달라진다. 싹 트는 조건과 자라는 조건을 구분하는 탐구이며, 대조 변인 역할을 한다.
  - 20 °C와 30 °C는 7일째 수가 같다. 30 °C에서 더 빨리 싹 튼다. 결과표의 두 열(수, 처음 싹 튼 날)을 함께 봐야 하는 비교다.

## 2. 생명 엔진 패키지 (`packages/engines/life`, `@sci/engine-life`)

`packages/engines/earth`와 같은 구조로 만든다(src export, typecheck, workspace, `@sci/schema` 타입 의존).

### 2.1 싹 트기 모델 (`germination.ts`)

근사 모델이며 **교사 검수 대상**이다.

- **입력과 옵션**
  - 입력: `{ water: 'none'|'water', tempC: number, light: 'bright'|'dark' }`
  - `opts = { seeds = 10, days = 10, sampleEveryDay = 0.1, spread = 0.8 }`
- **최대 비율과 빠르기** `(pmax, rate)`
  - 물: none은 (0, 0), water는 (0.9, 1.0)
  - 온도: 5 °C는 (0, 0), 20 °C는 (1, 1.0), 30 °C는 (1, 1.3). 표에 없는 온도는 선형 보간한다. 0 °C 이하와 40 °C 이상은 (0, 0)이다.
  - 둘을 곱한다: `pmax = pw·pt`, `rate = rw·rt`.
  - 빛은 싹 트기에 영향이 없다.
- **누적 싹 튼 비율**: `G(t) = pmax·σ((t − tmid)/s) − pmax·σ(−tmid/s)`. `tmid = 4/rate`, `s = spread`이고, t=0일 때 0이 되도록 뺀다. pmax 또는 rate가 0이면 항상 0이다.
- **떡잎 색**: 싹이 튼 경우만 정한다. 빛이 bright면 초록, dark면 노랑이다. 싹이 하나도 안 텄으면 없음이다.
- **줄기 길이**(화면용, mm): 싹 튼 뒤 경과일 × (dark면 8, bright면 5)이고 최대 60이다. 어두우면 더 길고 연하게 자란다.
- **샘플**: `{ t, sprouted (연속값 seeds·G(t)), greenness (0~1: 초록 정도, dark면 0), stemMm }`
- **결과**
  - `sproutedDay7`: round(seeds·G(7))
  - `firstDay`: 10·G(t) ≥ 0.5가 처음 되는 날, 소수 첫째 자리. 없으면 null이고 화면에는 "–"로 쓴다.
  - `leafColor`: 'green' / 'yellow' / null
- **`validateGerminationExperiment(exp)`**: 세 변인이 있는지, 값이 허용 범위인지 검사한다.
- 순수 함수, 난수 없음.

### 2.2 미리 계산한 기준값 (테스트로 고정)

| 물 | 온도 | 7일째 싹 튼 수 | 처음 싹 튼 날 |
|---|---|---|---|
| 주지 않음 | 5·20·30 °C | 0 | – |
| 줌 | 5 °C | 0 | – |
| 줌 | 20 °C | 9 | 1.8 |
| 줌 | 30 °C | 9 | 1.1 |

빛은 위 값을 바꾸지 않는다. 떡잎 색은 bright이면 초록, dark이면 노랑이다.

### 2.3 반드시 통과할 테스트

- 표 전부(빛 두 가지 각각)를 고정한다.
- 빛만 바꾸면 sproutedDay7과 firstDay가 같고 leafColor만 다르다.
- 모든 샘플에서 sprouted는 단조 증가하고 0 이상, seeds 이하이다.

## 3. 매니페스트 (`content/units/g3-lifecycle/manifest.json`)

```jsonc
{
  "id": "g3-lifecycle",
  "title": "생물의 한살이",
  "grade": 3,
  "standards": ["4과04-01"],     // 명세서 표기(4과04-01~03). 고시 대조 필요
  "engine": "life",
  "experiments": [{
    "id": "germination",
    "module": "germination",
    "title": "씨가 싹 트는 조건 알아보기",
    "question": "씨가 싹 트려면 어떤 조건이 필요할까?",
    "predictionPrompt": "예측: 7일째 싹 튼 씨앗 수는?",
    "variables": [
      { "key": "water", "label": "물", "type": "choice",
        "options": [ {"value":"none","label":"물을 주지 않음"}, {"value":"water","label":"물을 줌 (젖은 솜)"} ],
        "default": "water" },
      { "key": "tempC", "label": "온도", "type": "choice", "unit": "°C",
        "options": [ {"value":5,"label":"냉장고 5 °C"}, {"value":20,"label":"실온 20 °C"}, {"value":30,"label":"따뜻한 곳 30 °C"} ],
        "default": 20 },
      { "key": "light", "label": "빛", "type": "choice",
        "options": [ {"value":"bright","label":"밝은 곳"}, {"value":"dark","label":"어두운 곳 (상자를 덮음)"} ],
        "default": "bright" }
    ],
    "dependent": [
      { "key": "sproutedDay7", "label": "7일째 싹 튼 씨앗 수", "unit": "개" },
      { "key": "firstDay", "label": "처음 싹 튼 날", "unit": "일" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": [],
    "safetyNotices": [],
    "limits": ["발아", "배아", "광합성", "엽록소", "호르몬"],
    "params": { "seeds": 10, "days": 10 },
    "tutor": {
      "forbiddenAnswers": [
        "물이 있어야 싹이 트",
        "빛이 없어도 싹이 트",
        "온도가 낮으면 싹이 트지 않",
        "알맞은 온도가 필요",
        "빛은 싹 트는 데 필요하지 않"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 싹 트는 씨앗 수가 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 싹 튼 수가 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 싹 튼 씨앗 수와 처음 싹 튼 날은 각각 어떻게 달라졌나요? 결과표의 두 칸을 함께 볼까요?" },
        { "when": "fair-test", "iv": "light", "text": "빛만 바꾸었을 때 싹 튼 씨앗 수와 떡잎 색은 각각 어떻게 되었나요? 두 결과는 무엇이 다를까요?" },
        { "when": "fair-test", "iv": "tempC", "text": "온도만 바꾸었어요. 싹 튼 수가 같아도 다른 점이 있나요? 그래프에서 싹이 트기 시작한 때를 비교해 볼까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 날마다 바뀌는 그래프와 그릇 그림의 어느 부분을 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

## 4. 화면 (`apps/student/src/modules/germination/`)

- **거시(SVG) "눈으로 보기"**
  - 젖은 솜(물을 줬을 때) 또는 마른 솜이 깔린 그릇에 강낭콩 10개를 2줄로 놓는다.
  - 싹 튼 씨앗(앞에서부터 `round(sprouted)`개)에는 뿌리와 줄기를 그린다. 줄기 길이는 stemMm에 비례하고 떡잎 색은 greenness로 정한다(초록/노랑, 글자 라벨 함께).
  - 환경 표시
    - 어두운 곳이면 그릇 위에 반투명 상자를 그리고 "상자를 덮음" 라벨을 단다.
    - 온도에 따라 냉장고 테두리 또는 따뜻한 표시를 그린다. 글자 라벨을 함께 쓴다.
  - 아래 문구: `"{t}일째 · 싹 튼 씨앗 {round(sprouted)}개"`
- **미시 자리(SVG) "씨 하나 확대해 보기"**
  - 씨앗 한 개의 단계 그림: 씨 → 뿌리가 나옴 → 떡잎이 나옴 → 본잎.
  - 단계는 그 그릇에서 가장 빨리 싹 튼 씨앗의 경과로 정하고, 싹이 안 텄으면 씨 그대로 둔다.
  - 단계 이름은 글자로 쓰고, 떡잎 색을 반영한다.
- **그래프**: y = sprouted, 라벨 `싹 튼 씨앗 수(개)`, yMin 0, `integerTicks`. x 라벨 `날짜(일)`, xTicks 0·2·4·6·8·10. markers는 7일째 "7일째"이다.
- **센서**: "가상 온도계"(tempC), "가상 빛 센서"(bright 80 %, dark 2 %, 기존 light 종류).
- **결과 열**: 7일째 싹 튼 씨앗 수(개), 처음 싹 튼 날(일, 없으면 "–"), 떡잎 색(초록색/노란색/–).
- **예측 비교**: `sameThreshold` = 0.5개.
- **재생 후 플레이헤드**: `restPlayhead` = 7(7일째).
- **교사 대시보드 상태 보내기**: 기존 변인 실험 경로를 그대로 쓰고, 추가 작업이 없는지 확인한다.

## 5. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 종료 코드 0. 기존 기대값은 바꾸지 않는다(단원 수·카드 수 단언만 조정).
- 새 단위 테스트: §2.3, 스키마, 튜터 전수 가드, 레지스트리, 결과 열이 시행마다 같은 값으로 고정되지 않는지.
- 새 E2E (`e2e/lifecycle.spec.ts`):
  - 기준(물 줌, 20 °C, 밝은 곳)이면 9, 1.8, "초록색"이 보인다.
  - 빛만 어둡게 바꾸면 9, "노란색", "결과: 변하지 않았다", 빛 전용 질문이 나온다.
  - 새 페이지에서 물만 "주지 않음"으로 바꾸면 0, "–", "결과: 줄어들었다"가 나온다.
  - 온도 30 °C면 처음 싹 튼 날이 1.1이다.
  - SVG 글자는 13 px 이상이다.
  - 기존 `routing`, `layout`, `a11y`(밝게·어둡게) spec에 새 단원을 추가한다.
- 문서: `docs/testing.md`, README(`@sci/engine-life`).
