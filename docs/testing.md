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
- `CI` 환경 변수가 있으면 재시도 1회. 이미 떠 있는 서버는 어디서든 재사용하지 않습니다(오래된 빌드를 검사하는 일을 막기 위해). 포트 4174가 사용 중이면 실패하니 그 프로세스를 먼저 끄세요.
- 테스트 코드는 `apps/student/e2e/*.spec.ts`, 공통 도우미(`selectIV`, `predict`, `runTrial` 등)는 `e2e/helpers.ts`에 있습니다. 모든 spec은 페이지 오류·콘솔 오류가 하나도 없어야 통과합니다.

### 빠른 재생: `playback` 주소 변수
실험 한 번의 재생은 기본 8초입니다. 주소에 `?playback=초`(0.2~8)를 붙이면 재생 시간이 줄어듭니다. 테스트는 `?playback=0.3`을 씁니다. 다른 변수와 함께 쓸 수 있습니다(`/?dev=1&playback=0.3#/unit/g6-acid-base`).

### 각 spec이 확인하는 것
| 파일 | 내용 |
|---|---|
| `routing.spec.ts` | 단원 목록(학년별 카드 9개), 카드 이동, 「← 단원 목록」, 알 수 없는 id는 `#/`로 |
| `solution.spec.ts` | 용해와 용액: 실행 조건 안내, 결과표 값, 공정한 비교 피드백(함께 바뀜·바꿀 조건 그대로), 뜨거운 물 경고, 그래프 슬라이더, 저울 질량 보존 |
| `gases.spec.ts` | 여러 가지 기체: 누르는 힘·기체 종류·물의 온도에 따른 부피, 튜터 질문, 압력 센서 단위 |
| `acid-base.spec.ts` | 산과 염기: 예측 전 잠금, 예측 불일치 질문, 안전 점검표 대화상자(포커스 가둠, Esc), 모의 안전 경고, 분류 확인, 사진 색 읽기, 화면에 `pH` 없음 |
| `combustion.spec.ts` | 물질의 연소: 처음 실행 때 안전 점검표(Esc로 취소), 집기병 크기에 따른 걸린 시간, 초의 색깔 대조 변인, 모의 보안경 경고와 실행 잠금 |
| `heat.spec.ts` | 열과 우리 생활: 점검표를 거친 기준 시행(7.6 °C), 솜으로 바꾸면 줄어듦과 재료 전용 질문, 겹 수만 바꾸면 변하지 않음과 겹 수 전용 질문, 열화상 화면의 숫자 온도·안내 문구, 이 단원의 보안경 경고 문구 |
| `light.spec.ts` | 빛의 성질: 점검표를 거친 기준 시행(30.0·20.0), 10 cm에서 그을림과 거리 전용 질문, 20 cm에서 다시 줄어듦, 렌즈 크기만 바꾸면 변하지 않음, 빛의 길 화면 문구와 광선, 밝기 글자, 해를 직접 보지 말라는 경고, 그림 글자 13 px 이상 |
| `electricity.spec.ts` | 전기의 이용: 점검표를 거친 기준 시행(12개·N극), 직렬이면 25개와 전지 연결 전용 질문, 방향만 바꾸면 12개·S극·변하지 않음과 방향 전용 질문, 빨대만이면 0개, 50회 직렬 뜨거움 경고, 그래프 슬라이더에 따른 스위치 켜짐·꺼짐 문구와 켜짐·꺼짐 표식, 코일 줄 수·전지 그림·나침반 바늘, 전기가 흐르는 모습(점이 움직이다 꺼지면 멈춤, 병렬 갈래, 움직임 줄이기에서는 화살표), 가정용 콘센트 경고, 그림 글자 13 px 이상 |
| `land.spec.ts` | 땅의 변화: 점검표를 거친 기준 시행(0.80·중간), 따뜻한 물 위에서 2.04·화강암 쪽·늘어났다와 식히는 곳 전용 질문, 색깔만 바꾸면 변하지 않음과 색깔 전용 질문, 알루미늄 10 g = 유리 5 g, 돋보기 화면의 1 mm 축척과 비교 카드, 받침·접시 라벨과 굳는 모양, 시행마다 다른 그래프 표식(겹침 없음), 이 단원에만 보이는 뜨거움 상시 문구, 움직임 줄이기, 그림 글자 13 px 이상 |
| `earth-motion.spec.ts` | 지구의 운동(관찰 과제): 예측 전 슬라이더·토글·기록 잠금, 조작 전 기록 잠금, 태양 과제의 9시 → 15시에 땅에서 보기 문구가 동쪽 → 서쪽, 기록하면 "관찰한 내용을 잘 기록했어요.", 자전 방향을 "만약에"로 바꿔 다시 기록하면 다시 살펴보라는 질문, 시각 슬라이더 키보드 조작과 `aria-valuetext`, 우리나라 표시·자전 화살표, 태양 자리 점선(과제를 바꾸면 지움), 재생(24시에서 멈춤, 나가면 취소), 움직임 줄이기에서 재생 버튼 없음, 낮과 밤 과제("밤이에요" 기록), 별 과제, 계절 과제(1월 오리온자리·4월 사자자리), 겨울 별자리 과제, 두 그림 글자 13 px 이상 |
| `layout.spec.ts` | 390·1100·1280 폭에서 가로 스크롤 없음, 어두운 화면의 실행 버튼 글자색 |
| `a11y.spec.ts` | axe-core(WCAG 2.0/2.1 A·AA)로 심각/치명 위반 없음(지구의 운동은 과제별 상태와 어두운 화면 포함) |

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
