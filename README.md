# 과학 실험 학습 도구: 5학년 「용해와 용액」 최소 실험 (수직 슬라이스 v0)

실물 센서 없이 모의(Mock) 센서로 끝까지 동작하는 웹 실험 앱입니다.
사양은 `docs/specs/g5-solution-mvp.md`, 전체 계획은 `docs/DEVELOPMENT_PLAN.md`를 보세요.

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

## 구조
| 경로 | 설명 |
|---|---|
| `content/units/g5-solution/manifest.json` | 단원 매니페스트 (변인, 게이트웨이, 튜터 탐침 질문) |
| `packages/schema` | `@sci/schema` zod 스키마 |
| `packages/runtime` | `@sci/runtime` 시행 관리, 타임라인, 플레이헤드 |
| `packages/gateway` | `@sci/gateway` 실행 조건, 시행 비교, 구조적 피드백, 조사 |
| `packages/engines/matter` | `@sci/engine-matter` 용해 모델 |
| `packages/sensors` | `@sci/sensors` 센서 인터페이스와 Mock 드라이버 |
| `packages/tutor` | `@sci/tutor` 규칙 기반 탐침 질문과 출력 가드 |
| `packages/xapi` | `@sci/xapi` xAPI 문장 생성과 메모리 큐 |
| `apps/student` | Vite + React 19 학생 앱 |

패키지는 빌드하지 않고 `src/index.ts`를 바로 읽습니다. Capacitor(ios/android)는 이번 범위가 아닙니다.
