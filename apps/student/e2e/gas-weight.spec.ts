import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const gauge = (page: Page) => page.getByRole('figure', { name: '저울 숫자 크게 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const PUMPS = '공기 주입 마개를 누른 횟수';
const CAP = '마개';
const LABEL = '페트병 띠지 색깔';
const LIMITS = /기압|밀도|분자|압력/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g4-gases', { experiment: 'gas-weight', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '여러 가지 기체' })).toBeVisible();
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

/** 결과표 한 줄의 전자저울 무게·손으로 눌렀을 때: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

const taut = async (page: Page) => Number(await macro(page).getByTestId('gas-art').getAttribute('data-taut'));

test('두 번째 활동 탭으로 열리고, 첫 활동(주사기 속 기체의 부피)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 공기를 더 넣으면 무게가 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('예측: 페트병의 무게는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g4-gases\/syringe-volume$/);
  await expect(page.getByRole('group', { name: '피스톤을 누르는 힘' })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: PUMPS })).toBeVisible();
});

test('기준(0번, 닫아 둠, 빨간색)이면 45.3 g · 말랑함이고 실행 전에는 저울 숫자와 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 저울 숫자 "—", 병은 말랑한 처음 모양, 쉿 표시 없음, 문구에 숫자 없음
  await expect(macro(page).getByTestId('scale-digits')).toHaveText('— g');
  expect(await taut(page)).toBe(0);
  await expect(macro(page).getByTestId('vent-marks')).toHaveCount(0);
  await expect(macro(page).getByTestId('gas-note')).toContainText('실험하면');
  await expect(gauge(page).getByTestId('gauge-marker')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, PUMPS);
  expect(await resultCells(resultRows(page).first())).toEqual(['45.3', '말랑함']);
  await expect(page.getByRole('columnheader', { name: '전자저울 무게(g)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '손으로 눌렀을 때' })).toBeVisible();
  await expect(macro(page).getByTestId('scale-digits')).toHaveText('45.3 g');
  await expect(gauge(page).getByTestId('gauge-label')).toHaveText('45.3 g');
  await expect(page.getByText('가상 전자저울: 페트병')).toBeVisible();
  await expectSensorNear(page, '무게', 45.3, 0.06);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('누른 횟수만 20번으로 바꾸면 45.8 g · 조금 단단함(늘어났다)이고 횟수 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, PUMPS);
  await setValue(page, PUMPS, '20번');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['45.8', '조금 단단함']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('누른 횟수만 바꾸었어요. 저울 숫자는 어떻게 달라졌나요? 변화가 아주 작다면 어떻게 확인할 수 있을까요?');
  await expect(macro(page).getByTestId('scale-digits')).toHaveText('45.8 g');
  await expectSensorNear(page, '무게', 45.8, 0.06);
  expect(await taut(page)).toBeCloseTo(20 / 60, 2);
  await expect(gauge(page).getByTestId('gauge-marker')).toHaveAttribute('data-weight', '45.800');
});

test('40번 → 60번: 46.3 g · 단단함, 46.8 g · 아주 단단함으로 소수 첫째 자리까지 달라진다', async ({ page }) => {
  await open(page);
  await setValue(page, PUMPS, '40번');
  await baselineRun(page, PUMPS);
  expect(await resultCells(resultRows(page).first())).toEqual(['46.3', '단단함']);
  await setValue(page, PUMPS, '60번');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(1))).toEqual(['46.8', '아주 단단함']);
  await expect(macro(page).getByTestId('scale-digits')).toHaveText('46.8 g');
  expect(await taut(page)).toBe(1);
});

test('마개만 열어서 공기를 빼면 45.3 g · 말랑함(줄어들었다)이고 마개 전용 질문과 쉿 표시(글자 없음)가 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, PUMPS, '40번');
  await baselineRun(page, CAP);
  expect(await resultCells(resultRows(page).first())).toEqual(['46.3', '단단함']);
  await expect(macro(page).getByTestId('vent-marks')).toHaveCount(0);
  await setValue(page, CAP, '열어서 공기를 뺌');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['45.3', '말랑함']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('마개를 열었을 때 병의 무게와 단단한 정도는 각각 어떻게 되었나요?');
  await expect(macro(page).getByTestId('vent-marks')).toHaveCount(1);
  await expect(macro(page).getByTestId('vent-marks').locator('text')).toHaveCount(0);
  expect(await taut(page)).toBe(0);
  await expect(macro(page).getByTestId('scale-digits')).toHaveText('45.3 g');
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('대조 변인: 띠지 색깔만 파란색으로 바꾸면 결과가 같고(변하지 않았다) 띠지 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, PUMPS, '20번');
  await baselineRun(page, LABEL);
  expect(await resultCells(resultRows(page).first())).toEqual(['45.8', '조금 단단함']);
  const fill = async () => macro(page).getByTestId('bottle-label').getAttribute('fill');
  const red = await fill();
  await setValue(page, LABEL, '파란색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['45.8', '조금 단단함']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('띠지 색깔만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await fill()).not.toBe(red);
});

test('예측과 결과가 다르면 저울 숫자의 소수점 아래 자리까지 견주어 보라고 묻는다', async ({ page }) => {
  await open(page);
  await baselineRun(page, PUMPS);
  await setValue(page, PUMPS, '20번');
  await run(page, '변하지 않는다');
  await expect(resultRows(page).nth(1)).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('예측과 결과가 달랐네요. 저울 숫자의 소수점 아래 자리까지 견주어 볼까요?');
});

test('그래프: y축 45.0~47.0 g(45, 45.5, 46, 46.5, 47), x축 누른 횟수 0~60번(0, 20, 40, 60), 정한 횟수 뒤에는 수평이다', async ({ page }) => {
  await open(page);
  await setValue(page, PUMPS, '20번');
  await baselineRun(page, PUMPS);
  await expect(graph(page).getByText('전자저울 무게(g)').first()).toBeVisible();
  await expect(graph(page).getByText('누른 횟수(번)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['45', '45.5', '46', '46.5', '47']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '20', '40', '60']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 그림 좌표는 아래가 크다: 20번까지 오르고(끝이 시작보다 위), 그 뒤 마지막 점들은 같은 높이
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-20).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 저울 숫자가 처음 무게(45.3 g)로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('scale-digits')).toHaveText('45.3 g');
});
