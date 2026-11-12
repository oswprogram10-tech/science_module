import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const DRY = '건구 온도';
const DIFF = '건구와 습구의 온도 차';
const PLACE = '습도계를 둔 곳 벽 색';
const LIMITS = /이슬점|포화 수증기압|상대 습도|절대 습도/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g5-weather', { experiment: 'humidity', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '날씨와 우리 생활' })).toBeVisible();
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

/** 결과표 한 줄의 습도·습구 온도: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const hits = (page: Page) => macro(page).locator('[data-testid="table-cell"][data-hit="true"]');
const barValues = async (page: Page) => bars(page).getByTestId('humidity-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));

test('세 번째 활동 탭으로 열리고, 앞의 두 활동으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
  await expect(activityTab(page, 3)).toContainText('건습구 습도계로 습도 구하기');
  await expect(page.getByText('탐구 질문: 날씨를 나타내려면 무엇을 재어야 할까?')).toBeVisible();
  await expect(page.getByText('예측: 습도는?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page).toHaveURL(/#\/unit\/g5-weather\/dew-fog-cloud$/);
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g5-weather\/land-sea-breeze$/);
  await activityTab(page, 3).click();
  await expect(page.getByRole('group', { name: DRY, exact: true })).toBeVisible();
  await page.reload();
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
});

test('기준(건구 20 °C, 온도 차 0 °C, 흰 벽)이면 습도 100·습구 20이고 실행 전에는 습도표에 강조 칸과 습구 값이 없다', async ({ page }) => {
  await open(page);
  // 실행 전: 습도표는 보이지만 강조 칸이 없고, 습구 온도계는 값 대신 ? 를 쓰며, 막대·센서에 결과가 없다.
  await expect(macro(page).getByTestId('table-cell')).toHaveCount(35);
  await expect(hits(page)).toHaveCount(0);
  await expect(macro(page).getByTestId('wet-reading')).toHaveText('? °C');
  await expect(macro(page).getByTestId('rh-text')).toHaveCount(0);
  await expect(macro(page).getByTestId('humidity-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('humidity-bar')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, DRY);
  expect(await resultCells(resultRows(page).first())).toEqual(['100', '20']);
  for (const h of ['습도(%)', '습구 온도(°C)']) await expect(page.locator('#results-table').getByRole('columnheader', { name: h })).toBeVisible();
  // 실행 뒤: 두 값이 만나는 칸(20 °C 행, 온도 차 0 열)만 강조한다.
  await expect(hits(page)).toHaveCount(1);
  await expect(hits(page)).toHaveAttribute('data-dry', '20');
  await expect(hits(page)).toHaveAttribute('data-diff', '0');
  await expect(hits(page)).toHaveAttribute('data-value', '100');
  await expect(macro(page).getByTestId('wet-reading')).toHaveText('20 °C');
  await expect(macro(page).getByTestId('rh-text')).toHaveText('습도 100 %');
  expect(await barValues(page)).toEqual([100]);
  await expect(page.getByText('가상 습도계: 습도')).toBeVisible();
  await expectSensorNear(page, '습도', 100, 1);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('온도 차만 3 °C로 바꾸면 72·습구 17(줄어들었다)이고 온도 차 전용 질문이 나오며 습도표 칸이 옮겨 간다', async ({ page }) => {
  await open(page);
  await baselineRun(page, DIFF);
  await setValue(page, DIFF, '3 °C');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['72', '17']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('온도 차만 바꾸었어요. 습도는 어떻게 달라졌나요? 습도표의 열을 따라가 볼까요?');
  await expect(hits(page)).toHaveCount(1);
  await expect(hits(page)).toHaveAttribute('data-diff', '3');
  await expect(hits(page)).toHaveAttribute('data-value', '72');
  await expect(macro(page).getByTestId('wet-reading')).toHaveText('17 °C');
  expect(await barValues(page)).toEqual([100, 72]);
  await expectSensorNear(page, '습도', 72, 1);
});

test('건구 온도만 바꾸면 같은 온도 차에서 습도가 달라지고(10 °C 행 62, 25 °C 행 76) 건구 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, DIFF, '3 °C');
  await baselineRun(page, DRY);
  expect(await resultCells(resultRows(page).first())).toEqual(['72', '17']);
  await setValue(page, DRY, '10 °C');
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['62', '7']);
  await expect(resultRows(page).nth(1)).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('건구 온도만 바꾸었어요. 같은 온도 차에서 습도는 어떻게 달라졌나요? 습도표에서 행을 따라가 볼까요?');
  await expect(hits(page)).toHaveAttribute('data-dry', '10');
  await setValue(page, DRY, '25 °C');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['76', '22']);
  await expect(resultRows(page).nth(2)).toContainText('결과: 늘어났다');
  expect(await barValues(page)).toEqual([72, 62, 76]);
});

test('대조 변인: 벽 색만 회색으로 바꾸면 결과가 같고(변하지 않았다) 벽 전용 질문이 나오며 벽 색이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, DIFF, '2 °C');
  await baselineRun(page, PLACE);
  expect(await resultCells(resultRows(page).first())).toEqual(['81', '18']);
  const before = (await macro(page).getByTestId('wall').getAttribute('data-fill'))!;
  await setValue(page, PLACE, '회색 벽');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['81', '18']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('벽 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await macro(page).getByTestId('wall').getAttribute('data-fill')).not.toBe(before);
  await expect(macro(page).getByTestId('place-label')).toContainText('회색 벽');
  expect(await barValues(page)).toEqual([81, 81]);
});

test('결과표 아래 일주일 날씨 기록(예시 자료)이 7일 표로 보이고 실험을 해도 그대로다', async ({ page }) => {
  await open(page);
  const log = page.getByTestId('week-log');
  await expect(log).toBeVisible();
  await expect(log.getByRole('heading', { name: '일주일 날씨 기록(예시 자료)' })).toBeVisible();
  for (const h of ['기온(°C)', '습도(%)', '바람', '구름 양(10칸 중)', '강수량(mm)']) await expect(log.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(log.getByRole('row')).toHaveCount(8);
  await expect(log.getByRole('rowheader')).toHaveText(['월', '화', '수', '목', '금', '토', '일']);
  const before = await log.innerText();
  await baselineRun(page, DRY);
  expect(await log.innerText()).toBe(before);
  // 튜터 예측 불일치 질문이 일주일 기록과 견주어 보라고 한다.
  await setValue(page, DIFF, '3 °C');
  await selectIV(page, DIFF);
  await run(page, '늘어난다');
  await expect(tutorBox(page)).toContainText('습도가 높은 날과 낮은 날, 빨래가 마르는 모습은 어떻게 다를까요? 아래 일주일 기록과 견주어 볼까요?');
});

test('시행별 막대 그래프는 시행마다 막대가 하나씩 생기고 값 글자와 시행 번호가 있다', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('습도(%)')).toBeVisible();
  await baselineRun(page, DIFF);
  await setValue(page, DIFF, '6 °C');
  await run(page, '줄어든다');
  await expect(bars(page).getByTestId('humidity-bar')).toHaveCount(2);
  await expect(bars(page).getByText('시행 번호')).toBeVisible();
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '50', '100', '1', '2']) expect(texts).toContain(t);
});

test('그래프: y축 0~100 %(0, 20, 40, 60, 80, 100), x축 0~2초(0, 1, 2), 0에서 시작해 습도에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, DIFF, '3 °C');
  await baselineRun(page, DIFF);
  await expect(graph(page).getByText('습도(%)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '20', '40', '60', '80', '100']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 습구 온도계가 건구와 같아지고(실행 직후 처음 순간) 습도는 0이다.
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('humidity-note')).toContainText('습도 0.0 %');
  await expect(macro(page).getByTestId('humidity-note')).toContainText('습구 온도 20.0 °C');
});
