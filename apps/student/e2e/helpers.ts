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
export async function gotoUnit(page: Page, id: string, opts: { dev?: boolean; playback?: number | null; experiment?: string } = {}) {
  const params: string[] = [];
  if (opts.dev) params.push('dev=1');
  const playback = opts.playback === undefined ? 0.3 : opts.playback;
  if (playback !== null) params.push(`playback=${playback}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  await page.goto(`/${qs}#/unit/${id}${opts.experiment ? `/${opts.experiment}` : ''}`);
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

/**
 * 모의 센서 값은 씨앗 고정 잡음을 더하는데, 재생 중 값을 몇 번 읽었는지(화면 갱신 수)에 따라 잡음 차례가 달라진다.
 * 그래서 화면 숫자를 글자로 맞추지 않고 참값 ± 허용 범위로 확인한다. tol은 잡음 크기 + 반올림 반 칸으로 준다.
 */
export async function expectSensorNear(page: Page, name: Parameters<typeof sensor>[1], value: number, tol: number) {
  await expect.poll(async () => Math.abs(parseFloat(await sensor(page, name).innerText()) - value)).toBeLessThanOrEqual(tol);
}

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
/** total은 카드의 관찰 특징 수(기본 3). 특징이 둘인 활동은 2를 넘긴다. */
export const sortCard = (page: Page, card: string, total = 3) => page.getByRole('button', { name: new RegExp(`^${card} 관찰 \\d/${total}$`) });
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

// ---- 혼합물의 분리 두 번째 활동: 분리 방법 고르기(카드 분류 groups, 활동 탭) ----

export const MIXTURE_UNIT = 'g5-mixture';
export const MIXTURE_SORT = 'separation-methods';
export const MIXTURE_SORT_TITLE = '혼합물의 성질에 따라 분리 방법 고르기';

/** 두 번째 활동으로 간다(주소 #/unit/g5-mixture/separation-methods). */
export const gotoMixtureSort = (page: Page, opts: { dev?: boolean } = {}) => gotoUnit(page, MIXTURE_UNIT, { ...opts, experiment: MIXTURE_SORT });

export const MIXTURE_CARDS = ['콩과 좁쌀', '쌀과 모래', '철 가루와 모래', '철 구슬과 유리 구슬', '소금과 모래', '설탕과 콩'] as const;
export type MixtureCard = (typeof MIXTURE_CARDS)[number];
export type MixtureCriterionKey = 'size' | 'magnet' | 'dissolve';
export const MIXTURE_CRITERION_LABEL: Record<MixtureCriterionKey, string> = {
  size: '두 가지의 알갱이 크기가 다른가요?',
  magnet: '한 가지가 자석에 붙나요?',
  dissolve: '한 가지만 물에 녹나요?',
};
/** 돋보기 버튼 문구(매니페스트 features[].action). */
export const MIXTURE_ACTION: Record<MixtureCriterionKey, string> = { size: '크기 비교하기', magnet: '자석 대 보기', dissolve: '물에 넣어 보기' };
/** 카드를 관찰 결과에 맞게 넣을 무리(테스트가 정답을 알고 있어야 올바른 분류를 재현할 수 있다). */
export const MIXTURE_GROUP: Record<MixtureCriterionKey, Record<MixtureCard, string>> = {
  size: { '콩과 좁쌀': '다르다', '쌀과 모래': '다르다', '철 가루와 모래': '비슷하다', '철 구슬과 유리 구슬': '비슷하다', '소금과 모래': '비슷하다', '설탕과 콩': '다르다' },
  magnet: { '콩과 좁쌀': '붙지 않는다', '쌀과 모래': '붙지 않는다', '철 가루와 모래': '붙는다', '철 구슬과 유리 구슬': '붙는다', '소금과 모래': '붙지 않는다', '설탕과 콩': '붙지 않는다' },
  dissolve: { '콩과 좁쌀': '녹지 않는다', '쌀과 모래': '녹지 않는다', '철 가루와 모래': '녹지 않는다', '철 구슬과 유리 구슬': '녹지 않는다', '소금과 모래': '녹는다', '설탕과 콩': '녹는다' },
};

/** 카드 버튼(이름 아래 물질 이름이 없다). 접근 가능한 이름은 "이름 관찰 n/3"이다. */
export const mixtureCard = (page: Page, card: MixtureCard) => page.getByRole('button', { name: new RegExp(`^${card} 관찰 \\d/3$`) });
export const mixtureObserveButton = (page: Page, key: MixtureCriterionKey) =>
  page.getByRole('region', { name: '돋보기' }).getByRole('button', { name: MIXTURE_ACTION[key], exact: true });

/** 6장을 모두 살펴보고 나눈다. override는 일부러 다른 무리에 넣을 카드. */
export async function mixtureSortAll(
  page: Page,
  key: MixtureCriterionKey,
  opts: { observe?: boolean; override?: Partial<Record<MixtureCard, string>> } = {},
) {
  for (const card of MIXTURE_CARDS) {
    await mixtureCard(page, card).click();
    if (opts.observe !== false) await mixtureObserveButton(page, key).click();
    await sortPutButton(page, opts.override?.[card] ?? MIXTURE_GROUP[key][card]).click();
  }
}

/** 기준 하나를 관찰 결과에 맞게 끝낸다(고르기 -> 관찰 -> 넣기 -> 확인). */
export async function mixtureFinishCriterion(page: Page, key: MixtureCriterionKey) {
  await sortChoose(page, MIXTURE_CRITERION_LABEL[key]);
  await mixtureSortAll(page, key);
  await sortCheckButton(page).click();
}

/** 활동 탭(활동이 둘 이상인 단원에만 있다). */
export const activityTabs = (page: Page) => page.getByRole('tablist', { name: '활동 고르기' });
export const activityTab = (page: Page, n: number) => page.getByRole('tab', { name: new RegExp(`^활동 ${n} · `) });

// ---- 날씨와 우리 생활 두 번째 활동: 이슬·안개·구름 비교하기(카드 분류 groups, 활동 탭) ----

export const WEATHER_UNIT = 'g5-weather';
export const WEATHER_SORT = 'dew-fog-cloud';
export const WEATHER_SORT_TITLE = '이슬·안개·구름 비교하기';

/** 두 번째 활동으로 간다(주소 #/unit/g5-weather/dew-fog-cloud). */
export const gotoWeatherSort = (page: Page, opts: { dev?: boolean } = {}) => gotoUnit(page, WEATHER_UNIT, { ...opts, experiment: WEATHER_SORT });

export const WEATHER_CARDS = [
  '아침 풀잎에 맺힌 물방울',
  '차가운 컵 겉에 맺힌 물방울',
  '겨울 아침 창문 안쪽에 맺힌 물방울',
  '새벽 강가를 덮은 뿌연 공기',
  '산골짜기에 낮게 깔린 뿌연 공기',
  '하늘 높이 떠 있는 하얀 구름',
  '비행기 창밖으로 보이는 구름',
  '비가 오기 전 하늘을 덮은 먹구름',
] as const;
export type WeatherCard = (typeof WEATHER_CARDS)[number];
export type WeatherCriterionKey = 'surface' | 'air' | 'high';
export const WEATHER_CRITERION_LABEL: Record<WeatherCriterionKey, string> = {
  surface: '물체의 겉에 붙어 있나요?',
  air: '공기 중에 떠 있나요?',
  high: '땅에서 먼 높은 하늘에 있나요?',
};
/** 돋보기 버튼 문구(매니페스트 features[].action). */
export const WEATHER_ACTION: Record<WeatherCriterionKey, string> = { surface: '가까이에서 만져 보기', air: '주변 공기 살펴보기', high: '어디쯤 있는지 올려다보기' };
const DROPS: WeatherCard[] = ['아침 풀잎에 맺힌 물방울', '차가운 컵 겉에 맺힌 물방울', '겨울 아침 창문 안쪽에 맺힌 물방울'];
const CLOUDS: WeatherCard[] = ['하늘 높이 떠 있는 하얀 구름', '비행기 창밖으로 보이는 구름', '비가 오기 전 하늘을 덮은 먹구름'];
const pick = (yes: WeatherCard[], a: string, b: string) => Object.fromEntries(WEATHER_CARDS.map((c) => [c, yes.includes(c) ? a : b])) as Record<WeatherCard, string>;
/** 카드를 관찰 결과에 맞게 넣을 무리(테스트가 정답을 알고 있어야 올바른 분류를 재현할 수 있다). */
export const WEATHER_GROUP: Record<WeatherCriterionKey, Record<WeatherCard, string>> = {
  surface: pick(DROPS, '붙어 있다', '붙어 있지 않다'),
  air: pick(WEATHER_CARDS.filter((c) => !DROPS.includes(c)), '떠 있다', '떠 있지 않다'),
  high: pick(CLOUDS, '높은 하늘에 있다', '땅 가까이에 있다'),
};

/** 카드 버튼(이름 아래 물질 이름이 없다). 접근 가능한 이름은 "이름 관찰 n/3"이다. */
export const weatherCard = (page: Page, card: WeatherCard) => page.getByRole('button', { name: new RegExp(`^${card} 관찰 \\d/3$`) });
export const weatherObserveButton = (page: Page, key: WeatherCriterionKey) =>
  page.getByRole('region', { name: '돋보기' }).getByRole('button', { name: WEATHER_ACTION[key], exact: true });

/** 8장을 모두 살펴보고 나눈다. override는 일부러 다른 무리에 넣을 카드. */
export async function weatherSortAll(
  page: Page,
  key: WeatherCriterionKey,
  opts: { observe?: boolean; override?: Partial<Record<WeatherCard, string>> } = {},
) {
  for (const card of WEATHER_CARDS) {
    await weatherCard(page, card).click();
    if (opts.observe !== false) await weatherObserveButton(page, key).click();
    await sortPutButton(page, opts.override?.[card] ?? WEATHER_GROUP[key][card]).click();
  }
}

/** 기준 하나를 관찰 결과에 맞게 끝낸다(고르기 -> 관찰 -> 넣기 -> 확인). */
export async function weatherFinishCriterion(page: Page, key: WeatherCriterionKey) {
  await sortChoose(page, WEATHER_CRITERION_LABEL[key]);
  await weatherSortAll(page, key);
  await sortCheckButton(page).click();
}

// ---- 카드 분류 두 번째 활동 넷(1차 묶음): 동물의 생활·식물의 생활·생물과 환경·지층과 화석 ----

/** 두 번째 활동 하나의 카드 분류 화면을 다루는 도구와 설정(unit·exp는 주소 #/unit/{unit}/{exp}). */
export interface SortKitCfg {
  unit: string;
  unitTitle: string;
  exp: string;
  expTitle: string;
  question: string;
  /** 첫 활동 id(활동 탭에서 돌아가는 주소). */
  firstExp: string;
  /** 이 활동의 탭 번호(기본 2)와 단원의 활동 수(기본 2). 땅의 변화·물질의 연소는 3·3이다. */
  tab?: number;
  tabs?: number;
  /** 카드마다 살펴볼 특징 수(기본 3). */
  featureCount?: number;
  cards: readonly string[];
  /** 객관 기준: key -> 질문, 돋보기 버튼 이름, 카드 -> 넣을 무리 이름(관찰 결과에 맞는 것). */
  criteria: Record<string, { label: string; observe: string; group: Record<string, string> }>;
  /** 주관 기준(없는 활동도 있다). */
  subjective?: { label: string; groups: [string, string] };
  /** 라디오(분류 기준) 수. */
  radios: number;
  /** 두 기준을 끝내는 순서. */
  finish: [string, string];
  /** 일부러 틀리게 넣어 볼 카드와 그 카드를 넣을 틀린 무리(기준은 finish[0]). 카드 더미의 마지막 카드는 고른 채로 남아 다시 누르면 선택이 풀리므로 마지막이 아닌 카드를 쓴다. */
  wrong: { card: string; group: string; sentence: string; tutor: string };
  /** 처음 튜터 문장, 마무리 튜터 문장(조각들), 끝난 뒤 화면 어디에도 없어야 하는 말. */
  firstTutor: string;
  finishedTutor: string[];
  banned: string[];
  /** 그림: svg class, 결과 그림 class, 한 카드의 특징별 결과 선택자. */
  icon: { svg: string; result: string; card: string; obs: Record<string, string>; marks: Array<{ key: string; sel: string }>; other: { card: string; key: string; sel: string } };
}

export function sortKit(cfg: SortKitCfg) {
  const goto = (page: Page, opts: { dev?: boolean } = {}) => gotoUnit(page, cfg.unit, { ...opts, experiment: cfg.exp });
  const card = (page: Page, name: string) => sortCard(page, name, cfg.featureCount ?? 3);
  const observeButton = (page: Page, key: string) =>
    page.getByRole('region', { name: '돋보기' }).getByRole('button', { name: cfg.criteria[key]!.observe, exact: true });
  /** 카드를 모두 살펴보고(observe) 나눈다. override는 일부러 다른 무리에 넣을 카드. */
  async function sortEvery(page: Page, key: string, opts: { observe?: boolean; override?: Record<string, string> } = {}) {
    for (const name of cfg.cards) {
      await card(page, name).click();
      if (opts.observe !== false) await observeButton(page, key).click();
      await sortPutButton(page, opts.override?.[name] ?? cfg.criteria[key]!.group[name]!).click();
    }
  }
  async function finishCriterion(page: Page, key: string) {
    await sortChoose(page, cfg.criteria[key]!.label);
    await sortEvery(page, key);
    await sortCheckButton(page).click();
  }
  return { goto, card, observeButton, sortEvery, finishCriterion };
}

/** 두 번째 활동 시험 묶음을 등록한다(각 단원의 spec 파일에서 부른다). */
export function defineSortSuite(cfg: SortKitCfg) {
  const kit = sortKit(cfg);
  const progress = (page: Page) => page.getByRole('region', { name: '진행 상황' });
  const magnifier = (page: Page) => page.getByRole('region', { name: '돋보기' });
  const [k1, k2] = cfg.finish;
  const label = (key: string) => cfg.criteria[key]!.label;
  const tab = cfg.tab ?? 2;
  const tabs = cfg.tabs ?? 2;

  test.describe(`${cfg.expTitle} (두 번째 활동)`, () => {
    test('첫 활동 화면의 활동 탭으로 이동한다: 탭 이름, 주소, 질문, 카드', async ({ page }) => {
      await gotoUnit(page, cfg.unit);
      await expect(activityTabs(page)).toBeVisible();
      await expect(page.getByRole('tab')).toHaveCount(tabs);
      await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
      await expect(activityTab(page, tab)).toHaveAttribute('aria-selected', 'false');
      await expect(activityTab(page, tab)).toHaveText(`활동 ${tab} · ${cfg.expTitle}`);
      await activityTab(page, tab).click();
      await expect(page).toHaveURL(new RegExp(`#/unit/${cfg.unit}/${cfg.exp}$`));
      await expect(activityTab(page, tab)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { level: 1, name: cfg.unitTitle })).toBeVisible();
      await expect(page.getByText(`탐구 질문: ${cfg.question}`)).toBeVisible();
      await expect(page.getByRole('radio')).toHaveCount(cfg.radios);
      for (const name of cfg.cards) await expect(kit.card(page, name)).toBeVisible();
      await expect(page.locator('.sort-card-sub')).toHaveCount(0);
      await expect(sortCheckButton(page)).toBeDisabled();
      await expect(sortTutor(page)).toContainText(cfg.firstTutor);
      // 첫 활동으로 돌아간다.
      await activityTab(page, 1).click();
      await expect(page).toHaveURL(new RegExp(`#/unit/${cfg.unit}/${cfg.firstExp}$`));
      await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { level: 1, name: cfg.unitTitle })).toBeVisible();
    });

    test('돋보기 버튼 문구는 기준마다 다르고, 카드를 고르기 전에는 버튼이 없다', async ({ page }) => {
      await kit.goto(page);
      await expect(magnifier(page).getByRole('button')).toHaveCount(0);
      await kit.card(page, cfg.cards[0]!).click();
      for (const key of Object.keys(cfg.criteria)) await expect(kit.observeButton(page, key)).toBeVisible();
    });

    test(`"${cfg.criteria[k1]!.label}"로 관찰 없이 넣으면 미관찰 문장이, 관찰 뒤 틀리게 넣으면 비교 문장이, 고치면 맞음 문장이 보인다`, async ({ page }) => {
      await kit.goto(page);
      await sortChoose(page, label(k1));
      await kit.sortEvery(page, k1, { observe: false });
      await sortCheckButton(page).click();
      await expect(page.getByText('아직 이 기준의 특징을 살펴보지 않았어요.')).toBeVisible();
      await expect(sortTutor(page)).toContainText('아직 살펴보지 않았어요.');
      // 관찰하되 한 카드를 틀린 무리에 넣는다.
      for (const name of cfg.cards) {
        await kit.card(page, name).click();
        await kit.observeButton(page, k1).click();
      }
      await kit.card(page, cfg.wrong.card).click();
      await sortPutButton(page, cfg.wrong.group).click();
      await sortCheckButton(page).click();
      await expect(page.getByText(cfg.wrong.sentence)).toBeVisible();
      await expect(sortTutor(page)).toContainText(cfg.wrong.tutor);
      // 어느 무리가 맞는지는 말하지 않는다.
      const right = cfg.criteria[k1]!.group[cfg.wrong.card]!;
      for (const box of [sortFeedback(page), sortTutor(page)]) await expect(box).not.toContainText(right);
      await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
      // 고친다.
      await kit.card(page, cfg.wrong.card).click();
      await sortPutButton(page, right).click();
      await sortCheckButton(page).click();
      await expect(page.getByText('관찰한 특징과 분류가 서로 잘 맞아요.')).toBeVisible();
      await expect(progress(page)).toContainText(`끝낸 기준: ${label(k1)} (1/2)`);
    });

    if (cfg.subjective) {
      const subj = cfg.subjective;
      test(`"${subj.label}"는 판정하지 않고 사람마다 다르다고만 한다`, async ({ page }) => {
        await kit.goto(page);
        await sortChoose(page, subj.label);
        for (const [i, name] of cfg.cards.entries()) {
          await kit.card(page, name).click();
          await sortPutButton(page, subj.groups[i % 2]!).click();
        }
        await sortCheckButton(page).click();
        await expect(page.getByText('이 기준은 사람마다 다르게 나눌 수 있어요.')).toBeVisible();
        await expect(sortTutor(page)).toContainText(`'${subj.label}'로 나누면 친구와 내 결과가 같을까요?`);
        await expect(progress(page)).toContainText('끝낸 기준: 없음 (0/2)');
      });
    }

    test('객관 기준 두 개를 끝내면 완료 문구와 마무리 질문이 나오고 정답·제한 용어는 화면에 없다', async ({ page }) => {
      await kit.goto(page);
      await kit.finishCriterion(page, k1);
      await expect(page.getByText('두 가지 기준으로 분류했어요!')).toHaveCount(0);
      await expect(sortTutor(page)).toContainText('다른 기준으로도 나누어 볼까요?');
      await kit.finishCriterion(page, k2);
      await expect(progress(page)).toContainText(`끝낸 기준: ${label(k1)}, ${label(k2)} (2/2)`);
      await expect(page.getByText('두 가지 기준으로 분류했어요!')).toBeVisible();
      for (const part of cfg.finishedTutor) await expect(sortTutor(page)).toContainText(part);
      const body = page.locator('body');
      for (const w of cfg.banned) await expect(body).not.toContainText(w);
    });

    test('관찰하기 전에는 기본 그림만 보이고, 살펴본 특징의 결과 그림만 나타난다', async ({ page }) => {
      await kit.goto(page);
      const { svg, result, card, marks, other } = cfg.icon;
      await kit.card(page, card).click();
      await expect(page.locator(`svg.${svg}`)).toHaveCount(cfg.cards.length + 1); // 카드 그림 + 돋보기 1장
      await expect(page.locator(`svg .${result}`)).toHaveCount(0);
      let n = 0;
      for (const { key, sel } of marks) {
        await kit.observeButton(page, key).click();
        n++;
        await expect(page.locator(`svg ${sel}`)).toHaveCount(1);
        await expect(page.locator(`svg .${result}`)).toHaveCount(n);
      }
      // 다른 카드를 고르면 그 카드에서 살펴본 것만 그려진다.
      await kit.card(page, other.card).click();
      await expect(page.locator(`svg .${result}`)).toHaveCount(0);
      await kit.observeButton(page, other.key).click();
      await expect(page.locator(`svg ${other.sel}`)).toHaveCount(1);
      await expect(page.locator(`svg .${result}`)).toHaveCount(1);
    });

    test('아직 관찰하지 않은 문장은 화면에 없고, 살펴본 특징의 문장만 나타난다', async ({ page }) => {
      await kit.goto(page);
      const body = page.locator('body');
      const { card, obs } = cfg.icon;
      await kit.card(page, card).click();
      for (const s of Object.values(obs)) await expect(body).not.toContainText(s);
      let seen = 0;
      for (const [key, sentence] of Object.entries(obs)) {
        await kit.observeButton(page, key).click();
        seen++;
        await expect(body).toContainText(sentence);
        await expect(magnifier(page).locator('.obs-list li')).toHaveCount(seen);
        for (const later of Object.values(obs).slice(seen)) await expect(body).not.toContainText(later);
      }
    });

    for (const vp of [{ width: 390, height: 800 }, { width: 1280, height: 800 }]) {
      test.describe(`${vp.width}px`, () => {
        test.use({ viewport: vp });
        test('가로 스크롤이 없다 (처음, 카드를 관찰한 뒤, 모두 넣은 뒤)', async ({ page }) => {
          await kit.goto(page);
          const noScroll = async () => {
            const { sw, iw } = await scrollWidth(page);
            expect(sw).toBeLessThanOrEqual(iw);
          };
          await noScroll();
          await sortChoose(page, label(k2));
          await kit.card(page, cfg.cards[cfg.cards.length - 1]!).click();
          await kit.observeButton(page, k2).click();
          await noScroll();
          await kit.sortEvery(page, k2);
          await sortCheckButton(page).click();
          await noScroll();
        });
      });
    }
  });
}

