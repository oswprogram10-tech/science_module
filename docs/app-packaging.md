# 앱 포장 (Capacitor)

Android 앱은 Capacitor로 만든다(결정 D1). 크롬북·Windows는 PWA다. 서명·스토어 제출·실기기 성능 측정은 아직 하지 않았다(사람과 실기기가 필요).

> **iOS·iPadOS 앱 지원은 취소했다(2026-11-09).** 네이티브 iOS 프로젝트, `@capacitor/ios`, CI의 iOS 빌드를 뺐다. iPad에서는 Safari로 웹판을 열 수 있지만, Safari는 Web Bluetooth를 지원하지 않아 실물 블루투스 센서(온도계·심박 센서)는 쓸 수 없다. 모의 센서와 모든 시뮬레이션은 그대로 된다. 다시 지원하려면 `npx cap add ios`로 프로젝트를 새로 만든다.

- 앱 ID: `kr.scibridge.student` — **가칭이다. 출시 전에 기관 도메인으로 바꾼다**(아래 "사람이 해야 할 일").
- 앱 이름: `Sci-Bridge ON`
- 설정: `apps/student/capacitor.config.ts` (webDir `dist`, `server.androidScheme: 'http'` — 아래 「교실 LAN 연결」)
- 버전: `@capacitor/core`·`cli`·`android` 8.5.3, `@capacitor-community/bluetooth-le` 8.3.0 (모두 정확히 고정)
- 네이티브 프로젝트는 저장소에 있다: `apps/student/android`. 빌드 결과물과 `cap sync`가 만드는 파일은 Capacitor가 만든 `.gitignore`가 거른다.
- 웹 빌드는 `base: './'`(상대 경로)다. 앱 안의 `capacitor://`·`http://localhost` 어디서든, 웹 배포에서도 같은 빌드가 열린다. 해시 라우팅(`#/unit/...`)은 그대로다.

## 빌드·실행

```bash
pnpm install
pnpm cap:sync          # 웹 빌드 후 android에 복사(= pnpm build && cap sync)
```

### Android (Android Studio 또는 명령줄)

필요: JDK 21, Android SDK(platform 36, build-tools). `ANDROID_HOME`을 지정하거나 `apps/student/android/local.properties`에 `sdk.dir=...`를 적는다(이 파일은 커밋하지 않는다).

```bash
pnpm android:debug     # apps/student/android 에서 ./gradlew assembleDebug
# APK: apps/student/android/app/build/outputs/apk/debug/app-debug.apk
adb install -r apps/student/android/app/build/outputs/apk/debug/app-debug.apk
```

기기에서 USB 디버깅을 켜고 `adb devices`에 보이는지 확인한 뒤 설치한다. Android Studio에서는 `apps/student/android`를 열어 실행해도 된다.

### CI

`.github/workflows/ci.yml`의 `android-build`(ubuntu)가 기존 작업과 병렬로 돈다. push할 때마다 설치 파일이 만들어져 GitHub Actions 실행 결과의 **Artifacts**에 90일 동안 남는다.

| 파일(아티팩트 이름) | 설치 가능 여부 |
|---|---|
| `android-debug-apk` (`app-debug.apk`) | **이번 단계의 최종 산출물(APK까지만 준비한다. 스토어 제출과 릴리스 서명은 하지 않는다).** **바로 설치 가능.** 디버그 키로 자동 서명되어 있다. zip을 풀어 APK를 기기로 옮기고, 설정에서 "출처를 알 수 없는 앱 설치 허용"을 켠 뒤 연다. 또는 `adb install app-debug.apk`. 스토어 배포용은 아니다(배포는 정식 키스토어로 서명한 release 빌드 필요). |

### APK 받는 법

1. GitHub 저장소의 **Actions** 탭에서 가장 최근의 `CI` 실행을 연다(초록색 확인 표시가 있는 것).
2. 맨 아래 **Artifacts**의 `android-debug-apk`를 내려받아 zip을 푼다(90일 동안 남는다).
3. `app-debug.apk`를 학생 기기로 옮겨 설치한다(위 표). 같은 기기에 이미 설치된 앱이 있고 서명 키가 다르면 먼저 지운다.
4. 교사 PC는 `docs/classroom.md`의 「교사 PC에서 수업 서버 프로그램으로 하기」를 따른다. 이 APK에서는 서버 주소를 빌드에 넣지 않아도 「수업 참여」가 보이고, 참여 대화 상자의 「선생님 PC 주소」에 교사 화면에 나온 주소를 쓴다.

