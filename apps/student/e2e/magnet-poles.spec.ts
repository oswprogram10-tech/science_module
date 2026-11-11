import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const ruler = (page: Page) => page.getByRole('figure', { name: '거리 재기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const FACING = '마주 보는 극';
const GAP = '두 자석 사이 거리';
const SIZE = '자석 크기';
const COVER = '자석 겉 색칠';
const LIMITS = /자기장|자기력선|테슬라|인력|척력/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g4-magnet', { experiment: 'magnet-poles', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '자석의 이용' })).toBeVisible();
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

/** 결과표 한 줄의 오른쪽 자석의 움직임·움직인 거리: 네 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 6);
}

const gapOf = async (page: Page) => Number(await macro(page).getByTestId('poles-art').getAttribute('data-gap'));

test('두 번째 활동 탭으로 열리고, 첫 활동(자석과 클립 사이의 거리)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 자석과 자석을 가까이 하면 어떤 일이 생길까?')).toBeVisible();
  await expect(page.getByText('예측: 오른쪽 자석이 움직인 거리는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g4-magnet\/magnet-distance$/);
  await expect(page.getByRole('group', { name: '자석과 클립 사이의 거리' })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: FACING })).toBeVisible();
});

test('기준(N극–S극, 1 cm, 작은 자석, 빨강·파랑)이면 "다가와 붙음", 1.0이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 오른쪽 자석은 처음 거리(1 cm)에 있고, 문구에 결과가 없다
  expect(await gapOf(page)).toBe(1);
  await expect(macro(page).getByTestId('poles-note')).not.toContainText('두 자석 사이');
  await expect(ruler(page).getByTestId('poles-ruler-note')).toContainText('처음 두 자석 사이는 1 cm');
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
  // 극 글자 N/S: 왼쪽 자석 S N, 오른쪽 자석 S N
  expect(await macro(page).getByTestId('pole-letter').allTextContents()).toEqual(['S', 'N', 'S', 'N']);

  await baselineRun(page, FACING);
  expect(await resultCells(resultRows(page).first())).toEqual(['다가와 붙음', '1.0']);
  await expect(page.getByRole('columnheader', { name: '오른쪽 자석의 움직임' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '움직인 거리(cm)' })).toBeVisible();
  // 다가와 붙으면 두 자석 사이 거리 0
  expect(await gapOf(page)).toBe(0);
  await expect(macro(page).getByTestId('poles-note')).toHaveText('2.0초 · 두 자석 사이 0.0 cm');
  await expect(page.getByText('가상 거리 센서: 두 자석 사이')).toBeVisible();
  await expectSensorNear(page, '거리', 0, 0.2);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('마주 보는 극만 N극–N극으로 바꾸면 "밀려남", 4.0(늘어났다)이고 극 전용 질문과 나침반이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, FACING);
  await setValue(page, FACING, 'N극–N극');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['밀려남', '4.0']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('마주 보는 극만 바꾸었어요. 오른쪽 자석은 어느 쪽으로 움직였나요? 나침반 바늘은 두 자석에서 각각 어느 쪽을 가리켰나요?');
  // 처음 1 cm에서 4 cm 밀려나 5 cm
  expect(await gapOf(page)).toBe(5);
  await expect(macro(page).getByTestId('poles-note')).toHaveText('2.0초 · 두 자석 사이 5.0 cm');
  await expect(ruler(page).getByTestId('ruler-label')).toHaveText('5.0 cm');
  await expectSensorNear(page, '거리', 5, 0.2);
  // 극 글자: N극–N극이면 왼쪽 자석 S N, 오른쪽 자석 N S
  expect(await macro(page).getByTestId('pole-letter').allTextContents()).toEqual(['S', 'N', 'N', 'S']);
  await expect(macro(page).getByTestId('compass')).toHaveCount(2);
});

test('같은 극에서 두 자석 사이 거리만 4 cm로 바꾸면 "움직이지 않음", 0.0(줄어들었다)이고 거리 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, FACING, 'S극–S극');
  await baselineRun(page, GAP);
  expect(await resultCells(resultRows(page).first())).toEqual(['밀려남', '4.0']);
  await setValue(page, GAP, '4 cm');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['움직이지 않음', '0.0']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('두 자석 사이 거리만 바꾸었어요. 오른쪽 자석이 움직인 모습은 어떻게 달라졌나요? 움직이지 않은 때도 있었나요?');
  expect(await gapOf(page)).toBe(4);
});

test('자석 크기만 큰 자석으로 바꾸면 6.0(늘어났다)이고 크기 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, FACING, 'N극–N극');
  await baselineRun(page, SIZE);
  await setValue(page, SIZE, '큰 자석');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['밀려남', '6.0']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('자석 크기만 바꾸었어요. 같은 거리에서 오른쪽 자석이 움직인 거리는 어떻게 달라졌나요?');
  expect(await gapOf(page)).toBe(7);
});

test('대조 변인: 자석 겉 색칠만 회색으로 바꾸면 결과가 같고(변하지 않았다) 색칠 전용 질문이 나오며 극 색이 같은 회색이 된다', async ({ page }) => {
  await open(page);
  await setValue(page, FACING, 'N극–N극');
  await baselineRun(page, COVER);
  expect(await resultCells(resultRows(page).first())).toEqual(['밀려남', '4.0']);
  const fills = async () => (await macro(page).locator('[data-testid="pole-half"] rect').evaluateAll((els) => els.map((e) => e.getAttribute('fill'))));
  expect(new Set(await fills()).size).toBe(2);
  await setValue(page, COVER, '회색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['밀려남', '4.0']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('자석 겉 색칠만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(new Set(await fills()).size).toBe(1);
  // 극 글자는 색이 같아도 그대로 보인다
  expect(await macro(page).getByTestId('pole-letter').allTextContents()).toEqual(['S', 'N', 'N', 'S']);
});

test('그래프: y축 0~10 cm(0, 2, 4, 6, 8, 10), x축 0~2초(0, 1, 2), 처음 거리에서 시작해 끝 거리에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, FACING, 'N극–N극');
  await baselineRun(page, FACING);
  await expect(graph(page).getByText('두 자석 사이 거리(cm)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '2', '4', '6', '8', '10']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 그림 좌표는 아래가 크다. 밀려나 거리가 늘어나므로 끝이 시작보다 위에 있다.
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  // 1.5초 이후에는 멈춘다: 마지막 몇 점의 y가 같다
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 오른쪽 자석이 처음 자리(1 cm)로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  expect(await gapOf(page)).toBe(1);
});
