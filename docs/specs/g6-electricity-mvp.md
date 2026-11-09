# 구현 사양: 6학년 「전기의 이용」 최소 실험 (v0) — 전자석의 세기

> 앞 사양: `g4-gases-mvp.md`(변인 실험 모듈), `g6-combustion-mvp.md`(공용 안전, `yMin`), `g5-heat-mvp.md`·`g5-light-mvp.md`(`@sci/engine-physics`; 가장 최근 모듈 `convex-lens`, 상시 안전 문구 `ALWAYS_NOTICE`), `docs/testing.md`.
> 새 변인 실험 모듈 `electromagnet`. 명세서의 "회로 빌더(전기 흐름 시각화)"를 이 단원의 미시 화면 "전기가 흐르는 모습"으로 구현한다. "AI 비전 브레드보드 오결선 진단"은 이번 범위가 아니다(실물 회로 사진 데이터 필요).

## 1. 실험 개요

- **탐구 질문**: "전자석에 붙는 클립의 수는 어떤 조건에 따라 달라질까?"
- **조건 4가지**:
  - 에나멜선을 감은 횟수: 50 / 100 / 200회
  - 전지 연결: 전지 1개 / 2개 직렬 / 2개 병렬
  - 속에 넣은 것: 철못 / 빨대만
  - 전지 방향: 처음 방향 / 반대 방향
- **측정**:
  - 붙은 클립 수
  - 못 머리 쪽의 극(나침반으로 확인)
  - 에나멜선 온도
- **학습 의도**
  - 많이 감을수록, 전지를 직렬로 연결할수록 전자석이 세진다. 병렬 연결은 1개일 때와 세기가 같다.
  - 철못이 있어야 클립이 붙을 만큼 세진다(빨대만이면 거의 붙지 않음).
  - 전지 방향을 바꾸면 클립 수는 같지만 극이 바뀐다. 클립 수만 보면 "변하지 않았다"가 나오고, 극 열에서 차이를 찾게 하는 구조다.
  - 전자석은 전기가 흐를 때만 자석이 된다. 스위치를 끄면 클립이 떨어진다(그래프에 보임).
  - 안전: 전기가 많이 흐르면 에나멜선이 뜨거워진다.

## 2. 전자석 모델 (`@sci/engine-physics`, `electromagnet.ts`)

수치는 근사값이며 **교사 검수 대상**이다.

### 2.1 계산

- 입력: `{ turns: number, battery: 'one'|'series'|'parallel', core: 'nail'|'straw', direction: 'forward'|'reverse' }`
- 옵션: `opts = { durationS = 20, onS = 2, offS = 14, sampleEvery = 0.25, roomC = 20, clipDivisor = 8, airCore = 0.05, attachTauS = 0.3, heatGain = 4, heatTauS = 8, hotC = 40 }`
- **회로**
  - 코일 저항 `R = 0.5 + turns × 0.01`(Ω, 내부값)
  - 전지 전압 1.5. 직렬은 2배, 병렬은 1배로 본다(전지 내부 저항 무시).
  - 흐르는 정도 `I = 1.5·n / R`. n은 series면 2, 나머지는 1.
- **최대 클립 수**: `clipsMax = floor(turns × I × coreFactor / clipDivisor + 1e-9)`. coreFactor는 nail 1, straw airCore.
- **시간에 따른 클립 수(연속값, 표시는 반올림)**
  - t < onS: 0
  - onS ≤ t < offS: `clipsMax·(1 − e^(−(t−onS)/attachTauS))`
  - t ≥ offS: 0. 전기가 끊기면 바로 떨어진다. 샘플이 끊기는 순간을 놓치지 않도록 offS 직전과 직후에 샘플을 하나씩 더 넣는다.
- **극**: forward면 못 머리 쪽이 N, reverse면 S. 전기가 흐르는 동안만 있고 그 밖에는 없음.
- **에나멜선 온도**
  - 켜져 있는 동안 `wireC = roomC + heatGain·P·(1 − e^(−(t−onS)/heatTauS))`. `P = I²·R`.
  - 끈 뒤에는 같은 시간 상수로 roomC를 향해 식는다.
- **흐름 표시용**: 켜져 있으면 `flow = I`, 아니면 0.

### 2.2 출력과 함수

- 샘플: `{ t, clips, wireC, flow, on: 0|1 }`
- 결과:
  - `clipsMax`
  - `headPole: 'N'|'S'`
  - `wireMaxC`: 소수 첫째 자리
  - `hot: wireMaxC ≥ hotC`
- `validateElectromagnetExperiment(exp)`: 네 변인이 있는지, 값이 허용 범위인지 검사한다. turns는 10~500, battery 세 종, core 두 종, direction 두 종.
- 순수 함수, 난수 없음.

### 2.3 미리 계산한 기준값 (철못, 테스트로 고정)

