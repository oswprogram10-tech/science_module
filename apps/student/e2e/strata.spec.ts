import {
  test,
  expect,
  gotoUnit,
  scrollWidth,
  sortFeedback,
  sortTutor,
  STRATA_ORDER,
  STRATA_PILE,
  strataCard,
  strataEnvCheck,
  strataEnvPut,
  strataFill,
  strataFinishEnv,
  strataFinishOrder,
  strataObserveButton,
  strataOrderCheck,
  strataPlace,
  strataProgress,
  strataSlotButton,
} from './helpers';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await gotoUnit(page, 'g5-strata');
});

const magnifier = (page: Page) => page.getByRole('region', { name: '돋보기' });
const body = (page: Page) => page.locator('body');

test('처음 화면: 질문, 안내 문구, 배경 지식 카드, 처음 더미 순서, 칸 5개, 확인 꺼짐', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '지층과 화석' })).toBeVisible();
  await expect(page.getByText('탐구 질문: 지층이 쌓인 순서와 그때의 환경을 어떻게 알 수 있을까?')).toBeVisible();
  await expect(page.getByText('이 절벽의 지층은 쌓인 뒤에 뒤집히지 않았어요.')).toBeVisible();
  await expect(page.getByText('조개·산호는 물속, 특히 바다에서 살아요. 고사리·나뭇잎은 땅에서 자라요.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '배경 지식' })).toBeVisible();
  // 처음 더미 순서는 셰일, 사암, 역암, 석회암, 이암이다.
  await expect(page.locator('.sort-pile .sort-card-name')).toHaveText([...STRATA_PILE]);
  for (let n = 1; n <= 5; n++) await expect(strataSlotButton(page, n)).toBeDisabled();
  await expect(strataOrderCheck(page)).toBeDisabled();
  await expect(sortTutor(page)).toContainText('어떤 표본부터 살펴볼까요?');
  await expect(strataEnvCheck(page)).toHaveCount(0);
  await expect(page.getByText('이 층이 쌓일 때 그곳은 어떤 곳이었을까요?')).toHaveCount(0);
});

test('맨 아래 칸 옆에 "먼저 쌓임", 맨 위 칸 옆에 "나중에 쌓임"이 보이고 칸이 아래에서 위로 쌓인다', async ({ page }) => {
  const first = page.getByRole('group', { name: '1번째로 쌓인 층' });
  const last = page.getByRole('group', { name: '5번째로 쌓인 층' });
  await expect(page.getByText('먼저 쌓임', { exact: true })).toBeVisible();
  await expect(page.getByText('나중에 쌓임', { exact: true })).toBeVisible();
  await expect(page.locator('.order-slot').first().getByText('먼저 쌓임')).toBeVisible();
  await expect(page.locator('.order-slot').last().getByText('나중에 쌓임')).toBeVisible();
  const [a, b, c] = await Promise.all([first.boundingBox(), last.boundingBox(), page.getByText('먼저 쌓임', { exact: true }).boundingBox()]);
  expect(a!.y).toBeGreaterThan(b!.y); // 1번째 칸이 5번째 칸보다 아래에 있다
  // "먼저 쌓임" 글자가 맨 아래 칸과 같은 높이에 있다.
  expect(Math.abs(c!.y + c!.height / 2 - (a!.y + a!.height / 2))).toBeLessThan(a!.height);
});

test('높이를 관찰하지 않고 5칸을 채운 뒤 확인하면 "아직 채집 높이를 확인하지 않았어요"가 보인다', async ({ page }) => {
  await strataFill(page, STRATA_ORDER, []);
  await expect(strataOrderCheck(page)).toBeEnabled();
  await strataOrderCheck(page).click();
  await expect(page.getByText('아직 채집 높이를 확인하지 않았어요')).toBeVisible();
  await expect(sortTutor(page)).toContainText('역암은 아직 채집 높이를 확인하지 않았어요.');
  // 어느 칸이 맞는지는 말하지 않는다.
  for (const box of [sortFeedback(page), sortTutor(page)]) await expect(box).not.toContainText(/\d번째/);
  await expect(page.getByText('이 층이 쌓일 때 그곳은 어떤 곳이었을까요?')).toHaveCount(0);
});

