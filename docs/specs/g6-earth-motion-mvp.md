# 구현 사양: 6학년 「지구의 운동」 최소 실험 (v0) — 관찰 과제 유형 + 시점 동기화

> 앞 사양: `g4-gases-mvp.md`(다단원 구조), `g6-acid-base-mvp.md`(두 번째 활동 유형 `classification`의 구조: 스키마 union, 별도 Lab, 순수 저장소, 관찰 근거 기반 확인), `g4-land-mvp.md`(`@sci/engine-earth`), `docs/testing.md`.
> **세 번째 활동 유형 `observation`(관찰 과제)**을 추가한다. 명세서의 "1인칭 지상 관측 ↔ 3인칭 우주 궤도 시점 동기화 천체 시뮬레이터"를 2D(SVG)로 먼저 구현한다. 3D(Three.js)는 다음 버전이다.

## 1. 활동 흐름 (관찰 과제)

단원은 과제 여러 개로 이루어진다. 과제마다 같은 순서를 따른다.

1. **예측**: 질문에 선택지로 답한다.
2. **관찰**: 예측을 골라야 관찰 화면 조작이 켜진다. 시각 또는 달 슬라이더와 조건 토글을 움직이며 두 시점 화면을 본다.
3. **관찰 기록**: 같은 선택지에서 "내가 관찰한 것"을 고른다.
4. **비교**
   - 예측과 관찰 기록을 나란히 보여준다(맞음·틀림 표시 없음).
   - 관찰 기록이 모델 결과와 다르면 "관찰 화면을 다시 살펴볼까요?" 구조적 피드백을 낸다. 산과 염기의 "관찰과 분류가 맞는지"와 같은 원칙이다.
   - 과제별 탐침 질문을 보여준다.
5. 다음 과제로 넘어간다. 과제 목록에서 완료 표시(✓ + 글자)를 단다. 순서는 자유다.

정답 판정 문구("틀렸어요")와 정답 공개는 하지 않는다. 관찰 기록이 모델과 맞을 때만 "관찰한 내용을 잘 기록했어요."라고 쓴다.

## 2. 스키마 (`@sci/schema`)

discriminated union에 `module: "sky-observation"`인 **관찰 활동** 실험을 추가한다. 타입 `ObservationExperiment`와 가드 `isObservationExperiment`를 둔다.

- 공통 필드는 그대로다(`id`, `module`, `title`, `question`, `limits`, `safety`, `tutor`, `params?`).
- `tasks`: 다음 필드를 가진 배열.
  - `id`, `title`, `question`
  - `options`: `{value,label}[]`, 2~5개
  - `view`: `'rotation' | 'revolution'`
  - `controls`: 선택. `{ key, label, options:{value,label}[], default }[]`. 관찰 중 바꿀 수 있는 조건이다(예: 자전 방향).
  - `answer`: 모델 결과를 계산하는 규칙 이름. 아래 열거형 중 하나.
    - `'sun-path-direction'`
    - `'antipode-day-night'`
    - `'star-path-direction'`
    - `'constellation-changes'`
    - `'winter-constellation'`
  - `probes`: `{ when: 'before-observe'|'observing'|'record-mismatch'|'record-match'|'prediction-mismatch', text }[]`
- 기존 세 활동 유형의 매니페스트와 테스트는 그대로 통과해야 한다.

## 3. 천체 모델 (`@sci/engine-earth`, `astro.ts`)

근사 모델이며 **교사 검수 대상**이다. 관측 위치는 서울(위도 37.5°N)이다.

### 3.1 계산 함수

- `sunDeclination(dayOfYear) = 23.44°·sin(2π(day − 80)/365.25)`
- `sunPosition({ hour, dayOfYear, latDeg = 37.5, rotation = 'forward'|'reverse' }) → { altDeg, azDeg }`
  - 시간각 `H = 15°·(hour − 12)`. reverse면 H의 부호를 뒤집는다(지구가 반대로 도는 가상 상황).
  - `alt = asin(sinφ·sinδ + cosφ·cosδ·cosH)`
  - `az = atan2(−cosδ·sinH, sinδ·cosφ − cosδ·sinφ·cosH)`를 0~360으로 맞춘다. 북 0, 동 90, 남 180, 서 270.
