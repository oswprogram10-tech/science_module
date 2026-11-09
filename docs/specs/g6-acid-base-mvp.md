# 구현 사양: 6학년 「산과 염기」 최소 실험 (v0) — 분류 활동 + 색 판독 + 안전 감시

> 앞 사양: `g5-solution-mvp.md`, `g4-gases-mvp.md`. 다단원 구조(실험 모듈, 단원 목록, 해시 라우팅) 위에 올린다.
> 이 단원은 "조작변인 하나를 바꿔 수치 비교"가 아니라 **여러 용액을 지시약으로 시험해 산성·염기성으로 분류하는 활동**이다. 그래서 새 활동 유형 `classification`을 추가한다.

## 0. 범위와 결정

| 항목 | 이번에 하는 것 | 이번에 하지 않는 것 (이유) |
|---|---|---|
| 지시약 실험 | 가상 용액 8종 × 지시약 4종 시험, 예측 → 시험 → 분류 → 확인 | 섞기(산성+염기성) 실험: 다음 버전 |
| 색 판독(비전) | 카메라 또는 사진 파일에서 가운데 영역 평균색 → CIELAB 색차로 지시약 색표와 매칭. 기기 안에서만 처리 | 실제 지시약 사진으로 정확도 검증: 현장 데이터가 필요 |
| 안전 감시 | 위험 용액 시험 전 안전 점검표(게이트), 안전 이벤트 파이프라인(감지기 인터페이스 → 경고 배너 + 음성 + xAPI), **모의 감지기** | 보안경 실제 감지 모델(YOLO 등): 학습 데이터·모델 필요, 0단계 스파이크 S2 이후 |
| 교사 알림 | xAPI `safety-alert` 기록까지 | 교사 대시보드 전송: 대시보드가 아직 없음 |

## 1. 스키마: 활동 유형 분리 (`@sci/schema`)

- 실험 스키마를 `module` 기준 **discriminated union**으로 바꾼다.
  - 공통 필드: `id`, `module`, `title`, `question`, `limits`, `safety`, `safetyNotices?`, `tutor`, `params?`
  - 변인 실험(`dissolution`, `gas-syringe`): 지금 필드(`variables`, `dependent`, `gateway`, `predictionPrompt`, `spoonGrams?`)를 그대로 필수/선택으로 둔다.
  - 분류 활동(`indicator-classify`): 아래 §2 필드
- `export type VariableExperiment`, `ClassificationExperiment`, `Experiment = VariableExperiment | ClassificationExperiment`, 그리고 타입 가드 `isVariableExperiment`를 둔다.
- 기존 두 매니페스트와 테스트는 그대로 통과해야 한다.
- probe `when`은 활동 유형별로 다르다. 분류 활동의 when 값: `before-test`, `testing`, `check-inconsistent`, `check-untested`, `check-complete`, `prediction-mismatch`.

## 2. 매니페스트 (`content/units/g6-acid-base/manifest.json`)

