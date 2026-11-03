# 구현 사양: 5학년 「용해와 용액」 최소 실험 (수직 슬라이스 v0)

> 계획서 §7.1 S1~S3 범위의 최소판. 실물 센서 없이 Mock 센서로 끝까지 동작해야 한다.
> Capacitor 플랫폼 추가(ios/android)는 이번 범위가 아니다. 웹으로 동작시키되 구조는 앱 패키징을 전제로 둔다.

## 1. 목표 (완료 조건)

학생이 브라우저에서 다음 흐름을 끝까지 수행할 수 있다.

1. 변인 4개(용질 종류, 물의 양, 물의 온도, 젓기)의 값을 고르고, 그중 하나를 **조작변인**으로 지정한다(나머지는 자동으로 통제변인).
2. 예측을 고른다(늘어난다 / 줄어든다 / 변하지 않는다). 예측이 없거나 조작변인이 1개가 아니면 실행 버튼이 꺼지고 이유가 보인다.
3. 실행하면 약 8초 동안 실험이 재생된다. 비커 그림(거시), 알갱이 애니메이션(미시), 그래프(기호)가 **같은 시각**을 보여준다. 가상 온도계와 전자저울 값이 바뀐다.
4. 끝나면 결과표에 시행이 쌓인다(조건, 녹은 양 g, 숟가락 수, 걸린 시간).
5. 앞 시행과 비교해 조작변인 말고 다른 변인도 바뀌었으면 결과는 그대로 보여주고, 그 뒤 구조적 피드백을 준다. "틀렸습니다" 같은 판정 문구는 쓰지 않는다.
6. 규칙 기반 튜터가 상황에 맞는 탐침 질문 1개를 보여준다. 정답을 말하지 않는다.
7. 실행이 끝난 뒤 그래프를 클릭하거나 드래그하면 세 화면과 센서 값이 그 시각으로 함께 이동한다.

## 2. 저장소 구조

pnpm workspace, TypeScript(strict), ESM. 패키지는 빌드하지 않고 소스(`src/index.ts`)를 직접 export해서 Vite·Vitest가 바로 읽는다.

```
package.json               # private, scripts: dev, build, test, typecheck
pnpm-workspace.yaml        # apps/*, packages/*, packages/engines/*
tsconfig.base.json
vitest.config.ts           # 루트에서 모든 패키지 테스트 실행
content/units/g5-solution/manifest.json
packages/schema            # @sci/schema   — zod 스키마 + 타입
packages/runtime           # @sci/runtime  — 시행 관리, 타임라인, 플레이헤드
packages/gateway           # @sci/gateway  — 실행 조건, 시행 비교, 피드백, 조사(josa)
packages/engines/matter    # @sci/engine-matter — 용해 모델
packages/sensors           # @sci/sensors  — SensorDriver 인터페이스 + Mock 드라이버
packages/tutor             # @sci/tutor    — 규칙 기반 탐침 질문 + 출력 가드
packages/xapi              # @sci/xapi     — xAPI 문장 생성 + 메모리 큐
apps/student               # Vite + React 19 앱
```

- 패키지 이름은 `@sci/*`, `workspace:*`로 참조한다.
- 각 패키지에 `typecheck` 스크립트(`tsc --noEmit`)를 둔다.
- 외부 런타임 의존성은 `react`, `react-dom`, `zod`만 쓴다. 그래프·애니메이션은 SVG와 Canvas 2D로 직접 그린다.

## 3. 매니페스트 (`content/units/g5-solution/manifest.json`)

`@sci/schema`의 zod 스키마로 검증한다. 최소 필드:

