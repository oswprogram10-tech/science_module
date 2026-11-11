import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, confirmSafetyDialog, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const thermal = (page: Page) => page.getByRole('figure', { name: '열화상으로 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });
const sensorOf = (page: Page, n: 1 | 2) => page.getByRole('status', { name: n === 1 ? '온도 센서 1, 안쪽 컵 물' : '온도 센서 2, 바깥 비커 물' });

const HOT = '안쪽 컵 물의 처음 온도';
const COLD = '바깥 비커 찬물의 양';
const CUP = '안쪽 컵 재료';
const LABEL = '컵에 붙인 이름표 색';
const LIMITS = /열평형|비열|열량|칼로리|전도/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g5-heat', { experiment: 'heat-contact', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '열과 우리 생활' })).toBeVisible();
}

/** 처음 실행할 때만 안전 점검표(뜨거운 물)를 거친다. */
async function run(page: Page, prediction: string, first = false) {
  await predict(page, prediction);
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  if (first) await confirmSafetyDialog(page);
  else await expect(dialog).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다', true);
}

/** 결과표 한 줄의 10분 뒤 안쪽·바깥 온도와 같아진 때: 네 조건 다음 세 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 7);
}

const innerOf = async (page: Page) => Number(await macro(page).getByTestId('heat-art').getAttribute('data-inner'));
const outerOf = async (page: Page) => Number(await macro(page).getByTestId('heat-art').getAttribute('data-outer'));

test('두 번째 활동 탭으로 열리고, 첫 활동(물이 덜 식는 보온 컵 만들기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 온도가 다른 두 물체가 닿아 있으면 온도가 어떻게 변할까?')).toBeVisible();
  await expect(page.getByText('예측: 10분 뒤 안쪽 컵 물의 온도는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g5-heat\/insulated-cup$/);
  await expect(page.getByRole('group', { name: '감싸는 재료' })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: HOT })).toBeVisible();
});

test('기준(60 °C, 100 mL, 금속, 노랑)이면 처음에 점검표를 거쳐 40, 40, 4분이고 실행 전에는 10분 뒤 값을 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 처음 온도만 보인다(안쪽 60, 바깥 20), 열화상에도 처음 온도
  expect(await innerOf(page)).toBe(60);
  expect(await outerOf(page)).toBe(20);
  await expect(macro(page).getByTestId('heat-note')).toContainText('처음: 안쪽 60 °C, 바깥 20 °C');
  await expect(thermal(page).getByTestId('thermal-inner-text')).toHaveText('안쪽 컵 물 60.0 °C');
  await expect(thermal(page).getByTestId('thermal-outer-text')).toHaveText('바깥 비커 물 20.0 °C');
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await selectIV(page, HOT);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  const dialog = page.getByRole('dialog', { name: '안전 점검표' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByText('뜨거운 물은 선생님이 따라 주세요.')).toBeVisible();
  await confirmSafetyDialog(page);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');

  expect(await resultCells(resultRows(page).first())).toEqual(['40', '40', '4']);
  for (const h of ['10분 뒤 안쪽 물 온도(°C)', '10분 뒤 바깥 물 온도(°C)', '두 온도 차가 1 °C 안이 된 때(분)']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  // 재생이 끝나면 10분에 선다: 결과표의 "10분 뒤" 값이 그림에 보인다
  await expect(page.getByRole('slider', { name: '그래프 시각 옮기기' })).toHaveAttribute('aria-valuenow', '10');
  await expect(macro(page).getByTestId('heat-note')).toHaveText('10.0분 · 안쪽 40.0 °C · 바깥 40.0 °C');
  await expect(thermal(page).getByTestId('thermal-inner-text')).toHaveText('안쪽 컵 물 40.0 °C');
  await expect(page.getByText('가상 온도 센서 1: 안쪽 컵 물')).toBeVisible();
  await expect(page.getByText('가상 온도 센서 2: 바깥 비커 물')).toBeVisible();
  await expect.poll(async () => Math.abs(parseFloat(await sensorOf(page, 1).innerText()) - 40)).toBeLessThanOrEqual(1);
  await expect.poll(async () => Math.abs(parseFloat(await sensorOf(page, 2).innerText()) - 40)).toBeLessThanOrEqual(1);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('안쪽 컵 물의 처음 온도만 70 °C로 바꾸면 10분 뒤 45, 45(늘어났다)이고 처음 온도 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, HOT);
  await setValue(page, HOT, '70 °C');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['45', '45', '4']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('안쪽 컵 물의 처음 온도만 바꾸었어요. 10분 뒤 안쪽 물과 바깥 물의 온도는 각각 어떻게 달랐나요?');
  await expect(macro(page).getByTestId('outer-label')).toHaveText('바깥: 20 °C 찬물 100 mL');
  await expect(macro(page).getByTestId('inner-label')).toHaveText('안쪽 컵: 70 °C 물 100 mL');
});

test('바깥 찬물의 양만 300 mL로 바꾸면 30, 30, 5분(줄어들었다)이고 찬물 전용 질문이 나오며 바깥 물이 더 높이 찬다', async ({ page }) => {
  await open(page);
  await baselineRun(page, COLD);
  const waterTop = async () => Number(await macro(page).locator('svg rect[fill="#8cc4ee"]').first().getAttribute('y'));
  const low = await waterTop();
  await setValue(page, COLD, '300 mL');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['30', '30', '5']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('바깥 찬물의 양만 바꾸었어요. 10분 뒤 두 물의 온도와 두 온도 차가 1 °C 안이 된 때는 각각 어떻게 달랐나요?');
  // 300 mL: 물 윗면이 위(y가 작음)
  expect(await waterTop()).toBeLessThan(low);
});

test('안쪽 컵 재료만 플라스틱 컵으로 바꾸면(100 mL) 10분 뒤는 40, 40으로 같고 같아진 때만 10분으로 늦어진다(변하지 않았다)', async ({ page }) => {
  await open(page);
  await baselineRun(page, CUP);
  await setValue(page, CUP, '플라스틱 컵');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['40', '40', '10']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('안쪽 컵 재료만 바꾸었어요. 10분 뒤 온도와 두 온도 차가 1 °C 안이 된 때를 견주어 보면 무엇이 달라졌나요?');
  await expect(macro(page).getByTestId('cup-label')).toHaveText('플라스틱 컵 · 노랑 이름표');
});

test('컵 재료를 플라스틱으로 바꾸고 찬물 300 mL이면 10분 뒤 안쪽 32, 바깥 29, 14분이다', async ({ page }) => {
  await open(page);
  await setValue(page, COLD, '300 mL');
  await baselineRun(page, CUP);
  expect(await resultCells(resultRows(page).first())).toEqual(['30', '30', '5']);
  await setValue(page, CUP, '플라스틱 컵');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['32', '29', '14']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(thermal(page).getByTestId('thermal-inner-text')).toHaveText('안쪽 컵 물 32.1 °C');
  await expect(thermal(page).getByTestId('thermal-outer-text')).toHaveText('바깥 비커 물 29.3 °C');
});

test('대조 변인: 이름표 색만 초록으로 바꾸면 결과가 같고(변하지 않았다) 이름표 전용 질문이 나오며 이름표 색이 바뀐다', async ({ page }) => {
  await open(page);
  await baselineRun(page, LABEL);
  expect(await resultCells(resultRows(page).first())).toEqual(['40', '40', '4']);
  await expect(macro(page).getByTestId('cup-tag')).toHaveAttribute('data-color', 'yellow');
  await setValue(page, LABEL, '초록');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['40', '40', '4']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('이름표 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('cup-tag')).toHaveAttribute('data-color', 'green');
  await expect(macro(page).getByTestId('cup-label')).toHaveText('얇은 금속 컵 · 초록 이름표');
});

test('그래프: y축 0~80 °C(0, 20, …, 80), x축 0~20분(0, 5, 10, 15, 20), 선 둘(안쪽·바깥)과 범례, 안쪽은 내려가고 바깥은 올라간다', async ({ page }) => {
  await open(page);
  await baselineRun(page, HOT);
  await expect(graph(page).getByText('온도(°C)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(분)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '20', '40', '60', '80']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '5', '10', '15', '20']);
  await expect(graph(page).getByTestId('graph-series')).toHaveCount(2);
  await expect(graph(page).getByTestId('graph-legend-item')).toHaveCount(2);
  const pointsOf = async (key: string) => {
    const raw = await graph(page).locator(`[data-series="${key}"]`).getAttribute('points');
    return raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  };
  const inner = await pointsOf('innerC');
  const outer = await pointsOf('outerC');
  // 그림 좌표는 아래가 크다: 안쪽은 아래로(y가 커짐), 바깥은 위로(y가 작아짐)
  expect(inner.at(-1)![1]).toBeGreaterThan(inner[0]![1]);
  expect(outer.at(-1)![1]).toBeLessThan(outer[0]![1]);
  // 끝에서는 두 선이 거의 만난다
  expect(Math.abs(inner.at(-1)![1] - outer.at(-1)![1])).toBeLessThan(2);
  // 슬라이더를 처음으로 옮기면 안쪽 60, 바깥 20으로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  expect(await innerOf(page)).toBe(60);
  expect(await outerOf(page)).toBe(20);
});
