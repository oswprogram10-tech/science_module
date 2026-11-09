# 구현 사양: 다단원 구조 전환 + 4학년 「여러 가지 기체」 최소 실험 (v0)

> 앞 사양: `docs/specs/g5-solution-mvp.md` (용해와 용액). 이번 작업은 두 부분으로 나눈다.
> **A. 다단원 구조로 리팩터링**: 용해와 용액의 동작은 그대로 유지하고 기존 테스트도 모두 통과해야 한다.
> **B. 여러 가지 기체 실험 추가**: 주사기에 갇힌 기체의 부피가 누르는 힘·온도·기체 종류·처음 부피에 따라 어떻게 달라지는지 알아본다.

## A. 다단원 구조

### A1. 매니페스트·스키마 (`@sci/schema`)

실험(`experiments[]`)에 다음을 추가·변경한다.

| 필드 | 내용 |
|---|---|
| `module` (필수) | 실험 모듈 종류. `"dissolution"` \| `"gas-syringe"` |
| `params` (선택) | 모듈별 설정 객체(`record<string, unknown>`). 모듈의 validate가 검사한다. |
| `spoonGrams` | **선택**으로 변경. dissolution 모듈의 validate가 필수로 검사한다. |
| `predictionPrompt` (필수) | 예측 질문 제목. 예: `"예측: 녹는 양은?"` |
| `safetyNotices` (선택) | `[{ "key": "waterTempC", "value": 60, "text": "…" }]`. 해당 변인이 그 값이면 설계 패널에 경고를 띄운다. 지금 `DesignPanel`에 하드코딩된 60 °C 경고를 이 방식으로 옮긴다. |
| `tutor.probes[].iv` (선택) | 이 조작변인일 때만 쓰는 질문. |

- probe `when` 열거형에서 `'fair-test-stir'`를 **삭제**한다. 용해와 용액 매니페스트의 해당 항목은 `{ "when": "fair-test", "iv": "stir", "text": (기존 문구 그대로) }`로 옮긴다.
- `standards`는 빈 배열을 허용한다.
- 매니페스트 최상위에 `grade`, `title`은 그대로 둔다.

### A2. 런타임 일반화 (`@sci/runtime`)

- `Trial<S extends { t: number }, R>`로 제네릭화한다. 엔진 타입(`DissolutionSample` 등)을 직접 import하지 않는다.
- `SimulateFn<S, R> = (values) => { samples: S[]; result: R }`.
- `sampleAt(trial, t, interpolate?)`: `interpolate(a, b, k) => S`를 받는다. 생략하면 숫자 필드를 모두 선형 보간하는 기본 함수를 쓴다.
- 용해 모델의 계단식 `addedG` 규칙(지금 runtime 안에 있음)은 `@sci/engine-matter`의 `interpolateDissolution`으로 옮긴다. 기존 sampleAt 테스트는 이 함수를 넘겨서 같은 결과가 나와야 한다.

### A3. 게이트웨이·튜터

- `structuralFeedback(analysis, labels, ivKey, dependentLabel)`: confounded 문장의 "녹은 양이"를 `{dependentLabel}{이/가}`로 바꾼다. 앱은 `experiment.dependent[0].label`을 넘긴다. 용해와 용액의 출력 문장은 바뀌지 않아야 한다.
- `observedOutcome(prev, cur, sameThreshold)`: 세 번째 인자 이름만 일반화한다. 동작은 같다.
- `selectProbe`: 같은 `when` 안에서 `iv`가 현재 조작변인과 일치하는 probe를 먼저 고르고, 없으면 `iv`가 없는 probe를 고른다. 우선순위 목록에서 `fair-test-stir` 단계는 이 규칙으로 대체된다.

### A4. 실험 모듈 (`apps/student/src/modules/`)