```jsonc
{
  "id": "g5-solution",
  "title": "용해와 용액",
  "grade": 5,
  "standards": ["6과03-01"],          // TODO: 고시 원문 대조 후 보완
  "engine": "matter",
  "experiments": [{
    "id": "dissolve-amount",
    "title": "물에 녹는 용질의 양 비교하기",
    "question": "어떤 조건에서 용질이 더 많이 녹을까?",
    "spoonGrams": 2,
    "variables": [
      { "key": "solute", "label": "용질의 종류", "type": "choice",
        "options": [ {"value":"salt","label":"소금"}, {"value":"sugar","label":"설탕"},
                     {"value":"alum","label":"백반"}, {"value":"bakingSoda","label":"베이킹 소다"} ],
        "default": "salt" },
      { "key": "waterMl", "label": "물의 양", "type": "choice", "unit": "mL",
        "options": [ {"value":50,"label":"50 mL"}, {"value":100,"label":"100 mL"}, {"value":150,"label":"150 mL"} ],
        "default": 50 },
      { "key": "waterTempC", "label": "물의 온도", "type": "choice", "unit": "°C",
        "options": [ {"value":10,"label":"10 °C"}, {"value":20,"label":"20 °C"},
                     {"value":40,"label":"40 °C"}, {"value":60,"label":"60 °C"} ],
        "default": 20 },
      { "key": "stir", "label": "젓기", "type": "choice",
        "options": [ {"value":0,"label":"젓지 않음"}, {"value":1,"label":"천천히"}, {"value":2,"label":"빠르게"} ],
        "default": 1 }
    ],
    "dependent": [
      { "key": "dissolvedG", "label": "녹은 양", "unit": "g" },
      { "key": "timeS", "label": "걸린 시간", "unit": "초" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": ["hot-water"],
    "limits": ["분자", "이온", "몰농도"],     // 초안, 교사 검수 필요
    "tutor": {
      "forbiddenAnswers": [
        "온도가 높을수록 더 많이 녹",
        "물의 양이 많을수록 더 많이 녹",
        "저어도 녹는 양은 같",
        "용질마다 녹는 양이 다르"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 녹는 양이 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 녹은 양이 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 녹은 양과 걸린 시간은 각각 어떻게 달라졌나요? 표에서 두 줄을 비교해 볼까요?" },
        { "when": "fair-test-stir", "text": "젓는 빠르기를 바꾸었을 때 달라진 것은 녹은 양인가요, 걸린 시간인가요? 그래프의 기울기도 살펴볼까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 결과표의 어느 숫자를 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

텍스트의 `을(를)`, `이(가)`는 튜터가 앞 낱말 받침에 맞춰 바꾼다(§6.3).

## 4. 용해 모델 (`@sci/engine-matter`)

### 4.1 용해도 표 (물 100 g당 g, 근사값, 교사 검수 대상)

| °C | 소금 | 설탕 | 백반 | 베이킹 소다 |
|---|---|---|---|---|
| 10 | 35.8 | 190 | 7.6 | 8.2 |
| 20 | 35.9 | 204 | 11.4 | 9.6 |
| 30 | 36.1 | 220 | 16.6 | 11.1 |
| 40 | 36.4 | 238 | 23.8 | 12.7 |
| 50 | 36.7 | 260 | 36.4 | 14.5 |
| 60 | 37.1 | 287 | 57.4 | 16.4 |

- `solubilityPer100g(solute, tempC)`: 표 사이는 선형 보간한다. 범위 밖이면 RangeError.
- 물 1 mL = 1 g. 용량(capacity) = solubility × waterMl / 100.

### 4.2 시뮬레이션 `simulateDissolution(params, opts?)`

- 입력: `{ solute, waterMl, waterTempC, stir: 0|1|2 }`, `opts = { spoonGrams = 2, dt = 0.1, sampleEvery = 1, maxTimeS = 20000 }`.
- 녹는 속도 r (g/s) = `base[stir] × (1 + (T − 20) / 40)`, `base = [0.05, 0.2, 0.5]`. 젓기는 **속도만** 바꾸고 녹을 수 있는 최대량은 바꾸지 않는다.
- 절차(교실 실험을 흉내 낸다):
  1. t=0에 한 숟가락(spoonGrams)을 넣는다.
  2. 매 dt마다 `dissolved += min(r·dt, undissolved, capacity − dissolved)`.
  3. 넣은 숟가락이 다 녹으면(undissolved = 0) 그 즉시 다음 숟가락을 넣는다.
  4. `dissolved`가 capacity에 도달하고 바닥에 녹지 않은 것이 남으면 끝난다. maxTimeS를 넘어도 끝낸다(`truncated: true`).
- 출력:
  - `samples`: `sampleEvery`초 간격 + 마지막 시점. 각 샘플은 `{ t, addedG, dissolvedG, undissolvedG }`.
  - `result`: `{ dissolvedG, spoonsFullyDissolved, timeS, saturated, truncated }`. dissolvedG는 소수 첫째 자리로 반올림한다. spoonsFullyDissolved = floor(dissolvedG / spoonGrams). timeS는 포화에 도달한 시각.
- 순수 함수, 난수 없음. 같은 입력이면 같은 출력.

### 4.3 반드시 통과할 테스트

- 백반: 온도가 오를수록 dissolvedG가 늘어난다(10→60 °C 단조 증가).
- 소금: 10 °C와 60 °C의 차이가 5% 이내다.
- 물의 양 2배 → dissolvedG가 약 2배다(오차는 숟가락 1개 이내).
- stir 0/1/2: dissolvedG는 같고(숟가락 1개 이내), timeS는 stir가 클수록 짧다.
- 어떤 샘플에서도 `addedG = dissolvedG + undissolvedG`(질량 보존, 오차 1e-6)이고, dissolvedG ≤ capacity다.

## 5. 런타임 (`@sci/runtime`)

UI 프레임워크에 의존하지 않는 상태 저장소. `subscribe/getSnapshot`을 제공해 React가 `useSyncExternalStore`로 쓴다.

- 상태: `values`(변인 값), `ivKey`(조작변인, null 가능), `prediction`('increase'|'decrease'|'same'|null), `trials[]`, `active`(재생 중인 시행 id), `playhead`(초).
- `Trial`: `{ id, index, values, ivKey, prediction, samples, result, analysis }`. analysis는 gateway의 `analyzeTrial` 결과다.
- 동작: `setValue`, `setIV`, `setPrediction`, `run(simulateFn, analyzeFn)`, `setPlayhead(t)`, `tick(realDtMs)`, `reset()`.
- 재생: 시행의 전체 sim 시간을 **실제 8초**에 매핑한다. `tick`은 playhead를 진행시키고 끝에 도달하면 멈춘다. 시계는 주입받는다(테스트에서 가짜 시계 사용).
- `sampleAt(trial, t)`: 샘플 사이를 선형 보간한 스냅샷을 돌려준다. 모든 화면과 센서는 이 값만 읽는다. 이것이 다중 표상 동기화의 단일 진실 공급원이다.
- 실행 후 prediction은 null로 초기화한다(다음 시행에 새 예측을 요구).

## 6. 게이트웨이·튜터

### 6.1 `@sci/gateway`

- `canRun(state, gatewayConfig) → { ok: boolean, reasons: string[] }`. 이유 문구(한국어):
  - "예측을 먼저 골라 주세요."
  - "바꿀 조건(조작변인)을 하나 골라 주세요."
- `analyzeTrial(prev: Trial | undefined, current: {values, ivKey}, variableLabels) →`
  - prev 없음 → `{ kind: 'first-trial', changed: [] }`
  - 바뀐 변인 없음 → `{ kind: 'repeat', changed: [] }`
  - 바뀐 변인이 정확히 [ivKey] → `{ kind: 'fair-test', changed: [ivKey] }`
  - 바뀐 변인이 있고 ivKey가 null이 아니며 바뀐 변인에 ivKey가 없음 → `{ kind: 'iv-unchanged', changed: [...] }` (고른 조작변인은 그대로인데 다른 변인이 바뀜)
  - 그 밖(ivKey를 포함해 다른 변인도 바뀜, 또는 ivKey가 null인데 바뀜) → `{ kind: 'confounded', changed: [...] }`
  - 비교 기준은 **바로 앞 시행**이다.
- `structuralFeedback(analysis, labels, ivKey?) → string | null`. confounded와 iv-unchanged일 때만 문장을 만든다. iv-unchanged 예: "바꿀 조건으로 고른 물의 온도는 그대로이고, 젓기가 바뀌었어요." confounded: 예: "물의 온도와 물의 양이 함께 바뀌어서, 녹은 양이 무엇 때문에 달라졌는지 알 수 없어요." 낱말 목록은 조사를 맞춰 잇는다(받침 있으면 "과", 없으면 "와", 마지막 낱말 뒤 주격 조사 "이/가").
- `josa(word, pair)`: '을/를', '이/가', '와/과', '은/는'. 마지막 글자가 한글이 아니면 괄호형(예: "을(를)")을 돌려준다.

### 6.2 예측 비교

- fair-test에서 dissolvedG 차이가 숟가락 1개 이하면 'same', 늘면 'increase', 줄면 'decrease'로 본다.
- 실험 사이클이 끝난 뒤에만 비교한다. UI는 "예측: 늘어난다 / 결과: 변하지 않았다"처럼 중립적으로 보여주고, 맞음·틀림을 표시하지 않는다.

### 6.3 `@sci/tutor` (규칙 기반)

- `selectProbe(context, probes, guard) → string`. 우선순위:
  1. 실행 전 → `before-run`
  2. 마지막 시행이 confounded → `confounded`
  3. iv-unchanged → `iv-unchanged`
  4. repeat → `repeat`
  5. fair-test이고 예측과 결과가 다름 → `prediction-mismatch`
  6. fair-test이고 ivKey가 `stir` → `fair-test-stir`
  7. fair-test → `fair-test`
  8. first-trial → `first-trial`
  - 고른 키의 probe가 매니페스트에 없으면 고정 문구(FALLBACK_PROBE)를 돌려준다. `guard`는 필수 인자다.
- `{iv}`, `{changed}`를 라벨로 치환하고 `을(를)`·`이(가)`를 앞 낱말 받침에 맞게 바꾼다.
- `guardOutput(text, { forbiddenAnswers, limits }) → { ok, hits }`. 공백을 무시한 부분 문자열로 비교한다. selectProbe 결과가 가드에 걸리면 고정 문구 "지금까지의 결과표를 다시 살펴볼까요? 무엇이 달라졌나요?"로 바꾼다.
- 테스트: 매니페스트의 모든 probe를 모든 변인 조합으로 치환해도 guardOutput이 ok여야 한다.

## 7. 센서 (`@sci/sensors`)

- 인터페이스:
  ```ts
  interface SensorDriver {
    id: string; kind: 'temperature' | 'scale'; unit: string;
    connect(): Promise<void>; disconnect(): Promise<void>;
    read(): SensorReading;                     // { value, unit, ts }
    subscribe(cb: (r: SensorReading) => void): () => void;
  }
  ```
- `MockTemperatureDriver(source: () => number, seed)`: 값 = source() + 시드 고정 잡음(±0.2 °C), 소수 첫째 자리.
- `MockScaleDriver(source: () => number, seed)`: 비커 100 g + 물(waterMl g) + 넣은 용질(addedG). 잡음 ±0.01 g, 소수 둘째 자리. **용질이 녹는 동안 저울 값은 변하지 않는다**(용해 전후 무게 보존). 테스트로 확인한다.
- 시드 고정 의사난수(mulberry32 등)를 쓴다.

## 8. xAPI (`@sci/xapi`)

- `buildStatement({ actorId, verb, objectId, result? })`: xAPI 1.0.3 형태. actor는 `account: { homePage: 'https://sci-bridge.local', name: actorId }`(가명 ID). verb id는 `https://sci-bridge.local/verbs/{verb}`.
- `MemoryRecorder`: `record(stmt)`, `flush()`. 앱은 `controlled-variable`, `predicted`, `experimented` 세 가지를 기록하고 `console.debug`로 출력한다.

