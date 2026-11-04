import { describe, expect, it } from 'vitest';
import { parseManifest, type VariableExperiment } from '@sci/schema';
import solutionJson from '../../../content/units/g5-solution/manifest.json';
import { checkTutorResponse, hasPersonalInfo, splitSentences } from './check';

const exp = parseManifest(solutionJson).experiments[0] as VariableExperiment;
const check = (t: string) => checkTutorResponse(t, exp);

describe('checkTutorResponse', () => {
  it('좋은 탐침 질문은 통과한다', () => {
    expect(check('물의 온도만 바꾸었을 때 녹은 양은 각각 얼마인가요? 걸린 시간도 살펴볼까요?')).toEqual({ ok: true, problems: [] });
  });
  it('guard: 금지 구절과 제한 용어', () => {
    expect(check('온도가 높을수록 더 많이 녹아요. 이해했나요?').problems).toContain('guard:온도가 높을수록 더 많이 녹');
    expect(check('이온이 퍼지는 모습을 생각해 볼까요?').problems).toContain('guard:이온');
  });
  it('too-long: 세 문장, 120자 초과, 빈 문자열', () => {
    expect(check('조건이 같아요. 다시 해 볼까요? 왜 그럴까요?').problems).toContain('too-long');
    expect(check(`${'가'.repeat(121)}?`).problems).toContain('too-long');
    expect(check(`${'가'.repeat(119)}?`).problems).not.toContain('too-long');
    expect(check('').problems).toContain('too-long');
  });
  it('소수점의 점은 문장 끝이 아니다', () => {
    expect(splitSentences('녹은 양이 5.7 g이었나요? 28.5초는 어떤가요?')).toHaveLength(2);
    expect(check('녹은 양이 5.7 g이었나요? 28.5초는 어떤가요?').problems).not.toContain('too-long');
  });
  it('no-question', () => {
    expect(check('표를 다시 살펴보세요.').problems).toContain('no-question');
    expect(check('표를 보세요. 무엇이 달라졌나요?').problems).not.toContain('no-question');
  });
  it('judgment', () => {
    for (const w of ['정답', '틀렸', '맞았', '잘했어', '오답']) {
      expect(check(`${w}이에요. 다시 볼까요?`).problems, w).toContain('judgment');
    }
  });
  it('personal-info', () => {
    expect(check('010-1234-5678로 알려 줄래요?').problems).toContain('personal-info');
    expect(check('abc@example.com으로 보낼까요?').problems).toContain('personal-info');
    expect(hasPersonalInfo('28.5초 만에 17.9 g이 녹았어요')).toBe(false);
    expect(hasPersonalInfo('전화는 02 1234 5678')).toBe(true);
  });
});