```jsonc
{
  "id": "g6-acid-base",
  "title": "산과 염기",
  "grade": 6,
  "standards": ["6과09-04"],     // 명세서 표기. 나머지 코드는 고시 대조 후 보완
  "engine": "matter",
  "experiments": [{
    "id": "indicator-classify",
    "module": "indicator-classify",
    "title": "지시약으로 여러 가지 용액 분류하기",
    "question": "지시약을 이용하면 여러 가지 용액을 어떻게 분류할 수 있을까?",
    "groups": [ {"key":"acid","label":"산성 용액"}, {"key":"base","label":"염기성 용액"} ],
    "solutions": [
      {"key":"hcl",       "label":"묽은 염산",              "level": 1.0,  "hazard": true},
      {"key":"lemon",     "label":"레몬즙",                 "level": 2.3},
      {"key":"vinegar",   "label":"식초",                   "level": 2.8},
      {"key":"soda",      "label":"탄산수",                 "level": 4.5},
      {"key":"soap",      "label":"빨랫비누 물",            "level": 10.0},
      {"key":"cleaner",   "label":"유리 세정제",            "level": 11.0},
      {"key":"limewater", "label":"석회수",                 "level": 12.4},
      {"key":"naoh",      "label":"묽은 수산화 나트륨 용액", "level": 13.0, "hazard": true}
    ],
    "indicators": [
      {"key":"blueLitmus", "label":"푸른색 리트머스 종이", "kind":"paper",
       "colors": [ {"max":7,"color":"red"}, {"max":99,"color":"blue"} ], "initial":"blue"},
      {"key":"redLitmus",  "label":"붉은색 리트머스 종이", "kind":"paper",
       "colors": [ {"max":7,"color":"red"}, {"max":99,"color":"blue"} ], "initial":"red"},
      {"key":"phenol",     "label":"페놀프탈레인 용액",    "kind":"drop",
       "colors": [ {"max":8.2,"color":"clear"}, {"max":99,"color":"magenta"} ], "initial":"clear"},
      {"key":"cabbage",    "label":"붉은 양배추 지시약",   "kind":"drop",
       "colors": [ {"max":2.5,"color":"cabRed"}, {"max":6,"color":"cabPink"}, {"max":8,"color":"cabPurple"},
                   {"max":10.5,"color":"cabBlue"}, {"max":12,"color":"cabGreen"}, {"max":99,"color":"cabYellow"} ],
       "initial":"cabPurple"}
    ],
    "colors": {
      "red":       {"label":"붉은색",       "hex":"#d0605e", "pattern":"diagonal"},
      "blue":      {"label":"푸른색",       "hex":"#5b7fc7", "pattern":"dots"},
      "clear":     {"label":"색 변화 없음", "hex":"#f1f1ee", "pattern":"none"},
      "magenta":   {"label":"붉은색",       "hex":"#e0479e", "pattern":"diagonal"},
      "cabRed":    {"label":"붉은색",       "hex":"#d6336c", "pattern":"diagonal"},
      "cabPink":   {"label":"연한 붉은색",  "hex":"#c86fa8", "pattern":"diagonal-sparse"},
      "cabPurple": {"label":"보라색",       "hex":"#7b4e9b", "pattern":"cross"},
      "cabBlue":   {"label":"푸른색",       "hex":"#3a8fb7", "pattern":"dots"},
      "cabGreen":  {"label":"초록색",       "hex":"#3fa36b", "pattern":"horizontal"},
      "cabYellow": {"label":"노란색",       "hex":"#c9c23a", "pattern":"vertical"}
    },
    "safety": ["goggles", "gloves", "corrosive"],
    "safetyChecklist": [
      "보안경을 썼어요.",
      "실험용 장갑을 꼈어요.",
      "용액을 맛보거나 코를 대고 냄새를 맡지 않아요."
    ],
    "safetyNotices": [],
    "limits": ["pH", "수소 이온", "수산화 이온", "이온", "분자", "중화"],   // 초안, "중화" 포함 여부는 교사 검수
    "tutor": {
      "forbiddenAnswers": [
        "산성 용액은 푸른색 리트머스 종이를 붉게",
        "염기성 용액은 붉은색 리트머스 종이를 푸르게",
        "염기성 용액에서 페놀프탈레인",
        "식초는 산성 용액", "레몬즙은 산성 용액", "석회수는 염기성 용액", "빨랫비누 물은 염기성 용액"
      ],
      "probes": [
        { "when": "before-test", "text": "{solution}은(는) 산성일까요, 염기성일까요? 왜 그렇게 생각했나요?" },
        { "when": "testing", "text": "{solution}에 지시약을 넣었을 때 색이 어떻게 변했나요? 다른 지시약으로도 확인해 볼까요?" },
        { "when": "prediction-mismatch", "text": "{solution}에 대한 예측과 관찰 결과가 달랐네요. 어느 지시약의 색 변화를 보고 생각이 바뀌었나요?" },
        { "when": "check-untested", "text": "아직 지시약으로 확인하지 않은 용액이 있어요. 무엇을 보고 분류할 수 있을까요?" },
        { "when": "check-inconsistent", "text": "{solution}의 지시약 색 변화를 결과표에서 다시 살펴볼까요? 같은 무리에 넣은 다른 용액들과 비교해 보세요." },
        { "when": "check-complete", "text": "같은 무리에 넣은 용액들은 지시약 색 변화에서 어떤 공통점이 있나요?" }
      ]
    }
  }]
}
```

