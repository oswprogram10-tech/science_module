import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const tape = (page: Page) => page.getByRole('figure', { name: '줄자로 재기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const OBJECT = '물체';
const ACTION = '하는 일';
const STRENGTH = '힘의 세기';
const COLOR = '물체 색깔';
const LIMITS = /뉴턴|가속도|관성|마찰력/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g3-force', { experiment: 'push-pull', ...opts });
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

/** 결과표 한 줄의 움직인 거리·방향·모양: 네 조건 다음 세 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 7);
}

const objX = async (page: Page) => Number(await macro(page).getByTestId('push-art').getAttribute('data-x'));
const objDist = async (page: Page) => Number(await macro(page).getByTestId('push-art').getAttribute('data-dist'));

test('세 번째 활동 탭으로 열리고, 활동 탭 넷으로 오갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(activityTab(page, 3)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('탐구 질문: 물체를 밀거나 당기면 물체에 어떤 변화가 생길까?')).toBeVisible();
  await expect(page.getByText('예측: 물체가 움직인 거리는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g3-force\/lever-balance$/);
  await expect(page.getByRole('group', { name: '오른쪽 추의 수' })).toBeVisible();
  await activityTab(page, 4).click();
  await expect(page).toHaveURL(/#\/unit\/g3-force\/spring-scale$/);
  await expect(page.getByRole('group', { name: '건 추의 개수' })).toBeVisible();
  await activityTab(page, 3).click();
  await expect(page.getByRole('group', { name: OBJECT, exact: true })).toBeVisible();
});

test('기준(수레, 밀기, 약하게, 빨간색)이면 30 cm · 손에서 멀어지는 쪽 · 그대로이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 물체는 출발점, 문구에 결과 없음, 줄자에 거리 표시 없음, 센서 0
  const x0 = await objX(page);
  expect(await objDist(page)).toBe(0);
  await expect(macro(page).getByTestId('push-note')).toContainText('실험하면');
  await expect(macro(page).getByTestId('push-note')).not.toContainText('출발점에서');
  await expect(tape(page).getByTestId('tape-bracket')).toHaveCount(0);
  await expect(tape(page).getByTestId('tape-label')).toHaveCount(0);
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, STRENGTH);
  expect(await resultCells(resultRows(page).first())).toEqual(['30', '손에서 멀어지는 쪽', '그대로']);
  await expect(page.getByRole('columnheader', { name: '움직인 거리(cm)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '움직인 방향' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '모양' })).toBeVisible();
  expect(await objDist(page)).toBe(30);
  expect(await objX(page)).toBeGreaterThan(x0);
  await expect(macro(page).getByTestId('push-note')).toHaveText('2.0초 · 출발점에서 30 cm');
  await expect(tape(page).getByTestId('tape-label')).toHaveText('30 cm');
  await expect(page.getByText('가상 줄자: 출발점에서 떨어진 거리')).toBeVisible();
  await expectSensorNear(page, '거리', 30, 0.2);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('힘의 세기만 세게로 바꾸면 80 cm(늘어났다)이고 세기 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, STRENGTH);
  await setValue(page, STRENGTH, '세게');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['80', '손에서 멀어지는 쪽', '그대로']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('힘의 세기만 바꾸었어요. 물체가 움직인 거리는 어떻게 달랐나요?');
  expect(await objDist(page)).toBe(80);
  await expectSensorNear(page, '거리', 80, 0.2);
  await expect(tape(page).getByTestId('tape-bracket')).toHaveAttribute('data-dist', '80.00');
});

test('하는 일만 당기기로 바꾸면 거리는 같고(변하지 않았다) 방향이 "손 쪽으로"이며 줄이 나타나고 방향 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, ACTION);
  await expect(macro(page).getByTestId('string')).toHaveCount(0);
  await setValue(page, ACTION, '당기기');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['30', '손 쪽으로', '그대로']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('밀 때와 당길 때 물체가 움직인 방향을 비교해 볼까요?');
  await expect(macro(page).getByTestId('string')).toHaveCount(1);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('물체만 찰흙으로 바꾸면 2 cm(줄어들었다)이고 "눌려 납작해짐", 당기기로 바꾸면 "길게 늘어남"이며 물체 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, OBJECT);
  await setValue(page, OBJECT, '찰흙 덩어리');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['2', '손에서 멀어지는 쪽', '눌려 납작해짐']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('물체만 바꾸었어요. 물체마다 움직인 거리와 모양은 어떻게 달랐나요?');
  await expect(macro(page).getByTestId('obj-art')).toHaveAttribute('data-deform', '1.00');
  // 하는 일을 당기기로 바꾸고 새 기준으로 한 번 더 한 뒤 비교한다
  await selectIV(page, ACTION);
  await setValue(page, ACTION, '당기기');
  await run(page, '변하지 않는다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['2', '손 쪽으로', '길게 늘어남']);
});

test('대조 변인: 물체 색깔만 파란색으로 바꾸면 결과가 같고(변하지 않았다) 색깔 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, STRENGTH, '세게');
  await baselineRun(page, COLOR);
  expect(await resultCells(resultRows(page).first())).toEqual(['80', '손에서 멀어지는 쪽', '그대로']);
  const fill = async () => macro(page).locator('[data-testid="obj-art"] rect').first().getAttribute('fill');
  const red = await fill();
  await setValue(page, COLOR, '파란색');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['80', '손에서 멀어지는 쪽', '그대로']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('물체 색깔만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  expect(await fill()).not.toBe(red);
});

test('예측과 결과가 다르면 찰흙과 수레의 변화를 결과표에서 찾아보라고 묻는다', async ({ page }) => {
  await open(page);
  await baselineRun(page, ACTION);
  await setValue(page, ACTION, '당기기');
  await run(page, '늘어난다');
  await expect(resultRows(page).nth(1)).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('찰흙과 수레는 힘을 받았을 때 각각 무엇이 변했나요? 결과표에서 찾아볼까요?');
});

test('그래프: y축 0~90 cm(0, 30, 60, 90), x축 0~2초(0, 1, 2), 출발점 0에서 시작해 멈춘 거리까지 오른다', async ({ page }) => {
  await open(page);
  await setValue(page, STRENGTH, '세게');
  await baselineRun(page, STRENGTH);
  await expect(graph(page).getByText('출발점에서 떨어진 거리(cm)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '30', '60', '90']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const pts = raw!.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  // 그림 좌표는 아래가 크다: 끝이 시작보다 위에 있고, 1.4초 이후에는 멈춘다
  expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1]);
  expect(new Set(pts.slice(-8).map((p) => p[1].toFixed(1))).size).toBe(1);
  // 슬라이더를 처음으로 옮기면 물체가 출발점으로 돌아온다
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await slider.focus();
  await slider.press('Home');
  expect(await objDist(page)).toBe(0);
});
