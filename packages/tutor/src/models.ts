/**
 * 기기에서 돌릴 튜터 예시 모델 목록(계획서 §6). 교사가 반 단위로 하나를 고른다.
 * 모델 파일(4비트 GGUF)은 앱에 넣지 않고 처음 한 번 내려받는다. 내려받기와 기기 실행은 다음 단계에서 붙인다.
 */

export type TutorModelId = 'hcx-seed-1.5b' | 'qwen3-1.7b';

export interface TutorModelInfo {
  id: TutorModelId;
  /** 화면에 보이는 이름 */
  name: string;
  maker: string;
  /** 미세조정한 원본 모델(Hugging Face) */
  base: string;
  license: string;
  /** 라이선스에서 지켜야 할 점(교사 화면에 그대로 보여 준다) */
  licenseNote: string;
  /** 4비트(Q4_K_M) 모델 파일 크기 추정, GB */
  sizeGb: number;
  /** 내려받을 수 있는가. 모델 파일을 둘 곳과 기기 실행이 준비되면 true로 바꾼다. */
  downloadReady: boolean;
}

export const TUTOR_MODELS: readonly TutorModelInfo[] = [
  {
    id: 'hcx-seed-1.5b',
    name: '하이퍼클로바 X SEED 1.5B',
    maker: '네이버',
    base: 'naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-1.5B',
    license: 'HyperCLOVA X SEED 모델 라이선스',
    licenseNote: '모델 이름과 라이선스를 표시해야 하고, 네이버와 경쟁하는 서비스에는 따로 허가가 필요해요. 정식 출시 전에 법무 확인을 거쳐요.',
    sizeGb: 1.13,
    downloadReady: false,
  },
  {
    id: 'qwen3-1.7b',
    name: 'Qwen3 1.7B',
    maker: '알리바바 Qwen',
    base: 'Qwen/Qwen3-1.7B',
    license: 'Apache 2.0',
    licenseNote: '라이선스 고지만 지키면 상업 이용과 배포에 제한이 없어요.',
    sizeGb: 1.11,
    downloadReady: false,
  },
];

export const isTutorModelId = (v: unknown): v is TutorModelId => TUTOR_MODELS.some((m) => m.id === v);
export const tutorModel = (id: TutorModelId): TutorModelInfo => TUTOR_MODELS.find((m) => m.id === id)!;
