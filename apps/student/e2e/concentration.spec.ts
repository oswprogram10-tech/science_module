import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const SPOONS = '넣은 설탕';
const WATER = '물의 양';
const SUGAR = '설탕 종류';
const CUP = '비커 모양';
const LIMITS = /농도|퍼센트|밀도|용해도|포화|부력/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g5-solution', { experiment: 'concentration', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '용해와 용액' })).toBeVisible();
}

/** 안전 점검표가 없는 활동이므로 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 뜬 높이·20 mL의 무게·색의 진하기: 네 조건 다음 세 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 7);
}

const floatOf = async (page: Page) => Number(await macro(page).getByTestId('conc-art').getAttribute('data-float'));
const barValues = async (page: Page) => (await bars(page).getByTestId('conc-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value')))));
const liquidFill = async (page: Page) => (await macro(page).getByTestId('liquid').getAttribute('data-fill'))!;

test('두 번째 활동 탭으로 열리고, 첫 활동(물에 녹는 용질의 양 비교하기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 녹인 설탕의 양이 다르면 용액의 진하기를 어떻게 비교할 수 있을까?')).toBeVisible();
  await expect(page.getByText('예측: 방울토마토가 뜬 높이는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g5-solution\/dissolve-amount$/);
  await expect(page.getByRole('group', { name: '용질의 종류' })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: SPOONS })).toBeVisible();
});

test('기준(1숟가락, 100 mL, 황설탕, 낮은 비커)이면 뜬 높이 0, 20.4 g, 색 2이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 방울토마토는 바닥, 용액에 색이 없음, 문구와 막대에 결과 없음
  expect(await floatOf(page)).toBe(0);
  await expect(macro(page).getByTestId('conc-note')).not.toContainText('방울토마토 높이');
  await expect(macro(page).getByTestId('conc-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('conc-bar')).toHaveCount(0);
  const plain = await liquidFill(page);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  // 안전 상시 안내
  await expect(page.getByText('⚠ 실험한 용액은 맛보지 않아요.')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, SPOONS);
  expect(await resultCells(resultRows(page).first())).toEqual(['0', '20.4', '2']);
  for (const h of ['방울토마토가 뜬 높이(눈금)', '20 mL의 무게(g)', '색의 진하기(눈금)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('conc-note')).toHaveText('3.0초 · 방울토마토 높이 0.0눈금 · 색의 진하기 2눈금');
  // 용액에 황설탕 색이 생긴다
  expect(await liquidFill(page)).not.toBe(plain);
  expect(await barValues(page)).toEqual([0]);
  await expect(page.getByText('가상 전자저울: 20 mL의 무게')).toBeVisible();
  await expectSensorNear(page, '무게', 20.4, 1);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('넣은 설탕만 3숟가락으로 바꾸면 4, 21.0 g, 색 5(늘어났다)이고 설탕 전용 질문이 나오며 막대가 둘이 된다', async ({ page }) => {
  await open(page);
  await baselineRun(page, SPOONS);
  await setValue(page, SPOONS, '3숟가락');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['4', '21.0', '5']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('넣은 설탕만 바꾸었어요. 방울토마토가 뜬 높이와 용액의 색은 각각 어떻게 달라졌나요?');
  expect(await floatOf(page)).toBe(4);
  expect(await barValues(page)).toEqual([0, 4]);
  await expect(macro(page).getByTestId('mix-label')).toHaveText('황설탕 3숟가락 · 물 100 mL');
  // 5숟가락: 9
  await setValue(page, SPOONS, '5숟가락');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['9', '21.5', '8']);
  expect(await barValues(page)).toEqual([0, 4, 9]);
});

test('물의 양만 50 mL로 바꾸면(3숟가락) 10, 21.8 g(늘어났다)이고 물의 양 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, SPOONS, '3숟가락');
  await baselineRun(page, WATER);
  expect(await resultCells(resultRows(page).first())).toEqual(['4', '21.0', '5']);
  await setValue(page, WATER, '50 mL');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['10', '21.8', '9']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('물의 양만 바꾸었어요. 넣은 설탕은 같은데 20 mL의 무게와 방울토마토가 뜬 높이는 각각 어떻게 달라졌나요?');
  expect(await floatOf(page)).toBe(10);
  await expect(macro(page).getByTestId('mix-label')).toHaveText('황설탕 3숟가락 · 물 50 mL');
});

test('설탕 종류만 흰 설탕으로 바꾸면 색의 진하기만 0이 되고 뜬 높이는 그대로(변하지 않았다)이며 용액에 색이 없다', async ({ page }) => {
  await open(page);
  await setValue(page, SPOONS, '3숟가락');
  await baselineRun(page, SUGAR);
  expect(await resultCells(resultRows(page).first())).toEqual(['4', '21.0', '5']);
  const brown = await liquidFill(page);
  await setValue(page, SUGAR, '흰 설탕');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['4', '21.0', '0']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('설탕 종류만 바꾸었어요. 용액의 색은 어떻게 달라졌나요?');
  expect(await liquidFill(page)).not.toBe(brown);
  await expect(macro(page).getByTestId('mix-label')).toHaveText('흰 설탕 3숟가락 · 물 100 mL');
});

test('대조 변인: 비커 모양만 높은 비커로 바꾸면 결과가 같고(변하지 않았다) 비커 전용 질문이 나오며 비커 그림이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, SPOONS, '5숟가락');
  await baselineRun(page, CUP);
  expect(await resultCells(resultRows(page).first())).toEqual(['9', '21.5', '8']);
  const width = async () => (await macro(page).locator('svg path[stroke-width="2.5"]').first().boundingBox())!.width;
  const low = await width();
  await setValue(page, CUP, '높은 비커');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['9', '21.5', '8']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('비커 모양만 바꾸었을 때 방울토마토가 뜬 높이는 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('cup-label')).toHaveText('높은 비커');
  expect(await width()).toBeLessThan(low);
  expect(await barValues(page)).toEqual([9, 9]);
});

test('막대 그래프는 시행마다 막대가 하나씩 생기고 값 글자와 시행 번호가 있다', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('뜬 높이(눈금)')).toBeVisible();
  await baselineRun(page, SPOONS);
  await setValue(page, SPOONS, '3숟가락');
  await run(page, '늘어난다');
  await expect(bars(page).getByTestId('conc-bar')).toHaveCount(2);
  await expect(bars(page).getByText('시행 번호')).toBeVisible();
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '5', '10', '1', '2', '4']) expect(texts).toContain(t);
});

test('그래프: y축 0~10 눈금(0, 2, 4, 6, 8, 10), x축 0~3초(0, 1, 2, 3), 바닥에서 시작해 뜬 높이에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, SPOONS, '5숟가락');
  await baselineRun(page, SPOONS);
  await expect(graph(page).getByText('방울토마토 높이(눈금)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '2', '4', '6', '8', '10']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2', '3']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 그림 좌표는 아래가 크다. 올라가므로 끝이 시작보다 위에 있다.
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  // 2초 이후에는 멈춘다
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 방울토마토가 바닥으로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  expect(await floatOf(page)).toBe(0);
});
