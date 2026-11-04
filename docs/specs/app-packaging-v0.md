# 구현 사양: 기준 기기 정의와 앱 포장 (v0)

> 근거: `docs/DEVELOPMENT_PLAN.md` 결정 D1(Capacitor 앱: iPadOS·Android, 크롬북·Windows는 PWA), D2(성능 KPI), §4.2 ⑦(저사양 폴백), §7.0(기준 기기 확정, 스파이크 S1·S3), D7(센서 프로토콜 미확보 시 micro:bit 등 대체).
> 이번 범위: **기준 기기 문서와 기기 등급 판정, Capacitor 앱 프로젝트(iOS·Android), 실물 BLE 온도 센서 드라이버(시험 기능), CI 앱 빌드**. 서명·스토어 제출·실기기 성능 측정은 범위 밖이다(사람과 실기기가 필요).

## 1. 기준 기기 (초안, `docs/DEVICES.md`)

국내 학교 보급 기기 유형을 기준으로 정한 **초안**이다. 학교·교육청의 실제 보유 기기 목록이 나오면 그 목록으로 바꾼다. 문서 맨 위에 이 사실을 적는다.

| 등급 | 뜻 | 대표 기기 유형(예) | 이 등급에서 켜는 기능 |
|---|---|---|---|
| A | 여유 | iPad Air(M1 이상), 갤럭시 탭 S 시리즈(최근 3년), 메모리 8 GB 이상 크롬북 | 모든 기능. 미시 화면 알갱이 최대치, 향후 3B급 튜터 모델 |
| B | 기준 | 보급형 iPad(9·10세대), 갤럭시 탭 S FE·중급형, 메모리 4~8 GB 크롬북·웨일북 | 모든 기능, 알갱이 수 70%. 향후 1B급 튜터 모델 |
| C | 저사양 | 보급형 안드로이드 태블릿(메모리 3~4 GB), 오래된 크롬북 | 알갱이 수 40%, 장식 애니메이션 끔. 향후 튜터는 규칙 기반만 |

- **측정 대상 KPI**(D2, 실기기에서 측정): 시뮬레이션 렌더링 60fps(기준 B), 비전 추론 초당 5회 이상, 안전 경고 지연 1초 이내, BLE 페어링~첫 데이터 1.5초 이내.
- **측정 절차 초안**: 단원별 E2E 흐름을 실기기에서 돌리며 프레임 시간을 기록한다. `?dev=1` 패널에 측정값을 보여 주는 것은 다음 버전이다.
- 웨일북(네이버 웨일 OS)은 크롬 계열이라 PWA와 Web Bluetooth를 크롬북과 같이 다룬다고 가정한다. **실기기 확인 필요**로 표시한다.

### 1.1 기기 등급 판정 (`apps/student/src/platform/deviceTier.ts`)

- 순수 함수 `classifyDevice(signals) → { tier: 'A'|'B'|'C', reasons: string[] }`.
  - 입력 신호: `{ memoryGb?: number, cores?: number, webgpu: boolean, platform: 'ios'|'android'|'web', reducedMotion: boolean }`
  - 규칙: memoryGb ≤ 4 또는 cores ≤ 4이면 C. memoryGb ≥ 8이고 cores ≥ 8이면 A. 그 밖은 B. 신호가 없으면 B. reducedMotion은 등급을 바꾸지 않고 reasons에만 남긴다.
  - iOS 웹뷰는 deviceMemory가 없으므로 B로 둔다(초안).
- `readDeviceSignals()`: 브라우저와 Capacitor에서 위 신호를 읽는다(`navigator.deviceMemory`, `hardwareConcurrency`, `'gpu' in navigator`, `Capacitor.getPlatform()`).
- 반영(이번 버전): 등급을 React context로 내려 준다.
  - 미시 화면 알갱이 수 상한에 배율(A 1, B 0.7, C 0.4)을 곱한다. 용해 알갱이, 기체·연소 알갱이에 적용하고, 돋보기 모자이크처럼 실제 크기를 뜻하는 그림에는 적용하지 않는다.
  - URL `?tier=A|B|C`로 강제할 수 있다(테스트·시연용).
  - `?dev=1` 패널에 "기기 등급 B (메모리 4 GB, 코어 8)"를 보여 준다.