## 교실 LAN 연결: `androidScheme: 'http'`와 평문(cleartext) 허용

학생 기기(APK)는 같은 무선망의 선생님 PC(`ws://192.168.x.x:8787/ws`)에 붙는다. 교실 PC에는 TLS 인증서가 없으므로 암호화하지 않은 `ws://`이다. 이를 위해 두 가지를 바꿨다.

1. **`server.androidScheme: 'http'`** (`apps/student/capacitor.config.ts`). Capacitor 8의 Android 기본 앱 출처는 `https://localhost`다. 보안 문맥(HTTPS)에서 `ws://`를 열면 WebView가 혼합 콘텐츠로 막는다. 출처를 `http://localhost`로 두면 막지 않는다. `localhost`는 브라우저 규칙상 보안 문맥이라 카메라(`getUserMedia`)와 블루투스는 그대로 쓸 수 있다.
2. **네트워크 보안 설정** (`android/app/src/main/res/xml/network_security_config.xml`, 매니페스트의 `android:networkSecurityConfig`로 연결). Android 9부터 앱은 평문 HTTP/WS를 기본으로 막는다. 이 설정이 `base-config cleartextTrafficPermitted="true"`로 평문을 허용한다. **사설 IP 대역(192.168/16, 10/8, 172.16/12) 전체만 허용하는 방법은 Android가 지원하지 않는다**(`domain-config`는 호스트 이름만 받고 IP 대역(CIDR)은 받지 않으며, 교사 PC의 주소는 DHCP로 바뀐다). 그래서 앱 전체에서 평문을 허용한다. 이것을 받아들이는 근거:
   - 이 앱은 **교실 LAN 전용**이다. 앱이 바깥으로 보내는 것은 수업 서버로 가는 진행 요약(수업 코드·모둠 번호·단원·단계·시행 수·안전 경고 종류 등)뿐이고, 이름·학번·튜터 대화·카메라 영상·센서 원자료는 보내지 않는다(`docs/classroom.md` 개인정보 원칙).
   - 평문을 허용해도 앱이 바깥으로 보내는 내용이 늘지 않는다. 이 허용은 연결 방식만 바꾼다. 앱에 새로 외부 서비스 호출을 더하면 그때마다 이 허용의 영향을 다시 따진다.
   - 인터넷에 여는 학교 서버는 `wss://`(TLS)를 쓰면 된다. 평문 허용은 `wss://`를 막지 않는다.
   - 스토어 배포 전(릴리스 서명 단계)에 이 허용을 다시 검토한다(사람이 해야 할 일에 추가).

### 앱 출처가 바뀐 영향 (기록장)

`androidScheme`를 `https`에서 `http`로 바꾸면 앱 출처가 `https://localhost`에서 `http://localhost`로 바뀌고, WebView의 `localStorage`는 출처별로 따로라서 **이미 설치된 앱의 탐구 기록장(`sci-bridge.logbook.v1`)이 새 출처에서는 비어 보인다**(데이터가 지워지는 것이 아니라 새 출처에서 보이지 않는다). 배포 전이라 받아들인다. 이미 시험 설치한 기기에서 기록장을 이어 쓰려는 경우는 없다고 보고, 필요하면 앱을 지우고 다시 설치한다.

## 권한 문구

| 플랫폼 | 항목 | 문구·설정 |
|---|---|---|
| Android | `CAMERA` | 산과 염기 색 판독기 |
| Android | `BLUETOOTH_SCAN`(`neverForLocation`), `BLUETOOTH_CONNECT` | API 31 이상 |
| Android | `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE_LOCATION`(`maxSdkVersion` 30) | API 30 이하 |

카메라·블루투스 하드웨어는 `uses-feature required=false`로 두어, 없는 기기에서도 설치된다.

## 카메라

산과 염기 색 판독기의 `getUserMedia`를 앱 안에서도 그대로 쓴다. Android는 Capacitor 기본 WebChromeClient가 권한 요청을 처리한다. 사진 파일을 고르는 대체 수단도 그대로 있다. **실기기 확인 필요.**

## 화면 방향·안전 영역

태블릿에서 가로·세로를 모두 허용한다(Capacitor 기본값 유지). 안전 영역은 기존 CSS가 처리하는지 실기기에서 확인한다. **실기기 확인 필요.**

## 아이콘·스플래시

지금은 Capacitor 기본 이미지다. 바꾸려면:

1. `apps/student/resources/icon.png`(1024×1024), `splash.png`(2732×2732)를 둔다.
2. `npx @capacitor/assets generate`로 android 이미지를 만든다(필요할 때 이 도구를 개발 의존성으로 추가한다).
3. 또는 `android/app/src/main/res/mipmap-*`를 직접 바꾼다.