// ---- 두 번째 활동 넷의 시험 설정(각 단원 spec의 시험 묶음과 a11y spec이 함께 쓴다) ----

export const ANIMAL_HABITAT_CFG: SortKitCfg = {
  unit: 'g3-animal',
  unitTitle: '동물의 생활',
  exp: 'animal-habitat',
  expTitle: '사는 곳과 동물의 생김새',
  question: '사는 곳이 다른 동물들은 생김새가 어떻게 다를까?',
  firstExp: 'animal-sort',
  cards: ['붕어', '상어', '두더지', '지렁이', '사막여우', '낙타', '북극곰', '북극여우'],
  criteria: {
    habitat: { label: '어디에서 사나요?', observe: '사는 곳 살펴보기', group: { '붕어': '물속', '상어': '물속', '두더지': '땅속', '지렁이': '땅속', '사막여우': '사막', '낙타': '사막', '북극곰': '추운 곳', '북극여우': '추운 곳' } },
    fins: { label: '몸에 지느러미가 있나요?', observe: '몸 옆과 등 살펴보기', group: { '붕어': '있다', '상어': '있다', '두더지': '없다', '지렁이': '없다', '사막여우': '없다', '낙타': '없다', '북극곰': '없다', '북극여우': '없다' } },
    fur: { label: '몸이 털로 덮여 있나요?', observe: '몸 겉 만져 보기', group: { '붕어': '덮여 있지 않다', '상어': '덮여 있지 않다', '두더지': '덮여 있다', '지렁이': '덮여 있지 않다', '사막여우': '덮여 있다', '낙타': '덮여 있다', '북극곰': '덮여 있다', '북극여우': '덮여 있다' } },
  },
  subjective: { label: '귀여운가요?', groups: ['귀엽다', '귀엽지 않다'] },
  radios: 4,
  finish: ['habitat', 'fins'],
  wrong: { card: '북극곰', group: '사막', sentence: '북극곰은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?', tutor: '북극곰에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?' },
  firstTutor: '동물들을 어떤 기준으로 나누어 볼까요?',
  finishedTutor: ['사는 곳으로 나눈 무리와 생김새로 나눈 무리를 견주어 볼까요?', '같은 곳에 사는 동물끼리 닮은 생김새가 있나요?'],
  banned: ['적응', '진화', '자연 선택', '체온 조절', '지느러미로 헤엄', '털이 추위를 막'],
  icon: {
    svg: 'habitat-icon',
    result: 'hb-result',
    card: '상어',
    obs: { habitat: '바닷속에서 헤엄치며 살아요.', fins: '몸 옆과 등, 꼬리에 얇고 단단한 막이 펼쳐져 있어요.', fur: '몸 겉이 오돌토돌하고 거칠며, 털이 나 있지 않아요.' },
    marks: [{ key: 'habitat', sel: '.hb-habitat[data-habitat="water"]' }, { key: 'fins', sel: '.hb-fins[data-fins="true"]' }, { key: 'fur', sel: '.hb-fur[data-fur="false"]' }],
    other: { card: '북극곰', key: 'fur', sel: '.hb-fur[data-fur="true"]' },
  },
};

