/**
 * 기기에서 돌릴 튜터 예시 모델 목록(계획서 §6). 교사가 반 단위로 하나를 고른다.
 * 모델 파일(4비트 GGUF)은 앱에 넣지 않고 처음 한 번 내려받는다. 내려받기와 기기 실행은 다음 단계에서 붙인다.
 */

export type TutorModelId = 'qwen3-1.7b' | 'qwen3-4b';
export type DeviceTier = 'A' | 'B' | 'C';

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
  /** 이 등급 이상의 기기에서만 받아 쓴다(계획서 ⑦: A가 가장 높음). */
  minTier: DeviceTier;
  /** 학습할 때 쓴 대화 형식(chatFormat.ts). */
  chatFormat: 'qwen3-nothink' | 'chatml';
  /** 학습한 입력 형식(PROMPT_VERSION). 다르면 쓰지 않는다. */
  promptVersion: string;
  /** 내려받기·기기 실행이 준비되었는가(3단계, 사양 docs/specs/tutor-on-device-v1.md). */
  downloadReady: boolean;
}

export const TUTOR_MODELS: readonly TutorModelInfo[] = [
  {
    id: 'qwen3-1.7b',
    name: 'Qwen3 1.7B',
    maker: '알리바바 Qwen',
    base: 'Qwen/Qwen3-1.7B',
    license: 'Apache 2.0',
    licenseNote: '라이선스 고지만 지키면 상업 이용과 배포에 제한이 없어요.',
    sizeGb: 1.11,
    minTier: 'B',
    chatFormat: 'qwen3-nothink',
    promptVersion: 'v3',
    downloadReady: false,
  },
  {
    id: 'qwen3-4b',
    name: 'Qwen3 4B (고사양 기기용)',
    maker: '알리바바 Qwen',
    base: 'Qwen/Qwen3-4B-Instruct-2507',
    license: 'Apache 2.0',
    licenseNote: '라이선스 고지만 지키면 상업 이용과 배포에 제한이 없어요. 고사양(A등급) 기기에서만 받아요.',
    sizeGb: 2.5,
    minTier: 'A',
    chatFormat: 'chatml',
    promptVersion: 'v3',
    downloadReady: false,
  },
];

const TIER_RANK: Record<DeviceTier, number> = { A: 3, B: 2, C: 1 };
/** 이 기기 등급에서 이 모델을 쓸 수 있는가. */
export const tierAllows = (tier: DeviceTier, model: TutorModelInfo): boolean => TIER_RANK[tier] >= TIER_RANK[model.minTier];

export const isTutorModelId = (v: unknown): v is TutorModelId => TUTOR_MODELS.some((m) => m.id === v);
export const tutorModel = (id: TutorModelId): TutorModelInfo => TUTOR_MODELS.find((m) => m.id === id)!;
