import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const globe = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const flat = (page: Page) => page.getByRole('figure', { name: '평면 지도' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const DOTS = '찍은 점의 수';
const ROUND = '점 찍기 차례';
const GLOBE = '지구본 받침 색';
const LIMITS = /확률|표본|대수의 법칙|오차 범위/;

async function open(page: Page) {
  await gotoUnit(page, 'g3-earth-sea', { experiment: 'land-sea-dots' });
  await expect(page.getByRole('heading', { level: 1, name: '지구와 바다' })).toBeVisible();
}

/** 이 활동에는 안전 점검표가 없으므로 바로 재생된다. */
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

/** 결과표 한 줄의 바다 비율·바다 점·육지 점: 세 조건 다음 세 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 6);
}

const mapDots = (page: Page, kind: 'sea' | 'land') => flat(page).locator(`[data-testid="map-dot"][data-kind="${kind}"]`);

test('활동이 셋이라 탭 셋이 보이고, 세 번째 활동으로 열리며 앞 활동으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
  await expect(activityTab(page, 3)).toContainText('육지와 바다의 넓이 비교하기');
  await expect(page.getByText('탐구 질문: 지구의 겉은 육지와 바다 가운데 어느 쪽이 더 넓을까?')).toBeVisible();
  await expect(page.getByText('예측: 바다에 떨어진 점의 비율은?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page).toHaveURL(/#\/unit\/g3-earth-sea\/tide$/);
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g3-earth-sea\/sea-water$/);
  await activityTab(page, 3).click();
  await expect(page.getByRole('group', { name: DOTS, exact: true })).toBeVisible();
  await page.reload();
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
});

test('기준(10개, 첫째, 빨간색)이면 바다 80 %이고 실행 전에는 점이 하나도 없다', async ({ page }) => {
  await open(page);
  // 실행 전: 점·결과 문구가 없고, 지구본과 평면 지도만 있다.
  await expect(globe(page).getByTestId('globe-dot')).toHaveCount(0);
  await expect(flat(page).getByTestId('map-dot')).toHaveCount(0);
  await expect(globe(page).getByTestId('land-sea-note')).toContainText('실험하면');
  await expect(globe(page).getByTestId('globe-land')).toBeVisible();
  await expect(flat(page).getByTestId('map-land')).toBeVisible();
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, DOTS);
  expect(await resultCells(resultRows(page).first())).toEqual(['80', '8', '2']);
  for (const h of ['바다에 떨어진 점의 비율(%)', '바다에 떨어진 점(개)', '육지에 떨어진 점(개)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  // 바다 점은 원, 육지 점은 세모
  await expect(mapDots(page, 'sea')).toHaveCount(8);
  await expect(mapDots(page, 'land')).toHaveCount(2);
  await expect(flat(page).locator('polygon[data-testid="map-dot"]')).toHaveCount(2);
  await expect(flat(page).locator('circle[data-testid="map-dot"]')).toHaveCount(8);
  await expect(globe(page).getByTestId('land-sea-note')).toHaveText('10개 찍음 · 바다 8개(원) · 육지 2개(세모) · 바다 비율 80 %');
  await expect(page.getByText('가상 계수기: 바다 점 비율')).toBeVisible();
  await expect.poll(async () => Math.abs(parseFloat(await page.getByRole('status', { name: '바다 점 비율', exact: true }).innerText()) - 80)).toBeLessThanOrEqual(1);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('점을 500개로 늘리면 비율이 67 %로 자리 잡고(줄어들었다) 점의 수 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, DOTS);
  await setValue(page, DOTS, '500개');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['67', '333', '167']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('점을 10개 찍었을 때와 500개 찍었을 때 비율은 어떻게 다른가요? 어느 쪽 결과를 더 믿을 수 있을까요?');
  await expect(flat(page).getByTestId('map-dot')).toHaveCount(500);
  const globeDots = await globe(page).getByTestId('globe-dot').count();
  expect(globeDots).toBeGreaterThan(100);
  expect(globeDots).toBeLessThan(400);
  await expect(globe(page).getByTestId('land-sea-note')).toContainText('500개 찍음 · 바다 333개(원) · 육지 167개(세모) · 바다 비율 67 %');
});

test('점 찍기 차례만 바꾸면 10개일 때 결과가 달라지고, 같은 조건은 언제나 같은 결과다', async ({ page }) => {
  await open(page);
  await baselineRun(page, ROUND);
  await setValue(page, ROUND, '둘째');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['70', '7', '3']);
  await expect(tutorBox(page)).toContainText('점 찍기 차례만 바꾸었어요. 결과가 같았나요? 점의 수에 따라 차례마다 차이가 어떻게 달랐나요?');
  await setValue(page, ROUND, '첫째');
  await run(page, '늘어난다');
  const row3 = resultRows(page).nth(2);
  expect(await resultCells(row3)).toEqual(['80', '8', '2']);
  expect(await resultCells(resultRows(page).first())).toEqual(['80', '8', '2']);
});

test('대조 변인: 지구본 받침 색만 파란색으로 바꾸면 결과가 같고(변하지 않았다) 받침 전용 질문이 나오며 받침 색만 바뀐다', async ({ page }) => {
  await open(page);
  await baselineRun(page, GLOBE);
  expect(await resultCells(resultRows(page).first())).toEqual(['80', '8', '2']);
  const before = (await globe(page).getByTestId('globe-stand').getAttribute('data-fill'))!;
  await setValue(page, GLOBE, '파란색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['80', '8', '2']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('받침 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await globe(page).getByTestId('globe-stand').getAttribute('data-fill')).not.toBe(before);
  await expect(globe(page).getByTestId('stand-label')).toContainText('파란색');
  await expect(mapDots(page, 'sea')).toHaveCount(8);
});

test('그래프: y축 0~100 %(20 간격), x축은 찍은 점 순서이고 재생 끝에 점의 수에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, DOTS, '100개');
  await baselineRun(page, DOTS);
  await expect(graph(page).getByText('지금까지 바다 비율(%)').first()).toBeVisible();
  await expect(graph(page).getByText('찍은 점 순서(번째)')).toBeVisible();
  const yTicks = await graph(page).locator('text[text-anchor="end"]').allTextContents();
  expect(yTicks).toEqual(['0', '20', '40', '60', '80', '100']);
  const xTicks = (await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x));
  expect(Number(xTicks.at(-1))).toBeGreaterThanOrEqual(100);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuemax', '100');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.length).toBeGreaterThan(50);
  // 슬라이더를 처음으로 옮기면 점이 사라진다.
  await slider.focus();
  await slider.press('Home');
  await expect(flat(page).getByTestId('map-dot')).toHaveCount(0);
});
