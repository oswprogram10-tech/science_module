import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const MEDIUM = '소리를 전하는 것';
const BLOCK = '소리 나는 물체를 감싼 것';
const CLOCK = '알람 시계 색깔';
const LIMITS = /데시벨|진동수|파동|매질/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g3-sound', { experiment: 'sound-transmit', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '소리의 성질' })).toBeVisible();
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

/** 결과표 한 줄의 소음계 눈금·귀에 들리나요: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const needle = async (page: Page) => Number(await macro(page).getByTestId('meter-needle').getAttribute('data-level'));
const barValues = async (page: Page) => bars(page).getByTestId('sound-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));

test('활동이 셋이라 탭 셋이 보이고, 세 번째 활동으로 열리며 앞 활동으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
  await expect(activityTab(page, 3)).toContainText('소리가 전달되는 물질과 소음 줄이기');
  await expect(page.getByText('탐구 질문: 소리는 무엇을 통해 전달되고, 어떻게 하면 소리를 줄일 수 있을까?')).toBeVisible();
  await expect(page.getByText('예측: 소음계 눈금은?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page).toHaveURL(/#\/unit\/g3-sound\/sound-vibration$/);
  await expect(page.getByRole('group', { name: '소리 내기' })).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g3-sound\/string-sound$/);
  await expect(page.getByRole('group', { name: '튕기는 세기' })).toBeVisible();
  await activityTab(page, 3).click();
  await expect(page.getByRole('group', { name: MEDIUM })).toBeVisible();
  // 새로 고쳐도 세 번째 활동이 유지된다.
  await page.reload();
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
});

test('기준(공기, 감싸지 않음, 빨간 시계)이면 소음계 5·들림이고 실행 전에는 바늘이 0이며 소리 물결을 그리지 않는다', async ({ page }) => {
  await open(page);
  expect(await needle(page)).toBe(0);
  await expect(macro(page).getByTestId('sound-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('sound-bar')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  await expect(macro(page).locator('svg polyline, svg marker')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, MEDIUM);
  expect(await resultCells(resultRows(page).first())).toEqual(['5', '들림']);
  for (const h of ['소음계 눈금', '귀에 들리나요']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('sound-note')).toHaveText('2.0초 · 소음계 5.0눈금 · 귀에 들림');
  expect(await needle(page)).toBe(5);
  expect(await barValues(page)).toEqual([5]);
  await expect(page.getByText('가상 소음계')).toBeVisible();
  await expectSensorNear(page, '소리', 5, 1);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('소리를 전하는 것만 책상 나무로 바꾸면 8(늘어났다)이고 전하는 것 전용 질문이 나오며 나무판이 그려진다', async ({ page }) => {
  await open(page);
  await baselineRun(page, MEDIUM);
  await setValue(page, MEDIUM, '책상 나무');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['8', '들림']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('소리를 전하는 것만 바꾸었어요. 무엇을 통해 들었을 때 소음계 눈금이 어떻게 달랐나요?');
  await expect(macro(page).getByTestId('medium-art')).toHaveAttribute('data-medium', 'wood');
  expect(await needle(page)).toBe(8);
  // 물 7, 실 7
  await setValue(page, MEDIUM, '물');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['7', '들림']);
  await expect(macro(page).getByTestId('medium-art')).toHaveAttribute('data-medium', 'water');
  await setValue(page, MEDIUM, '실 전화기의 실');
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).nth(3))).toEqual(['7', '들림']);
  await expect(macro(page).getByTestId('medium-art')).toHaveAttribute('data-medium', 'string');
  expect(await barValues(page)).toEqual([5, 8, 7, 7]);
});

test('감싼 것만 바꾸면 종이 상자 4, 스펀지 3, 솜 2로 줄어들고(줄어들었다) 감싼 것 전용 질문이 나오며 시계 둘레에 그려진다', async ({ page }) => {
  await open(page);
  await baselineRun(page, BLOCK);
  await setValue(page, BLOCK, '종이 상자');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['4', '들림']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('감싼 것을 바꾸었을 때 눈금은 어떻게 달라졌나요? 재료의 어떤 점이 차이를 만들었을까요?');
  await expect(macro(page).getByTestId('wrap')).toHaveAttribute('data-block', 'box');
  await setValue(page, BLOCK, '스펀지');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['3', '들림']);
  await expect(macro(page).getByTestId('wrap')).toHaveAttribute('data-block', 'sponge');
  await setValue(page, BLOCK, '솜');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(3))).toEqual(['2', '들림']);
  await expect(macro(page).getByTestId('wrap')).toHaveAttribute('data-block', 'cotton');
  expect(await barValues(page)).toEqual([5, 4, 3, 2]);
  expect(await needle(page)).toBe(2);
});

test('대조 변인: 알람 시계 색깔만 파란색으로 바꾸면 결과가 같고(변하지 않았다) 시계 전용 질문이 나오며 시계 색이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, MEDIUM, '물');
  await baselineRun(page, CLOCK);
  expect(await resultCells(resultRows(page).first())).toEqual(['7', '들림']);
  await setValue(page, CLOCK, '파란색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['7', '들림']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('시계 색깔만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('clock')).toHaveAttribute('data-color', 'blue');
  await expect(macro(page).getByTestId('clock-label')).toContainText('파란색');
  expect(await barValues(page)).toEqual([7, 7]);
});

test('막대 그래프는 시행마다 막대가 하나씩 생기고 값 글자와 시행 번호가 있다', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('소음계 눈금')).toBeVisible();
  await baselineRun(page, MEDIUM);
  await setValue(page, MEDIUM, '책상 나무');
  await run(page, '늘어난다');
  await expect(bars(page).getByTestId('sound-bar')).toHaveCount(2);
  await expect(bars(page).getByText('시행 번호')).toBeVisible();
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '5', '10', '1', '2', '8']) expect(texts).toContain(t);
});

test('그래프: y축 0~10 눈금(0, 2, 4, 6, 8, 10), x축 0~2초(0, 1, 2), 0에서 시작해 눈금에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, MEDIUM, '책상 나무');
  await baselineRun(page, MEDIUM);
  await expect(graph(page).getByText('소음계 눈금').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '2', '4', '6', '8', '10']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  expect(await needle(page)).toBe(0);
});
