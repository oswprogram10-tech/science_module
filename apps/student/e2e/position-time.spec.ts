import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const logFig = (page: Page) => page.getByRole('figure', { name: '위치 기록표' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const OBJECT = '보는 물체';
const WATCH = '관찰 시간';
const WEATHER = '날씨';
// 한계 용어
const LIMITS = /속도|가속도|변위|등속|벡터/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g6-motion', { experiment: 'position-time', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '물체의 운동' })).toBeVisible();
}

/** 안전 점검표는 없다(안전 항목이 없는 활동). */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog', { name: '안전 점검표' })).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 움직인 거리·나중 위치: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const logRowsOf = async (page: Page) => await logFig(page).getByTestId('log-row').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-t')), e.getAttribute('data-pos')]));

test('두 번째 활동 탭으로 열리고, 첫 활동(수레의 속력)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 어떤 물체가 운동했는지 어떻게 알 수 있을까?')).toBeVisible();
  await expect(page.getByText('예측: 관찰하는 동안 물체가 움직인 거리는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g6-motion\/ramp-cart$/);
  await expect(activityTab(page, 1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 수레를 놓는 높이를 바꾸면 수레의 빠르기는 어떻게 달라질까?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: OBJECT })).toBeVisible();
});

test('기준(자전거, 5초, 맑음)이면 20.00 m, 20.00 m이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 출발 위치(0.00 m)에 서 있고 겹침 그림·기록이 없다
  await expect(macro(page).getByTestId('pos-art')).toHaveAttribute('data-ran', 'no');
  await expect(macro(page).getByTestId('pos-art')).toHaveAttribute('data-pos', '0.00');
  await expect(macro(page).getByTestId('flash')).toHaveCount(0);
  await expect(macro(page).getByTestId('pos-label')).toHaveText('실험하면 위치가 나타나요');
  await expect(logFig(page).getByTestId('log-row')).toHaveCount(0);
  await expect(page.getByText('아직 실험한 결과가 없어요.')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, OBJECT);
  expect(await resultCells(resultRows(page).first())).toEqual(['20.00', '20.00']);
  for (const h of ['움직인 거리(m)', '나중 위치(m)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('pos-label')).toHaveText('지금 위치 20.00 m');
  await expect(macro(page).getByTestId('pos-art')).toHaveAttribute('data-ghosts', '5');
  await expect(macro(page).getByTestId('flash')).toHaveCount(5);
  expect(await logRowsOf(page)).toEqual([[0, '0.00'], [1, '4.00'], [2, '8.00'], [3, '12.00'], [4, '16.00'], [5, '20.00']]);
  // 가상 센서는 없다
  await expect(page.getByRole('group', { name: '센서' })).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('보는 물체만 걷는 사람으로 바꾸면 6.00 m(줄어들었다)이고 물체 전용 질문이 나오며 위치 기록표가 바뀐다', async ({ page }) => {
  await open(page);
  await baselineRun(page, OBJECT);
  await setValue(page, OBJECT, '걷는 사람');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['6.00', '6.00']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('보는 물체만 바꾸었어요. 같은 시간 동안 물체마다 움직인 거리는 어떻게 달랐나요?');
  await expect(macro(page).getByTestId('object-label')).toHaveText('보는 물체: 걷는 사람');
  expect(await logRowsOf(page)).toEqual([[0, '0.00'], [1, '1.20'], [2, '2.40'], [3, '3.60'], [4, '4.80'], [5, '6.00']]);
  // 달팽이 0.05 m, 나무 0.00 m
  await setValue(page, OBJECT, '달팽이');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['0.05', '0.05']);
  await setValue(page, OBJECT, '나무');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(3))).toEqual(['0.00', '0.00']);
  await expect(macro(page).getByTestId('flash')).toHaveCount(0);
});

test('관찰 시간만 10초로 바꾸면 40.00 m(늘어났다)이고 관찰 시간 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, WATCH);
  await setValue(page, WATCH, '10초');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['40.00', '40.00']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('관찰 시간만 바꾸었어요. 시간이 달라지면 같은 물체의 위치는 어떻게 달라졌나요?');
  expect((await logRowsOf(page)).length).toBe(11);
});

test('대조 변인: 날씨만 흐림으로 바꾸면 결과가 같고(변하지 않았다) 날씨 전용 질문이 나오며 날씨 그림이 바뀐다', async ({ page }) => {
  await open(page);
  await baselineRun(page, WEATHER);
  await expect(macro(page).getByTestId('weather-icon')).toHaveAttribute('data-weather', 'sunny');
  await setValue(page, WEATHER, '흐림');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['20.00', '20.00']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('날씨만 바꾸었을 때 움직인 거리는 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('weather-icon')).toHaveAttribute('data-weather', 'cloudy');
  await expect(macro(page).getByTestId('weather-label')).toHaveText('날씨: 흐림');
});

test('그래프: y축 0~40 m(0, 10, …, 40), x축 0~10초(0, 2, …, 10), 슬라이더를 처음으로 옮기면 출발 위치로 돌아온다', async ({ page }) => {
  await open(page);
  await setValue(page, WATCH, '10초');
  await baselineRun(page, OBJECT);
  await expect(graph(page).getByText('위치(m)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '10', '20', '30', '40']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '2', '4', '6', '8', '10']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 0 m에서 시작해 40 m(그래프 위쪽 끝)까지 곧게 올라간다(그림 좌표는 아래가 크다)
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('pos-art')).toHaveAttribute('data-pos', '0.00');
  await expect(macro(page).getByTestId('pos-label')).toHaveText('지금 위치 0.00 m');
  expect(await logRowsOf(page)).toEqual([[0, '0.00']]);
});
