# 구현 사양: 교사용 윈도우 PC 수업 서버(설치하면 로컬 서버와 교사 화면이 함께 열림)와 학생 APK 연결

> 결정(사용자, 2026-11-11):
> - 수업 서버는 교사용 **윈도우 PC**에 설치한다. 실행하면 로컬 서버가 함께 열리고, 같은 무선망의 학생 기기(안드로이드 APK)가 그 서버로 수업에 참여한다.
> - 안드로이드는 **APK까지만** 준비한다(스토어 제출과 릴리스 서명은 하지 않는다).
> 앞 문서: `docs/classroom.md`(수업 연결 v0), `docs/app-packaging.md`, `apps/server`(Fastify + WebSocket, 메모리 상태).

## 0. 결정

### 0.1 교사용 수업 서버 프로그램 (`apps/classroom-host`, 새 패키지)
- **하나의 실행 파일**: `SciBridgeON-수업서버.exe`(Windows x64)
  - Node.js 22의 Single Executable Application(SEA)으로 만든다.
  - 서버 코드(`apps/server`)와 교사 화면 정적 파일(`apps/teacher/dist`)을 함께 넣는다.
  - 교사 PC에 Node.js를 따로 설치할 필요가 없다.
  - "설치"는 이 exe를 내려받아 두는 것이다. 설치 프로그램(인스톨러)은 만들지 않는다. 바탕화면 바로가기 만들기는 안내 문서에 적는다.
- **실행하면**
  1. `0.0.0.0:8787`에서 서버를 연다. 포트가 쓰이고 있으면 8788~8799 가운데 빈 포트를 쓴다.
  2. 같은 포트에서 교사 화면(정적 파일)을 `/`로 내보낸다. WebSocket은 지금처럼 `/ws`이다.
  3. 기본 브라우저로 `http://localhost:<port>/`를 연다.
  4. 콘솔 창에 한국어로 다음을 보여 준다.
     - "수업 서버가 켜졌어요. 이 창을 닫으면 수업이 끝나요."
     - 학생이 입력할 **서버 주소**: 이 PC의 사설 IPv4 주소들(192.168.x.x, 10.x.x.x, 172.16–31.x.x)과 포트
- **교사 화면이 서버에서 열리면**
  - WebSocket 주소를 자기 주소(`ws://<location.host>/ws`)로 정한다. `?classroom=`과 빌드 변수가 있으면 그쪽이 먼저이다.
  - 화면 위쪽에 "학생 앱에 입력할 주소: 192.168.0.10:8787"과 그 주소의 QR 코드를 보여 준다.
    - 주소 목록은 서버의 새 HTTP 엔드포인트 `GET /host-info`에서 받는다. 응답: `{ addresses: string[], port: number }`. 이 엔드포인트는 localhost에서 온 요청에만 응답한다.
    - QR은 외부 서비스 없이 만든다(작은 QR 라이브러리를 정확한 버전으로 고정하거나 직접 구현). 인터넷이 없어도 되어야 한다.
- **보안 기본값**(교실 LAN)
  - `ALLOWED_ORIGINS`가 비어 있으면 모두 허용하는 지금 동작을 유지한다. 학생 APK의 출처는 `http://localhost`이다.
  - `CREATE_SECRET`는 쓰지 않는다. 대신 **수업 만들기는 localhost에서 온 연결만 허용**한다. 교사 화면은 같은 PC에서 열리기 때문이다.
    - 이 동작은 호스트 모드(`HOST_MODE=1` 또는 호스트 진입점)에서만 켠다.
    - 학교 서버 모드(`pnpm --filter @sci/server start`)는 지금과 같다.
  - 서버 상태는 지금처럼 메모리에만 둔다. 파일을 쓰지 않는다.
- **방화벽**
  - 처음 실행할 때 Windows 방화벽이 허용을 묻는다. 안내 문서에 "개인 네트워크 허용"을 고르라고 적는다.
  - 코드로 방화벽 규칙을 바꾸지 않는다.

### 0.2 학생 앱(APK)에서 서버 주소 넣기
- 지금 학생 앱은 서버 주소(`?classroom=` 또는 빌드 변수)가 없으면 「수업 참여」 버튼을 숨긴다.
- **앱(Capacitor)에서는**
  - 서버 주소가 없어도 「수업 참여」를 보여 준다.
  - 참여 대화 상자 맨 위에 **"선생님 PC 주소"** 입력칸을 둔다. 예: `192.168.0.10:8787`. 입력은 다음처럼 해석한다.
    - `ws://` 또는 `wss://`가 있으면 그대로 쓴다.
    - 없으면 `ws://<입력>/ws`로 만든다.
    - 포트가 없으면 8787을 붙인다.
  - 마지막에 쓴 주소는 기기에 기억한다(`localStorage` 키 `sci-bridge.classroom-host.v1`).
    - 이 키에는 주소 문자열만 둔다. 학생 정보는 넣지 않는다.
    - 기록장·맥박처럼 개인정보 문서 목록에 이 키를 적는다.
  - 웹(브라우저)에서는 지금 동작을 유지한다. 원하면 같은 입력칸을 보여 줘도 되지만, 기존 E2E 기대를 바꾸지 않는 쪽을 고른다.
