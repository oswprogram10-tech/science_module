import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const POWER = '배율';
const FOCUS = '초점';
const STAIN = '염색';
const SAMPLE = '관찰 재료';
const LABEL = '받침 유리 이름표 색';
const LIMITS = /세포막|세포질|엽록체|미토콘드리아|세포 소기관/;
const EMPTY_TEXT = '초점이 맞지 않아 칸이 보이지 않아요';

async function open(page: Page) {
  await gotoUnit(page, 'g6-plant', { experiment: 'microscope-cells' });
  await expect(page.getByRole('heading', { level: 1, name: '식물의 구조와 기능' })).toBeVisible();
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

/** 결과표 한 줄의 칸 길이·보인 것: 다섯 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(5, 7);
}

const field = (page: Page) => macro(page).getByTestId('field');
const barValues = async (page: Page) => bars(page).getByTestId('cell-bar').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')));
const patternWidth = async (page: Page) => Number(await macro(page).locator('pattern#mc-cells').getAttribute('width'));

test('두 번째 활동 탭으로 열리고, 탐구 질문 아래에 안내 한 줄이 있으며, 첫 활동(증산 작용)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 양파 껍질을 현미경으로 보면 무엇이 보일까?')).toBeVisible();
  await expect(page.getByText('실제 현미경으로 보기 전에 연습해 보세요.')).toBeVisible();
  await expect(page.getByText('예측: 화면에서 본 칸 하나의 크기는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g6-plant\/transpiration$/);
  await expect(page.getByRole('group', { name: '잎의 수' })).toBeVisible();
  // 첫 활동에는 안내 한 줄이 없다.
  await expect(page.getByText('실제 현미경으로 보기 전에 연습해 보세요.')).toHaveCount(0);
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: POWER })).toBeVisible();
});

test('실행 전에는 시야가 비어 있고 결과가 없다. 초점을 맞추지 않으면 칸 길이는 "—", 그래프는 안내 글자, 막대는 없다', async ({ page }) => {
  await open(page);
  // 현미경 옆모습은 실행 전에도 보이고, 시야(둥근 틀)는 비어 있으며 그림 안에 글자가 없다.
  await expect(macro(page).getByTestId('microscope')).toHaveAttribute('data-power', '40');
  await expect(macro(page).getByTestId('coarse-knob')).toHaveCount(1);
  await expect(field(page)).toHaveAttribute('data-state', 'empty');
  await expect(macro(page).getByTestId('field-cells')).toHaveCount(0);
  await expect(macro(page).locator('svg text')).toHaveCount(0);
  await expect(macro(page).getByTestId('microscope-note')).toContainText('실험하면');
  await expect(bars(page).getByTestId('cell-bar')).toHaveCount(0);
  await expect(graph(page).getByTestId('graph-empty')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, FOCUS);
  expect(await resultCells(resultRows(page).first())).toEqual(['—', '흐릿함']);
  for (const h of ['화면에서 본 칸 하나의 길이(mm)', '보인 것']) await expect(page.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(field(page)).toHaveAttribute('data-state', 'seen');
  await expect(macro(page).getByTestId('field-cells')).toHaveCount(1);
  await expect(macro(page).getByTestId('field-cells')).toHaveAttribute('filter', 'url(#mc-blur)');
  await expect(macro(page).getByTestId('microscope-note')).toHaveText('2.0초 · 칸 하나의 길이 —mm · 보인 것: 흐릿함');
  await expect(graph(page).getByTestId('graph-empty')).toHaveText(EMPTY_TEXT);
  await expect(graph(page).locator('polyline[stroke="#1f6fb5"]')).toHaveCount(0);
  expect(await barValues(page)).toEqual(['none']);
  await expect(bars(page).getByText('—', { exact: true })).toBeVisible();
  await expect(page.getByText('가상 눈금자: 시야의 칸 길이')).toBeVisible();
  await expectSensorNear(page, '거리', 0, 1);
  expect(await page.locator('main').innerText()).not.toMatch(/NaN/);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('초점만 맞추면 10 mm·투명한 칸들(늘어났다)이고 초점 전용 질문이 나오며 그래프에 선이 생기고 흐림이 없어진다', async ({ page }) => {
  await open(page);
  await baselineRun(page, FOCUS);
  await setValue(page, FOCUS, '맞춤');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['10', '투명한 칸들']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('초점만 바꾸었어요. 보이는 모습은 어떻게 달라졌나요?');
  await expect(macro(page).getByTestId('field-cells')).not.toHaveAttribute('filter', /.+/);
  await expect(macro(page).getByTestId('microscope-note')).toHaveText('2.0초 · 칸 하나의 길이 10.0mm · 보인 것: 투명한 칸들');
  await expect(graph(page).getByTestId('graph-empty')).toHaveCount(0);
  await expect(graph(page).locator('polyline[stroke="#1f6fb5"]').last()).toBeVisible();
  expect(await barValues(page)).toEqual(['none', '10']);
  await expectSensorNear(page, '거리', 10, 1.5);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('배율만 400배로 바꾸면 100 mm이고 배율 질문이 나오며 시야의 칸이 크게 그려진다', async ({ page }) => {
  await open(page);
  await setValue(page, FOCUS, '맞춤');
  await baselineRun(page, POWER);
  expect(await resultCells(resultRows(page).first())).toEqual(['10', '투명한 칸들']);
  const w40 = await patternWidth(page);
  await setValue(page, POWER, '100배');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['25', '투명한 칸들']);
  await setValue(page, POWER, '400배');
  await run(page, '늘어난다');
  const row3 = resultRows(page).nth(2);
  expect(await resultCells(row3)).toEqual(['100', '투명한 칸들']);
  await expect(row3).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('배율만 바꾸었어요. 칸 하나의 길이와 시야에 보이는 칸의 수는 어떻게 달라졌나요?');
  expect(await patternWidth(page)).toBeGreaterThan(w40);
  expect(await barValues(page)).toEqual(['10', '25', '100']);
  await expectSensorNear(page, '거리', 100, 1.5);
  await expect(macro(page).getByTestId('microscope')).toHaveAttribute('data-power', '400');
});

test('염색하면 크기는 같고(변하지 않았다) 40배는 "색이 든 칸들", 100배부터는 "칸마다 진한 점이 있음"이다', async ({ page }) => {
  await open(page);
  await setValue(page, FOCUS, '맞춤');
  await baselineRun(page, STAIN);
  expect(await resultCells(resultRows(page).first())).toEqual(['10', '투명한 칸들']);
  await setValue(page, STAIN, '아이오딘 용액으로 함');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['10', '색이 든 칸들']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('염색 전과 후를 비교해 볼까요? 칸 안에서 새로 보인 것이 있나요?');
  const dots40 = await macro(page).locator('pattern#mc-cells circle').count();
  await selectIV(page, POWER);
  await setValue(page, POWER, '100배');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['25', '칸마다 진한 점이 있음']);
  expect(await macro(page).locator('pattern#mc-cells circle').count()).toBeGreaterThan(dots40);
  await expect(macro(page).getByTestId('microscope-note')).toContainText('보인 것: 칸마다 진한 점이 있음');
});

test('관찰 재료를 입안 안쪽 표피로 바꾸면 칸이 짧아지고(줄어들었다) 칸 모양이 둥글게 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, FOCUS, '맞춤');
  await setValue(page, POWER, '400배');
  await baselineRun(page, SAMPLE);
  expect(await resultCells(resultRows(page).first())).toEqual(['100', '투명한 칸들']);
  await expect(field(page)).toHaveAttribute('data-sample', 'onion');
  await setValue(page, SAMPLE, '입안 안쪽 표피');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['24', '투명한 칸들']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('관찰 재료만 바꾸었어요. 양파와 입안에서 본 칸의 모양과 크기는 어떻게 다른가요?');
  await expect(field(page)).toHaveAttribute('data-sample', 'cheek');
  expect(await barValues(page)).toEqual(['100', '24']);
});

test('대조 변인: 이름표 색만 바꾸면 결과가 같고(변하지 않았다) 이름표 전용 질문이 나오며 이름표 색이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, FOCUS, '맞춤');
  await baselineRun(page, LABEL);
  expect(await resultCells(resultRows(page).first())).toEqual(['10', '투명한 칸들']);
  await expect(macro(page).getByTestId('slide-label')).toHaveAttribute('data-color', 'yellow');
  await setValue(page, LABEL, '초록색');
  await run(page, '변하지 않는다');
  await expect(macro(page).getByTestId('slide-label')).toHaveAttribute('data-color', 'green');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['10', '투명한 칸들']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('이름표 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await barValues(page)).toEqual(['10', '10']);
});

test('막대 그래프: y축 0·50·100 눈금과 시행 번호가 있고 값 글자가 막대 위에 있다', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('칸 하나의 길이(mm)')).toBeVisible();
  await setValue(page, FOCUS, '맞춤');
  await setValue(page, POWER, '400배');
  await baselineRun(page, POWER);
  await expect(bars(page).getByTestId('cell-bar')).toHaveCount(1);
  await expect(bars(page).getByText('시행 번호')).toBeVisible();
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '50', '100', '1']) expect(texts).toContain(t);
});

test('그래프: y축 0~110(0, 55, 110), x축 0~2초(0, 1, 2), 0에서 시작해 칸 길이에서 멈춘다', async ({ page }) => {
  await open(page);
  await setValue(page, FOCUS, '맞춤');
  await setValue(page, POWER, '400배');
  await baselineRun(page, POWER);
  await expect(graph(page).getByText('화면에서 본 칸 하나의 길이(mm)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '55', '110']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-5).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 칸 길이가 0이고 시야는 아직 흐리다.
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('microscope-note')).toContainText('칸 하나의 길이 0.0mm');
  await expect(field(page)).toHaveAttribute('data-sharp', '0.00');
});
