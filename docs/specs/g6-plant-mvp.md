# 구현 사양: 6학년 「식물의 구조와 기능」 최소 실험 (v0) — 잎과 증산 작용

> 앞 사양: `phase2-roadmap.md`(순서 2), 가장 최근 단원 `g3-lifecycle-mvp.md`(`@sci/engine-life`, 모듈 `germination`이 가장 좋은 본보기).
> 새 변인 실험 모듈은 `transpiration`이다(`@sci/engine-life`).

## 1. 실험 개요

- **탐구 질문**: "잎이 달린 줄기를 꽂아 둔 물은 어떤 조건에서 더 많이 줄어들까?"
- **실험 설정**: 같은 굵기의 줄기를 눈금실린더 물에 꽂는다. 물 표면에는 식용유를 얇게 부어 물이 그냥 증발하지 않게 한다. 줄기 위에는 비닐봉지를 씌우고 이틀(48시간) 동안 둔다.
- **조건 4가지**:
  - 잎의 수: 0장(모두 땀) / 4장 / 8장
  - 빛: 밝은 곳 / 어두운 곳
  - 바람: 없음 / 선풍기 약하게
  - 처음 물의 양: 100 / 150 mL — 대조 변인. 줄어든 양에는 영향이 없다.
- **측정**: 이틀 동안 줄어든 물의 양(mL), 비닐봉지 안 물방울 정도(없음/조금/많음)
- **학습 의도**
  - 뿌리·줄기로 올라간 물은 잎에서 빠져나간다(증산 작용).
  - 잎이 많을수록, 밝을수록, 바람이 불수록 많이 빠져나간다.
  - 잎이 없으면 거의 줄지 않는다.
  - 처음 물의 양은 줄어든 양을 바꾸지 않는다.
- **용어**: "증산 작용", "기공", "물관"은 쓴다(교육과정 용어). 공변세포·삼투 등은 쓰지 않는다.

## 2. 증산 모델 (`@sci/engine-life`, `transpiration.ts`)

근사 모델이며 **교사 검수 대상**이다.

- **입력과 옵션**
  - 입력: `{ leaves: number, light: 'bright'|'dark', wind: 'off'|'on', startMl: number }`
  - `opts = { hours = 48, sampleEveryH = 0.5 }`
- **잎 한 장의 빠지는 양**(mL/일): bright 1.2, dark 0.3. 바람이 있으면 ×1.5. 식용유 때문에 물 표면 증발은 0으로 둔다.
- **시간에 따른 남은 물**: `remainingMl(t) = startMl − leaves·perLeaf·t/24`. 0 아래로 내려가지 않는다(범위 안에서는 일어나지 않음).
- **비닐봉지 물방울 정도** `fog(t)`: 빠져나간 양 / 10 mL를 0~1로 자른 값.
- **기공 열림**(화면용): bright 1, dark 0.25. 바람과는 무관하다.
- **샘플**: `{ t, remainingMl, lostMl, fog, stomata }`
- **결과**
  - `lostMl`: 소수 첫째 자리
  - `remainingMl`
  - `droplets`: 'none'(lost < 0.5), 'some'(< 8), 'many'(그 이상)
- **`validateTranspirationExperiment(exp)`**: 네 변인이 있는지, 값이 허용 범위인지 검사한다. 잎 0~20 정수, 처음 물 50~500.
- 순수 함수, 난수 없음.

### 2.1 미리 계산한 기준값 (48시간 동안 줄어든 양 mL, 테스트로 고정)

| 잎 | 밝음·바람 없음 | 밝음·바람 | 어두움·바람 없음 | 어두움·바람 |
|---|---|---|---|---|
| 0장 | 0.0 | 0.0 | 0.0 | 0.0 |
| 4장 | 9.6 | 14.4 | 2.4 | 3.6 |
| 8장 | 19.2 | 28.8 | 4.8 | 7.2 |

처음 물의 양(100/150)은 위 값을 바꾸지 않는다. remainingMl만 다르다.

### 2.2 반드시 통과할 테스트

- 표 12칸을 처음 물 100·150 각각으로 고정한다.
- 처음 물만 바꾸면 lostMl과 droplets가 같다.
- 잎 0장이면 모든 조건에서 0이다.
- 샘플의 remainingMl은 단조 감소한다.

## 3. 매니페스트 (`content/units/g6-plant/manifest.json`)

