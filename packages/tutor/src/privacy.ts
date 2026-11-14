/**
 * 학생 말의 개인정보 가리기(계획서 §6.5 입력 쪽 가드레일).
 * 튜터 모델 입력에 넣기 전에 이름·학교·집·연락처를 자리표시로 바꾼다. 모델이 보지 못한 것은 되풀이할 수도 없다.
 * 학습과 추론이 모두 buildTutorInput을 거치므로 같은 규칙이 함께 적용된다.
 */

export const MASK = { name: '[이름]', school: '[학교]', home: '[사는 곳]', contact: '[연락처]' } as const;

const PHONE = /(?:\+?82[-\s.]?)?0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** "하늘초등학교", "별빛중학교", "햇살초"(뒤에 조사·띄어쓰기). 이름 부분은 한글 2~6자. */
const SCHOOL = /(?<![가-힣])[가-힣]{2,6}(?:초등학교|중학교|고등학교|학교)(?=[가-힣]{0,4}(?:[\s.,!?]|$))|(?<![가-힣])[가-힣]{2,6}초(?=(?:예요|이에요|에요|에서|에|는|를|의|이고|이야|야|\s|[.,!?]|$))/g;
/** "달빛아파트", "푸른빌라", "해님마을" 같은 사는 곳 이름. */
const HOME = /(?<![가-힣])[가-힣]{2,6}(?:아파트|빌라|맨션|타운)(?=[가-힣]{0,4}(?:[\s.,!?]|$))/g;
/** "저는 오지호이고", "나는 이서연이고", "내 이름은 정우진이고", "제 이름은 김하늘이에요" */
const SELF_NAME = /((?:^|[\s.,!?])(?:나는|저는|난|전|내 이름은|제 이름은|이름은)\s*)([가-힣]{2,4}?)(?=(?:이고|이에요|예요|입니다|이야|야|라고|이라고|이라고요|라고요)(?:[\s.,!?]|$|[가-힣]))/g;
/** "김 선생님", "박선생님"(성 한 글자). "담임 선생님", "과학 선생님"은 그대로 둔다. */
const TEACHER = /(?<![가-힣])([가-힣])\s?선생님/g;

export function maskPersonalInfo(text: string): string {
  return text
    .replace(EMAIL, MASK.contact)
    .replace(PHONE, MASK.contact)
    .replace(SCHOOL, MASK.school)
    .replace(HOME, MASK.home)
    .replace(SELF_NAME, (_m, pre: string) => `${pre}${MASK.name}`)
    .replace(TEACHER, `${MASK.name} 선생님`);
}

/** 튜터 출력에 한자·일본 글자가 섞였는가(기본 모델의 언어 섞임 버릇). */
export const hasForeignScript = (text: string): boolean => /[぀-ヿ㐀-䶿一-鿿豈-﫿]/u.test(text);

/** 단위·기호로 쓰는 로마자는 허용한다(°C의 C, g, mL, mW, LED 등. 두 글자 이하는 모두 허용). */
const LATIN_OK = new Set(['LED', 'BTB', 'mW', 'mL', 'cm', 'mm', 'kg', 'km']);

/**
 * 튜터 출력에 영어 낱말이 섞였거나 글자가 깨졌는가(기본 모델의 언어 섞임: "달랐군nings", "모두 same로", "레mon즙").
 * 세 글자 이상 로마자 낱말(허용 목록 밖), 악센트 붙은 로마자, 깨진 글자(U+FFFD)를 찾는다.
 */
export const hasLatinWord = (text: string): boolean =>
  text.includes('\uFFFD') || (text.match(/[A-Za-z\u00C0-\u00FF]+/g) ?? []).some((w) => /[\u00C0-\u00FF]/.test(w) || (w.length >= 3 && !LATIN_OK.has(w)));

/** 튜터 출력이 입력의 자리표시([이름] 등)를 되풀이하는가. */
export const echoesMask = (text: string): boolean => Object.values(MASK).some((m) => text.includes(m));