## 9. 학생 앱 (`apps/student`)

- 화면 구성(가로 태블릿 1280×800 기준, 세로·좁은 화면에서는 세로로 쌓기):
  - **상단**: 단원명, 탐구 질문.
  - **왼쪽 패널 "실험 설계"**:
    - 변인마다 선택 버튼 묶음과 "바꿀 조건" 라디오를 둔다. 조작변인이 아닌 변인 옆에는 "같게 할 조건" 표시를 붙인다.
    - 예측 버튼 3개를 둔다.
    - 실행 버튼을 두고, 꺼져 있으면 아래에 이유를 보여준다.
    - 재생 중에는 입력을 잠근다.
  - **가운데 3분할**:
    - 거시(SVG 비커): 물 높이와 색 농도는 녹은 양, 바닥 더미는 undissolvedG를 반영한다. 숟가락이 들어갈 때 표시가 난다.
    - 미시(Canvas 2D 알갱이): 물 알갱이 사이에 용질 알갱이가 퍼진다. 녹은 알갱이는 흩어지고, 녹지 않은 알갱이는 바닥에 뭉친다. 알갱이 수는 dissolvedG·undissolvedG에 비례하고 상한을 둔다. 제목은 "알갱이로 보기"이고 "분자"라는 낱말은 쓰지 않는다.
    - 기호(SVG 그래프): x축 시간(초), y축 녹은 양(g). 현재 시행 선과 이전 시행 선(흐리게)을 겹쳐 그린다. 플레이헤드 세로선을 두고, 클릭·드래그로 플레이헤드를 옮긴다.
  - **센서 바**: 가상 온도계(°C), 전자저울(g). "모의 센서" 배지를 붙인다.
  - **하단**:
    - 결과표: 시행 번호, 네 변인, 녹은 양, 숟가락 수, 걸린 시간, 예측·결과. 바뀐 변인 칸을 강조한다.
    - 피드백 상자(구조적 피드백).
    - 튜터 상자(탐침 질문).