## 사람이 해야 할 일

- Android 키스토어 만들기와 안전한 보관, 릴리스 서명 설정
- 스토어 배포 전에 평문(cleartext) 허용(위 「교실 LAN 연결」)을 다시 검토
- 교사 PC 프로그램(`SciBridgeON-수업서버.exe`)의 코드 서명(서명하지 않아 Windows SmartScreen 경고가 뜬다. 학교에 배포하려면 인증서를 사서 서명하거나 학교 IT가 허용 목록에 올린다)
- 앱 ID 확정(`kr.scibridge.student`를 기관 도메인으로 바꾸기: `capacitor.config.ts`, `android/app/build.gradle`의 `applicationId`·`namespace`와 `MainActivity` 패키지 경로)
- 스토어 아동 앱 정책 검토(Google Play 가족 정책, 개인정보 처리방침)
- MDM 배포 방법 정하기(학교·교육청 보유 관리 도구에 맞춰)
- 실기기 성능 측정(`docs/DEVICES.md`)

## 학생 심박 실측과 법무 검토 (H5)

5학년 「우리 몸의 구조와 기능」의 "내 맥박 재기(선택)"는 손목에서 센 맥박이나 블루투스 심박 센서(Heart Rate 서비스 `0x180D`, 특성 `0x2A37`)의 값을 학생 기기에서만 보여 준다.

- **심박은 민감정보이고, 만 14세 미만은 법정대리인 동의가 필요할 수 있다. 학교에 적용하기 전에 법무 검토가 필요하다.** (`docs/DEVELOPMENT_PLAN.md` D10)
- 실측값은 **기기 메모리에만** 둔다. 앱 종료, 단원 이탈, "지금 지우기", "그만두기"(허가 철회), 마지막 측정 뒤 30분 경과, `pagehide`에서 삭제한다. 저장소·서버·교사 화면·xAPI·콘솔·주소에는 쓰지 않는다.
- 허가는 앱이 켜져 있는 동안만 유효하다. 저장하지 않으므로 앱을 다시 켜면 다시 묻는다.
- Android는 시스템 권한 창에 앱이 정한 문구를 넣을 수 없다. 측정값을 기기 밖으로 보내지 않는다는 안내는 "내 맥박 재기" 동의 화면이 맡는다.

### 탐구 기록장과 학생이 쓴 글 (D11)

6학년 「과학과 나의 진로」는 앞 단원의 탐구 기록을 모으려고 기기 안 "탐구 기록장"을 쓴다. 심박(H5)과 달리 **저장소에 남는 기능**이다.

- **학생이 쓴 글(진로 탐색 카드의 직업·탐구 능력·"더 알아보고 싶은 것" 200자)이 기기에 남는다. 학교에 적용하기 전에 법무 검토가 필요하다.** (`docs/DEVELOPMENT_PLAN.md` D11)
- 기본은 꺼짐이다. 학생이 단원 목록 또는 진로 단원 안(1단계 "기록이 없어요" 안내, 4단계 저장 단추 옆)의 "기록장 켜기"에서 같은 안내 대화 상자("이 기기에만 남아요", "서버나 선생님 화면으로 보내지 않아요", "언제든 모두 지울 수 있어요", "같은 기기를 쓰는 친구가 볼 수 있어요")를 읽고 켠 뒤에만 기록한다. 꺼져 있으면 저장소에 빈 키도 만들지 않는다.
- `localStorage`의 `sci-bridge.logbook.v1` 한 곳에 JSON으로 둔다(200 KB 상한, 넘치면 오래된 항목부터 삭제). 단원 id·활동 종류·날짜(일)·짧은 요약과 진로 카드 글만 있고, 이름·가명 ID·교실 코드·시행별 값·튜터 대화·심박 실측값은 없다. 서버·교사 화면·xAPI에는 보내지 않는다.
- **같은 기기를 쓰는 다른 학생이 볼 수 있다.** 학교 공용 태블릿에는 학생별 계정이 없으므로 앱은 이를 막지 못한다. "모두 지우기"로 지울 수 있고, 앱 데이터를 지우면 함께 사라진다. 공용 기기의 반납·초기화 절차에 "탐구 기록장 지우기"를 넣는 것을 권한다.
- 앱(Capacitor)에서는 WebView의 `localStorage`라서 앱을 지우거나 앱 저장소를 비우면 사라지고, 기기 백업 정책에 따라 백업에 들어갈 수 있다. 교육청 MDM 정책과 개인정보 처리방침에 "학생이 직접 켠 경우에만 기기에 남는 학습 기록"을 적는다.