export const PLANT_HABITAT_CFG: SortKitCfg = {
  unit: 'g3-plantlife',
  unitTitle: '식물의 생활',
  exp: 'plant-habitat',
  expTitle: '사는 곳과 식물의 생김새',
  question: '사는 곳이 다른 식물들은 생김새가 어떻게 다를까?',
  firstExp: 'leaf-tree',
  cards: ['부레옥잠', '개구리밥', '검정말', '연꽃', '선인장', '소나무', '민들레', '강아지풀'],
  criteria: {
    place: { label: '어디에서 자라나요?', observe: '자라는 곳 살펴보기', group: { '부레옥잠': '물에서 자란다', '개구리밥': '물에서 자란다', '검정말': '물에서 자란다', '연꽃': '물에서 자란다', '선인장': '땅에서 자란다', '소나무': '땅에서 자란다', '민들레': '땅에서 자란다', '강아지풀': '땅에서 자란다' } },
    float: { label: '물 위에 떠 있나요?', observe: '물 위 살펴보기', group: { '부레옥잠': '떠 있다', '개구리밥': '떠 있다', '검정말': '떠 있지 않다', '연꽃': '떠 있지 않다', '선인장': '떠 있지 않다', '소나무': '떠 있지 않다', '민들레': '떠 있지 않다', '강아지풀': '떠 있지 않다' } },
    needle: { label: '잎이 가시나 바늘처럼 가늘고 뾰족한가요?', observe: '잎 모양 살펴보기', group: { '부레옥잠': '그렇지 않다', '개구리밥': '그렇지 않다', '검정말': '그렇지 않다', '연꽃': '그렇지 않다', '선인장': '그렇다', '소나무': '그렇다', '민들레': '그렇지 않다', '강아지풀': '그렇지 않다' } },
  },
  subjective: { label: '예쁜가요?', groups: ['예쁘다', '예쁘지 않다'] },
  radios: 4,
  finish: ['float', 'needle'],
  wrong: { card: '개구리밥', group: '떠 있지 않다', sentence: '개구리밥은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?', tutor: '개구리밥에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?' },
  firstTutor: '식물들을 어떤 기준으로 나누어 볼까요?',
  finishedTutor: ['물 위에 떠 사는 식물은 몸의 어느 부분 덕분에 떠 있을 수 있을까요?', '관찰 기록에서 찾아볼까요?'],
  banned: ['공기주머니', '증산 작용', '기공', '통기 조직', '환경에 적응'],
  icon: {
    svg: 'plant-habitat-icon',
    result: 'ph-result',
    card: '부레옥잠',
    obs: { place: '연못 물 위에서 자라요.', float: '물 위에 떠 있고, 잎자루를 자르면 스펀지처럼 구멍이 많아요.', needle: '잎이 둥글고 넓적해요.' },
    marks: [{ key: 'place', sel: '.ph-place[data-place="water"]' }, { key: 'float', sel: '.ph-float[data-floating="true"]' }, { key: 'needle', sel: '.ph-needle[data-pointed="false"]' }],
    other: { card: '선인장', key: 'needle', sel: '.ph-needle[data-pointed="true"]' },
  },
};

