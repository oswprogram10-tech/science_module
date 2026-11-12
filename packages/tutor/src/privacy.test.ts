import { describe, expect, it } from 'vitest';
import { FOREIGN_SCRIPT_HIT, MASK_ECHO_HIT, guardOutput } from './index';
import { echoesMask, hasForeignScript, maskPersonalInfo } from './privacy';

describe('maskPersonalInfo: 학생 말의 개인정보 가리기', () => {
  it('이름·학교·사는 곳·연락처를 자리표시로 바꾼다', () => {
    const cases: [string, string][] = [
      ['나는 이서연이고 우리 학교 이름은 하늘초등학교예요.', '나는 [이름]이고 우리 학교 이름은 [학교]예요.'],
      ['저는 오지호이고 별빛초등학교에 다녀요.', '저는 [이름]이고 [학교]에 다녀요.'],
      ['저는 문서현이고 우리 집은 달빛아파트예요.', '저는 [이름]이고 우리 집은 [사는 곳]예요.'],
      ['저는 정하윤이고 우리 학교는 햇살초예요.', '저는 [이름]이고 우리 학교는 [학교]예요.'],
      ['저는 한서진이고 학교는 새별초 6학년이에요.', '저는 [이름]이고 학교는 [학교] 6학년이에요.'],
      ['내 이름은 정우진이고 우리 학교는 한빛초등학교예요.', '내 이름은 [이름]이고 우리 학교는 [학교]예요.'],
      ['김 선생님이 그랬어요.', '[이름] 선생님이 그랬어요.'],
      ['엄마 번호는 010-1234-5678이에요.', '엄마 번호는 [연락처]이에요.'],
      ['메일은 kid@example.com 이에요', '메일은 [연락처] 이에요'],
    ];
    for (const [input, out] of cases) expect(maskPersonalInfo(input), input).toBe(out);
  });
  it('실험 이야기는 그대로 둔다', () => {
    for (const t of [
      '물을 많이 넣으면 소금이 더 녹아요.',
      '저는 궁금해요. 왜 그런가요?',
      '담임 선생님이 해 보라고 했어요.',
      '과학 선생님께 물어볼래요.',
      '3초 뒤에 다시 볼게요.',
      '학교에서 해 봤어요.',
      '이름은 몰라요.',
      '',
    ]) {
      expect(maskPersonalInfo(t), t).toBe(t);
    }
  });
});

describe('출력 가드: 한자·일본 글자와 개인정보 자리표시', () => {
  const g = { forbiddenAnswers: [], limits: [] };
  it('한자·일본 글자가 섞이면 막는다', () => {
    for (const t of ['무엇이变了했나요?', '알코ール 온도계를 볼까요?', '반的同学이 볼까요?']) {
      expect(hasForeignScript(t), t).toBe(true);
      expect(guardOutput(t, g).hits, t).toContain(FOREIGN_SCRIPT_HIT);
    }
    expect(guardOutput('결과표에서 °C 눈금을 읽어 볼까요?', g).ok).toBe(true);
  });
  it('입력의 자리표시를 되풀이하면 막는다', () => {
    expect(echoesMask('[이름] 친구, 결과표를 볼까요?')).toBe(true);
    expect(guardOutput('[학교]에서도 해 봤나요?', g).hits).toContain(MASK_ECHO_HIT);
    expect(guardOutput('결과표를 다시 볼까요?', g).ok).toBe(true);
  });
});