## 수업 서버 주소 (`localStorage`)

학생 앱(APK)은 참여 대화 상자의 「선생님 PC 주소」에 마지막으로 쓴 값을 `localStorage`의 `sci-bridge.classroom-host.v1`에 기억한다(앱을 다시 켜도 채워 주고, 새로고침 뒤 다시 참여할 때 쓴다).

- **값은 입력한 주소 문자열 하나뿐이다**(예: `192.168.0.10:8787`). 학생 이름·모둠 번호·수업 코드·기기 정보는 넣지 않는다. 탐구 기록장(`sci-bridge.logbook.v1`)·심박(저장하지 않음)과 별개이며, 서버·교사 화면으로 보내지 않는다.
- 이 주소는 학교 공용 태블릿에서 다음 학생이 볼 수 있는 값이지만 개인정보가 아니다(교실 LAN의 사설 주소). 앱 데이터를 지우면 사라진다.
- 웹(브라우저)은 이 입력칸을 보여 주지 않고 지금까지처럼 `?classroom=`·빌드 변수를 쓴다. 시험용으로 주소에 `?app=1`을 붙이면 웹에서도 앱 화면(입력칸)을 흉내 낸다(E2E가 쓴다).

학생 앱은 수업 중 교사가 보낸 튜터 질문 덧씌우기를 받지만 **메모리에만** 두고 `localStorage`·`sessionStorage`에 쓰지 않는다(수업에서 나오면 지운다). 교사 PC 쪽 저장(`sci-bridge.tutor-edits.v1`)은 `docs/classroom.md`의 「튜터 질문 고치기」를 본다.

## 실물 BLE 온도 센서 시험

시험 기능이다. 주소에 `?dev=1`을 붙이면 온도 센서가 있는 실험 화면의 센서 막대에 "실물 온도 센서 연결(시험)" 버튼과 센서 종류(표준 / micro:bit)가 나온다. 연결되면 가상 온도계 자리에 실측값과 "실물 센서" 배지가 보인다. **시뮬레이션 계산에는 쓰지 않는다.** 연결이 끊기면 마지막 값을 "끊김"과 함께 보이고, 자동 재연결은 1회만 시도한다.

- 웹(크롬북·웨일북·안드로이드 크롬): Web Bluetooth. HTTPS 또는 localhost에서만 동작한다. iPad·iPhone의 Safari는 지원하지 않는다.
- 앱(Android): `@capacitor-community/bluetooth-le`. 플러그인은 센서 연결을 처음 누를 때 불러온다.
- 지원: 표준 Environmental Sensing(서비스 `0x181A`, 온도 `0x2A6E`, sint16 little-endian, 0.01 °C), micro:bit 온도 서비스(`e95d6100-251d-470a-a062-fa1922dfa9a8` / `e95d9250-251d-470a-a062-fa1922dfa9a8`, sint8, °C).
- 제조사 프로토콜은 확보하면 같은 `BleTemperatureProfile` 모양으로 추가한다(결정 D7).

### micro:bit로 시험하기

1. micro:bit에 Bluetooth 온도 서비스(Temperature Service)가 들어간 펌웨어를 올린다. MakeCode에서 확장 "bluetooth"를 추가하고 `bluetooth start temperature service`를 시작 블록에 넣는다. 페어링은 "No Pairing Required" 모드로 둔다.
2. micro:bit가 `BBC micro:bit [xxxxx]`로 광고하는지 휴대전화 BLE 도구(nRF Connect 등)로 확인한다.
3. 앱 또는 크롬에서 `?dev=1`로 온도 센서가 있는 단원(예: 여러 가지 기체)을 열고, 센서 종류를 micro:bit로 고른 뒤 연결 버튼을 누른다.
4. 기기 목록에서 micro:bit를 고르면 몇 초 안에 실측값이 보여야 한다. micro:bit를 껐다 켜서 끊김 표시와 1회 재연결을 확인한다.
5. 표준 프로필은 ESS 온도 특성(0x2A6E)을 알리는 센서나 휴대전화 BLE 시뮬레이터 앱으로 시험한다.

안내 문구: 지원 안 함 "이 기기에서는 블루투스 센서를 쓸 수 없어요.", 권한 거부, 기기를 고르지 않음, 연결 실패는 각각 한국어 안내가 나온다.

**실기기 연결은 이 개발 환경에서 검증하지 못했다. 실기기 확인 필요.**