export const LIVING_NONLIVING_CFG: SortKitCfg = {
  unit: 'g4-ecosystem',
  unitTitle: '생물과 환경',
  exp: 'living-nonliving',
  expTitle: '생태계를 이루는 것 나누기',
  question: '생태계를 이루는 것들을 어떻게 나눌 수 있을까?',
  firstExp: 'food-web',
  cards: ['햇빛', '물', '공기', '흙', '돌', '토끼', '참새', '지렁이', '민들레', '버섯'],
  criteria: {
    grow: { label: '시간이 지나면 자라거나 수가 늘어나나요?', observe: '자람 살펴보기', group: { '햇빛': '그렇지 않다', '물': '그렇지 않다', '공기': '그렇지 않다', '흙': '그렇지 않다', '돌': '그렇지 않다', '토끼': '그렇다', '참새': '그렇다', '지렁이': '그렇다', '민들레': '그렇다', '버섯': '그렇다' } },
    food: { label: '살아가려면 양분이 필요한가요?', observe: '양분 살펴보기', group: { '햇빛': '필요하지 않다', '물': '필요하지 않다', '공기': '필요하지 않다', '흙': '필요하지 않다', '돌': '필요하지 않다', '토끼': '필요하다', '참새': '필요하다', '지렁이': '필요하다', '민들레': '필요하다', '버섯': '필요하다' } },
    move: { label: '스스로 자리를 옮겨 다니나요?', observe: '움직임 살펴보기', group: { '햇빛': '옮겨 다니지 않는다', '물': '옮겨 다니지 않는다', '공기': '옮겨 다니지 않는다', '흙': '옮겨 다니지 않는다', '돌': '옮겨 다니지 않는다', '토끼': '옮겨 다닌다', '참새': '옮겨 다닌다', '지렁이': '옮겨 다닌다', '민들레': '옮겨 다니지 않는다', '버섯': '옮겨 다니지 않는다' } },
  },
  radios: 3,
  finish: ['grow', 'move'],
  wrong: { card: '민들레', group: '그렇지 않다', sentence: '민들레는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?', tutor: '민들레에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?' },
  firstTutor: '카드들을 어떤 기준으로 나누어 볼까요?',
  finishedTutor: ['햇빛이나 물이 없어지면, 자라고 양분이 필요한 무리에는 어떤 일이 생길까요?'],
  banned: ['생물 요소', '비생물 요소', '생산자', '소비자', '분해자', '광합성', '식물도 생물'],
  icon: {
    svg: 'eco-icon',
    result: 'eco-result',
    card: '버섯',
    obs: { grow: '하룻밤 사이에 갓이 더 커지고 둘레에 작은 버섯이 새로 났어요.', food: '쓰러진 나무에 붙어 그 속의 물기와 양분을 빨아들여요.', move: '쓰러진 나무에 붙은 채 늘 같은 자리에 있어요.' },
    marks: [{ key: 'grow', sel: '.eco-grow[data-grows="true"]' }, { key: 'food', sel: '.eco-food[data-needs="true"]' }, { key: 'move', sel: '.eco-move[data-moves="false"]' }],
    other: { card: '돌', key: 'move', sel: '.eco-move[data-moves="false"]' },
  },
};

