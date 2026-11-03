# 과학 실험 학습 도구 (수직 슬라이스 v0): 4학년 「여러 가지 기체」, 5학년 「용해와 용액」, 6학년 「산과 염기」

실물 센서 없이 모의(Mock) 센서로 끝까지 동작하는 웹 실험 앱입니다.
사양은 `docs/specs/g6-acid-base-mvp.md`(산과 염기, 분류 활동·색 판독·안전 감시), `docs/specs/g5-solution-mvp.md`(용해와 용액), `docs/specs/g4-gases-mvp.md`(다단원 구조와 여러 가지 기체), 전체 계획은 `docs/DEVELOPMENT_PLAN.md`를 보세요.

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
```
`pnpm --filter student dev`로도 개발 서버를 띄울 수 있습니다.

## 단원 목록과 이동
앱을 열면 학년별 단원 카드가 나오는 단원 목록(`#/`)이 보입니다. 카드를 누르면 그 단원의 실험 화면(`#/unit/{단원 id}`)으로 이동하고, 실험 화면 위쪽의 「← 단원 목록」으로 돌아옵니다. 주소창에 직접 쓸 수도 있습니다.

| 주소 | 화면 |
|---|---|
| `#/` | 단원 목록 |
| `#/unit/g4-gases` | 4학년 여러 가지 기체 (주사기 속 기체의 부피) |
| `#/unit/g5-solution` | 5학년 용해와 용액 |
| `#/unit/g6-acid-base` | 6학년 산과 염기 (지시약으로 용액 분류하기) |

산과 염기: 보안경 실제 감지는 모의 감지기로 대체, 모델은 스파이크 S2 이후. 주소 앞에 `?dev=1`을 붙이면(`/?dev=1#/unit/g6-acid-base`) 모의 안전 상황 버튼이 나타납니다.

알 수 없는 단원 id는 목록으로 돌아갑니다. 매니페스트가 잘못된 단원은 목록에 오류로 표시되고, 다른 단원은 계속 쓸 수 있습니다. 단원을 바꾸면 시행 기록은 새로 시작합니다.

새 단원을 넣으려면 `content/units/{id}/manifest.json`을 만들고 `apps/student/src/units.ts`에 등록하세요. 매니페스트의 `module`로 실험 모듈(`apps/student/src/modules/`)을 고릅니다.

## 구조
| 경로 | 설명 |
|---|---|
| `content/units/g4-gases/manifest.json`, `content/units/g5-solution/manifest.json`, `content/units/g6-acid-base/manifest.json` | 단원 매니페스트 (변인, 게이트웨이, 튜터 탐침 질문) |
| `packages/schema` | `@sci/schema` zod 스키마 |
| `packages/runtime` | `@sci/runtime` 시행 관리, 타임라인, 플레이헤드 |
| `packages/gateway` | `@sci/gateway` 실행 조건, 시행 비교, 구조적 피드백, 조사 |
| `packages/engines/matter` | `@sci/engine-matter` 용해 모델, 기체 모델, 지시약 분류 |
| `packages/vision` | `@sci/vision` 색 변환·평균색·색표 매칭, 안전 감지기 인터페이스와 모의 감지기 |
| `packages/sensors` | `@sci/sensors` 센서 인터페이스와 Mock 드라이버 |
| `packages/tutor` | `@sci/tutor` 규칙 기반 탐침 질문과 출력 가드 |
| `packages/xapi` | `@sci/xapi` xAPI 문장 생성과 메모리 큐 |
| `apps/student` | Vite + React 19 학생 앱 (`src/modules/`에 실험 모듈, `src/units.ts`에 단원 목록) |

패키지는 빌드하지 않고 `src/index.ts`를 바로 읽습니다. Capacitor(ios/android)는 이번 범위가 아닙니다.
