# 구현 사양: 5학년 「열과 우리 생활」 최소 실험 (v0) — 보온 컵 설계

> 앞 사양: `g4-gases-mvp.md`(변인 실험 모듈), `g6-combustion-mvp.md`(공용 안전 기능, 그래프 `yMin`), `docs/testing.md`.
> 이 단원으로 E1(물리) 엔진 패키지 `@sci/engine-physics`를 시작한다. 새 변인 실험 모듈은 `insulated-cup`이다.

## 1. 실험 개요

- **탐구 질문**: "따뜻한 물이 담긴 컵을 무엇으로, 어떻게 감싸면 물이 덜 식을까?"
- **활동 맥락**: 성취기준의 "단열을 이용한 보온 장치 설계"를 변인 통제 실험으로 다룬다. 60 °C 물을 컵에 담고 10분 뒤 식은 정도를 비교한다.
- **조건 4가지**:
  - 감싸는 재료: 감싸지 않음 / 종이 / 솜 / 에어캡 / 알루미늄 포일
  - 감싸는 겹 수: 1겹 / 2겹
  - 뚜껑: 덮음 / 없음
  - 물의 양: 100 / 200 mL
- **학습 의도**:
  - 재료에 따라 열이 빠져나가는 정도가 다르다(공기를 품은 솜·에어캡이 효과가 크고, 얇은 종이는 효과가 작다).
  - 뚜껑으로 위쪽 열 손실을 줄일 수 있다.
  - "감싸지 않음"일 때 겹 수는 영향이 없다. 겹 수만 바꾸면 "변하지 않았다"가 나오는 공정한 비교 사례다.
  - **열화상 화면**: 잘 감싼 컵은 바깥 면이 덜 뜨겁다. 바깥이 덜 뜨겁다는 것은 열이 덜 새어 나간다는 뜻이다.

## 2. 물리 엔진 패키지 (`packages/engines/physics`, `@sci/engine-physics`)

다른 엔진 패키지와 같은 구조로 만든다(src export, typecheck 스크립트, workspace 등록, `@sci/schema` 타입 의존).

### 2.1 보온 컵 모델 (`heat.ts`)

뉴턴 냉각 법칙을 해석해로 쓴다. 수치는 근사값이며 **교사 검수 대상**이다.

- **입력과 옵션**
  - 입력: `{ wrap: 'none'|'paper'|'cotton'|'bubble'|'foil', layers: 1|2, lid: 'on'|'off', waterMl: number }`
  - `opts = { startC = 60, roomC = 20, durationS = 600, sampleEvery = 5 }`
- **상수**

  | 항목 | 값 |
  |---|---|
  | 물의 열용량 C | waterMl × 4.18 J/K |
  | 컵 옆면 넓이 | 0.0198 m² × (waterMl / 200). 물이 닿은 높이만 따진다. |
  | 윗면 넓이 | 0.0038 m² |
  | 바깥 공기 열전달 계수 h | 10 W/m²K |

- **옆면 열저항 R_side (m²K/W)**: `1/h_side + layers × r(wrap)`
  - 재료 1겹당 r: paper 0.002, cotton 0.125, bubble 0.10, foil 0.02(포일과 컵 사이 얇은 공기층 근사), none 0(겹 수 무시)
  - h_side는 10이 기본이고, foil만 6이다(복사를 막는 효과를 근사).
  - (구현 후 변경) 처음엔 foil r=0이었으나, 그러면 열화상에서 포일 컵 바깥이 맨 컵과 똑같이 60 °C로 보여 덜 식는 결과와 모순돼 r=0.02로 바꿨다. 포일 1겹 식은 정도 5.4 °C, 바깥 55.7 °C.
- **윗면 U_top (W/m²K)**: lid on이면 1/(1/10 + 0.05), off이면 25(김이 나며 빠져나가는 열까지 포함한 근사).
- **전체 손실과 온도**
  - UA = A_side / R_side + A_top × U_top
  - τ = C / UA
  - `waterC(t) = roomC + (startC − roomC)·e^(−t/τ)`
- **바깥 면 온도(열화상용)**
  - 옆면: `surfaceSideC = roomC + (waterC − roomC) × (1/h_side) / R_side`
  - 윗면: lid on이면 `roomC + (waterC − roomC) × 0.1 / (0.1 + 0.05)`, off이면 waterC(물이 그대로 드러남)
- **열 손실(W, 화살표 굵기용)**: 옆면 `(waterC − roomC) × A_side / R_side`, 윗면 `(waterC − roomC) × A_top × U_top`
- **샘플과 결과**
  - 샘플: `{ t, waterC, surfaceSideC, surfaceTopC, lossSideW, lossTopW }`
  - 결과:
    - `endC`: 마지막 물 온도, 소수 첫째 자리
    - `dropC`: startC − endC, 소수 첫째 자리
    - `surfaceSideStartC`: t=0 옆면 바깥 온도, 소수 첫째 자리