- 기존 E2E와 수치 단언은 바뀌지 않아야 한다. E2E 환경은 등급 A 또는 B로 판정되겠지만, 알갱이 수를 단언하는 테스트가 있으면 `?tier=A`로 고정한다.

## 2. Capacitor 앱 (`apps/student`)

### 2.1 버전과 설정

- 버전(2주 이상 지난 것으로 고정):
  - `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`: **8.5.3**
  - `@capacitor-community/bluetooth-le`: **8.3.0**
- `capacitor.config.ts`:
  - appId `kr.scibridge.student`(가칭, 출시 전 기관 도메인으로 바꾸도록 문서에 표시)
  - appName `Sci-Bridge ON`, webDir `dist`
  - 앱 안에서는 http 대신 앱 스킴으로 연다(기본값 유지).
- 해시 라우팅(`#/unit/...`)은 그대로 동작해야 한다.
- 웹 빌드는 상대 경로 기준이어야 한다(`base: './'` 필요 여부 확인). 이때 E2E·PWA 동작이 바뀌면 보고한다.

### 2.2 네이티브 프로젝트 (`apps/student/android`, `apps/student/ios`, 저장소에 커밋)

- `npx cap add android`, `npx cap add ios`. iOS는 리눅스에서 CocoaPods를 쓸 수 없으므로 Capacitor 8의 Swift Package Manager 방식으로 만든다.
- **권한 문구(한국어)**:
  - iOS `Info.plist`
    - `NSCameraUsageDescription`: "지시약 색을 읽으려고 카메라를 사용해요. 사진은 기기 밖으로 보내지 않아요."
    - `NSBluetoothAlwaysUsageDescription`: "실험용 온도 센서와 연결하려고 블루투스를 사용해요."
  - Android `AndroidManifest.xml`
    - `CAMERA`
    - `BLUETOOTH_SCAN`(`usesPermissionFlags="neverForLocation"`), `BLUETOOTH_CONNECT`
    - API 30 이하용 `BLUETOOTH`·`BLUETOOTH_ADMIN`·`ACCESS_FINE_LOCATION`(maxSdkVersion 30)
- 화면 방향은 태블릿 가로·세로 모두 허용한다. 안전 영역은 기존 CSS로 처리되는지 확인한다.
- 앱 아이콘·스플래시는 기본값을 두고, 교체 방법을 문서에 적는다.
- **스크립트**:
  - `apps/student`에 `cap:sync`(`pnpm build && cap sync`), `android:debug`(gradle assembleDebug), `ios:sim`(xcodebuild 시뮬레이터 빌드)
  - 루트에 같은 이름의 위임 스크립트

### 2.3 카메라

- 산과 염기 색 판독기의 `getUserMedia`가 앱 안에서도 쓰이도록 확인한다.
  - iOS WKWebView는 iOS 14.3 이상에서 지원한다.
  - Android는 Capacitor 기본 WebChromeClient가 권한 요청을 처리한다.
- 코드에서 할 일이 있으면 최소로 한다. 사진 파일 경로(대체 수단)는 그대로 둔다.

## 3. 실물 BLE 온도 센서 드라이버 (`@sci/sensors`, 시험 기능)

D7에 따라 제조사 프로토콜을 확보하기 전에도 시험할 수 있는 **표준·공개 프로필**부터 지원한다.

- **`BleTransport` 인터페이스**: `requestDevice(filters)`, `connect()`, `startNotifications(service, characteristic, onValue: (DataView) => void)`, `disconnect()`, `onDisconnect(cb)`.
  - `WebBluetoothTransport`: `navigator.bluetooth` 사용(크롬북·웨일북·안드로이드 크롬).
  - `CapacitorBleTransport`: `@capacitor-community/bluetooth-le` 사용(iOS·Android 앱). 앱 코드에서만 import해 웹 번들에 플러그인이 강제로 들어가지 않게 한다. 동적 import도 괜찮다.
  - `pickTransport()`: 앱이면 Capacitor, 아니고 `navigator.bluetooth`가 있으면 Web, 둘 다 없으면 null.
- **프로필**(순수 파서, 단위 테스트):
  - `ess-temperature`: 표준 Environmental Sensing 서비스 `0x181A`, Temperature 특성 `0x2A6E`. sint16 little-endian, 0.01 °C 단위.
  - `microbit-temperature`: 서비스 `e95d6100-251d-470a-a062-fa1922dfa9a8`, 특성 `e95d9250-251d-470a-a062-fa1922dfa9a8`. sint8, °C 단위.