| 감은 횟수 | 전지 1개 | 2개 직렬 | 2개 병렬 |
|---|---|---|---|
| 50회 | 9개 · 27.0 °C | 18개 · 48.0 °C(뜨거움) | 9개 · 27.0 °C |
| 100회 | 12개 · 24.7 °C | 25개 · 38.6 °C | 12개 · 24.7 °C |
| 200회 | 15개 · 22.8 °C | 30개 · 31.2 °C | 15개 · 22.8 °C |

- 온도는 켠 뒤 12초(끄기 직전)의 최고값이다.
- 빨대만일 때: 100·200회 직렬은 1개, 나머지는 모두 0개.

### 2.4 반드시 통과할 테스트

- 위 표 9칸, 빨대 9칸을 고정한다.
- 병렬과 1개는 모든 감은 횟수에서 결과가 같다.
- 방향만 바꾸면 clipsMax와 wireMaxC가 같고 headPole만 반대다.
- offS 이후 샘플의 clips는 0이고 on은 0이다. onS 이전도 같다.
- 켜진 동안 clips는 단조 증가하고, 끈 뒤 wireC는 단조 감소한다.

## 3. 매니페스트 (`content/units/g6-electricity/manifest.json`)

```jsonc
{
  "id": "g6-electricity",
  "title": "전기의 이용",
  "grade": 6,
  "standards": ["6과15-01"],     // 명세서 단원 번호 체계에서 추정. 고시 대조 필요
  "engine": "physics",
  "experiments": [{
    "id": "electromagnet",
    "module": "electromagnet",
    "title": "전자석의 세기 비교하기",
    "question": "전자석에 붙는 클립의 수는 어떤 조건에 따라 달라질까?",
    "predictionPrompt": "예측: 전자석에 붙는 클립의 수는?",
    "variables": [
      { "key": "turns", "label": "에나멜선을 감은 횟수", "type": "choice", "unit": "회",
        "options": [ {"value":50,"label":"50회"}, {"value":100,"label":"100회"}, {"value":200,"label":"200회"} ],
        "default": 100 },
      { "key": "battery", "label": "전지 연결", "type": "choice",
        "options": [ {"value":"one","label":"전지 1개"}, {"value":"series","label":"전지 2개 직렬 연결"}, {"value":"parallel","label":"전지 2개 병렬 연결"} ],
        "default": "one" },
      { "key": "core", "label": "속에 넣은 것", "type": "choice",
        "options": [ {"value":"nail","label":"철못"}, {"value":"straw","label":"빨대만 (철못 없음)"} ],
        "default": "nail" },
      { "key": "direction", "label": "전지 방향", "type": "choice",
        "options": [ {"value":"forward","label":"처음 방향"}, {"value":"reverse","label":"반대 방향"} ],
        "default": "forward" }
    ],
    "dependent": [
      { "key": "clipsMax", "label": "붙은 클립의 수", "unit": "개" },
      { "key": "headPole", "label": "못 머리 쪽의 극", "unit": "" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": ["electric", "hot"],
    "safetyChecklist": [
      "전지의 두 끝을 전선으로 바로 잇지 않아요.",
      "에나멜선이 뜨거워지면 바로 스위치를 꺼요.",
      "젖은 손으로 전기 기구를 만지지 않아요."
    ],
    "safetyMessages": {
      "NO_GOGGLES": "실험을 계속하기 전에 보안경을 먼저 착용해 주세요!",
      "NO_GLOVES": "뜨거워진 에나멜선은 장갑을 끼고 만져 주세요!",
      "SPILL": "물이 쏟아졌어요! 전기 기구를 만지지 말고 선생님께 알려 주세요.",
      "FOOD": "실험 중에는 음식을 먹지 않아요!"
    },
    "safetyNotices": [],
    "limits": ["전자", "전압", "저항", "암페어", "볼트", "옴", "자기장", "자기력선"],
    "params": { "durationS": 20, "onS": 2, "offS": 14 },
    "tutor": {
      "forbiddenAnswers": [
        "많이 감을수록 세",
        "직렬로 연결하면 세",
        "병렬로 연결하면 1개와 같",
        "방향을 바꾸면 극이 바뀌",
        "철못이 있어야",
        "전기가 흐를 때만 자석"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 붙는 클립의 수가 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요? 그래프에서 스위치를 끈 뒤에는 어떻게 되었나요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 클립 수가 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 붙은 클립의 수는 어떻게 달라졌나요? 전기가 흐르는 모습 화면도 비교해 볼까요?" },
        { "when": "fair-test", "iv": "battery", "text": "전지 연결만 바꾸었어요. 전기가 흐르는 모습 화면에서 점이 움직이는 빠르기는 어떻게 달랐나요?" },
        { "when": "fair-test", "iv": "direction", "text": "전지 방향만 바꾸었을 때 클립의 수와 나침반 바늘은 각각 어떻게 되었나요? 결과표의 극 칸도 살펴볼까요?" },
        { "when": "fair-test", "iv": "core", "text": "속에 넣은 것만 바꾸었을 때 클립의 수가 어떻게 달라졌나요? 무엇이 그런 차이를 만들었을까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 그래프와 전기가 흐르는 모습 화면의 어느 부분을 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

- 전수 가드 테스트(모든 probe × 모든 변인)에서 오검출이 없어야 한다.
- 극(`headPole`)은 숫자가 아니라서 예측 비교에 쓰지 않는다. 비교 지표는 clipsMax다.

## 4. 화면 (`apps/student/src/modules/electromagnet/`)

- **거시(SVG) "눈으로 보기"**
  - 가로로 놓인 못(또는 빨대). 감은 횟수에 따라 코일 감김 수를 다르게 그린다(50·100·200 → 6·10·16줄).
  - 전지 집과 전지: 1개, 2개 직렬(일렬), 2개 병렬(위아래 나란히). +/− 표시가 방향에 따라 바뀐다.
  - 스위치는 on이면 닫힘, 아니면 열림 그림.
  - 못 끝 아래에 붙은 클립을 그린다. `round(clips)`개, 화면에 다 안 들어가면 최대 12개를 그리고 "+n".
  - 못 머리 옆 나침반: 바늘 N(빨강)과 S(흰색 + 글자)를 표시한다. 전기가 흐를 때만 극 쪽을 향하고, 끄면 북쪽(위)을 향한다.
  - 아래 문구:
    - 켜짐: `"스위치 켜짐 · 클립 {round(clips)}개"`
    - 꺼짐: `"스위치 꺼짐 · 클립 {round(clips)}개"`
    - 뜨거우면(`wireC ≥ 40`) 덧붙임: `" · ⚠ 에나멜선이 뜨거워요"`
- **미시 자리(SVG) "전기가 흐르는 모습"**(회로 빌더 스타일 표시, 이번에는 조작 없이 보기만)
  - 회로도: 전지 기호(1개, 직렬 2개, 병렬 2개 갈래), 스위치, 코일.
  - 전선 위를 움직이는 점들: 속도는 flow에 비례하고, 꺼지면 멈춘다. 병렬이면 두 갈래에 점이 반씩 나뉘어 각 갈래는 절반 속도로 움직인다.
  - 코일 주위 곡선(자석의 힘이 미치는 모양을 단순화한 그림): 개수는 clips에 비례해 0~6개. 양 끝에 N/S 글자를 쓰고, 꺼지면 사라진다.
  - 점의 움직임은 requestAnimationFrame으로 그린다. reduced-motion이면 점을 고정하고 화살표만 둔다.
  - 그림 아래 문구: `"점이 빠를수록 전기가 많이 흘러요."`
- **그래프**: y = clips, 라벨 `붙은 클립의 수(개)`, yMin 0. 켜짐·꺼짐 구간이 보이게 x축 2초·14초에 얇은 세로 점선과 "켜짐"·"꺼짐" 라벨을 둔다. GraphView에 모듈별 선택 표식 `markers?: {t, label}[]`을 추가한다(기존 단원은 없음).
- **센서**: "가상 온도 센서: 에나멜선"(wireC).
- **결과 열**:
  - 붙은 클립의 수(개)
  - 못 머리 쪽의 극: "N극" / "S극". 빨대만일 때도 극은 생기므로 그대로 표시한다(나침반도 움직인다).
  - 에나멜선 최고 온도(°C)
- **예측 비교**: `sameThreshold` = 0.5개.
- **안전**
  - 처음 실행할 때 점검표를 띄운다.
  - 실행 버튼 아래 상시 문구(`safety`에 `electric` 키): "⚠ 가정용 콘센트 전기로는 절대 실험하지 않아요."
  - 결과가 hot이면 결과표 아래에 "⚠ 에나멜선이 40 °C 넘게 뜨거워졌어요. 실제 실험에서는 오래 연결하지 않아요."를 보여준다.

## 5. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 통과(**종료 코드 0을 확인**). 기존 단위 258개와 E2E 79개는 기대값을 바꾸지 않는다. 단원 수 단언만 7로 바꾼다.
- 새 단위 테스트: §2.4 전부, 스키마(7 매니페스트), 튜터 전수 가드, 레지스트리 7단원, GraphView markers 유무에 따른 기존 단원 무변화(가능하면).
- 새 E2E (`e2e/electricity.spec.ts`):
  - 점검표를 거쳐 기준(100회, 전지 1개, 철못, 처음 방향)을 실행하면 12와 "N극"이 보인다.
  - 전지 연결을 직렬로 바꾸면 25, "결과: 늘어났다", 전지 연결 전용 질문이 나온다.
  - 새 페이지에서 방향만 바꾸면 12, "S극", "결과: 변하지 않았다", 방향 전용 질문이 나온다.
  - 50회 직렬이면 뜨거움 경고가 나온다.
  - 그래프 슬라이더를 End로 옮기면 거시 문구에 "스위치 꺼짐 · 클립 0개"가 보인다.
  - 기존 `routing`, `layout`, `a11y` spec에 새 단원을 추가한다.
- 문서: `docs/testing.md` spec 목록.
