# 테스트 안내

## 단위 테스트 (vitest)
```bash
pnpm test        # packages/**, apps/** 의 *.test.ts (e2e 폴더는 제외)
pnpm typecheck   # 타입 검사 (e2e 코드 포함)
```

## 브라우저 자동 테스트 (Playwright E2E)
```bash
pnpm e2e                                   # 루트에서. 빌드 후 vite preview(포트 4174)를 띄워 크로미움으로 실행
pnpm --filter student exec playwright test solution   # 파일 이름으로 일부만 실행
```
- 설치된 브라우저를 그대로 씁니다(`playwright install` 불필요). 브라우저를 못 찾으면 `PW_CHROMIUM_PATH=/경로/chrome pnpm e2e`처럼 실행 파일을 알려 주세요.
- `CI` 환경 변수가 있으면 재시도 1회, 이미 떠 있는 서버를 재사용하지 않습니다.
- 테스트 코드는 `apps/student/e2e/*.spec.ts`, 공통 도우미(`selectIV`, `predict`, `runTrial` 등)는 `e2e/helpers.ts`에 있습니다. 모든 spec은 페이지 오류·콘솔 오류가 하나도 없어야 통과합니다.

### 빠른 재생: `playback` 주소 변수
실험 한 번의 재생은 기본 8초입니다. 주소에 `?playback=초`(0.2~8)를 붙이면 재생 시간이 줄어듭니다. 테스트는 `?playback=0.3`을 씁니다. 다른 변수와 함께 쓸 수 있습니다(`/?dev=1&playback=0.3#/unit/g6-acid-base`).

### 각 spec이 확인하는 것
| 파일 | 내용 |
|---|---|
| `routing.spec.ts` | 단원 목록(학년별 카드 3개), 카드 이동, 「← 단원 목록」, 알 수 없는 id는 `#/`로 |
| `solution.spec.ts` | 용해와 용액: 실행 조건 안내, 결과표 값, 공정한 비교 피드백(함께 바뀜·바꿀 조건 그대로), 뜨거운 물 경고, 그래프 슬라이더, 저울 질량 보존 |
| `gases.spec.ts` | 여러 가지 기체: 누르는 힘·기체 종류·물의 온도에 따른 부피, 튜터 질문, 압력 센서 단위 |
| `acid-base.spec.ts` | 산과 염기: 예측 전 잠금, 예측 불일치 질문, 안전 점검표 대화상자(포커스 가둠, Esc), 모의 안전 경고, 분류 확인, 사진 색 읽기, 화면에 `pH` 없음 |
| `layout.spec.ts` | 390·1100·1280 폭에서 가로 스크롤 없음, 어두운 화면의 실행 버튼 글자색 |
| `a11y.spec.ts` | axe-core(WCAG 2.0/2.1 A·AA)로 심각/치명 위반 없음 |

### 실패했을 때 살펴보기
실패하면 `apps/student/test-results/`에 스크린샷과 트레이스가 남고, `apps/student/playwright-report/`에 HTML 보고서가 생깁니다.
```bash
pnpm --filter student exec playwright show-trace test-results/<폴더>/trace.zip
pnpm --filter student exec playwright show-report
```
화면을 보면서 고치려면 `pnpm --filter student exec playwright test --ui` 또는 `--headed`를 쓰세요.

## GitHub Actions

`.github/workflows/ci.yml`이 모든 push와 pull request에서 두 작업을 병렬로 돌립니다.

- **타입 검사 · 단위 테스트 · 빌드**: `pnpm typecheck`, `pnpm test`, `pnpm build`
- **화면 테스트**: `playwright install --with-deps chromium` 후 `pnpm e2e`. 실패하면 `playwright-report`·`test-results`를 아티팩트로 7일간 보관합니다. 내려받아 `npx playwright show-trace <trace.zip>`으로 엽니다.

같은 브랜치에 새 push가 오면 진행 중인 실행은 취소됩니다.