- `starPosition({ raHours, decDeg, hour, dayOfYear, latDeg, rotation })`: 같은 식에 별의 시간각을 넣는다.
  - `H = LST − RA`, `LST = (raSun(day) + (hour − 12)) mod 24`(시간 단위, ×15°)
  - reverse면 부호를 뒤집는다.
- `raSun(dayOfYear) = ((day − 80)/365.25 × 24) mod 24`
- `isDaylight({ hour, lonOffsetDeg })`: 관측자에서 경도로 lonOffsetDeg만큼 떨어진 곳의 지방시가 6~18시면 낮. 지구 반대편은 lonOffsetDeg = 180이다.
- `southConstellationAt9pm(dayOfYear) → key`
  - 오후 9시 남쪽 하늘 자오선의 RA = raSun + 9h
  - 표에서 RA가 가장 가까운 별자리를 고른다(24h 순환 거리).
  - 표: `{ leo: 10.5, cygnus: 20.7, pegasus: 23.0, orion: 5.6 }`
  - 별자리 이름: 사자자리, 백조자리, 페가수스자리, 오리온자리
- 별자리 모양: 각 별자리의 주요 별 4~7개를 (RA, Dec) 근사값으로 둔다. 화면용이고 정밀할 필요는 없다.

### 3.2 과제 정답 규칙 (`answerFor(rule, controls) → optionValue`)

| 규칙 | 결과 |
|---|---|
| `sun-path-direction` | forward면 `'east-to-west'`, reverse면 `'west-to-east'`. 오전 9시와 오후 3시 방위각 증감으로 계산한다. 하드코딩하지 않는다. |
| `star-path-direction` | 같은 방식으로 오후 9시와 자정의 오리온자리(겨울) 또는 그날 남쪽 별자리 방위각 증감으로 계산한다. |
| `antipode-day-night` | 관측자가 낮(12시)일 때 반대편은 `'night'` |
| `constellation-changes` | 1·4·8·10월의 southConstellationAt9pm 결과가 모두 같으면 `'same'`, 아니면 `'changes'` |
| `winter-constellation` | 1월 15일의 결과(`'orion'`) |

### 3.3 반드시 통과할 테스트

- 춘분(80일) 정오 고도 52.5°(±0.1), 하지(172일) 75.9°, 동지(355일) 29.1°
- 춘분 7·9·12·15·17시의 방위각: 99.3, 121.3, 180.0, 238.7, 260.7(±0.1). 오전에는 동쪽(< 180), 오후에는 서쪽(> 180).
- reverse이면 같은 시각의 방위각이 360 − az(남북 대칭)가 되고, 방위각 증감 방향이 뒤집힌다.
- isDaylight: 서울 12시가 낮이면 반대편은 밤이다(그 반대도).
- southConstellationAt9pm: 1월 15일 orion, 4월 15일 leo, 8월 16일 cygnus, 10월 15일 pegasus.
- 다섯 가지 answer 규칙의 결과를 controls 조합별로 고정한다.

## 4. 매니페스트 (`content/units/g6-earth-motion/manifest.json`)

