import { describe, expect, it } from 'vitest';
import { FOREIGN_SCRIPT_HIT, LATIN_WORD_HIT, MASK_ECHO_HIT, finalizeModelOutput, guardModelOutput, guardOutput, tidyTutorOutput } from './index';
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

describe('영어 낱말 섞임', () => {
  it('세 글자 이상 영어 낱말, 악센트 글자, 깨진 글자를 막고 단위·기호는 둔다', () => {
    for (const t of ['예측과 결과가 달랐군nings. 무엇이 다른가요?', '두 시행이 모두 same로 나왔어요. 숫자를 볼까요?', '아lâ이의 크기를 볼까요?', '물의 �yang 칸을 볼까요?']) {
      expect(guardModelOutput(t, { forbiddenAnswers: [], limits: [] }).hits, t).toContain(LATIN_WORD_HIT);
      expect(guardOutput(t, { forbiddenAnswers: [], limits: [] }).hits, `${t}: 화면 문구 가드에는 넣지 않는다`).not.toContain(LATIN_WORD_HIT);
    }
    for (const t of ['온도계 눈금이 22.0 °C였나요?', '10 mL와 5.0 g을 견주어 볼까요?', '렌즈 10 × 접안 배율은 얼마인가요?', '20 ÷ 4는 얼마인가요?', 'LED가 켜졌나요? 2 mW였나요?', 'N극과 S극 중 어느 쪽인가요?', 'AI 친구 말고 결과표를 볼까요?']) {
      expect(guardModelOutput(t, { forbiddenAnswers: [], limits: [] }).ok, t).toBe(true);
    }
  });
});

describe('finalizeModelOutput: 모델 출력 한 단계', () => {
  const exp = { limits: ['광합성'], tutor: { forbiddenAnswers: ['물이 있어야 싹이 트'] } };
  it('다듬은 뒤 검사한다', () => {
    expect(finalizeModelOutput('세 가지가 달라졌어요 칸을 볼까요? 무엇이 보이나요?', exp)).toEqual({ text: '세 가지가 달라졌어요. 칸을 볼까요?', ok: true, problems: [] });
    expect(finalizeModelOutput('모두 same로 나왔어요. 숫자를 볼까요?', exp).problems).toContain(`guard:${LATIN_WORD_HIT}`);
    expect(finalizeModelOutput('물이 있어야 싹이 트죠. 다음은 볼까요?', exp).ok).toBe(false);
  });
  it('정상 두 문장 답은 손대지 않는다', () => {
    expect(tidyTutorOutput('예측과 달랐네요.  그래프를 볼까요?')).toBe('예측과 달랐네요.  그래프를 볼까요?');
  });
});

describe('tidyTutorOutput: 세 문장 답 다듬기', () => {
  it('마침표 없이 이어 붙인 문장을 문장으로 세고, 다듬을 때 마침표를 찍는다', () => {
    expect(tidyTutorOutput('붕어 카드를 골랐고 아직 관찰은 없어요 기록 두 칸에는 무엇이 적혀 있나요? 어떤 기준으로 나누어 볼까요?')).toBe(
      '붕어 카드를 골랐고 아직 관찰은 없어요. 기록 두 칸에는 무엇이 적혀 있나요?',
    );
    expect(tidyTutorOutput('누른 횟수만 달랐어요 결과표의 두 숫자는 각각 어떤가요?')).toBe('누른 횟수만 달랐어요. 결과표의 두 숫자는 각각 어떤가요?');
  });

  it('첫 문장과 그 뒤 첫 질문만 남긴다', () => {
    expect(tidyTutorOutput('예측과 달랐네요. 그래프에서 두 시행을 비교해 볼까요? 어느 부분이 달라졌는지 찾아볼까요?')).toBe('예측과 달랐네요. 그래프에서 두 시행을 비교해 볼까요?');
    expect(tidyTutorOutput('춤추는 걸 좋아하는군요. 어떤 점이 좋았나요? 잎을 어떻게 나눌까요?')).toBe('춤추는 걸 좋아하는군요. 어떤 점이 좋았나요?');
    expect(tidyTutorOutput('무엇이 달라졌나요? 결과표를 볼까요? 그래프도 볼까요?')).toBe('무엇이 달라졌나요?');
  });
  it('두 문장 이하이거나 질문이 없으면 그대로 둔다', () => {
    expect(tidyTutorOutput(' 결과표를 볼까요? ')).toBe('결과표를 볼까요?');
    expect(tidyTutorOutput('하나. 둘. 셋.')).toBe('하나. 둘. 셋.');
  });
});
