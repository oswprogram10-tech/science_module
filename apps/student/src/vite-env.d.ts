/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLASSROOM_URL?: string;
  /** `?classroom=`로 받을 수 있는 서버 호스트(쉼표 구분). 개발 서버에서는 무시된다(모두 허용). */
  readonly VITE_CLASSROOM_ALLOWED_HOSTS?: string;
}