- **`validateInsulatedCupExperiment(exp)`**: 네 변인이 있는지, 값이 허용 범위인지 검사한다. wrap 다섯 종, layers는 1~3, lid는 on/off, waterMl은 50~500. params의 startC가 roomC보다 커야 한다.
- 순수 함수, 난수 없음.

**반드시 통과할 테스트**

- 기준(감싸지 않음, 1겹, 뚜껑 없음, 200 mL): τ ≈ 2853초, 10분 뒤 dropC ≈ 7.6 °C(±0.1). 실제 값을 고정한다.
- 식은 정도 순서: none ≥ paper > foil > bubble > cotton. 나머지 조건은 기준과 같게 둔다.
- 종이와 감싸지 않음의 차이는 0.3 °C 이하다(얇은 종이는 효과가 작다).
- wrap = none이면 layers 1·2 결과가 똑같다. 포일 컵 바깥 온도는 맨 컵보다 낮다.
- 뚜껑을 덮으면 dropC가 줄어든다.
- 물 100 mL는 200 mL보다 dropC가 크다.
- 모든 샘플에서 waterC는 단조 감소하고 roomC보다 크다. surfaceSideC는 roomC와 waterC 사이에 있다.
- 솜으로 감싼 컵의 surfaceSideStartC는 감싸지 않은 컵보다 낮다.

## 3. 매니페스트 (`content/units/g5-heat/manifest.json`)

