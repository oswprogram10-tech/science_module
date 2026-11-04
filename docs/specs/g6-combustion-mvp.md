# 구현 사양: 6학년 「물질의 연소」 최소 실험 (v0)

> 앞 사양: `g4-gases-mvp.md`(다단원 구조, 변인 실험 모듈), `g6-acid-base-mvp.md`(안전 점검표·경고 배너·모의 감지기), `docs/testing.md`(E2E).
> 새 변인 실험 모듈 `candle-jar`를 추가한다. 산과 염기의 안전 기능을 변인 실험에서도 쓸 수 있게 공용으로 옮긴다.

## 1. 실험 개요

- **탐구 질문**: "촛불을 집기병으로 덮으면 불이 꺼질 때까지 걸리는 시간은 어떤 조건에 따라 달라질까?"
- **조건 4가지**:
  - 집기병 크기
  - 초의 굵기
  - 초의 개수
  - 초의 색깔: 결과에 영향이 없는 대조 변인
- **측정**: 불이 꺼질 때까지 걸린 시간. 집기병 안의 산소·이산화 탄소 비율은 센서와 미시 화면으로 보여준다.
- **학습 의도**: 탈 물질만으로는 계속 타지 않는다는 것. 집기병이 크면 오래 타고, 초가 많거나 굵으면 빨리 꺼진다. 연소 뒤 집기병 안쪽에 물방울이 맺히고 이산화 탄소가 늘어난다(연소 생성물).

## 2. 공용화 (앞 단원 동작은 그대로)

- 안전 점검표 대화상자와 안전 경고 배너, 모의 감지기 패널(`?dev=1`)을 `apps/student/src/components/safety/`로 옮겨 공용으로 쓴다. 산과 염기 화면은 이 공용 컴포넌트를 쓰고 동작·문구는 바꾸지 않는다(기존 E2E가 그대로 통과해야 한다).
- 변인 실험 스키마에 선택 필드 `safetyChecklist: string[]`를 추가한다. 있으면 **처음 실행을 누를 때** 점검표 대화상자를 띄우고, 확인해야 실행한다. Esc나 닫기면 실행을 취소한다. 확인 상태는 그 단원 화면에서 유지한다.
- 변인 실험 화면도 `?dev=1`이면 모의 안전 상황 패널을 보여준다. 경고 배너가 떠 있는 동안에는 실행 버튼을 잠근다. 잠긴 이유는 "안전 경고를 먼저 확인해 주세요."로 표시한다.
- 경고 문구 NO_GOGGLES는 단원에 맞게 매니페스트에서 바꿀 수 있게 한다. 선택 필드 `safetyMessages: { NO_GOGGLES?: string, ... }`를 두고, 없으면 기존 기본 문구를 쓴다.
- 그래프: 실험 모듈의 `graph`에 선택 필드 `yMin`을 추가한다(기본 0). y축 눈금은 `yMin`부터 시작한다. 기존 단원은 0이라 바뀌지 않는다.
- 센서: `@sci/sensors`에 `MockGasDriver`를 추가한다. kind는 `'oxygen' | 'carbonDioxide'`, 단위 `%`, 소수 첫째 자리, 잡음 ±0.05. SensorBar는 kind별 접근성 이름("산소", "이산화 탄소")을 쓴다.

## 3. 매니페스트 (`content/units/g6-combustion/manifest.json`)