- 60 °C를 고르면 "뜨거운 물 주의" 안내를 띄운다.
- 접근성:
  - 버튼 최소 44×44 px.
  - 색 외에 아이콘이나 글자로도 상태를 구분한다.
  - 피드백과 튜터 상자는 `aria-live="polite"`로 둔다.
  - 그래프에는 텍스트 대안(결과표)이 있으니 `aria-describedby`로 연결한다.
- 매니페스트는 JSON import 후 `@sci/schema`로 검증한다. 검증에 실패하면 오류 화면을 보여준다.
- 애니메이션은 `requestAnimationFrame`으로 `runtime.tick`을 호출한다.
- `prefers-reduced-motion`이면 미시 화면 움직임을 줄인다.

## 10. 검증

- `pnpm install && pnpm typecheck && pnpm test && pnpm build`가 모두 성공한다.
- 테스트 범위: 4.3의 모든 항목, gateway(analyzeTrial 4종, canRun, josa, structuralFeedback 문장), runtime(재생 8초 매핑, sampleAt 보간, 실행 후 예측 초기화), tutor(우선순위, 치환, 가드 전수 검사), sensors(저울 보존, 시드 재현성), schema(매니페스트 검증 통과 + 잘못된 매니페스트 거부).
- README에 실행 방법을 적는다.