```jsonc
{
  "id": "g6-plant",
  "title": "식물의 구조와 기능",
  "grade": 6,
  "standards": ["6과11-01"],     // 명세서 단원 번호 체계에서 추정. 고시 대조 필요
  "engine": "life",
  "experiments": [{
    "id": "transpiration",
    "module": "transpiration",
    "title": "잎에서 빠져나가는 물 알아보기",
    "question": "잎이 달린 줄기를 꽂아 둔 물은 어떤 조건에서 더 많이 줄어들까?",
    "predictionPrompt": "예측: 이틀 동안 줄어든 물의 양은?",
    "variables": [
      { "key": "leaves", "label": "잎의 수", "type": "choice", "unit": "장",
        "options": [ {"value":0,"label":"0장 (잎을 모두 땀)"}, {"value":4,"label":"4장"}, {"value":8,"label":"8장"} ],
        "default": 8 },
      { "key": "light", "label": "빛", "type": "choice",
        "options": [ {"value":"bright","label":"밝은 곳"}, {"value":"dark","label":"어두운 곳"} ],
        "default": "bright" },
      { "key": "wind", "label": "바람", "type": "choice",
        "options": [ {"value":"off","label":"바람 없음"}, {"value":"on","label":"선풍기 약하게"} ],
        "default": "off" },
      { "key": "startMl", "label": "처음 물의 양", "type": "choice", "unit": "mL",
        "options": [ {"value":100,"label":"100 mL"}, {"value":150,"label":"150 mL"} ],
        "default": 100 }
    ],
    "dependent": [
      { "key": "lostMl", "label": "이틀 동안 줄어든 물의 양", "unit": "mL" },
      { "key": "remainingMl", "label": "남은 물의 양", "unit": "mL" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": [],
    "safetyNotices": [],
    "limits": ["공변세포", "삼투", "광합성 반응식", "수분 퍼텐셜"],
    "params": { "hours": 48 },
    "tutor": {
      "forbiddenAnswers": [
        "잎이 많을수록 물이 많이 줄",
        "잎에서 물이 빠져나가기 때문",
        "밝을수록 물이 많이 줄",
        "바람이 불면 물이 더 많이 줄",
        "처음 물의 양과 관계없"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 줄어드는 물의 양이 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 줄어든 물의 양이 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 줄어든 물의 양과 비닐봉지 안의 모습은 어떻게 달라졌나요? 결과표와 그림을 함께 볼까요?" },
        { "when": "fair-test", "iv": "leaves", "text": "잎의 수만 바꾸었어요. 잎을 모두 딴 줄기와 잎이 달린 줄기에서 비닐봉지 안은 어떻게 달랐나요? 물은 어디로 갔을까요?" },
        { "when": "fair-test", "iv": "startMl", "text": "처음 물의 양만 바꾸었을 때 줄어든 양은 어떻게 되었나요? 남은 양과 줄어든 양을 구분해서 볼까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 잎 확대 그림에서 기공의 모습을 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

전수 가드 테스트에서 오검출이 없어야 한다. 특히 probe의 "물은 어디로 갔을까요?"가 금지 구절에 걸리지 않는지 확인한다.

## 4. 화면 (`apps/student/src/modules/transpiration/`)

- **거시(SVG) "눈으로 보기"**
  - 눈금실린더(0~150 mL 눈금, 25 mL 간격 숫자). 물 높이는 remainingMl이고, 물 위에 얇은 노란 식용유 층이 있다.
  - 실린더에 꽂힌 줄기. 잎은 leaves 수만큼 그리고, 잎이 0장이면 잎을 딴 자국을 그린다.
  - 줄기 위의 비닐봉지. 안쪽 물방울 점은 fog에 비례한다.
  - 어두우면 배경을 어둡게 하고 "어두운 곳" 라벨을 붙인다. 바람이면 선풍기 아이콘과 바람 선을 그린다.
  - 아래 문구: `"{t}시간 · 남은 물 {remainingMl} mL"`
- **미시 자리(SVG) "잎 확대해 보기"**
  - 잎 뒷면 일부를 확대해 기공 3~4개를 그린다. 열림 정도는 stomata에 비례한다.
  - 기공에서 나가는 수증기 점의 개수와 속도는 증산량에 비례한다. reduced-motion이면 정지한다.
  - 줄기 속 물관을 따라 올라가는 물 화살표를 그린다.
  - 라벨: "기공", "물관", 그림 아래 "물은 뿌리와 줄기를 거쳐 잎의 기공으로 빠져나가요."
  - 잎이 0장이면 "잎이 없어요" 상태를 보여 준다.
- **그래프**: y = remainingMl, 라벨 `남은 물의 양(mL)`, yMin 0. x 라벨 `시간(시간)`, xTicks 0·12·24·36·48. markers는 24시간 "하루"이다.
- **센서**: "가상 습도 센서: 비닐봉지 안"(fog × 60 + 35 %, 기존 kind 중 맞는 것이 없으면 `humidity` 추가), "가상 빛 센서"(bright 80 / dark 2).
- **결과 열**: 이틀 동안 줄어든 물(mL), 남은 물(mL), 비닐봉지 속 물방울(없음/조금/많음).
- **예측 비교**: `sameThreshold` = 0.5 mL.
- **재생 후 플레이헤드**: `restPlayhead` = 48.

## 5. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 종료 코드 0. 기존 기대값은 바꾸지 않는다(단원 수·카드 수 단언만 조정).
- 새 단위 테스트: §2.2, 스키마, 튜터 전수 가드, 레지스트리, 습도 센서(추가했다면).
- 새 E2E (`e2e/plant.spec.ts`):
  - 기준(8장, 밝음, 바람 없음, 100 mL)이면 19.2, 80.8, "많음"이 보인다.
  - 잎을 0장으로 바꾸면 0.0, "없음", "결과: 줄어들었다", 잎 전용 질문이 나온다.
  - 새 페이지에서 처음 물만 150으로 바꾸면 19.2, 130.8, "결과: 변하지 않았다", 처음 물 전용 질문이 나온다.
  - 어두운 곳이면 4.8이다.
  - 잎 확대 그림에 "기공", "물관" 라벨이 보인다.
  - SVG 글자는 13 px 이상이다.
  - 기존 `routing`, `layout`, `a11y`(밝게·어둡게) spec에 새 단원을 추가한다.
- 문서: `docs/testing.md`.