export const ROCK_GRAIN_CFG: SortKitCfg = {
  unit: 'g5-strata',
  unitTitle: '지층과 화석',
  exp: 'rock-grain',
  expTitle: '퇴적암을 알갱이 크기로 나누기',
  question: '퇴적암을 알갱이의 크기에 따라 어떻게 나눌 수 있을까?',
  firstExp: 'strata-order',
  cards: ['회색 암석 가', '검은 암석 나', '붉은 암석 다', '누런 암석 라', '회색 암석 마', '붉은 암석 바', '얼룩 암석 사', '회색 암석 아'],
  criteria: {
    grain: { label: '알갱이는 얼마나 큰가요?', observe: '알갱이 크기 살펴보기', group: { '회색 암석 가': '너무 작아 잘 보이지 않는다', '검은 암석 나': '너무 작아 잘 보이지 않는다', '붉은 암석 다': '너무 작아 잘 보이지 않는다', '누런 암석 라': '모래알만 하다', '회색 암석 마': '모래알만 하다', '붉은 암석 바': '모래알만 하다', '얼룩 암석 사': '콩알보다 크다', '회색 암석 아': '콩알보다 크다' } },
    smooth: { label: '손으로 문지르면 매끄러운가요?', observe: '문지른 느낌 살펴보기', group: { '회색 암석 가': '매끄럽다', '검은 암석 나': '매끄럽다', '붉은 암석 다': '매끄럽다', '누런 암석 라': '까끌까끌하다', '회색 암석 마': '까끌까끌하다', '붉은 암석 바': '까끌까끌하다', '얼룩 암석 사': '까끌까끌하다', '회색 암석 아': '까끌까끌하다' } },
    pebble: { label: '둥근 돌 조각이 박혀 있나요?', observe: '박힌 조각 살펴보기', group: { '회색 암석 가': '박혀 있지 않다', '검은 암석 나': '박혀 있지 않다', '붉은 암석 다': '박혀 있지 않다', '누런 암석 라': '박혀 있지 않다', '회색 암석 마': '박혀 있지 않다', '붉은 암석 바': '박혀 있지 않다', '얼룩 암석 사': '박혀 있다', '회색 암석 아': '박혀 있다' } },
  },
  subjective: { label: '색이 마음에 드나요?', groups: ['마음에 든다', '마음에 들지 않는다'] },
  radios: 4,
  finish: ['grain', 'smooth'],
  wrong: { card: '회색 암석 가', group: '모래알만 하다', sentence: '회색 암석 가는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?', tutor: '회색 암석 가에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?' },
  firstTutor: '암석들을 어떤 기준으로 나누어 볼까요?',
  finishedTutor: ['알갱이가 아주 작은 암석은 무엇이 쌓여 만들어졌을까요?', '모래알만 한 알갱이로 된 암석과 견주어 볼까요?'],
  banned: ['이암', '사암', '역암', '셰일', '쇄설성', '입도', '진흙이 쌓', '모래가 쌓'],
  icon: {
    svg: 'grain-icon',
    result: 'rg-result',
    card: '회색 암석 가',
    obs: { grain: '돋보기로 보아도 알갱이가 잘 보이지 않아요.', smooth: '문지르면 매끄럽고 손에 고운 가루가 묻어요.', pebble: '표면이 고르고 박힌 조각이 없어요.' },
    marks: [{ key: 'grain', sel: '.rg-grain[data-grain="fine"]' }, { key: 'smooth', sel: '.rg-smooth[data-smooth="true"]' }, { key: 'pebble', sel: '.rg-pebble[data-pebble="false"]' }],
    other: { card: '얼룩 암석 사', key: 'pebble', sel: '.rg-pebble[data-pebble="true"]' },
  },
};

