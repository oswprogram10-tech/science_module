# 구현 사양: 튜터 모델 기기 실행 (3단계, v1)

> 근거: 계획서 §6(온디바이스 튜터), 2026-11-14 사용자 결정.
> - 모델 파일은 교사가 Kaggle 결과에서 받아 **교사 PC 수업 서버에 넣고**, 학생 기기는 **교실 와이파이로 교사 PC에서 받는다**(인터넷 서버 없음).
> - **안드로이드 먼저.** iPad·크롬북(WebGPU)은 다음.
> - 모델: 기본 **Qwen3 1.7B**(`qwen3-1.7b`), 고사양 **Qwen3 4B**(`qwen3-4b`). 하이퍼클로바는 이번에 뺀다.
> - llama.cpp는 **공식 저장소(ggml-org/llama.cpp) 소스를 고정한 태그로 CI에서 직접 빌드**한다(남이 빌드한 .so를 넣지 않는다).

## 0. 개인정보 원칙 (바꾸지 않는다)

- 학생 말, 실험 기록, 튜터 입력·출력은 **학생 기기 밖으로 나가지 않는다.** 수업 서버로 보내는 것은 기존 진행 요약(R3)과 모델 준비 상태(아래 `tutorModel`)뿐이다.
- 모델 파일은 학생 정보가 없다. 교사 PC에서 학생 기기로만 간다.

## 1. 모델 목록과 파일

- `@sci/tutor`의 `TUTOR_MODELS`(`packages/tutor/src/models.ts`)를 `qwen3-1.7b`(기본), `qwen3-4b`(고사양, `minTier: 'A'`)로 바꾼다. `hcx-seed-1.5b`는 뺀다.
- 파일 형식은 4비트 GGUF(`Q4_K_M`). 파일 이름은 `<모델 id>.gguf`.
- 모델 정보에 `promptVersion: 'v3'`, `chatFormat`(아래 4.2), `suppressTokenIds`(한자·일본 글자 토큰, Kaggle `suppress-token-ids.json`) 경로를 둔다.

## 2. 교사 PC 수업 서버 (3b, `apps/classroom-host`, `apps/server`)

### 2.1 모델 파일 보관
- 폴더: 환경 변수 `TUTOR_MODEL_DIR`, 없으면 실행 파일 옆 `tutor-models/`.
- 넣는 법 두 가지:
  1. 교사 화면에서 파일 고르기 → `POST /tutor-models/:id`(이 PC=localhost에서만, 본문은 파일 그대로 스트리밍). 서버가 디스크에 쓰면서 sha256을 계산하고, 앞 4바이트가 `GGUF`인지, 크기가 4 GiB 이하인지 본다. 다 받으면 `<id>.json`(`{ id, size, sha256, addedAt }`)을 쓴다. 실패하면 임시 파일을 지운다.
  2. 폴더에 `<id>.gguf`를 직접 복사. 서버가 켜질 때 `.json`이 없거나 크기가 다르면 sha256을 다시 계산한다.
- `id`는 `TUTOR_MODELS`에 있는 것만 받는다.

### 2.2 내려주기
- `GET /tutor-models` → `[{ id, size, sha256 }]`(있는 것만).
- `GET /tutor-models/:id.gguf` → 파일. **Range 요청을 지원**한다(끊긴 내려받기 이어 받기). `content-length`, `accept-ranges: bytes`.
- 이 경로들은 교실 LAN 누구나 읽을 수 있다(모델 파일에는 학생 정보가 없다). 쓰기(POST)는 localhost만.

### 2.3 수업 메시지 (`packages/classroom/src/protocol.ts`)
- 교사 → 서버: `{ t: 'tutorModel', model: { id, sha256, size } | null }`. 기존 `tutor`(질문 덧씌우기)처럼 수업을 만들거나 다시 연결할 때, 바꿀 때마다 보낸다. 서버는 수업별로 기억한다.
- 서버 → 학생: 같은 모양의 `tutorModel` 메시지. 참여할 때와 바뀔 때 보낸다.
- 학생 → 서버 `status`에 `model: 'none' | 'downloading' | 'ready' | 'error'`(선택 필드)를 더한다. 교사 대시보드 모둠 카드에 작게 보여 준다("튜터 모델 준비됨" 등).

