import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 괄호형 조사(을(를)·이(가) 등)는 실행 중에 채워지는 자리({iv}, {changed} 등) 뒤에만 쓴다.
// 고정된 낱말 뒤에는 받침에 맞는 조사를 바로 써야 학생 화면에 "습도이(가)"처럼 어색하게 나오지 않는다.
const CONTENT_DIR = join(__dirname, '../../../content/units');
const DUAL = /([가-힣])(이\(가\)|을\(를\)|은\(는\)|와\(과\)|과\(와\))/g;

describe('매니페스트 조사', () => {
  it('고정된 한글 낱말 뒤에 괄호형 조사를 쓰지 않는다', () => {
    const found: string[] = [];
    for (const unit of readdirSync(CONTENT_DIR)) {
      const text = readFileSync(join(CONTENT_DIR, unit, 'manifest.json'), 'utf8');
      for (const m of text.matchAll(DUAL)) found.push(`${unit}: …${text.slice(Math.max(0, m.index! - 8), m.index! + m[0].length)}`);
    }
    expect(found).toEqual([]);
  });
});
