# 구현 사양: 4학년 「땅의 변화」 최소 실험 (v0) — 마그마가 식는 빠르기와 알갱이 크기

> 앞 사양: `g4-gases-mvp.md`(변인 실험 모듈), `g6-combustion-mvp.md`(공용 안전, `yMin`), 물리 단원들(`g5-heat`, `g5-light`, `g6-electricity`: 상시 안전 문구 `ALWAYS_NOTICE`, 그래프 `markers`), `docs/testing.md`.
> 이 단원으로 E4(지구) 엔진 패키지 `@sci/engine-earth`를 시작한다. 새 변인 실험 모듈은 `magma-cooling`이다.
> 범위 밖: 화산 분출 모형 시뮬레이터, 지진 대피 VR 훈련은 다음 버전에서 한다(명세서 앱 모듈 목록에 있음). 이번에는 성취기준의 "화성암 알갱이 크기 차이의 원인"을 변인 통제 실험으로 다룬다.

## 1. 실험 개요

- **탐구 질문**: "녹은 물질이 식어서 굳을 때, 생기는 알갱이의 크기는 어떤 조건에 따라 달라질까?"
- **모형의 뜻**
  - 녹인 실험용 물질(스테아르산)은 마그마를 나타낸다.
  - 빨리 식으면 알갱이가 작아진다. 지표 가까이에서 빨리 식은 현무암과 같다.
  - 천천히 식으면 알갱이가 커진다. 땅속 깊은 곳에서 천천히 식은 화강암과 같다.
- **조건 4가지**:
  - 식히는 곳: 얼음물 위 / 실온 / 따뜻한 물 위
  - 녹인 양: 5 g / 10 g
  - 담은 접시: 유리 접시 / 알루미늄 접시
  - 물질의 색깔: 흰색 / 검은색 색소. 결과에 영향이 없는 대조 변인이다.
- **측정**: 굳은 뒤 알갱이의 평균 크기(mm), 다 굳을 때까지 걸린 시간(초)
- **학습 의도**
  - 천천히 식을수록 알갱이가 크다. 식는 빠르기는 식히는 곳, 양, 접시 재질이 모두 바꾼다. 서로 다른 조건 조합이 같은 결과를 내기도 한다(알루미늄 10 g = 유리 5 g). 그래서 한 가지만 바꾸는 비교가 필요하다.
  - 결과를 현무암·화강암 사진 카드와 연결한다.

## 2. 지구 엔진 패키지 (`packages/engines/earth`, `@sci/engine-earth`)

다른 엔진 패키지와 같은 구조로 만든다(src export, typecheck, workspace, `@sci/schema` 타입 의존).

### 2.1 마그마 냉각 모델 (`magma.ts`)

수치는 근사값이며 **교사 검수 대상**이다.

- **입력과 옵션**
  - 입력: `{ place: 'ice'|'room'|'warm', grams: number, dish: 'glass'|'aluminum', color: string }`
  - `opts = { startC = 90, windowHighC = 75, windowLowC = 65, solidC = 60, baseTauS = 40, sizePerSecond = 0.1, sampleEvery = 0.5, tailS = 5 }`
- **주변 온도 Te**: ice 0, room 20, warm 50.
- **시간 상수**: `τ = baseTauS × (grams / 5) × (dish === 'aluminum' ? 0.5 : 1)`. 색깔은 영향 없음.
- **온도**: `T(t) = Te + (startC − Te)·e^(−t/τ)`.
- **알갱이가 자라는 구간**: T가 windowHighC에서 windowLowC로 내려가는 동안.
  - 구간 길이 `growS = τ·ln((75 − Te)/(65 − Te))`
  - 평균 크기 `sizeMm = sizePerSecond × growS`, 소수 둘째 자리
- **다 굳는 시각**: `solidS = τ·ln((90 − Te)/(60 − Te))`, 소수 첫째 자리. 시뮬레이션은 solidS + tailS까지 돈다.
- **결정화 진행도** `crystal`(0~1):
  - T ≥ 75: 0
  - T ≤ 65: 1
  - 그 사이: `(75 − T)/10`
- **샘플**: `{ t, tempC, crystal }`
- **결과**:
  - `sizeMm`
  - `solidS`
  - `rockLike: 'basalt' | 'between' | 'granite'`: sizeMm < 0.7이면 basalt, 0.7 이상 2.0 미만이면 between, 2.0 이상이면 granite
- **`validateMagmaExperiment(exp)`**: 네 변인이 있는지, 값이 허용 범위인지 검사한다. place 세 종, grams 1~50, dish 두 종, color는 문자열.
- 순수 함수, 난수 없음.

### 2.2 미리 계산한 기준값 (크기 mm · 다 굳는 시간 초, 테스트로 고정)