test('모두 관찰한 뒤 사암과 이암을 바꿔 놓고 확인하면 두 카드 이름이 문장에 있고, 고치면 환경 칸이 나타난다', async ({ page }) => {
  await strataFill(page, ['역암', '이암', '사암', '석회암', '셰일']);
  await strataOrderCheck(page).click();
  await expect(sortFeedback(page)).toContainText('사암, 이암은');
  await expect(sortFeedback(page)).toContainText('차례가 맞지 않아요');
  await expect(sortTutor(page)).toContainText('사암의 채집 높이와 놓은 차례를 다시 비교해 볼까요? 흙이 쌓일 때 어느 쪽부터 쌓일까요?');
  // 정답 칸 번호나 높이 숫자를 말하지 않는다.
  for (const box of [sortFeedback(page), sortTutor(page)]) await expect(box).not.toContainText(/\d번째|\d\.\d|칸에 놓/);
  await expect(page.getByRole('group', { name: '바다' })).toHaveCount(0);

  // 고친다: 사암을 2번째 칸에 놓으면 이암과 자리를 바꾼다.
  await strataCard(page, '사암').click();
  await strataSlotButton(page, 2).click();
  await expect(sortFeedback(page)).toContainText('표본을 칸에 놓고 확인하기를 누르면');
  await strataOrderCheck(page).click();
  await expect(sortFeedback(page)).toContainText('채집한 높이와 쌓인 차례가 서로 잘 맞아요.');
  await expect(sortTutor(page)).toContainText('높이와 차례가 잘 맞아요. 이번에는 화석을 보고 그때 그곳이 어떤 곳이었을지 생각해 볼까요?');
  await expect(page.getByRole('heading', { name: '이 층이 쌓일 때 그곳은 어떤 곳이었을까요?' })).toBeVisible();
  for (const g of ['바다', '육지', '화석이 없어 알 수 없음']) await expect(strataEnvPut(page, g)).toBeVisible();
  await expect(strataEnvCheck(page)).toBeDisabled();
  await expect(strataProgress(page)).toContainText('쌓인 차례: 맞게 놓았어요');
});

test('빈 칸이 있으면 확인할 수 없고, 칸이 찬 곳에 놓으면 두 표본이 자리를 바꾼다', async ({ page }) => {
  await strataPlace(page, '셰일', 1);
  await expect(strataOrderCheck(page)).toBeDisabled();
  await strataPlace(page, '사암', 1); // 셰일이 있던 칸: 셰일은 더미로 돌아간다
  await expect(page.locator('.sort-pile .sort-card-name')).toContainText(['셰일']);
  await expect(page.getByRole('group', { name: '1번째로 쌓인 층' })).toContainText('사암');
  await strataPlace(page, '역암', 2);
  // 칸에 있는 사암을 골라 2번째 칸에 놓으면 역암과 맞바꾼다.
  await page.getByRole('group', { name: '1번째로 쌓인 층' }).getByRole('button', { name: /^사암 관찰/ }).click();
  await strataSlotButton(page, 2).click();
  await expect(page.getByRole('group', { name: '1번째로 쌓인 층' })).toContainText('역암');
  await expect(page.getByRole('group', { name: '2번째로 쌓인 층' })).toContainText('사암');
  // 빼기
  await page.getByRole('button', { name: '사암 빼기' }).click();
  await expect(page.getByRole('group', { name: '2번째로 쌓인 층' })).toContainText('비어 있음');
  await expect(page.locator('.sort-pile .sort-card-name')).toContainText(['사암']);
});

test('화석을 살펴보기 전에는 카드 그림에 화석 모양이 없고, 살펴본 표본에만 나타난다', async ({ page }) => {
  const fossil = page.getByTestId('fossil-shape');
  await strataCard(page, '사암').click();
  await expect(fossil).toHaveCount(0);
  await strataObserveButton(page, '높이 확인하기').click();
  await strataObserveButton(page, '알갱이 살펴보기').click();
  await expect(fossil).toHaveCount(0);
  await strataObserveButton(page, '화석 살펴보기').click();
  await expect(fossil).toHaveCount(1);
  await expect(page.getByRole('list', { name: '사암 관찰 기록' })).toContainText('조개 껍데기 모양의 화석이 있어요.');
  // 다른 표본을 고르면 그 표본에서 살펴본 것만 그려진다.
  await strataCard(page, '이암').click();
  await expect(fossil).toHaveCount(0);
  // 화석이 없는 표본은 살펴본 뒤에도 모양이 없다.
  await strataCard(page, '역암').click();
  await strataObserveButton(page, '화석 살펴보기').click();
  await expect(fossil).toHaveCount(0);
  await expect(page.getByRole('list', { name: '역암 관찰 기록' })).toContainText('화석이 보이지 않아요.');
});