```jsonc
{
  "id": "g6-earth-motion",
  "title": "지구의 운동",
  "grade": 6,
  "standards": ["6과12-01"],     // 명세서 단원 번호 체계에서 추정. 고시 대조 필요
  "engine": "earth",
  "experiments": [{
    "id": "sky-observation",
    "module": "sky-observation",
    "title": "땅에서 보기와 우주에서 보기를 비교하며 관찰하기",
    "question": "지구가 움직이면 땅에서 보는 하늘은 어떻게 달라질까?",
    "safety": [],
    "limits": ["적경", "적위", "황도", "천구", "시간각", "방위각"],
    "params": { "latDeg": 37.5 },
    "tasks": [
      { "id": "sun-path", "title": "하루 동안 태양의 움직임", "view": "rotation",
        "question": "지구가 서쪽에서 동쪽으로 자전할 때, 땅에서 보면 태양은 어느 쪽에서 어느 쪽으로 움직여 보일까?",
        "options": [ {"value":"east-to-west","label":"동쪽에서 서쪽으로"}, {"value":"west-to-east","label":"서쪽에서 동쪽으로"}, {"value":"still","label":"움직이지 않아요"} ],
        "controls": [ { "key":"rotation", "label":"지구의 자전 방향",
          "options": [ {"value":"forward","label":"서쪽에서 동쪽으로 (실제)"}, {"value":"reverse","label":"동쪽에서 서쪽으로 (만약에)"} ], "default":"forward" } ],
        "answer": "sun-path-direction",
        "probes": [
          { "when": "before-observe", "text": "아침에 해가 뜨는 쪽을 떠올려 볼까요? 그 생각을 예측에 이용해 보세요." },
          { "when": "observing", "text": "시각을 바꾸면서 우주에서 보기 화면의 한국 표시와 땅에서 보기 화면의 태양을 함께 살펴볼까요?" },
          { "when": "record-mismatch", "text": "땅에서 보기 화면에서 아침과 저녁의 태양 위치를 다시 비교해 볼까요? 방향 글자도 확인해 보세요." },
          { "when": "record-match", "text": "자전 방향을 '만약에'로 바꾸면 땅에서 보이는 태양의 움직임은 어떻게 될까요? 바꿔서 확인해 볼까요?" },
          { "when": "prediction-mismatch", "text": "예측과 관찰이 달랐네요. 우주에서 보기 화면의 어떤 움직임이 그 차이를 만들었을까요?" }
        ] },
      { "id": "day-night", "title": "낮과 밤", "view": "rotation",
        "question": "우리나라가 낮 12시일 때, 지구 반대편에 있는 곳은 낮일까, 밤일까?",
        "options": [ {"value":"day","label":"낮이에요"}, {"value":"night","label":"밤이에요"} ],
        "answer": "antipode-day-night",
        "probes": [
          { "when": "before-observe", "text": "태양 빛이 지구의 어느 쪽을 비추는지 생각해 볼까요?" },
          { "when": "observing", "text": "우주에서 보기 화면에서 빛을 받는 쪽과 받지 못하는 쪽을 찾아볼까요? 반대편 표시는 어느 쪽에 있나요?" },
          { "when": "record-mismatch", "text": "우주에서 보기 화면에서 반대편 표시가 밝은 쪽과 어두운 쪽 중 어디에 있는지 다시 살펴볼까요?" },
          { "when": "record-match", "text": "시각을 계속 바꾸면 우리나라와 반대편의 낮과 밤은 어떻게 바뀌나요?" },
          { "when": "prediction-mismatch", "text": "예측과 관찰이 달랐네요. 태양 빛이 닿는 범위를 다시 생각해 볼까요?" }
        ] },
      { "id": "star-path", "title": "밤하늘 별의 움직임", "view": "rotation",
        "question": "밤 동안 남쪽 하늘의 별들은 어느 쪽에서 어느 쪽으로 움직여 보일까?",
        "options": [ {"value":"east-to-west","label":"동쪽에서 서쪽으로"}, {"value":"west-to-east","label":"서쪽에서 동쪽으로"}, {"value":"still","label":"움직이지 않아요"} ],
        "controls": [ { "key":"rotation", "label":"지구의 자전 방향",
          "options": [ {"value":"forward","label":"서쪽에서 동쪽으로 (실제)"}, {"value":"reverse","label":"동쪽에서 서쪽으로 (만약에)"} ], "default":"forward" } ],
        "answer": "star-path-direction",
        "probes": [
          { "when": "before-observe", "text": "낮에 태양이 움직여 보인 모습과 비교해서 예측해 볼까요?" },
          { "when": "observing", "text": "밤 시각으로 바꾸고 별자리가 시간에 따라 어디로 가는지 따라가 볼까요?" },
          { "when": "record-mismatch", "text": "밤 9시와 자정의 별자리 위치를 땅에서 보기 화면에서 다시 비교해 볼까요?" },
          { "when": "record-match", "text": "태양과 별이 움직여 보이는 방향을 비교하면 어떤 공통점이 있나요? 그 까닭은 무엇일까요?" },
          { "when": "prediction-mismatch", "text": "예측과 관찰이 달랐네요. 우주에서 보기 화면의 지구가 도는 방향을 다시 살펴볼까요?" }
        ] },
      { "id": "season-stars", "title": "계절에 따라 보이는 별자리", "view": "revolution",
        "question": "지구가 태양 둘레를 돌면, 계절마다 밤 9시 남쪽 하늘에 보이는 별자리는 어떻게 될까?",
        "options": [ {"value":"same","label":"계절이 바뀌어도 같아요"}, {"value":"changes","label":"계절마다 달라져요"} ],
        "answer": "constellation-changes",
        "probes": [
          { "when": "before-observe", "text": "밤에 우리가 바라보는 하늘은 태양이 있는 쪽일까요, 반대쪽일까요?" },
          { "when": "observing", "text": "달을 바꾸면서 우주에서 보기 화면의 지구 위치와 밤하늘 쪽을 함께 살펴볼까요?" },
          { "when": "record-mismatch", "text": "1월, 4월, 8월, 10월로 바꾸어 가며 땅에서 보기 화면의 별자리 이름을 다시 비교해 볼까요?" },
          { "when": "record-match", "text": "지구가 공전하는 동안 밤하늘이 향하는 쪽은 어떻게 바뀌나요?" },
          { "when": "prediction-mismatch", "text": "예측과 관찰이 달랐네요. 지구의 위치가 바뀌면 밤에 바라보는 쪽도 바뀌는지 살펴볼까요?" }
        ] },
      { "id": "winter-stars", "title": "겨울철 대표 별자리", "view": "revolution",
        "question": "1월 밤 9시 남쪽 하늘에서 볼 수 있는 대표 별자리는 무엇일까?",
        "options": [ {"value":"leo","label":"사자자리"}, {"value":"cygnus","label":"백조자리"}, {"value":"pegasus","label":"페가수스자리"}, {"value":"orion","label":"오리온자리"} ],
        "answer": "winter-constellation",
        "probes": [
          { "when": "before-observe", "text": "겨울밤 하늘에서 본 적 있는 별자리를 떠올려 볼까요?" },
          { "when": "observing", "text": "달을 1월로 맞추고 땅에서 보기 화면의 남쪽 하늘을 살펴볼까요?" },
          { "when": "record-mismatch", "text": "달이 1월로 맞춰져 있는지, 시각이 밤 9시인지 다시 확인해 볼까요?" },
          { "when": "record-match", "text": "다른 계절에는 어떤 별자리가 그 자리에 보이는지 달을 바꿔서 찾아볼까요?" },
          { "when": "prediction-mismatch", "text": "예측과 관찰이 달랐네요. 별자리 모양을 땅에서 보기 화면과 비교해 볼까요?" }
        ] }
    ],
    "tutor": {
      "forbiddenAnswers": [
        "동쪽에서 서쪽으로 움직여 보여",
        "지구가 자전하기 때문",
        "지구가 공전하기 때문",
        "계절마다 별자리가 달라",
        "반대편은 밤",
        "겨울철 대표 별자리는 오리온"
      ],
      "probes": []
    }
  }]
}
```

