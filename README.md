# 과학 실험 학습 도구 (수직 슬라이스 v0): 4학년 「여러 가지 기체」, 5학년 「용해와 용액」, 6학년 「산과 염기」

실물 센서 없이 모의(Mock) 센서로 끝까지 동작하는 웹 실험 앱입니다.
사양은 `docs/specs/g6-earth-motion-mvp.md`(지구의 운동, 관찰 과제와 땅·우주 두 시점 동기화), `docs/specs/g6-acid-base-mvp.md`(산과 염기, 분류 활동·색 판독·안전 감시), `docs/specs/g5-solution-mvp.md`(용해와 용액), `docs/specs/g4-gases-mvp.md`(다단원 구조와 여러 가지 기체), 전체 계획은 `docs/DEVELOPMENT_PLAN.md`를 보세요.

## 준비물
- Node.js 22 이상
- pnpm 10

## 실행 방법
```bash
pnpm install        # 의존성 설치
pnpm dev            # 학생 앱 개발 서버 (http://localhost:5173)
pnpm test           # 모든 패키지 테스트 (vitest)
pnpm typecheck      # 모든 패키지 타입 검사
pnpm build          # 학생 앱 프로덕션 빌드 (apps/student/dist)
pnpm e2e            # 브라우저 자동 테스트 (Playwright)
```
`pnpm --filter student dev`로도 개발 서버를 띄울 수 있습니다.

교사 대시보드(수업 연결, 모둠 실시간 현황, 안전 알림, 모두 멈춤)는 `pnpm classroom:dev`로 서버와 교사 앱을 함께 띄웁니다. 자세한 사용법은 `docs/classroom.md`를 보세요.

테스트 방법(단위 테스트, 브라우저 테스트, `?playback=` 빠른 재생, 디버깅)은 `docs/testing.md`를 보세요.

## 단원 목록과 이동
앱을 열면 학년별 단원 카드가 나오는 단원 목록(`#/`)이 보입니다. 카드를 누르면 그 단원의 실험 화면(`#/unit/{단원 id}`)으로 이동하고, 실험 화면 위쪽의 「← 단원 목록」으로 돌아옵니다. 주소창에 직접 쓸 수도 있습니다.

| 주소 | 화면 |
|---|---|
| `#/` | 단원 목록 |
| `#/unit/g4-gases` | 4학년 여러 가지 기체 (주사기 속 기체의 부피) |
| `#/unit/g5-solution` | 5학년 용해와 용액 |
| `#/unit/g6-acid-base` | 6학년 산과 염기 (지시약으로 용액 분류하기) |
| `#/unit/g6-combustion` | 6학년 물질의 연소 (집기병으로 덮은 촛불) |
| `#/unit/g5-heat` | 5학년 열과 우리 생활 (보온 컵 설계) |
| `#/unit/g5-light` | 5학년 빛의 성질 (볼록 렌즈로 햇빛 모으기) |
| `#/unit/g6-electricity` | 6학년 전기의 이용 (전자석의 세기) |
| `#/unit/g4-land` | 4학년 땅의 변화 (마그마가 식는 빠르기와 알갱이 크기) |
| `#/unit/g6-earth-motion` | 6학년 지구의 운동 (땅에서 보기와 우주에서 보기를 비교하는 관찰 과제) |
| `#/unit/g3-lifecycle` | 3학년 생물의 한살이 (물·온도·빛에 따른 씨앗의 싹 트기, 7일째 싹 튼 씨앗 수·처음 싹 튼 날·떡잎 색) |
| `#/unit/g6-plant` | 6학년 식물의 구조와 기능 (잎의 수·빛·바람·처음 물의 양에 따른 이틀 동안 줄어든 물의 양, 증산 작용) |
| `#/unit/g4-ecosystem` | 4학년 생물과 환경 (처음 토끼·여우 수, 비, 토끼 털 색에 따른 60일 동안의 풀·토끼·여우 수 변화, 먹이 관계와 생태계 평형) |
| `#/unit/g4-microbe` | 4학년 다양한 생물과 우리 생활 (빵의 물기·온도·빛에 따른 곰팡이가 덮은 넓이와 처음 보인 날, 가상 현미경으로 균사와 포자 관찰) |
| `#/unit/g3-animal` | 3학년 동물의 생활 (카드 8장을 사는 곳·다리·날개 관찰로 분류, 주관적 기준 구별, 객관적 기준 2가지 완료) |
| `#/unit/g3-plantlife` | 3학년 식물의 생활 (잎 카드 8장을 "예/아니요" 질문으로 두 갈래씩 거듭 나누는 트리, 조상 질문은 다시 못 고름, 더 나눌 수 없을 때까지 나누면 완료) |
| `#/unit/g3-force` | 3학년 힘과 우리 생활 (오른쪽 추의 수·거리·모양에 따른 막대의 기울어진 쪽과 오른쪽 끝의 높이, 느린 화면과 "돌리려는 정도 보기") |
| `#/unit/g3-sound` | 3학년 소리의 성질 (줄을 튕기는 세기·줄의 길이·고무줄 색에 따른 1초 동안 떨린 횟수와 소리의 크기, 느린 화면의 떨림 모양 그래프와 "공기 알갱이 보기", 가상 소리 센서) |
| `#/unit/g5-body` | 5학년 우리 몸의 구조와 기능 (운동 종류·시간·손목에 따른 운동 직후 맥박·호흡과 원래 맥박으로 돌아오는 시간, 심장·폐·혈관 보기, 선택 기능 "내 맥박 재기") |
| `#/unit/g6-seasons` | 6학년 계절의 변화 (계절·자전축 기울기·막대 길이에 따른 태양 남중 고도, 그림자, 낮의 길이) |