### 2.4 교사 화면 (`apps/teacher`)
- 「튜터 모델 고르기」의 「모델 내려받기(준비 중)」 자리에, 수업 서버가 내보낸 화면일 때만 **「모델 파일 넣기」**(파일 고르기 + 진행률 + sha256 표시)와 **이 PC에 있는 모델 목록**을 보인다.
- 고른 모델(`ModelChoice.model`) 파일이 이 PC에 있으면 수업에 `tutorModel`을 보낸다. 없으면 보내지 않고 "이 PC에 모델 파일이 없어요"를 보여 준다.

## 3. 학생 앱 내려받기 (3b, `apps/student`)

- 수업에 참여해 `tutorModel`을 받으면, 기기 등급(`tier`)이 모델의 `minTier` 이상일 때만 교사 PC 주소에서 `/tutor-models/<id>.gguf`를 **앱 전용 저장소**에 받는다. 이미 같은 sha256 파일이 있으면 받지 않는다.
- 진행률을 수업 참여 화면에 작게 보여 준다. 받은 뒤 sha256이 다르면 지우고 `error`.
- 받기는 네이티브 플러그인 `TutorLlm.download`로 한다(아래 4.1). 웹(브라우저)에서는 받지 않는다(기존 기본 질문만 쓴다).

## 4. 안드로이드 실행 (3c)

### 4.1 Capacitor 플러그인 `TutorLlm` (인터페이스: `apps/student/src/tutor/llmPlugin.ts`)
```ts
download({ url, sha256, file }): Promise<{ ok: boolean; size: number }>   // 'progress' 이벤트 { file, received, total }
fileInfo({ file }): Promise<{ exists: boolean; size: number; sha256?: string }>
remove({ file }): Promise<void>
load({ file, nCtx, nThreads }): Promise<{ ok: boolean; loadMs: number }>
generate({ prompt, maxTokens, stop, suppressTokenIds }): Promise<{ text: string; firstTokenMs: number; tokensPerSec: number; tokens: number }>
unload(): Promise<void>
```
- `prompt`는 대화 형식까지 입힌 완성 문자열이다(4.2). 샘플링은 탐욕(greedy), `suppressTokenIds`는 로짓 -무한대.
- 비전 모델과 동시에 메모리에 올리지 않는다(계획서 ⑦). 실험 화면을 떠나면 `unload`.

### 4.2 대화 형식 (`packages/tutor/src/chatFormat.ts`)
- 학습과 같은 형식을 TS로 만든다. Qwen3 1.7B는 생각 모드를 끈 ChatML(`<|im_start|>assistant\n<think>\n\n</think>\n\n`), Qwen3 4B Instruct-2507은 생각 블록이 없는 ChatML.
- 실제 토크나이저의 `apply_chat_template` 출력과 글자 하나까지 같은지 시험한다(기준 문자열을 저장소에 둔다).

### 4.3 네이티브 빌드
- `apps/student/android/app/src/main/cpp/`에 JNI 코드, CMake가 `FetchContent`로 llama.cpp 고정 태그 소스를 받아 빌드한다. ABI는 `arm64-v8a`(+ 에뮬레이터 확인용 `x86_64`).
- CI 안드로이드 빌드에서 NDK를 쓴다(러너 기본 NDK, 버전 고정).

### 4.4 튜터 연결 (`apps/student`)
- 실험 화면의 튜터 말풍선: 모델이 준비되어 있고 학생이 말했거나 새 상황이 되면 `buildTutorInput(…, previousTutor=마지막으로 보여 준 튜터 문장)` → 대화 형식 → `generate` → `finalizeModelOutput`. `ok`가 false거나 3초 안에 첫 토큰이 없으면 지금처럼 기본 질문(`selectProbe`)을 보인다.
- 학생 말 입력 칸(짧은 글, 120자)을 튜터 말풍선 아래에 둔다. 입력은 기기 안에서만 쓰고 저장하지 않는다(앱을 닫으면 사라짐).

## 5. 확인

- 서버: 업로드(localhost만, GGUF 머리, 크기 제한, sha256), 목록, Range 내려받기 단위 시험.
- 프로토콜: 새 메시지·필드 스키마 시험, 교사·학생 E2E(모델 고르기 → 학생이 받기 시작).
- 대화 형식: 실제 토크나이저 기준 문자열과 일치.
- 네이티브: CI에서 APK 빌드. 컨테이너 x86_64에서 llama.cpp CLI로 같은 GGUF 속도를 대략 잰다. 실제 태블릿 속도(첫 토큰 1초, 초당 8토큰)는 교사·연구자가 기준 기기에서 잰다.