test('높이 숫자와 안 살펴본 문장은 관찰하기 전에 화면에 없다', async ({ page }) => {
  await strataCard(page, '이암').click();
  for (const s of ['2.5 m', '아주 고운 진흙이 굳어 있어요.', '고사리 잎 모양의 화석이 있어요.']) await expect(body(page)).not.toContainText(s);
  await strataObserveButton(page, '높이 확인하기').click();
  await expect(magnifier(page)).toContainText('절벽 바닥에서 2.5 m 높이에서 채집했어요.');
  await expect(body(page)).not.toContainText('고사리 잎 모양의 화석이 있어요.');
  await expect(body(page)).not.toContainText('아주 고운 진흙이 굳어 있어요.');
  // 다른 표본의 높이도 아직 보이지 않는다.
  for (const h of ['0.5 m', '1.5 m', '3.5 m', '4.5 m']) await expect(body(page)).not.toContainText(h);
});

test('정답 값을 담은 속성이 없고(data-testid 제외) 정답 칸 번호가 어디에도 없다', async ({ page }) => {
  await strataFill(page, STRATA_PILE);
  await strataOrderCheck(page).click();
  const leaked = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if (a.name.startsWith('data-') && a.name !== 'data-testid') bad.push(`${el.tagName}[${a.name}]`);
        if (/^(yes|no|sea|land|unknown|clam|fern|coral|leaf|gravel|sand|mud|fine)$/.test(a.value) && a.name !== 'value') bad.push(`${el.tagName}[${a.name}=${a.value}]`);
        if (/correct|answer|truth/i.test(a.name)) bad.push(`${el.tagName}[${a.name}]`);
      }
    }
    return bad;
  });
  expect(leaked).toEqual([]);
  // 색이나 표시로 칸의 정답 여부를 알려 주지 않는다: 칸 옆 글자는 "먼저 쌓임"과 "나중에 쌓임"뿐이다.
  const edges = await page.locator('.order-edge').allTextContents();
  expect(edges.filter(Boolean)).toEqual(['먼저 쌓임', '나중에 쌓임']);
});

test('순서를 맞추기 전에는 환경 칸이 없고, 맞춘 뒤에는 칸 옆에 학생이 넣은 환경 글자만 표시된다', async ({ page }) => {
  await expect(page.getByRole('group', { name: '바다' })).toHaveCount(0);
  await strataFinishOrder(page);
  await expect(page.getByRole('group', { name: '바다' })).toBeVisible();
  await expect(page.locator('.order-env')).toHaveCount(0);
  await strataCard(page, '사암').click();
  await strataObserveButton(page, '화석 살펴보기').click();
  await strataEnvPut(page, '육지').click(); // 일부러 틀리게 넣는다
  await expect(page.getByRole('group', { name: '2번째로 쌓인 층' }).locator('.order-env')).toHaveText('육지');
  await expect(page.locator('.order-env')).toHaveCount(1);
  // 순서를 맞춘 뒤에는 칸을 더 바꾸지 못한다.
  await expect(strataSlotButton(page, 1)).toBeDisabled();
  await expect(page.getByRole('button', { name: '역암 빼기' })).toHaveCount(0);
});

test('환경 단계: 화석을 안 살펴보면 안내하고, 틀리게 넣으면 다시 비교하라고 하며, 정답 무리는 말하지 않는다', async ({ page }) => {
  await strataFinishOrder(page);
  for (const card of STRATA_ORDER) {
    await strataCard(page, card).click();
    await strataEnvPut(page, '바다').click();
  }
  await strataEnvCheck(page).click();
  await expect(sortFeedback(page)).toContainText('역암, 사암, 이암, 석회암, 셰일은 화석을 아직 살펴보지 않았어요.');
  await expect(sortTutor(page)).toContainText('역암은 아직 화석을 살펴보지 않았어요. 화석을 먼저 살펴볼까요?');

  for (const card of STRATA_ORDER) {
    await strataCard(page, card).click();
    await strataObserveButton(page, '화석 살펴보기').click();
  }
  await strataEnvCheck(page).click();
  // 바다에 모두 넣었으므로 바다가 아닌 표본(역암, 이암, 셰일)이 다시 비교 대상이다.
  await expect(sortFeedback(page)).toContainText('역암, 이암, 셰일은 화석에서 관찰한 내용과 넣은 무리가 서로 맞는지 다시 살펴볼까요?');
  await expect(sortTutor(page)).toContainText('역암의 화석이 보여 주는 것과 넣은 무리를 다시 비교해 볼까요?');
  for (const box of [sortFeedback(page), sortTutor(page)]) {
    await expect(box).not.toContainText('육지예요');
    await expect(box).not.toContainText('알 수 없음');
  }
  await expect(page.getByText('지층의 차례와 그때의 환경을 모두 알아냈어요!')).toHaveCount(0);
});

