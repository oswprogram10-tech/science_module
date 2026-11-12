import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const MATERIAL = '데우는 것';
const SPOT = '데우는 곳';
const COLOR = '열 붙임딱지 색(물은 색소 색)';
const LIMITS = /전도|대류|복사|열전도율|비열/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g5-heat', { experiment: 'heat-transfer', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '열과 우리 생활' })).toBeVisible();
}

/** 이 활동에는 안전 점검표가 없으므로 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function baselineRun(page: Page, iv: string | RegExp) {
  await page.getByRole('radio', { name: iv instanceof RegExp ? iv : new RegExp(`^${iv}(을|를) 바꿀 조건으로 고르기$`) }).check();
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 걸린 시간·열이 퍼진 모습: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const stickers = (page: Page) => macro(page).getByTestId('sticker');
const changed = async (page: Page) => (await stickers(page).evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-order')), e.getAttribute('data-changed') === 'true'] as const))).filter((x) => x[1]).map((x) => x[0]);
const barValues = async (page: Page) => bars(page).getByTestId('transfer-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));
const slider = (page: Page) => page.getByRole('slider', { name: '그래프 시각 옮기기' });

test('네 번째 활동 탭으로 열리고(탭 넷), 앞의 활동으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(activityTab(page, 4)).toHaveAttribute('aria-selected', 'true');
  await expect(activityTab(page, 4)).toContainText('열이 이동하는 모습 관찰하기');
  await expect(page.getByText('탐구 질문: 열은 고체와 액체에서 각각 어떻게 이동할까?')).toBeVisible();
  await expect(page.getByText('예측: 가장 먼 곳까지 열이 전해진 시간은?')).toBeVisible();
  await activityTab(page, 3).click();
  await expect(page).toHaveURL(/#\/unit\/g5-heat\/thermometer$/);
  await activityTab(page, 4).click();
  await expect(page.getByRole('group', { name: MATERIAL, exact: true })).toBeVisible();
  await page.reload();
  await expect(activityTab(page, 4)).toHaveAttribute('aria-selected', 'true');
});

test('기준(구리판, 가장자리, 분홍색)이면 40초·둥글게 번짐이고 실행 전에는 색 변화와 퍼진 모습이 없다', async ({ page }) => {
  await open(page);
  await expect(stickers(page)).toHaveCount(49);
  expect(await changed(page)).toEqual([]);
  await expect(macro(page).getByTestId('heat-transfer-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('transfer-bar')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  const mainText = await page.locator('main').innerText();
  expect(mainText).not.toMatch(LIMITS);
  expect(mainText).not.toContain('둥글게 번짐');

  await baselineRun(page, MATERIAL);
  expect(await resultCells(resultRows(page).first())).toEqual(['40', '데운 곳 둘레부터 둥글게 번짐']);
  for (const h of ['가장 먼 곳까지 걸린 시간(초)', '열이 퍼진 모습']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  // 재생이 끝나면 모든 붙임딱지의 색이 바뀌어 있다.
  expect((await changed(page)).length).toBe(49);
  expect(await barValues(page)).toEqual([40]);
  await expect(page.getByText('가상 초시계')).toBeVisible();
  await expectSensorNear(page, '시간', 40, 0.5);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('붙임딱지는 데운 곳에서 가까운 것부터 시간에 맞춰 색이 바뀐다(슬라이더로 중간 시각을 본다)', async ({ page }) => {
  await open(page);
  await baselineRun(page, MATERIAL);
  await slider(page).focus();
  await slider(page).press('Home');
  expect(await changed(page)).toEqual([]);
  // 13초(PageUp 한 번): 일부만 바뀌었고, 바뀐 것은 데운 곳에서 가까운 순서(앞 번호)부터 연달아 있다.
  await slider(page).press('PageUp');
  const part = await changed(page);
  expect(part.length).toBeGreaterThan(0);
  expect(part.length).toBeLessThan(49);
  expect(part).toEqual(Array.from({ length: part.length }, (_, i) => i));
  // 더 지나면 더 많이 바뀐다.
  await slider(page).press('PageUp');
  expect((await changed(page)).length).toBeGreaterThan(part.length);
  await slider(page).press('End');
  expect((await changed(page)).length).toBe(49);
});

test('데우는 곳만 가운데로 바꾸면 25초(줄어들었다)이고 데우는 곳 전용 질문이 나오며 촛불 표시가 옮겨 간다', async ({ page }) => {
  await open(page);
  await baselineRun(page, SPOT);
  const edgeX = Number(await macro(page).getByTestId('candle').getAttribute('cx'));
  await setValue(page, SPOT, '가운데');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['25', '데운 곳 둘레부터 둥글게 번짐']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('데우는 곳만 바꾸었어요. 색이 바뀐 순서는 어떻게 달라졌나요?');
  expect(Number(await macro(page).getByTestId('candle').getAttribute('cx'))).toBeGreaterThan(edgeX);
  expect(await barValues(page)).toEqual([40, 25]);
});

test('데우는 것만 철판으로 바꾸면 120초(늘어났다)이고 데우는 것 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, MATERIAL);
  await setValue(page, MATERIAL, '철판');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['120', '데운 곳 둘레부터 둥글게 번짐']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('데우는 것만 바꾸었어요. 가장 먼 곳까지 걸린 시간과 퍼진 모습은 어떻게 달랐나요?');
  expect(await barValues(page)).toEqual([40, 120]);
  await expectSensorNear(page, '시간', 120, 0.5);
  expect((await changed(page)).length).toBe(49);
});

test('비커 속 물: 실행 전에는 색소 띠가 없고, 실행하면 데운 곳 위로 올라가 퍼진 뒤 내려오는 띠가 그려지며 60초·범주 글자가 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, MATERIAL, '비커 속 물');
  // 판 그림 대신 비커 그림: 붙임딱지가 없고 색소 알갱이만 있다.
  await expect(stickers(page)).toHaveCount(0);
  await expect(macro(page).getByTestId('dye-grain')).toHaveCount(1);
  await expect(macro(page).getByTestId('dye-band')).toHaveCount(0);
  await expect(macro(page).getByTestId('material-label')).toContainText('비커 바닥 가장자리');
  await baselineRun(page, MATERIAL);
  expect(await resultCells(resultRows(page).first())).toEqual(['60', '데운 곳 위로 올라가 위에서 옆으로 퍼진 뒤 내려옴']);
  await expect(macro(page).getByTestId('dye-band')).toHaveCount(1);
  // 끝에서는 띠가 반대쪽 바닥까지 이어지고(꺾은선 점 4개), 처음 순간에는 길이가 0이다.
  const points = async () => ((await macro(page).getByTestId('dye-band').first().getAttribute('points')) ?? '').trim().split(/\s+/);
  expect((await points()).length).toBe(4);
  await slider(page).focus();
  await slider(page).press('Home');
  expect(new Set(await points()).size).toBe(1);
  await slider(page).press('PageUp');
  const early = await points();
  expect(early.length).toBeGreaterThanOrEqual(2);
  // 가운데를 데우면 색소 띠가 두 갈래로 나뉜다(45초).
  await setValue(page, SPOT, '가운데');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['45', '데운 곳 위로 올라가 위에서 옆으로 퍼진 뒤 내려옴']);
  await expect(macro(page).getByTestId('dye-band')).toHaveCount(2);
});

test('대조 변인: 붙임딱지 색만 파란색으로 바꾸면 결과가 같고(변하지 않았다) 색 전용 질문이 나오며 딱지 색이 바뀐다', async ({ page }) => {
  await open(page);
  await baselineRun(page, /^열 붙임딱지 색/);
  const fill = async () => stickers(page).first().getAttribute('fill');
  const before = await fill();
  await setValue(page, COLOR, '파란색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['40', '데운 곳 둘레부터 둥글게 번짐']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('붙임딱지(색소) 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('color-label')).toContainText('파란색');
  // 바뀐 뒤의 딱지 색은 같은 흰색이라 같다. 실행 전(앞 시행 후 새 조건)의 딱지 색은 파란색 계열이다.
  expect(await fill()).toBe(before);
  expect(await barValues(page)).toEqual([40, 40]);
});

test('튜터 예측 불일치 질문은 판과 물의 모양을 눈으로 보기 그림으로 다시 보라고 한다', async ({ page }) => {
  await open(page);
  await baselineRun(page, MATERIAL);
  await setValue(page, MATERIAL, '철판');
  await run(page, '줄어든다');
  await expect(tutorBox(page)).toContainText('판과 물에서 열이 이동하는 모습은 어떻게 다를까요? 눈으로 보기 그림을 다시 볼까요?');
  expect(await tutorBox(page).innerText()).not.toMatch(LIMITS);
});

test('그래프: y축 0~100 %(0, 25, 50, 75, 100), x축 0~130초(0, 65, 130), 걸린 시간에 100 %가 되고 그 뒤 수평이다', async ({ page }) => {
  await open(page);
  await baselineRun(page, MATERIAL);
  await expect(graph(page).getByText('색이 바뀐 비율(%)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '25', '50', '75', '100']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '65', '130']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
  await expect(bars(page).getByText('걸린 시간(초)')).toBeVisible();
});