- **`BleTemperatureDriver(transport, profile)`**: 기존 `SensorDriver` 인터페이스를 구현한다(`kind: 'temperature'`, 단위 °C, 소수 첫째 자리).
  - 끊김 처리: 연결이 끊기면 read()는 마지막 값과 함께 `stale: true`를 주고, 자동 재연결은 1회만 시도한다.
  - 단위 테스트는 가짜 transport로 연결, 값 수신, 끊김, 재연결 1회를 확인한다.
- **화면(시험 기능)**:
  - `?dev=1`일 때만 센서 막대에 "실물 온도 센서 연결(시험)" 버튼과 프로필 선택(표준 / micro:bit)을 보여 준다.
  - 연결되면 그 실험 화면의 가상 온도계 대신 실측값을 표시하고 "실물 센서" 배지를 붙인다. 시뮬레이션 계산에는 쓰지 않는다. 실측값을 실험 조건과 섞으면 수업 설계가 바뀌므로 이번에는 표시만 한다.
  - 연결 실패·권한 거부·지원 안 함은 한국어 안내로 처리한다. 예: "이 기기에서는 블루투스 센서를 쓸 수 없어요."
- 실기기 연결은 이 환경에서 검증할 수 없다. 문서에 "실기기 확인 필요"로 남긴다.

## 4. CI 앱 빌드 (`.github/workflows/ci.yml`에 작업 추가)

| 작업 | 실행 환경 | 단계 |
|---|---|---|
| `android-build` | ubuntu-latest | setup-java(temurin 21) → pnpm 설치 → `pnpm --filter student build` → `npx cap sync android` → `./gradlew assembleDebug`. APK를 아티팩트로 7일 보관한다. |
| `ios-build` | macos-latest | pnpm 설치 → 빌드 → `npx cap sync ios` → `xcodebuild -scheme App -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO` |

- GitHub 러너의 Android SDK와 Xcode를 쓴다. 두 작업은 기존 작업과 병렬로 돈다.
- 로컬(리눅스)에서는 Android SDK가 없을 수 있다. 가능하면 commandline-tools를 설치해 로컬에서 assembleDebug를 한 번 돌려 보고, 안 되면 CI 결과로 검증한다.

## 5. 문서

- `docs/DEVICES.md`: §1 내용. 등급 판정 규칙, 실기기 측정 계획, "초안" 표시를 담는다.
- `docs/app-packaging.md`(한국어):
  - 앱 빌드·실행 방법: 안드로이드 기기 설치(adb), iOS 시뮬레이터·실기기(Xcode)
  - 사람이 해야 할 일 목록: Apple Developer 계정, 서명 인증서, Android 키스토어, 앱 ID 확정, 스토어 아동 앱 정책 검토, MDM 배포
  - 권한 문구
  - BLE 시험 방법(micro:bit 온도 서비스 펌웨어 준비 등)
- 계획서 §1 의사결정 기록에 D8 한 줄: "기준 기기 초안(A/B/C 등급)과 앱 포장 v0. 실제 보유 기기 목록으로 갱신 필요".

## 6. 검증

- `pnpm typecheck && pnpm test && pnpm build && pnpm e2e` 모두 종료 코드 0. 기존 기대값은 바꾸지 않는다.
- 새 단위 테스트:
  - classifyDevice 경계값
  - 프로필 파서: ESS 음수·소수, micro:bit 음수
  - BleTemperatureDriver(가짜 transport)
  - pickTransport 분기
  - 알갱이 배율이 등급별로 적용되고, 실제 크기 그림에는 적용되지 않음
- 새 E2E:
  - `?tier=C`면 미시 화면 알갱이 수가 줄어든다(aria-label 또는 data 속성으로 확인).
  - `?dev=1`에 기기 등급 표시가 나온다.
  - 웹(Playwright 크로미움)에서 BLE 버튼을 누르면 Web Bluetooth가 없거나 거부될 때의 안내가 나온다. 크로미움 헤드리스에서 `navigator.bluetooth`가 있어도 기기 선택이 실패하므로 그 경로를 확인한다.
- `npx cap sync`가 로컬에서 성공한다. CI의 android-build·ios-build 결과는 push 뒤 확인한다.