- 튜터 가드는 과제 probe 전체에 건다(`forbiddenAnswers`·`limits`). 전수 검사 테스트를 둔다.
- 선택지 라벨은 가드 대상이 아니다. 선택지에 "동쪽에서 서쪽으로"가 있는 것은 정상이다.

## 5. 화면 (`apps/student/src/modules/sky-observation/`)

활동 화면 `ObserveLab`. 레이아웃은 왼쪽 과제 목록, 가운데 두 시점 화면, 오른쪽 예측·관찰 기록·피드백·튜터 칸이다. 좁은 화면에서는 세로로 쌓는다.

### 5.1 조작

- **rotation 과제**: "시각" 슬라이더(0~24시, 0.5시 단위, 키보드 조작 가능, aria-valuetext "오전 9시"처럼), 재생 버튼(하루를 8초에), 과제 controls의 토글.
  - 날짜는 춘분 고정이고 `params.dayOfYear`로 바꿀 수 있다.
  - 별 과제에서는 날짜를 1월 15일로 두고 시각 기본값을 21시로 한다.
- **revolution 과제**: "달" 슬라이더(1~12월, 각 달 15일). 시각은 21시 고정이고 화면에 "밤 9시"로 표시한다.
- 예측을 고르기 전에는 조작이 꺼지고 "예측을 먼저 골라 주세요."가 보인다.

### 5.2 "우주에서 보기"(3인칭, SVG)

- **rotation**
  - 왼쪽에 태양, 오른쪽에 지구를 북극 위에서 본 원으로 그린다.
  - 태양 쪽 반은 밝게, 반대쪽은 어둡게 칠하고 "낮"·"밤" 글자를 넣는다.
  - 서울 표시(●와 "우리나라")는 시각에 따라 원 둘레를 돈다. 자전 방향 화살표는 controls에 따라 방향이 바뀐다.
  - 낮과 밤 과제에서는 반대편 표시(■와 "지구 반대편")도 둔다.