```jsonc
{
  "id": "g5-heat",
  "title": "열과 우리 생활",
  "grade": 5,
  "standards": ["6과07-04"],      // 명세서 표기. 나머지 코드는 고시 대조 후 보완
  "engine": "physics",
  "experiments": [{
    "id": "insulated-cup",
    "module": "insulated-cup",
    "title": "물이 덜 식는 보온 컵 만들기",
    "question": "따뜻한 물이 담긴 컵을 무엇으로, 어떻게 감싸면 물이 덜 식을까?",
    "predictionPrompt": "예측: 10분 동안 물이 식은 정도는?",
    "variables": [
      { "key": "wrap", "label": "감싸는 재료", "type": "choice",
        "options": [ {"value":"none","label":"감싸지 않음"}, {"value":"paper","label":"종이"}, {"value":"cotton","label":"솜"},
                     {"value":"bubble","label":"에어캡(뽁뽁이)"}, {"value":"foil","label":"알루미늄 포일"} ],
        "default": "none" },
      { "key": "layers", "label": "감싸는 겹 수", "type": "choice", "unit": "겹",
        "options": [ {"value":1,"label":"1겹"}, {"value":2,"label":"2겹"} ],
        "default": 1 },
      { "key": "lid", "label": "뚜껑", "type": "choice",
        "options": [ {"value":"off","label":"뚜껑 없음"}, {"value":"on","label":"뚜껑 덮음"} ],
        "default": "off" },
      { "key": "waterMl", "label": "물의 양", "type": "choice", "unit": "mL",
        "options": [ {"value":100,"label":"100 mL"}, {"value":200,"label":"200 mL"} ],
        "default": 200 }
    ],
    "dependent": [
      { "key": "dropC", "label": "물이 식은 정도", "unit": "°C" },
      { "key": "endC", "label": "10분 뒤 물의 온도", "unit": "°C" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": ["hot-water"],
    "safetyChecklist": [
      "뜨거운 물은 선생님이 따라 주세요.",
      "컵을 옮길 때는 받침을 잡고 천천히 옮겨요.",
      "뜨거운 물이 담긴 컵 주변에서 장난치지 않아요."
    ],
    "safetyMessages": {
      "NO_GOGGLES": "뜨거운 물을 다룰 때는 보안경을 착용해 주세요!",
      "NO_GLOVES": "뜨거운 컵은 장갑을 끼고 받침을 잡아 옮겨 주세요!",
      "SPILL": "물이 쏟아졌어요. 손대지 말고 선생님께 바로 알려 주세요!",
      "FOOD": "실험대 위에서는 음식을 먹지 않아요!"
    },
    "safetyNotices": [],
    "limits": ["열량", "비열", "열전도율", "칼로리", "분자"],
    "params": { "startC": 60, "roomC": 20, "durationS": 600 },
    "tutor": {
      "forbiddenAnswers": [
        "솜으로 감싸면 덜 식",
        "에어캡으로 감싸면 덜 식",
        "뚜껑을 덮으면 덜 식",
        "두껍게 감쌀수록 덜 식",
        "물의 양이 많을수록 덜 식",
        "공기가 열의 이동을 막",
        "종이는 효과가 적"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 물이 식은 정도가 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 식은 정도가 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 물이 식은 정도는 어떻게 달라졌나요? 그래프의 기울기도 비교해 볼까요?" },
        { "when": "fair-test", "iv": "wrap", "text": "감싸는 재료만 바꾸었을 때 열화상 화면에서 컵 바깥의 색은 어떻게 달랐나요? 그 차이는 무엇을 뜻할까요?" },
        { "when": "fair-test", "iv": "lid", "text": "뚜껑만 바꾸었을 때 김이 나는 모습과 식은 정도를 함께 비교해 볼까요? 열은 어디로 빠져나갔을까요?" },
        { "when": "fair-test", "iv": "layers", "text": "겹 수만 바꾸었을 때 결과가 달라졌나요? 어떤 재료로 감쌌는지와 함께 생각해 볼까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 그래프와 열화상 화면의 어느 부분을 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

- 전수 가드 테스트(모든 probe × 모든 변인)에서 오검출이 없어야 한다.
- 공용 안전 메시지의 기본 문구 중 산성 용액처럼 특정 단원에만 맞는 것이 있는지 확인한다. 이 단원은 네 가지를 모두 매니페스트에서 덮어쓴다.

## 4. 화면 (`apps/student/src/modules/insulated-cup/`)

- **거시(SVG) "눈으로 보기"**
  - 컵, 물 높이(waterMl), 감싼 재료 층을 그린다.
    - 재료마다 색과 무늬, 그리고 글자 라벨로 구분한다(종이: 가는 선, 솜: 점, 에어캡: 동그라미, 포일: 은색 사선).
    - 2겹이면 층 두께를 두 배로 그린다.
  - 뚜껑이 있으면 뚜껑을, 없으면 김 줄기 1~3개를 그린다. 김 줄기 수는 (waterC − roomC)에 비례한다.
  - 가상 온도계는 물속에 꽂혀 있다.
  - 아래 문구: `"물 {waterC} °C · {t/60을 반올림}분"`.
- **미시 자리(Canvas 또는 SVG) "열화상으로 보기"**
  - 컵 옆면 바깥(surfaceSideC)과 윗면(surfaceTopC)을 색지도로 칠한다. 20 °C 파랑 → 40 °C 노랑 → 60 °C 빨강, 3구간 선형 보간.
  - 오른쪽에 색 막대 범례(20·40·60 °C 눈금)를 둔다.
  - 각 면 옆에 숫자 온도를 글자로 쓴다(색만으로 전달하지 않기).
  - 열이 빠져나가는 화살표(옆면 양쪽, 윗면)를 그린다. 굵기는 lossSideW·lossTopW에 비례하고, 화살표 옆에 "열이 빠져나가요" 라벨을 붙인다.
  - 이 화면은 실제 열화상 카메라가 아니라 계산한 값으로 그린 그림이다. 그림 아래에 "계산으로 그린 열화상 그림이에요."를 표시한다.
- **그래프**: y = waterC, 라벨 `물의 온도(°C)`, `yMin` 20.
- **센서(2채널 온도 센서 모의)**: "가상 온도 센서 1: 컵 속 물"(waterC), "가상 온도 센서 2: 실내 공기"(roomC, 잡음만). kind는 모두 temperature이고, 접근성 이름에 1·2와 위치를 넣는다.
- **결과 열**: 물이 식은 정도(°C), 10분 뒤 물의 온도(°C), 처음 컵 바깥 온도(°C).
- **예측 비교**: `sameThreshold` = 0.5 °C.
- **안전**: 처음 실행할 때 점검표를 띄운다(공용 기능).

## 5. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 통과. 기존 단위 197개와 E2E 51개는 기대값을 바꾸지 않는다. 단원 수를 세는 테스트는 5로 바뀐다.
- 새 단위 테스트: §2.1 전부, 스키마(다섯 매니페스트 통과), 튜터 전수 가드, 레지스트리 5단원.
- 새 E2E (`e2e/heat.spec.ts`):
  - 첫 실행 때 점검표를 거쳐 기준 시행을 하면 7.6이 보인다.
  - 감싸는 재료를 솜으로 바꾸면 식은 정도가 작아지고 "결과: 줄어들었다"와 재료 전용 질문이 나온다.
  - 새 페이지에서 겹 수만 바꾸면(감싸지 않음) "결과: 변하지 않았다"와 겹 수 전용 질문이 나온다.
  - 열화상 화면에 숫자 온도와 "계산으로 그린 열화상 그림이에요."가 보인다.
  - 기존 `routing`, `layout`, `a11y` spec에 새 단원을 추가한다.
- 문서: `docs/testing.md` spec 목록, README 구조 표에 `@sci/engine-physics`를 추가한다.
