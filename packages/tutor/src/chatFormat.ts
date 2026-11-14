/**
 * 튜터 모델 대화 형식(사양 docs/specs/tutor-on-device-v1.md §4.2).
 * 학습할 때 토크나이저의 apply_chat_template(system+user, add_generation_prompt=True)이 만든 문자열과 글자 하나까지 같아야 한다.
 * 기준 문자열은 __fixtures__/chatformat.golden.json(실제 토크나이저로 만든 것)이고 chatFormat.test.ts가 비교한다.
 */

export type ChatFormat = 'qwen3-nothink' | 'chatml';

/** 생성을 멈출 문자열(ChatML 차례 끝, 글 끝). */
export const CHAT_STOP: readonly string[] = ['<|im_end|>', '<|endoftext|>'];

/**
 * - qwen3-nothink: Qwen3 1.7B, 생각 모드를 끈 ChatML. 답 앞에 빈 생각 블록(`<think>\n\n</think>\n\n`)이 붙는다(enable_thinking=False).
 * - chatml: Qwen3 4B Instruct-2507, 생각 블록이 없는 ChatML.
 */
export function formatChat(format: ChatFormat, system: string, user: string): string {
  const head = `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;
  return format === 'qwen3-nothink' ? `${head}<think>\n\n</think>\n\n` : head;
}
