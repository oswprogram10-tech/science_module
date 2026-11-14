import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAT_STOP, formatChat, type ChatFormat } from './chatFormat';
import { TUTOR_MODELS } from './models';
import { TUTOR_SYSTEM } from './context';

interface Golden {
  system: string;
  users: string[];
  formats: Record<ChatFormat, { repo: string; prompts: string[] }>;
}

const golden = JSON.parse(readFileSync(new URL('./__fixtures__/chatformat.golden.json', import.meta.url), 'utf8')) as Golden;

describe('formatChat: 실제 토크나이저 apply_chat_template 기준 문자열과 같다', () => {
  for (const format of Object.keys(golden.formats) as ChatFormat[]) {
    it(`${format} (${golden.formats[format].repo})`, () => {
      golden.users.forEach((user, i) => {
        expect(formatChat(format, golden.system, user), `입력 ${i}`).toBe(golden.formats[format].prompts[i]);
      });
    });
  }

  it('기준 문자열의 시스템 문장이 지금 TUTOR_SYSTEM과 같다(바뀌면 gen_chatformat.py를 다시 돌린다)', () => {
    expect(golden.system).toBe(TUTOR_SYSTEM);
  });

  it('모든 모델의 chatFormat에 기준 문자열이 있다', () => {
    for (const m of TUTOR_MODELS) expect(golden.formats[m.chatFormat], m.id).toBeDefined();
  });

  it('멈춤 문자열은 차례 끝을 포함한다', () => {
    expect(CHAT_STOP).toContain('<|im_end|>');
  });
});
