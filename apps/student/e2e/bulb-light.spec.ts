import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '시행별 막대 그래프' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const PLUS = '전지 (+)극 쪽 전선을 댄 곳';
const MINUS = '전지 (−)극 쪽 전선을 댄 곳';
const SWITCH = '스위치';
const WIRE = '전선 색깔';
const LIMITS = /전류|전압|저항|옴|회로도 기호/;

async function open(page: Page) {
  await gotoUnit(page, 'g6-electricity', { experiment: 'bulb-light' });
  await expect(page.getByRole('heading', { level: 1, name: '전기의 이용' })).toBeVisible();
}

/** 이 활동에는 안전 점검표가 없으므로 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 결과표 한 줄의 전구의 밝기·전구: 네 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 6);
}

const art = (page: Page) => macro(page).getByTestId('circuit-art');
const barValues = async (page: Page) => bars(page).getByTestId('bulb-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));

test('세 번째까지 활동 탭이 있고, 두 번째 활동으로 열리며, 첫 활동(전자석)과 셋째 활동으로 오갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 전지, 전구, 전선을 어떻게 연결하면 불이 켜질까?')).toBeVisible();
  await expect(page.getByText('예측: 전구의 밝기 눈금은?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g6-electricity\/electromagnet$/);
  await expect(page.getByRole('group', { name: '에나멜선을 감은 횟수' })).toBeVisible();
  await activityTab(page, 3).click();
  await expect(page).toHaveURL(/#\/unit\/g6-electricity\/battery-series$/);
  await expect(page.getByRole('group', { name: '전지 연결' }).getByRole('button', { name: /전지 2개를 한 줄로/ })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: PLUS })).toBeVisible();
});

test('바꿀 조건을 고르지 않아도 예측만 고르면 실행되고, 실행 전에는 연결 모양만 보이고 불빛·결과가 없다', async ({ page }) => {
  await open(page);
  // 실행 전: 연결 모양(전구·전선·스위치)은 보이지만 불빛과 결과는 없다. 그림 안에 글자가 없다.
  await expect(art(page)).toHaveAttribute('data-plus', 'none');
  await expect(art(page)).toHaveAttribute('data-switch', 'open');
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'false');
  await expect(macro(page).getByTestId('bulb-glow')).toHaveCount(0);
  await expect(macro(page).getByTestId('bulb-note')).toContainText('실험하면');
  await expect(macro(page).locator('svg text')).toHaveCount(0);
  await expect(bars(page).getByTestId('bulb-bar')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  // 예측만 고르면 되고, 바꿀 조건을 고르라는 안내가 나오지 않는다.
  await expect(runButton(page)).toBeDisabled();
  await expect(page.locator('#run-reasons')).toHaveText('예측을 먼저 골라 주세요.');
  await predict(page, '변하지 않는다');
  await expect(runButton(page)).toBeEnabled();
  await expect(page.locator('#run-reasons')).toHaveText('');
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await runButton(page).click();
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  expect(await resultCells(resultRows(page).first())).toEqual(['0', '켜지지 않음']);
  for (const h of ['전구의 밝기(눈금)', '전구']) await expect(page.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(macro(page).getByTestId('bulb-note')).toHaveText('2.0초 · 전구의 밝기 0.0눈금 · 전구: 켜지지 않음');
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'false');
  await expect(macro(page).getByTestId('bulb-glow')).toHaveCount(1);
  expect(await barValues(page)).toEqual([0]);
  await expect(page.getByText('가상 조도계: 전구의 밝기')).toBeVisible();
  await expectSensorNear(page, '빛 세기', 0, 0.5);
  await expect(page.locator('.sensors')).toContainText('눈금');
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('바꿀 조건 없이 연결 세 곳을 한꺼번에 바꾸면 켜짐(6)이고, 함께 바꾸었다는 질문이 나오며 불빛이 켜진다', async ({ page }) => {
  await open(page);
  await predict(page, '변하지 않는다');
  await runButton(page).click();
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
  await setValue(page, PLUS, '전구 꼭지');
  await setValue(page, MINUS, '전구 옆면 쇠붙이');
  await setValue(page, SWITCH, '닫힘');
  await run(page, '늘어난다');
  // 실행한 뒤 눈으로 보기는 그 시행의 연결을 보여 준다.
  await expect(art(page)).toHaveAttribute('data-plus', 'tip');
  await expect(art(page)).toHaveAttribute('data-minus', 'side');
  await expect(art(page)).toHaveAttribute('data-switch', 'closed');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['6', '켜짐']);
  await expect(tutorBox(page)).toContainText('불이 켜진 까닭이 어느 연결 때문인지 하나씩 바꾸어 확인해 볼까요?');
  await expect(tutorBox(page)).toContainText(`${PLUS}과 ${MINUS}과 스위치를 함께 바꾸었어요.`);
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'true');
  await expect(macro(page).getByTestId('bulb-note')).toHaveText('2.0초 · 전구의 밝기 6.0눈금 · 전구: 켜짐');
  expect(await barValues(page)).toEqual([0, 6]);
  await expectSensorNear(page, '빛 세기', 6, 0.5);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('하나씩 바꾸기: 스위치만 열면 꺼지고(줄어들었다), 전선을 댄 곳만 바꾸어도 꺼지며, 두 전선을 맞바꾸면 다시 켜진다', async ({ page }) => {
  await open(page);
  await setValue(page, PLUS, '전구 꼭지');
  await setValue(page, MINUS, '전구 옆면 쇠붙이');
  await setValue(page, SWITCH, '닫힘');
  await selectIV(page, SWITCH);
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).first())).toEqual(['6', '켜짐']);
  // 스위치만 열림
  await setValue(page, SWITCH, '열림');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['0', '켜지지 않음']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('스위치만 바꾸었어요. 전구는 어떻게 달라졌나요?');
  await expect(macro(page).getByTestId('switch')).toHaveAttribute('data-state', 'open');
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'false');
  // 스위치를 닫고 (+)극 쪽 전선만 옆면으로 옮기면 두 전선이 같은 곳에 닿아 꺼진다.
  await setValue(page, SWITCH, '닫힘');
  await selectIV(page, PLUS);
  await run(page, '줄어든다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['6', '켜짐']);
  await setValue(page, PLUS, '전구 옆면 쇠붙이');
  await run(page, '줄어든다');
  const row4 = resultRows(page).nth(3);
  expect(await resultCells(row4)).toEqual(['0', '켜지지 않음']);
  await expect(row4).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('전선을 댄 곳을 바꾸었어요. 불이 켜졌을 때와 켜지지 않았을 때 전선이 닿은 곳을 견주어 볼까요?');
  await expect(art(page)).toHaveAttribute('data-plus', 'side');
  // 두 전선의 자리를 맞바꾸면(전지의 극이 거꾸로 닿아도) 켜진다.
  await setValue(page, MINUS, '전구 꼭지');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(4))).toEqual(['6', '켜짐']);
  expect(await barValues(page)).toEqual([6, 0, 6, 0, 6]);
});

test('(−)극 쪽 전선을 대지 않으면 켜지지 않고, 옆면에 대면 켜진다(전선을 댄 곳 질문)', async ({ page }) => {
  await open(page);
  await setValue(page, PLUS, '전구 꼭지');
  await setValue(page, SWITCH, '닫힘');
  await selectIV(page, MINUS);
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).first())).toEqual(['0', '켜지지 않음']);
  await setValue(page, MINUS, '전구 옆면 쇠붙이');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['6', '켜짐']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('전선을 댄 곳을 바꾸었어요.');
});

test('대조 변인: 전선 색깔만 바꾸면 결과가 같고(변하지 않았다) 전선 전용 질문이 나오며 전선 색이 바뀐다', async ({ page }) => {
  await open(page);
  await setValue(page, PLUS, '전구 꼭지');
  await setValue(page, MINUS, '전구 옆면 쇠붙이');
  await setValue(page, SWITCH, '닫힘');
  await selectIV(page, WIRE);
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).first())).toEqual(['6', '켜짐']);
  await expect(art(page)).toHaveAttribute('data-wire', 'red');
  await setValue(page, WIRE, '검은색');
  await run(page, '변하지 않는다');
  await expect(art(page)).toHaveAttribute('data-wire', 'black');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['6', '켜짐']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('전선 색깔만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await barValues(page)).toEqual([6, 6]);
});

test('막대 그래프는 시행마다 하나씩 생기고 0·5·10 눈금과 시행 번호가 있다', async ({ page }) => {
  await open(page);
  await expect(bars(page).getByText('전구의 밝기(눈금)')).toBeVisible();
  await setValue(page, PLUS, '전구 꼭지');
  await setValue(page, MINUS, '전구 옆면 쇠붙이');
  await setValue(page, SWITCH, '닫힘');
  await run(page, '변하지 않는다');
  await expect(bars(page).getByTestId('bulb-bar')).toHaveCount(1);
  await expect(bars(page).getByText('시행 번호')).toBeVisible();
  const texts = await bars(page).locator('svg text').allTextContents();
  for (const t of ['0', '5', '10', '6']) expect(texts).toContain(t);
});

test('그래프: y축 0~10 눈금, x축 0~2초, 0에서 시작해 밝기에서 멈추고 슬라이더를 처음으로 옮기면 불빛이 꺼진다', async ({ page }) => {
  await open(page);
  await setValue(page, PLUS, '전구 꼭지');
  await setValue(page, MINUS, '전구 옆면 쇠붙이');
  await setValue(page, SWITCH, '닫힘');
  await run(page, '변하지 않는다');
  await expect(graph(page).getByText('전구의 밝기(눈금)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '2', '4', '6', '8', '10']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('bulb-note')).toContainText('전구의 밝기 0.0눈금');
  await expect(macro(page).getByTestId('bulb')).toHaveAttribute('data-lit', 'false');
});
