import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const CELLS = '전지 연결';
const WIRE = '전선 색깔';
const LIMITS = /전류|전압|저항|병렬|옴/;

async function open(page: Page) {
  await gotoUnit(page, 'g6-electricity', { experiment: 'battery-series' });
  await expect(page.getByRole('heading', { level: 1, name: '전기의 이용' })).toBeVisible();
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

/** 결과표 한 줄의 전구의 밝기·전구: 두 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(2, 4);
}

const art = (page: Page) => macro(page).getByTestId('circuit-art');
const barValues = async (page: Page) => bars(page).getByTestId('bulb-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));
const plusSides = async (page: Page) => macro(page).getByTestId('cell').evaluateAll((els) => els.map((e) => e.getAttribute('data-plus-side')));

test('세 번째 활동 탭으로 열리고, 둘째 활동(전구에 불 켜기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 전지를 한 개 연결할 때와 두 개 직렬로 연결할 때 전구는 어떻게 다를까?')).toBeVisible();
  await expect(page.getByText('예측: 전구의 밝기 눈금은?')).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page).toHaveURL(/#\/unit\/g6-electricity\/bulb-light$/);
  await expect(page.getByRole('group', { name: '스위치' })).toBeVisible();
  await activityTab(page, 3).click();
  await expect(page.getByRole('group', { name: CELLS })).toBeVisible();
});

test('기준(전지 1개)이면 밝기 4·켜짐이고 실행 전에는 불빛·결과가 없으며 병렬연결 선택지가 없다', async ({ page }) => {
  await open(page);
  // 실행 전: 전지 끼우개에 전지 한 개, 전구와 스위치(닫힘)는 고정이고 불빛은 없다.
  expect(await plusSides(page)).toEqual(['right']);
  await expect(art(page)).toHaveAttribute('data-switch', 'closed');
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'false');
  await expect(macro(page).getByTestId('bulb-glow')).toHaveCount(0);
  await expect(macro(page).getByTestId('bulb-note')).toContainText('실험하면');
  await expect(macro(page).locator('svg text')).toHaveCount(0);
  await expect(bars(page).getByTestId('bulb-bar')).toHaveCount(0);
  await expect(page.getByRole('group', { name: CELLS }).getByRole('button')).toHaveCount(3);
  await expect(page.getByText(/병렬/)).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  // 한 번에 하나만 바꾸기는 이 활동에서 그대로 요구한다.
  await predict(page, '변하지 않는다');
  await expect(page.locator('#run-reasons')).toContainText('바꿀 조건(조작변인)을 하나 골라 주세요.');
  await selectIV(page, CELLS);
  await runButton(page).click();
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  expect(await resultCells(resultRows(page).first())).toEqual(['4', '켜짐']);
  for (const h of ['전구의 밝기(눈금)', '전구']) await expect(page.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('bulb-note')).toHaveText('2.0초 · 전구의 밝기 4.0눈금 · 전구: 켜짐');
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'true');
  expect(await barValues(page)).toEqual([4]);
  await expect(page.getByText('가상 조도계: 전구의 밝기')).toBeVisible();
  await expectSensorNear(page, '빛 세기', 4, 0.5);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('전지를 한 줄로 두 개 넣으면 9(늘어났다)이고 전지 전용 질문이 나오며 전지가 둘 그려진다', async ({ page }) => {
  await open(page);
  await baselineRun(page, CELLS);
  await setValue(page, CELLS, '전지 2개를 한 줄로');
  await run(page, '늘어난다');
  // 실행한 뒤 눈으로 보기는 그 시행의 연결을 보여 준다(전지 둘이 한 줄).
  expect(await plusSides(page)).toEqual(['right', 'right']);
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['9', '켜짐']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('전지 연결만 바꾸었어요. 전구의 밝기 눈금은 어떻게 달라졌나요? 반대로 넣었을 때는 어땠나요?');
  expect(await barValues(page)).toEqual([4, 9]);
  await expectSensorNear(page, '빛 세기', 9, 0.5);
  // 불빛 둘레가 전지 한 개일 때보다 크다.
  const glow = Number(await macro(page).getByTestId('bulb-glow').getAttribute('r'));
  expect(glow).toBeGreaterThan(40);
});

test('하나를 반대로 넣으면 0·켜지지 않음(줄어들었다)이고 극 표시가 뒤집히며, 예측이 다르면 손전등 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, CELLS, '전지 2개를 한 줄로');
  await baselineRun(page, CELLS);
  expect(await resultCells(resultRows(page).first())).toEqual(['9', '켜짐']);
  await setValue(page, CELLS, '2개 중 하나를 반대로');
  await run(page, '늘어난다');
  expect(await plusSides(page)).toEqual(['right', 'left']);
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0', '켜지지 않음']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('손전등에 전지를 여러 개 넣는 까닭은 무엇일까요? 결과표의 밝기를 견주어 볼까요?');
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'false');
  await expect(macro(page).getByTestId('bulb-note')).toHaveText('2.0초 · 전구의 밝기 0.0눈금 · 전구: 켜지지 않음');
  expect(await barValues(page)).toEqual([9, 0]);
});

test('대조 변인: 전선 색깔만 바꾸면 결과가 같고(변하지 않았다) 전선 전용 질문이 나오며 전선 색이 바뀐다', async ({ page }) => {
  await open(page);
  await baselineRun(page, WIRE);
  expect(await resultCells(resultRows(page).first())).toEqual(['4', '켜짐']);
  await expect(art(page)).toHaveAttribute('data-wire', 'red');
  await setValue(page, WIRE, '검은색');
  await run(page, '변하지 않는다');
  await expect(art(page)).toHaveAttribute('data-wire', 'black');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['4', '켜짐']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('전선 색깔만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await barValues(page)).toEqual([4, 4]);
});

test('막대 그래프는 시행마다 하나씩 생기고 값 글자와 0·5·10 눈금이 있다', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('전구의 밝기(눈금)')).toBeVisible();
  await baselineRun(page, CELLS);
  await setValue(page, CELLS, '전지 2개를 한 줄로');
  await run(page, '늘어난다');
  await expect(bars(page).getByTestId('bulb-bar')).toHaveCount(2);
  await expect(bars(page).getByText('시행 번호')).toBeVisible();
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '5', '10', '4', '9']) expect(texts).toContain(t);
});

test('그래프: y축 0~10 눈금(0, 2, 4, 6, 8, 10), x축 0~2초(0, 1, 2), 0에서 시작해 밝기에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, CELLS, '전지 2개를 한 줄로');
  await baselineRun(page, CELLS);
  await expect(graph(page).getByText('전구의 밝기(눈금)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '2', '4', '6', '8', '10']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
});