```jsonc
{
  "id": "g6-combustion",
  "title": "물질의 연소",
  "grade": 6,
  "standards": ["6과14-01"],     // 명세서 단원 번호 체계에서 추정. 고시 대조 필요
  "engine": "matter",
  "experiments": [{
    "id": "candle-jar",
    "module": "candle-jar",
    "title": "집기병으로 덮은 촛불이 꺼지는 시간 비교하기",
    "question": "촛불을 집기병으로 덮으면 불이 꺼질 때까지 걸리는 시간은 어떤 조건에 따라 달라질까?",
    "predictionPrompt": "예측: 불이 꺼질 때까지 걸리는 시간은?",
    "variables": [
      { "key": "jarMl", "label": "집기병의 크기", "type": "choice", "unit": "mL",
        "options": [ {"value":250,"label":"작은 집기병 250 mL"}, {"value":500,"label":"중간 집기병 500 mL"}, {"value":1000,"label":"큰 집기병 1000 mL"} ],
        "default": 500 },
      { "key": "candle", "label": "초의 굵기", "type": "choice",
        "options": [ {"value":"thin","label":"가는 초"}, {"value":"thick","label":"굵은 초"} ],
        "default": "thin" },
      { "key": "candleCount", "label": "초의 개수", "type": "choice", "unit": "개",
        "options": [ {"value":1,"label":"1개"}, {"value":2,"label":"2개"} ],
        "default": 1 },
      { "key": "candleColor", "label": "초의 색깔", "type": "choice",
        "options": [ {"value":"white","label":"흰색 초"}, {"value":"red","label":"빨간색 초"} ],
        "default": "white" }
    ],
    "dependent": [
      { "key": "extinguishS", "label": "불이 꺼질 때까지 걸린 시간", "unit": "초" },
      { "key": "usedOxygenMl", "label": "쓰인 산소의 양", "unit": "mL" }
    ],
    "gateway": { "mode": "open", "requirePrediction": true, "requireSingleIV": true },
    "safety": ["fire", "hot"],
    "safetyChecklist": [
      "긴 머리는 묶고, 소매가 불에 닿지 않게 했어요.",
      "책상 위에 타기 쉬운 물건을 치웠어요.",
      "불을 붙이거나 끌 때는 선생님과 함께해요."
    ],
    "safetyMessages": { "NO_GOGGLES": "불을 다루기 전에 보안경을 먼저 착용해 주세요!" },
    "safetyNotices": [],
    "limits": ["분자", "원자", "화학 반응식"],
    "params": { "oxygenStartPct": 21, "oxygenOutPct": 16 },
    "tutor": {
      "forbiddenAnswers": [
        "집기병이 클수록 오래 타",
        "공기가 많을수록 오래 타",
        "산소가 부족해서 꺼",
        "산소가 있어야 탄",
        "초의 색깔은 관계없",
        "초가 많을수록 빨리 꺼"
      ],
      "probes": [
        { "when": "before-run",  "text": "{iv}을(를) 바꾸면 불이 꺼질 때까지 걸리는 시간이 어떻게 될지 예측해 볼까요? 왜 그렇게 생각했나요?" },
        { "when": "first-trial", "text": "이번 결과를 기준으로 삼을 거예요. 다음 시행에서는 무엇만 바꿔 볼까요?" },
        { "when": "confounded",  "text": "{changed}이(가) 함께 바뀌었어요. 걸린 시간이 달라진 까닭이 어느 쪽 때문인지 어떻게 알아낼 수 있을까요?" },
        { "when": "iv-unchanged", "text": "{iv}은(는) 그대로인데 {changed}이(가) 바뀌었어요. 처음에 알아보려던 것을 확인하려면 다음에는 무엇을 바꿔야 할까요?" },
        { "when": "repeat",      "text": "앞 시행과 조건이 같아요. 같은 결과가 다시 나왔나요? 결과가 같은지 확인하는 것은 왜 중요할까요?" },
        { "when": "fair-test",   "text": "{iv}만 바꾸었을 때 불이 꺼질 때까지 걸린 시간은 어떻게 달라졌나요? 센서 값도 함께 비교해 볼까요?" },
        { "when": "fair-test", "iv": "jarMl", "text": "집기병의 크기만 바꾸었을 때 걸린 시간이 달라졌어요. 집기병 안에 무엇이 더 많거나 적었을까요?" },
        { "when": "fair-test", "iv": "candleColor", "text": "초의 색깔만 바꾸었을 때 걸린 시간이 달라졌나요? 이 결과로 무엇을 알 수 있을까요?" },
        { "when": "prediction-mismatch", "text": "예측과 결과가 달랐네요. 그래프와 센서 값의 어느 부분을 보면 그 까닭을 찾을 수 있을까요?" }
      ]
    }
  }]
}
```

전수 가드 테스트(모든 probe × 모든 변인)에서 오검출이 없어야 한다. 특히 "산소"가 들어간 금지 구절과 probe 문구가 겹치지 않는지 확인한다.

## 4. 연소 모델 (`@sci/engine-matter`, `combustion.ts`)

수치는 교실 관찰값에 맞춘 근사이며 **교사 검수 대상**이다.

- 입력: `{ jarMl, candle: 'thin'|'thick', candleCount: 1|2, candleColor }`, `opts = { dt = 0.05, sampleEvery = 0.25, tailS = 3, oxygenStartPct = 21, oxygenOutPct = 16 }`.
- 초 1개의 산소 소비 속도 `r`(mL/s): 가는 초 2.5, 굵은 초 4.0. 전체 소비 = r × candleCount. 색깔은 영향 없음.
- 쓸 수 있는 산소 양 = jarMl × (oxygenStartPct − oxygenOutPct) / 100.
- 불꽃 세기 `f(t)` = (O₂% − out) / (start − out)을 0~1로 자른 값. 산소 소비 속도에 `0.3 + 0.7·f`를 곱해, 불꽃이 약해질수록 천천히 쓰게 한다. 산소 비율이 out 이하가 되면 꺼진다(f=0, 소비 0).
- 이산화 탄소: 소비한 산소 부피의 0.7배만큼 늘어난다(처음 0.04%). 물방울 정도 `fog`(0~1)는 누적 소비 산소 / 쓸 수 있는 산소.
- 꺼진 뒤 `tailS`초 동안 상태를 유지하며 샘플을 더 남긴다(연기 표시용).
- 샘플: `{ t, oxygenPct, co2Pct, flame, fog, lit: 0|1 }`(lit은 보간 가능하게 숫자).
- 결과:
  - `extinguishS`: 꺼진 시각, 소수 첫째 자리
  - `oxygenEndPct`: 꺼질 때 산소 비율, 소수 첫째 자리 (모델상 항상 out 값이라 화면에는 쓰지 않음)
  - `usedOxygenMl`: jarMl × (start − 꺼질 때 산소%) / 100, 소수 첫째 자리
  - `co2EndPct`: 꺼질 때 이산화 탄소 비율, 소수 둘째 자리
