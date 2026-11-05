import { deflateSync } from 'node:zlib';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

/** 모든 spec이 쓰는 fixture: pageerror와 console.error를 모아 테스트 끝에서 하나도 없는지 확인한다. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
      });
      await use(errors);
      expect(errors, '페이지 오류/콘솔 오류가 없어야 해요').toEqual([]);
    },
    { auto: true },
  ],
});

/** 단원 화면으로 간다. playback은 기본 0.3초(빠른 재생). */
export async function gotoUnit(page: Page, id: string, opts: { dev?: boolean; playback?: number | null } = {}) {
  const params: string[] = [];
  if (opts.dev) params.push('dev=1');
  const playback = opts.playback === undefined ? 0.3 : opts.playback;
  if (playback !== null) params.push(`playback=${playback}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  await page.goto(`/${qs}#/unit/${id}`);
}

/** 바꿀 조건(조작변인) 라디오를 고른다. 예: selectIV(page, '물의 온도') */
export async function selectIV(page: Page, label: string) {
  await page.getByRole('radio', { name: new RegExp(`^${label}(을|를) 바꿀 조건으로 고르기$`) }).check();
}

/** 변인 값을 고른다. group은 변인 이름(예: '물의 온도'), option은 버튼 글자(예: '60 °C'). */
export async function setValue(page: Page, group: string, option: string) {
  await page.getByRole('group', { name: group, exact: true }).getByRole('button', { name: option }).click();
}

/** 예측 버튼을 고른다. label: '늘어난다' 등 화면에 보이는 글자(아이콘 제외). */
export async function predict(page: Page, label: string) {
  await page.getByRole('group', { name: /^예측:/ }).getByRole('button', { name: label }).click();
}

export const runButton = (page: Page) => page.getByRole('button', { name: /^(▶ 실험 실행|실험 중…)$/ });

/** 실험 실행을 누르고, 버튼 글자가 '실험 중…'이 아닐 때까지 기다린다. */
export async function runTrial(page: Page) {
  const run = runButton(page);
  await expect(run).toBeEnabled();
  await run.click();
  await expect(run).not.toHaveText('실험 중…');
  await expect(run).toHaveText('▶ 실험 실행');
}

/** 결과표 본문 행들 */
export const resultRows = (page: Page) => page.locator('#results-table tbody tr');

/** 센서 값 (aria-label: 온도/무게/압력/산소/이산화 탄소) */
export const sensor = (page: Page, name: '온도' | '무게' | '압력' | '산소' | '이산화 탄소' | '빛 세기' | '습도' | '맥박' | '기울기' | '소리' | '거리' | '속력' | '전력') => page.getByRole('status', { name, exact: true });

/** 가로 스크롤이 없는지(문서 폭 <= 뷰포트 폭) */
export async function scrollWidth(page: Page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
}

// ---- 단원 6 도우미 ----

/** 단색 사각형이 가운데 있는 PNG를 만든다(바깥은 흰색). 외부 의존성 없이 zlib로 인코딩한다. */
export function makePng(hex: string, size = 100): Buffer {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lo = Math.floor(size * 0.25);
  const hi = Math.ceil(size * 0.75);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inside = x >= lo && x < hi && y >= lo && y < hi;
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = inside ? rgb[c]! : 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 용액을 고른다(용액 고르기 구역). */
export async function pickSolution(page: Page, label: string) {
  await page.getByRole('region', { name: '용액 고르기' }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

/** 예측 버튼: '산성일 것 같아요' | '염기성일 것 같아요' | '잘 모르겠어요' */
export async function predictSolution(page: Page, label: string) {
  await page.getByRole('region', { name: '용액 고르기' }).getByRole('button', { name: label }).click();
}

export const indicatorButton = (page: Page, label: string) =>
  page.getByRole('region', { name: '실험대' }).getByRole('button', { name: label });

/** 안전 점검표 대화상자의 항목을 모두 체크하고 확인한다. */
export async function confirmSafetyDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  for (const box of await dialog.getByRole('checkbox').all()) await box.check();
  await dialog.getByRole('button', { name: '확인했어요' }).click();
  await expect(dialog).toBeHidden();
}

// ---- 수업 연결(교사 대시보드) 도우미 ----

export const TEACHER_URL = 'http://localhost:4175/';
export const SERVER_WS = 'ws://localhost:8787/ws';

/** 교사 화면에서 수업을 만들고 코드를 돌려준다. */
export async function createClass(teacher: Page): Promise<string> {
  await teacher.goto(TEACHER_URL);
  const create = teacher.getByRole('button', { name: '수업 만들기' });
  await expect(create).toBeEnabled();
  await create.click();
  const code = (await teacher.getByTestId('class-code').textContent())!.trim();
  expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
  return code;
}

/** 학생 앱의 주소. 수업 테스트만 `?classroom=`을 붙인다. */
export function studentUrl(opts: { server?: string; dev?: boolean; hash?: string } = {}): string {
  const params = [`classroom=${opts.server ?? SERVER_WS}`, 'playback=0.3'];
  if (opts.dev) params.push('dev=1');
  return `/?${params.join('&')}${opts.hash ?? ''}`;
}

/** 단원 목록에서 수업 참여 대화상자로 참여한다. */
export async function joinClass(page: Page, code: string, group: number, opts: { server?: string; dev?: boolean } = {}) {
  await page.goto(studentUrl(opts));
  await page.getByRole('button', { name: '수업 참여' }).click();
  const dialog = page.getByRole('dialog', { name: '수업 참여' });
  await dialog.getByLabel('수업 코드').fill(code);
  await dialog.getByRole('button', { name: `${group}모둠`, exact: true }).click();
  await dialog.getByRole('button', { name: '참여하기' }).click();
  await expect(page.getByTestId('classroom-status')).toHaveText(`수업 ${code} · ${group}모둠 · 연결됨`);
}

/** 화면 없이 서버에 붙는 가짜 학생(Node 기본 WebSocket). 경고까지 보낼 수 있다. */
export async function rawStudent(code: string, group: number, server = SERVER_WS) {
  const ws = new WebSocket(server);
  await new Promise<void>((res, rej) => {
    ws.onopen = () => res();
    ws.onerror = () => rej(new Error('서버에 연결하지 못했어요'));
  });
  const joined = new Promise<void>((res) => {
    ws.onmessage = (ev) => {
      if (JSON.parse(String(ev.data)).t === 'joined') res();
    };
  });
  ws.send(JSON.stringify({ t: 'join', code, group, appVersion: 'e2e' }));
  await joined;
  return ws;
}

// ---- 카드 분류(동물의 생활) 도우미 ----

export const ANIMAL_CARDS = ['개미', '달팽이', '지렁이', '고양이', '붕어', '게', '참새', '나비'] as const;
export type SortCriterionKey = 'habitat' | 'legs' | 'wings';
export const SORT_CRITERION_LABEL: Record<SortCriterionKey, string> = {
  habitat: '어디에서 사나요?',
  legs: '다리가 있나요?',
  wings: '날개가 있나요?',
};
export const SORT_FEATURE_LABEL: Record<SortCriterionKey, string> = { habitat: '사는 곳', legs: '다리', wings: '날개' };
/** 카드를 관찰에 맞게 넣을 무리 라벨(테스트가 정답을 알고 있어야 올바른 분류를 재현할 수 있다). */
export const SORT_GROUP: Record<SortCriterionKey, Record<(typeof ANIMAL_CARDS)[number], string>> = {
  habitat: {
    개미: '땅에서 사는 동물', 달팽이: '땅에서 사는 동물', 지렁이: '땅에서 사는 동물', 고양이: '땅에서 사는 동물',
    붕어: '물에서 사는 동물', 게: '물에서 사는 동물', 참새: '날아다니는 동물', 나비: '날아다니는 동물',
  },
  legs: {
    개미: '다리가 있다', 달팽이: '다리가 없다', 지렁이: '다리가 없다', 고양이: '다리가 있다',
    붕어: '다리가 없다', 게: '다리가 있다', 참새: '다리가 있다', 나비: '다리가 있다',
  },
  wings: {
    개미: '날개가 없다', 달팽이: '날개가 없다', 지렁이: '날개가 없다', 고양이: '날개가 없다',
    붕어: '날개가 없다', 게: '날개가 없다', 참새: '날개가 있다', 나비: '날개가 있다',
  },
};

/** 분류 기준 라디오를 고른다. */
export async function sortChoose(page: Page, criterion: string) {
  await page.getByRole('radio', { name: criterion, exact: true }).check();
}

/** 카드 버튼(카드 더미나 무리 칸 어디에 있든). */
export const sortCard = (page: Page, card: string) => page.getByRole('button', { name: new RegExp(`^${card} 관찰 \\d/3$`) });
export const sortObserveButton = (page: Page, feature: string) =>
  page.getByRole('region', { name: '돋보기' }).getByRole('button', { name: `${feature} 살펴보기`, exact: true });
export const sortPutButton = (page: Page, group: string) => page.getByRole('button', { name: `${group}에 넣기`, exact: true });
export const sortCheckButton = (page: Page) => page.getByRole('button', { name: '분류 확인하기' });
export const sortFeedback = (page: Page) => page.getByRole('heading', { name: '피드백' }).locator('..');
export const sortTutor = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');

/** 카드를 고르고(관찰할 특징이 있으면 살펴본 뒤) 무리에 넣는다. */
export async function sortOne(page: Page, card: string, group: string, feature?: string) {
  await sortCard(page, card).click();
  if (feature) await sortObserveButton(page, feature).click();
  await sortPut(page, group);
}
async function sortPut(page: Page, group: string) {
  await sortPutButton(page, group).click();
}

/** 8장을 모두 나눈다. observe가 true면 지금 기준의 특징을 먼저 살펴본다. override는 카드별로 일부러 다른 무리에 넣을 때. */
export async function sortAll(
  page: Page,
  key: SortCriterionKey,
  opts: { observe?: boolean; override?: Partial<Record<(typeof ANIMAL_CARDS)[number], string>> } = {},
) {
  for (const card of ANIMAL_CARDS) {
    await sortOne(page, card, opts.override?.[card] ?? SORT_GROUP[key][card], opts.observe === false ? undefined : SORT_FEATURE_LABEL[key]);
  }
}

/** 기준 하나를 관찰에 맞게 끝낸다(고르기 -> 관찰 -> 넣기 -> 확인). */
export async function sortFinishCriterion(page: Page, key: SortCriterionKey) {
  await sortChoose(page, SORT_CRITERION_LABEL[key]);
  await sortAll(page, key);
  await sortCheckButton(page).click();
}

// ---- 식물의 생활(카드 분류 트리) ----

export const LEAF_CARDS = ['단풍나무', '국화', '벚나무', '동백나무', '감나무', '라일락', '붓꽃', '백합'] as const;
export type LeafCard = (typeof LEAF_CARDS)[number];
export type LeafCriterionKey = 'serrated' | 'lobed' | 'parallel';
export const LEAF_CRITERION_LABEL: Record<LeafCriterionKey, string> = {
  serrated: '잎 가장자리가 톱니 모양인가요?',
  lobed: '잎이 여러 갈래로 갈라져 있나요?',
  parallel: '잎맥이 나란한가요?',
};
export const LEAF_FEATURE_LABEL: Record<LeafCriterionKey, string> = { serrated: '가장자리', lobed: '갈라짐', parallel: '잎맥' };
/** 카드를 관찰에 맞게 넣을 쪽(테스트가 정답을 알고 있어야 올바른 분류를 재현할 수 있다). */
export const LEAF_SIDE: Record<LeafCriterionKey, Record<LeafCard, '예' | '아니요'>> = {
  serrated: { 단풍나무: '예', 국화: '예', 벚나무: '예', 동백나무: '예', 감나무: '아니요', 라일락: '아니요', 붓꽃: '아니요', 백합: '아니요' },
  lobed: { 단풍나무: '예', 국화: '예', 벚나무: '아니요', 동백나무: '아니요', 감나무: '아니요', 라일락: '아니요', 붓꽃: '아니요', 백합: '아니요' },
  parallel: { 단풍나무: '아니요', 국화: '아니요', 벚나무: '아니요', 동백나무: '아니요', 감나무: '아니요', 라일락: '아니요', 붓꽃: '예', 백합: '예' },
};

/** 트리의 노드 버튼. id는 'r', 'r/yes', 'r/no/yes'처럼 뿌리에서 간 길이다. */
export const treeNode = (page: Page, id: string) => page.locator(`button#node-${id.replace(/\//g, '-')}`);
export const treeNodes = (page: Page) => page.getByRole('navigation', { name: '나누기 트리 그림' }).getByRole('button');
export const treePutButton = (page: Page, side: '예' | '아니요') => page.getByRole('button', { name: `${side} 쪽에 넣기`, exact: true });

/** 노드를 고르고(질문을 골라) 주어진 카드를 관찰해 넣은 뒤 확인한다. override는 일부러 다른 쪽에 넣을 카드. */
export async function treeSplit(
  page: Page,
  node: string,
  key: LeafCriterionKey,
  cards: readonly LeafCard[],
  opts: { observe?: boolean; override?: Partial<Record<LeafCard, '예' | '아니요'>> } = {},
) {
  await treeNode(page, node).click();
  await sortChoose(page, LEAF_CRITERION_LABEL[key]);
  for (const card of cards) {
    await sortCard(page, card).click();
    if (opts.observe !== false) await sortObserveButton(page, LEAF_FEATURE_LABEL[key]).click();
    await treePutButton(page, opts.override?.[card] ?? LEAF_SIDE[key][card]).click();
  }
  await sortCheckButton(page).click();
}

/** §1 완성 트리까지 나눈다. */
export async function treeFinish(page: Page) {
  await treeSplit(page, 'r', 'parallel', LEAF_CARDS);
  await treeSplit(page, 'r/no', 'serrated', ['단풍나무', '국화', '벚나무', '동백나무', '감나무', '라일락']);
  await treeSplit(page, 'r/no/yes', 'lobed', ['단풍나무', '국화', '벚나무', '동백나무']);
}

// ---- 물체와 물질(카드 분류 groups, 카드 이름 아래에 물질 이름) ----

export const MATERIAL_CARDS = ['쇠못', '유리구슬', '나무 블록', '플라스틱 자', '고무줄', '종이', '면 손수건', '알루미늄 포일'] as const;
export type MaterialCard = (typeof MATERIAL_CARDS)[number];
export type MaterialCriterionKey = 'hard' | 'bends' | 'absorbs';
export const MATERIAL_CRITERION_LABEL: Record<MaterialCriterionKey, string> = {
  hard: '손으로 눌러도 모양이 그대로인가요?',
  bends: '손으로 구부리면 휘어지나요?',
  absorbs: '물을 떨어뜨리면 빨아들이나요?',
};
/** 돋보기 버튼 문구(매니페스트 features[].action). */
export const MATERIAL_ACTION: Record<MaterialCriterionKey, string> = { hard: '눌러 보기', bends: '구부려 보기', absorbs: '물 떨어뜨려 보기' };
/** 카드를 시험 결과에 맞게 넣을 무리(테스트가 정답을 알고 있어야 올바른 분류를 재현할 수 있다). */
export const MATERIAL_GROUP: Record<MaterialCriterionKey, Record<MaterialCard, string>> = {
  hard: {
    쇠못: '그대로이다', 유리구슬: '그대로이다', '나무 블록': '그대로이다', '플라스틱 자': '그대로이다',
    고무줄: '모양이 변한다', 종이: '모양이 변한다', '면 손수건': '모양이 변한다', '알루미늄 포일': '모양이 변한다',
  },
  bends: {
    쇠못: '휘어지지 않는다', 유리구슬: '휘어지지 않는다', '나무 블록': '휘어지지 않는다', '플라스틱 자': '휘어진다',
    고무줄: '휘어진다', 종이: '휘어진다', '면 손수건': '휘어진다', '알루미늄 포일': '휘어진다',
  },
  absorbs: {
    쇠못: '빨아들이지 않는다', 유리구슬: '빨아들이지 않는다', '나무 블록': '빨아들인다', '플라스틱 자': '빨아들이지 않는다',
    고무줄: '빨아들이지 않는다', 종이: '빨아들인다', '면 손수건': '빨아들인다', '알루미늄 포일': '빨아들이지 않는다',
  },
};

/** 카드 버튼. 접근 가능한 이름은 "이름 물질 관찰 n/3"이다. */
export const materialCard = (page: Page, card: MaterialCard) =>
  page.getByRole('button', { name: new RegExp(`^${card} \\S+ 관찰 \\d/3$`) });
export const materialObserveButton = (page: Page, key: MaterialCriterionKey) =>
  page.getByRole('region', { name: '돋보기' }).getByRole('button', { name: MATERIAL_ACTION[key], exact: true });

/** 8장을 모두 시험해 나눈다. override는 일부러 다른 무리에 넣을 카드. */
export async function materialSortAll(
  page: Page,
  key: MaterialCriterionKey,
  opts: { observe?: boolean; override?: Partial<Record<MaterialCard, string>> } = {},
) {
  for (const card of MATERIAL_CARDS) {
    await materialCard(page, card).click();
    if (opts.observe !== false) await materialObserveButton(page, key).click();
    await sortPutButton(page, opts.override?.[card] ?? MATERIAL_GROUP[key][card]).click();
  }
}

/** 기준 하나를 시험 결과에 맞게 끝낸다(고르기 -> 시험 -> 넣기 -> 확인). */
export async function materialFinishCriterion(page: Page, key: MaterialCriterionKey) {
  await sortChoose(page, MATERIAL_CRITERION_LABEL[key]);
  await materialSortAll(page, key);
  await sortCheckButton(page).click();
}

// ---- 지층과 화석(카드 분류 order) ----

/** 정답 순서(먼저 쌓인 층 -> 나중에 쌓인 층). 테스트가 정답을 알고 있어야 올바른 순서를 재현할 수 있다. */
export const STRATA_ORDER = ['역암', '사암', '이암', '석회암', '셰일'] as const;
export type StrataCard = (typeof STRATA_ORDER)[number];
/** 처음 더미 순서(고정). */
export const STRATA_PILE = ['셰일', '사암', '역암', '석회암', '이암'] as const;
export const STRATA_ENV: Record<StrataCard, string> = { 역암: '화석이 없어 알 수 없음', 사암: '바다', 이암: '육지', 석회암: '바다', 셰일: '육지' };

/** 카드 버튼. 접근 가능한 이름은 "이름 관찰 n/3"이다. */
export const strataCard = (page: Page, card: StrataCard) => page.getByRole('button', { name: new RegExp(`^${card} 관찰 \\d/3$`) });
export const strataObserveButton = (page: Page, action: '높이 확인하기' | '알갱이 살펴보기' | '화석 살펴보기') =>
  page.getByRole('region', { name: '돋보기' }).getByRole('button', { name: action, exact: true });
export const strataSlotButton = (page: Page, n: number) => page.getByRole('button', { name: `${n}번째로 쌓인 층에 놓기`, exact: true });
export const strataOrderCheck = (page: Page) => page.getByRole('button', { name: '쌓인 차례 확인하기' });
export const strataEnvCheck = (page: Page) => page.getByRole('button', { name: '환경 확인하기' });
export const strataEnvPut = (page: Page, group: string) => page.getByRole('button', { name: `${group}에 넣기`, exact: true });
export const strataProgress = (page: Page) => page.getByRole('region', { name: '진행 상황' });

/** 카드를 고르고(관찰할 특징이 있으면 살펴본 뒤) 칸에 놓는다. n은 1부터. */
export async function strataPlace(page: Page, card: StrataCard, n: number, observe: Array<'높이 확인하기' | '알갱이 살펴보기' | '화석 살펴보기'> = ['높이 확인하기']) {
  await strataCard(page, card).click();
  for (const a of observe) await strataObserveButton(page, a).click();
  await strataSlotButton(page, n).click();
}

/** 다섯 칸을 order(표본 이름 5개, 먼저 쌓인 칸부터)대로 채운다. */
export async function strataFill(page: Page, order: readonly StrataCard[] = STRATA_ORDER, observe: Array<'높이 확인하기' | '알갱이 살펴보기' | '화석 살펴보기'> = ['높이 확인하기']) {
  for (const [i, card] of order.entries()) await strataPlace(page, card, i + 1, observe);
}

/** 순서를 맞게 놓고 확인해 followUp이 열리게 한다. */
export async function strataFinishOrder(page: Page) {
  await strataFill(page);
  await strataOrderCheck(page).click();
}

/** followUp: 화석을 살펴보고 환경 무리에 넣은 뒤 확인한다. override는 일부러 다른 무리에 넣을 표본. */
export async function strataFinishEnv(page: Page, override: Partial<Record<StrataCard, string>> = {}) {
  for (const card of STRATA_ORDER) {
    await strataCard(page, card).click();
    await strataObserveButton(page, '화석 살펴보기').click();
    await strataEnvPut(page, override[card] ?? STRATA_ENV[card]).click();
  }
  await strataEnvCheck(page).click();
}
