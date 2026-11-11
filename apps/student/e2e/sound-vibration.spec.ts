import type { Locator, Page } from '@playwright/test';
import { test, expect, gotoUnit, setValue, selectIV, predict, runButton, resultRows, expectSensorNear, activityTab } from './helpers';

const tutorBox = (page: Page) => page.getByRole('heading', { name: '생각해 볼까요?' }).locator('..');
const macro = (page: Page) => page.getByRole('figure', { name: '눈으로 보기' });
const meter = (page: Page) => page.getByRole('figure', { name: '소음계 보기' });
const graph = (page: Page) => page.getByRole('figure', { name: '그래프로 보기' });

const SOUND = '소리 내기';
const LOUD = '소리의 세기';
const OBJECT = '물체';
const SEED = '좁쌀 색';
const LIMITS = /진동수|진폭|파동|헤르츠|데시벨/;

async function open(page: Page, opts: { playback?: number } = {}) {
  await gotoUnit(page, 'g3-sound', { experiment: 'sound-vibration', ...opts });
  await expect(page.getByRole('heading', { level: 1, name: '소리의 성질' })).toBeVisible();
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

/** 결과표 한 줄의 좁쌀이 튄 높이·소리의 크기: 네 조건 다음 두 칸 */
async function resultCells(row: Locator) {
  return (await row.locator('td').allTextContents()).slice(4, 6);
}

const grainYs = async (page: Page) => (await macro(page).getByTestId('grain').evaluateAll((els) => els.map((e) => Number(e.getAttribute('cy')))));

test('두 번째 활동 탭으로 열리고, 첫 활동(줄을 튕겨 소리 알아보기)으로 돌아갈 수 있다', async ({ page }) => {
  await open(page);
  await expect(activityTab(page, 2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByText('탐구 질문: 소리가 나는 물체에는 어떤 공통점이 있을까?')).toBeVisible();
  await expect(page.getByText('예측: 좁쌀이 튄 높이는?')).toBeVisible();
  await activityTab(page, 1).click();
  await expect(page).toHaveURL(/#\/unit\/g3-sound\/string-sound$/);
  await expect(page.getByRole('group', { name: '튕기는 세기' })).toBeVisible();
  await activityTab(page, 2).click();
  await expect(page.getByRole('group', { name: SOUND })).toBeVisible();
});

test('기준(소리를 내지 않음, 약하게, 작은북, 노란 좁쌀)이면 0, 0이고 실행 전에는 결과를 그리지 않는다', async ({ page }) => {
  await open(page);
  // 실행 전: 좁쌀은 가만히, 손과 떨림 표시 없음, 문구에 숫자 없음, 소음계 칸 비어 있음
  await expect(macro(page).getByTestId('vib-art')).toHaveAttribute('data-bounce', '0.00');
  await expect(macro(page).getByTestId('vib-hand')).toHaveCount(0);
  await expect(macro(page).getByTestId('vib-marks')).toHaveCount(0);
  await expect(macro(page).getByTestId('grain')).toHaveCount(7);
  await expect(macro(page).getByTestId('vib-note')).not.toContainText('좁쌀 높이');
  await expect(meter(page).getByTestId('meter-cells')).toHaveAttribute('data-filled', '0');
  await expect(page.getByText('안전 점검표')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);

  await baselineRun(page, SOUND);
  expect(await resultCells(resultRows(page).first())).toEqual(['0', '0']);
  await expect(page.getByRole('columnheader', { name: '좁쌀이 튄 높이(mm)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '소리의 크기(눈금)' })).toBeVisible();
  // 소리를 내지 않아도 손은 대 보았지만 떨림 표시는 없고 좁쌀은 가만히 있다
  await expect(macro(page).getByTestId('vib-hand')).toHaveCount(1);
  await expect(macro(page).getByTestId('vib-marks')).toHaveCount(0);
  expect(new Set(await grainYs(page)).size).toBe(1);
  await expect(page.getByText('가상 소음계: 소리의 크기')).toBeVisible();
  await expectSensorNear(page, '소리', 0, 0.3);
  expect(await page.locator('main').innerText()).not.toMatch(LIMITS);
});

test('소리 내기만 바꾸면 5, 3(늘어났다)이고 소리 내기 전용 질문·떨림 표시·튀는 좁쌀이 나온다', async ({ page }) => {
  await open(page);
  await baselineRun(page, SOUND);
  await setValue(page, SOUND, '소리를 냄');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['5', '3']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('소리 내기만 바꾸었어요. 두 경우에 물체 위의 좁쌀은 각각 어떻게 되었나요? 손을 대 보면 어떤 모습이 보이나요?');
  await expect(macro(page).getByTestId('vib-marks')).toHaveCount(1);
  await expect(macro(page).getByTestId('vib-hand')).toHaveCount(1);
  // 재생이 끝나면 첫 마루(0.25초)에 멈춘다: 좁쌀이 튄 높이가 보인다
  await expect(macro(page).getByTestId('vib-note')).toHaveText('0.25초 · 좁쌀 높이 5.0 mm · 소리의 크기 3눈금');
  expect(new Set(await grainYs(page)).size).toBeGreaterThan(3);
  await expect(meter(page).getByTestId('meter-cells')).toHaveAttribute('data-filled', '3');
  await expectSensorNear(page, '소리', 3, 0.3);
  const slider = page.getByRole('slider', { name: '그래프 시각 옮기기' });
  await expect(slider).toHaveAttribute('aria-valuenow', '0.3');
  // 시각을 0.5초(바닥)로 옮기면 좁쌀이 모두 바닥에 있다
  await slider.focus();
  await slider.press('Home');
  await expect(macro(page).getByTestId('vib-art')).toHaveAttribute('data-bounce', '0.00');
  expect(new Set(await grainYs(page)).size).toBe(1);
});

test('소리의 세기만 세게 바꾸면 12, 7(늘어났다)이고 세기 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, SOUND, '소리를 냄');
  await baselineRun(page, LOUD);
  expect(await resultCells(resultRows(page).first())).toEqual(['5', '3']);
  await setValue(page, LOUD, '세게');
  await run(page, '늘어난다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['12', '7']);
  await expect(row2).toContainText('결과: 늘어났다');
  await expect(tutorBox(page)).toContainText('소리의 세기만 바꾸었어요. 좁쌀이 튄 높이와 소리의 크기는 각각 어떻게 달라졌나요?');
  await expect(macro(page).getByTestId('vib-note')).toHaveText('0.25초 · 좁쌀 높이 12.0 mm · 소리의 크기 7눈금');
  await expect(meter(page).getByTestId('meter-cells')).toHaveAttribute('data-filled', '7');
  await expectSensorNear(page, '소리', 7, 0.3);
});

test('물체만 소리굽쇠로 바꾸면 2, 1(줄어들었다)이고 물체 전용 질문과 소리굽쇠 그림이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, SOUND, '소리를 냄');
  await baselineRun(page, OBJECT);
  await setValue(page, OBJECT, '소리굽쇠');
  await run(page, '줄어든다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['2', '1']);
  await expect(row2).toContainText('결과: 줄어들었다');
  await expect(tutorBox(page)).toContainText('물체만 바꾸었어요. 물체마다 좁쌀이 튄 높이가 같았나요?');
  await expect(macro(page).getByTestId('vib-object')).toHaveAttribute('data-object', 'fork');
  await setValue(page, OBJECT, '스피커');
  await run(page, '늘어난다');
  expect(await resultCells(resultRows(page).nth(2))).toEqual(['4', '2']);
  await expect(macro(page).getByTestId('vib-object')).toHaveAttribute('data-object', 'speaker');
});

test('대조 변인: 좁쌀 색만 바꾸면 결과가 같고(변하지 않았다) 좁쌀 색 전용 질문이 나온다', async ({ page }) => {
  await open(page);
  await setValue(page, SOUND, '소리를 냄');
  await setValue(page, LOUD, '세게');
  await baselineRun(page, SEED);
  expect(await resultCells(resultRows(page).first())).toEqual(['12', '7']);
  await expect(macro(page).getByTestId('grains')).toHaveAttribute('data-seed', 'yellow');
  const yellowYs = await grainYs(page);
  await setValue(page, SEED, '흰 좁쌀');
  await run(page, '변하지 않는다');
  const row2 = resultRows(page).nth(1);
  expect(await resultCells(row2)).toEqual(['12', '7']);
  await expect(row2).toContainText('결과: 변하지 않았다');
  await expect(tutorBox(page)).toContainText('좁쌀 색만 바꾸었을 때 결과가 달라졌나요? 이 결과로 무엇을 알 수 있을까요?');
  await expect(macro(page).getByTestId('grains')).toHaveAttribute('data-seed', 'white');
  expect(await grainYs(page)).toEqual(yellowYs);
});

test('그래프: y축 0~15 mm(0, 5, 10, 15), x축 0~3초(0, 1, 2, 3), 사인 곡선 마루가 튄 높이와 같다', async ({ page }) => {
  await open(page);
  await setValue(page, SOUND, '소리를 냄');
  await setValue(page, LOUD, '세게');
  await baselineRun(page, SOUND);
  await expect(graph(page).getByText('좁쌀 높이(mm)').first()).toBeVisible();
  await expect(graph(page).getByText('시간(초)')).toBeVisible();
  expect(await graph(page).locator('text[text-anchor="end"]').allTextContents()).toEqual(['0', '5', '10', '15']);
  expect((await graph(page).locator('text[text-anchor="middle"]').allTextContents()).filter((x) => /^\d+$/.test(x))).toEqual(['0', '1', '2', '3']);
  const raw = await graph(page).locator('polyline[stroke="#1f6fb5"]').last().getAttribute('points');
  const ys = raw!.trim().split(/\s+/).map((p) => Number(p.split(',')[1]));
  // 위쪽 끝(12 mm)과 바닥이 모두 있다: 그림 좌표는 아래가 크다. 바닥(0 mm)과 마루(12 mm)의 차이는 눈금 12/15만큼
  const floor = Math.max(...ys);
  const peak = Math.min(...ys);
  expect(floor - peak).toBeGreaterThan(0);
  const unit = (floor - peak) / 12;
  // 15 mm 눈금 위쪽 끝(14)보다 아래에 있다
  expect(peak).toBeGreaterThan(14 + unit * 3 - 1);
});
