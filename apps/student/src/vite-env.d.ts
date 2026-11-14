/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLASSROOM_URL?: string;
  /** `?classroom=`로 받을 수 있는 서버 호스트(쉼표 구분). 개발 서버에서는 무시된다(모두 허용). */
  readonly VITE_CLASSROOM_ALLOWED_HOSTS?: string;
  /** `1`이면 튜터 칸 아래에 시험용 상태 표시(계획 종류·이유)를 보인다. CI의 안드로이드 debug APK 빌드에서만 켠다. */
  readonly VITE_TUTOR_DEBUG?: string;
}