- 금지 문장은 "식초는 산성"처럼 짧게 쓰지 않는다. 그렇게 쓰면 before-test 질문("식초는 산성일까요")이 가드에 걸린다. 그래서 "…용액"까지 넣는다. 전수 가드 테스트로 오검출이 없음을 확인한다.
- `level`은 내부 값이다. 화면, 튜터, xAPI 어디에도 숫자나 "pH"로 드러내지 않는다. 결과 색을 정하는 데만 쓴다.
- 색 판정: 지시약의 `colors`를 순서대로 보고 `level ≤ max`인 첫 항목의 color.
- 정답 무리: `level < 7`이면 `acid`, 아니면 `base`. 색 값과 무리 기준은 **교사 검수 대상**이다.

## 3. 분류 엔진 (`@sci/engine-matter`, `indicator.ts`)

- `indicatorColor(exp, solutionKey, indicatorKey) → colorKey`
- `truthGroup(exp, solutionKey) → 'acid' | 'base'`
- `evidenceGroup(exp, tests) → 'acid' | 'base' | null`: 그 용액에서 학생이 실제로 시험한 지시약 결과만으로 판단한다.
  - 색 → 쪽 대응: `red`·`cabRed`·`cabPink` → acid, `blue`·`magenta`·`cabBlue`·`cabGreen`·`cabYellow` → base.
  - 결정할 수 없는 색: `clear`(페놀프탈레인 무변화는 산성 또는 중성), `cabPurple`, 그리고 초기색과 같은 리트머스 결과(예: 푸른색 리트머스가 푸른색 그대로).
  - 결정 가능한 결과가 하나라도 있으면 그 쪽, 없으면 null.
- `checkClassification(exp, state) → { items: [{ solution, status: 'consistent'|'inconsistent'|'untested'|'unplaced'|'undetermined' }], kind: 'check-complete'|'check-inconsistent'|'check-untested' }`
  - untested: 시험 기록 없음
  - undetermined: 시험했지만 evidenceGroup이 null
  - inconsistent: 넣은 무리 ≠ evidenceGroup
  - unplaced: 무리에 넣지 않음
  - kind 우선순위: inconsistent가 있으면 check-inconsistent → untested·undetermined·unplaced가 있으면 check-untested → 아니면 check-complete
- `validateIndicatorExperiment(exp)`: 모든 색 키가 `colors`에 있는지, `colors` 범위가 오름차순이고 마지막이 99인지, solution·indicator 키 중복, groups가 acid/base인지 검사한다.

**테스트**
- 8×4 전 조합 색이 위 표와 일치(대표 값 고정 테스트).
- evidenceGroup: 리트머스 무변화·페놀프탈레인 무색·양배추 보라는 null, 나머지는 기대한 쪽.
- 전 용액에서 "결정 가능한 색이 하나라도 나오면" evidenceGroup == truthGroup.
- checkClassification 네 가지 status와 kind 우선순위.

## 4. 색 판독 (`packages/vision`, 새 패키지 `@sci/vision`)