- `validateCombustionExperiment(exp)`:
  - 네 변인이 있고, 각 값이 허용 범위에 있어야 한다. jarMl은 100 이상 5000 이하, candle은 두 종류 중 하나, candleCount는 1~4 정수, candleColor는 아무 문자열이나 된다.
  - params의 start가 out보다 커야 한다.
- 순수 함수, 난수 없음.

**반드시 통과할 테스트**

- 집기병 250 → 500 → 1000 mL: 걸린 시간이 정확히 비례한다(상대 오차 1% 이내). 다른 조건이 같으면 시간은 jarMl에 비례하기 때문이다.
- 초 2개는 1개보다 정확히 절반 시간이 걸린다(1% 이내). 굵은 초는 가는 초의 2.5/4.0배 시간이다.
- 색깔만 바꾸면 결과가 똑같다.
- 기준값: 가는 초 1개, 500 mL에서 걸린 시간이 15~25초. 실제 값을 테스트에 고정한다.
- 모든 샘플에서 산소 비율은 단조 감소하고 out 아래로 내려가지 않는다. 이산화 탄소는 단조 증가한다.
- 꺼진 뒤 샘플은 flame = 0, lit = 0이다.

## 5. 화면 (`apps/student/src/modules/candle-jar/`)

- **거시(SVG) "눈으로 보기"**:
  - 받침 위에 초를 그린다. 굵기와 개수를 반영하고, 색깔은 흰색·빨간색 + 글자 라벨로 구분한다.
  - 초를 덮은 투명 집기병을 그린다. 크기는 jarMl에 따라 세 단계다.
  - 불꽃 크기는 flame에 비례한다(꺼지면 사라지고 연기 선 2~3개).
  - 집기병 안쪽 벽의 물방울 점은 fog에 비례한다.
  - 아래 문구: 켜져 있으면 "불이 타고 있어요 · {t}초", 꺼졌으면 "불이 꺼졌어요 · {extinguishS}초".
- **미시(Canvas) "알갱이로 보기"**:
  - 집기병 모양 안에 알갱이 60개를 둔다. 산소(빨강 ●), 이산화 탄소(검정 ■), 그 밖의 기체(회색 ●)를 범례와 함께 그린다.
  - 산소 알갱이 수는 oxygenPct에 비례하고(21%에서 13개 기준), 줄어든 만큼 이산화 탄소와 물(파랑 ▲, 범례 "물") 알갱이로 바꿔 보여준다.
  - "분자" 낱말은 쓰지 않는다. reduced-motion이면 움직임을 멈춘다.
- **그래프**: y = oxygenPct, 라벨 `산소 비율(%)`, `yMin` 14.
- **센서**: 가상 산소 센서(oxygenPct), 가상 이산화 탄소 센서(co2Pct).
- **결과 열**: 걸린 시간(초), 쓰인 산소의 양(mL). (꺼질 때 산소·이산화 탄소 비율은 모델상 시행마다 같아서 표에서 뺐다. 센서로 보여 준다.)
- **예측 비교**: `sameThreshold` = 1초.
- **안전**: 처음 실행할 때 매니페스트의 점검표 대화상자를 띄운다. 실행 버튼 아래에 항상 "⚠ 실제 실험에서는 불 가까이에 얼굴을 대지 않아요."를 표시한다.

## 6. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 통과. 기존 단위 테스트 174개와 E2E 39개는 기대값을 바꾸지 않는다.
- 새 단위 테스트: §4 전부, `MockGasDriver`, 스키마(`safetyChecklist`, `safetyMessages`, 네 매니페스트 통과), 튜터 전수 가드, 레지스트리 4단원, `yMin` 눈금.
- 새 E2E (`e2e/combustion.spec.ts`):
  - 첫 실행 때 점검표가 뜨고, Esc를 누르면 실행되지 않는다.
  - 확인 후 실행한다. 집기병 크기를 바꿔 걸린 시간이 늘어나고 "결과: 늘어났다"가 나온다.
  - 초의 색깔만 바꾸면 "결과: 변하지 않았다"와 색깔 전용 질문이 나온다.
  - `?dev=1`에서 보안경 경고 배너("불을 다루기 전에 보안경을 먼저 착용해 주세요!")가 뜨고 실행 버튼이 잠긴다.
  - 기존 `routing`, `layout`, `a11y` spec에 새 단원을 추가한다.
- 문서: `docs/testing.md`의 spec 목록에 한 줄을 추가한다.
