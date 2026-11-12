import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const FLASH = '상자 안 손전등';
const OBJECT = '상자 안 물체';
const BOX = '상자 겉 색깔';
const LIMITS = /반사의 법칙|광자|파장|굴절/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g5-light', { experiment: 'light-needed', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '빛의 성질' })).toBeVisible();
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

/** 결과표 한 줄의 상자 안 밝기·구멍으로 본 물체: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const windowState = async (page: Page) => (await macro(page).getByTestId('peek-window').getAttribute('data-state'))!;
const barValues = async (page: Page) => bars(page).getByTestId('light-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));

test('두 번째 활동 탭으로 열리고, 첫 활동(볼록 렌즈로 햇빛 모으기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 깜깜한 상자 안의 물체를 보려면 무엇이 필요할까?')).toBeVisible();
  await expect(page.getByText('예측: 상자 안 밝기 눈금은?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g5-light\/convex-lens$/);
  await expect(page.getByRole('group', { name: '렌즈와 종이 사이 거리' })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: FLASH })).toBeVisible();
});

test('기준(손전등 끔, 인형, 검은 상자)이면 밝기 0·보이지 않음이고 실행 전에는 결과와 빛의 길 그림이 없다', async ({ page }) => {
  await open(page);
  // 실행 전: 구멍으로 본 장면이 없고(빈 둥근 창), 문구·막대·센서에 결과가 없다.
  expect(await windowState(page)).toBe('empty');
  await expect(macro(page).getByTestId('peek-object')).toHaveCount(0);
  await expect(macro(page).getByTestId('light-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('light-bar')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  // 빛의 길 화살표·선은 어떤 때도 그리지 않는다.
  await expect(macro(page).locator('svg line[marker-end], svg marker, svg polyline')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, FLASH);
  expect(await resultCells(resultRows(page).first())).toEqual(['0', '보이지 않음']);
  for (const h of ['상자 안 밝기(눈금)', '구멍으로 본 물체']) await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(macro(page).getByTestId('light-note')).toHaveText('2.0초 · 상자 안 밝기 0.0눈금 · 구멍으로 본 물체: 보이지 않음');
  expect(await windowState(page)).toBe('dark');
  await expect(macro(page).getByTestId('peek-object')).toHaveCount(0);
  expect(await barValues(page)).toEqual([0]);
  await expect(page.getByText('가상 조도계: 상자 안 밝기')).toBeVisible();
  await expectSensorNear(page, '빛 세기', 0, 1);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('손전등만 켜면 8·보임(늘어났다)이고 손전등 전용 질문이 나오며 둥근 창에 인형이 나타난다', async ({ page }) => {
  await open(page);
  await baselineRun(page, FLASH);
  await setValue(page, FLASH, '켬');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['8', '보임']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('손전등만 바꾸었어요. 인형이 보일 때와 보이지 않을 때는 무엇이 달랐나요?');
  expect(await windowState(page)).toBe('object');
  await expect(macro(page).getByTestId('peek-object')).toHaveAttribute('data-object', 'doll');
  expect(await barValues(page)).toEqual([0, 8]);
  await expectSensorNear(page, '빛 세기', 80, 2);
});

test('물체만 켜진 작은 전구로 바꾸면(손전등 끔) 밝기 3이어도 보이고(늘어났다) 물체 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, OBJECT);
  await setValue(page, OBJECT, '켜진 작은 전구');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['3', '보임']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('물체만 바꾸었어요. 손전등을 끄고도 보인 물체는 무엇이었나요? 그 물체는 어떤 점이 달랐나요?');
  expect(await windowState(page)).toBe('object');
  await expect(macro(page).getByTestId('peek-object')).toHaveAttribute('data-object', 'bulb');
  // 손전등까지 켜면 9
  await selectIV(page, FLASH);
  await setValue(page, FLASH, '켬');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['9', '보임']);
  expect(await barValues(page)).toEqual([0, 3, 9]);
});

test('대조 변인: 상자 겉 색깔만 흰색으로 바꾸면 결과가 같고(변하지 않았다) 상자 전용 질문이 나오며 겉 색이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, FLASH, '켬');
  await baselineRun(page, BOX);
  expect(await resultCells(resultRows(page).first())).toEqual(['8', '보임']);
  const before = (await macro(page).getByTestId('box-wall').getAttribute('data-fill'))!;
  await setValue(page, BOX, '흰색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['8', '보임']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('상자 겉 색깔만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await macro(page).getByTestId('box-wall').getAttribute('data-fill')).not.toBe(before);
  await expect(macro(page).getByTestId('box-label')).toContainText('흰 상자');
  expect(await barValues(page)).toEqual([8, 8]);
});

test('막대 그래프는 시행마다 막대가 하나씩 생기고 값 글자와 시행 번호가 있다', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('상자 안 밝기(눈금)')).toBeVisible();
  await baselineRun(page, FLASH);
  await setValue(page, FLASH, '켬');
  await run(page, '늘어난다');
  await expect(bars(page).getByTestId('light-bar')).toHaveCount(2);
  await expect(bars(page).getByText('시행 번호')).toBeVisible();
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '5', '10', '1', '2', '8']) expect(texts).toContain(t);
});

test('그래프: y축 0~10 눈금(0, 2, 4, 6, 8, 10), x축 0~2초(0, 1, 2), 0에서 시작해 밝기에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, FLASH, '켬');
  await baselineRun(page, FLASH);
  await expect(graph(page).getByText('상자 안 밝기(눈금)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '2', '4', '6', '8', '10']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 둥근 창이 다시 깜깜해진다(밝기 0).
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('light-note')).toContainText('상자 안 밝기 0.0눈금');
});
