import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONSENT_POINTS, LogbookCard } from './LogbookCard';
import { UNAVAILABLE_TEXT } from './logbook';

describe('기록장 안내(켜기 전에 보여 주는 말)', () => {
  const text = CONSENT_POINTS.join('\n');
  it('다섯 가지를 쉬운 말로 알린다', () => {
    expect(CONSENT_POINTS).toHaveLength(5);
    expect(text).toContain('남기는 것');
    expect(text).toContain('이 기기에만 남아요');
    expect(text).toMatch(/서버나 선생님 화면으로 보내지 않아요/);
    expect(text).toContain('모두 지우기');
    expect(text).toMatch(/같은 기기를 쓰는 친구가 이 기록을 볼 수 있어요/);
  });
  it('이름·교실 코드·튜터 대화는 남기지 않는다고 거짓말하지 않는다(남긴다고 쓰지 않는다)', () => {
    expect(text).toContain('이름은 남기지 않아요');
    expect(text).not.toContain('심박');
  });
});

describe('기록장 카드(단원 목록)', () => {
  it('저장소가 없는 환경(서버 렌더)에서는 쓸 수 없다고 알리고 켜기 버튼을 그리지 않는다', () => {
    const html = renderToStaticMarkup(createElement(LogbookCard));
    expect(html).toContain('탐구 기록장');
    expect(html).toContain(UNAVAILABLE_TEXT);
    expect(html).not.toContain('기록장 켜기');
    expect(html).not.toContain('role="dialog"');
  });
});