- `srgbToLab(r,g,b)`, `deltaE76(lab1, lab2)`, `rgbToHsv` (표시용)
- `averageRoi(data: Uint8ClampedArray, width, height, roi = { x:0.35, y:0.35, w:0.3, h:0.3 })`: 가운데 영역의 평균 RGB. 밝기(V) 상위 5%와 하위 5% 픽셀은 반사광과 그림자로 보고 제외한다.
- `matchColor(rgb, chart: {key, hex}[]) → { best: key, deltaE, ranked: [{key, deltaE}] , confident: boolean }`. `confident = best.deltaE ≤ 20 && (second.deltaE − best.deltaE) ≥ 5`.
- `SafetyDetector` 인터페이스: `start(onEvent: (e: SafetyEvent) => void): void; stop(): void`, `SafetyEvent = { type: 'NO_GOGGLES' | 'NO_GLOVES' | 'SPILL' | 'FOOD'; confidence: number; ts: number }`
- `MockSafetyDetector`: `trigger(type)` 호출 시 이벤트를 낸다. 실제 감지 모델은 이 인터페이스를 구현해 나중에 끼운다.
- 테스트: 색표의 hex 자체를 넣으면 deltaE≈0으로 그 키, 회색(#808080)은 confident=false, averageRoi가 가장자리 픽셀을 무시함, 하이라이트 제외.

## 5. 학생 앱: 분류 활동 화면 (`apps/student/src/modules/indicator-classify/`)

App은 `isVariableExperiment`로 갈라서 변인 실험은 기존 `Lab`, 분류 활동은 새 `ClassifyLab`을 그린다. 단원 목록·머리글·피드백/튜터 상자 스타일은 공유한다.

### 5.1 상태 (순수 TS 저장소, 테스트 가능하게 `classifyStore.ts`)

`{ selected: solutionKey | null, predictions: {sol → 'acid'|'base'|'unsure'}, tests: {sol → indicatorKey[] (시험 순서)}, placement: {sol → 'acid'|'base'|null}, safetyConfirmed: boolean, checked: CheckResult | null, alerts: SafetyEvent[] }`

### 5.2 화면 구성 (1280×800 가로 기준, 좁으면 세로로 쌓기)

- **왼쪽 "용액 고르기"**
  - 용액 8개 버튼. 위험 용액에는 ⚠ 아이콘과 "주의" 글자를 붙인다.
  - 선택한 용액의 예측 버튼 3개("산성일 것 같아요", "염기성일 것 같아요", "잘 모르겠어요").
  - 예측 전에는 지시약 버튼이 꺼지고 "예측을 먼저 골라 주세요."가 보인다.
- **가운데 "실험대"**
  - 선택한 용액 시험관(SVG)과 지시약 4개 버튼.
  - 지시약을 누르면 결과가 나타난다. 리트머스는 종이 조각 색 변화, 용액형은 시험관 색 변화. 0.6초 전환 애니메이션을 쓰고, reduced-motion이면 즉시 바꾼다.
  - 결과 칸은 색 견본 + 패턴(SVG pattern) + 색 이름 글자를 함께 쓴다(색각 대응).
- **가운데 아래 "AI 색 읽기"(카메라)**
  - "카메라 켜기"를 누르면 getUserMedia(`facingMode: 'environment'`)로 미리보기와 가운데 사각형 안내를 띄운다. "이 색 읽기"를 누르면 프레임을 캔버스로 잡아 처리한다.
  - 카메라를 쓸 수 없으면 "사진 고르기"(`<input type=file accept="image/*" capture="environment">`)를 제공한다.
  - 지시약을 고른 뒤 읽으면 그 지시약의 색표로 매칭한다. 결과는 "가장 가까운 색: 연한 붉은색 (닮은 정도: 높음/보통/낮음)"으로 보여준다.
  - confident=false면 "색을 읽기 어려워요. 밝은 곳에서 흰 종이를 뒤에 대고 다시 찍어 보세요."를 보여준다.
  - 읽은 결과를 가상 시험 결과로 넣지는 않는다. 실물 실험 결과를 확인하는 보조 도구다.
  - 문구로 "사진은 이 기기 안에서만 처리하고 저장하거나 보내지 않아요."를 표시한다. 실제로도 저장하지 않는다.
  - 카메라는 화면을 벗어나거나 단원을 바꾸면 끈다(track.stop).
- **오른쪽 위 "분류하기"**
  - 무리 두 칸(산성 용액 / 염기성 용액)과 "아직 정하지 않음" 칸이 있다.
  - 탭 배치를 기본으로 한다: 용액 칩을 누르면 선택되고, 무리 칸을 누르면 그리로 옮겨진다. 드래그는 이번에 하지 않는다(UDL: tap-to-place 기본).
  - 칩에는 용액 이름만 있고 색 힌트는 없다.
  - "분류 확인하기" 버튼은 8개를 모두 배치해야 켜진다. 누르면 checkClassification 결과로 피드백을 낸다.
- **피드백 상자**
  - 확인 전: "분류를 마치고 확인하기를 누르면 여기에 알려 줄게요."
  - inconsistent: "{용액 목록}은(는) 관찰한 지시약 색 변화와 넣은 무리를 다시 비교해 볼까요?"
  - untested·undetermined: "{용액 목록}은(는) 아직 분류할 단서가 부족해요. 다른 지시약으로도 시험해 볼까요?"
  - complete: "관찰한 지시약 색 변화와 분류가 서로 잘 맞아요."
  - "틀렸습니다" 같은 판정 문구와 정답 무리 공개는 하지 않는다. 조사는 josa로 맞춘다.
- **튜터 상자**: 상황 키(§1의 when)로 probe를 고르고 `{solution}`을 치환한다. 가드는 같은 방식(guardOutput)으로 건다. `@sci/tutor`에 활동 유형과 무관한 `renderAndGuard(when, vars, probes, guard)`를 추가해 공유한다.
  - 선택 규칙(위에서부터):
    1. 확인 결과가 있으면 그 kind
    2. 선택한 용액이 아직 시험 전이면 before-test
    3. 선택한 용액의 예측이 acid·base이고 evidenceGroup과 다르면 prediction-mismatch
    4. 그 밖은 testing
- **결과표**
  - 행: 용액. 열: 예측, 지시약 4종 결과(색 이름 + 작은 견본), 넣은 무리.
  - 시험하지 않은 칸은 "–"로 둔다.

### 5.3 안전

- **안전 점검표 게이트**
  - 위험 용액(`hazard: true`)을 처음 시험하려 하면 모달 대화상자를 띄운다(`role="dialog"`, `aria-modal`, 포커스 가두기, Esc로 닫기).
  - 대화상자에 safetyChecklist 체크박스 3개가 있고, 모두 체크해야 "확인했어요"가 켜진다. 확인하면 이번 세션 동안 유지한다.
  - 위험 용액을 선택하면 실험대 위에 "⚠ 이 용액은 피부나 눈에 닿으면 위험해요. 보안경과 장갑을 꼭 착용해요." 안내가 보인다.
- **안전 경고 배너**
  - SafetyDetector 이벤트를 받으면 화면 맨 위에 붉은 배너(`role="alert"`)를 띄운다.
  - NO_GOGGLES 문구: "산성 용액 실험 전 보안경을 먼저 착용해 주세요!" 나머지 유형도 한 문장씩 정한다.
  - 배너가 떠 있는 동안 지시약 버튼을 잠근다. 학생이 "착용했어요"를 누르면 닫힌다.
  - `speechSynthesis`가 있으면 같은 문장을 ko-KR로 읽는다(try/catch).
  - xAPI `safety-alert`를 기록한다.
- **모의 감지기**
  - URL에 `?dev=1`이 있을 때만 화면 아래에 "개발용: 모의 안전 상황" 패널을 띄운다. 버튼 4개가 MockSafetyDetector.trigger를 호출한다.
  - 일반 학생 화면에는 보이지 않는다.

### 5.4 xAPI

`predicted`(solution, prediction), `tested`(solution, indicator, color), `classified`(placement 전체), `checked`(kind, 상태별 개수), `color-read`(indicator, best, deltaE, confident, source: camera|file), `safety-confirmed`, `safety-alert`(type). 확장 키는 기존 `toExtensions`를 쓴다. level 값은 넣지 않는다.

## 6. 검증

- `pnpm typecheck && pnpm test && pnpm build` 통과. 기존 121개 테스트 기대값은 그대로 둔다.
- 새 테스트:
  - §3, §4 전부
  - classifyStore 동작(예측 전 시험 불가, 위험 용액 점검 전 시험 불가, 배너 중 시험 불가, 배치·확인)
  - 스키마 union(세 매니페스트 통과, 잘못된 module 거부)
  - 튜터 전수 가드 검사(모든 probe × 모든 용액 이름)
  - 단원 레지스트리에 세 단원
- README와 `docs/DEVELOPMENT_PLAN.md` §7.1 표에 "산과 염기: 보안경 실제 감지는 모의 감지기로 대체, 모델은 스파이크 S2 이후"를 한 줄 추가한다.