- **revolution**
  - 가운데 태양, 둘레에 공전 궤도와 달 라벨(1·4·7·10월)을 둔다. 지구는 선택한 달 위치에 있다.
  - 지구에서 태양 반대쪽으로 "밤하늘 쪽" 화살표를 긋는다.
  - 궤도 바깥 네 방향에 대표 별자리 이름을 둔다. 배치는 southConstellationAt9pm과 맞게 한다.

### 5.3 "땅에서 보기"(1인칭, SVG)

- 지평선 파노라마: 가로는 방위 동(90°)·남(180°)·서(270°)이고 양 끝에 "동"·"서", 가운데 "남" 글자를 둔다. 세로는 고도 0~90°다. 아래는 땅 실루엣이다.
- 낮(태양 고도 > 0)이면 하늘이 밝은 파랑이고 태양 아이콘이 위치에 있다. 지금까지의 태양 위치는 점선으로 남긴다(과제를 바꾸면 지운다).
- 밤이면 하늘이 어둡다. 별 과제·계절 과제에서는 별자리 별을 점과 선으로 그리고 이름 글자를 붙인다. 지평선 아래 별은 그리지 않는다.
- 화면 아래 문구:
  - 낮: `"{시각} · 태양 높이 {altDeg}°"` 대신 학년에 맞춰 `"{시각} · 태양이 {동쪽/남쪽/서쪽} 하늘에 있어요"`
  - 밤: `"{시각} · 남쪽 하늘: {가장 가까운 별자리 이름}"`

### 5.4 기록·피드백

- 관찰 기록 버튼(과제 options와 같음)은 관찰 조작을 한 번 이상 해야 켜진다(슬라이더 이동 또는 토글).
- 비교 칸: `예측: {라벨} / 관찰: {라벨}`.
- 피드백은 앞 절의 원칙을 따른다. 관찰 기록과 모델 결과를 비교할 때 controls의 현재 값을 쓴다. 예: 자전 방향을 "만약에"로 둔 채 기록하면 그 조건의 결과와 비교한다.
- 튜터 칸 선택 규칙:
  1. 예측 전: before-observe
  2. 기록 전: observing
  3. 기록이 모델과 다름: record-mismatch
  4. 예측과 기록이 다름: prediction-mismatch
  5. 그 밖: record-match

### 5.5 기타

- 접근성: 두 SVG는 `role="img"`와 현재 상태를 설명하는 aria-label(예: "땅에서 보기: 오전 9시, 태양은 동쪽 하늘")을 둔다. 슬라이더는 키보드로 조작할 수 있다. 글자는 13 px 이상(빛 단원 검사 재사용).
- 다크 모드: 하늘 색은 의미가 있으므로 고정 색을 쓰되 글자 대비를 확인한다.
- xAPI: `predicted`, `observed`(조작), `recorded`(task, option, matchesModel), `task-completed`.

## 6. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 **종료 코드 0**. 기존 테스트 기대값은 바꾸지 않는다(단원 수 단언만 조정).
- 새 단위 테스트: §3.3 전부, 스키마(관찰 활동 + 기존 유형), 튜터 전수 가드(과제 probe), 순수 저장소(예측 전 조작 불가, 조작 전 기록 불가, 피드백 종류).
- 새 E2E (`e2e/earth-motion.spec.ts`):
  - 태양 과제:
    - 예측 전 슬라이더가 꺼져 있다.
    - 예측 후 시각을 9시 → 15시로 옮기면 땅에서 보기 문구가 "동쪽" → "서쪽"으로 바뀐다.
    - "동쪽에서 서쪽으로"를 기록하면 "관찰한 내용을 잘 기록했어요."가 나온다.
    - 자전 방향을 "만약에"로 바꾸고 같은 기록을 다시 하면 record-mismatch 문구가 나온다.
  - 낮과 밤 과제: "밤이에요" 기록 → match.
  - 계절 별자리 과제: 달 슬라이더 1월 → "오리온자리", 4월 → "사자자리"가 땅에서 보기 문구에 나온다.
  - 기존 `routing`, `layout`, `a11y` spec에 새 단원을 추가한다(과제별 상태 1개 이상).
- 문서: `docs/testing.md`, README(활동 유형 세 가지 설명).