```ts
interface ExperimentModule<S extends { t: number }, R> {
  kind: 'dissolution' | 'gas-syringe';
  validate(exp: Experiment): string[];
  simulate(values: Values, exp: Experiment): { samples: S[]; result: R };
  interpolate(a: S, b: S, k: number): S;
  /** 예측 비교와 그래프 y축에 쓰는 주 측정값 */
  metric: { sampleKey: keyof S; resultKey: keyof R; sameThreshold(exp: Experiment): number };
  graph: { yLabel: string };                 // 예: '녹은 양(g)'
  resultColumns(exp: Experiment): { label: string; value(r: R): string }[];
  sensors(snapshot: S | null, values: Values): SensorSpec[];   // 표시할 모의 센서와 원천값
  MacroView: React.ComponentType<ViewProps<S>>;
  MicroView: React.ComponentType<ViewProps<S>>;
}
```

- `dissolution` 모듈: 지금 App에 흩어진 용해 전용 코드를 옮긴다. 비커·알갱이 화면, 결과 열(녹은 양, 숟가락 수, 걸린 시간), 센서(온도계·전자저울)가 여기에 속한다.
- `App`은 모듈만 보고 동작한다. `SensorBar`, `ResultsTable`, `GraphView`는 모듈이 준 정보로 그린다.
  - 그래프 aria-valuetext는 `"{t}초, {graph y 라벨 앞부분} {값}"` 형태로 일반화한다.
  - 센서는 `SensorSpec = { id, label, unit, kind, source: number }`이고, App이 kind에 맞는 Mock 드라이버를 만들어 읽는다.

### A5. 단원 목록과 이동

- `apps/student/src/units.ts`: 두 매니페스트를 import해 등록한다. 매니페스트마다 schema 검증과 모듈 validate를 거친다. 실패한 단원은 목록에 오류로 표시하고, 다른 단원은 계속 쓸 수 있다.
- 해시 라우팅: `#/` → 단원 목록, `#/unit/{unitId}` → 실험 화면. 알 수 없는 id면 목록으로 돌아간다.
- 단원 목록: 학년별 카드(학년, 단원명, 탐구 질문, 성취기준 코드). 카드 전체가 버튼(최소 44 px)이다.
- 실험 화면 머리글에 "← 단원 목록" 링크를 둔다.
- 단원을 바꾸면 런타임 상태는 새로 만든다(이전 단원 시행과 섞이지 않게).
- xAPI activity id는 `https://sci-bridge.local/activities/{unitId}/{expId}`로 한다.

## B. 「여러 가지 기체」 실험

### B1. 매니페스트 (`content/units/g4-gases/manifest.json`)