산과 염기: 보안경 실제 감지는 모의 감지기로 대체, 모델은 스파이크 S2 이후. 주소 앞에 `?dev=1`을 붙이면(`/?dev=1#/unit/g6-acid-base`) 모의 안전 상황 버튼이 나타납니다.

알 수 없는 단원 id는 목록으로 돌아갑니다. 매니페스트가 잘못된 단원은 목록에 오류로 표시되고, 다른 단원은 계속 쓸 수 있습니다. 단원을 바꾸면 시행 기록은 새로 시작합니다.

### 활동 유형 세 가지
단원은 매니페스트의 `module`에 따라 세 가지 활동 유형 중 하나로 동작합니다.

| 활동 유형 | `module` | 흐름 | 화면 |
|---|---|---|---|
| 변인 실험 | `dissolution`, `gas-syringe`, `candle-jar`, `insulated-cup`, `convex-lens`, `electromagnet`, `magma-cooling`, `sun-angle`, `germination`, `transpiration`, `food-web`, `mold-growth`, `exercise-body`, `lever-balance`, `string-sound` | 바꿀 조건(조작변인) 고르기 → 예측 → 실행 → 시행 비교와 구조적 피드백 | `Lab`(`App.tsx`) |
| 분류 활동 | `indicator-classify` | 시험 → 관찰한 근거로 무리에 넣기 → 관찰과 분류가 맞는지 확인 | `ClassifyLab` |
| 관찰 과제 | `sky-observation` | 예측 → 시각·달 슬라이더와 조건 토글로 두 시점 화면 관찰 → 관찰 기록 → 예측과 관찰 비교 | `ObserveLab` |

관찰 과제 단원(지구의 운동)은 과제 5개로 이루어지고, 과제마다 정답은 매니페스트에 쓰지 않고 천체 모델(`packages/engines/earth/src/astro.ts`, 서울 위도 37.5°N 근사)에서 계산합니다. 모델은 교사 검수 대상입니다.

새 단원을 넣으려면 `content/units/{id}/manifest.json`을 만들고 `apps/student/src/units.ts`에 등록하세요. 매니페스트의 `module`로 실험 모듈(`apps/student/src/modules/`)을 고릅니다.

## 구조
| 경로 | 설명 |
|---|---|
| `content/units/g4-gases/manifest.json`, `content/units/g5-solution/manifest.json`, `content/units/g6-acid-base/manifest.json`, `content/units/g6-combustion/manifest.json`, `content/units/g5-heat/manifest.json`, `content/units/g5-light/manifest.json`, `content/units/g6-electricity/manifest.json`, `content/units/g4-land/manifest.json`, `content/units/g6-earth-motion/manifest.json`, `content/units/g6-seasons/manifest.json`, `content/units/g3-lifecycle/manifest.json`, `content/units/g6-plant/manifest.json`, `content/units/g4-ecosystem/manifest.json` | 단원 매니페스트 (변인, 게이트웨이, 튜터 탐침 질문) |
| `packages/cardsort` | `@sci/cardsort` 카드 분류 판정 로직(단원과 무관한 순수 함수) |
| `packages/schema` | `@sci/schema` zod 스키마 |
| `packages/runtime` | `@sci/runtime` 시행 관리, 타임라인, 플레이헤드 |
| `packages/gateway` | `@sci/gateway` 실행 조건, 시행 비교, 구조적 피드백, 조사 |
| `packages/engines/matter` | `@sci/engine-matter` 용해 모델, 기체 모델, 지시약 분류, 연소 모델 |
| `packages/engines/physics` | `@sci/engine-physics` 보온 컵 모델(뉴턴 냉각 법칙), 볼록 렌즈 모델(광선 추적), 전자석 모델 |
| `packages/engines/earth` | `@sci/engine-earth` 마그마 냉각 모델(식는 빠르기에 따른 알갱이 크기), 천체 모델(태양·별 위치, 낮과 밤, 별자리, 관찰 과제 정답 규칙), 태양 고도 모델(계절·자전축 기울기에 따른 남중 고도·그림자·낮의 길이·받는 에너지, 교사 검수 대상) |
| `packages/engines/life` | `@sci/engine-life` 씨앗이 싹 트는 모델(물·온도·빛에 따른 7일째 싹 튼 씨앗 수·처음 싹 튼 날·떡잎 색)과 잎에서 물이 빠져나가는 증산 모델(잎의 수·빛·바람에 따라 이틀 동안 줄어든 물의 양, 교사 검수 대상), 풀·토끼·여우 먹이 관계 모델(처음 토끼·여우 수와 비에 따른 60일 동안의 수 변화, 교사 검수 대상). 생명 엔진(E3)의 첫 패키지 |
| `packages/vision` | `@sci/vision` 색 변환·평균색·색표 매칭, 안전 감지기 인터페이스와 모의 감지기 |
| `packages/sensors` | `@sci/sensors` 센서 인터페이스와 Mock 드라이버(온도·무게·압력·산소·이산화 탄소·빛 세기·습도) |
| `packages/tutor` | `@sci/tutor` 규칙 기반 탐침 질문과 출력 가드 |
| `packages/xapi` | `@sci/xapi` xAPI 문장 생성과 메모리 큐 |
| `apps/student` | Vite + React 19 학생 앱 (`src/modules/`에 실험 모듈, `src/units.ts`에 단원 목록) |

패키지는 빌드하지 않고 `src/index.ts`를 바로 읽습니다. Capacitor(ios/android)는 이번 범위가 아닙니다.