test('followUp을 모두 맞게 넣으면 완료 문구와 마무리 질문이 보인다', async ({ page }) => {
  await strataFinishOrder(page);
  await strataFinishEnv(page);
  await expect(page.getByText('지층의 차례와 그때의 환경을 모두 알아냈어요!')).toBeVisible();
  await expect(strataProgress(page)).toContainText('그때의 환경: 확인했어요');
  await expect(sortTutor(page)).toContainText('쌓인 차례와 환경을 함께 보면, 이곳의 환경은 시간이 지나며 어떻게 바뀌었을까요?');
  await expect(sortFeedback(page)).toContainText('화석에서 관찰한 내용과 넣은 무리가 서로 잘 맞아요.');
  // 칸 옆에는 학생이 넣은 환경 글자가 표시된다.
  await expect(page.getByRole('group', { name: '1번째로 쌓인 층' }).locator('.order-env')).toHaveText('화석이 없어 알 수 없음');
  await expect(page.getByRole('group', { name: '5번째로 쌓인 층' }).locator('.order-env')).toHaveText('육지');
});

test('결과표에는 학생이 한 활동만 있다', async ({ page }) => {
  const table = page.locator('#results-table');
  await expect(table.locator('tbody td:nth-child(3)')).toHaveText(['–', '–', '–', '–', '–']);
  await strataPlace(page, '사암', 3, ['높이 확인하기', '화석 살펴보기']);
  const row = table.locator('tbody tr', { has: page.getByRole('rowheader', { name: '사암' }) });
  await expect(row).toContainText('채집 높이, 화석');
  await expect(row).toContainText('3번째');
  await expect(table).not.toContainText('알갱이');
});

test('키보드만으로 고르기·관찰·놓기·빼기를 할 수 있다', async ({ page }) => {
  await strataCard(page, '셰일').focus();
  await page.keyboard.press('Enter');
  await expect(strataCard(page, '셰일')).toHaveAttribute('aria-pressed', 'true');
  const obs = strataObserveButton(page, '높이 확인하기');
  await obs.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('list', { name: '셰일 관찰 기록' })).toContainText('4.5 m');
  const slot = strataSlotButton(page, 5);
  await slot.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: '5번째로 쌓인 층' })).toContainText('셰일');
  const remove = page.getByRole('button', { name: '셰일 빼기' });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: '5번째로 쌓인 층' })).toContainText('비어 있음');
});

test('그림은 장식이고 SVG 글자는 13 px 이상이다', async ({ page }) => {
  await strataCard(page, '사암').click();
  await strataObserveButton(page, '화석 살펴보기').click();
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('svg.strata-icon')].flatMap((svg) => {
      const s = svg as unknown as SVGSVGElement;
      const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      return [...s.querySelectorAll('text')].map((t) => ({ text: t.textContent ?? '', px: parseFloat(getComputedStyle(t).fontSize) * scale }));
    }),
  );
  for (const { text, px } of sizes) expect(px, text).toBeGreaterThanOrEqual(13);
  await expect(page.locator('svg.strata-icon')).toHaveCount(6); // 더미 5장 + 돋보기 1장
});

test('움직임 줄이기: 화석 모양에 애니메이션이 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await strataCard(page, '석회암').click();
  await strataObserveButton(page, '화석 살펴보기').click();
  const name = await page.getByTestId('fossil-shape').evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe('none');
});

test.describe('휴대폰 폭', () => {
  test.use({ viewport: { width: 390, height: 800 } });
  test('가로 스크롤이 없다 (처음, 관찰한 뒤, 모두 놓은 뒤, 환경 칸이 열린 뒤)', async ({ page }) => {
    const noScroll = async () => {
      const { sw, iw } = await scrollWidth(page);
      expect(sw).toBeLessThanOrEqual(iw);
    };
    await noScroll();
    await strataCard(page, '이암').click();
    await strataObserveButton(page, '화석 살펴보기').click();
    await noScroll();
    await strataFill(page);
    await noScroll();
    await strataOrderCheck(page).click();
    await expect(page.getByRole('group', { name: '바다' })).toBeVisible();
    await noScroll();
    await strataFinishEnv(page);
    await expect(page.getByText('지층의 차례와 그때의 환경을 모두 알아냈어요!')).toBeVisible();
    await noScroll();
  });
  test('칸 목록이 세로이고 "먼저 쌓임"과 "나중에 쌓임"이 보인다', async ({ page }) => {
    const boxes = await Promise.all([1, 2, 3, 4, 5].map((n) => page.getByRole('group', { name: `${n}번째로 쌓인 층` }).boundingBox()));
    for (let i = 1; i < 5; i++) expect(boxes[i]!.y).toBeLessThan(boxes[i - 1]!.y); // 위로 갈수록 나중
    for (const b of boxes) expect(b!.x + b!.width).toBeLessThanOrEqual(390);
    await expect(page.getByText('먼저 쌓임', { exact: true })).toBeVisible();
    await expect(page.getByText('나중에 쌓임', { exact: true })).toBeVisible();
  });
});