```jsonc
{
  "id": "g4-gases",
  "title": "여러 가지 기체",
  "grade": 4,
  "standards": ["4과15-01"],   // 명세서 단원 번호 체계에서 추정. 고시 원문 대조 필요
  "engine": "matter",
  "experiments": [{
    "id": "syringe-volume",
    "module": "gas-syringe",
    "title": "주사기 속 기체의 부피 변화 알아보기",
    "question": "주사기 속 기체의 부피는 어떤 조건에 따라 달라질까?",
    "predictionPrompt": "예측: 기체의 부피는?",
    "variables": [
      { "key": "push", "label": "피스톤을 누르는 힘", "type": "choice",
        "options": [ {"value":0,"label":"누르지 않음"}, {"value":1,"label":"살짝 누름"}, {"value":2,"label":"세게 누름"} ],
        "default": 0 },
      { "key": "bathTempC", "label": "주사기를 담근 물의 온도", "type": "choice", "unit": "°C",
        "options": [ {"value":0,"label":"얼음물 0 °C"}, {"value":20,"label":"실온 20 °C"}, {"value":60,"label":"뜨거운 물 60 °C"} ],
        "default": 20 },
      { "key": "gasType", "label": "기체의 종류", "type": "choice",
        "options": [ {"value":"air","label":"공기"}, {"value":"oxygen","label":"산소"}, {"value":"carbonDioxide","label":"이산화 탄소"} ],
        "default": "air" },
      { "key": "startMl", "label": "처음 기체의 부피", "type": "choice", "unit": "mL",
        "options": [ {"value":30,"label":"30 mL"}, {"value":50,"label":"50 mL"} ],
        "default": 30 }
    ],
    "dependent": [
      { "key": "volumeMl", "label": "기체의 부피", "unit": "mL" },
      { "key": "changeMl", "label": "부피 변화", "unit": "mL" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": ["hot-water"],
    "safetyNotices": [
      { "key": "bathTempC", "value": 60, "text": "⚠ 뜨거운 물 주의: 60 °C의 물은 화상을 입을 수 있어요. 실제 실험에서는 선생님과 함께 조심해서 다뤄요." }
    ],
    "limits": ["보일", "샤를", "절대 온도", "분자", "몰"],
    "params": { "syringeMaxMl": 60 },
    "tutor": {
      "forbiddenAnswers": [
        "세게 누를수록 부피가 작아",
        "누르는 힘이 클수록 부피가 작아",
        "온도가 높을수록 부피가 커",
        "온도가 낮을수록 부피가 작아",
        "기체의 종류와 관계없이"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 기체의 부피가 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 부피가 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 주사기 눈금은 어떻게 달라졌나요? 알갱이 화면에서 알갱이 사이의 거리도 살펴볼까요?" },
        { "when": "fair-test", "iv": "bathTempC", "text": "물의 온도만 바꾸었을 때 알갱이의 움직임은 어떻게 달라 보이나요? 그것이 주사기 눈금과 어떤 관계가 있을까요?" },
        { "when": "fair-test", "iv": "gasType", "text": "기체의 종류만 바꾸었을 때 부피 변화가 달라졌나요? 두 결과를 나란히 놓고 비교해 볼까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 결과표와 그래프의 어느 부분을 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

`limits`의 "몰"이 일반 낱말("몰라요" 등)에 걸리지 않는지 튜터 전수 검사 테스트로 확인한다. 걸리면 "몰"을 빼고 보고한다.

### B2. 기체 모델 (`@sci/engine-matter`, `gas.ts`)

- 입력: `{ push: 0|1|2, bathTempC: number, gasType: 'air'|'oxygen'|'carbonDioxide', startMl: number }`, `opts = { dt = 0.05, sampleEvery = 0.25, durationS = 30, syringeMaxMl = 60 }`.
- 처음 상태(t=0): 실온 20 °C, 대기압 1, 부피 `startMl`.
- 가하는 압력(대기압 배수) `P_ext = [1, 1.25, 2][push]`.
- 압력 변화: `P(t) = 1 + (P_ext − 1)(1 − e^(−t/0.5))`.
- 기체 온도: `T(t) = 20 + (bath − 20)(1 − e^(−t/6))`(°C). 물에 담그면 천천히 따라간다.
- 부피: `V(t) = startMl × (1 / P(t)) × (T(t) + 273.15) / 293.15`. 기체 종류는 부피에 영향을 주지 않는다(이상 기체). gasType은 알갱이 색만 바꾼다.
- `V`가 `syringeMaxMl`을 넘으면 RangeError. 매니페스트 조합 안에서는 넘지 않음을 테스트로 확인한다(최대 50 mL × 333.15/293.15 ≈ 56.8 mL).
- 샘플: `{ t, volumeMl, pressureAtm, gasTempC }`. 결과:
  - `volumeMl`: 마지막 부피, 소수 첫째 자리
  - `changeMl`: volumeMl − startMl, 소수 첫째 자리
  - `settleS`: 부피가 마지막 값의 ±1% 안에 처음 들어와 그 뒤로 벗어나지 않는 시각, 소수 첫째 자리
- `validateGasExperiment(exp)`: 네 변인이 모두 있는지, 각 값이 허용 범위인지 검사한다(push ∈ {0,1,2}, bathTempC ∈ [0,80], gasType ∈ 세 종류, startMl > 0, 최대 조합 부피 ≤ params.syringeMaxMl).
- 순수 함수, 난수 없음.

**반드시 통과할 테스트**
- 누르는 힘 0→1→2: 부피가 줄어든다. 처음 30 mL·20 °C에서 각각 30.0 / 24.0 / 15.0 mL(±0.1).
- 물의 온도 0→20→60: 부피가 늘어난다. 30 mL에서 60 °C면 30 × 333.15/293.15 ≈ 34.1 mL.
- 기체 종류만 바꾸면 결과가 똑같다.
- 처음 부피가 2배면 결과 부피도 정확히 비례한다(±0.1).
- 모든 샘플에서 `P × V / (T+273.15)`가 일정하다(상대 오차 1e-9). 압력과 온도를 함께 바꾼 경우도 포함한다.
- 매니페스트의 모든 조합(3×3×3×2)에서 V ≤ 60.

### B3. 기체 모듈 화면

- **거시(SVG) "눈으로 보기"**:
  - 세로 주사기. 끝은 고무마개로 막혀 있다.
  - 0~60 mL 눈금(10 mL마다 숫자). 피스톤 위치는 volumeMl이다.
  - 누르는 힘 1·2일 때 피스톤 위에 손 아이콘이나 화살표를 굵기 다르게 그린다.
  - 주사기를 담근 물통은 색(얼음물 파랑, 실온 연회색, 뜨거운 물 주황)과 글자 라벨("얼음물" 등)로 구분한다.
  - 아래 문구: `"주사기 눈금 {volumeMl} mL"`.
- **미시(Canvas) "알갱이로 보기"**:
  - 상자 높이가 volumeMl에 비례하고, 알갱이 수는 startMl에 비례한다(30 mL → 30개, 50 mL → 50개).
  - 알갱이 속력은 √((gasTempC+273.15)/293.15)에 비례한다. 벽에 부딪히면 튕긴다. 시드 고정 의사난수로 처음 위치를 정한다.
  - 기체 종류마다 색이 다르다(범례를 둔다).
  - 아래 막대 "피스톤에 부딪히는 정도": 처음 상태 대비 상대값 = pressureAtm. 글자로도 "처음보다 1.3배"처럼 쓴다.
  - "분자" 낱말은 쓰지 않는다. `prefers-reduced-motion`이면 움직임을 멈추고 위치만 갱신한다.
- **그래프**: y = volumeMl, 라벨 `기체의 부피(mL)`.
- **센서**: 가상 온도계(기체 온도 gasTempC, 잡음 ±0.2), 가상 압력 센서(pressureAtm × 101.3 kPa, 소수 첫째 자리, 잡음 ±0.1). `@sci/sensors`에 `MockPressureDriver`(kind `'pressure'`, 단위 kPa)를 추가한다.
- **결과 열**: 기체의 부피(mL), 부피 변화(mL, + 기호 포함), 안정 시간(초, 안정되기까지 걸린 시간).
- **예측 비교**: `sameThreshold` = 1 mL.

## C. 검증

- `pnpm typecheck && pnpm test && pnpm build` 통과. 기존 87개 테스트는 리팩터링에 맞춰 import만 바뀌고 기대값은 그대로여야 한다. 기대값을 바꿔야 한다면 보고한다.
- 새 테스트: B2 전부, 스키마(새 필드, `fair-test-stir` 제거, 두 매니페스트 통과), selectProbe의 `iv` 우선 선택, structuralFeedback의 dependentLabel, 압력 드라이버, 단원 레지스트리(한 단원 매니페스트가 깨져도 다른 단원은 로드됨).
- 문서: `docs/specs/g5-solution-mvp.md`에서 바뀐 부분(`fair-test-stir`, structuralFeedback 시그니처, safetyNotices)에 "→ g4-gases-mvp.md A절로 변경" 주석을 단다. README에 단원 목록 이동 방법을 추가한다.
