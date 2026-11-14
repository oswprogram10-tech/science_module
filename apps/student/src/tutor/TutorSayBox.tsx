import { useId, useState } from 'react';

export const MAX_SAY_CHARS = 120;

/**
 * 튜터 말풍선 아래의 "선생님 튜터에게 말하기" 입력 칸(사양 §4.4).
 * 입력은 이 화면 메모리에서만 쓰고(다음 질문 만들기에 한 번 쓰고 비운다) 저장하거나 어디로도 보내지 않는다. 앱을 닫으면 사라진다.
 */
export function TutorSayBox({ onSend }: { onSend: (text: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const send = () => {
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft('');
  };
  return (
    <form
      className="tutor-say"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor={id}>선생님 튜터에게 말하기</label>
      <div className="tutor-say-row">
        <input
          id={id}
          type="text"
          value={draft}
          maxLength={MAX_SAY_CHARS}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="궁금한 것이나 생각을 짧게 적어요"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()}>
          보내기
        </button>
      </div>
    </form>
  );
}
