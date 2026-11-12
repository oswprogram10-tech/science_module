import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '눈금과 길이 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const WEIGHTS = '건 추의 개수';
const OBJECT = '함께 건 물체';
const COLOR = '용수철 색깔';
const LIMITS = /뉴턴|탄성|훅의 법칙|질량/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g3-force', { experiment: 'spring-scale', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '힘과 우리 생활' })).toBeVisible();
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

/** 결과표 한 줄의 늘어난 길이·저울 눈금: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const stretchOf = async (page: Page) => Number(await macro(page).getByTestId('spring-art').getAttribute('data-stretch'));

test('네 번째 활동 탭으로 열리고, 첫 활동(막대의 수평 잡기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(activityTab(page, 4)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 무게가 비슷한 물체들의 무게를 어떻게 정확히 비교할 수 있을까?')).toBeVisible();
  await expect(page.getByText('예측: 용수철이 늘어난 길이는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g3-force\/lever-balance$/);
  await expect(page.getByRole('group', { name: '오른쪽 추의 수' })).toBeVisible();
  await activityTab(page, 4).click();
  await expect(page.getByRole('group', { name: WEIGHTS })).toBeVisible();
});

test('기준(추 0개, 물체 없음, 노란색)이면 0.0 cm · 0 g이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 용수철은 늘어나지 않았고, 추와 물체는 받침에 있으며, 막대는 비어 있다
  expect(await stretchOf(page)).toBe(0);
  await expect(macro(page).getByTestId('spring-art')).toHaveAttribute('data-hung', 'no');
  await expect(macro(page).getByTestId('spring-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('reading-bar')).toHaveAttribute('data-value', '0.0');
  await expect(bars(page).getByTestId('stretch-bar')).toHaveAttribute('data-value', '0.00');
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, WEIGHTS);
  expect(await resultCells(resultRows(page).first())).toEqual(['0.0', '0']);
  await expect(page.getByRole('columnheader', { name: '늘어난 길이(cm)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '저울 눈금(g)' })).toBeVisible();
  await expect(page.getByText('가상 저울: 저울 눈금')).toBeVisible();
  await expectSensorNear(page, '무게', 0, 0.5);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('건 추의 개수만 1개로 바꾸면 2.0 cm · 50 g(늘어났다)이고 추 전용 질문과 추 원판 그림이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, WEIGHTS);
  await setValue(page, WEIGHTS, '1개');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['2.0', '50']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('추를 하나 더 걸 때마다 늘어난 길이는 어떻게 변했나요? 결과표에서 규칙을 찾아볼까요?');
  await expect(macro(page).getByTestId('weight-disc')).toHaveCount(1);
  await expect(macro(page).getByTestId('spring-art')).toHaveAttribute('data-hung', 'yes');
  expect(await stretchOf(page)).toBeCloseTo(2, 2);
  await expect(bars(page).getByTestId('reading-bar')).toHaveAttribute('data-value', '50.0');
  await expectSensorNear(page, '무게', 50, 0.5);
  await expect(macro(page).getByTestId('spring-note')).toHaveText('2.0초 · 용수철이 2.0 cm 늘어남');
});

test('눈으로 비슷한 풀과 가위: 함께 건 물체만 바꾸면 2.4 cm · 60 g → 2.8 cm · 70 g(늘어났다)이고 물체 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, OBJECT, '풀');
  await baselineRun(page, OBJECT);
  expect(await resultCells(resultRows(page).first())).toEqual(['2.4', '60']);
  await setValue(page, OBJECT, '가위');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['2.8', '70']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('물체만 바꾸었어요. 눈으로 보기에 비슷했던 두 물체를 저울로 재 보니 어떤가요?');
  // 가위와 풀 상자는 같은 크기라 눈으로 무게를 알 수 없다
  const box = await macro(page).getByTestId('obj-icon').locator('rect').first().evaluate((e) => [e.getAttribute('width'), e.getAttribute('height')]);
  await setValue(page, OBJECT, '풀');
  await run(page, '줄어든다');
  const box2 = await macro(page).getByTestId('obj-icon').locator('rect').first().evaluate((e) => [e.getAttribute('width'), e.getAttribute('height')]);
  expect(box2).toEqual(box);
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['2.4', '60']);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('대조 변인: 용수철 색깔만 초록색으로 바꾸면 결과가 같고(변하지 않았다) 색깔 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, WEIGHTS, '3개');
  await baselineRun(page, COLOR);
  expect(await resultCells(resultRows(page).first())).toEqual(['6.0', '150']);
  const color = async () => macro(page).getByTestId('spring-coil').getAttribute('data-color');
  expect(await color()).toBe('yellow');
  await setValue(page, COLOR, '초록색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['6.0', '150']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('용수철 색깔만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await color()).toBe('green');
});

test('예측과 결과가 다르면 저울 눈금이 같을 때 두 물체의 무게에 대해 묻는다', async ({ page }) => {
  await open(page);
  await setValue(page, WEIGHTS, '1개');
  await baselineRun(page, OBJECT);
  await setValue(page, OBJECT, '필통');
  await run(page, '줄어든다');
  await expect(resultRows(page).nth(1)).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('저울 눈금이 같으면 두 물체의 무게에 대해 무엇을 말할 수 있을까요? 결과표에서 눈금을 견주어 볼까요?');
});

test('그래프: y축 0~18 cm(0, 3, …, 18), x축 0~2초(0, 1, 2), 살짝 흔들리다 끝 길이에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, WEIGHTS, '5개');
  await baselineRun(page, WEIGHTS);
  await expect(graph(page).getByText('늘어난 길이(cm)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '3', '6', '9', '12', '15', '18']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 그림 좌표는 아래가 크다: 끝(10 cm)이 시작(0 cm)보다 위에 있고, 흔들릴 때 끝보다 더 높이 올라간 점이 있다
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(Math.min(...pts.map((p) => p[1]))).toBeLessThan(pts.at(-1)![1] - 0.5);
  expect(new Set(pts.slice(-8).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 용수철이 늘어나지 않은 모습으로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  expect(await stretchOf(page)).toBe(0);
});