| 접시 · 양 | 얼음물 위 | 실온 | 따뜻한 물 위 |
|---|---|---|---|
| 유리 · 5 g | 0.57 · 16.2 | 0.80 · 22.4 | 2.04 · 55.5 |
| 유리 · 10 g | 1.14 · 32.4 | 1.61 · 44.8 | 4.09 · 110.9 |
| 알루미늄 · 5 g | 0.29 · 8.1 | 0.40 · 11.2 | 1.02 · 27.7 |
| 알루미늄 · 10 g | 0.57 · 16.2 | 0.80 · 22.4 | 2.04 · 55.5 |

### 2.3 반드시 통과할 테스트

- 표 12칸을 고정한다(±0.01 mm, ±0.1 초).
- 식히는 곳: 얼음물 < 실온 < 따뜻한 물 순으로 크기가 커진다. 양이 많을수록, 유리 접시일수록 커진다.
- 색깔만 바꾸면 결과가 똑같다.
- 알루미늄 10 g과 유리 5 g은 결과가 같다(서로 다른 조합의 같은 결과).
- 모든 샘플에서 tempC는 단조 감소하고, crystal은 단조 증가하며 0~1 안에 있다.
- rockLike 경계: 0.57은 basalt, 0.80은 between, 2.04는 granite.

## 3. 매니페스트 (`content/units/g4-land/manifest.json`)