// ---- 카드 분류 활동 넷(3차 묶음): 물체와 물질·물의 상태 변화(활동 2), 땅의 변화·물질의 연소(활동 3) ----

export const MATTER_SHAPE_VOLUME_CFG: SortKitCfg = {
  unit: "g3-material",
  unitTitle: "물체와 물질",
  exp: "matter-shape-volume",
  expTitle: "모양과 부피로 물질 나누기",
  question: "다른 그릇에 옮겨 담으면 모양과 부피가 변하는 물질과 변하지 않는 물질이 있을까?",
  firstExp: "material-sort",
  tab: 2,
  tabs: 2,
  featureCount: 3,
  cards: ["나무 토막", "돌", "지우개", "모래", "물", "우유", "식용유", "주사기 속 공기", "풍선 속 헬륨"],
  criteria: {
    shape: { label: "다른 그릇에 옮겨도 모양이 그대로인가요?", observe: "넓은 그릇과 좁은 그릇에 옮겨 보기", group: {"나무 토막": "그대로다", "돌": "그대로다", "지우개": "그대로다", "모래": "그대로다", "물": "바뀐다", "우유": "바뀐다", "식용유": "바뀐다", "주사기 속 공기": "바뀐다", "풍선 속 헬륨": "바뀐다"} },
    volume: { label: "다른 그릇에 옮겨도 차지하는 부피가 그대로인가요?", observe: "눈금 있는 그릇에 옮겨 눈금 보기", group: {"나무 토막": "그대로다", "돌": "그대로다", "지우개": "그대로다", "모래": "그대로다", "물": "그대로다", "우유": "그대로다", "식용유": "그대로다", "주사기 속 공기": "바뀐다", "풍선 속 헬륨": "바뀐다"} },
    see: { label: "눈에 보이나요?", observe: "가까이 들여다보기", group: {"나무 토막": "보인다", "돌": "보인다", "지우개": "보인다", "모래": "보인다", "물": "보인다", "우유": "보인다", "식용유": "보인다", "주사기 속 공기": "보이지 않는다", "풍선 속 헬륨": "보이지 않는다"} },
  },
  subjective: { label: "만지면 기분이 좋은가요?", groups: ["기분이 좋다", "기분이 좋지 않다"] },
  radios: 4,
  finish: ["shape", "volume"],
  wrong: { card: "나무 토막", group: "바뀐다", sentence: "나무 토막은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?", tutor: "나무 토막에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
  firstTutor: "물질들을 어떤 기준으로 나누어 볼까요?",
  finishedTutor: ["두 기준으로 나눈 무리를 겹쳐 보면 몇 무리가 생기나요?", "각 무리를 무엇이라고 부르면 좋을까요?"],
  banned: ["고체", "액체", "기체", "분자", "입자", "압축", "밀도"],
  icon: {
    svg: "matter-shape-icon",
    result: "ms-result",
    card: "주사기 속 공기",
    obs: {"shape": "주사기, 비닐봉지, 풍선 어디에 넣어도 그 모양을 따라가요.", "volume": "주사기 끝을 막고 피스톤을 누르면 눈금이 줄어들어요. 손을 떼면 다시 늘어나요.", "see": "주사기 안이 비어 보여요."},
    marks: [{ key: "shape", sel: ".ms-shape[data-shape=\"change\"]" }, { key: "volume", sel: ".ms-volume[data-volume=\"change\"]" }, { key: "see", sel: ".ms-see[data-see=\"false\"]" }],
    other: { card: "돌", key: "see", sel: ".ms-see[data-see=\"true\"]" },
  },
};

export const WATER_AROUND_CFG: SortKitCfg = {
  unit: "g4-water-state",
  unitTitle: "물의 상태 변화",
  exp: "water-around",
  expTitle: "우리 주변의 물 나누기",
  question: "우리 주변의 물은 어떤 상태로 있을까?",
  firstExp: "freeze-melt",
  tab: 2,
  tabs: 2,
  featureCount: 3,
  cards: ["고드름", "얼음물 속 얼음", "눈사람", "빗물", "어항 속 물", "이슬방울", "차가운 컵 겉의 물방울", "마르는 빨래에서 날아간 물", "끓는 물 속 거품 안의 물", "주전자 주둥이의 하얀 김"],
  criteria: {
    shape: { label: "모양이 일정한가요?", observe: "만져 보기", group: {"고드름": "일정하다", "얼음물 속 얼음": "일정하다", "눈사람": "일정하다", "빗물": "일정하지 않다", "어항 속 물": "일정하지 않다", "이슬방울": "일정하지 않다", "차가운 컵 겉의 물방울": "일정하지 않다", "마르는 빨래에서 날아간 물": "일정하지 않다", "끓는 물 속 거품 안의 물": "일정하지 않다", "주전자 주둥이의 하얀 김": "일정하지 않다"} },
    flow: { label: "기울이면 흘러내리나요?", observe: "기울여 보기", group: {"고드름": "흘러내리지 않는다", "얼음물 속 얼음": "흘러내리지 않는다", "눈사람": "흘러내리지 않는다", "빗물": "흘러내린다", "어항 속 물": "흘러내린다", "이슬방울": "흘러내린다", "차가운 컵 겉의 물방울": "흘러내린다", "마르는 빨래에서 날아간 물": "흘러내리지 않는다", "끓는 물 속 거품 안의 물": "흘러내리지 않는다", "주전자 주둥이의 하얀 김": "흘러내리지 않는다"} },
    see: { label: "눈에 보이나요?", observe: "가까이 보기", group: {"고드름": "보인다", "얼음물 속 얼음": "보인다", "눈사람": "보인다", "빗물": "보인다", "어항 속 물": "보인다", "이슬방울": "보인다", "차가운 컵 겉의 물방울": "보인다", "마르는 빨래에서 날아간 물": "보이지 않는다", "끓는 물 속 거품 안의 물": "보이지 않는다", "주전자 주둥이의 하얀 김": "보인다"} },
  },
  subjective: { label: "보기 좋은가요?", groups: ["보기 좋다", "보기 좋지 않다"] },
  radios: 4,
  finish: ["shape", "flow"],
  wrong: { card: "고드름", group: "일정하지 않다", sentence: "고드름은 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?", tutor: "고드름에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
  firstTutor: "카드들을 어떤 기준으로 나누어 볼까요?",
  finishedTutor: ["세 무리로 나누면 각 무리를 무엇이라고 부르면 좋을까요?", "하얀 김은 어느 무리와 더 닮았나요?"],
  banned: ["고체", "액체", "기체", "수증기", "승화", "응결", "기화"],
  icon: {
    svg: "water-around-icon",
    result: "wa-result",
    card: "주전자 주둥이의 하얀 김",
    obs: {"shape": "하얀 것이 피어오르다가 금방 모양이 바뀌어요.", "flow": "흘러내리지 않고 공중에서 흩어져요.", "see": "하얗게 보여요. 차가운 숟가락을 대면 숟가락에 물방울이 맺혀요."},
    marks: [{ key: "shape", sel: ".wa-shape[data-shape=\"change\"]" }, { key: "flow", sel: ".wa-flow[data-flow=\"false\"]" }, { key: "see", sel: ".wa-see[data-see=\"true\"]" }],
    other: { card: "눈사람", key: "flow", sel: ".wa-flow[data-flow=\"false\"]" },
  },
};

export const VOLCANO_EJECTA_CFG: SortKitCfg = {
  unit: "g4-land",
  unitTitle: "땅의 변화",
  exp: "volcano-ejecta",
  expTitle: "화산에서 나오는 것 나누기",
  question: "화산이 폭발하면 어떤 물질이 나올까?",
  firstExp: "magma-cooling",
  tab: 3,
  tabs: 3,
  featureCount: 3,
  cards: ["화산 가스", "용암", "화산재", "화산 암석 조각", "모형 꼭대기의 연기", "모형 옆으로 흘러내린 녹은 것", "모형 둘레에 식어 굳은 조각", "모형 둘레에 흩어진 가루"],
  criteria: {
    source: { label: "어디에서 나왔나요?", observe: "사진 설명 읽기", group: {"화산 가스": "실제 화산", "용암": "실제 화산", "화산재": "실제 화산", "화산 암석 조각": "실제 화산", "모형 꼭대기의 연기": "화산 모형", "모형 옆으로 흘러내린 녹은 것": "화산 모형", "모형 둘레에 식어 굳은 조각": "화산 모형", "모형 둘레에 흩어진 가루": "화산 모형"} },
    shape: { label: "알갱이나 조각 하나하나의 모양이 일정한가요?", observe: "돋보기로 보기", group: {"화산 가스": "일정하지 않다", "용암": "일정하지 않다", "화산재": "일정하다", "화산 암석 조각": "일정하다", "모형 꼭대기의 연기": "일정하지 않다", "모형 옆으로 흘러내린 녹은 것": "일정하지 않다", "모형 둘레에 식어 굳은 조각": "일정하다", "모형 둘레에 흩어진 가루": "일정하다"} },
    flow: { label: "땅 위를 따라 흘러내리나요?", observe: "흘러가는 모습 지켜보기", group: {"화산 가스": "흘러내리지 않는다", "용암": "흘러내린다", "화산재": "흘러내리지 않는다", "화산 암석 조각": "흘러내리지 않는다", "모형 꼭대기의 연기": "흘러내리지 않는다", "모형 옆으로 흘러내린 녹은 것": "흘러내린다", "모형 둘레에 식어 굳은 조각": "흘러내리지 않는다", "모형 둘레에 흩어진 가루": "흘러내리지 않는다"} },
  },
  subjective: { label: "무서워 보이나요?", groups: ["무서워 보인다", "무서워 보이지 않는다"] },
  radios: 4,
  finish: ["shape", "flow"],
  wrong: { card: "화산재", group: "일정하지 않다", sentence: "화산재는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?", tutor: "화산재에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
  firstTutor: "카드들을 어떤 기준으로 나누어 볼까요?",
  finishedTutor: ["모형에서 본 것과 실제 화산에서 나오는 것은 어떤 점이 같고, 어떤 점이 다를까요?"],
  banned: ["고체", "액체", "기체", "마그마의 성분", "이산화 황", "판 구조"],
  icon: {
    svg: "volcano-icon",
    result: "vc-result",
    card: "용암",
    obs: {"source": "화산 꼭대기에서 솟아 나온 것을 찍은 사진이에요.", "shape": "붉게 빛나며 계속 모양이 바뀌어요.", "flow": "산비탈을 따라 천천히 흘러내려요."},
    marks: [{ key: "source", sel: ".vc-source[data-source=\"real\"]" }, { key: "shape", sel: ".vc-shape[data-shape=\"change\"]" }, { key: "flow", sel: ".vc-flow[data-flow=\"true\"]" }],
    other: { card: "화산재", key: "flow", sel: ".vc-flow[data-flow=\"false\"]" },
  },
};

export const PROPERTY_CHANGE_CFG: SortKitCfg = {
  unit: "g6-combustion",
  unitTitle: "물질의 연소",
  exp: "property-change",
  expTitle: "변하기 전과 후의 성질 비교하기",
  question: "물질이 변할 때 처음 물질의 성질이 달라지는 경우와 그렇지 않은 경우는 어떻게 다를까?",
  firstExp: "candle-jar",
  tab: 3,
  tabs: 3,
  featureCount: 2,
  cards: ["종이 자르기", "종이 태우기", "얼음 녹기", "설탕을 물에 녹이기", "달걀 삶기", "철못이 녹슬기", "찰흙 모양 바꾸기", "우유가 상하기", "초가 타기", "초가 녹기"],
  criteria: {
    newprop: { label: "색·냄새·맛처럼 처음 물질에 없던 성질이 생겼나요?", observe: "변하기 전과 후 견주어 보기", group: {"종이 자르기": "생기지 않았다", "종이 태우기": "생겼다", "얼음 녹기": "생기지 않았다", "설탕을 물에 녹이기": "생기지 않았다", "달걀 삶기": "생겼다", "철못이 녹슬기": "생겼다", "찰흙 모양 바꾸기": "생기지 않았다", "우유가 상하기": "생겼다", "초가 타기": "생겼다", "초가 녹기": "생기지 않았다"} },
    heat: { label: "열을 가했나요?", observe: "어떻게 했는지 읽기", group: {"종이 자르기": "가하지 않았다", "종이 태우기": "가했다", "얼음 녹기": "가했다", "설탕을 물에 녹이기": "가하지 않았다", "달걀 삶기": "가했다", "철못이 녹슬기": "가하지 않았다", "찰흙 모양 바꾸기": "가하지 않았다", "우유가 상하기": "가하지 않았다", "초가 타기": "가했다", "초가 녹기": "가했다"} },
  },
  subjective: { label: "재미있어 보이나요?", groups: ["재미있어 보인다", "재미있어 보이지 않는다"] },
  radios: 3,
  finish: ["newprop", "heat"],
  wrong: { card: "종이 태우기", group: "생기지 않았다", sentence: "종이 태우기는 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?", tutor: "종이 태우기에서 관찰한 내용과 넣은 무리를 다시 비교해 볼까요?" },
  firstTutor: "카드들을 어떤 기준으로 나누어 볼까요?",
  finishedTutor: ["초가 탈 때와 초가 녹을 때는 어떻게 다를까요?", "열을 가한 카드끼리 모두 같은 무리에 들어갔나요?"],
  banned: ["화학 변화", "물리 변화", "산화", "분자"],
  icon: {
    svg: "property-icon",
    result: "pc-result",
    card: "초가 타기",
    obs: {"newprop": "초가 줄어들고 그을음이 생기며 타는 냄새가 나요. 줄어든 초는 다시 처음 초로 되돌릴 수 없어요.", "heat": "심지에 불을 붙였어요."},
    marks: [{ key: "newprop", sel: ".pc-newprop[data-newprop=\"true\"]" }, { key: "heat", sel: ".pc-heat[data-heat=\"true\"]" }],
    other: { card: "종이 태우기", key: "newprop", sel: ".pc-newprop[data-newprop=\"true\"]" },
  },
};

