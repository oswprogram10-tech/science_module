export type JosaPair = '을/를' | '이/가' | '와/과' | '은/는';

/** 마지막 글자가 한글 음절이면 받침 여부, 아니면 null. */
function hasBatchim(word: string): boolean | null {
  const trimmed = word.trimEnd();
  if (!trimmed) return null;
  const code = trimmed.charCodeAt(trimmed.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 낱말 뒤에 붙일 조사를 돌려준다(조사만 반환).
 * 마지막 글자가 한글이 아니면 괄호형(예: "을(를)")을 돌려준다.
 */
export function josa(word: string, pair: JosaPair): string {
  const [withBatchim, without] = pair.split('/') as [string, string];
  const b = hasBatchim(word);
  if (b === null) return `${withBatchim}(${without})`;
  // 와/과는 받침 있으면 "과", 없으면 "와"이므로 쌍의 순서가 반대다.
  if (pair === '와/과') return b ? '과' : '와';
  return b ? withBatchim : without;
}