```jsonc
{
  "id": "g4-land",
  "title": "땅의 변화",
  "grade": 4,
  "standards": ["4과11-01"],     // 명세서 단원 번호 체계에서 추정. 고시 대조 필요
  "engine": "earth",
  "experiments": [{
    "id": "magma-cooling",
    "module": "magma-cooling",
    "title": "식는 빠르기에 따른 알갱이 크기 비교하기",
    "question": "녹은 물질이 식어서 굳을 때, 생기는 알갱이의 크기는 어떤 조건에 따라 달라질까?",
    "predictionPrompt": "예측: 생기는 알갱이의 크기는?",
    "variables": [
      { "key": "place", "label": "식히는 곳", "type": "choice",
        "options": [ {"value":"ice","label":"얼음물 위"}, {"value":"room","label":"실온"}, {"value":"warm","label":"따뜻한 물 위"} ],
        "default": "room" },
      { "key": "grams", "label": "녹인 양", "type": "choice", "unit": "g",
        "options": [ {"value":5,"label":"5 g"}, {"value":10,"label":"10 g"} ],
        "default": 5 },
      { "key": "dish", "label": "담은 접시", "type": "choice",
        "options": [ {"value":"glass","label":"유리 접시"}, {"value":"aluminum","label":"알루미늄 접시"} ],
        "default": "glass" },
      { "key": "color", "label": "물질의 색깔", "type": "choice",
        "options": [ {"value":"white","label":"흰색"}, {"value":"black","label":"검은색 색소를 넣음"} ],
        "default": "white" }
    ],
    "dependent": [
      { "key": "sizeMm", "label": "알갱이의 크기", "unit": "mm" },
      { "key": "solidS", "label": "다 굳을 때까지 걸린 시간", "unit": "초" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": ["hot"],
    "safetyChecklist": [
      "녹인 물질은 뜨거우니 선생님이 따라 주세요.",
      "굳기 전에는 손으로 만지지 않아요.",
      "가열 기구 주변을 깨끗이 정리했어요."
    ],
    "safetyMessages": {
      "NO_GOGGLES": "뜨거운 물질을 다룰 때는 보안경을 먼저 착용해 주세요!",
      "NO_GLOVES": "뜨거운 접시는 장갑을 끼고 옮겨 주세요!",
      "SPILL": "녹은 물질이 쏟아졌어요! 손대지 말고 선생님께 알려 주세요.",
      "FOOD": "실험 중에는 음식을 먹지 않아요!"
    },
    "safetyNotices": [],
    "limits": ["결정질", "광물 이름", "냉각 속도", "규산염", "분자"],
    "params": { "startC": 90 },
    "tutor": {
      "forbiddenAnswers": [
        "천천히 식을수록 알갱이가 크",
        "빨리 식을수록 알갱이가 작",
        "화강암은 천천히 식",
        "현무암은 빨리 식",
        "색깔은 관계없"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 생기는 알갱이의 크기가 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 알갱이 크기가 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 알갱이 크기와 굳는 데 걸린 시간은 각각 어떻게 달라졌나요? 두 값 사이에 어떤 관계가 있을까요?" },
        { "when": "fair-test", "iv": "place", "text": "식히는 곳만 바꾸었어요. 그래프에서 온도가 내려가는 빠르기를 비교해 볼까요? 땅속 깊은 곳과 땅 위는 어떤 곳과 비슷할까요?" },
        { "when": "fair-test", "iv": "color", "text": "색깔만 바꾸었을 때 알갱이 크기가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 그래프와 알갱이 화면의 어느 부분을 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

- 전수 가드 테스트(모든 probe × 모든 변인)에서 오검출이 없어야 한다.
- `rockLike`는 예측 비교에 쓰지 않는다. 비교 지표는 sizeMm이고, `sameThreshold`는 0.05 mm다.

## 4. 화면 (`apps/student/src/modules/magma-cooling/`)

- **거시(SVG) "눈으로 보기"**
  - 접시: 유리는 투명한 파랑 테두리, 알루미늄은 은색이다. 글자 라벨을 붙인다.
  - 접시 아래 받침: 얼음물(파랑 + 얼음 조각), 실온(받침 없음), 따뜻한 물(주황 + 김). 각각 글자 라벨을 붙인다.
  - 녹은 물질: 액체일 때는 반투명이다. crystal이 늘수록 불투명해지고, 가장자리부터 굳는 모양으로 그린다. 검은색 색소면 어두운 회색이다.
  - 아래 문구:
    - 굳는 중: `"{tempC} °C · 굳는 중"`
    - 다 굳으면: `"다 굳었어요 · {solidS}초"`
- **미시 자리(SVG) "알갱이로 보기(돋보기)"**
  - 정사각형 확대 창에 알갱이를 다각형 모자이크로 그린다. 시드 고정 점들로 만든 보로노이 모양이면 좋고, 간단한 격자 변형 다각형도 된다.
  - 알갱이 수는 크기에 반비례한다(넓이 기준). 0.29 mm ≈ 120개, 4.09 mm ≈ 6개가 되게 맞춘다.
  - crystal 진행도만큼 알갱이를 채우고, 나머지는 액체 색으로 둔다.
  - 확대 창 아래 축척 막대: "1 mm".
  - 결과가 나오면 옆에 비교 카드를 둔다: "현무암처럼 알갱이가 작아요" / "중간 크기예요" / "화강암처럼 알갱이가 커요". 카드에는 현무암·화강암 표면을 단순화한 그림을 그린다. 실제 사진 저작권 이미지는 쓰지 않는다.
  - reduced-motion이면 진행 애니메이션 없이 진행도만큼 정적으로 채운다.
- **그래프**: y = tempC, 라벨 `물질의 온도(°C)`, yMin 0. markers 두 개를 둔다.
  - growS 구간의 시작: "알갱이가 생기기 시작"
  - 끝: "알갱이가 다 자람"
  - 시행마다 시각이 다르므로 markers를 시행의 결과에서 계산할 수 있게 한다. 모듈의 markers가 함수 `(trial) => markers`도 받도록 일반화하되, 기존 고정 배열도 계속 지원한다.
- **센서**: "가상 온도 센서: 녹인 물질"(tempC).
- **결과 열**:
  - 알갱이의 크기(mm, 소수 둘째 자리)
  - 다 굳을 때까지 걸린 시간(초)
  - 닮은 암석: "현무암 쪽" / "중간" / "화강암 쪽"
- **안전**: 처음 실행할 때 점검표를 띄운다. 상시 문구(`safety`에 `hot`이 있을 때)는 기존 `ALWAYS_NOTICE`에 `hot` 키가 있으면 그대로 쓴다. 없으면 "⚠ 녹인 물질과 접시는 굳은 뒤에도 한동안 뜨거워요."를 추가한다. 이때 이미 `hot`을 쓰는 단원(연소, 전기)의 화면이 바뀌는지 확인하고, 바뀌면 보고한다.

## 5. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 **종료 코드 0**. 기존 테스트 기대값은 바꾸지 않는다. 단원 수 단언만 하나 늘린다.
- 새 단위 테스트:
  - §2.3 전부
  - 스키마, 튜터 전수 가드, 레지스트리
  - markers 함수형 지원: 기존 고정 배열 단원이 그대로인지
- 새 E2E (`e2e/land.spec.ts`):
  - 점검표를 거쳐 기준(실온, 5 g, 유리, 흰색)을 실행하면 0.80과 "중간"이 보인다.
  - 따뜻한 물 위로 바꾸면 2.04, "화강암 쪽", "결과: 늘어났다", 식히는 곳 전용 질문이 나온다.
  - 새 페이지에서 색깔만 바꾸면 "결과: 변하지 않았다"와 색깔 전용 질문이 나온다.
  - 돋보기 화면에 "1 mm" 축척과 비교 카드 문구가 보인다.
  - SVG 글자는 13 px 이상이다(빛 단원 검사 재사용).
  - 기존 `routing`, `layout`, `a11y` spec에 새 단원을 추가한다.
- 문서: `docs/testing.md` spec 목록, README 구조 표(`@sci/engine-earth`).