- **안드로이드 평문 연결**
  - `capacitor.config.ts`에 `server.androidScheme: 'http'`를 둔다. 앱 출처가 `http://localhost`가 되어 `ws://` 혼합 콘텐츠 차단이 없어진다. `localhost`는 보안 문맥이라 카메라와 블루투스는 그대로 쓸 수 있다.
  - 사설망 평문 허용: `android/app/src/main/res/xml/network_security_config.xml`을 두고 매니페스트에서 연결한다.
    - 사설 IP 대역 전체를 도메인 단위로 허용하는 것은 안드로이드가 지원하지 않는다. 그래서 `base-config cleartextTrafficPermitted="true"`로 두고, 문서에 "교실 LAN 전용 앱"이라고 근거를 적는다.
  - 출처가 바뀌면 이미 설치된 앱의 `localStorage`(기록장)가 새 출처에서는 비어 보인다. 배포 전이라 받아들인다. `docs/app-packaging.md`에 적는다.

### 0.3 빌드와 CI
- 새 스크립트 `pnpm host:build`
  1. 교사 앱을 빌드한다.
  2. 서버와 호스트 진입점을 esbuild로 하나의 CJS로 묶는다. esbuild는 정확한 버전으로 고정한 devDependency로 둔다.
  3. SEA 설정의 `assets`에 교사 화면 파일들을 넣는다.
  4. `node --experimental-sea-config`로 blob을 만들고 `postject`(정확한 버전 고정)로 exe에 넣는다.
- 리눅스에서도 같은 스크립트가 리눅스 실행 파일을 만들 수 있어야 한다. 로컬 확인용이다.
- CI에 `windows-host` 작업(windows-latest)을 더한다.
  - `pnpm install` → `pnpm host:build`
  - **스모크 시험**: exe를 백그라운드로 실행하고, `http://localhost:8787/`에서 교사 화면 HTML을 받고, `ws://localhost:8787/ws`에 연결해 수업 만들기 응답을 받은 뒤 끈다.
  - 아티팩트 `windows-classroom-host`를 90일 보관한다.
  - Node 내려받기처럼 외부에서 받는 단계는 기존 Gradle처럼 재시도를 둔다.
- 안드로이드 APK는 기존 `android-build`의 디버그 APK를 그대로 쓴다. 바뀐 Capacitor 설정이 반영되어야 한다.

## 1. 테스트
- **단위 테스트**
  - 주소 입력 해석: IP만, IP:포트, ws://, wss://, 공백, 잘못된 값
  - 사설 IP 고르기(`os.networkInterfaces` 결과를 흉내 낸 입력)
  - `/host-info`는 localhost에만 응답한다.
  - 호스트 모드의 수업 만들기는 localhost에서만 된다(서버 테스트에 추가).
  - 교사 화면의 WebSocket 주소 결정 순서
- **E2E**
  - 기존 classroom.spec은 그대로 통과해야 한다.
  - 새 테스트: 호스트 진입점(빌드된 묶음 JS를 node로 실행)이 교사 화면을 내보낸다. 그 화면에서 수업을 만들고, 학생 화면은 "앱 모드"로 서버 주소를 입력해 참여한다. 앱 모드를 흉내 낼 수 있게 `?app=1` 같은 테스트용 플래그를 둔다.
  - 교사 화면에 주소와 QR이 보인다.
- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`가 모두 종료 코드 0이어야 하고, `pnpm tutor:validate`가 통과해야 한다. 이 환경에서 리눅스용 `pnpm host:build`가 성공해야 하고, 만든 실행 파일을 실행해 스모크 시험이 통과해야 한다.

## 2. 문서
- `docs/classroom.md`: 맨 앞에 "교사 PC에서 수업 서버 프로그램으로 하기"(가장 쉬운 방법) 절을 둔다. 다음을 쓴다.
  - 내려받기(GitHub Actions 아티팩트)
  - 실행
  - 방화벽 허용
  - 학생 앱에 주소 입력
  - 끝내기(창 닫기)
- `docs/app-packaging.md`: APK 받는 법(디버그 APK가 최종 산출물), `androidScheme` 변경과 평문 허용의 근거, 기록장 출처 변화
- README의 실행 방법
