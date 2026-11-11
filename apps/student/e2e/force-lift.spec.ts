import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, sensor, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const bars = (page: Page) => page.getByRole('figure', { name: '힘과 거리 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const TOOL = '쓰는 도구';
const ARM = '힘을 주는 쪽 길이';
const COLOR = '물체 색깔';
const LIMITS = /일의 원리|에너지|돌림힘|모멘트|마찰력|뉴턴/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g3-force', { experiment: 'lever-lift', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '힘과 우리 생활' })).toBeVisible();
}

/** 안전 점검표가 없는 활동이므로 바로 재생된다. */
async function run(page: Page, prediction: string) {
  await predict(page, prediction);
  await runButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(runButton(page)).toHaveText('▶ 실험 실행');
}

/** 기준 시행. iv: 바꿀 조건의 이름. */
async function baselineRun(page: Page, iv: string) {
  await selectIV(page, iv);
  await run(page, '변하지 않는다');
}

/** 결과표 한 줄의 저울 눈금·손으로 당긴 거리: 세 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(3, 5);
}

test('두 번째 활동 탭으로 열리고, 첫 활동(막대의 수평 잡기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByText('탐구 질문: 도구를 쓰면 물체를 들어 올리는 힘이 어떻게 달라질까?')).toBeVisible();
  await expect(page.getByText('예측: 용수철저울의 눈금은?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g3-force\/lever-balance$/);
  await expect(page.getByRole('group', { name: '오른쪽 추의 수' })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: TOOL })).toBeVisible();
});

test('기준(도구 없이, 짧게, 빨간 상자)이면 200, 20이 보이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 저울 눈금 "?", 물체는 바닥, 문구에 숫자 없음, 막대는 비어 있음
  await expect(macro(page).getByTestId('scale-reading')).toHaveText('저울 눈금: ?');
  await expect(macro(page).getByTestId('lift-art')).toHaveAttribute('data-lift', '0.00');
  await expect(macro(page).getByTestId('lift-note')).not.toContainText(/\d/);
  await expect(bars(page).getByTestId('force-bar')).toHaveAttribute('data-value', '0.0');
  await expect(bars(page).getByTestId('pull-bar')).toHaveAttribute('data-value', '0.0');
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, TOOL);
  expect(await resultCells(resultRows(page).first())).toEqual(['200', '20']);
  await expect(page.getByRole('columnheader', { name: '저울 눈금(g)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '손으로 당긴 거리(cm)' })).toBeVisible();
  await expect(macro(page).getByTestId('lift-note')).toHaveText('손으로 20 cm 당김 · 저울 눈금 200 g');
  await expect(macro(page).getByTestId('scale-reading')).toHaveText('저울 눈금: 200 g');
  await expect(macro(page).getByTestId('lift-art')).toHaveAttribute('data-lift', '20.00');
  await expect(page.getByText('가상 용수철저울: 저울 눈금')).toBeVisible();
  await expectSensorNear(page, '무게', 200, 0.5);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('쓰는 도구만 빗면으로 바꾸면 110, 40(줄어들었다)이고 도구 전용 질문과 빗면 그림이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, TOOL);
  await setValue(page, TOOL, '빗면');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['110', '40']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('쓰는 도구만 바꾸었어요. 같은 상자를 같은 높이로 들어 올릴 때 저울 눈금과 손으로 당긴 거리는 각각 어떻게 달라졌나요?');
  await expect(macro(page).getByTestId('ramp-surface')).toHaveCount(1);
  await expect(macro(page).getByTestId('lift-note')).toHaveText('손으로 40 cm 당김 · 저울 눈금 110 g');
  await expect(macro(page).getByTestId('arm-label')).toHaveText('빗면 길이 40 cm');
  await expectSensorNear(page, '무게', 110, 0.5);
  await expect(bars(page).getByTestId('force-bar')).toHaveAttribute('data-value', '110.0');
  await expect(bars(page).getByTestId('pull-bar')).toHaveAttribute('data-value', '40.0');
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('지레에서 힘을 주는 쪽 길이만 길게 바꾸면 67, 60(줄어들었다)이고 길이 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  // 도구를 지레로 고른 뒤 기준 시행(200, 20)을 한다. 바꿀 조건은 힘을 주는 쪽 길이.
  await setValue(page, TOOL, '지레');
  await baselineRun(page, ARM);
  expect(await resultCells(resultRows(page).first())).toEqual(['200', '20']);
  await expect(macro(page).getByTestId('lever-bar')).toHaveCount(1);
  await expect(macro(page).getByTestId('fulcrum')).toHaveCount(1);
  await setValue(page, ARM, '길게');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['67', '60']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('힘을 주는 쪽 길이만 바꾸었어요. 저울 눈금은 어떻게 달라졌나요?');
  await expect(macro(page).getByTestId('arm-label')).toHaveText('받침점에서 손까지 60 cm');
  await expect(macro(page).getByTestId('lift-note')).toHaveText('손으로 60 cm 당김 · 저울 눈금 67 g');
});

test('대조 변인: 물체 색깔만 바꾸면 결과가 같고(변하지 않았다) 색깔 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, TOOL, '빗면');
  await setValue(page, ARM, '중간');
  await baselineRun(page, COLOR);
  expect(await resultCells(resultRows(page).first())).toEqual(['55', '80']);
  await expect(macro(page).getByTestId('load-box')).toHaveAttribute('data-color', 'red');
  await setValue(page, COLOR, '파란 상자');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['55', '80']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('물체 색깔만 바꾸었을 때 저울 눈금은 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('load-box')).toHaveAttribute('data-color', 'blue');
});

test('도구를 쓰지 않을 때는 힘을 주는 쪽 길이를 바꿔도 결과가 같다', async ({ page }) => {
  await open(page);
  await baselineRun(page, ARM);
  await setValue(page, ARM, '길게');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['200', '20']);
  await expect(row2).toContainText('결과: 변하지 않았다');
});

test('두 조건을 함께 바꾸면 공정한 비교가 아니라고 알려 주고 함께 바뀜 질문을 한다', async ({ page }) => {
  await open(page);
  await baselineRun(page, TOOL);
  await setValue(page, TOOL, '지레');
  await setValue(page, COLOR, '파란 상자');
  await run(page, '변하지 않는다');
  await expect(tutorBox(page)).toContainText('함께 바뀌었어요');
  await expect(tutorBox(page)).toContainText('저울 눈금이 달라진 까닭이 어느 쪽 때문인지');
});

test('그래프: y축 0~250 g(50 간격), x축 0~120 cm(30 간격), 시행마다 가로선이 당긴 거리만큼 이어진다', async ({ page }) => {
  await open(page);
  await baselineRun(page, TOOL);
  await expect(graph(page).getByText('저울 눈금(g)', { exact: false }).first()).toBeVisible();
  await expect(graph(page).getByText('손으로 당긴 거리(cm)')).toBeVisible();
  const yTicks = await graph(page).locator('text[text-anchor="end"]').allTextContents();
  expect(yTicks).toEqual(['0', '50', '100', '150', '200', '250']);
  const xTicks = (await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x));
  expect(xTicks).toEqual(['0', '30', '60', '90', '120']);
  const pts = async () => {
    const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
    return raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  };
  const a = await pts();
  // 가로선: 모든 점의 y가 같다. 도구 없이는 20 cm까지(x축 120 cm 가운데 1/6)
  expect(new Set(a.map((p) => p[1])).size).toBe(1);
  const left = a[0]![0];
  const lenNone = a.at(-1)![0] - left;
  await setValue(page, TOOL, '빗면');
  await setValue(page, ARM, '길게');
  await run(page, '줄어든다');
  const b = await pts();
  expect(new Set(b.map((p) => p[1])).size).toBe(1);
  // 빗면 길게는 120 cm: 그래프 오른쪽 끝까지, 도구 없이(20 cm)의 6배 길이
  expect(b.at(-1)![0] - b[0]![0]).toBeCloseTo(lenNone * 6, 0);
  // 눈금이 낮아져(37 g) 선이 더 아래에 있다(그림 좌표는 아래가 큼)
  expect(b[0]![1]).toBeGreaterThan(a[0]![1]);
});

test('눈으로 보기: 그래프 슬라이더를 처음으로 옮기면 물체가 바닥으로 내려오고 저울 눈금은 그대로다', async ({ page }) => {
  await open(page);
  await selectIV(page, TOOL);
  await setValue(page, TOOL, '지레');
  await run(page, '변하지 않는다');
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await expect(macro(page).getByTestId('lift-art')).toHaveAttribute('data-lift', '20.00');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(macro(page).getByTestId('lift-art')).toHaveAttribute('data-lift', '0.00');
  await expect(macro(page).getByTestId('scale-reading')).toHaveText('저울 눈금: 200 g');
});

test('힘과 거리 보기: 라벨과 두 막대(눈금 0과 250, 0과 120)가 있다', async ({ page }) => {
  await open(page);
  for (const l of ['저울 눈금(g)', '손으로 당긴 거리(cm)', '250', '120']) await expect(bars(page).getByText(l, { exact: true })).toBeVisible();
});
